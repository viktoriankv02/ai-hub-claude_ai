import {test} from 'node:test';import assert from 'node:assert/strict';import {PlanStore} from '../src/plan-store.mjs';import {LocalAgents} from '../src/local-agents.mjs';
test('feedback enters only selected project context and can be forgotten',async()=>{
 const s=new PlanStore(':memory:');let prompt;
 const a=new LocalAgents(s,async(u,o)=>{prompt=JSON.parse(o.body).messages.at(-1).content;return Response.json({message:{content:'Готово'}});});
 try{const p=s.create({name:'One',network:'unknown',source:'https://example.com/one'}),q=s.create({name:'Two',network:'unknown',source:'https://example.com/two'});
 s.setSetting('agentReview:'+p.id,{createdAt:'revision-1',answer:'Draft'});
 assert.throws(()=>a.feedback({projectId:p.id,rating:'inaccurate',comment:'Fix',reviewCreatedAt:'old'}),/змінився/);
 assert.throws(()=>a.feedback({projectId:p.id,rating:'inaccurate',comment:'',reviewCreatedAt:'revision-1'}),/Поясни/);
 a.feedback({projectId:p.id,rating:'inaccurate',comment:'Prefer testnet activities',reviewCreatedAt:'revision-1'});
 await a.analyze(p.id);assert.ok(prompt.includes('Prefer testnet activities'));
 await a.analyze(q.id);assert.ok(!prompt.includes('Prefer testnet activities'));
 a.feedback({projectId:p.id,rating:'clear'});await a.analyze(p.id);assert.ok(!prompt.includes('Prefer testnet activities'));assert.equal(s.project(p.id).verified,0);
 }finally{s.close();}
});