import {test} from 'node:test';import assert from 'node:assert/strict';import {PlanStore} from '../src/plan-store.mjs';import {TrackerSearch,parseIncrypted} from '../src/tracker-search.mjs';import {DailyResearch} from '../src/daily-research.mjs';
const html='<tr class="airdrops-row" data-single-id="123"><td><span class="airdrop-item-title">Example</span></td><td class="airdrop-status"><span class="status-active">Active</span></td><td class="airdrop-activity">Testnet</td><td class="airdrop-profit">Unknown</td><td class="airdrop-dates">Unknown</td></tr>';
test('Incrypted imports real IDs and preserves unknown rewards',async()=>{
 const s=new PlanStore(':memory:');try{const t=new TrackerSearch(s,async u=>{assert.equal(u,'https://incrypted.com/airdrops/');return new Response(html,{headers:{'content-type':'text/html'}});});assert.equal((await t.scan('incrypted')).added,1);assert.equal(s.list()[0].source,'https://incrypted.com/airdrops/?single=123');assert.equal(s.list()[0].verified,0);assert.ok(parseIncrypted(html)[0].actions.includes('Testnet'));}finally{s.close();}
});
test('daily checks selected projects only, detects changes, preserves notes and respects interval',async()=>{
 const s=new PlanStore(':memory:');const p=s.create({name:'Example',network:'unknown',source:'https://incrypted.com/airdrops/?single=123',notes:'My notes'});let calls=0;let content=html;
 const d=new DailyResearch(s,{busy:false},async()=>{calls++;return new Response(content);},async()=>({text:'Guide',hash:'same',url:'https://incrypted.com/guide/'}));
 try{await d.tick();assert.equal(calls,0);s.setWorkflow(p.id,{workflow:'watching'});await d.tick();assert.equal(calls,1);await d.tick();assert.equal(calls,1);
 const old=s.setting('daily:'+p.id);s.setSetting('daily:'+p.id,{...old,attemptedAt:'2020-01-01T00:00:00Z'});content=html.replace('Testnet','New activity');await d.tick();assert.ok(s.setting('daily:'+p.id).previous.actions.includes('Testnet'));assert.equal(s.project(p.id).notes,'My notes');assert.equal(s.project(p.id).verified,0);
 }finally{s.close();}
});

test('guide changes trigger analysis without card changes and do not duplicate tasks',async()=>{
 const s=new PlanStore(':memory:');const p=s.create({name:'Guide project',network:'unknown',source:'https://incrypted.com/airdrops/?single=123'});s.setWorkflow(p.id,{workflow:'watching'});let hash='a',analyses=0;
 const d=new DailyResearch(s,{busy:false,async analyze(id){assert.equal(id,p.id);analyses++;}},async()=>new Response(html),async()=>({text:'Instruction '+hash,hash,url:'https://incrypted.com/guide/'}));
 try{await d.tick();assert.equal(analyses,1);assert.equal(d.progress.phase,'complete');assert.equal(d.progress.processed,1);assert.equal(d.progress.errors,0);s.verify(p.id,{evidence:'Checked'});await d.tick(true);assert.equal(analyses,1);assert.equal(s.project(p.id).verified,1);
 hash='b';await d.tick(true);assert.equal(analyses,2);assert.equal(s.project(p.id).verified,0);assert.equal(s.setting('previousGuide:'+p.id).hash,'a');assert.equal(s.list()[0].tasks.length,0);
 }finally{s.close();}
});
