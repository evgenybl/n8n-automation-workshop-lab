'use strict';
// Temporary: drives the experiment flows in CI and prints what n8n really did. Exit 0 always; the log is the result.
const N8N = 'http://127.0.0.1:5678';
const OFFICE = 'http://127.0.0.1:3333';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

async function call(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await r.text();
  return { status: r.status, text };
}
const hook = (p, body) => call('POST', N8N + '/webhook/' + p, body);
const state = async () => JSON.parse((await call('GET', OFFICE + '/api/state')).text);
const reset = () => call('POST', OFFICE + '/reset', {});
const faults = (f) => call('POST', OFFICE + '/faults', f);

function report(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PROVEN  ' : 'NOT YET ') + name + (detail ? '\n        ' + detail.replace(/\n/g, '\n        ') : ''));
}

async function waitForHook(p) {
  for (let i = 0; i < 30; i++) {
    const r = await call('GET', N8N + '/webhook/' + p);
    if (i === 0) console.log('GET /webhook/' + p + ' -> ' + r.status + ' ' + r.text.slice(0, 200));
    if (r.status !== 404 || !/not registered/i.test(r.text) || /POST/.test(r.text)) return r;
    await sleep(1000);
  }
  return null;
}

const maya = { name: 'Maya Rivers', email: 'maya.rivers@example.com', message: 'How much would 12 seats cost in March?', consent: true, website: '' };

async function main() {
  console.log('GET /webhook/no-such-path -> ' + JSON.stringify(await call('GET', N8N + '/webhook/no-such-path')));
  console.log('POST /webhook/no-such-path -> ' + JSON.stringify(await hook('no-such-path', {})));
  for (const p of ['x-validate', 'x-crm', 'x-error', 'x-approve', 'x-approve-first', 'x-code', 'x-continue']) await waitForHook(p);

  // E1
  {
    const good = await hook('x-validate', maya);
    const noMail = await hook('x-validate', Object.assign({}, maya, { email: '' }));
    const missingMail = await hook('x-validate', { name: 'Tom Ash', consent: true });
    const noConsent = await hook('x-validate', Object.assign({}, maya, { consent: false }));
    const missingConsent = await hook('x-validate', { name: 'Tom Ash', email: 'tom.ash@example.com' });
    const robot = await hook('x-validate', Object.assign({}, maya, { website: 'http://robot.example.com' }));
    const missingHoney = await hook('x-validate', { name: 'Tom Ash', email: 'tom.ash@example.com', consent: true });
    const all = { good, noMail, missingMail, noConsent, missingConsent, robot, missingHoney };
    report('E1 If nodes + Respond with status', good.status === 200 && noMail.status === 400 && noConsent.status === 400 && robot.status === 400, JSON.stringify(all, null, 1));
  }

  // E2
  {
    await reset();
    const a = await hook('x-crm', maya);
    const b = await hook('x-crm', maya);
    const s = await state();
    report('E2 HTTP Request to office by service name; lookup then create or note',
      s.contacts.length === 1 && s.contacts[0].notes.length === 2,
      JSON.stringify({ a, b, contacts: s.contacts, calls: s.calls.map((c) => c.method + ' ' + c.path + ' ' + c.status + ' ' + c.detail) }, null, 1));
  }

  // E3
  {
    await reset();
    await faults({ crm: 'fail' });
    const failed = await hook('x-error', maya);
    let s = await state();
    report('E3 error output on fail', failed.status === 502 && s.alerts.length === 1 && s.contacts.length === 0,
      JSON.stringify({ failed, alerts: s.alerts }, null, 1));
    await reset();
    await faults({ crm: 'slow' });
    const t0 = Date.now();
    const slow = await hook('x-error', maya);
    const took = Date.now() - t0;
    await sleep(500);
    s = await state();
    report('E3 error output on timeout', slow.status === 502 && s.contacts.length === 0,
      JSON.stringify({ slow, took, alerts: s.alerts, calls: s.calls.slice(0, 4) }, null, 1));
    await reset();
    const ok = await hook('x-error', maya);
    report('E3 success path', ok.status === 200, JSON.stringify(ok));
  }

  // E4
  for (const p of ['x-approve', 'x-approve-first']) {
    await reset();
    const first = await hook(p, maya);
    await sleep(1500);
    let s = await state();
    const waiting = s.approvals[0];
    console.log(p + ' first answer ' + JSON.stringify(first) + '\n approval ' + JSON.stringify(waiting));
    if (!waiting) {
      report(p + ' approval reached the inbox', false, JSON.stringify(s.calls.slice(0, 5)));
      continue;
    }
    const nothingYet = s.contacts.length === 0;
    const dec = await call('POST', OFFICE + '/inbox/' + waiting.id + '/approve', {});
    await sleep(1500);
    s = await state();
    report(p + ' wait + resume on approve', first.status === 202 && nothingYet && s.contacts.length === 1,
      JSON.stringify({ decision: JSON.parse(dec.text).approval.answer, contacts: s.contacts, calls: s.calls.slice(0, 6) }, null, 1));
    await reset();
    await hook(p, Object.assign({}, maya, { email: 'tom.ash@example.com', name: 'Tom Ash' }));
    await sleep(1500);
    s = await state();
    const w2 = s.approvals[0];
    const dec2 = w2 ? await call('POST', OFFICE + '/inbox/' + w2.id + '/reject', {}) : { text: '{}' };
    await sleep(1500);
    s = await state();
    report(p + ' wait + resume on reject', s.contacts.length === 0, JSON.stringify({ decision: w2 && JSON.parse(dec2.text).approval.answer }, null, 1));
  }

  // E5
  {
    await reset();
    const normal = await hook('x-code', maya);
    await faults({ ai: 'invent' });
    const invented = await hook('x-code', maya);
    report('E5 Code node compares figures', /"summaryUsed":true/.test(normal.text) && /"summaryUsed":false/.test(invented.text),
      JSON.stringify({ normal, invented }, null, 1));
  }

  // E6
  {
    await reset();
    const r = await hook('x-continue', maya);
    const s = await state();
    report('E6 On Error Continue passes the failure on', r.status === 200, JSON.stringify({ r, calls: s.calls.slice(0, 3) }, null, 1));
  }

  console.log('\nexperiments not yet proven: ' + failures);
}

main().catch((e) => {
  console.log('the runner failed: ' + (e.stack || e.message));
});
