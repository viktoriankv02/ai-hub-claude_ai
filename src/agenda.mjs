export function buildAgenda(projects,now=Date.now()) {
  const items=[];let unscheduled=0;let later=0;
  for(const project of projects)for(const task of project.tasks) {
    if(task.status==='completed'||task.status==='skipped')continue;
    const due=task.schedule?.dueAt?Date.parse(task.schedule.dueAt):NaN;
    if(!Number.isFinite(due)){unscheduled++;continue;}
    if(due>now+86400000){later++;continue;}
    const warnings=[];
    if(!project.verified)warnings.push('Потрібна перевірка джерела');
    if(project.analysis?.state==='stale')warnings.push('Оцінка умов застаріла');
    if(project.analysis?.deadlineState==='expired')warnings.push('Дедлайн кампанії минув');
    if(project.analysis?.rewardStatus==='closed')warnings.push('Кампанію позначено завершеною');
    items.push({taskId:task.id,projectId:project.id,projectName:project.name,network:project.network,title:task.title,dueAt:task.schedule.dueAt,recurrence:task.schedule.recurrence,dueState:due<=now?'due':'soon',policy:task.policy,warnings});
  }
  items.sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt)||a.projectName.localeCompare(b.projectName)||a.taskId.localeCompare(b.taskId));
  return {generatedAt:new Date(now).toISOString(),items,unscheduled,later,due:items.filter(i=>i.dueState==='due').length,soon:items.filter(i=>i.dueState==='soon').length};
}
