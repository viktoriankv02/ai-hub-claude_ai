export function outcomePanel(project,{node,mutate}) {
  const details=node('details',undefined,'assessment');details.append(node('summary','Фактичні винагороди та витрати'));
  const totals=project.outcomeSummary;
  if(totals)details.append(node('p','Відомі оцінки: винагороди '+totals.rewardUsd+' USD · витрати '+totals.expenseUsd+' USD · різниця '+(totals.netUsd??'невідома')+(totals.netUsd===null?'':' USD'),'score'),node('p','Записів без оцінки USD: '+totals.unknownValuations+'. Це ваші записи, без перевірки транзакцій і поточних ринкових цін.','muted'));
  if(project.assessment)details.append(node('p','Початкова оцінка витрат: '+(project.assessment.data.estimatedCostUsd ?? 'невідомо')+' USD · відомі записані витрати: '+(totals?.expenseUsd ?? '0.00')+' USD. Записи можуть бути неповними; актуальність оцінки: '+(project.analysis?.state==='current'?'актуальна':'потребує перегляду')+'.','muted'));
  const form=node('form',undefined,'form-grid');
  const field=(label,input)=>{input.setAttribute('aria-label',label);const wrap=node('label');wrap.append(node('span',label),input);form.append(wrap);return input;};
  const kind=node('select');kind.name='kind';for(const [value,label]of [['reward','Винагорода'],['expense','Витрата']]){const option=node('option',label);option.value=value;kind.append(option);}field('Тип результату',kind);
  for(const [name,label,placeholder,max]of [['asset','Актив','ETH, USDC…',20],['quantity','Кількість активу','0.001',60],['amountUsd','Оцінка на момент запису, USD','Порожньо = невідомо',12]]){const input=node('input');input.name=name;input.placeholder=placeholder;input.maxLength=max;input.required=name!=='amountUsd';if(name!=='asset')input.inputMode='decimal';field(label,input);}
  const date=node('input');date.type='datetime-local';date.name='occurredAt';date.required=true;const now=new Date();date.value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);field('Коли отримано / витрачено',date);
  const evidence=node('textarea');evidence.name='evidence';evidence.required=true;evidence.maxLength=2000;field('Доказ результату: tx hash, посилання або опис',evidence);
  const button=node('button','Записати результат');button.type='submit';const status=node('p','');status.setAttribute('role','status');form.append(status,button);
  const requestId=crypto.randomUUID();
  form.onsubmit=async e=>{e.preventDefault();button.disabled=true;try{const data=Object.fromEntries(new FormData(form));data.occurredAt=new Date(data.occurredAt).toISOString();data.requestId=requestId;await mutate('/api/projects/'+project.id+'/outcomes',data);}catch(error){status.textContent=error.message;button.disabled=false;}};
  details.append(form);
  for(const record of project.outcomes||[]) {
    const row=node('div',undefined,'task');row.append(node('strong',(record.kind==='reward'?'＋ ':'− ')+record.quantity+' '+record.asset),node('small',new Date(record.occurredAt).toLocaleString('uk-UA')+' · '+record.evidence));
    if(record.voidedAt)row.append(node('small','Скасовано: '+record.voidReason));
    else {const cancel=node('button','Скасувати помилковий запис','secondary');cancel.type='button';cancel.onclick=async()=>{const reason=prompt('Причина скасування запису (історія збережеться):');if(!reason)return;cancel.disabled=true;try{await mutate('/api/outcomes/'+record.id+'/void',{reason});}catch(e){status.textContent=e.message;cancel.disabled=false;}};row.append(cancel);}
    details.append(row);
  }
  return details;
}
