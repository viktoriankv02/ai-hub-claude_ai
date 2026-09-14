import {readIncryptedGuide} from './incrypted-guide.mjs';
import {createHash} from 'node:crypto';
import {parseIncrypted,parseTracker,parseDropsTab} from './tracker-search.mjs';
export function monitorSource(source){
 if(/^https:\/\/incrypted\.com\/airdrops\/\?single=\d+$/.test(source))return 'incrypted';
 if(/^https:\/\/dropstab\.com\/coins\/[a-z0-9-]+\/activities$/.test(source))return 'dropstab';
 if(/^https:\/\/airdrops\.io\/[a-z0-9-]+\/$/.test(source))return 'airdrops';
 return null;
}
export class DailyResearch {
 constructor(store,agents,fetcher=fetch,guideReader=readIncryptedGuide){this.guideReader=guideReader;this.store=store;this.agents=agents;this.fetcher=fetcher;this.running=false;this.progress={phase:'idle',processed:0,total:0,errors:0};}
 start(){this.timer=setInterval(()=>this.tick().catch(()=>{}),60000);this.timer.unref();this.tick().catch(()=>{});}
 stop(){clearInterval(this.timer);}
 async tick(force=false){
  if(this.running||this.agents.busy)return;
  const now=Date.now();
  const selected=this.store.list().filter(p=>['watching','active'].includes(p.workflow)&&monitorSource(p.source));
  const due=selected.filter(p=>{const last=this.store.setting('daily:'+p.id,null);return force||!last||now-Date.parse(last.attemptedAt)>(last.error||last.aiError?3600000:86400000);});
  if(!due.length){if(force)this.progress={phase:'idle',processed:0,total:0,errors:0,message:'Немає обраних проєктів Incrypted, DropsTab або Airdrops.io для перевірки'};return;}
  this.running=true;this.progress={phase:'collecting',processed:0,total:due.length,errors:0};
  try{
   const cache=new Map();
   const getCards=async source=>{
    if(cache.has(source))return cache.get(source);
    const request=(async()=>{
     const url={incrypted:'https://incrypted.com/airdrops/',dropstab:'https://dropstab.com/activities',airdrops:'https://airdrops.io/'}[source];
     const response=await this.fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
     if(!response.ok)throw Error(source+' HTTP '+response.status);
     const reader=response.body.getReader();const chunks=[];let size=0;
     try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw Error('Ліміт сторінки');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
     const html=Buffer.concat(chunks).toString('utf8');return source==='incrypted'?parseIncrypted(html,false):source==='dropstab'?parseDropsTab(html):parseTracker(html);
    })();cache.set(source,request);return request;
   };
   for(const p of due){
    this.progress.project=p.name;this.progress.phase='guide';
    const source=monitorSource(p.source);let cards;
    try{cards=await getCards(source);}catch(e){this.progress.errors++;this.progress.processed++;this.store.setSetting('daily:'+p.id,{...this.store.setting('daily:'+p.id,{}),attemptedAt:new Date().toISOString(),error:e.message});continue;}
    const card=cards.find(c=>c.source===p.source);const attemptedAt=new Date().toISOString();
    if(!card){this.progress.errors++;this.progress.processed++;this.store.setSetting('daily:'+p.id,{...this.store.setting('daily:'+p.id,{}),attemptedAt,error:'Проєкт не знайдено на поточній сторінці. Це не підтверджує завершення кампанії.'});continue;}
    const hash=createHash('sha256').update(JSON.stringify(card)).digest('hex');
    const old=this.store.setting('daily:'+p.id,null);
    let guideChanged=false;
    try{
     if(source==='incrypted'){
     const guide=await this.guideReader(p.source,this.fetcher);
     const previousGuide=this.store.setting('guide:'+p.id,null);
     guideChanged=previousGuide?.hash!==guide.hash;
     if(guideChanged&&previousGuide)this.store.setSetting('previousGuide:'+p.id,previousGuide);
     this.store.setSetting('guide:'+p.id,guide);
     }
    }catch(e){this.progress.errors++;this.progress.processed++;this.store.setSetting('daily:'+p.id,{...old,attemptedAt,error:'Інструкція: '+e.message});continue;}
    const changed=old?.hash!==hash||guideChanged;
    if(changed&&old)this.store.transaction(()=>{this.store.db.prepare('UPDATE projects SET verified=0 WHERE id=?').run(p.id);this.store.sourceChanged?.(p.id);});
    this.store.setSetting('daily:'+p.id,{attemptedAt,hash,snapshot:card,previous:changed?old?.snapshot:old?.previous,changed});
    if(changed)this.store.event(p.id,'Оновлено матеріали '+source+'. Перевірте зміни та висновок аналітика.');
    if((changed||old?.aiError)&&this.agents.analyze){try{this.progress.phase='analyzing';await this.agents.analyze(p.id);}catch(e){this.progress.errors++;this.store.setSetting('daily:'+p.id,{...this.store.setting('daily:'+p.id),aiError:e.message});}} 
    this.progress.processed++;
   }
  }catch(e){this.progress.errors=due.length;this.progress.message=e.message;for(const p of due)this.store.setSetting('daily:'+p.id,{...this.store.setting('daily:'+p.id,{}),attemptedAt:new Date().toISOString(),error:e.message});}
  finally{this.running=false;this.progress.phase='complete';this.progress.project=null;this.progress.completedAt=new Date().toISOString();}
 }
}
