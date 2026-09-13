import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAgenda} from '../src/agenda.mjs';
import {PlanStore} from '../src/plan-store.mjs';
import {createApp} from '../src/server.mjs';
const now=Date.parse('2026-09-12T12:00:00Z');
const task=(id,dueAt,status='pending')=>({id,title:id,status,policy:'manual',schedule:dueAt?{dueAt,recurrence:'once'}:null});
const project=(id,network,tasks)=>({id,name:id,network,verified:1,tasks});
test('agenda groups actual due tasks, excludes completed, and preserves unknown deadlines',()=>{
 const result=buildAgenda([project('p','ink',[task('due','2026-09-11T12:00:00Z'),task('soon','2026-09-13T12:00:00Z'),task('later','2026-09-13T12:00:01Z'),task('none',null),task('done','2026-09-10T12:00:00Z','completed')])],now);
 assert.equal(result.due,1);assert.equal(result.soon,1);assert.equal(result.later,1);assert.equal(result.unscheduled,1);assert.deepEqual(result.items.map(i=>i.taskId),['due','soon']);
});
test('unverified tasks remain visible and equal deadlines sort by name',()=>{
 const a=project('base','base',[task('base','2026-09-12T12:00:00Z')]);const b=project('ink','ink',[task('ink','2026-09-12T12:00:00Z')]);
 b.verified=0;b.analysis={state:'stale',deadlineState:'expired',rewardStatus:'unconfirmed'};
 const result=buildAgenda([a,b],now);assert.equal(result.items[0].network,'base');assert.equal(result.items[1].warnings.length,3);assert.equal(result.items.length,2);
});
test('agenda endpoint refreshes independently of forms using server clock',async()=>{
 const s=new PlanStore(':memory:',()=>new Date(now));const p=s.create({name:'Agenda fixture',network:'ink',source:'https://example.com'});
 const t=s.addTask(p.id,{title:'Read terms',kind:'research'});s.scheduleTask(t.id,{dueAt:'2026-09-12T10:00:00Z',recurrence:'once',expectedRevision:0});
 const app=createApp(s);await new Promise(r=>app.listen(0,'127.0.0.1',r));
 try{const root='http://127.0.0.1:'+app.address().port;
 const r=await fetch(root+'/api/agenda');assert.equal(r.status,200);assert.equal((await r.json()).due,1);
 assert.equal((await fetch(root+'/api/agenda',{headers:{Origin:'https://evil.example'}})).status,403);
 }finally{await new Promise(r=>app.close(r));s.close();}
});
