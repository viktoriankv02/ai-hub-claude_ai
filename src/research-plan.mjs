import { createHash } from 'node:crypto';

const rules=[
  {key:'eligibility',label:'Умови участі',pattern:/\b(eligible|eligibility|requirements?|must|qualify|criteria|teams|traction)\b/i,title:'Звірити умови участі зі своїм проєктом'},
  {key:'rewards',label:'Винагороди та розподіл',pattern:/\b(grants?|rewards?|airdrops?|incentives?|funding|points)\b/i,title:'Перевірити умови винагороди та спосіб відбору'},
  {key:'timing',label:'Дати та строки',pattern:/\b(deadline|before|after|rolling|ends?|until|snapshot|weekly|daily)\b/i,title:'Уточнити дедлайн, часовий пояс та період участі'},
  {key:'costs',label:'Витрати',pattern:/\b(fees?|gas|costs?|deposit|bridge|stake|liquidity)\b/i,title:'Оцінити витрати, газ і потрібні кошти'},
  {key:'builder',label:'Робота розробника',pattern:/\b(deploy|contracts?|builders?|integrations?|open.source|products?)\b/i,title:'Перевірити вимоги до продукту або внеску розробника'},
];
export function draftResearch(snapshot) {
  const text=snapshot.content;
  const fragments=[...text.matchAll(/[^.!?\n]+[.!?]?/g)];
  const items=[];
  for(const rule of rules) {
    const matches=fragments.filter(m=>rule.pattern.test(m[0])).slice(0,3);
    if(!matches.length)continue;
    const evidence=matches.map(match=>{
      const local=match[0].search(rule.pattern);
      const start=match.index+Math.max(0,local-80);
      const end=Math.min(match.index+match[0].length,start+450);
      return {start,end,text:text.slice(start,end)};
    });
    const id=createHash('sha256').update(snapshot.projectId+'|'+snapshot.hash+'|'+rule.key).digest('hex').slice(0,32);
    items.push({id,key:rule.key,label:rule.label,title:rule.title,evidence});
  }
  return {scanId:snapshot.id,hash:snapshot.hash,fetchedAt:snapshot.attemptedAt,method:'keyword-rules-v1',items,
    notice:'Знайдені згадки — підказки для дослідження. Контекст, актуальність і застосовність потрібно перевірити. Це не LLM-аналіз і не підтвердження винагороди.'};
}
