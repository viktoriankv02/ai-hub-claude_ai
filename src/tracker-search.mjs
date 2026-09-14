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

export function parseDropsTab(html){
 const found=new Map();
 for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)){
  let url;try{url=new URL(m[1],'https://dropstab.com');}catch{continue;}
  if(url.origin!=='https://dropstab.com'||url.username||url.password||!/^\/coins\/[a-z0-9-]+\/activities$/.test(url.pathname))continue;
  const name=readableText(m[2].match(/<span class="font-semibold text-sm[^">]*"[^>]*>([\s\S]*?)<\/span>/)?.[1]||'').slice(0,120);
  const actions=readableText(m[2]).slice(0,600);if(!name||!actions.includes('Active'))continue;
  url.search='';url.hash='';found.set(url.href,{name,source:url.href,network:'unknown',actions});
 }
 if(!found.size)throw Error('Активні картки DropsTab не знайдено; формат міг змінитися');return [...found.values()].slice(0,40);
}

// CryptoRank uses an authenticated JSON API (api.cryptorank.io/v3), not HTML —
// this is a different integration path than the other three trackers, which
// scrape public pages. See DEVELOPMENT.md for why the earlier HTML-scrape
// attempt at cryptorank.io/ru/drophunting was abandoned (403, bot-blocked)
// and why this one is architecturally different (official API + API key).
//
// IMPORTANT: CryptoRank's own migration docs list "Business" as the minimum
// plan for the Drophunting endpoints (docs.cryptorank.io/migration/endpoints-mapping).
// An MVP/sandbox key may still be rejected — that isn't a bug in this code,
// it's the account's plan. The error thrown below distinguishes that case
// (401/403) from a genuine outage so it's obvious which one happened.
//
// Field names below are inferred from CryptoRank's public docs and website
// (Cost, Time, Reward Type, Status, category) — NOT confirmed against a real
// response, since this environment has no network access to api.cryptorank.io.
// The parser is deliberately tolerant of a few plausible key-name variants per
// field; treat the first real run against the live API as the actual
// contract test, not this code.
export function parseCryptorankDrophunting(json){
 const list=Array.isArray(json)?json:Array.isArray(json?.data)?json.data:Array.isArray(json?.items)?json.items:null;
 if(!list)throw Error('CryptoRank повернув неочікувану форму відповіді (очікувався список активностей)');
 const found=new Map();
 for(const item of list){
  const id=item.id??item.activityId;
  const name=readableText(String(item.name??item.title??'')).slice(0,120);
  if(!id||!name)continue;
  const slug=item.slug||item.key;
  const source=slug?`https://cryptorank.io/drophunting/${slug}-activity${id}`:`https://cryptorank.io/drophunting/${id}`;
  const network=item.category?.name||item.category?.slug||item.network||item.blockchain||'unknown';
  const status=item.status??'';
  const rewardType=item.rewardType??item.type??'';
  const actions=readableText([status,rewardType,item.description].filter(Boolean).join(' · ')).slice(0,600);
  found.set(String(id),{name,source,network,actions});
 }
 if(!found.size)throw Error('CryptoRank: активних активностей не знайдено у відповіді');
 return [...found.values()].slice(0,40);
}

export class TrackerSearch {
 constructor(store,fetcher=fetch){this.store=store;this.fetcher=fetcher;this.running=null;}
 scan(sourceId='airdrops'){
  if(!['airdrops','incrypted','dropstab','cryptorank'].includes(sourceId))return Promise.reject(Error('Невідомий трекер'));
  if(this.running && this.sourceId!==sourceId)return Promise.reject(Error('Інший пошук уже працює'));
  this.sourceId=sourceId;
  if(this.running)return this.running;
  const last=this.store.setting('trackerLastAttempt',null);
  if(last&&Date.now()-Date.parse(last)<60000)return Promise.reject(Error('Повторний пошук доступний через хвилину'));
  this.store.setSetting('trackerLastAttempt',new Date().toISOString());
  this.running=this.perform(sourceId).finally(()=>{this.running=null;});
  return this.running;
 }
 async fetchCryptorank(){
  const apiKey=process.env.CRYPTORANK_API_KEY;
  if(!apiKey)throw Error('CRYPTORANK_API_KEY не задано. Додай ключ у .env (див. .env.example) і перезапусти сервер.');
  const response=await this.fetcher('https://api.cryptorank.io/v3/drophunting/list',{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'X-Api-Key':apiKey,Accept:'application/json'}});
  if(response.status===401||response.status===403)throw Error('CryptoRank відхилив ключ (HTTP '+response.status+'). За офіційною документацією Drophunting-ендпоінти потребують плану не нижче Business — перевір, чи твій ключ їх включає.');
  if(!response.ok)throw Error('CryptoRank повернув HTTP '+response.status);
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('CryptoRank не повернув JSON');
  const reader=response.body.getReader();const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw Error('Відповідь перевищує 2 MB');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
  return parseCryptorankDrophunting(JSON.parse(Buffer.concat(chunks).toString('utf8')));
 }
 async perform(sourceId){
  const name=sourceId==='cryptorank'?'CryptoRank':sourceId==='dropstab'?'DropsTab':sourceId==='incrypted'?'Incrypted':'Airdrops.io';
  try{
   let candidates;
   if(sourceId==='cryptorank'){
    candidates=await this.fetchCryptorank();
   }else{
    const response=await this.fetcher(sourceId==='dropstab'?'https://dropstab.com/activities':sourceId==='incrypted'?'https://incrypted.com/airdrops/':'https://airdrops.io/',{redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('Трекер недоступний або не повернув HTML');
    const reader=response.body.getReader();const chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw Error('Сторінка перевищує 2 MB');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
    candidates=(sourceId==='dropstab'?parseDropsTab:sourceId==='incrypted'?parseIncrypted:parseTracker)(Buffer.concat(chunks).toString('utf8'));
   }
   const fetchedAt=new Date().toISOString();
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
