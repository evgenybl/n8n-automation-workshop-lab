'use strict';
// The practice office's own tests. Each test starts the office on 127.0.0.1 on a port the system picks, and, where the
// office calls n8n, a small stand-in for n8n that records what it was sent.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createOffice, aiRead, figuresIn } = require('../server.js');

const BADGE = { 'x-office-badge': 'practice-badge' };

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)));
}

// A stand-in for n8n: answers every request with `answer` and records it.
async function fakeN8n(answer) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, body });
      const a = typeof answer === 'function' ? answer(req) : answer || { status: 200, body: '{"ok":true}' };
      res.writeHead(a.status, { 'content-type': 'application/json' });
      res.end(a.body);
    });
  });
  const url = await listen(server);
  return { url, seen, close: () => new Promise((r) => server.close(r)) };
}

async function start(options) {
  const office = createOffice(options || { n8nUrl: 'http://127.0.0.1:9' });
  const base = await listen(office.server);
  const call = async (method, p, body, headers) => {
    const r = await fetch(base + p, {
      method,
      headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      // a page
    }
    return { status: r.status, text, json, headers: r.headers };
  };
  return { office, base, call, close: () => new Promise((r) => office.server.close(r)) };
}

// ---------- the practice CRM ----------

test('the CRM refuses a call without the badge header, or with a wrong one, and writes nothing', async () => {
  const o = await start();
  try {
    let r = await o.call('POST', '/crm/contacts', { name: 'Maya Rivers', email: 'maya.rivers@example.com' });
    assert.equal(r.status, 401);
    assert.match(r.json.error, /X-Office-Badge: practice-badge/);
    r = await o.call('POST', '/crm/contacts', { name: 'Maya Rivers', email: 'maya.rivers@example.com' }, { 'x-office-badge': 'wrong' });
    assert.equal(r.status, 401);
    r = await o.call('GET', '/crm/contacts?email=maya.rivers@example.com');
    assert.equal(r.status, 401);
    assert.equal(o.office.state.contacts.length, 0);
  } finally {
    await o.close();
  }
});

test('the CRM creates a contact with its first note, finds it by e-mail in any letter case, and adds notes', async () => {
  const o = await start();
  try {
    let r = await o.call('GET', '/crm/contacts?email=maya.rivers@example.com', undefined, BADGE);
    assert.deepEqual(r.json, { found: false });
    r = await o.call('POST', '/crm/contacts', { name: 'Maya Rivers', email: 'maya.rivers@example.com', company: 'Rivers Pottery (invented)', note: 'First note' }, BADGE);
    assert.equal(r.status, 201);
    assert.equal(r.json.id, 'C1');
    assert.equal(r.json.contact, 'C1');
    assert.equal(r.json.notes, 1);
    r = await o.call('GET', '/crm/contacts?email=MAYA.Rivers@example.com', undefined, BADGE);
    assert.equal(r.json.found, true);
    assert.equal(r.json.contact.id, 'C1');
    r = await o.call('POST', '/crm/contacts/C1/notes', { text: 'Second note' }, BADGE);
    assert.equal(r.status, 201);
    assert.deepEqual(r.json, { id: 'N2', contact: 'C1', notes: 2 });
    assert.deepEqual(o.office.state.contacts[0].notes.map((n) => n.text), ['First note', 'Second note']);
  } finally {
    await o.close();
  }
});

test('a contact created with no note has no notes; the note is written in the same call as the contact or not at all', async () => {
  const o = await start();
  try {
    const r = await o.call('POST', '/crm/contacts', { name: 'Tom Ash', email: 'tom.ash@example.com' }, BADGE);
    assert.equal(r.status, 201);
    assert.equal(r.json.notes, 0);
  } finally {
    await o.close();
  }
});

test('the CRM refuses a second contact with the same e-mail with 409, in any letter case', async () => {
  const o = await start();
  try {
    await o.call('POST', '/crm/contacts', { name: 'Maya Rivers', email: 'maya.rivers@example.com' }, BADGE);
    const r = await o.call('POST', '/crm/contacts', { name: 'M. Rivers', email: 'Maya.Rivers@example.com' }, BADGE);
    assert.equal(r.status, 409);
    assert.equal(r.json.id, 'C1');
    assert.equal(o.office.state.contacts.length, 1);
  } finally {
    await o.close();
  }
});

test('the CRM looks up by exact name too, which misses a person who writes the name differently', async () => {
  const o = await start();
  try {
    await o.call('POST', '/crm/contacts', { name: 'Maya Rivers', email: 'maya.rivers@example.com' }, BADGE);
    let r = await o.call('GET', '/crm/contacts?name=' + encodeURIComponent('Maya Rivers'), undefined, BADGE);
    assert.equal(r.json.found, true);
    r = await o.call('GET', '/crm/contacts?name=' + encodeURIComponent('M. Rivers'), undefined, BADGE);
    assert.equal(r.json.found, false);
  } finally {
    await o.close();
  }
});

test('the CRM refuses what it cannot do: no lookup key, no e-mail, an empty note, an unknown contact or address', async () => {
  const o = await start();
  try {
    assert.equal((await o.call('GET', '/crm/contacts', undefined, BADGE)).status, 400);
    assert.equal((await o.call('POST', '/crm/contacts', { name: 'No Mail' }, BADGE)).status, 400);
    assert.equal((await o.call('POST', '/crm/contacts', { name: 'Bad Mail', email: 'not-an-address' }, BADGE)).status, 400);
    assert.equal((await o.call('POST', '/crm/contacts/C9/notes', { text: 'x' }, BADGE)).status, 404);
    await o.call('POST', '/crm/contacts', { name: 'Tom Ash', email: 'tom.ash@example.com' }, BADGE);
    assert.equal((await o.call('POST', '/crm/contacts/C1/notes', { text: '   ' }, BADGE)).status, 400);
    assert.equal((await o.call('DELETE', '/crm/contacts/C1', undefined, BADGE)).status, 404);
  } finally {
    await o.close();
  }
});

// ---------- faults ----------

test('told to fail, the CRM answers 500 and writes nothing', async () => {
  const o = await start();
  try {
    assert.equal((await o.call('POST', '/faults', { crm: 'fail' })).status, 200);
    const r = await o.call('POST', '/crm/contacts', { name: 'Maya Rivers', email: 'maya.rivers@example.com', note: 'x' }, BADGE);
    assert.equal(r.status, 500);
    assert.equal(o.office.state.contacts.length, 0);
  } finally {
    await o.close();
  }
});

test('told to answer wrongly, the CRM says 200 but does nothing and gives no contact id', async () => {
  const o = await start();
  try {
    await o.call('POST', '/faults', { crm: 'wrong' });
    const r = await o.call('POST', '/crm/contacts', { name: 'Maya Rivers', email: 'maya.rivers@example.com' }, BADGE);
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.contact, undefined);
    const look = await o.call('GET', '/crm/contacts?email=maya.rivers@example.com', undefined, BADGE);
    assert.equal(look.json.found, undefined);
    assert.equal(o.office.state.contacts.length, 0);
  } finally {
    await o.close();
  }
});

