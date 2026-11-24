'use strict';
// The scenario tests: they drive every published workflow through its webhook and read the practice office's state.
// They need n8n and the office running (docker compose up -d) and every workflow loaded (node tools/load.js), so they
// run only when LAB_LIVE=1. CI runs them on Linux; on a computer without the lab running they are skipped.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const LIVE = process.env.LAB_LIVE === '1';
const N8N = (process.env.N8N_URL || 'http://127.0.0.1:5678').replace(/\/+$/, '');
const OFFICE = (process.env.OFFICE_URL || 'http://127.0.0.1:3333').replace(/\/+$/, '');
const live = { skip: LIVE ? false : 'needs the lab running and LAB_LIVE=1 (CI runs these)' };

// Every person here is invented; every address is at example.com.
const MAYA = {
  name: 'Maya Rivers',
  email: 'maya.rivers@example.com',
  company: 'Rivers Pottery (invented)',
  message: 'Hello, how much would 12 workshop seats cost for our team in March?',
  consent: true,
  website: '',
};
const TOM = {
  name: 'Tom Ash',
  email: 'tom.ash@example.com',
  company: 'Ash and Oak Joinery (invented)',
  message: 'Could we book a visit next week to talk about 3 new desks?',
  consent: true,
  website: '',
};

async function call(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    // not JSON
  }
  return { status: r.status, text, json };
}
const post = (p, body) => call('POST', N8N + '/webhook/' + p, body);
const state = async () => (await call('GET', OFFICE + '/api/state')).json;
const reset = () => call('POST', OFFICE + '/reset', {});
const fault = (f) => call('POST', OFFICE + '/faults', f);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function decide(decision) {
  const s = await state();
  const waiting = s.approvals.find((a) => a.status === 'waiting');
  assert.ok(waiting, 'an approval is waiting in the inbox');
  const r = await call('POST', OFFICE + '/inbox/' + waiting.id + '/' + decision, {});
  assert.equal(r.status, 200, 'the inbox took the decision: ' + r.text);
  return r.json.approval.answer;
}

// Sends an enquiry. A flow with an approval answers 202 first; then a person decides in the inbox, and the answer that
// counts is the one n8n gives to that decision.
async function submit(p, enquiry, approval, decision) {
  const first = await post(p, enquiry);
  if (!approval) return first;
  assert.equal(first.status, 202, 'a flow with an approval answers 202 first: ' + first.text);
  assert.equal(first.json.status, 'waiting for approval');
  const answer = await decide(decision || 'approve');
  return { status: answer.status, json: typeof answer.body === 'object' ? answer.body : null, text: JSON.stringify(answer.body) };
}

function notes(s) {
  return s.contacts.flatMap((c) => c.notes.map((n) => n.text));
}

