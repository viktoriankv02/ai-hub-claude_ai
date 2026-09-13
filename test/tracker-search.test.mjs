import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrackerSearch,parseTracker} from '../src/tracker-search.mjs';
import {PlanStore} from '../src/plan-store.mjs';
const html='<article><a href=https://airdrops.io/example/><h3>Example</h3></a>Actions: <span>Test application</span></article>';
test('tracker extracts candidates, ignores outbound and empty cards',()=>{
 assert.equal(parseTracker(html+html).length,1);
 assert.throws(()=>parseTracker(html.replace('https://airdrops.io/example/','https://evil.example/')));
 assert.throws(()=>parseTracker(html.replace('Test application','Play casino')));
});
test('tracker deduplicates concurrent searches and preserves user notes and verification',async()=>{
 const s=new PlanStore(':memory:');let calls=0;
 const t=new TrackerSearch(s,async()=>{calls++;return new Response(html,{headers:{'content-type':'text/html'}});});
 try{
 const [a,b]=await Promise.all([t.scan(),t.scan()]);assert.equal(calls,1);assert.equal(a.added,1);assert.deepEqual(a,b);
 assert.equal(s.list()[0].verified,0);
 const notes=s.list()[0].notes;s.setWorkflow(s.list()[0].id,{workflow:'watching'});
 s.setSetting('trackerLastAttempt',null);assert.equal((await t.scan()).duplicates,1);
 assert.equal(s.list()[0].notes,notes);assert.equal(s.list()[0].workflow,'watching');
 await assert.rejects(t.scan(),/хвилину/);
 s.setSetting('trackerLastAttempt',null);
 await assert.rejects(new TrackerSearch(s,async()=>new Response('bad',{status:503})).scan());
 assert.equal(s.list().length,1);assert.ok(s.setting('trackerResult').error);
 }finally{s.close();}
});
