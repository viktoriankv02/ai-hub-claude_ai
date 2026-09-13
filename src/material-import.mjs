import {randomUUID,createHash} from 'node:crypto';
import {requiredText,httpsUrl} from './domain.mjs';
export class MaterialImport {
 constructor(store){this.store=store;store.db.exec('CREATE TABLE IF NOT EXISTS imported_materials(id INTEGER PRIMARY KEY,projectId TEXT NOT NULL REFERENCES projects(id),url TEXT NOT NULL,content TEXT NOT NULL,hash TEXT NOT NULL,createdAt TEXT NOT NULL)');}
 latest(id){return this.store.db.prepare('SELECT * FROM imported_materials WHERE projectId=? ORDER BY id DESC LIMIT 1').get(id)||null;}
 save(input){
  const name=requiredText(input.name,'Назва',120),url=httpsUrl(input.source),content=requiredText(input.text,'Текст',16000);
  const parsed=new URL(url);if(parsed.hostname!=='cryptorank.io')throw Error('Потрібне посилання cryptorank.io');
  parsed.hash='';const source=parsed.href,hash=createHash('sha256').update(content).digest('hex');
  return this.store.transaction(()=>{
   let p=this.store.db.prepare('SELECT id FROM projects WHERE source=?').get(source);
   if(!p){p={id:randomUUID()};this.store.db.prepare('INSERT INTO projects(id,name,network,source,notes,createdAt) VALUES(?,?,?,?,?,?)').run(p.id,name,'unknown',source,'Матеріал імпортовано користувачем з CryptoRank. Офіційні умови потребують перевірки.',new Date().toISOString());}
   const previous=this.latest(p.id);if(previous?.hash===hash)return {id:p.id,changed:false};
   this.store.db.prepare('INSERT INTO imported_materials(projectId,url,content,hash,createdAt) VALUES(?,?,?,?,?)').run(p.id,source,content,hash,new Date().toISOString());
   this.store.db.prepare('UPDATE projects SET verified=0 WHERE id=?').run(p.id);
   this.store.sourceChanged?.(p.id);
   this.store.event(p.id,'Імпортовано нову версію матеріалу CryptoRank. Перевірте зміни умов.');
   return {id:p.id,changed:true};
  });
 }
}