test('told to be slow, the CRM answers late, and writes nothing if the caller hangs up first', async () => {
  const o = await start({ n8nUrl: 'http://127.0.0.1:9', slowMs: 400 });
  try {
    await o.call('POST', '/faults', { crm: 'slow' });
    const t0 = Date.now();
    const r = await o.call('POST', '/crm/contacts', { name: 'Maya Rivers', email: 'maya.rivers@example.com' }, BADGE);
    assert.equal(r.status, 201);
    assert.ok(Date.now() - t0 >= 380, 'the answer came after the delay');
    await assert.rejects(
      fetch(o.base + '/crm/contacts', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, BADGE),
        body: JSON.stringify({ name: 'Tom Ash', email: 'tom.ash@example.com' }),
        signal: AbortSignal.timeout(100),
      }),
    );
    await new Promise((res) => setTimeout(res, 600));
    assert.deepEqual(o.office.state.contacts.map((c) => c.email), ['maya.rivers@example.com'], 'the abandoned call wrote nothing');
    assert.ok(o.office.state.calls.some((c) => /hung up/.test(c.detail)), 'the call list says the caller hung up');
  } finally {
    await o.close();
  }
});

test('a fault that does not exist is refused, and the faults stay as they were', async () => {
  const o = await start();
  try {
    assert.equal((await o.call('POST', '/faults', { crm: 'explode' })).status, 400);
    assert.equal((await o.call('POST', '/faults', { ai: 'dream' })).status, 400);
    assert.deepEqual((await o.call('GET', '/faults')).json, { crm: 'off', ai: 'off' });
  } finally {
    await o.close();
  }
});

