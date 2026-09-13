import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlanStore} from '../src/plan-store.mjs';
test('workflow is validated, retained and does not verify rewards',()=>{
 const s=new PlanStore(':memory:');
 try{const p=s.create({name:'Candidate',network:'unknown',source:'https://example.com'});
 assert.equal(s.project(p.id).workflow,'new');
 s.setWorkflow(p.id,{workflow:'watching'});assert.equal(s.list()[0].workflow,'watching');assert.equal(s.project(p.id).verified,0);
 assert.throws(()=>s.setWorkflow(p.id,{workflow:'guaranteed'}));assert.equal(s.project(p.id).workflow,'watching');
 }finally{s.close();}
});
