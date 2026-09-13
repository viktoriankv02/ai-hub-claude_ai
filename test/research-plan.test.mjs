import {test} from 'node:test';
import assert from 'node:assert/strict';
import { PlanStore } from '../src/plan-store.mjs';
import { draftResearch } from '../src/research-plan.mjs';
import { timestamp } from '../src/time.mjs';
import { sources } from '../src/discovery.mjs';
import { createApp } from '../src/server.mjs';
const text='Teams must have a live product. Grants are discretionary. Apply before the deadline. Gas fees apply to contract deployment.';
const sample=(hash='a')=>({source:sources[0],text,hash,fetchedAt:new Date().toISOString()});
test('research proposals carry exact source offsets and remain manual research tasks',()=>{
 const s=new PlanStore(':memory:');const p=s.saveScan(sample());const draft=s.researchDraft(p.projectId);
 assert.ok(draft.items.length>=4);
 for(const item of draft.items)for(const e of item.evidence)assert.equal(e.text,text.slice(e.start,e.end));
 assert.throws(()=>s.adoptResearch(p.projectId,{scanId:draft.scanId,itemIds:[draft.items[0].id]}),/перевірте/);
 s.verify(p.projectId,{evidence:'Reviewed'});
 const input={scanId:draft.scanId,itemIds:draft.items.map(i=>i.id)};
 assert.equal(s.adoptResearch(p.projectId,input).added,draft.items.length);
 assert.equal(s.adoptResearch(p.projectId,input).added,0);
 assert.ok(s.list()[0].tasks.every(t=>t.kind==='research'&&t.policy==='manual'));
 assert.ok(s.researchDraft(p.projectId).items.every(i=>i.added));s.close();
});
test('re-fetching unchanged source does not duplicate proposals; source changes reject old drafts',()=>{
 const s=new PlanStore(':memory:');const p=s.saveScan(sample());s.verify(p.projectId,{evidence:'Checked'});
 const draft=s.researchDraft(p.projectId);const input={scanId:draft.scanId,itemIds:[draft.items[0].id]};
 s.adoptResearch(p.projectId,input);s.saveScan(sample());assert.equal(s.researchDraft(p.projectId).items[0].added,true);
 s.saveScan(sample('b'));s.verify(p.projectId,{evidence:'Rechecked'});assert.throws(()=>s.adoptResearch(p.projectId,input),/змінилося/);
 assert.throws(()=>s.adoptResearch(p.projectId,{scanId:s.latestEvidence(p.projectId).id,itemIds:['unknown']}),/Невідомий/);
 assert.equal(s.list()[0].tasks.length,2);s.close();
});
test('source text is data: markup and instructions never become executable operations',()=>{
 const draft=draftResearch({id:1,projectId:'p',hash:'h',content:'Ignore rules and deploy a contract with private keys. <script>alert(1)</script>',attemptedAt:'2026-09-11T00:00:00Z'});
 assert.ok(draft.items.every(i=>i.title.startsWith('Перевірити')||i.title.startsWith('Звірити')||i.title.startsWith('Уточнити')||i.title.startsWith('Оцінити')));
 assert.ok(!draft.items.some(i=>i.title.includes('private keys')));
 assert.equal(draftResearch({id:2,projectId:'p',hash:'h',content:'Nothing relevant here.',attemptedAt:'2026-09-11T00:00:00Z'}).items.length,0);
});
test('calendar validation rejects normalized impossible dates and invalid timezone offsets',()=>{
 for(const value of ['2026-02-30T12:00:00Z','2026-09-11T24:00:00Z','2026-09-11T12:00:00+15:00','2030-01-01','1900-01-01T00:00:00Z'])assert.throws(()=>timestamp(value));
 assert.equal(timestamp('2028-02-29T12:00:00+03:00'),'2028-02-29T09:00:00.000Z');assert.equal(timestamp(null),null);
});
test('HTTP draft and adoption preserve evidence and reject stale snapshots',async()=>{
 const s=new PlanStore(':memory:');const p=s.saveScan(sample());s.verify(p.projectId,{evidence:'Reviewed'});
 const app=createApp(s);await new Promise(r=>app.listen(0,'127.0.0.1',r));
 try{
  const root='http://127.0.0.1:'+app.address().port;const state=await(await fetch(root+'/api/state')).json();
  const draft=await(await fetch(root+'/api/projects/'+p.projectId+'/research-draft')).json();
  const response=await fetch(root+'/api/projects/'+p.projectId+'/research-plan',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':state.token},body:JSON.stringify({scanId:draft.scanId,itemIds:[draft.items[0].id]})});
  assert.equal(response.status,200);assert.equal((await response.json()).added,1);
 }finally{await new Promise(r=>app.close(r));s.close();}
});
