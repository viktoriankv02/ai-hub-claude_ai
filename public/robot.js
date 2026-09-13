
export function setupRobot(getState) {
 const make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
 const toggle=make('button','🤖 Помічник');toggle.className='robot-toggle';toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','robot-panel');
 const panel=make('section');panel.id='robot-panel';panel.className='robot-panel';panel.hidden=true;panel.setAttribute('aria-label','Робот-помічник');
 const heading=make('h2','Привіт, я Дроп 🤖');
 const info=make('p','Підкажу, де твої проєкти й завдання. Швидкі підказки — нижче, локальний ШІ-чат — унизу панелі. Telegram ще не підключений.');
 const output=make('p','Обери підказку нижче.');output.setAttribute('role','status');
 const buttons=make('div');buttons.className='robot-actions';
 function button(label,fn){const b=make('button',label);b.type='button';b.onclick=fn;buttons.append(b);}
 function showWatchlist(){
  const state=getState();if(!state){output.textContent='Дані ще завантажуються.';return;}
  const list=state.projects.filter(p=>['watching','active'].includes(p.workflow));
  output.textContent=list.length?'Твої вибрані проєкти: '+list.map(p=>p.name).join(', ')+'. Щоденний моніторинг цих проєктів ще готується.':'Познач проєкт «Цікавить» або «У роботі», щоб додати його до вибраних.';
 }
 button('Мої цікаві проєкти',showWatchlist);
 button('Що зробити сьогодні?',()=>{const a=getState()?.agenda;output.textContent=a?'Завдань, час яких настав: '+a.due+'. Протягом доби: '+a.soon+'. Без дати: '+a.unscheduled+'.':'Дані ще завантажуються.';});
 button('Додати свій проєкт',()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');document.querySelector('#add').scrollIntoView();document.querySelector('#project-form input').focus();});
 button('Як працює пошук?',()=>{output.textContent='У розділі «Можливості» натисни «Знайти нові проєкти». Зараз підключено Airdrops.io. CryptoRank та Incrypted — наступні основні джерела. Відкрий джерело й перевір умови перед участю.';});
 button('Android і Telegram',()=>{output.textContent='Заплановано спільний сервер, вебверсію для встановлення на Android та Telegram-бота. Підключення ще немає; локальна адреса ПК не відкриє цей застосунок на телефоні.';});
 const close=make('button','Закрити');close.type='button';close.onclick=()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();};
 panel.append(heading,info,buttons,output,close);document.body.append(panel,toggle);
 toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)buttons.querySelector('button').focus();};
 panel.addEventListener('keydown',e=>{if(e.key==='Escape')close.click();});
}
