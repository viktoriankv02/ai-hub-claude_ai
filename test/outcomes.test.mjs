import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PlanStore} from '../src/plan-store.mjs';
import {OutcomeLedger} from '../src/outcomes.mjs';
import {createApp} from '../src/server.mjs';
const payload=(amountUsd='0.10',kind='reward')=>({requestId:randomUUID(),kind,asset:'ETH',quantity:'0.000000000000000001',amountUsd,occurredAt:'2026-09-10T10:00:00Z',evidence:'User-provided transaction proof'});
const setup=(path=':memory:')=>{const s=new PlanStore(path,()=>new Date('2026-09-12T00:00:00Z'));const p=s.create({name:'Outcomes',network:'ink',source:'https://example.com'});return {s,p,ledger:new OutcomeLedger(s)};};
test('exact cents, unknown valuations and duplicate requests',()=>{
 const {s,p,ledger:l}=setup();const first=payload();l.record(p.id,first);l.record(p.id,first);l.record(p.id,payload('0.20'));l.record(p.id,payload('0.10','expense'));
 assert.equal(l.list(p.id).length,3);assert.equal(l.summary(p.id).rewardUsd,'0.30');assert.equal(l.summary(p.id).netUsd,'0.20');
 l.record(p.id,payload(null));assert.equal(l.summary(p.id).netUsd,null);assert.equal(l.summary(p.id).unknownValuations,1);
 assert.throws(()=>l.record(p.id,{...first,amountUsd:'100'}),/іншими/);s.close();
});
test('void preserves audit and persisted data across restart',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'drop-outcomes-')),'test.sqlite');let {s,p,ledger:l}=setup(path);const input=payload('1.00');l.record(p.id,input);
 l.void(input.requestId,{reason:'Mistaken amount'});l.void(input.requestId,{reason:'Retry'});assert.equal(l.summary(p.id).records,0);s.close();
 s=new PlanStore(path);l=new OutcomeLedger(s);assert.equal(l.list(p.id)[0].voidReason,'Mistaken amount');assert.equal(l.list(p.id)[0].quantity,'0.000000000000000001');s.close();
});
test('rejects precision loss, negative amounts, future dates and missing evidence',()=>{
 const {s,p,ledger:l}=setup();
 for(const patch of [{amountUsd:'0.001'},{amountUsd:-1},{amountUsd:'1e9'},{quantity:'0'},{quantity:'-1'},{evidence:''},{occurredAt:'2099-01-01T00:00:00Z'}])assert.throws(()=>l.record(p.id,{...payload(),...patch}));
 assert.equal(l.list(p.id).length,0);s.close();
});
test('HTTP records and voids results with session protection',async()=>{
 const {s,p}=setup();const app=createApp(s);await new Promise(r=>app.listen(0,'127.0.0.1',r));
 try{const root='http://127.0.0.1:'+app.address().port;const state=await(await fetch(root+'/api/state')).json();
 const input=payload('10.00');const path=root+'/api/projects/'+p.id+'/outcomes';
 assert.equal((await fetch(path,{method:'POST'})).status,403);
 const post=(url,body)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':state.token},body:JSON.stringify(body)});
 assert.equal((await post(path,input)).status,201);
 assert.equal((await(await fetch(root+'/api/state')).json()).projects[0].outcomeSummary.netUsd,'10.00');
 assert.equal((await post(root+'/api/outcomes/'+input.requestId+'/void',{reason:'QA correction'})).status,200);
 }finally{await new Promise(r=>app.close(r));s.close();}
});
