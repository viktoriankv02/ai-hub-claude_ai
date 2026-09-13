import { timestamp } from './time.mjs';
import { AssessmentStore } from './assessment-store.mjs';
import { requiredText } from './domain.mjs';

export const parseDueAt = timestamp;
export class TaskStore extends AssessmentStore {
  constructor(path, clock = () => new Date()) {
    super(path); this.clock = clock;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_schedules(taskId TEXT PRIMARY KEY REFERENCES tasks(id), dueAt TEXT, recurrence TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS task_completions(id INTEGER PRIMARY KEY,taskId TEXT NOT NULL REFERENCES tasks(id),scheduledFor TEXT NOT NULL,evidence TEXT NOT NULL,completedAt TEXT NOT NULL,UNIQUE(taskId,scheduledFor));
    `);
  }
  schedule(taskId) { return this.db.prepare('SELECT * FROM task_schedules WHERE taskId=?').get(taskId) || null; }
  task(taskId) { const row=this.db.prepare('SELECT * FROM tasks WHERE id=?').get(taskId); if (!row) throw new Error('Завдання не знайдено'); return row; }
  scheduleTask(taskId, input) {
    const dueAt = parseDueAt(input.dueAt);
    if (!['once','daily','weekly'].includes(input.recurrence)) throw new Error('Некоректна повторюваність');
    if (input.recurrence !== 'once' && !dueAt) throw new Error('Для повторюваного завдання потрібен час першого виконання');
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new Error('Оновіть сторінку: невідома версія розкладу');
    return this.transaction(() => {
      const task=this.task(taskId);const existing=this.schedule(taskId);
      if ((existing?.revision ?? 0) !== input.expectedRevision) throw new Error('Розклад уже змінено. Оновіть сторінку.');
      if (task.status === 'completed') throw new Error('Виконане завдання не можна перепланувати; створіть нове.');
      this.db.prepare('INSERT INTO task_schedules(taskId,dueAt,recurrence) VALUES(?,?,?) ON CONFLICT(taskId) DO UPDATE SET dueAt=excluded.dueAt,recurrence=excluded.recurrence,revision=task_schedules.revision+1').run(taskId,dueAt,input.recurrence);
      this.event(task.projectId,'Оновлено розклад завдання: '+task.title);
      return this.schedule(taskId);
    });
  }
  list() {
    const now=this.clock().getTime();
    return super.list().map(project => ({...project,tasks:project.tasks.map(task=>{
      const schedule=this.schedule(task.id);
      const dueState=task.status==='completed'?'completed':!schedule?.dueAt?'unscheduled':Date.parse(schedule.dueAt)<=now?'due':Date.parse(schedule.dueAt)-now<=86400000?'soon':'upcoming';
      return {...task,schedule,dueState,completions:this.db.prepare('SELECT scheduledFor,evidence,completedAt FROM task_completions WHERE taskId=? ORDER BY id DESC LIMIT 5').all(task.id)};
    })}));
  }
  complete(taskId,input) {
    const schedule=this.schedule(taskId);
    if (!schedule || schedule.recurrence==='once') {
      if (input.scheduleRevision !== undefined && (input.scheduleRevision !== schedule?.revision || input.scheduledFor !== schedule?.dueAt)) throw new Error('Розклад уже змінився. Оновіть сторінку.');
      return super.complete(taskId,input);
    }
    const evidence=requiredText(input.evidence,'Доказ виконання',2000);
    return this.transaction(()=>{
      const task=this.task(taskId);
      if (!this.project(task.projectId).verified) throw new Error('Спочатку перевірте джерело проєкту');
      if (typeof input.scheduledFor !== 'string' || !Number.isSafeInteger(input.scheduleRevision)) throw new Error('Оновіть сторінку перед записом повторюваного виконання');
      if (this.db.prepare('SELECT id FROM task_completions WHERE taskId=? AND scheduledFor=?').get(taskId,input.scheduledFor)) return {ok:true,duplicate:true};
      if (input.scheduledFor!==schedule.dueAt || input.scheduleRevision!==schedule.revision) throw new Error('Розклад уже змінився. Оновіть сторінку.');
      const now=this.clock();const due=Date.parse(schedule.dueAt);
      if (due>now.getTime()) throw new Error('Час наступного повторення ще не настав');
      const interval=schedule.recurrence==='daily'?86400000:7*86400000;
      const nextDueAt=new Date(due+(Math.floor((now.getTime()-due)/interval)+1)*interval).toISOString();
      this.db.prepare('INSERT INTO task_completions(taskId,scheduledFor,evidence,completedAt) VALUES(?,?,?,?)').run(taskId,schedule.dueAt,evidence,now.toISOString());
      this.db.prepare('UPDATE task_schedules SET dueAt=?,revision=revision+1 WHERE taskId=?').run(nextDueAt,taskId);
      this.event(task.projectId,'Записано повторюване виконання користувачем: '+task.title+'. Доказ: '+evidence);
      return {ok:true,nextDueAt};
    });
  }
}
