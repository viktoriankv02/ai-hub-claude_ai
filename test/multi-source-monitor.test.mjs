import {test} from 'node:test';import assert from 'node:assert/strict';import {PlanStore} from '../src/plan-store.mjs';import {DailyResearch} from '../src/daily-research.mjs';
test('monitor isolates source failures, keeps snapshots and analyzes changed cards',async()=>{
 const s=new PlanStore(':memory:');let action='Testnet',missing=false,analyses=0;
 try{const p=s.create({name:'Alpha',network:'unknown',source:'https://airdrops.io/alpha/'}),q=s.create({name:'Beta',network:'unknown',source:'https://dropstab.com/coins/beta/activities'});for(const x of [p,q])s.setWorkflow(x.id,{workflow:'watching'});
 const d=new DailyResearch(s,{busy:false,async analyze(){analyses++;}},async url=>url.includes('dropstab')?new Response('',{status:503}):new Response('<article><a href="/'+(missing?'other':'alpha')+'/"><h3>Alpha</h3></a>Actions: <span>'+action+'</span></article>'));
 await d.tick(true);assert.equal(analyses,1);assert.equal(d.progress.errors,1);assert.ok(s.setting('daily:'+q.id).error.includes('503'));
 action='New task';await d.tick(true);assert.equal(analyses,2);assert.equal(s.setting('daily:'+p.id).previous.actions,'Testnet');
 missing=true;await d.tick(true);assert.equal(s.setting('daily:'+p.id).snapshot.actions,'New task');assert.ok(s.setting('daily:'+p.id).error);assert.equal(analyses,2);
 }finally{s.close();}
});