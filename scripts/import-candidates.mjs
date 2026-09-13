import {readFile} from 'node:fs/promises';
const root='http://127.0.0.1:4317';
const data=JSON.parse(await readFile(new URL('../research-candidates.json',import.meta.url),'utf8'));
const state=await(await fetch(root+'/api/state')).json();
let added=0;
for(const candidate of data.projects){
 if(state.projects.some(p=>p.name.toLowerCase()===candidate.name.toLowerCase()))continue;
 const response=await fetch(root+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':state.token},body:JSON.stringify({...candidate,notes:candidate.notes+'\nДата дослідження: '+data.reviewedAt})});
 if(!response.ok)throw Error(await response.text());
 added++;
}
console.log('Додано кандидатів: '+added);
