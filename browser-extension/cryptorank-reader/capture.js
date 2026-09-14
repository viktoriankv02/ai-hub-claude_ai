(()=>{
 let last='',busy=false;
 async function capture(){
 if(busy||document.hidden||!/^\/(?:ru\/)?drophunting\/[^/]+/.test(location.pathname))return;
 const {autoCapture}=await chrome.storage.local.get('autoCapture');if(!autoCapture)return;
 const root=document.querySelector('main')||document.body;
 const text=root.innerText.trim();if(text.length<150||text.length>16000||/Just a moment|Verify you are human/i.test(text))return;
 const links=[...root.querySelectorAll('a[href]')].filter(a=>a.getClientRects().length).map(a=>({label:a.innerText.trim(),url:a.href})).filter(a=>a.label&&/^https:\/\//.test(a.url)).slice(0,60);
 const data={name:(document.querySelector('h1')?.innerText||document.title).slice(0,120),source:location.href,text:text+'\n\nПосилання зі сторінки:\n'+links.map(a=>a.label+' — '+a.url).join('\n')};
 if(data.text.length>16000)return;const stamp=JSON.stringify(data);if(stamp===last)return;
 busy=true;try{const result=await chrome.runtime.sendMessage({type:'capture',data});if(result?.ok)last=stamp;}finally{busy=false;}
 }
 setInterval(()=>capture().catch(()=>{}),30000);capture().catch(()=>{});
})();