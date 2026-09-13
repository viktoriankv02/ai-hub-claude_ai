import { TaskStore } from './task-store.mjs';
import { draftResearch } from './research-plan.mjs';

export class PlanStore extends TaskStore {
  constructor(path,clock) {
    super(path,clock);
    this.db.exec('CREATE TABLE IF NOT EXISTS research_plan_tasks(taskId TEXT PRIMARY KEY REFERENCES tasks(id),projectId TEXT NOT NULL REFERENCES projects(id),scanId INTEGER NOT NULL REFERENCES scans(id),evidence TEXT NOT NULL);');
  }
  snapshot(projectId,scanId) {
    this.project(projectId);
    if(!Number.isSafeInteger(scanId))throw new Error('Невідомий знімок');
    const scan=this.db.prepare('SELECT * FROM scans WHERE id=? AND projectId=? AND error IS NULL').get(scanId,projectId);
    if(!scan)throw new Error('Знімок не знайдено');
    return scan;
  }
  researchDraft(projectId) {
    const latest=this.latestEvidence(projectId);
    if(!latest)throw new Error('Спочатку отримайте офіційні матеріали');
    const draft=draftResearch(this.snapshot(projectId,latest.id));
    return {...draft,items:draft.items.map(item=>({...item,added:!!this.db.prepare('SELECT taskId FROM research_plan_tasks WHERE taskId=?').get(item.id)}))};
  }
  adoptResearch(projectId,input) {
    if(!Array.isArray(input.itemIds)||input.itemIds.length<1||input.itemIds.length>5||input.itemIds.some(id=>typeof id!=='string'))throw new Error('Оберіть від 1 до 5 пунктів');
    return this.transaction(()=>{
      if(!this.project(projectId).verified)throw new Error('Спочатку перевірте джерело проєкту');
      const cited=this.snapshot(projectId,input.scanId);
      const latest=this.latestEvidence(projectId);
      const changed=this.db.prepare('SELECT id FROM scans WHERE projectId=? AND id>? AND error IS NULL AND hash<>? LIMIT 1').get(projectId,cited.id,cited.hash);
      if(changed||cited.hash!==latest.hash)throw new Error('Джерело змінилося. Сформуйте план повторно.');
      const draft=draftResearch(cited);
      const selected=[...new Set(input.itemIds)].map(id=>draft.items.find(item=>item.id===id));
      if(selected.some(item=>!item))throw new Error('Невідомий пункт плану');
      let added=0;
      for(const item of selected) {
        if(this.db.prepare('SELECT taskId FROM research_plan_tasks WHERE taskId=?').get(item.id))continue;
        this.db.prepare('INSERT INTO tasks(id,projectId,title,kind) VALUES(?,?,?,?)').run(item.id,projectId,item.title,'research');
        this.db.prepare('INSERT INTO research_plan_tasks(taskId,projectId,scanId,evidence) VALUES(?,?,?,?)').run(item.id,projectId,cited.id,JSON.stringify(item.evidence));
        added++;
      }
      if(added)this.event(projectId,'Додано пунктів дослідницького плану з доказами: '+added);
      return {added};
    });
  }
}
