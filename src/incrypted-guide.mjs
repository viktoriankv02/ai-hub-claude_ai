import {createHash} from 'node:crypto';
import {readableText} from './discovery.mjs';
export function guideLinks(html,base){
 const found=new Map();
 const clean=html.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 for(const m of clean.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi)){
 try{const url=new URL((m[1]??m[2]).replace(/&amp;|&#038;/g,'&'),base);if(url.protocol!=='https:'||url.username||url.password)continue;const label=readableText(m[3]).slice(0,160);if(!label)continue;found.set(url.href,{url:url.href,label});}catch{}
 if(found.size>=100)break;
 }return [...found.values()];
}
export function guideBlocks(article){
 const clean=article.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const blocks=[];let size=0;
 for(const m of clean.matchAll(/<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)){
  const text=readableText(m[2]).slice(0,50000-size);if(!text)continue;
  blocks.push({type:/^h/.test(m[1])?'heading':m[1]==='li'?'item':'paragraph',text});size+=text.length;if(size>=50000)break;
 }
 return blocks;
}
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
 const links=guideLinks(article,url.href);
 return {links,blocks:guideBlocks(article),url:url.href,text:text.slice(0,50000),hash:createHash('sha256').update(JSON.stringify({text,links})).digest('hex'),fetchedAt:new Date().toISOString()};
}