// ---------- the practice AI step ----------

test('the AI step answers the same way every time, from rules, and says it is a stand-in that is not a model', async () => {
  const o = await start();
  try {
    const input = { name: 'Maya Rivers', message: 'Hello, how much would 12 workshop seats cost for our team in March?' };
    const a = await o.call('POST', '/ai/read', input);
    const b = await o.call('POST', '/ai/read', input);
    assert.equal(a.status, 200);
    assert.deepEqual(a.json, b.json);
    assert.equal(a.json.intent, 'asks for a price');
    assert.match(a.json.summary, /^Maya Rivers asks for a price\. The message begins: Hello, how much would 12 workshop seats/);
    assert.match(a.json.about, /stand-in that is not a model/);
    assert.match(a.json.reply_draft, /^Hello Maya,/);
  } finally {
    await o.close();
  }
});

test('the AI step reads the intent from fixed words', () => {
  assert.equal(aiRead({ name: 'A', message: 'Can we book a visit?' }).intent, 'wants an appointment');
  assert.equal(aiRead({ name: 'A', message: 'The parcel arrived broken.' }).intent, 'reports a problem');
  assert.equal(aiRead({ name: 'A', message: 'Do you open on Sundays?' }).intent, 'general question');
  assert.equal(aiRead({ name: 'A', message: '' }).summary, 'A asks a general question. The message begins: (the message is empty)');
});

