import { Store } from './store.mjs';
import { randomUUID } from 'node:crypto';
export class ResearchStore extends Store {
  constructor(path) {
    super(path);
    this.db.exec("CREATE TABLE IF NOT EXISTS scans(id INTEGER PRIMARY KEY, sourceId TEXT NOT NULL, projectId TEXT, hash TEXT, content TEXT, attemptedAt TEXT NOT NULL, error TEXT); CREATE TABLE IF NOT EXISTS source_projects(sourceId TEXT PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id)); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  }
  list() { return super.list().map(p => ({ ...p, evidence: this.db.prepare('SELECT sourceId,hash,attemptedAt,substr(content,1,1600) AS excerpt FROM scans WHERE projectId=? AND error IS NULL ORDER BY id DESC LIMIT 3').all(p.id) })); }
  latestScan(id) { return this.db.prepare('SELECT sourceId,attemptedAt,error,hash FROM scans WHERE sourceId=? ORDER BY id DESC LIMIT 1').get(id); }
  saveScan({ source, text, hash, fetchedAt }) {
    return this.transaction(() => {
      let projectId = this.db.prepare('SELECT projectId FROM source_projects WHERE sourceId=?').get(source.id)?.projectId;
      if (!projectId) {
        projectId = randomUUID();
        this.db.prepare('INSERT INTO projects(id,name,network,source,notes,createdAt) VALUES(?,?,?,?,?,?)').run(projectId, source.name, source.network, source.url, source.purpose, fetchedAt);
        this.db.prepare('INSERT INTO source_projects(sourceId,projectId) VALUES(?,?)').run(source.id, projectId);
        this.db.prepare('INSERT INTO tasks(id,projectId,title,kind) VALUES(?,?,?,?)').run(randomUUID(), projectId, source.purpose, 'research');
      }
      const previous = this.db.prepare('SELECT hash FROM scans WHERE sourceId=? AND error IS NULL ORDER BY id DESC LIMIT 1').get(source.id);
      const changed = previous?.hash !== hash;
      this.db.prepare('INSERT INTO scans(sourceId,projectId,hash,content,attemptedAt) VALUES(?,?,?,?,?)').run(source.id, projectId, hash, text, fetchedAt);
      if (changed) {
        this.db.prepare('UPDATE projects SET verified=0 WHERE id=?').run(projectId);
        this.sourceChanged?.(projectId);
        this.event(projectId, (previous ? 'Джерело змінилося; потрібна повторна перевірка: ' : 'Отримано офіційне джерело; перевірте умови: ') + source.name);
      }
      return { projectId, changed, fetchedAt };
    });
  }
  scanFailure(sourceId, error) { this.db.prepare('INSERT INTO scans(sourceId,attemptedAt,error) VALUES(?,?,?)').run(sourceId, new Date().toISOString(), error.slice(0,1000)); }
  setting(key, fallback) { const r = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key); return r ? JSON.parse(r.value) : fallback; }
  setSetting(key, value) { this.db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value)); }
}
