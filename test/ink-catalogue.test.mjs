import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogueText, readCatalogue } from '../src/ink-catalogue.mjs';
const app = {name:"Builder's app",description:'A "quoted" description',network:'Mainnet',links:{mainnetWebsite:'https://example.com'}};
const script = apps => "JSON.parse('" + JSON.stringify({l:apps}).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + "')";
test('catalogue parses escaped data without executing code and filters unsafe URLs',()=>{
 const text=catalogueText(script([app,{...app,links:{mainnetWebsite:'javascript:alert(1)'}},{...app,name:'Test only',network:'Testnet'}])+';throw Error("never execute")');
 assert.ok(text.includes(app.name));assert.ok(text.includes(app.description));assert.ok(text.includes('https://example.com/'));assert.ok(!text.includes('javascript:'));assert.ok(!text.includes('Test only'));
 assert.equal(catalogueText('JSON.parse("changed")'),null);
});
test('catalogue fetches only same-origin assets and rejects missing data',async()=>{
 let calls=0;
 const text=await readCatalogue('<script src="https://evil.example/a.js"></script><script src="/_next/static/chunks/a.js"></script>',async(url,options)=>{
 calls++;assert.equal(url,'https://inkonchain.com/_next/static/chunks/a.js');assert.equal(options.redirect,'error');return new Response(script([app]));
 });
 assert.equal(calls,1);assert.ok(text.includes(app.name));
 await assert.rejects(readCatalogue('',()=>{throw Error('unexpected')}),/не знайдено/);
});
