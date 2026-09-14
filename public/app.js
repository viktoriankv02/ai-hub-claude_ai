import { guideReader } from './guide-reader.js';
import { setupAgentProgress } from './agent-progress.js';
import { setupMaterialImport } from './material-import.js';
import { setupLocalChat } from './local-chat.js';
import { setupRobot } from './robot.js';
import { assessmentPanel } from './assessment.js';
import { schedulePanel } from './schedule.js';
import { researchPanel } from './research.js';
import { renderAgenda } from './agenda.js';
import { outcomePanel } from './outcomes.js';
import { setupBackup } from './backup.js';
let state;
const filterIds=['filter','workflow-filter','search','source-filter','review-filter','sort-projects'];
function clearFilters(){for(const id of filterIds)document.getElementById(id).value=id==='sort-projects'?'newest':'';saveFilters();}
function saveFilters(){try{localStorage.setItem('project-filters',JSON.stringify(Object.fromEntries(filterIds.map(id=>[id,document.getElementById(id).value]))));}catch{}}
function restoreFilters(){try{const saved=JSON.parse(localStorage.getItem('project-filters')||'{}');for(const id of filterIds){const input=document.getElementById(id);if(typeof saved[id]==='string'&&(input.tagName!=='SELECT'||[...input.options].some(o=>o.value===saved[id])))input.value=saved[id];}}catch{}}
const $ = s => document.querySelector(s);
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
function materialText(text){
 const box=node('div',undefined,'material-text');
 for(const paragraph of String(text).split(/\n\s*\n/)){const line=node('p',undefined,'ai-review');let offset=0;
 for(const match of paragraph.matchAll(/https:\/\/[^\s<>"']+/g)){const raw=match[0].replace(/[.,;!?]+$/,'');line.append(document.createTextNode(paragraph.slice(offset,match.index)));let url;try{url=new URL(raw);}catch{}
 if(url&&url.protocol==='https:'&&!url.username&&!url.password){const a=node('a',raw);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';line.append(a);}else line.append(document.createTextNode(raw));offset=match.index+raw.length;
 }line.append(document.createTextNode(paragraph.slice(offset)));box.append(line);
 }return box;
}
const labels = { research: 'Дослідження', 'check-in': 'Check-in', social: 'Соціальне завдання', faucet: 'Faucet', bridge: 'Bridge', swap: 'Swap', deploy: 'Деплой контракту', 'contract-call': 'Виклик контракту', mint: 'Mint', stake: 'Stake' };
const policies = { blocked: 'Спочатку перевірте джерело', approval: 'Операція потребує підпису в гаманці', manual: 'Виконується вручну' };
async function load() {
  const response = await fetch('/api/state'); if (!response.ok) throw new Error('Не вдалося завантажити дані');
  state = await response.json(); render();
}
async function mutate(path, data) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Token': state.token }, body: JSON.stringify(data) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error);
  await load(); $('#message').textContent = 'Збережено.';
}
function action(label, fn) {
  const b = node('button', label, 'secondary'); b.type = 'button';
  b.onclick = async () => { b.disabled = true; try { await fn(); } catch (e) { $('#message').textContent = e.message; } finally { b.disabled = false; } }; return b;
}
function render() {
  renderSources();
  const summary=$('#research-summary');summary.replaceChildren();
  for(const [title,value,filter] of [
   ['Інструкції',state.projects.filter(p=>p.guide).length,'guide'],
   ['Актуальні аналізи ШІ',state.projects.filter(p=>p.reviewStatus==='current').length,'current'],
   ['Потребують уваги',state.projects.filter(p=>p.daily?.error||p.daily?.aiError||p.analysisJob?.status==='failed').length,'error']
  ]){const block=node('div');block.append(node('strong',title),node('p',String(value)));block.append(action('Показати '+title.toLocaleLowerCase('uk-UA'),()=>{clearFilters();$('#review-filter').value=filter;saveFilters();render();$('#opportunities').scrollIntoView({block:'start'});}));summary.append(block);}

  $('#agent-work-status').textContent=state.dailyRunning?'Агенти працюють. Результати з’являться в картках; онови сторінку через кілька хвилин.':'Автоматичний цикл очікує. Для першого запуску вибери проєкти Incrypted.';
  $('#tracker-status').textContent=state.tracker ? (state.tracker.error ? 'Помилка пошуку: '+state.tracker.error : 'Останній пошук: додано '+state.tracker.added+', вже у списку '+state.tracker.duplicates)+' · '+new Date(state.tracker.fetchedAt).toLocaleString('uk-UA') : 'Пошук ще не запускався.';
  renderAgenda(state.agenda,{node,onOpen:async item=>{try{await load();clearFilters();render();const target=document.getElementById('task-'+item.taskId);if(target){target.scrollIntoView({block:'center'});target.focus({preventScroll:true});}else{$('#message').textContent='Завдання більше не доступне.';}}catch(error){$('#message').textContent=error.message;}}});
  const allTasks = state.projects.flatMap(p => p.tasks);
  $('#metrics').replaceChildren(...[[state.projects.length, 'Проєктів у дослідженні'], [state.projects.filter(p => p.verified).length, 'Джерел підтверджено'], [allTasks.filter(t => t.status !== 'completed').length, 'Завдань у плані']].map(([count, label]) => { const el = node('div', undefined, 'metric'); el.append(node('strong', count), node('span', label)); return el; }));
  const query=$('#search').value.trim().toLocaleLowerCase('uk-UA');
  const list = state.projects.filter(p => (!$('#filter').value || p.network === $('#filter').value) && (!$('#workflow-filter').value || p.workflow === $('#workflow-filter').value) && (!query || (p.name+' '+p.notes).toLocaleLowerCase('uk-UA').includes(query)));
  const source=$('#source-filter').value,review=$('#review-filter').value;
  const visible=list.filter(p=>{const host=new URL(p.source).hostname.replace(/^www\./,'');return (!source||(source==='other'?!['incrypted.com','airdrops.io','cryptorank.io','dropstab.com'].includes(host):host===source))&&(!review||(review==='current'?p.reviewStatus==='current':review==='stale'?['stale','unversioned'].includes(p.reviewStatus):review==='ready'?!!p.agentReview:review==='pending'?!p.agentReview:review==='guide'?!!p.guide:!!(p.daily?.error||p.daily?.aiError||p.analysisJob?.status==='failed')));});
  if($('#sort-projects').value==='name')visible.sort((a,b)=>a.name.localeCompare(b.name,'uk'));
  if($('#sort-projects').value==='selected')visible.sort((a,b)=>Number(['watching','active'].includes(b.workflow))-Number(['watching','active'].includes(a.workflow)));
  $('#result-count').textContent='Показано '+visible.length+' із '+state.projects.length;
  $('#projects').replaceChildren(...visible.map(projectCard));
  if (!visible.length) $('#projects').append(node('div', state.projects.length ? 'За цими фільтрами проєктів немає. Скинь фільтри або знайди нові проєкти кнопкою вище.' : 'Тут починається дослідження. Знайди нові проєкти кнопкою вище або додай власний.', 'empty'));
  $('#events').replaceChildren(...state.events.map(e => { const row = node('div', undefined, 'event'); row.append(node('time', new Date(e.createdAt).toLocaleString('uk-UA')), node('span', e.message)); return row; }));
  if (!state.events.length) $('#events').append(node('p', 'Історія з’явиться після першої дії.', 'muted'));
}
function projectCard(p) {
  const card = node('article', undefined, 'panel');
  const top = node('div', undefined, 'section-head'); top.append(node('span', state.networks.find(n => n.id === p.network)?.name, 'eyebrow'), node('span', p.verified ? 'Джерело: перевірено вручну' : 'Потребує перевірки', 'pill'));
  const workflow=node('select');workflow.setAttribute('aria-label','Статус проєкту '+p.name);
  for(const [value,label] of Object.entries({new:'Новий',watching:'Цікавить',active:'У роботі',paused:'Відкладено',dismissed:'Не підходить'})){const o=node('option',label);o.value=value;workflow.append(o);}
  workflow.value=p.workflow||'new';workflow.onchange=async()=>{workflow.disabled=true;try{await mutate('/api/projects/'+p.id+'/workflow',{workflow:workflow.value});}catch(e){$('#message').textContent=e.message;workflow.value=p.workflow||'new';workflow.disabled=false;}};
  const statusLabel=node('label','Мій статус');statusLabel.append(workflow);top.append(statusLabel);
  card.append(top, node('h3', p.name));
  const incrypted=p.source.startsWith('https://incrypted.com/airdrops/?single=');
  const overview=node('div',undefined,'project-overview');
  const sourceName=incrypted?'Incrypted':new URL(p.source).hostname;
  const info=(title,text)=>{const block=node('div');block.append(node('strong',title),node('p',text));overview.append(block);};
  info('Джерело',sourceName);
  info('Матеріали',p.guide?'Інструкція отримана':p.importedMaterial?'Матеріали імпортовані':'Інструкцію ще не отримано');
  info('Аналіз ШІ',p.reviewStatus==='current'?'Аналіз поточної версії матеріалу':p.agentReview?'Потрібне оновлення аналізу':'Ще не виконано');
  card.append(overview);
  if(p.notes){const notes=node('details',undefined,'project-notes');notes.append(node('summary','Опис і нотатки'),node('p',p.notes,'ai-review'));card.append(notes);}
  const help=incrypted ? (['watching','active'].includes(p.workflow)?'Проєкт обрано для щоденної перевірки. Запусти агентів у блоці вище або отримай інструкцію й аналіз кнопками нижче.':'Хочеш стежити за цим проєктом? У полі «Мій статус» обери «Цікавить». Для початку відкрий джерело або отримай інструкцію.') : 'Відкрий джерело, додай матеріали та замов аналіз. Щоденна перевірка підтримує також картки DropsTab і Airdrops.io зі статусом «Цікавить» або «У роботі».';
  card.append(node('p',help,'project-next-step'));
  const actions=node('div',undefined,'project-actions');card.append(actions);
  const link = node('a', 'Відкрити джерело ↗'); link.href = p.source; link.target = '_blank'; link.rel = 'noopener noreferrer'; actions.append(link);
  const rewardLabels={unconfirmed:'Винагорода не підтверджена',announced:'Оголошено за перевіркою користувача',closed:'Кампанію позначено завершеною'};
  card.append(node('p', `План участі: ${p.analysis?.score ?? '—'}/100 · ${rewardLabels[p.analysis?.rewardStatus || 'unconfirmed']}`, 'score'));
  if (!p.verified) actions.append(action('Підтвердити перевірку джерела', async () => { const evidence = prompt('Що підтверджує офіційність джерела? Запишіть результат власної перевірки.'); if (evidence) await mutate(`/api/projects/${p.id}/verify`, { evidence }); }));
  for (const evidence of p.evidence || []) {
    const details = node('details'); details.append(node('summary', 'Знімок джерела · '+new Date(evidence.attemptedAt).toLocaleString('uk-UA')),node('p',evidence.excerpt,'muted')); card.append(details);
  }
  actions.append(action('Аналіз локальним ШІ',async()=>{ $('#message').textContent='Локальна модель аналізує. Це може тривати кілька хвилин…';await mutate('/api/agents/analyze',{projectId:p.id}); }));
  if(p.analysisJob){const labels={pending:'Очікує аналізу',running:'Ollama аналізує матеріал',succeeded:'Аналіз завершено',failed:'Помилка аналізу',superseded:'Матеріал оновлено — попередню версію пропущено'};card.append(node('p',labels[p.analysisJob.status]+(p.analysisJob.error?' · '+p.analysisJob.error:''),'notice'));if(p.analysisJob.status==='failed')card.append(action('Повторити автоматичний аналіз',()=>mutate('/api/agents/retry',{projectId:p.id})));}
  if(p.agentReview){const review=node('details');review.append(node('summary','Чернетка ШІ · '+new Date(p.agentReview.createdAt).toLocaleString('uk-UA')),node('p',p.reviewStatus!=='current'?'Цей висновок не прив’язаний до поточної версії матеріалу. Дочекайся нового аналізу.':'Висновок за збереженими матеріалами, без незалежної перевірки сайту.','muted'),node('p',p.agentReview.answer,'ai-review'));if(p.agentReview.quality)review.append(node('p',p.agentReview.quality.unknownLinks.length?'Перевірка: у відповіді є посилання, відсутні в матеріалах. Не використовуй їх без окремої перевірки.':p.agentReview.quality.scope,'notice'));card.append(review);}
  if(p.agentReview){
   const feedback=node('details',undefined,'assessment');feedback.append(node('summary','Навчити помічника: оцінити аналіз'),node('p','Твоє уточнення збережеться для наступних аналізів цього проєкту. Це пам’ять помічника, а не перенавчання моделі.','muted'));
   const f=node('form',undefined,'form-grid'),rating=node('select');const ratingLabel=node('label','Оцінка аналізу');ratingLabel.append(rating);
   for(const [v,t] of [['useful','Корисно'],['inaccurate','Потрібне виправлення']]){const o=node('option',t);o.value=v;rating.append(o);}rating.value=p.agentFeedback?.rating||'useful';
   const label=node('label','Що врахувати наступного разу?','wide'),comment=node('textarea');comment.maxLength=1500;comment.value=p.agentFeedback?.comment||'';label.append(comment);
   const save=node('button','Зберегти для агента');save.type='submit';f.append(ratingLabel,label,save);
   f.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await mutate('/api/agents/feedback',{projectId:p.id,rating:rating.value,comment:comment.value,reviewCreatedAt:p.agentReview.createdAt});}catch(error){$('#message').textContent=error.message;save.disabled=false;}};
   feedback.append(f);if(p.agentFeedback){feedback.append(node('p','Уточнення збережене. Агент врахує його під час наступного аналізу.','muted'),action('Забути це уточнення',()=>mutate('/api/agents/feedback',{projectId:p.id,rating:'clear'})));}card.append(feedback);
  }
  if(incrypted)actions.append(action('Отримати інструкцію Incrypted',()=>mutate('/api/agents/guide',{projectId:p.id})));
  if(p.importedMaterial){const m=node('details');m.append(node('summary','Імпорт CryptoRank · '+new Date(p.importedMaterial.createdAt).toLocaleString('uk-UA')),materialText(p.importedMaterial.content));card.append(m);}
  if(p.guide)card.append(guideReader(p.guide));
  if(p.daily){const d=node('details');d.append(node('summary','Щоденна перевірка джерела'),node('p',p.daily.error||('Перевірено '+new Date(p.daily.attemptedAt).toLocaleString('uk-UA')+' · '+(p.daily.snapshot?.actions||'Без нових даних')+(p.daily.aiError?' · ШІ: '+p.daily.aiError:''))));if(p.daily.previous){d.append(node('h4','Було'),node('p',p.daily.previous.actions,'ai-review'),node('h4','Останні отримані дані'),node('p',p.daily.snapshot?.actions||'Немає даних','ai-review'));}card.append(d);}
  if(p.latestEvidence)card.append(researchPanel(p,{node,mutate}));
  card.append(assessmentPanel(p,{node,mutate}),outcomePanel(p,{node,mutate}));
  const tasks = node('div', undefined, 'tasks');tasks.append(node('h4','Мій план дій'),node('p',p.tasks.length?'Твої завдання та строки виконання.':'Поки немає завдань. Прочитай інструкцію та додай перший крок нижче.','muted')); 
  for (const t of p.tasks) {
    const row = node('div', undefined, 'task'); row.id='task-'+t.id;row.tabIndex=-1; row.append(node('strong', `${t.status === 'completed' ? '✓' : '○'} ${t.title}`), node('small', t.status === 'completed' ? `Виконання повідомлено користувачем. ${t.evidence}` : policies[t.policy]));
    if (t.status !== 'completed' && p.verified) row.append(action('Записати виконання', async () => { const evidence = prompt('Додайте доказ уже виконаної дії: URL, tx hash або опис. Це лише запис у журналі, без виконання транзакції.'); if (evidence) await mutate(`/api/tasks/${t.id}/complete`, { evidence,scheduledFor:t.schedule?.dueAt,scheduleRevision:t.schedule?.revision }); }));
    const dueLabels={due:'Настав час виконання',soon:'Термін протягом 24 годин',upcoming:'Заплановано',unscheduled:'Без дедлайну',completed:'Виконано'};
    row.append(node('small',dueLabels[t.dueState] || ''),schedulePanel(t,{node,mutate}));
    tasks.append(row);
  }
  card.append(tasks);
  const form = node('form', undefined, 'task-form'); const input = node('input'); input.required = true; input.maxLength = 300; input.placeholder = 'Наступний крок'; input.setAttribute('aria-label', 'Назва завдання');
  const select = node('select'); select.setAttribute('aria-label', 'Тип завдання'); Object.entries(labels).forEach(([value, label]) => { const o = node('option', label); o.value = value; select.append(o); });
  const submit = node('button', '＋ Завдання'); submit.type = 'submit'; form.append(input, select, submit);
  form.onsubmit = async e => { e.preventDefault(); submit.disabled = true; try { await mutate(`/api/projects/${p.id}/tasks`, { title: input.value, kind: select.value }); } catch (error) { $('#message').textContent = error.message; submit.disabled = false; } };
  card.append(form); return card;
}
setupBackup(()=>state?.token??'');
setupRobot(()=>state);
setupAgentProgress(load);
setupMaterialImport({mutate});
setupLocalChat(()=>state);
$('#find-projects').onclick=async()=>{const b=$('#find-projects');b.disabled=true;$('#tracker-status').textContent='Шукаю проєкти…';try{await mutate('/api/discovery/projects',{sourceId:$('#tracker-source').value});}catch(e){$('#tracker-status').textContent=e.message;}finally{b.disabled=false;}};
$('#run-agents').onclick=async()=>{const b=$('#run-agents');b.disabled=true;try{await mutate('/api/agents/run',{});}catch(e){$('#agent-work-status').textContent=e.message;}finally{b.disabled=false;}};
for(const id of filterIds){const input=document.getElementById(id);input.addEventListener(id==='search'?'input':'change',()=>{saveFilters();render();});}
$('#reset-filters').onclick=()=>{clearFilters();render();};
$('#project-form').onsubmit = async e => { e.preventDefault(); const form = e.currentTarget; const b = form.querySelector('button'); b.disabled = true; try { await mutate('/api/projects', Object.fromEntries(new FormData(form))); form.reset(); } catch (error) { $('#message').textContent = error.message; } finally { b.disabled = false; } };
try { await load(); for (const n of state.networks) { for (const target of ['#network', '#filter']) { const o = node('option', `${n.name}`); o.value = n.id; $(target).append(o); } } restoreFilters();render(); } catch (e) { $('#message').textContent = e.message; }

function renderSources() {
  const box = $('#sources'); if (!box) return;
  box.replaceChildren(...(state.sources || []).map(source => {
    const card=node('article',undefined,'panel'); card.append(node('h3',source.name),node('p',source.purpose,'muted'));
    const status = !source.lastScan ? 'Ще не перевірено' : source.lastScan.error ? 'Помилка: '+source.lastScan.error : 'Оновлено: '+new Date(source.lastScan.attemptedAt).toLocaleString('uk-UA');
    card.append(node('p',status,'muted'),action('Отримати офіційні матеріали',async()=>{ $('#message').textContent='Отримую сторінку…'; await mutate('/api/discovery/scan',{sourceId:source.id}); })); return card;
  }));
  $('#monitor').replaceChildren();
  if(state.monitor) {
    $('#monitor').append(node('p','Моніторинг кожні 6 годин: '+(state.monitor.enabled?'увімкнено':'вимкнено')+'. Працює, поки запущено сервер.','muted'), action(state.monitor.enabled?'Вимкнути моніторинг':'Увімкнути моніторинг',()=>mutate('/api/monitor',{enabled:!state.monitor.enabled})));
  }
}
