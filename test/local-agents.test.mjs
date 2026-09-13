import {test} from 'node:test';import assert from 'node:assert/strict';import {PlanStore} from '../src/plan-store.mjs';import {LocalAgents} from '../src/local-agents.mjs';
test('local agents use loopback model, save successful chat and leave projects untouched',async()=>{
 const s=new PlanStore(':memory:');const p=s.create({name:'Test',network:'unknown',source:'https://example.com'});
 const a=new LocalAgents(s,async(url,options)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');const body=JSON.parse(options.body);assert.equal(body.model,'qwen3:4b-instruct');assert.equal(body.think,false);return Response.json({message:{content:'Потрібні докази.'}});});
 try{assert.equal((await a.ask({message:'Проаналізуй',projectId:p.id})).answer,'Потрібні докази.');assert.equal(a.history().length,2);assert.equal(s.project(p.id).verified,0);assert.equal(s.list()[0].tasks.length,0);await assert.rejects(a.ask({message:' ',projectId:p.id}));}finally{s.close();}
});
test('local failures do not fabricate saved replies',async()=>{
 const s=new PlanStore(':memory:');const a=new LocalAgents(s,async()=>{throw Error('offline');});try{assert.equal((await a.status()).available,false);await assert.rejects(a.ask({message:'Привіт'}),/offline/);assert.equal(a.history().length,0);assert.equal(a.busy,false);}finally{s.close();}
});

test('truncated model output never becomes a saved answer',async()=>{
 const s=new PlanStore(':memory:');const a=new LocalAgents(s,async()=>Response.json({message:{content:'unfinished'},done_reason:'length'}));
 try{await assert.rejects(a.ask({message:'Проаналізуй'}),/обірвалася/);assert.equal(a.history().length,0);}finally{s.close();}
});
