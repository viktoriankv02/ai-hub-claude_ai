import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InkOpportunitySource, DiscoveryService, sources } from '../src/discovery.mjs';
import { ResearchStore } from '../src/research-store.mjs';
import { Monitor } from '../src/monitor.mjs';
const sample=(hash='a')=>({source:sources[0],text:'Research evidence',hash,fetchedAt:new Date().toISOString()});
test('discovery deduplicates imports and invalidates verification only on content change',()=>{
 const s=new ResearchStore(':memory:'); const p=s.saveScan(sample()); s.verify(p.projectId,{evidence:'Official source checked'});
 assert.equal(s.saveScan(sample()).changed,false); assert.equal(s.list()[0].verified,1); assert.equal(s.list().length,1); assert.equal(s.list()[0].tasks.length,1);
 assert.equal(s.saveScan(sample('b')).changed,true); assert.equal(s.list()[0].verified,0); assert.equal(s.list()[0].evidence.length,3); s.close();
});
test('adapter reads only curated endpoints and removes executable content',async()=>{
 let calls=0;const adapter=new InkOpportunitySource(async(url,options)=>{calls++;assert.equal(options.redirect,'error');assert.ok(url.startsWith('https://docs.inkonchain.com/'));return new Response('<script>malicious()</script><main>'+ 'Official research material. '.repeat(10)+'</main>',{headers:{'content-type':'text/html'}});});
 await assert.rejects(adapter.read('https://localhost/'));assert.equal(calls,0);
 const result=await adapter.read('ink-docs');assert.ok(!result.text.includes('malicious'));assert.equal(result.hash.length,64);
 await assert.rejects(new InkOpportunitySource(async()=>new Response('tiny',{headers:{'content-type':'text/html'}})).read('ink-docs'),/Замало/);
 await assert.rejects(new InkOpportunitySource(async()=>new Response('x'.repeat(1500001),{headers:{'content-type':'text/html'}})).read('ink-docs'),/ліміт/);
});
test('concurrent scans share request; failures persist without deleting evidence',async()=>{
 const s=new ResearchStore(':memory:');let calls=0;const d=new DiscoveryService(s,{async read(){calls++;await new Promise(r=>setTimeout(r,5));return sample();}});
 await Promise.all([d.scan(sources[0].id),d.scan(sources[0].id)]);assert.equal(calls,1);assert.equal(s.list().length,1);
 await assert.rejects(d.scan(sources[0].id),/хвилину/);
 const bad=new DiscoveryService(s,{async read(){throw new Error('offline');}});await assert.rejects(bad.scan('ink-apps'),/offline/);assert.equal(s.latestScan('ink-apps').error,'offline');assert.equal(s.list().length,1);s.close();
});
test('monitor is opt-in and respects persisted interval',async()=>{
 const s=new ResearchStore(':memory:');let calls=0;const m=new Monitor(s,{async scan(){calls++;}});
 await m.tick();assert.equal(calls,0);s.setSetting('monitorEnabled',true);await m.tick();assert.equal(calls,sources.length);await m.tick();assert.equal(calls,sources.length);s.close();
});
