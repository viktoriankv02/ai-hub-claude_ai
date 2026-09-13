import {createHash} from 'node:crypto';
import {parseIncrypted} from './tracker-search.mjs';
export class DailyResearch {
 constructor(store,agents,fetcher=fetch){this.store=store;this.agents=agents;this.fetcher=fetcher;this.running=false;}
 start(){this.timer=setInterval(()=>this.tick().catch(()=>{}),60000);this.timer.unref();this.tick().catch(()=>{});}
 stop(){clearInterval(this.timer);}
 async tick(){
  if(this.running||this.agents.busy)return;
  const now=Date.now();
  const selected=this.store.list().filter(p=>['watching','active'].includes(p.workflow)&&/^https:\/\/incrypted\.com\/airdrops\/\?single=\d+$/.test(p.source));
  const due=selected.filter(p=>{const last=this.store.setting('daily:'+p.id,null);return !last||now-Date.parse(last.attemptedAt)>(last.error||last.aiError?3600000:86400000);});
  if(!due.length)return;
  this.running=true;
  try{
   const response=await this.fetcher('https://incrypted.com/airdrops/',{redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('Incrypted HTTP '+response.status);
   const reader=response.body.getReader();const chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw Error('Ліміт сторінки');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
   const cards=parseIncrypted(Buffer.concat(chunks).toString('utf8'),false);
   for(const p of due){
    const card=cards.find(c=>c.source===p.source);const attemptedAt=new Date().toISOString();
    if(!card){this.store.setSetting('daily:'+p.id,{attemptedAt,error:'Проєкт не знайдено на поточній сторінці. Це не підтверджує завершення кампанії.'});continue;}
    const hash=createHash('sha256').update(JSON.stringify(card)).digest('hex');
    const old=this.store.setting('daily:'+p.id,null);
    const changed=old?.hash!==hash;
    this.store.setSetting('daily:'+p.id,{attemptedAt,hash,snapshot:card,previous:changed?old?.snapshot:old?.previous,changed});
    if(changed)this.store.event(p.id,'Оновлено дані картки Incrypted. Перевірте умови; повний план ще не синхронізується.');
    if((changed||old?.aiError)&&this.agents.analyze){try{await this.agents.analyze(p.id);}catch(e){this.store.setSetting('daily:'+p.id,{...this.store.setting('daily:'+p.id),aiError:e.message});}} 
   }
  }catch(e){for(const p of due)this.store.setSetting('daily:'+p.id,{...this.store.setting('daily:'+p.id,{}),attemptedAt:new Date().toISOString(),error:e.message});}
  finally{this.running=false;}
 }
}
