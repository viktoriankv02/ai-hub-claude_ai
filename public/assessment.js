export function assessmentPanel(project, { node, mutate }) {
  const details = node('details', undefined, 'assessment');
  details.append(node('summary', 'Умови кампанії та оцінка'));
  const summary = project.analysis;
  if (summary) {
    details.append(node('p', summary.score === null ? 'Оцінка ще не готова або потребує перегляду.' : 'Повнота плану участі: ' + summary.score + '/100 · Відомо сигналів: ' + summary.coverage + '%', 'score'));
    for (const warning of summary.warnings) details.append(node('p', warning, 'muted'));
  }
  const previous = project.assessment?.data;
  if (previous) {
    const states = { current: 'Актуальна', stale: 'Потребує перегляду', missing: 'Немає оцінки' };
    details.append(node('p', states[summary.state] + ' · Оцінено вручну ' + new Date(project.assessment.createdAt).toLocaleString('uk-UA'), 'muted'));
    const info = node('dl', undefined, 'facts');
    const pairs = [
      ['Умови участі', previous.eligibility],
      ['Витрати', previous.estimatedCostUsd === null ? 'Невідомо' : previous.estimatedCostUsd + ' USD (оцінка)'],
      ['Дедлайн', previous.deadline ? new Date(previous.deadline).toLocaleString('uk-UA') : 'Невідомо'],
      ['Ризик', { unknown:'Невідомо',low:'Низький',medium:'Середній',high:'Високий' }[previous.risk] + ': ' + previous.riskNote],
    ];
    for (const [label,value] of pairs) info.append(node('dt',label),node('dd',value));
    details.append(info);
  }
  if (!project.verified) {
    details.append(node('p', 'Підтвердьте джерело, щоб записати оцінку.', 'muted'));
    return details;
  }
  const form = node('form', undefined, 'form-grid');
  const field = (label, input, wide = false) => { input.setAttribute('aria-label',label); const wrap=node('label',undefined,wide?'wide':undefined); wrap.append(node('span',label),input); form.append(wrap); return input; };
  const select = (name, options, value) => {
    const input=node('select'); input.name=name;
    for (const [key,label] of options) { const option=node('option',label); option.value=key; input.append(option); }
    if (value !== undefined) input.value=value;
    return input;
  };
  const text = (name, value, max) => { const input=node('textarea'); input.name=name; input.required=true; input.maxLength=max; input.value=value || ''; return input; };
  field('Тип кампанії',select('campaignType',[['unknown','Ще невідомо'],['airdrop','Airdrop'],['grant','Грант'],['points','Бали'],['testnet','Testnet'],['quest','Квест']],previous?.campaignType));
  field('Статус за вашою перевіркою',select('rewardStatus',[['unconfirmed','Не підтверджено'],['announced','Оголошено в джерелі'],['closed','Завершено']],previous?.rewardStatus));
  field('Умови участі / обмеження',text('eligibility',previous?.eligibility,3000),true);
  field('Доказ умов: цитата або висновок із джерела',text('evidenceNote',previous?.evidenceNote,2000),true);
  field('Ризик',select('risk',[['unknown','Ще невідомо'],['low','Низький'],['medium','Середній'],['high','Високий']],previous?.risk));
  const cost=node('input');cost.name='estimatedCostUsd';cost.type='number';cost.min='0';cost.max='1000000';cost.step='0.01';cost.placeholder='Порожньо = невідомо';cost.value=previous?.estimatedCostUsd??'';
  field('Оцінка витрат, USD',cost);
  field('Пояснення ризику / що ще не перевірено',text('riskNote',previous?.riskNote,2000),true);
  const deadline=node('input');deadline.name='deadline';deadline.type='datetime-local';
  if(previous?.deadline) { const date=new Date(previous.deadline); deadline.value=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16); }
  field('Дедлайн у вашому місцевому часовому поясі (необов’язково)',deadline,true);
  const signalLabels = [
    ['eligibility','Відповідність умовам участі',30],
    ['rewardClarity','Зрозумілість умов винагороди',25],
    ['verifiability','Можливість підтвердити виконання',20],
    ['costClarity','Відомі витрати участі',15],
    ['timeFit','Можливість встигнути до дедлайну',10],
  ];
  const signalFields = {};
  for (const [key,label,weight] of signalLabels) {
    const input=node('input');input.type='number';input.min='0';input.max='100';input.step='1';input.placeholder='Невідомо';input.value=previous?.signals[key]?.value??'';
    field(label+' · вага '+weight+'%',input);
    const note=node('input');note.maxLength=500;note.placeholder='Чим підтверджено бал';note.value=previous?.signals[key]?.note??'';
    field('Обґрунтування',note);
    signalFields[key]={input,note};
  }
  const help=node('p','Бали описують повноту й придатність плану за вашою оцінкою, а не ймовірність дропу. Невідомі сигнали не додають балів.','muted wide');
  const status=node('p','', 'wide');status.setAttribute('role','status');
  const button=node('button','Зберегти оцінку');button.type='submit';form.append(help,status,button);
  const scanId=project.latestEvidence?.id??null;
  form.onsubmit=async event=>{
    event.preventDefault();button.disabled=true;
    try {
      const values=Object.fromEntries(new FormData(form));
      values.estimatedCostUsd=values.estimatedCostUsd===''?null:Number(values.estimatedCostUsd);
      values.deadline=values.deadline?new Date(values.deadline).toISOString():null;
      values.evidenceUrl=project.source; values.scanId=scanId;
      values.signals=Object.fromEntries(Object.entries(signalFields).map(([key,{input,note}])=>[key,{value:input.value===''?null:Number(input.value),note:note.value}]));
      await mutate('/api/projects/'+project.id+'/assessment',values);
    } catch(error){status.textContent=error.message;button.disabled=false;}
  };
  details.append(form);
  return details;
}
