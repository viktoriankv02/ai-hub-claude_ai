export function checkReview(answer,materials){
 const urls=text=>[...String(text).matchAll(/https?:\/\/[^\s<>"')\]]+/g)].map(m=>m[0].replace(/[.,;:!?]+$/,''));
 const strings=value=>typeof value==='string'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
 const known=new Set(urls(strings(materials).join('\n')));const unknown=[...new Set(urls(answer))].filter(url=>!known.has(url));
 return {checkedAt:new Date().toISOString(),unknownLinks:unknown,status:unknown.length?'needs_review':'links_checked',scope:'Перевірено лише наявність URL у матеріалах; факти та винагороду не підтверджено.'};
}
