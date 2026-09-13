import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { evaluate, validateProject, requiredText, taskKinds, taskPolicy } from './domain.mjs';

export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, name TEXT NOT NULL, network TEXT NOT NULL, source TEXT NOT NULL, notes TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', evidence TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, projectId TEXT NOT NULL, message TEXT NOT NULL, createdAt TEXT NOT NULL);`);
    if (!this.db.prepare('PRAGMA table_info(projects)').all().some(c=>c.name==='workflow')) this.db.exec("ALTER TABLE projects ADD COLUMN workflow TEXT NOT NULL DEFAULT 'new'");
  }
  setWorkflow(id,input) {
    if (!['new','watching','active','paused','dismissed'].includes(input.workflow)) throw new Error('Невідомий статус проєкту');
    return this.transaction(()=>{this.project(id);this.db.prepare('UPDATE projects SET workflow=? WHERE id=?').run(input.workflow,id);this.event(id,'Статус дослідження: '+input.workflow);return {ok:true};});
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  event(id, message) { this.db.prepare('INSERT INTO events(projectId,message,createdAt) VALUES(?,?,?)').run(id, message, new Date().toISOString()); }
  project(id) { const p = this.db.prepare('SELECT * FROM projects WHERE id=?').get(id); if (!p) throw new Error('Проєкт не знайдено'); return p; }
  list() {
    return this.db.prepare("SELECT * FROM projects ORDER BY createdAt DESC, id").all().map(p => ({ ...p, ...evaluate(p), tasks: this.db.prepare('SELECT * FROM tasks WHERE projectId=?').all(p.id).map(t => ({ ...t, policy: taskPolicy(t.kind, p.verified) })) }));
  }
  create(input) {
    const p = validateProject(input); const id = randomUUID();
    return this.transaction(() => {
      this.db.prepare('INSERT INTO projects(id,name,network,source,notes,createdAt) VALUES(?,?,?,?,?,?)').run(id, p.name, p.network, p.source, p.notes, new Date().toISOString());
      this.event(id, `Додано проєкт: ${p.name}`); return { id };
    });
  }
  verify(id, input) {
    const evidence = requiredText(input.evidence, 'Обґрунтування перевірки', 2000);
    return this.transaction(() => { this.project(id); this.db.prepare('UPDATE projects SET verified=1 WHERE id=?').run(id); this.event(id, `Користувач підтвердив джерело: ${evidence}`); return { ok: true }; });
  }
  addTask(id, input) {
    const title = requiredText(input.title, 'Завдання', 300);
    if (!taskKinds.includes(input.kind)) throw new Error('Невідомий тип завдання');
    return this.transaction(() => { this.project(id); const taskId = randomUUID(); this.db.prepare('INSERT INTO tasks(id,projectId,title,kind) VALUES(?,?,?,?)').run(taskId, id, title, input.kind); this.event(id, `Додано завдання: ${title}`); return { id: taskId }; });
  }
  complete(id, input) {
    const evidence = requiredText(input.evidence, 'Доказ виконання', 2000);
    return this.transaction(() => {
      const task = this.db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
      if (!task) throw new Error('Завдання не знайдено');
      const p = this.project(task.projectId);
      if (!p.verified) throw new Error('Спочатку перевірте джерело проєкту');
      if (task.status === 'completed') return { ok: true };
      this.db.prepare("UPDATE tasks SET status='completed', evidence=? WHERE id=?").run(evidence, id);
      this.event(p.id, `Користувач повідомив про виконання: ${task.title}. Доказ: ${evidence}`);
      return { ok: true };
    });
  }
  history() { return this.db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 100').all(); }
  close() { this.db.close(); }
}
