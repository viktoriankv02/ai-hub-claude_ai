document.querySelector('#export').onclick=async()=>{
 const status=document.querySelector('#status');try{
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 const url=new URL(tab.url);if(url.origin!=='https://cryptorank.io'||!/^\/(?:[a-z]{2}\/)?drophunting\/[^/]+/.test(url.pathname))throw Error('Відкрий окрему картку проєкту в розділі Drophunting. Панель API та список проєктів не експортуються.');
 const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>({name:document.querySelector('h1')?.innerText||document.title,text:String(window.getSelection()).trim()||(document.querySelector('main')||document.body).innerText,source:location.href})});
 if(!result.text||result.text.length<80)throw Error('Недостатньо тексту. Дочекайся завантаження картки.');
 if(result.text.length>16000)throw Error('Сторінка довга. Виділи потрібну інструкцію (до 16 000 символів) і натисни ще раз.');
 const data={format:'ai-drop-hunter-material',version:1,name:result.name.slice(0,120),source:result.source,text:result.text,capturedAt:new Date().toISOString()};
 const blob=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=blob;a.download='cryptorank-material.json';a.click();setTimeout(()=>URL.revokeObjectURL(blob),10000);
 status.textContent='Файл збережено. У AI Drop Hunter → Імпорт CryptoRank вибери цей файл і натисни «Імпортувати матеріал».';
 }catch(e){status.textContent=e.message;}
};
chrome.storage.local.get(['autoCapture','captureStatus']).then(s=>{document.querySelector('#auto').checked=!!s.autoCapture;document.querySelector('#status').textContent=s.captureStatus||'';});document.querySelector('#auto').onchange=e=>chrome.storage.local.set({autoCapture:e.target.checked});

const catalogStatus=document.querySelector('#catalog-status');let catalogError='';
document.querySelector('#catalog-start').onclick=async()=>{catalogError='';try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab.url?.startsWith('https://cryptorank.io/'))throw Error('Відкрий каталог CryptoRank');const [{result:urls}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>[...document.querySelectorAll('a[href]')].filter(a=>a.getClientRects().length).map(a=>a.href)});const r=await chrome.runtime.sendMessage({type:'catalog-start',urls});catalogError=r?.error||'';catalogStatus.textContent=catalogError||'Збір запущено';}catch(e){catalogError=e.message.includes('Receiving end')?'Онови розширення в chrome://extensions: фоновий збирач недоступний.':e.message;catalogStatus.textContent=catalogError;}};
document.querySelector('#catalog-stop').onclick=()=>chrome.runtime.sendMessage({type:'catalog-stop'});
async function statusCatalog(){const {catalog}=await chrome.storage.local.get('catalog');catalogStatus.textContent=catalogError||catalog?.message||'Збір ще не запускався';}statusCatalog();setInterval(statusCatalog,2000);

document.querySelector('#copy-error').onclick=async()=>{try{await navigator.clipboard.writeText(catalogStatus.textContent);}catch{catalogStatus.style.userSelect='text';}};
