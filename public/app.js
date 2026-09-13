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
const $ = s => document.querySelector(s);
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
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
  $('#tracker-status').textContent=state.tracker ? (state.tracker.error ? 'Помилка пошуку: '+state.tracker.error : 'Останній пошук: додано '+state.tracker.added+', вже у списку '+state.tracker.duplicates)+' · '+new Date(state.tracker.fetchedAt).toLocaleString('uk-UA') : 'Пошук ще не запускався.';
  renderAgenda(state.agenda,{node,onOpen:async item=>{try{await load();$('#filter').value='';$('#workflow-filter').value='';$('#search').value='';render();const target=document.getElementById('task-'+item.taskId);if(target){target.scrollIntoView({block:'center'});target.focus({preventScroll:true});}else{$('#message').textContent='Завдання більше не доступне.';}}catch(error){$('#message').textContent=error.message;}}});
  const allTasks = state.projects.flatMap(p => p.tasks);
  $('#metrics').replaceChildren(...[[state.projects.length, 'Проєктів у дослідженні'], [state.projects.filter(p => p.verified).length, 'Джерел підтверджено'], [allTasks.filter(t => t.status !== 'completed').length, 'Завдань у плані']].map(([count, label]) => { const el = node('div', undefined, 'metric'); el.append(node('strong', count), node('span', label)); return el; }));
  const query=$('#search').value.trim().toLocaleLowerCase('uk-UA');
  const list = state.projects.filter(p => (!$('#filter').value || p.network === $('#filter').value) && (!$('#workflow-filter').value || p.workflow === $('#workflow-filter').value) && (!query || (p.name+' '+p.notes).toLocaleLowerCase('uk-UA').includes(query)));
  $('#result-count').textContent='Показано '+list.length+' із '+state.projects.length;
  $('#projects').replaceChildren(...list.map(projectCard));
  if (!list.length) $('#projects').append(node('div', 'Тут починається дослідження. Додай проєкт із посиланням на джерело — і сформуй свій перший план дій.', 'empty'));
  $('#events').replaceChildren(...state.events.map(e => { const row = node('div', undefined, 'event'); row.append(node('time', new Date(e.createdAt).toLocaleString('uk-UA')), node('span', e.message)); return row; }));
  if (!state.events.length) $('#events').append(node('p', 'Історія з’явиться після першої дії.', 'muted'));
}
function projectCard(p) {
  const card = node('article', undefined, 'panel');
  const top = node('div', undefined, 'section-head'); top.append(node('span', state.networks.find(n => n.id === p.network)?.name, 'eyebrow'), node('span', p.verified ? 'Джерело: перевірено вручну' : 'Потребує перевірки', 'pill'));
  const workflow=node('select');workflow.setAttribute('aria-label','Статус проєкту '+p.name);
  for(const [value,label] of Object.entries({new:'Новий',watching:'Цікавить',active:'У роботі',paused:'Відкладено',dismissed:'Не підходить'})){const o=node('option',label);o.value=value;workflow.append(o);}
  workflow.value=p.workflow||'new';workflow.onchange=async()=>{workflow.disabled=true;try{await mutate('/api/projects/'+p.id+'/workflow',{workflow:workflow.value});}catch(e){$('#message').textContent=e.message;workflow.value=p.workflow||'new';workflow.disabled=false;}};
  top.append(workflow);
  card.append(top, node('h3', p.name), node('p', p.notes || 'Додайте завдання після дослідження джерела.', 'muted'));
  const link = node('a', 'Відкрити джерело ↗'); link.href = p.source; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link);
  const rewardLabels={unconfirmed:'Винагорода не підтверджена',announced:'Оголошено за перевіркою користувача',closed:'Кампанію позначено завершеною'};
  card.append(node('p', `План участі: ${p.analysis?.score ?? '—'}/100 · ${rewardLabels[p.analysis?.rewardStatus || 'unconfirmed']}`, 'score'));
  if (!p.verified) card.append(action('Підтвердити перевірку джерела', async () => { const evidence = prompt('Що підтверджує офіційність джерела? Запишіть результат власної перевірки.'); if (evidence) await mutate(`/api/projects/${p.id}/verify`, { evidence }); }));
  for (const evidence of p.evidence || []) {
    const details = node('details'); details.append(node('summary', 'Знімок джерела · '+new Date(evidence.attemptedAt).toLocaleString('uk-UA')),node('p',evidence.excerpt,'muted')); card.append(details);
  }
  card.append(action('Аналіз локальним ШІ',async()=>{ $('#message').textContent='Локальна модель аналізує. Це може тривати кілька хвилин…';await mutate('/api/agents/analyze',{projectId:p.id}); }));
  if(p.agentReview){const review=node('details');review.append(node('summary','Чернетка ШІ · '+new Date(p.agentReview.createdAt).toLocaleString('uk-UA')),node('p','Висновок за збереженими матеріалами, без нової перевірки сайту.','muted'),node('p',p.agentReview.answer,'ai-review'));card.append(review);}
  if(p.source.startsWith('https://incrypted.com/airdrops/?single='))card.append(action('Отримати інструкцію Incrypted',()=>mutate('/api/agents/guide',{projectId:p.id})));
  if(p.importedMaterial){const m=node('details');m.append(node('summary','Імпорт CryptoRank · '+new Date(p.importedMaterial.createdAt).toLocaleString('uk-UA')),node('p',p.importedMaterial.content,'ai-review'));card.append(m);}
  if(p.guide){const g=node('details');const a=node('a','Відкрити інструкцію ↗');a.href=p.guide.url;a.target='_blank';a.rel='noopener noreferrer';g.append(node('summary','Інструкція Incrypted · '+new Date(p.guide.fetchedAt).toLocaleString('uk-UA')),a,node('p',p.guide.text,'ai-review'));card.append(g);}
  if(p.daily){const d=node('details');d.append(node('summary','Щоденна перевірка Incrypted'),node('p',p.daily.error||('Перевірено '+new Date(p.daily.attemptedAt).toLocaleString('uk-UA')+' · '+p.daily.snapshot.actions+(p.daily.aiError?' · ШІ: '+p.daily.aiError:''))));card.append(d);}
  if(p.latestEvidence)card.append(researchPanel(p,{node,mutate}));
  card.append(assessmentPanel(p,{node,mutate}),outcomePanel(p,{node,mutate}));
  const tasks = node('div', undefined, 'tasks');
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
setupMaterialImport({mutate});
setupLocalChat(()=>state);
$('#find-projects').onclick=async()=>{const b=$('#find-projects');b.disabled=true;$('#tracker-status').textContent='Шукаю проєкти…';try{await mutate('/api/discovery/projects',{sourceId:$('#tracker-source').value});}catch(e){$('#tracker-status').textContent=e.message;}finally{b.disabled=false;}};
$('#filter').onchange = render;
$('#workflow-filter').onchange=render;
$('#search').oninput=render;
$('#project-form').onsubmit = async e => { e.preventDefault(); const form = e.currentTarget; const b = form.querySelector('button'); b.disabled = true; try { await mutate('/api/projects', Object.fromEntries(new FormData(form))); form.reset(); } catch (error) { $('#message').textContent = error.message; } finally { b.disabled = false; } };
try { await load(); for (const n of state.networks) { for (const target of ['#network', '#filter']) { const o = node('option', `${n.name}`); o.value = n.id; $(target).append(o); } } } catch (e) { $('#message').textContent = e.message; }

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
