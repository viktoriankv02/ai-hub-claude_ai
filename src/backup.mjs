import {backup,DatabaseSync} from 'node:sqlite';
import {mkdtemp,unlink,rmdir,open,mkdir,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
const requiredTables=['projects','tasks','events','scans','source_projects','settings','assessment_revisions','task_schedules','task_completions','research_plan_tasks','outcomes'];

export async function createBackup(db) {
  const dir=await mkdtemp(join(tmpdir(),'drop-hunter-backup-'));
  const path=join(dir,'snapshot.sqlite');
  const dispose=async()=>{for(const suffix of ['-wal','-shm','-journal',''])await unlink(path+suffix).catch(e=>{if(e.code!=='ENOENT')throw e;});await rmdir(dir);};
  try {
    await backup(db,path);
    const portable=new DatabaseSync(path);
    try{portable.exec('PRAGMA journal_mode=DELETE');}finally{portable.close();}
    return {path,filename:'drop-hunter-'+new Date().toISOString().replaceAll(':','-')+'.sqlite',dispose};
  }catch(error){await dispose();throw error;}
}
export function inspectBackup(path) {
  const db=new DatabaseSync(resolve(path),{readOnly:true});
  try {
    const integrity=db.prepare('PRAGMA integrity_check').all();
    if(integrity.length!==1||integrity[0].integrity_check!=='ok')throw new Error('Порушена цілісність SQLite-копії');
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Порушено зв’язки даних у SQLite-копії');
    const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
    if(requiredTables.some(name=>!tables.has(name)))throw new Error('Це не повна копія актуальної бази Drop Hunter');
    return {projects:db.prepare('SELECT count(*) AS n FROM projects').get().n,tasks:db.prepare('SELECT count(*) AS n FROM tasks').get().n,outcomes:db.prepare('SELECT count(*) AS n FROM outcomes').get().n};
  }finally{db.close();}
}
export async function restoreBackup(source,destination) {
  const info=inspectBackup(source);
  const target=resolve(destination);
  await mkdir(dirname(target),{recursive:true});
  // Exclusive creation refuses existing databases, including the live database.
  for(const suffix of ['-wal','-shm','-journal']){const existing=await lstat(target+suffix).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(existing)throw new Error('Для цього імені існують службові SQLite-файли. Оберіть інше ім’я.');}
  const reservation=await open(target,'wx');await reservation.close();
  let db;
  try {
    db=new DatabaseSync(resolve(source),{readOnly:true});
    await backup(db,target);
    inspectBackup(target);
    return {path:target,...info};
  }catch(error){await unlink(target);throw error;}
  finally{db?.close();}
}
