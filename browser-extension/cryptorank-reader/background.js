chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message.type!=='capture')return;
 (async()=>{
 if(!sender.tab?.url?.startsWith('https://cryptorank.io/'))throw Error('Непідтримувана вкладка');
 const tabs=await chrome.tabs.query({url:'http://127.0.0.1:4317/*'});if(!tabs.length)throw Error('Відкрий AI Drop Hunter у цьому самому браузері');
 const [{result}]=await chrome.scripting.executeScript({target:{tabId:tabs[0].id},args:[message.data],func:async data=>{
 const state=await(await fetch('/api/state')).json();const response=await fetch('/api/materials/import',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':state.token},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)return {ok:false,error:result.error};return {ok:true,changed:result.changed};
 }});await chrome.storage.local.set({captureStatus:result.ok?'Матеріал передано в застосунок':result.error});reply(result);
 })().catch(async e=>{await chrome.storage.local.set({captureStatus:e.message});reply({ok:false,error:e.message});});return true;
});
importScripts('catalog.js');
