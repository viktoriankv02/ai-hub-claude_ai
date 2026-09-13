export function renderAgenda(agenda,{node,onOpen}) {
  const root=document.querySelector('#agenda-content');if(!root||!agenda)return;
  const content=node('div');
  const line=node('div',undefined,'section-head');
  line.append(node('p','Настав термін: '+agenda.due+' · У найближчі 24 години: '+agenda.soon,'muted'));
  const button=node('button','Оновити перелік','secondary');button.type='button';
  const status=node('p','Стан на '+new Date(agenda.generatedAt).toLocaleString('uk-UA'),'muted');status.setAttribute('role','status');
  button.onclick=async()=>{button.disabled=true;try{const response=await fetch('/api/agenda');const data=await response.json();if(!response.ok)throw new Error(data.error);renderAgenda(data,{node,onOpen});}catch(error){status.textContent=error.message;button.disabled=false;}};
  line.append(button);content.append(line,status);
  if(!agenda.items.length)content.append(node('p','Немає завдань із терміном у найближчу добу. Додай розклад у картці завдання.','empty'));
  for(const item of agenda.items) {
    const row=node('div',undefined,'agenda-row');
    const info=node('div');info.append(node('strong',item.title),node('p',item.projectName+' · '+new Date(item.dueAt).toLocaleString('uk-UA'),'muted'));
    const stateLabel=item.dueState==='due'?'Настав термін':'Протягом 24 годин';
    info.append(node('span',stateLabel,'pill'));
    for(const warning of item.warnings)info.append(node('p',warning,'muted'));
    const open=node('button','До завдання ↗','secondary');open.type='button';open.setAttribute('aria-label','До завдання: '+item.title);open.onclick=()=>onOpen(item);
    row.append(info,open);content.append(row);
  }
  if(agenda.unscheduled||agenda.later)content.append(node('p','Без дедлайну: '+agenda.unscheduled+' · Пізніше: '+agenda.later,'muted'));
  root.replaceChildren(content);
}
