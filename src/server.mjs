import {reviewStatus} from './review-status.mjs';
import { AnalysisQueue } from './analysis-queue.mjs';
import { MaterialImport } from './material-import.mjs';
import { readIncryptedGuide } from './incrypted-guide.mjs';
import { DailyResearch } from './daily-research.mjs';
import { LocalAgents } from './local-agents.mjs';
import { TrackerSearch } from './tracker-search.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createBackup } from './backup.mjs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { PlanStore as Store } from './plan-store.mjs';
import { sources, DiscoveryService } from './discovery.mjs';
import { Monitor } from './monitor.mjs';
import { networks } from './networks.mjs';
import { buildAgenda } from './agenda.mjs';
import { OutcomeLedger } from './outcomes.mjs';

export function createApp(store, options = {}) {
  const discovery = options.discovery || new DiscoveryService(store);
  const monitor = new Monitor(store, discovery);
  if (options.monitor) monitor.start();
  const outcomes=new OutcomeLedger(store);
  const materials=new MaterialImport(store);
  const agents=new LocalAgents(store,options.agentFetcher);
  const analysisQueue=new AnalysisQueue(store,agents);
  if(options.monitor)analysisQueue.start();
  const daily=new DailyResearch(store,agents,options.trackerFetcher);
  if(options.monitor)daily.start();
  const tracker=new TrackerSearch(store,options.trackerFetcher);
  let backupInFlight=false;
  const token = randomBytes(32).toString('hex');
  const app = createServer(async (req, res) => {
    const reply = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const host = `127.0.0.1:${req.socket.localPort}`;
    if (req.headers.host !== host) return reply(403, { error: 'Invalid host' });
    if (req.headers.origin && req.headers.origin !== `http://${host}`) return reply(403, { error: 'Invalid origin' });
    try {
      const path = new URL(req.url, `http://${host}`).pathname;
      if (req.method === 'GET' && (path === '/api/state' || path === '/api/agenda')) {
        const projects=store.list().map(p=>({...p,analysisJob:analysisQueue.latest(p.id),importedMaterial:materials.latest(p.id),guide:store.setting?.('guide:'+p.id,null),daily:store.setting?.('daily:'+p.id,null),agentFeedback:store.setting?.('agentFeedback:'+p.id,null),agentReview:store.setting?.('agentReview:'+p.id,null),outcomes:outcomes.list(p.id),outcomeSummary:outcomes.summary(p.id)}));for(const p of projects)p.reviewStatus=reviewStatus(p.agentReview,p);const agenda=buildAgenda(projects,store.clock ? store.clock().getTime() : Date.now());
        if(path==='/api/agenda')return reply(200,agenda);
        return reply(200,{token,networks,projects,agenda,dailyRunning:daily.running,tracker:store.setting?.('trackerResult',null),events:store.history(),sources:sources.map(s=>({...s,lastScan:store.latestScan?.(s.id)||null})),monitor:store.setting?monitor.state():null});
      }
      if(req.method==='GET' && path==='/api/agents/progress')return reply(200,{...daily.progress,running:daily.running,queue:analysisQueue.summary()});
      if(req.method==='GET' && path==='/api/agents')return reply(200,{status:await agents.status(),messages:agents.history()});
      const draftMatch=path.match(/^\/api\/projects\/([\w-]+)\/research-draft$/);
      if(req.method==='GET' && draftMatch)return reply(200,store.researchDraft(draftMatch[1]));
      if (req.method === 'POST') {
        if (req.headers['x-session-token'] !== token) return reply(403, { error: 'Оновіть сторінку для продовження' });
        if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'Expected JSON' });
        const chunks = []; let bytes = 0; for await (const chunk of req) { bytes += chunk.length; if (bytes > 65536) return reply(413, { error: 'Запит завеликий' }); chunks.push(chunk); }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Некоректний запит');
        if (path === '/api/backup') {
          if(backupInFlight)return reply(409,{error:'Копія вже створюється. Спробуйте після завершення.'});
          backupInFlight=true;let snapshot;
          try {
            snapshot=await createBackup(store.db);
            if(res.destroyed)return;
            res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Disposition':'attachment; filename="'+snapshot.filename+'"'});
            await pipeline(createReadStream(snapshot.path),res);
          } finally {try{await snapshot?.dispose();}finally{backupInFlight=false;}}
          return;
        }
        const workflowMatch=path.match(/^\/api\/projects\/([\w-]+)\/workflow$/);
        if(workflowMatch)return reply(200,store.setWorkflow(workflowMatch[1],body));
        if(path==='/api/agents/guide'){const p=store.project(body.projectId);const guide=await readIncryptedGuide(p.source);store.setSetting('guide:'+p.id,guide);analysisQueue.enqueue(p.id,'guide:'+guide.hash);return reply(200,{ok:true,queued:true});}
        if(path==='/api/agents/feedback')return reply(200,agents.feedback(body));
        if(path==='/api/agents/analyze')return reply(200,await agents.analyze(body.projectId));
        if(path==='/api/materials/import'){const result=materials.save(body);const latest=materials.latest(result.id);analysisQueue.enqueue(result.id,latest.hash);return reply(200,{...result,queued:true});}
        if(path==='/api/agents/retry'){analysisQueue.retry(body.projectId);return reply(200,{ok:true});}
        if(path==='/api/agents/run'){if(daily.running||agents.busy)return reply(409,{error:'Агенти вже працюють'});daily.tick(true).catch(()=>{});return reply(202,{started:true});}
        if(path==='/api/agents/chat')return reply(200,await agents.ask(body));
        if (path === '/api/projects') return reply(201, store.create(body));
        const outcomeMatch=path.match(/^\/api\/projects\/([\w-]+)\/outcomes$/);
        if(outcomeMatch)return reply(201,outcomes.record(outcomeMatch[1],body));
        const voidMatch=path.match(/^\/api\/outcomes\/([\w-]+)\/void$/);
        if(voidMatch)return reply(200,outcomes.void(voidMatch[1],body));
        const planMatch=path.match(/^\/api\/projects\/([\w-]+)\/research-plan$/);
        if(planMatch)return reply(200,store.adoptResearch(planMatch[1],body));
        const assessmentMatch = path.match(/^\/api\/projects\/([\w-]+)\/assessment$/);
        if (assessmentMatch) return reply(201,store.saveAssessment(assessmentMatch[1],body));
        if (path === '/api/discovery/projects') return reply(200,await tracker.scan(body.sourceId));
        if (path === '/api/discovery/scan') return reply(200, await discovery.scan(body.sourceId));
        if (path === '/api/monitor') { if (typeof body.enabled !== 'boolean') throw new Error('Потрібне enabled: boolean'); store.setSetting('monitorEnabled', body.enabled); return reply(200, monitor.state()); }
        const match = path.match(/^\/api\/projects\/([\w-]+)\/(verify|tasks)$/);
        if (match) return reply(200, match[2] === 'verify' ? store.verify(match[1], body) : store.addTask(match[1], body));
        const scheduleMatch=path.match(/^\/api\/tasks\/([\w-]+)\/schedule$/);
        if(scheduleMatch) return reply(200,store.scheduleTask(scheduleMatch[1],body));
        const task = path.match(/^\/api\/tasks\/([\w-]+)\/complete$/);
        if (task) return reply(200, store.complete(task[1], body));
      }
      const files = { '/guide-reader.js':['guide-reader.js','text/javascript'], '/agent-progress.js':['agent-progress.js','text/javascript'], '/material-import.js':['material-import.js','text/javascript'], '/local-chat.js':['local-chat.js','text/javascript'], '/robot.js':['robot.js','text/javascript'], '/backup.js': ['backup.js','text/javascript'], '/outcomes.js': ['outcomes.js','text/javascript'], '/agenda.js': ['agenda.js','text/javascript'], '/research.js': ['research.js','text/javascript'], '/schedule.js': ['schedule.js','text/javascript'], '/assessment.js': ['assessment.js', 'text/javascript'], '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
      if (req.method === 'GET' && Object.hasOwn(files, path)) {
        const [file, type] = files[path]; const data = await readFile(new URL(`../public/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); return res.end(data);
      }
      reply(404, { error: 'Не знайдено' });
    } catch (error) { if(res.headersSent || res.destroyed){res.destroy();return;}reply(400, { error: error.message }); }
  });
  app.on('close', () => {monitor.stop();daily.stop();analysisQueue.stop();});
  return app;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const store = new Store(process.env.DROP_HUNTER_DB_PATH ? resolve(process.env.DROP_HUNTER_DB_PATH) : fileURLToPath(new URL('../data/drop-hunter.sqlite', import.meta.url)));
  const app = createApp(store, { monitor: true });
  app.listen(Number(process.env.PORT || 4317), '127.0.0.1', () => console.log(`Drop Hunter: http://127.0.0.1:${app.address().port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.close(() => { store.close(); process.exit(0); }));
}
