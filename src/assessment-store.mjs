import { ResearchStore } from './research-store.mjs';
import { validateAssessment, summarizeAssessment } from './assessment.mjs';

export class AssessmentStore extends ResearchStore {
  constructor(path) {
    super(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assessment_revisions(
        id INTEGER PRIMARY KEY, projectId TEXT NOT NULL REFERENCES projects(id),
        scanId INTEGER REFERENCES scans(id), data TEXT NOT NULL,
        stale INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS assessment_project ON assessment_revisions(projectId,id);
    `);
  }
  latestAssessment(id) {
    const row = this.db.prepare('SELECT * FROM assessment_revisions WHERE projectId=? ORDER BY id DESC LIMIT 1').get(id);
    return row ? { ...row, data: JSON.parse(row.data) } : null;
  }
  latestEvidence(id) {
    return this.db.prepare('SELECT id,hash,sourceId,attemptedAt FROM scans WHERE projectId=? AND error IS NULL ORDER BY id DESC LIMIT 1').get(id) || null;
  }
  list() {
    return super.list().map(project => {
      const assessment = this.latestAssessment(project.id);
      return { ...project, assessment, analysis: summarizeAssessment(assessment, project.verified), latestEvidence: this.latestEvidence(project.id) };
    });
  }
  saveAssessment(projectId, input) {
    const data = validateAssessment(input);
    return this.transaction(() => {
      const project = this.project(projectId);
      if (!project.verified) throw new Error('Спочатку перевірте джерело проєкту');
      if (data.evidenceUrl !== project.source) throw new Error('Доказ оцінки має посилатися на джерело цього проєкту');
      const latest = this.latestEvidence(projectId);
      if (latest) {
        const cited = data.scanId === null ? null : this.db.prepare('SELECT id,projectId,hash FROM scans WHERE id=? AND error IS NULL').get(data.scanId);
        const changedSince = cited && this.db.prepare('SELECT id FROM scans WHERE projectId=? AND id>? AND error IS NULL AND hash<>? LIMIT 1').get(projectId,cited.id,cited.hash);
        if (!cited || changedSince || cited.projectId !== projectId || cited.hash !== latest.hash) throw new Error('Знімок застарів або належить іншому проєкту. Оновіть сторінку.');
      } else if (data.scanId !== null) throw new Error('У проєкту немає такого знімка');
      const createdAt = new Date().toISOString();
      const result = this.db.prepare('INSERT INTO assessment_revisions(projectId,scanId,data,createdAt) VALUES(?,?,?,?)').run(projectId,data.scanId,JSON.stringify(data),createdAt);
      this.event(projectId, 'Збережено ручну оцінку умов кампанії. Ревізія ' + result.lastInsertRowid);
      return { id: Number(result.lastInsertRowid) };
    });
  }
  sourceChanged(projectId) {
    this.db.prepare('UPDATE assessment_revisions SET stale=1 WHERE projectId=?').run(projectId);
  }
  assessmentHistory(projectId) {
    this.project(projectId);
    return this.db.prepare('SELECT * FROM assessment_revisions WHERE projectId=? ORDER BY id DESC LIMIT 20').all(projectId).map(row => ({...row,data:JSON.parse(row.data)}));
  }
}
