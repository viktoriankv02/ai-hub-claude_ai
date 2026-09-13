export function schedulePanel(task,{node,mutate}) {
  const details=node('details',undefined,'schedule');details.append(node('summary','Розклад завдання'));
  if(task.schedule?.dueAt) details.append(node('p','Наступний термін: '+new Date(task.schedule.dueAt).toLocaleString('uk-UA'),'muted'));
  if(task.status!=='completed') {
    const form=node('form',undefined,'task-form');
    const label=node('label','Дата й час');const date=node('input');date.type='datetime-local';
    if(task.schedule?.dueAt){const d=new Date(task.schedule.dueAt);date.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}label.append(date);
    const repeatLabel=node('label','Повторення');const repeat=node('select');repeat.setAttribute('aria-label','Повторення');
    for(const [value,title] of [['once','Одноразово'],['daily','Кожні 24 години'],['weekly','Кожні 7 днів']]){const option=node('option',title);option.value=value;repeat.append(option);}repeat.value=task.schedule?.recurrence??'once';repeatLabel.append(repeat);
    const button=node('button','Зберегти розклад');button.type='submit';
    const status=node('p','');status.setAttribute('role','status');form.append(label,repeatLabel,button,status);
    form.onsubmit=async e=>{e.preventDefault();button.disabled=true;try{await mutate('/api/tasks/'+task.id+'/schedule',{dueAt:date.value?new Date(date.value).toISOString():null,recurrence:repeat.value,expectedRevision:task.schedule?.revision??0});}catch(error){status.textContent=error.message;button.disabled=false;}};
    details.append(form);
  }
  for(const item of task.completions||[]) details.append(node('p','✓ '+new Date(item.completedAt).toLocaleString('uk-UA')+' · '+item.evidence,'muted'));
  return details;
}
