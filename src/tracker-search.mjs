import {randomUUID} from 'node:crypto';
import {readableText} from './discovery.mjs';
export function parseTracker(html) {
 const found=new Map();
 for(const match of html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)){
  const block=match[0];
  const heading=block.match(/<a\b[^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>\s*<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
  if(!heading)continue;
  let url;try{url=new URL(heading[1]||heading[2]||heading[3],'https://airdrops.io/');}catch{continue;}
  if(url.origin!=='https://airdrops.io'||url.username||url.password||!/^\/[a-z0-9-]+\/$/.test(url.pathname))continue;
  const name=readableText(heading[4]).slice(0,120);
  const actions=readableText(block.match(/Actions:\s*<span>([\s\S]*?)<\/span>/i)?.[1]||'');
  if(!name||!actions||/casino|sportsbook|gambling/i.test(actions))continue;
  found.set(url.href,{name,source:url.href,network:'unknown',actions:actions.slice(0,600)});
 }
 if(!found.size)throw Error('Картки не знайдено: формат трекера міг змінитися');
 return [...found.values()].slice(0,40);
}

export function parseIncrypted(html,limit=true) {
 const found=new Map();
 for(const match of html.matchAll(/<tr\b[^>]*data-single-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g)){
  const block=match[2];
  if(limit&&!/status-active/.test(block))continue;
  const name=readableText(block.match(/class="airdrop-item-title"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'').slice(0,120);
  if(!name)continue;
  const actions=['activity','status','profit','dates'].map(field=>readableText(block.match(new RegExp('<td class="airdrop-'+field+'"[^>]*>([\\s\\S]*?)<\\/td>'))?.[1]||'')).join(' · ');
  found.set(match[1],{name,network:'unknown',source:'https://incrypted.com/airdrops/?single='+match[1],actions:actions.slice(0,600)});
 }
 if(!found.size)throw Error('Не знайдено активних карток Incrypted; формат міг змінитися');
 return limit?[...found.values()].slice(0,40):[...found.values()];
}

export class TrackerSearch {
 constructor(store,fetcher=fetch){this.store=store;this.fetcher=fetcher;this.running=null;}
 scan(sourceId='airdrops'){
  if(!['airdrops','incrypted'].includes(sourceId))return Promise.reject(Error('Невідомий трекер'));
  if(this.running && this.sourceId!==sourceId)return Promise.reject(Error('Інший пошук уже працює'));
  this.sourceId=sourceId;
  if(this.running)return this.running;
  const last=this.store.setting('trackerLastAttempt',null);
  if(last&&Date.now()-Date.parse(last)<60000)return Promise.reject(Error('Повторний пошук доступний через хвилину'));
  this.store.setSetting('trackerLastAttempt',new Date().toISOString());
  this.running=this.perform(sourceId).finally(()=>{this.running=null;});
  return this.running;
 }
 async perform(sourceId){
  const name=sourceId==='incrypted'?'Incrypted':'Airdrops.io';
  try{
   const response=await this.fetcher(sourceId==='incrypted'?'https://incrypted.com/airdrops/':'https://airdrops.io/',{redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('Трекер недоступний або не повернув HTML');
   const reader=response.body.getReader();const chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw Error('Сторінка перевищує 2 MB');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
   const candidates=(sourceId==='incrypted'?parseIncrypted:parseTracker)(Buffer.concat(chunks).toString('utf8'));const fetchedAt=new Date().toISOString();
   const result=this.store.transaction(()=>{
    let added=0,duplicates=0;
    for(const p of candidates){
     if(this.store.db.prepare('SELECT id FROM projects WHERE source=? OR lower(name)=lower(?)').get(p.source,p.name)){duplicates++;continue;}
     const id=randomUUID();
     const notes='Автоматично знайдено в '+name+' · '+fetchedAt+'\nДії за трекером: '+p.actions+'\nКандидат без ШІ-оцінки. Мережа, витрати, дедлайн та винагорода потребують перевірки за офіційними умовами.';
     this.store.db.prepare('INSERT INTO projects(id,name,network,source,notes,createdAt) VALUES(?,?,?,?,?,?)').run(id,p.name,p.network,p.source,notes,fetchedAt);
     this.store.event(id,'Знайдено у трекері '+name+': '+p.name);added++;
    }
    return {source:name,added,duplicates,found:candidates.length,fetchedAt};
   });
   this.store.setSetting('trackerResult',result);return result;
  }catch(error){this.store.setSetting('trackerResult',{error:error.message,fetchedAt:new Date().toISOString()});throw error;}
 }
}
