import {createHash} from 'node:crypto';
import {readableText} from './discovery.mjs';
export async function readIncryptedGuide(source,fetcher=fetch){
 const sourceUrl=new URL(source);
 if(sourceUrl.origin!=='https://incrypted.com'||sourceUrl.pathname!=='/airdrops/'||!/^\d+$/.test(sourceUrl.searchParams.get('single')||''))throw Error('Підтримується картка Incrypted');
 async function read(url){
  const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))throw Error('Не вдалося прочитати інструкцію');
  const reader=r.body.getReader();const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw Error('Ліміт інструкції 2 MB');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
  return Buffer.concat(chunks).toString('utf8');
 }
 const card=await read(sourceUrl.href);
 const link=card.match(/<a\b[^>]*class="share-to-calendar-link-internal"[^>]*href="([^"]+)"/)?.[1];
 if(!link)throw Error('Публічна інструкція не знайдена');
 const url=new URL(link);if(url.origin!=='https://incrypted.com'||url.username||url.password)throw Error('Непідтримуване джерело інструкції');
 const html=await read(url.href);const article=html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/)?.[1];
 if(!article)throw Error('Текст інструкції не знайдено');
 const text=readableText(article);if(text.length<150)throw Error('Недостатньо тексту інструкції');
 return {url:url.href,text:text.slice(0,50000),hash:createHash('sha256').update(text).digest('hex'),fetchedAt:new Date().toISOString()};
}