test('told to invent, the AI step adds a figure that is not in the enquiry; its answers carry no quote marks', () => {
  const msg = 'How much for 12 seats?';
  const normal = aiRead({ name: 'Maya Rivers', message: msg }, 'off');
  const invented = aiRead({ name: 'Maya Rivers', message: msg }, 'invent');
  assert.deepEqual(figuresIn(normal.summary), ['12']);
  assert.deepEqual(figuresIn(invented.summary), ['12', '4800']);
  const avoids = aiRead({ name: 'A', message: 'We have 4800 cups.' }, 'invent');
  assert.deepEqual(figuresIn(avoids.summary), ['4800', '7350'], 'the invented figure is never one the enquiry has');
  for (const a of [normal, invented]) assert.doesNotMatch(JSON.stringify(a.summary), /\\"/);
});

test('figures are read with their thousands commas removed', () => {
  assert.deepEqual(figuresIn('1,200 cups, 3.5 kg and 12'), ['1200', '3.5', '12']);
  assert.deepEqual(figuresIn('no figures'), []);
});

// ---------- the approval inbox ----------

test('the inbox needs a resume address; a decision calls it at the n8n the office can reach, path and query kept', async () => {
  const n8n = await fakeN8n({ status: 200, body: '{"status":"recorded","contact":"C1"}' });
  const o = await start({ n8nUrl: n8n.url });
  try {
    assert.equal((await o.call('POST', '/inbox', { name: 'Maya Rivers' })).status, 400);
    const r = await o.call('POST', '/inbox', { name: 'Maya Rivers', email: 'maya.rivers@example.com', message: 'Hi', resumeUrl: 'http://localhost:5678/webhook-waiting/42?signature=abc123' });
    assert.equal(r.status, 201);
    assert.deepEqual(r.json, { id: 'A1', status: 'waiting' });
    const d = await o.call('POST', '/inbox/A1/approve', {});
    assert.equal(d.status, 200);
    assert.equal(d.json.approval.status, 'approved');
    assert.deepEqual(d.json.approval.answer.body, { status: 'recorded', contact: 'C1' });
    assert.equal(n8n.seen.length, 1);
    assert.equal(n8n.seen[0].method, 'POST');
    assert.equal(n8n.seen[0].url, '/webhook-waiting/42?signature=abc123');
    assert.equal(JSON.parse(n8n.seen[0].body).decision, 'approve');
    const again = await o.call('POST', '/inbox/A1/reject', {});
    assert.equal(again.status, 409, 'a decision is made once');
    assert.equal(n8n.seen.length, 1);
    assert.equal((await o.call('POST', '/inbox/A9/approve', {})).status, 404);
  } finally {
    await o.close();
    await n8n.close();
  }
});

test('a rejection is sent as "reject"; when n8n cannot be reached the approval waits again', async () => {
  const n8n = await fakeN8n({ status: 200, body: '{"status":"rejected","written":"nothing"}' });
  const o = await start({ n8nUrl: n8n.url });
  try {
    await o.call('POST', '/inbox', { name: 'Tom Ash', resumeUrl: 'http://localhost:5678/webhook-waiting/7?signature=x' });
    const d = await o.call('POST', '/inbox/A1/reject', {});
    assert.equal(d.json.approval.status, 'rejected');
    assert.equal(JSON.parse(n8n.seen[0].body).decision, 'reject');
  } finally {
    await o.close();
    await n8n.close();
  }
  const o2 = await start({ n8nUrl: 'http://127.0.0.1:9' });
  try {
    await o2.call('POST', '/inbox', { name: 'Tom Ash', resumeUrl: 'http://localhost:5678/webhook-waiting/8?signature=y' });
    const d = await o2.call('POST', '/inbox/A1/approve', {});
    assert.equal(d.json.approval.status, 'waiting');
    assert.equal(d.json.approval.answer.status, 0);
    assert.match(d.json.approval.answer.body, /could not reach n8n/);
  } finally {
    await o2.close();
  }
});

// ---------- alerts, the lead form, the check, reset ----------

test('failures a flow reports are kept, newest first', async () => {
  const o = await start();
  try {
    await o.call('POST', '/alerts', { step: 'Look up the contact', reason: 'first' });
    await o.call('POST', '/alerts', { step: 'Add a note', reason: 'second', email: 'maya.rivers@example.com' });
    const s = (await o.call('GET', '/api/state')).json;
    assert.deepEqual(s.alerts.map((a) => a.reason), ['second', 'first']);
    assert.equal(s.alerts[0].id, 'F2');
  } finally {
    await o.close();
  }
});

test('the lead form posts the enquiry to the flow\'s live or test address and returns what the flow answered', async () => {
  const n8n = await fakeN8n((req) => (req.url.startsWith('/webhook-test/') ? { status: 404, body: '{"code":404}' } : { status: 200, body: '{"status":"received","name":"Maya Rivers"}' }));
  const o = await start({ n8nUrl: n8n.url });
  try {
    const enquiry = { name: 'Maya Rivers', email: 'maya.rivers@example.com', consent: true, website: '' };
    let r = await o.call('POST', '/form/send', { path: 'stage-1', mode: 'live', enquiry });
    assert.equal(r.json.status, 200);
    assert.equal(r.json.body, '{"status":"received","name":"Maya Rivers"}');
    assert.equal(n8n.seen[0].url, '/webhook/stage-1');
    assert.deepEqual(JSON.parse(n8n.seen[0].body), enquiry);
    r = await o.call('POST', '/form/send', { path: 'stage-1', mode: 'test', enquiry });
    assert.equal(r.json.status, 404);
    assert.equal(n8n.seen[1].url, '/webhook-test/stage-1');
    r = await o.call('POST', '/form/send', { path: '../x', mode: 'live', enquiry });
    assert.equal(r.status, 400);
    r = await o.call('POST', '/form/send', { path: 'Stage-1', mode: 'live', enquiry });
    assert.equal(r.status, 400, 'a path has small letters, digits and dashes only');
  } finally {
    await o.close();
    await n8n.close();
  }
});

test('the setup check says whether n8n can be reached', async () => {
  const n8n = await fakeN8n({ status: 200, body: '{"status":"ok"}' });
  const o = await start({ n8nUrl: n8n.url });
  try {
    const r = await o.call('GET', '/api/check');
    assert.equal(r.json.office, 'open');
    assert.equal(r.json.n8n, 'ready');
    assert.equal(n8n.seen[0].url, '/healthz/readiness');
  } finally {
    await o.close();
    await n8n.close();
  }
  const o2 = await start({ n8nUrl: 'http://127.0.0.1:9' });
  try {
    assert.equal((await o2.call('GET', '/api/check')).json.n8n, 'not reachable');
  } finally {
    await o2.close();
  }
});

test('reset empties everything and switches every fault off; every call is listed newest first', async () => {
  const o = await start();
  try {
    await o.call('POST', '/crm/contacts', { name: 'Maya Rivers', email: 'maya.rivers@example.com' }, BADGE);
    await o.call('POST', '/faults', { crm: 'fail', ai: 'invent' });
    let s = (await o.call('GET', '/api/state')).json;
    assert.equal(s.calls[0].path, '/faults');
    assert.equal(s.calls[1].path, '/crm/contacts');
    await o.call('POST', '/reset', {});
    s = (await o.call('GET', '/api/state')).json;
    assert.deepEqual(s.contacts, []);
    assert.deepEqual(s.faults, { crm: 'off', ai: 'off' });
    assert.equal(s.calls.length, 1);
    assert.equal(s.calls[0].path, '/reset');
    const r = await o.call('POST', '/crm/contacts', { name: 'Maya Rivers', email: 'maya.rivers@example.com' }, BADGE);
    assert.equal(r.json.id, 'C1', 'ids start again after a reset');
  } finally {
    await o.close();
  }
});

test('a body that is not one JSON object is refused, and so is one that is too large', async () => {
  const o = await start();
  try {
    assert.equal((await o.call('POST', '/alerts', 'not json')).status, 400);
    assert.equal((await o.call('POST', '/alerts', '[1,2]')).status, 400);
    const big = JSON.stringify({ step: 'x'.repeat(200 * 1024) });
    const r = await fetch(o.base + '/alerts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: big }).catch((e) => ({ status: 'closed', e }));
    assert.ok(r.status === 413 || r.status === 'closed', 'a large body is refused');
  } finally {
    await o.close();
  }
});

// ---------- the pages ----------

test('the three pages are served with a content security policy and load nothing from elsewhere', async () => {
  const o = await start();
  try {
    for (const p of ['/', '/form', '/inbox']) {
      const r = await o.call('GET', p);
      assert.equal(r.status, 200);
      assert.match(r.headers.get('content-type'), /text\/html/);
      assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
      assert.doesNotMatch(r.text, /<(script|link|img|iframe)[^>]+(src|href)=["']?https?:/i, p + ' loads nothing from another site');
      assert.match(r.text, /<html lang="en">/);
    }
    assert.match((await o.call('GET', '/')).text, /stand-in that is not a model/);
    assert.equal((await o.call('GET', '/nowhere')).status, 404);
  } finally {
    await o.close();
  }
});

test('started on its own, the office listens on 127.0.0.1 only', async () => {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: Object.assign({}, process.env, { PORT: '0', HOST: '' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const line = await new Promise((resolve, reject) => {
      let out = '';
      child.stdout.on('data', (c) => {
        out += c;
        if (out.includes('\n')) resolve(out);
      });
      child.on('exit', () => reject(new Error('the office exited: ' + out)));
      setTimeout(() => reject(new Error('no start line')), 5000);
    });
    assert.match(line, /^The practice office is open on http:\/\/127\.0\.0\.1:\d+\n$/);
  } finally {
    child.kill();
  }
});
