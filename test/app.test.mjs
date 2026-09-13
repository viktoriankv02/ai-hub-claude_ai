import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';
import { createApp } from '../src/server.mjs';
import { taskPolicy } from '../src/domain.mjs';
const project = { name: 'Test Ink research', network: 'ink', source: 'https://example.com/campaign', notes: 'Test fixture only' };
test('SQLite preserves projects, tasks, evidence and history after restart', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'drop-hunter-')), 'test.sqlite');
  let store = new Store(path); const p = store.create(project); const t = store.addTask(p.id, { title: 'Read campaign rules', kind: 'research' });
  assert.throws(() => store.complete(t.id, { evidence: 'Read docs' }), /перевірте/);
  store.verify(p.id, { evidence: 'Reviewed official provenance' }); store.complete(t.id, { evidence: 'Read docs' });
  const count = store.history().length; store.complete(t.id, { evidence: 'Read docs' }); assert.equal(store.history().length, count);
  store.close(); store = new Store(path); assert.equal(store.list()[0].tasks[0].evidence, 'Read docs'); assert.equal(store.list()[0].tasks[0].status, 'completed'); store.close();
});
test('rejects unsafe links and missing evidence; financial tasks never autonomous', () => {
  const store = new Store(':memory:');
  assert.throws(() => store.create({ ...project, source: 'javascript:alert(1)' }));
  assert.throws(() => store.create({ ...project, network: 'invalid-network' }));
  const p = store.create(project); assert.throws(() => store.verify(p.id, { evidence: ' ' }));
  assert.equal(store.list()[0].score, 0); assert.equal(store.list()[0].verified, 0);
  for (const kind of ['deploy','bridge','swap','stake','mint','contract-call']) assert.equal(taskPolicy(kind, true), 'approval');
  assert.equal(taskPolicy('check-in', true), 'manual'); store.close();
});
test('HTTP round trip, session protection, origin checks and static UI', async () => {
  const store = new Store(':memory:'); const app = createApp(store);
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${app.address().port}`;
    const state = await (await fetch(`${url}/api/state`)).json();
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(`${url}/api/state`, { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(`${url}/api/projects`, { method: 'POST' })).status, 403);
    const headers = { 'Content-Type': 'application/json', 'X-Session-Token': state.token };
    assert.equal((await fetch(`${url}/api/projects`, { method: 'POST', headers, body: JSON.stringify(project) })).status, 201);
    assert.equal((await (await fetch(`${url}/api/state`)).json()).projects.length, 1);
    assert.equal((await fetch(`${url}/api/projects`, { method: 'POST', headers, body: '{' })).status, 400);
    assert.equal((await fetch(`${url}/src/store.mjs`)).status, 404);
  } finally { await new Promise(resolve => app.close(resolve)); store.close(); }
});
