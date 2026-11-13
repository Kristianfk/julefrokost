// Røgtest af API'et mod en lokal server med lager i hukommelsen.
// Kør: npm test   (starter selv en server på en ledig port)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const PORT = 3100 + Math.floor(Math.random() * 500);
const BASE = `http://localhost:${PORT}`;
const PW = 'test-pw';

const server = spawn(process.execPath, ['dev/server.js'], {
  env: { ...process.env, PORT: String(PORT), ADMIN_PASSWORD: PW, KV_REST_API_URL: '', KV_REST_API_TOKEN: '', VERCEL: '' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

async function waitUp() {
  for (let i = 0; i < 50; i += 1) {
    try { await fetch(`${BASE}/api/status`); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('Serveren startede ikke');
}

const post = (path, body, headers = {}) => fetch(BASE + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const admin = (method, body, pw = PW) => fetch(`${BASE}/api/admin`, {
  method, headers: { Authorization: `Bearer ${pw}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
});

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log('  ok  ', name); }
  catch (err) { console.error('  FEJL', name, '\n', err); process.exitCode = 1; }
}

try {
  await waitUp();

  await test('status viser fire kategorier og åben afstemning', async () => {
    const d = await (await fetch(`${BASE}/api/status`)).json();
    assert.equal(d.closed, false);
    assert.equal(d.categories.length, 4);
  });

  await test('siderne leveres (/ og /admin)', async () => {
    assert.equal((await fetch(BASE + '/')).status, 200);
    const a = await fetch(BASE + '/admin');
    assert.equal(a.status, 200);
    assert.match(await a.text(), /Admin/);
  });

  await test('tom stemme afvises', async () => {
    assert.equal((await post('/api/vote', { votes: {} })).status, 400);
    assert.equal((await post('/api/vote', { votes: { humorspreder: '   ' } })).status, 400);
  });

  await test('stemmer tælles, og stavemåder samles', async () => {
    assert.equal((await post('/api/vote', { votes: { humorspreder: 'Mette', original: 'Jens', dansegulv: 'Lars' } })).status, 200);
    assert.equal((await post('/api/vote', { votes: { humorspreder: '  mette  ', original: 'Jens' } })).status, 200);
    assert.equal((await post('/api/vote', { votes: { humorspreder: 'Mette K.', hverdagshelt: 'Anne' } })).status, 200);
    const d = await (await admin('GET')).json();
    assert.equal(d.totalSubmissions, 3);
    const h = d.results.humorspreder.entries;
    assert.equal(h[0].name, 'Mette');
    assert.equal(h[0].count, 2);
    assert.equal(h[1].name, 'Mette K.');
    assert.equal(d.results.original.entries[0].count, 2);
  });

  await test('ukendte kategorier og lange navne renses', async () => {
    await post('/api/vote', { votes: { humorspreder: 'x'.repeat(500), hacker: 'Nope' } });
    const d = await (await admin('GET')).json();
    const longest = Math.max(...d.results.humorspreder.entries.map((e) => e.name.length));
    assert.equal(longest, 60);
    assert.ok(!('hacker' in d.results));
  });

  await test('skjult felt (robot) tæller ikke', async () => {
    const before = (await (await admin('GET')).json()).totalSubmissions;
    assert.equal((await post('/api/vote', { votes: { original: 'Bot' }, website: 'http://spam' })).status, 200);
    assert.equal((await (await admin('GET')).json()).totalSubmissions, before);
  });

  await test('admin kræver adgangskode', async () => {
    assert.equal((await admin('GET', null, 'forkert')).status, 401);
    assert.equal((await fetch(`${BASE}/api/admin`)).status, 401);
  });

  await test('sammenlægning og fortryd', async () => {
    let d = await (await admin('POST', { action: 'merge', category: 'humorspreder', from: 'Mette K.', to: 'Mette' })).json();
    assert.equal(d.results.humorspreder.entries[0].count, 3);
    assert.equal(d.aliases.length, 1);
    d = await (await admin('POST', { action: 'merge', category: 'humorspreder', from: 'Mette', to: 'Mette K.' })).json().catch(() => ({}));
    assert.ok(!d.aliases || d.aliases.length === 1, 'cirkel skal afvises');
    const cycle = await admin('POST', { action: 'merge', category: 'humorspreder', from: 'Mette', to: 'Mette K.' });
    assert.equal(cycle.status, 400);
    const id = (await (await admin('GET')).json()).aliases[0].id;
    d = await (await admin('POST', { action: 'unmerge', id })).json();
    assert.equal(d.aliases.length, 0);
    assert.equal(d.results.humorspreder.entries[0].count, 2);
  });

  await test('slet stemmeseddel', async () => {
    const d = await (await admin('GET')).json();
    const id = d.recent[0].id;
    const after = await (await admin('POST', { action: 'delete', id })).json();
    assert.equal(after.totalSubmissions, d.totalSubmissions - 1);
  });

  await test('luk afstemningen blokerer nye stemmer, åbn virker igen', async () => {
    await admin('POST', { action: 'setClosed', closed: true });
    assert.equal((await post('/api/vote', { votes: { original: 'Sent' } })).status, 403);
    assert.equal((await (await fetch(`${BASE}/api/status`)).json()).closed, true);
    await admin('POST', { action: 'setClosed', closed: false });
    assert.equal((await post('/api/vote', { votes: { original: 'Igen' } })).status, 200);
  });

  await test('nulstil kræver bekræftelse', async () => {
    assert.equal((await admin('POST', { action: 'reset' })).status, 400);
    const d = await (await admin('POST', { action: 'reset', confirm: 'NULSTIL' })).json();
    assert.equal(d.totalSubmissions, 0);
  });

  await test('XSS-tekst gemmes som ren tekst', async () => {
    await post('/api/vote', { votes: { original: '<img src=x onerror=alert(1)>' } });
    const d = await (await admin('GET')).json();
    assert.equal(d.results.original.entries[0].name, '<img src=x onerror=alert(1)>');
  });
} finally {
  server.kill();
}

console.log(process.exitCode ? '\nNogle tests fejlede.' : `\nAlle ${passed} tests bestået.`);
