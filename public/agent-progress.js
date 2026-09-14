export function setupAgentProgress(refresh) {
 const box=document.querySelector('#agent-work-status');
 const update=document.createElement('button');update.type='button';update.textContent='Показати оновлені результати';update.hidden=true;box.after(update);
 let lastCompleted=null,lastQueue=null,busy=false;
 update.onclick=async()=>{update.disabled=true;try{await refresh();update.hidden=true;}finally{update.disabled=false;}};
 async function poll(){
  if(busy||document.hidden)return;busy=true;
  try{const r=await fetch('/api/agents/progress',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const p=await r.json();
   const labels={collecting:'Отримую картки',guide:'Читаю інструкцію',analyzing:'Аналізую локально',idle:'Очікую',complete:'Перевірку завершено'};
   box.textContent=(labels[p.phase]||p.phase)+(p.project?' · '+p.project:'')+' · Опрацьовано: '+p.processed+'/'+p.total+' · Помилок: '+p.errors+(p.message?' · '+p.message:'');
   if(p.queue){box.textContent+=' · Черга ШІ: '+p.queue.pending+' очікує, '+p.queue.running+' працює, '+p.queue.failed+' помилок';if(p.queue.revision&&p.queue.revision!==lastQueue){update.hidden=false;lastQueue=p.queue.revision;}}
   document.querySelector('#run-agents').disabled=p.running;
   if(p.completedAt&&p.completedAt!==lastCompleted){if(lastCompleted!==null||p.processed>0)update.hidden=false;lastCompleted=p.completedAt;}
  }catch{box.textContent='Не вдалося оновити статус агентів. Повторю спробу.';}finally{busy=false;}
 }
 poll();const timer=setInterval(poll,5000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
