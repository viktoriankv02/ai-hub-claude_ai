export function researchPanel(project,{node,mutate}) {
  const details=node('details',undefined,'assessment');details.append(node('summary','Знайти умови в матеріалах'));
  const content=node('div');details.append(content);
  details.addEventListener('toggle',async()=>{
    if(!details.open||content.childNodes.length)return;
    content.append(node('p','Шукаю згадки умов…','muted'));
    try {
      const response=await fetch('/api/projects/'+project.id+'/research-draft');const draft=await response.json();
      if(!response.ok)throw new Error(draft.error);
      content.replaceChildren(node('p',draft.notice,'muted'));
      if(!draft.items.length){content.append(node('p','У збереженому тексті немає достатніх згадок для плану. Перевірте повне джерело вручну.','muted'));return;}
      const boxes=[];
      for(const item of draft.items) {
        const row=node('div',undefined,'task');const label=node('label',undefined,'plan-choice');const box=node('input');box.type='checkbox';box.disabled=item.added||!project.verified;box.checked=!item.added&&!!project.verified;
        label.append(box,node('strong',item.title+(item.added?' · Уже додано':'')));row.append(label);
        for(const evidence of item.evidence)row.append(node('blockquote',evidence.text));
        boxes.push({box,id:item.id});content.append(row);
      }
      const button=node('button','Додати вибране до завдань');button.type='button';button.disabled=!project.verified;
      const status=node('p',project.verified?'':'Спочатку підтвердьте джерело.','muted');status.setAttribute('role','status');
      button.onclick=async()=>{button.disabled=true;try{await mutate('/api/projects/'+project.id+'/research-plan',{scanId:draft.scanId,itemIds:boxes.filter(b=>b.box.checked&&!b.box.disabled).map(b=>b.id)});}catch(e){status.textContent=e.message;button.disabled=false;}};
      content.append(button,status);
    }catch(e){content.replaceChildren(node('p',e.message,'muted'));}
  });
  return details;
}
