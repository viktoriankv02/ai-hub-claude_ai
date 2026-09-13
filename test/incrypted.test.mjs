import {test} from 'node:test';import assert from 'node:assert/strict';import {PlanStore} from '../src/plan-store.mjs';import {TrackerSearch,parseIncrypted} from '../src/tracker-search.mjs';import {DailyResearch} from '../src/daily-research.mjs';
const html='<tr class="airdrops-row" data-single-id="123"><td><span class="airdrop-item-title">Example</span></td><td class="airdrop-status"><span class="status-active">Active</span></td><td class="airdrop-activity">Testnet</td><td class="airdrop-profit">Unknown</td><td class="airdrop-dates">Unknown</td></tr>';
test('Incrypted imports real IDs and preserves unknown rewards',async()=>{
 const s=new PlanStore(':memory:');try{const t=new TrackerSearch(s,async u=>{assert.equal(u,'https://incrypted.com/airdrops/');return new Response(html,{headers:{'content-type':'text/html'}});});assert.equal((await t.scan('incrypted')).added,1);assert.equal(s.list()[0].source,'https://incrypted.com/airdrops/?single=123');assert.equal(s.list()[0].verified,0);assert.ok(parseIncrypted(html)[0].actions.includes('Testnet'));}finally{s.close();}
});
test('daily checks selected projects only, detects changes, preserves notes and respects interval',async()=>{
 const s=new PlanStore(':memory:');const p=s.create({name:'Example',network:'unknown',source:'https://incrypted.com/airdrops/?single=123',notes:'My notes'});let calls=0;let content=html;
 const d=new DailyResearch(s,{busy:false},async()=>{calls++;return new Response(content);});
 try{await d.tick();assert.equal(calls,0);s.setWorkflow(p.id,{workflow:'watching'});await d.tick();assert.equal(calls,1);await d.tick();assert.equal(calls,1);
 const old=s.setting('daily:'+p.id);s.setSetting('daily:'+p.id,{...old,attemptedAt:'2020-01-01T00:00:00Z'});content=html.replace('Testnet','New activity');await d.tick();assert.ok(s.setting('daily:'+p.id).previous.actions.includes('Testnet'));assert.equal(s.project(p.id).notes,'My notes');assert.equal(s.project(p.id).verified,0);
 }finally{s.close();}
});
