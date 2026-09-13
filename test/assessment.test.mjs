import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AssessmentStore } from '../src/assessment-store.mjs';
import { signalDefinitions, summarizeAssessment, validateAssessment } from '../src/assessment.mjs';
import { createApp } from '../src/server.mjs';
import { sources } from '../src/discovery.mjs';

const snapshot=(hash='a',source=sources[0])=>({source,text:'Official terms '+hash,hash,fetchedAt:new Date().toISOString()});
function input(store,id) {
  return {
    campaignType:'grant',rewardStatus:'announced',risk:'medium',estimatedCostUsd:0,
    deadline:'2030-10-15T18:00:00+03:00',eligibility:'Teams with a live product',
    riskNote:'Grant allocation is discretionary',evidenceNote:'Program terms describe applications, not guaranteed payouts.',
    evidenceUrl:store.project(id).source,scanId:store.latestEvidence(id)?.id??null,
    signals:Object.fromEntries(signalDefinitions.map(s=>[s.key,{value:50,note:'Manually reviewed terms'}])),
  };
}
test('assessment revisions persist and distinguish unknown costs from zero',()=>{
  const path=join(mkdtempSync(join(tmpdir(),'drop-assessment-')),'test.sqlite');
  let s=new AssessmentStore(path);const {projectId}=s.saveScan(snapshot());
  assert.throws(()=>s.saveAssessment(projectId,input(s,projectId)),/перевірте/);
  s.verify(projectId,{evidence:'Checked official domain'});s.saveAssessment(projectId,input(s,projectId));
  const next=input(s,projectId);next.estimatedCostUsd=null;next.signals.timeFit={value:null,note:''};s.saveAssessment(projectId,next);
  assert.equal(s.assessmentHistory(projectId).length,2);assert.equal(s.list()[0].analysis.score,45);assert.equal(s.list()[0].analysis.coverage,90);
  s.close();s=new AssessmentStore(path);assert.equal(s.latestAssessment(projectId).data.estimatedCostUsd,null);assert.equal(s.assessmentHistory(projectId)[1].data.estimatedCostUsd,0);s.close();
});
test('content changes invalidate assessment permanently until a new revision',()=>{
  const s=new AssessmentStore(':memory:');const {projectId}=s.saveScan(snapshot());
  s.verify(projectId,{evidence:'Checked'});const oldInput=input(s,projectId);s.saveAssessment(projectId,oldInput);
  s.saveScan(snapshot());assert.equal(s.list()[0].analysis.state,'current');
  s.saveScan(snapshot('b'));assert.equal(s.list()[0].analysis.score,null);assert.equal(s.list()[0].analysis.rewardStatus,'unconfirmed');
  s.verify(projectId,{evidence:'Rechecked'});assert.equal(s.list()[0].analysis.state,'stale');
  assert.throws(()=>s.saveAssessment(projectId,oldInput),/застарів/);
  s.saveScan(snapshot('a'));s.verify(projectId,{evidence:'Rechecked return to original'});
  assert.throws(()=>s.saveAssessment(projectId,oldInput),/застарів/);
  s.saveAssessment(projectId,input(s,projectId));assert.equal(s.list()[0].analysis.state,'current');s.close();
});
test('rejects foreign evidence, invalid costs, invalid signals and timezone-free deadline',()=>{
  const s=new AssessmentStore(':memory:');const p=s.saveScan(snapshot());const p2=s.saveScan(snapshot('other',sources[1]));
  s.verify(p.projectId,{evidence:'Checked'});
  const original=input(s,p.projectId);
  for(const override of [{estimatedCostUsd:-1},{estimatedCostUsd:'0'},{estimatedCostUsd:Infinity},{deadline:'2030-10-15'},{evidenceUrl:'https://evil.example/'},{scanId:s.latestEvidence(p2.projectId).id},{evidenceNote:''},{risk:'safe'}]) assert.throws(()=>s.saveAssessment(p.projectId,{...original,...override}));
  const bad=structuredClone(original);bad.signals.eligibility={value:100,note:''};assert.throws(()=>validateAssessment(bad));
  assert.equal(s.assessmentHistory(p.projectId).length,0);s.close();
});
test('expired deadline is computed with timezone without presenting score as reward chance',()=>{
  const s=new AssessmentStore(':memory:');const p=s.create({name:'Manual project',network:'ink',source:'https://example.com'});
  s.verify(p.id,{evidence:'Manually checked source'});const data=input(s,p.id);data.deadline='2026-09-12T12:00:00+03:00';
  s.saveAssessment(p.id,data);
  const result=summarizeAssessment(s.latestAssessment(p.id),true,Date.parse('2026-09-12T09:00:00Z'));
  assert.equal(result.deadlineState,'expired');assert.equal(result.score,50);assert.ok(result.warnings.some(w=>w.includes('минув')));s.close();
});
test('assessment works end-to-end through HTTP and protects mutation without session',async()=>{
  const s=new AssessmentStore(':memory:');const p=s.saveScan(snapshot());s.verify(p.projectId,{evidence:'Checked'});
  const app=createApp(s);await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  try {
    const url='http://127.0.0.1:'+app.address().port;const state=await(await fetch(url+'/api/state')).json();
    const path=url+'/api/projects/'+p.projectId+'/assessment';
    assert.equal((await fetch(path,{method:'POST'})).status,403);
    const headers={'Content-Type':'application/json','X-Session-Token':state.token};
    const response=await fetch(path,{method:'POST',headers,body:JSON.stringify(input(s,p.projectId))});
    assert.equal(response.status,201,await response.text());
    const refreshed=await(await fetch(url+'/api/state')).json();assert.equal(refreshed.projects[0].analysis.score,50);
    assert.equal((await fetch(url+'/assessment.js')).status,200);
  } finally {await new Promise(resolve=>app.close(resolve));s.close();}
});
