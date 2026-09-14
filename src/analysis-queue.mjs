export class AnalysisQueue {
 constructor(store,agents){this.store=store;this.agents=agents;this.running=false;this.stopped=false;
 store.db.exec("CREATE TABLE IF NOT EXISTS analysis_jobs(id INTEGER PRIMARY KEY,projectId TEXT NOT NULL REFERENCES projects(id),materialHash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,error TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL, UNIQUE(projectId,materialHash))");
 }
 enqueue(projectId,hash){this.store.project(projectId);if(!hash)throw Error('Немає версії матеріалу');const now=new Date().toISOString();this.store.db.prepare("INSERT OR IGNORE INTO analysis_jobs(projectId,materialHash,createdAt,updatedAt) VALUES(?,?,?,?)").run(projectId,hash,now,now);return this.latest(projectId);}
 summary(){const counts={pending:0,running:0,succeeded:0,failed:0};for(const row of this.store.db.prepare('SELECT status,COUNT(*) n FROM analysis_jobs GROUP BY status').all())counts[row.status]=row.n;return {...counts,revision:this.store.db.prepare("SELECT MAX(updatedAt) revision FROM analysis_jobs WHERE status IN ('succeeded','failed')").get().revision};}
 latest(id){return this.store.db.prepare('SELECT * FROM analysis_jobs WHERE projectId=? ORDER BY id DESC LIMIT 1').get(id)||null;}
 retry(id){this.store.project(id);this.store.db.prepare("UPDATE analysis_jobs SET status='pending',error=NULL,updatedAt=? WHERE id=(SELECT MAX(id) FROM analysis_jobs WHERE projectId=?) AND status='failed'").run(new Date().toISOString(),id);}
 start(){this.stopped=false;this.store.db.prepare("UPDATE analysis_jobs SET status='pending' WHERE status='running'").run();this.timer=setInterval(()=>this.tick().catch(()=>{}),5000);this.timer.unref();this.tick().catch(()=>{});}
 stop(){this.stopped=true;clearInterval(this.timer);}
 async tick(){if(this.stopped||this.running||this.agents.busy)return;const job=this.store.db.prepare("SELECT * FROM analysis_jobs WHERE status='pending' ORDER BY id LIMIT 1").get();if(!job)return;
 this.running=true;const update=(status,error=null)=>this.store.db.prepare('UPDATE analysis_jobs SET status=?,error=?,updatedAt=? WHERE id=?').run(status,error,new Date().toISOString(),job.id);
 try{
 const current=this.agents.materialVersion?this.agents.materialVersion(job.projectId,job.materialHash):this.agents.materials.latest(job.projectId)?.hash;if(current!==job.materialHash){update('superseded');return;}
 update('running');this.store.db.prepare('UPDATE analysis_jobs SET attempts=attempts+1 WHERE id=?').run(job.id);
 await this.agents.analyze(job.projectId,job.materialHash);
 if(!this.stopped){update('succeeded');this.store.event(job.projectId,'Агент завершив аналіз отриманого матеріалу.');}
 }catch(e){if(!this.stopped)update(e.code==='MATERIAL_CHANGED'?'superseded':'failed',e.message.slice(0,1000));}
 finally{this.running=false;}
 }
}
