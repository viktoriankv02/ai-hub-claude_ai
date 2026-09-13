
export function setupLocalChat(getState) {
 const panel=document.querySelector('#robot-panel');
 const h=document.createElement('h3');h.textContent='Локальний ШІ-чат';
 const status=document.createElement('p');status.textContent='Перевіряю Ollama…';
 const log=document.createElement('div');log.setAttribute('aria-live','polite');
 const form=document.createElement('form');
 const select=document.createElement('select');select.setAttribute('aria-label','Проєкт для ШІ');
 const refresh=()=>{const current=select.value;select.replaceChildren(new Option('Загальне питання',''));for(const p of getState()?.projects||[])select.add(new Option(p.name,p.id));select.value=current;};
 select.onfocus=refresh;refresh();
 const input=document.createElement('textarea');input.required=true;input.maxLength=2000;input.placeholder='Запитай про проєкт або уточни свої вподобання';input.setAttribute('aria-label','Повідомлення локальному ШІ');
 const send=document.createElement('button');send.type='submit';send.textContent='Надіслати локальному ШІ';
 function entry(role,content){const p=document.createElement('p');p.textContent=(role==='user'?'Ти: ':'Дроп: ')+content;p.style.whiteSpace='pre-wrap';log.append(p);}
 form.append(select,input,send);panel.append(h,status,log,form);
 fetch('/api/agents').then(r=>r.json()).then(data=>{status.textContent=data.status.available?'Qwen3 4B · локально. Відповідь може тривати кілька хвилин.':'Ollama або модель ще не готова.';for(const m of data.messages)entry(m.role,m.content);}).catch(()=>status.textContent='Не вдалося перевірити модель.');
 form.onsubmit=async e=>{e.preventDefault();send.disabled=true;status.textContent='Дроп аналізує локально…';const question=input.value;try{const r=await fetch('/api/agents/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':getState()?.token||''},body:JSON.stringify({message:question,projectId:select.value||undefined})});const data=await r.json();if(!r.ok)throw Error(data.error);entry('user',question);entry('assistant',data.answer);input.value='';status.textContent='Відповідь збережена. Перевіряй висновки за джерелами.';}catch(e){status.textContent=e.message;}finally{send.disabled=false;}};
}
