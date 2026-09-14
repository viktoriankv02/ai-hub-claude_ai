import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('browser bridge sends material into local tab without exposing session token',async()=>{
 let handler,executed;const status=[];const chrome={runtime:{onMessage:{addListener(fn){handler=fn;}}},tabs:{async query(){return [{id:4}];}},scripting:{async executeScript(o){executed=o;return [{result:{ok:true,changed:true}}];}},storage:{local:{async set(s){status.push(s);}}}};
 vm.runInNewContext(readFileSync('browser-extension/cryptorank-reader/background.js','utf8'),{chrome,importScripts(){}});
 const result=await new Promise(resolve=>handler({type:'capture',data:{text:'Example'}},{tab:{url:'https://cryptorank.io/ru/drophunting/test'}},resolve));assert.equal(result.ok,true);assert.equal(executed.target.tabId,4);assert.equal(executed.args[0].text,'Example');assert.equal(result.token,undefined);
 const invalid=await new Promise(resolve=>handler({type:'capture',data:{}},{tab:{url:'https://example.com'}},resolve));assert.equal(invalid.ok,false);
});