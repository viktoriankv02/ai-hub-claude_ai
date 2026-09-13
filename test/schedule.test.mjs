import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskStore } from '../src/task-store.mjs';
import { createApp } from '../src/server.mjs';
function setup(path=':memory:',now='2026-09-11T12:00:00Z'){
 const store=new TaskStore(path,()=>new Date(now));
 const project=store.create({name:'Test campaign',network:'ink',source:'https://example.com/campaign'});
 store.verify(project.id,{evidence:'Official terms manually verified'});
 const task=store.addTask(project.id,{title:'Check in on official page',kind:'check-in'});
 return {store,task,project};
}
test('daily completion is idempotent and skips missed periods without inventing completions',()=>{
 const {store:s,task}=setup();
 const schedule=s.scheduleTask(task.id,{dueAt:'2026-09-08T10:00:00Z',recurrence:'daily',expectedRevision:0});
 const input={evidence:'Already checked in',scheduledFor:schedule.dueAt,scheduleRevision:schedule.revision};
 const result=s.complete(task.id,input);assert.equal(result.nextDueAt,'2026-09-12T10:00:00.000Z');
 assert.equal(s.complete(task.id,input).duplicate,true);assert.equal(s.list()[0].tasks[0].completions.length,1);
 assert.equal(s.list()[0].tasks[0].status,'pending');assert.equal(s.list()[0].tasks[0].dueState,'soon');
 const next=s.schedule(task.id);assert.throws(()=>s.complete(task.id,{...input,scheduledFor:next.dueAt,scheduleRevision:next.revision}),/ще не настав/);s.close();
});
test('concurrent schedule editors cannot overwrite each other',()=>{
 const {store:s,task}=setup();
 s.scheduleTask(task.id,{dueAt:null,recurrence:'once',expectedRevision:0});
 assert.throws(()=>s.scheduleTask(task.id,{dueAt:'2026-09-12T10:00:00Z',recurrence:'daily',expectedRevision:0}),/уже змінено/);
 assert.throws(()=>s.scheduleTask(task.id,{dueAt:null,recurrence:'daily',expectedRevision:1}),/потрібен/);s.close();
});
test('recurring evidence survives restart; verification gate still applies',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'drop-schedule-')),'test.sqlite');let {store:s,task,project}=setup(path);
 const schedule=s.scheduleTask(task.id,{dueAt:'2026-09-11T10:00:00Z',recurrence:'weekly',expectedRevision:0});
 s.db.prepare('UPDATE projects SET verified=0 WHERE id=?').run(project.id);
 assert.throws(()=>s.complete(task.id,{evidence:'checked',scheduledFor:schedule.dueAt,scheduleRevision:schedule.revision}),/перевірте/);
 s.verify(project.id,{evidence:'Rechecked'});
 s.complete(task.id,{evidence:'checked',scheduledFor:schedule.dueAt,scheduleRevision:schedule.revision});s.close();
 s=new TaskStore(path);assert.equal(s.schedule(task.id).dueAt,'2026-09-18T10:00:00.000Z');assert.equal(s.list()[0].tasks[0].completions[0].evidence,'checked');s.close();
});
test('stale completion cannot complete a task changed from recurring to once',()=>{
 const {store:s,task}=setup();
 const schedule=s.scheduleTask(task.id,{dueAt:'2026-09-11T10:00:00Z',recurrence:'daily',expectedRevision:0});
 s.scheduleTask(task.id,{dueAt:null,recurrence:'once',expectedRevision:1});
 assert.throws(()=>s.complete(task.id,{evidence:'checked',scheduledFor:schedule.dueAt,scheduleRevision:schedule.revision}),/змінився/);
 assert.equal(s.task(task.id).status,'pending');s.close();
});
test('HTTP schedules and completes the correct occurrence',async()=>{
 const {store:s,task}=setup();const app=createApp(s);await new Promise(r=>app.listen(0,'127.0.0.1',r));
 try{
  const url='http://127.0.0.1:'+app.address().port;const state=await(await fetch(url+'/api/state')).json();
  const post=(path,body)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':state.token},body:JSON.stringify(body)});
  let response=await post('/api/tasks/'+task.id+'/schedule',{dueAt:'2026-09-11T10:00:00Z',recurrence:'weekly',expectedRevision:0});assert.equal(response.status,200);
  const schedule=await response.json();
  response=await post('/api/tasks/'+task.id+'/complete',{evidence:'Read-only check in complete',scheduledFor:schedule.dueAt,scheduleRevision:schedule.revision});assert.equal(response.status,200);
  assert.equal(s.list()[0].tasks[0].completions.length,1);
 }finally{await new Promise(r=>app.close(r));s.close();}
});
