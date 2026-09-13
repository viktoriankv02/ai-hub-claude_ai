import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PlanStore} from '../src/plan-store.mjs';
import {OutcomeLedger} from '../src/outcomes.mjs';
import {signalDefinitions} from '../src/assessment.mjs';
import {sources} from '../src/discovery.mjs';
import {createBackup,restoreBackup,inspectBackup} from '../src/backup.mjs';
import {createApp} from '../src/server.mjs';

async function fixture() {
 const dir=await mkdtemp(join(tmpdir(),'drop-backup-test-'));const s=new PlanStore(join(dir,'live.sqlite'),()=>new Date('2026-09-12T12:00:00Z'));const ledger=new OutcomeLedger(s);
 const p=s.saveScan({source:sources[0],text:'Teams must build products. Grants support builders.',hash:'test',fetchedAt:'2026-09-11T12:00:00Z'});s.verify(p.projectId,{evidence:'Checked source'});
 const draft=s.researchDraft(p.projectId);s.adoptResearch(p.projectId,{scanId:draft.scanId,itemIds:[draft.items[0].id]});
 s.saveAssessment(p.projectId,{campaignType:'grant',rewardStatus:'announced',risk:'medium',riskNote:'Allocation uncertain',estimatedCostUsd:0,deadline:null,eligibility:'Builders',evidenceNote:'Official terms',evidenceUrl:s.project(p.projectId).source,scanId:draft.scanId,signals:Object.fromEntries(signalDefinitions.map(d=>[d.key,{value:null,note:''}]))});
 const task=s.addTask(p.projectId,{title:'Check-in fixture',kind:'check-in'});const schedule=s.scheduleTask(task.id,{dueAt:'2026-09-11T12:00:00Z',recurrence:'daily',expectedRevision:0});s.complete(task.id,{scheduledFor:schedule.dueAt,scheduleRevision:schedule.revision,evidence:'Completed'});
 ledger.record(p.projectId,{requestId:randomUUID(),kind:'reward',asset:'USDC',quantity:'1',amountUsd:'1.00',occurredAt:'2026-09-11T12:00:00Z',evidence:'Receipt'});
 s.setSetting('monitorEnabled',false);return {dir,s,ledger,p};
}
test('live WAL backup restores all records and leaves the source database unchanged',async()=>{
 const {dir,s,ledger,p}=await fixture();let snapshot,restored;
 try {
  const projects=JSON.stringify(s.list()),history=JSON.stringify(s.history()),outcomes=JSON.stringify(ledger.list(p.projectId));
  snapshot=await createBackup(s.db);const info=inspectBackup(snapshot.path);assert.equal(info.projects,1);assert.equal(info.outcomes,1);
  const result=await restoreBackup(snapshot.path,join(dir,'restored.sqlite'));restored=new PlanStore(result.path,()=>new Date('2026-09-12T12:00:00Z'));const restoredLedger=new OutcomeLedger(restored);
  assert.equal(JSON.stringify(restored.list()),projects);assert.equal(JSON.stringify(restored.history()),history);assert.equal(JSON.stringify(restoredLedger.list(p.projectId)),outcomes);assert.equal(restored.setting('monitorEnabled',true),false);
  s.addTask(p.projectId,{title:'After backup',kind:'research'});assert.equal(s.list()[0].tasks.length,restored.list()[0].tasks.length+1);
 }finally{restored?.close();s.close();if(snapshot){const path=snapshot.path;await snapshot.dispose();await assert.rejects(access(path));}}
});
test('restore refuses existing destination and invalid input without changing files',async()=>{
 const {dir,s}=await fixture();const snapshot=await createBackup(s.db);
 try {
  const destination=join(dir,'keep.txt');await writeFile(destination,'DO NOT OVERWRITE');
  await assert.rejects(restoreBackup(snapshot.path,destination),e=>e.code==='EEXIST');assert.equal(await readFile(destination,'utf8'),'DO NOT OVERWRITE');
  const orphan=join(dir,'orphan.sqlite');await writeFile(orphan+'-wal','preserve');await assert.rejects(restoreBackup(snapshot.path,orphan),/службові/);assert.equal(await readFile(orphan+'-wal','utf8'),'preserve');
  const invalid=join(dir,'invalid.sqlite');await writeFile(invalid,'not a database');const target=join(dir,'new.sqlite');
  await assert.rejects(restoreBackup(invalid,target));await assert.rejects(access(target));
 }finally{s.close();await snapshot.dispose();}
});
test('backup HTTP requires session and downloads a valid independent SQLite file',async()=>{
 const {dir,s}=await fixture();const app=createApp(s);await new Promise(r=>app.listen(0,'127.0.0.1',r));
 try {
  const root='http://127.0.0.1:'+app.address().port;
  assert.equal((await fetch(root+'/api/backup',{method:'POST'})).status,403);
  const state=await(await fetch(root+'/api/state')).json();
  const response=await fetch(root+'/api/backup',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':state.token},body:'{}'});
  assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment/);
  const path=join(dir,'download.sqlite');await writeFile(path,Buffer.from(await response.arrayBuffer()));assert.equal(inspectBackup(path).projects,1);
 }finally{await new Promise(r=>app.close(r));s.close();}
});
