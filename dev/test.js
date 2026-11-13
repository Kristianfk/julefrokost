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
const vote = (voter, votes, extra = {}) => post('/api/vote', { voter, votes, ...extra });
const admin = (method, body, pw = PW) => fetch(`${BASE}/api/admin`, {
  method, headers: { Authorization: `Bearer ${pw}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
});
const snapshot = async () => (await admin('GET')).json();

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

  await test('siderne leveres (/, /admin, skrifter)', async () => {
    assert.equal((await fetch(BASE + '/')).status, 200);
    const a = await fetch(BASE + '/admin');
    assert.equal(a.status, 200);
    assert.match(await a.text(), /Admin/);
    assert.equal((await fetch(BASE + '/fonts/bodoni-moda-latin-500-normal.woff2')).status, 200);
  });

  await test('stemme uden navn eller uden valg afvises', async () => {
    assert.equal((await vote('', { original: 'Jens' })).status, 400);
    assert.equal((await vote('A', { original: 'Jens' })).status, 400);
    assert.equal((await post('/api/vote', { votes: { original: 'Jens' } })).status, 400);
    assert.equal((await vote('Anne Hansen', {})).status, 400);
    assert.equal((await vote('Anne Hansen', { humorspreder: '   ' })).status, 400);
  });

  await test('stemmer tælles, og stavemåder samles', async () => {
    assert.equal((await vote('Anne Hansen', { humorspreder: 'Mette', original: 'Jens', dansegulv: 'Lars' })).status, 200);
    assert.equal((await vote('Bo Jensen', { humorspreder: '  mette  ', original: 'Jens' })).status, 200);
    assert.equal((await vote('Cecilie Berg', { humorspreder: 'Mette K.', hverdagshelt: 'Anne' })).status, 200);
    const d = await snapshot();
    assert.equal(d.totalSubmissions, 3);
    const h = d.results.humorspreder.entries;
    assert.equal(h[0].name, 'Mette');
    assert.equal(h[0].count, 2);
    assert.equal(h[1].name, 'Mette K.');
    assert.equal(d.results.original.entries[0].count, 2);
  });

  await test('samme navn stemmer igen: den nye stemme erstatter den gamle', async () => {
    const r = await vote('  anne   hansen ', { humorspreder: 'Lise', original: 'Jens' });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).replaced, true);
    const d = await snapshot();
    assert.equal(d.totalSubmissions, 3, 'må ikke blive til en fjerde');
    assert.equal(d.results.dansegulv.total, 0, 'Annes gamle valg er væk');
    assert.equal(d.results.humorspreder.entries.find((e) => e.name === 'Lise').count, 1);
    assert.equal(d.results.humorspreder.entries.find((e) => e.key === 'mette').count, 1);
    const first = await vote('Dorte Ravn', { original: 'Jens' });
    assert.equal((await first.json()).replaced, false);
    await admin('POST', { action: 'delete', id: 'dorte ravn' });
  });

  await test('overblikket kobler ikke navn og valg sammen', async () => {
    const d = await snapshot();
    assert.deepEqual(d.voters.map((v) => v.name), ['Anne Hansen', 'Bo Jensen', 'Cecilie Berg']);
    assert.ok(d.recent.length === 3);
    for (const r of d.recent) {
      assert.ok(!('id' in r) && !('name' in r), 'valg må ikke have navn eller id');
      assert.deepEqual(Object.keys(r).sort(), ['t', 'v']);
    }
  });

  await test('ukendte kategorier og lange navne renses', async () => {
    await vote('Erik Holm', { humorspreder: 'x'.repeat(500), hacker: 'Nope' });
    const d = await snapshot();
    const longest = Math.max(...d.results.humorspreder.entries.map((e) => e.name.length));
    assert.equal(longest, 60);
    assert.ok(!('hacker' in d.results));
    await admin('POST', { action: 'delete', id: 'erik holm' });
  });

  await test('skjult felt (robot) tæller ikke', async () => {
    const before = (await snapshot()).totalSubmissions;
    assert.equal((await vote('Bot Botsen', { original: 'Bot' }, { website: 'http://spam' })).status, 200);
    assert.equal((await snapshot()).totalSubmissions, before);
  });

  await test('admin kræver adgangskode', async () => {
    assert.equal((await admin('GET', null, 'forkert')).status, 401);
    assert.equal((await fetch(`${BASE}/api/admin`)).status, 401);
  });

  await test('sammenlægning og fortryd', async () => {
    let d = await (await admin('POST', { action: 'merge', category: 'humorspreder', from: 'Mette K.', to: 'Mette' })).json();
    assert.equal(d.results.humorspreder.entries.find((e) => e.name === 'Mette').count, 2);
    assert.equal(d.aliases.length, 1);
    const cycle = await admin('POST', { action: 'merge', category: 'humorspreder', from: 'Mette', to: 'Mette K.' });
    assert.equal(cycle.status, 400);
    const id = (await snapshot()).aliases[0].id;
    d = await (await admin('POST', { action: 'unmerge', id })).json();
    assert.equal(d.aliases.length, 0);
    assert.equal(d.results.humorspreder.entries.find((e) => e.key === 'mette').count, 1);
  });

  await test('fjern en persons stemme via navnelisten', async () => {
    const d = await snapshot();
    const bo = d.voters.find((v) => v.name === 'Bo Jensen');
    const after = await (await admin('POST', { action: 'delete', id: bo.id })).json();
    assert.equal(after.totalSubmissions, d.totalSubmissions - 1);
    assert.ok(!after.voters.some((v) => v.name === 'Bo Jensen'));
  });

  await test('luk afstemningen blokerer nye stemmer, åbn virker igen', async () => {
    await admin('POST', { action: 'setClosed', closed: true });
    assert.equal((await vote('Sent Sine', { original: 'Sent' })).status, 403);
    assert.equal((await (await fetch(`${BASE}/api/status`)).json()).closed, true);
    await admin('POST', { action: 'setClosed', closed: false });
    assert.equal((await vote('Sent Sine', { original: 'Igen' })).status, 200);
  });

  await test('nulstil kræver bekræftelse', async () => {
    assert.equal((await admin('POST', { action: 'reset' })).status, 400);
    const d = await (await admin('POST', { action: 'reset', confirm: 'NULSTIL' })).json();
    assert.equal(d.totalSubmissions, 0);
    assert.equal(d.voters.length, 0);
  });

  await test('HTML i navne og valg gemmes som ren tekst', async () => {
    await vote('<b>Hacker</b>', { original: '<img src=x onerror=alert(1)>' });
    const d = await snapshot();
    assert.equal(d.results.original.entries[0].name, '<img src=x onerror=alert(1)>');
    assert.equal(d.voters[0].name, '<b>Hacker</b>');
  });
} finally {
  server.kill();
}

console.log(process.exitCode ? '\nNogle tests fejlede.' : `\nAlle ${passed} tests bestået.`);
