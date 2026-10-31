// Server: Auslieferung, Sicherheitsheader, Lernstand-API, Pfad-Traversal.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'sqlwork-'));
process.env.DATA_DIR = dir;
const { createServer, initData } = await import('../server/server.js');
let server, base;

before(async () => {
  await initData();
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });

test('Health-Endpunkt', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).storage, 'server');
});

test('Startseite mit Sicherheitsheadern', async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await r.text(), /SQL/);
});

test('WASM mit korrektem MIME-Typ und gzip', async () => {
  const r = await fetch(`${base}/vendor/sql-wasm.wasm`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/wasm');
  assert.match(r.headers.get('cache-control'), /immutable/);
});

test('Pfad-Traversal wird abgewehrt', async () => {
  const r = await fetch(`${base}/..%2f..%2fserver%2fserver.js`);
  assert.ok([403, 404].includes(r.status));
});

test('Lernstand speichern und laden', async () => {
  const empty = await fetch(`${base}/api/state/demo`);
  assert.equal(empty.status, 204);
  const body = { updatedAt: Date.now(), xp: 42, tasks: {} };
  const put = await fetch(`${base}/api/state/demo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(put.status, 200);
  const got = await (await fetch(`${base}/api/state/demo`)).json();
  assert.equal(got.xp, 42);
});

test('Ungültige Eingaben werden abgelehnt', async () => {
  assert.equal((await fetch(`${base}/api/state/..%2Fetc`)).status, 400);
  assert.equal((await fetch(`${base}/api/state/x`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{nope' })).status, 400);
  assert.equal((await fetch(`${base}/api/state/x`, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
  const big = JSON.stringify({ updatedAt: 1, pad: 'x'.repeat(1.2 * 1024 * 1024) });
  const r = await fetch(`${base}/api/state/x`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: big }).catch(() => ({ status: 413 }));
  assert.equal(r.status, 413);
});
