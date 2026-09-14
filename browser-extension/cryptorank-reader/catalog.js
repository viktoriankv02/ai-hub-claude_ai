let catalogBusy=false;
const validCard=u=>{try{const x=new URL(u);return x.origin==='https://cryptorank.io'&&!x.username&&!x.password&&/^\/(?:ru\/)?drophunting\/[a-z0-9-]+-activity\d+\/?$/.test(x.pathname);}catch{return false;}};
async function catalogTick(){
 if(catalogBusy)return;catalogBusy=true;
 try{
 let {catalog}=await chrome.storage.local.get('catalog');if(!catalog?.enabled)return;
 const apps=await chrome.tabs.query({url:'http://127.0.0.1:4317/*'});if(!apps.length){await chrome.tabs.create({url:'http://127.0.0.1:4317/',active:false});catalog.message='Відкрито AI Drop Hunter у цьому браузері. Очікую завантаження.';await chrome.storage.local.set({catalog});return;}
 if(!catalog.tabId){
 const url=catalog.urls[0];if(!url){catalog.enabled=false;catalog.message='Збір завершено';await chrome.storage.local.set({catalog});return;}
 if(!validCard(url))throw Error('Непідтримуване посилання');
 const tab=await chrome.tabs.create({url,active:false});catalog.tabId=tab.id;catalog.openedAt=Date.now();catalog.message='Читаю '+url;await chrome.storage.local.set({catalog});return;
 }
 const tab=await chrome.tabs.get(catalog.tabId);
 if(tab.status!=='complete'){if(Date.now()-catalog.openedAt>90000)throw Error('Сторінка не завантажилася');return;}
 if(tab.url!==catalog.urls[0])throw Error('Адреса вкладки змінилася. Перевір її та запусти збір знову.');
 const [{result:data}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
 const root=document.querySelector('main')||document.body;
 const text=root.innerText.trim();
 if(/Just a moment|Verify you are human|Проверка безопасности/i.test(document.title+' '+text))return {error:'Потрібна перевірка у вкладці CryptoRank. Збір призупинено.'};
 if(text.length<150)return {error:'Недостатньо відкритого тексту. Перевір сторінку.'};
 const links=[...root.querySelectorAll('a[href]')].filter(a=>a.getClientRects().length&&a.innerText.trim()&&a.href.startsWith('https://')).slice(0,60).map(a=>a.innerText.trim()+' — '+a.href).join('\n');
 const content=text+'\n\nПосилання зі сторінки:\n'+links;
 if(content.length>16000)return {error:'Інструкція завелика для поточного імпорту. Не збережено; потрібне розбиття на розділи.'};
 return {name:(document.querySelector('h1')?.innerText||document.title).slice(0,120),source:location.href,text:content};
 }});
 if(data.error)throw Error(data.error);
 if(data.source!==catalog.urls[0]||!validCard(data.source))throw Error('Адреса матеріалу змінилася під час читання');
 const beforeSave=await chrome.storage.local.get('catalog');if(!beforeSave.catalog?.enabled)return;
 const [{result:stored}]=await chrome.scripting.executeScript({target:{tabId:apps[0].id},args:[data],func:async data=>{
 const s=await(await fetch('/api/state')).json();const r=await fetch('/api/materials/import',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':s.token},body:JSON.stringify(data)});const result=await r.json();return r.ok?{ok:true}:{error:result.error};
 }});if(!stored.ok)throw Error(stored.error||'Помилка збереження');
 const latest=await chrome.storage.local.get('catalog');if(!latest.catalog?.enabled)return;
 catalog.urls.shift();catalog.done++;catalog.tabId=null;catalog.message='Збережено '+catalog.done+'; залишилося '+catalog.urls.length;await chrome.storage.local.set({catalog});
 const currentTab=await chrome.tabs.get(tab.id);if(!currentTab.active&&currentTab.url===data.source)await chrome.tabs.remove(tab.id);
 }catch(e){const {catalog}=await chrome.storage.local.get('catalog');if(catalog)await chrome.storage.local.set({catalog:{...catalog,enabled:false,message:e.message}});}
 finally{catalogBusy=false;}
}
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='catalog')catalogTick();});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(!['catalog-start','catalog-stop'].includes(m.type))return;
 if(sender.tab)return;
 (async()=>{
 const {catalog:old}=await chrome.storage.local.get('catalog');
 if(m.type==='catalog-stop'){if(old)await chrome.storage.local.set({catalog:{...old,enabled:false,message:'Зупинено користувачем'}});return {ok:true};}
 if(old?.enabled)throw Error('Збір уже працює');
 const urls=[...new Set((Array.isArray(m.urls)?m.urls:[]).filter(validCard))].slice(0,10);if(!urls.length)throw Error('На відкритій сторінці не знайдено карток CryptoRank');
 await chrome.storage.local.set({catalog:{enabled:true,urls,done:0,tabId:null,message:'Починаю збір'}});await chrome.alarms.create('catalog',{periodInMinutes:0.5});await catalogTick();const {catalog}=await chrome.storage.local.get('catalog');return catalog?.enabled?{ok:true}:{error:catalog?.message||'Не вдалося запустити збір'};
 })().then(reply).catch(e=>reply({error:e.message}));return true;
});
