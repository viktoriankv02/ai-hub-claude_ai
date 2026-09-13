import {requiredText} from './domain.mjs';
import {timestamp} from './time.mjs';
export function cents(value) {
  if(value===null||value==='')return null;
  if(typeof value!=='string'||!/^\d{1,9}(?:\.\d{1,2})?$/.test(value))throw new Error('Оцінка USD: число до 2 знаків після крапки або порожнє поле');
  const [whole,fraction='']=value.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
export class OutcomeLedger {
  constructor(store) {
    this.store=store;this.db=store.db;
    this.db.exec('CREATE TABLE IF NOT EXISTS outcomes(id TEXT PRIMARY KEY,projectId TEXT NOT NULL REFERENCES projects(id),data TEXT NOT NULL,createdAt TEXT NOT NULL,voidReason TEXT,voidedAt TEXT);');
  }
  record(projectId,input) {
    if(typeof input.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(input.requestId))throw new Error('Некоректний ідентифікатор запису');
    if(!['reward','expense'].includes(input.kind))throw new Error('Оберіть винагороду або витрату');
    const occurredAt=timestamp(input.occurredAt);if(!occurredAt||Date.parse(occurredAt)>this.store.clock().getTime()+60000)throw new Error('Фактичний результат не може мати майбутню дату');
    const asset=requiredText(input.asset,'Актив',20).toUpperCase();if(!/^[A-Z0-9._-]+$/.test(asset))throw new Error('Некоректний символ активу');
    const quantity=requiredText(input.quantity,'Кількість',60);if(!/^\d{1,30}(?:\.\d{1,18})?$/.test(quantity)||!/[1-9]/.test(quantity))throw new Error('Кількість має бути додатним десятковим числом');
    const data={kind:input.kind,asset,quantity,usdCents:cents(input.amountUsd),occurredAt,evidence:requiredText(input.evidence,'Доказ фактичного результату',2000)};
    return this.store.transaction(()=>{
      this.store.project(projectId);
      const existing=this.db.prepare('SELECT * FROM outcomes WHERE id=?').get(input.requestId);
      if(existing){if(existing.projectId!==projectId||existing.data!==JSON.stringify(data))throw new Error('Цей запит уже збережено з іншими даними');return {id:existing.id,duplicate:true};}
      this.db.prepare('INSERT INTO outcomes(id,projectId,data,createdAt) VALUES(?,?,?,?)').run(input.requestId,projectId,JSON.stringify(data),this.store.clock().toISOString());
      this.store.event(projectId,'Користувач записав '+(data.kind==='reward'?'винагороду':'витрату')+': '+quantity+' '+asset);
      return {id:input.requestId};
    });
  }
  void(id,input) {
    const reason=requiredText(input.reason,'Причина скасування',1000);
    return this.store.transaction(()=>{
      const row=this.db.prepare('SELECT * FROM outcomes WHERE id=?').get(id);if(!row)throw new Error('Запис не знайдено');
      if(row.voidedAt)return {ok:true};
      this.db.prepare('UPDATE outcomes SET voidReason=?,voidedAt=? WHERE id=?').run(reason,this.store.clock().toISOString(),id);
      this.store.event(row.projectId,'Скасовано запис результату: '+reason);return {ok:true};
    });
  }
  list(projectId) {return this.db.prepare('SELECT * FROM outcomes WHERE projectId=? ORDER BY createdAt DESC,id').all(projectId).map(row=>({...row,...JSON.parse(row.data),data:undefined}));}
  summary(projectId) {
    const records=this.list(projectId).filter(row=>!row.voidedAt);let reward=0n,expense=0n,unknown=0;
    for(const row of records){if(row.usdCents===null){unknown++;continue;}if(row.kind==='reward')reward+=BigInt(row.usdCents);else expense+=BigInt(row.usdCents);}
    const money=value=>{const sign=value<0n?'-':'';const abs=value<0n?-value:value;return sign+(abs/100n).toString()+'.'+(abs%100n).toString().padStart(2,'0');};
    return {records:records.length,rewardUsd:money(reward),expenseUsd:money(expense),unknownValuations:unknown,netUsd:records.length&&!unknown?money(reward-expense):null};
  }
}
