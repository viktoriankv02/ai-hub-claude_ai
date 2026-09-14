const key='drop-hunter-reader';
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function guideReader(guide){
 const root=el('details');root.className='guide-reader';root.append(el('summary','Інструкція Incrypted — відкрити для читання'));
 const panel=el('div');panel.className='reader-panel';root.append(panel);
 const meta=el('p','Отримано '+new Date(guide.fetchedAt).toLocaleString('uk-UA')+'. Текст джерела; умови участі можуть змінюватися.');panel.append(meta);
 const link=el('a','Відкрити оригінал інструкції ↗');link.href=guide.url;link.target='_blank';link.rel='noopener noreferrer';panel.append(link);
 if(guide.links?.length){const links=el('details');links.append(el('summary','Посилання з інструкції ('+guide.links.length+')'));const list=el('ul');for(const item of guide.links){let url;try{url=new URL(item.url);if(url.protocol!=='https:'||url.username||url.password)continue;}catch{continue;}const row=el('li'),a=el('a',item.label+' — '+url.hostname);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';row.append(a);list.append(row);}links.append(el('p','Адреси взято з джерела; це не підтвердження безпеки сайту.'),list);panel.append(links);}
 const controls=el('div');controls.className='reader-controls';panel.append(controls);
 let prefs={size:'18',theme:'light'};try{prefs={...prefs,...JSON.parse(localStorage.getItem(key)||'{}')};}catch{}
 function select(title,values,value){const label=el('label',title),input=el('select');for(const [v,t] of values){const o=el('option',t);o.value=v;input.append(o);}input.value=value;label.append(input);controls.append(label);return input;}
 const size=select('Розмір шрифту',[['16','16 — компактний'],['18','18 — стандартний'],['20','20 — великий'],['24','24 — дуже великий']],prefs.size);
 const theme=select('Колір тексту та фону',[['dark','Світлий текст / темний фон'],['light','Темний текст / білий фон'],['sepia','Коричневий текст / кремовий фон']],prefs.theme);
 const body=el('div');body.className='reader-body';panel.append(body);
 function apply(){const sz=['16','18','20','24'].includes(size.value)?size.value:'18';const th=['dark','light','sepia'].includes(theme.value)?theme.value:'dark';body.style.fontSize=sz+'px';body.dataset.theme=th;try{localStorage.setItem(key,JSON.stringify({size:sz,theme:th}));}catch{}}
 size.addEventListener('change',apply);theme.addEventListener('change',apply);apply();
 let blocks=guide.blocks;
 if(!Array.isArray(blocks)||!blocks.length){
  panel.insertBefore(el('p','Цю інструкцію збережено без розділів. Текст розбито на коротші абзаци для читання. Кнопка «Отримати інструкцію Incrypted» завантажить структуру з джерела.'),body);
  const parts=(guide.text||'').match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)||[guide.text||''];blocks=[];let text='';for(const part of parts){text+=part;if(text.length>=600){blocks.push({type:'paragraph',text});text='';}}if(text)blocks.push({type:'paragraph',text});
 }
 const headings=blocks.filter(b=>b.type==='heading');let index=0;
 if(headings.length){const label=el('label','Перейти до розділу'),jump=el('select');jump.append(el('option','Виберіть розділ'));headings.forEach((b,i)=>{const o=el('option',b.text);o.value=String(i);jump.append(o);});jump.addEventListener('change',()=>body.querySelector('[data-heading="'+jump.value+'"]')?.scrollIntoView({block:'start'}));label.append(jump);controls.append(label);}
 let list;
 for(const b of blocks){if(b.type==='item'){if(!list){list=el('ul');body.append(list);}list.append(el('li',b.text));continue;}list=null;const n=el(b.type==='heading'?'h4':'p',b.text);if(b.type==='heading')n.dataset.heading=String(index++);body.append(n);}
 return root;
}