function compose(args) {
  return execFileSync('docker', ['compose', ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// ---------- the checks of each stage ----------

async function checkStarter1(t, p) {
  await reset();
  const r = await post(p, MAYA);
  t.diagnostic('stage 1 starter answered ' + r.status + ' ' + r.text);
  assert.equal(r.status, 200);
  assert.match(r.text, /started/i, 'n8n answers at once with its own message');
  assert.doesNotMatch(r.text, /Maya/, 'the starter does not yet answer with the name');
}

async function checkName(t, p) {
  await reset();
  const r = await post(p, MAYA);
  t.diagnostic('answered ' + r.status + ' ' + r.text);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { status: 'received', name: 'Maya Rivers' });
}

async function checkRefusals(t, p) {
  await reset();
  const cases = [
    [Object.assign({}, MAYA, { email: '' }), /no e-mail/],
    [Object.assign({}, MAYA, { email: undefined }), /no e-mail/],
    [Object.assign({}, MAYA, { website: 'http://robot.example.com' }), /robot/],
    [Object.assign({}, MAYA, { consent: false }), /agree to be contacted/],
    [Object.assign({}, MAYA, { consent: undefined }), /agree to be contacted/],
  ];
  for (const [enquiry, reason] of cases) {
    const r = await post(p, enquiry);
    t.diagnostic('refused ' + r.status + ' ' + r.text);
    assert.equal(r.status, 400, 'a bad enquiry is refused with 400');
    assert.equal(r.json.status, 'refused');
    assert.match(r.json.reason, reason);
  }
  const s = await state();
  const reached = s.calls.filter((c) => ['CRM', 'AI step', 'Inbox'].includes(c.service));
  assert.equal(reached.length, 0, 'a refused enquiry reaches nothing: no CRM, no AI step, no inbox');
}

async function checkNoDuplicates(t, p, approval) {
  await reset();
  const first = await submit(p, MAYA, approval);
  const second = await submit(p, MAYA, approval);
  t.diagnostic('first ' + first.status + ' ' + first.text + '; second ' + second.status + ' ' + second.text);
  for (const r of [first, second]) {
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { status: 'recorded', contact: 'C1' });
  }
  const s = await state();
  assert.equal(s.contacts.length, 1, 'the same enquiry twice leaves one contact');
  assert.equal(s.contacts[0].notes.length, 2, '... and two notes');
}

async function checkAi(t, p, approval) {
  await reset();
  await submit(p, MAYA, approval);
  let s = await state();
  t.diagnostic('note with the AI step working: ' + JSON.stringify(notes(s)[0]));
  assert.match(notes(s)[0], /AI summary \(checked\): Maya Rivers asks for a price/);
  await reset();
  await fault({ ai: 'invent' });
  await submit(p, MAYA, approval);
  s = await state();
  t.diagnostic('note with the AI step inventing a figure: ' + JSON.stringify(notes(s)[0]));
  assert.match(notes(s)[0], /AI summary not used: it gives figures that are not in the enquiry \(4800\)/);
  assert.doesNotMatch(notes(s)[0], /The budget is/, 'the invented sentence is not in the note');
}

async function checkApproval(t, p) {
  await reset();
  const first = await post(p, MAYA);
  t.diagnostic('first answer ' + first.status + ' ' + first.text);
  assert.equal(first.status, 202);
  assert.deepEqual(first.json, { status: 'waiting for approval', approval: 'A1' });
  let s = await state();
  assert.equal(s.contacts.length, 0, 'before a decision nothing is written');
  assert.equal(s.approvals[0].status, 'waiting');
  assert.match(s.approvals[0].resumeUrl, /\/webhook-waiting\/\d+\?signature=/, 'the flow handed over its resume address');
  const rejected = await decide('reject');
  t.diagnostic('answer to Reject ' + rejected.status + ' ' + JSON.stringify(rejected.body));
  assert.equal(rejected.status, 200);
  assert.deepEqual(rejected.body, { status: 'rejected', written: 'nothing' });
  s = await state();
  assert.equal(s.contacts.length, 0, 'after Reject nothing is written');
  const second = await submit(p, TOM, true, 'approve');
  t.diagnostic('answer to Approve ' + second.status + ' ' + second.text);
  s = await state();
  assert.equal(second.status, 200);
  assert.equal(s.contacts.length, 1, 'after Approve the contact exists');
  assert.equal(s.contacts[0].email, TOM.email);
}

async function checkFailures(t, p) {
  const cases = [
    ['fail', 'Look up the contact', /500/],
    ['slow', 'Look up the contact', /timeout/],
    ['wrong', 'Write to the CRM', /did not confirm/],
  ];
  for (const [mode, step, reason] of cases) {
    await reset();
    await fault({ crm: mode });
    const r = await submit(p, MAYA, true);
    const s = await state();
    t.diagnostic('CRM ' + mode + ': answer ' + r.status + ' ' + r.text + '; alert ' + JSON.stringify(s.alerts[0] && { step: s.alerts[0].step, reason: s.alerts[0].reason }));
    assert.equal(r.status, 502, 'the answer says it failed');
    assert.equal(r.json.status, 'failed');
    assert.equal(r.json.step, step);
    assert.equal(r.json.written, 'nothing');
    assert.equal(s.alerts.length, 1, 'the office window shows the failure');
    assert.equal(s.alerts[0].step, step);
    assert.match(s.alerts[0].reason, reason);
    assert.equal(s.contacts.length, 0, 'nothing is half-written');
  }
  await reset();
  const ok = await submit(p, MAYA, true);
  assert.equal(ok.status, 200, 'with the CRM working again, the same flow records the enquiry');
}

// ---------- every workflow file, and what CI checks for it ----------

const SCENARIOS = {
  'stage-1-starter.json': (t, p) => checkStarter1(t, p),
  'stage-1-solution.json': (t, p) => checkName(t, p),
  'stage-2-starter.json': (t, p) => checkName(t, p),
  'stage-2-solution.json': async (t, p) => {
    await checkName(t, p);
    await checkRefusals(t, p);
  },
  'stage-3-starter.json': async (t, p) => {
    await checkName(t, p);
    await checkRefusals(t, p);
  },
  'stage-3-solution.json': async (t, p) => {
    await checkRefusals(t, p);
    await checkNoDuplicates(t, p, false);
  },
  'stage-4-starter.json': async (t, p) => {
    await checkRefusals(t, p);
    await checkNoDuplicates(t, p, false);
  },
  'stage-4-solution.json': async (t, p) => {
    await checkRefusals(t, p);
    await checkNoDuplicates(t, p, false);
    await checkAi(t, p, false);
  },
  'stage-5-starter.json': async (t, p) => {
    await checkRefusals(t, p);
    await checkNoDuplicates(t, p, false);
    await checkAi(t, p, false);
  },
  'stage-5-solution.json': async (t, p) => {
    await checkRefusals(t, p);
    await checkApproval(t, p);
    await checkNoDuplicates(t, p, true);
    await checkAi(t, p, true);
  },
  'stage-6-starter.json': async (t, p) => {
    await checkRefusals(t, p);
    await checkApproval(t, p);
    await checkNoDuplicates(t, p, true);
    await checkAi(t, p, true);
  },
  'stage-6-solution.json': async (t, p) => {
    await checkRefusals(t, p);
    await checkApproval(t, p);
    await checkNoDuplicates(t, p, true);
    await checkAi(t, p, true);
    await checkFailures(t, p);
  },

  // Repair A: the form sends to repair-a; the broken file listens at repiar-a.
  'repair-a-broken.json': async (t, p) => {
    const fixedId = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', 'repair-a-fixed.json'), 'utf8')).id;
    await reset();
    compose(['exec', '-T', 'n8n', 'n8n', 'unpublish:workflow', '--id=' + fixedId]);
    try {
      let r;
      for (let i = 0; i < 30; i++) {
        r = await post('repair-a', MAYA);
        if (r.status === 404) break;
        await sleep(1000);
      }
      t.diagnostic('with only the broken flow published, the form path answered ' + r.status + ' ' + r.text);
      assert.equal(r.status, 404, 'the form path answers 404: nothing listens there');
      const s = await state();
      assert.equal(s.contacts.length, 0, 'nothing happens');
      const elsewhere = await post(p, MAYA);
      assert.equal(elsewhere.status, 200, 'the broken flow itself works, at the misspelt path ' + p);
    } finally {
      compose(['exec', '-T', 'n8n', 'n8n', 'publish:workflow', '--id=' + fixedId]);
    }
  },
  'repair-a-fixed.json': async (t, p) => {
    assert.equal(p, 'repair-a', 'the repaired flow listens at the path the form sends to');
    await reset();
    let r;
    for (let i = 0; i < 30; i++) {
      r = await post(p, MAYA);
      if (r.status !== 404) break;
      await sleep(1000);
    }
    t.diagnostic('the form path answered ' + r.status + ' ' + r.text);
    assert.equal(r.status, 200);
    assert.equal(r.json.status, 'recorded');
  },

  // Repair B: the lookup by name misses a known person who writes their name differently.
  'repair-b-broken.json': async (t, p) => {
    await reset();
    const first = await post(p, MAYA);
    const second = await post(p, Object.assign({}, MAYA, { name: 'M. Rivers' }));
    const s = await state();
    t.diagnostic('first ' + first.status + ' ' + first.text + '; second ' + second.status + ' ' + second.text);
    assert.equal(first.status, 200);
    assert.equal(second.status, 500, 'the second enquiry from a known person crashes');
    assert.ok(s.calls.some((c) => c.status === 409), 'the CRM refused a second contact with 409');
    assert.equal(s.contacts.length, 1);
    assert.equal(s.contacts[0].notes.length, 1, 'the second enquiry left no note');
  },
  'repair-b-fixed.json': async (t, p) => {
    await reset();
    await post(p, MAYA);
    const second = await post(p, Object.assign({}, MAYA, { name: 'M. Rivers' }));
    const s = await state();
    t.diagnostic('second ' + second.status + ' ' + second.text);
    assert.equal(second.status, 200);
    assert.equal(s.contacts.length, 1);
    assert.equal(s.contacts[0].notes.length, 2, 'the repaired flow adds a note');
  },

  // Repair C: the approval check reads the wrong field.
  'repair-c-broken.json': async (t, p) => {
    await reset();
    const r = await submit(p, MAYA, true, 'reject');
    const s = await state();
    t.diagnostic('answer to Reject ' + r.status + ' ' + r.text + '; contacts ' + s.contacts.length);
    assert.equal(s.contacts.length, 1, 'a rejected enquiry is written anyway');
  },
  'repair-c-fixed.json': async (t, p) => {
    await reset();
    const r = await submit(p, MAYA, true, 'reject');
    let s = await state();
    t.diagnostic('answer to Reject ' + r.status + ' ' + r.text);
    assert.equal(s.contacts.length, 0, 'after Reject the repaired flow writes nothing');
    await submit(p, MAYA, true, 'approve');
    s = await state();
    assert.equal(s.contacts.length, 1, 'after Approve it writes');
  },

  // Repair D: the note call has no header and its failure is passed on as a result.
  'repair-d-broken.json': async (t, p) => {
    await reset();
    await post(p, MAYA);
    const second = await post(p, MAYA);
    const s = await state();
    t.diagnostic('second ' + second.status + ' ' + second.text);
    assert.equal(second.status, 200, 'the flow says it is done');
    assert.equal(second.json.status, 'recorded');
    assert.equal(s.contacts[0].notes.length, 1, 'but no note was added');
    assert.ok(s.calls.some((c) => c.status === 401), 'the CRM refused the call with no header: 401');
  },
  'repair-d-fixed.json': async (t, p) => {
    await reset();
    await post(p, MAYA);
    const second = await post(p, MAYA);
    let s = await state();
    assert.equal(second.status, 200);
    assert.equal(s.contacts[0].notes.length, 2, 'the note is added');
    await reset();
    await fault({ crm: 'fail' });
    const failed = await post(p, MAYA);
    s = await state();
    t.diagnostic('with the CRM failing ' + failed.status + ' ' + failed.text);
    assert.equal(failed.status, 502, 'a failure is visible in the answer');
    assert.equal(s.alerts.length, 1, 'and in the office window');
  },

  // The practical check G: the note uses the AI summary as it came.
  'check-g-broken.json': async (t, p) => {
    await reset();
    await fault({ ai: 'invent' });
    await post(p, MAYA);
    const s = await state();
    t.diagnostic('note ' + JSON.stringify(notes(s)[0]));
    assert.match(notes(s)[0], /The budget is 4800/, 'the note carries a figure nobody wrote');
  },
  'check-g-fixed.json': async (t, p) => {
    await reset();
    await fault({ ai: 'invent' });
    await post(p, MAYA);
    const s = await state();
    assert.doesNotMatch(notes(s)[0], /The budget is/);
    assert.match(notes(s)[0], /AI summary not used/);
  },
};

function webhookPath(file) {
  const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', file), 'utf8'));
  return wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook').parameters.path;
}

test('every workflow file in workflows/ has a scenario here, and every scenario a file', () => {
  const files = fs.readdirSync(path.join(ROOT, 'workflows')).filter((f) => f.endsWith('.json')).sort();
  assert.deepEqual(Object.keys(SCENARIOS).sort(), files);
});

test('the office reaches n8n by its service name, and says so', live, async (t) => {
  const r = await call('GET', OFFICE + '/api/check');
  t.diagnostic('GET /api/check ' + r.status + ' ' + r.text);
  assert.equal(r.status, 200);
  assert.equal(r.json.n8n, 'ready');
});

test('the lead form hands an enquiry to a live flow and shows its answer', live, async (t) => {
  await reset();
  const r = await call('POST', OFFICE + '/form/send', { path: 'stage-1-solution', mode: 'live', enquiry: MAYA });
  t.diagnostic('form, live: ' + r.text);
  assert.equal(r.json.status, 200);
  assert.match(r.json.body, /Maya Rivers/);
  const test404 = await call('POST', OFFICE + '/form/send', { path: 'stage-1-solution', mode: 'test', enquiry: MAYA });
  t.diagnostic('form, test address with nobody listening: ' + test404.text);
  assert.equal(test404.json.status, 404);
});

for (const [file, scenario] of Object.entries(SCENARIOS)) {
  test(file + ' (webhook ' + (LIVE ? webhookPath(file) : 'path') + ')', live, async (t) => {
    await scenario(t, webhookPath(file));
  });
}

test('the README\'s "Try it" command gives the output the README shows', live, async (t) => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const m = readme.match(/<!-- try-it:command -->\s*```(?:bash)?\n([\s\S]*?)```\s*<!-- try-it:output -->\s*```(?:text)?\n([\s\S]*?)```/);
  assert.ok(m, 'the README marks its command and its output');
  const commands = m[1].trim().split('\n').filter((l) => l.startsWith('curl '));
  assert.equal(commands.length, 1, 'one curl command');
  await reset();
  const out = execFileSync('bash', ['-c', commands[0]], { cwd: ROOT, encoding: 'utf8' });
  t.diagnostic('the command printed: ' + out);
  assert.equal(out.trim(), m[2].trim());
});
