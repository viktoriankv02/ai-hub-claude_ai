// Populate public instructions; queue handles one local analysis at a time.
const base='http://127.0.0.1:4317';
const response=await fetch(base+'/api/state');if(!response.ok)throw Error('Local app unavailable');const state=await response.json();
const projects=state.projects.filter(p=>p.source.startsWith('https://incrypted.com/airdrops/?single=')&&!['paused','dismissed'].includes(p.workflow)&&(!p.guide||!p.analysisJob||(process.argv.includes('--refresh-links')&&!Array.isArray(p.guide.links))));
let done=0,failed=0;
for(const p of projects){
 try{const r=await fetch(base+'/api/agents/guide',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':state.token},body:JSON.stringify({projectId:p.id}),signal:AbortSignal.timeout(50000)});const result=await r.json();if(!r.ok)throw Error(result.error);done++;console.log(JSON.stringify({project:p.name,status:'instruction_saved_analysis_queued'}));}
 catch(e){failed++;console.log(JSON.stringify({project:p.name,status:'failed',error:e.message}));}
 await new Promise(resolve=>setTimeout(resolve,1500));
}
console.log(JSON.stringify({done,failed,total:projects.length}));
