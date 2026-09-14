import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrackerSearch,parseTracker,parseCryptorankDrophunting} from '../src/tracker-search.mjs';
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

// NOTE: this mock JSON shape is our best-effort guess at CryptoRank's real
// v3 drophunting/list response (inferred from public docs + website fields),
// not a captured real response — see comments in src/tracker-search.mjs.
const cryptorankJson=[
 {id:504,slug:'drop-protocol',name:'Drop Protocol',status:'POTENTIAL',rewardType:'AIRDROP',category:{name:'DeFi'},description:'Stake ATOM or TIA'},
 {id:11,slug:'io-net',name:'io.net',status:'DISTRIBUTED',rewardType:'AIRDROP',category:{name:'DePIN'},description:'Run a GPU node'},
 {id:999,name:''}, // missing name -> skipped
];

test('parseCryptorankDrophunting builds pretty URLs and skips incomplete entries',()=>{
 const result=parseCryptorankDrophunting(cryptorankJson);
 assert.equal(result.length,2);
 assert.equal(result[0].source,'https://cryptorank.io/drophunting/drop-protocol-activity504');
 assert.equal(result[0].network,'DeFi');
 assert.match(result[0].actions,/POTENTIAL/);
});

test('parseCryptorankDrophunting throws on an unrecognized shape',()=>{
 assert.throws(()=>parseCryptorankDrophunting({unexpected:true}),/неочікувану форму/);
});

test('cryptorank scan requires CRYPTORANK_API_KEY',async()=>{
 const s=new PlanStore(':memory:');
 const previous=process.env.CRYPTORANK_API_KEY;delete process.env.CRYPTORANK_API_KEY;
 try{
  await assert.rejects(new TrackerSearch(s,async()=>{throw Error('не мало викликатись без ключа');}).scan('cryptorank'),/CRYPTORANK_API_KEY/);
 }finally{s.close();if(previous!==undefined)process.env.CRYPTORANK_API_KEY=previous;}
});

test('cryptorank scan sends X-Api-Key and imports parsed candidates',async()=>{
 const s=new PlanStore(':memory:');
 const previous=process.env.CRYPTORANK_API_KEY;process.env.CRYPTORANK_API_KEY='test-key-123';
 let seenHeader;
 try{
  const t=new TrackerSearch(s,async(url,init)=>{
   seenHeader=init.headers['X-Api-Key'];
   assert.equal(url,'https://api.cryptorank.io/v3/drophunting/list');
   return new Response(JSON.stringify(cryptorankJson),{headers:{'content-type':'application/json'}});
  });
  const result=await t.scan('cryptorank');
  assert.equal(seenHeader,'test-key-123');
  assert.equal(result.added,2);
  assert.equal(result.source,'CryptoRank');
 }finally{s.close();if(previous!==undefined)process.env.CRYPTORANK_API_KEY=previous;else delete process.env.CRYPTORANK_API_KEY;}
});

test('cryptorank scan surfaces a clear plan/auth error on 401 or 403',async()=>{
 const s=new PlanStore(':memory:');
 const previous=process.env.CRYPTORANK_API_KEY;process.env.CRYPTORANK_API_KEY='test-key-123';
 try{
  const t=new TrackerSearch(s,async()=>new Response('{}',{status:403}));
  await assert.rejects(t.scan('cryptorank'),/Business/);
 }finally{s.close();if(previous!==undefined)process.env.CRYPTORANK_API_KEY=previous;else delete process.env.CRYPTORANK_API_KEY;}
});
