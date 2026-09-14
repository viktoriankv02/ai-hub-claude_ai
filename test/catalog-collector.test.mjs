import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('catalog collects sequentially, filters foreign links and queues material locally',async()=>{
 let listener,alarm,storage={},calls=0,removed=[];const url='https://cryptorank.io/ru/drophunting/voice-activity1288';
 const chrome={runtime:{onMessage:{addListener(fn){listener=fn;}}},alarms:{onAlarm:{addListener(fn){alarm=fn;}},async create(){}},storage:{local:{async get(){return structuredClone(storage);},async set(s){storage={...storage,...structuredClone(s)};}}},tabs:{async query(){return [{id:1}];},async create(o){assert.equal(o.active,false);return {id:2};},async get(){return {id:2,url,status:'complete',active:false};},async remove(id){removed.push(id);}},scripting:{async executeScript(o){calls++;return [{result:o.target.tabId===2?{name:'VOICE',source:url,text:'Collected material'}:{ok:true}}];}}};
 const context=vm.createContext({chrome,URL,Date});vm.runInContext(readFileSync('browser-extension/cryptorank-reader/catalog.js','utf8'),context);
 const result=await new Promise(resolve=>listener({type:'catalog-start',urls:['https://example.com/',url,url]}, {},resolve));assert.equal(result.ok,true);assert.equal(storage.catalog.urls.length,1);assert.equal(storage.catalog.tabId,2);
 await vm.runInContext('catalogTick()',context);assert.equal(storage.catalog.done,1);assert.equal(calls,2);assert.deepEqual(removed,[2]);await vm.runInContext('catalogTick()',context);assert.equal(storage.catalog.enabled,false);
});
