'use strict';
// The practice office: a lead form, a practice CRM, a practice AI step (a stand-in that is not a model),
// an approval inbox, an office window, and faults on request. One program, Node's built-in modules only.
// It keeps everything in memory; POST /reset (or the button in the office window) empties it.
//
// Start it alone:      node practice/server.js            (listens on 127.0.0.1:3333)
// Settings (environment variables): HOST (default 127.0.0.1), PORT (default 3333),
// N8N_URL (where n8n is, default http://127.0.0.1:5678; the compose file sets http://n8n:5678).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// The practice CRM only answers a caller that shows this header. It is a practice value printed in the
// lab guide, not a secret: the point is to see what happens when a call does not carry it.
const BADGE_HEADER = 'x-office-badge';
const BADGE_VALUE = 'practice-badge';

const CRM_FAULTS = ['off', 'fail', 'slow', 'wrong'];
const AI_FAULTS = ['off', 'invent'];
const SLOW_MS_DEFAULT = 15000;
const MAX_BODY = 100 * 1024;
const MAX_CALLS = 300;

function freshState() {
  return {
    contacts: [],
    approvals: [],
    alerts: [],
    calls: [],
    faults: { crm: 'off', ai: 'off' },
    next: { contact: 1, note: 1, approval: 1, alert: 1, call: 1 },
  };
}

// ---------- the practice AI step: rules, the same answer every time ----------

const FIGURE = /\d+(?:[.,]\d+)*/g;

function figuresIn(text) {
  return (String(text || '').match(FIGURE) || []).map((f) => f.replace(/,/g, ''));
}

function intentOf(message) {
  const m = String(message || '').toLowerCase();
  if (/\b(price|prices|quote|cost|costs|how much)\b/.test(m)) return 'asks for a price';
  if (/\b(book|booking|appointment|visit|meeting)\b/.test(m)) return 'wants an appointment';
  if (/\b(broken|late|problem|complaint|wrong)\b/.test(m)) return 'reports a problem';
  return 'general question';
}

function firstSentence(message) {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const end = text.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? text : text.slice(0, end + 1);
  return sentence.length > 160 ? sentence.slice(0, 157) + '...' : sentence;
}

function inventedFigure(message) {
  const present = new Set(figuresIn(message));
  for (const candidate of ['4800', '7350', '9120', '6475']) {
    if (!present.has(candidate)) return candidate;
  }
  return '8888';
}

function aiRead(input, fault) {
  const name = String(input.name || 'The sender').trim() || 'The sender';
  const firstName = name.split(/\s+/)[0];
  const message = String(input.message || '');
  const intent = intentOf(message);
  const sentence = firstSentence(message) || '(the message is empty)';
  let summary = name + ' ' + (intent === 'general question' ? 'asks a general question' : intent) + '. The message begins: ' + sentence;
  if (fault === 'invent') {
    summary += ' The budget is ' + inventedFigure(message) + '.';
  }
  const reply =
    'Hello ' + firstName + ', thank you for your message. We have received it and a person will reply to you.';
  return {
    summary,
    intent,
    reply_draft: reply,
    about: 'A stand-in that is not a model: it answers from fixed rules, the same way every time.',
  };
}

// ---------- helpers ----------

function nowIso() {
  return new Date().toISOString();
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('The body is too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseJson(text) {
  if (!text.trim()) return {};
  const value = JSON.parse(text);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The body must be one JSON object.');
  }
  return value;
}

function clean(value, max) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max || 2000);
}

function delay(ms, req) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), ms);
    // A caller that gives up while the CRM is slow: the CRM notices and does not write.
    req.socket.once('close', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

function contactView(c) {
  return { id: c.id, name: c.name, email: c.email, company: c.company, notes: c.notes.length };
}

// ---------- the office ----------

function createOffice(options) {
  const opts = options || {};
  const n8nUrl = String(opts.n8nUrl || process.env.N8N_URL || 'http://127.0.0.1:5678').replace(/\/+$/, '');
  const slowMs = Number(opts.slowMs || process.env.OFFICE_SLOW_MS || SLOW_MS_DEFAULT);
  const pagesDir = path.join(__dirname, 'pages');
  let state = freshState();

  function logCall(entry) {
    state.calls.unshift(Object.assign({ id: state.next.call++, at: nowIso() }, entry));
    if (state.calls.length > MAX_CALLS) state.calls.length = MAX_CALLS;
  }

  function page(res, file) {
    const html = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
    });
    res.end(html);
  }

  function findByEmail(email) {
    const key = clean(email, 320).toLowerCase();
    return state.contacts.find((c) => c.email.toLowerCase() === key);
  }

  // Each CRM handler returns [status, body]; the CRM faults are applied around it.
  async function crm(req, url, body) {
    const badge = req.headers[BADGE_HEADER];
    if (badge !== BADGE_VALUE) {
      return [401, { error: 'The practice CRM needs the header X-Office-Badge: practice-badge. This call did not carry it, so nothing was read or written.' }];
    }
    const fault = state.faults.crm;
    if (fault === 'fail') {
      return [500, { error: 'The practice CRM was told to fail. Nothing was read or written.' }];
    }
    if (fault === 'wrong') {
      return [200, { ok: false, error: 'The practice CRM was told to answer wrongly: it says 200 but did nothing.' }];
    }
    if (fault === 'slow') {
      const stillThere = await delay(slowMs, req);
      if (!stillThere) {
        return [0, { error: 'The caller hung up while the practice CRM was slow. Nothing was written.' }];
      }
    }

    const parts = url.pathname.split('/').filter(Boolean); // ['crm', 'contacts', id?, 'notes'?]
    if (parts.length === 2 && req.method === 'GET') {
      const email = url.searchParams.get('email');
      const name = url.searchParams.get('name');
      if (email === null && name === null) {
        return [400, { error: 'Look a contact up by ?email= (or ?name=).' }];
      }
      let found;
      if (email !== null) found = findByEmail(email);
      else found = state.contacts.find((c) => c.name === clean(name, 200));
      return [200, found ? { found: true, contact: contactView(found) } : { found: false }];
    }
    if (parts.length === 2 && req.method === 'POST') {
      const name = clean(body.name, 200);
      const email = clean(body.email, 320);
      if (!email || !email.includes('@')) return [400, { error: 'A contact needs an e-mail address.' }];
      const existing = findByEmail(email);
      if (existing) {
        return [409, { error: 'A contact with this e-mail already exists. Add a note to it instead.', id: existing.id }];
      }
      const contact = {
        id: 'C' + state.next.contact++,
        name: name || '(no name)',
        email,
        company: clean(body.company, 200),
        createdAt: nowIso(),
        notes: [],
      };
      const firstNote = clean(body.note, 4000);
      if (firstNote) contact.notes.push({ id: 'N' + state.next.note++, text: firstNote, at: nowIso() });
      state.contacts.push(contact);
      return [201, Object.assign(contactView(contact), { created: true })];
    }
    if (parts.length === 4 && parts[3] === 'notes' && req.method === 'POST') {
      const contact = state.contacts.find((c) => c.id === parts[2]);
      if (!contact) return [404, { error: 'No contact with the id ' + parts[2] + '.' }];
      const text = clean(body.text, 4000);
      if (!text) return [400, { error: 'A note needs some text.' }];
      const note = { id: 'N' + state.next.note++, text, at: nowIso() };
      contact.notes.push(note);
      return [201, { id: note.id, contact: contact.id, notes: contact.notes.length }];
    }
    return [404, { error: 'The practice CRM has no such address.' }];
  }

  async function resumeFlow(approval, decision) {
    // n8n hands out its resume address as it sees itself (for example http://localhost:5678/webhook-waiting/...).
    // The office keeps the path and the query and sends it to the n8n it can reach (N8N_URL).
    let target;
    try {
      const given = new URL(approval.resumeUrl);
      target = n8nUrl + given.pathname + given.search;
    } catch (e) {
      return { status: 0, body: 'The resume address is not an address: ' + approval.resumeUrl };
    }
    try {
      const r = await fetch(target, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, decidedBy: 'the approval inbox', approval: approval.id }),
        signal: AbortSignal.timeout(30000),
      });
      const text = await r.text();
      let parsed = text;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // keep the text
      }
      return { status: r.status, body: parsed, sentTo: target };
    } catch (e) {
      return { status: 0, body: 'The office could not reach n8n at ' + target + ': ' + e.message, sentTo: target };
    }
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://office.local');
    const p = url.pathname.replace(/\/+$/, '') || '/';
    let raw = '';
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      raw = await readBody(req);
      try {
        body = parseJson(raw);
      } catch (e) {
        logCall({ method: req.method, path: p, status: 400, detail: 'The body was not one JSON object.' });
        return sendJson(res, 400, { error: 'The body must be one JSON object.' });
      }
    }

    // Pages
    if (req.method === 'GET' && p === '/') return page(res, 'window.html');
    if (req.method === 'GET' && p === '/form') return page(res, 'form.html');
    if (req.method === 'GET' && p === '/inbox') return page(res, 'inbox.html');
    if (req.method === 'GET' && p === '/health') return sendJson(res, 200, { ok: true });
    if (req.method === 'GET' && p === '/api/state') {
      return sendJson(res, 200, {
        contacts: state.contacts,
        approvals: state.approvals,
        alerts: state.alerts,
        calls: state.calls,
        faults: state.faults,
      });
    }

    // The practice CRM
    if (p === '/crm/contacts' || p.startsWith('/crm/contacts/')) {
      const [status, answer] = await crm(req, url, body);
      const detail = status === 0 ? answer.error : summarise(p, req.method, status, body, answer, url);
      logCall({ method: req.method, path: p + (url.search || ''), status, detail, service: 'CRM' });
      if (status === 0) return; // the caller is gone
      return sendJson(res, status, answer);
    }

    // The practice AI step
    if (req.method === 'POST' && p === '/ai/read') {
      const answer = aiRead(body, state.faults.ai);
      logCall({
        method: 'POST',
        path: p,
        status: 200,
        service: 'AI step',
        detail: state.faults.ai === 'invent' ? 'Answered, with an invented figure (fault on).' : 'Answered.',
      });
      return sendJson(res, 200, answer);
    }

    // The approval inbox
    if (req.method === 'POST' && p === '/inbox') {
      const resumeUrl = clean(body.resumeUrl, 2000);
      if (!/^https?:\/\//.test(resumeUrl)) {
        logCall({ method: 'POST', path: p, status: 400, service: 'Inbox', detail: 'No resume address in the request.' });
        return sendJson(res, 400, { error: 'An approval request needs resumeUrl: the address n8n gives for resuming.' });
      }
      const approval = {
        id: 'A' + state.next.approval++,
        name: clean(body.name, 200),
        email: clean(body.email, 320),
        message: clean(body.message, 4000),
        summary: clean(body.summary, 2000),
        resumeUrl,
        status: 'waiting',
        receivedAt: nowIso(),
        decidedAt: null,
        answer: null,
      };
      state.approvals.unshift(approval);
      logCall({ method: 'POST', path: p, status: 201, service: 'Inbox', detail: 'Waiting for a person: ' + approval.id + '.' });
      return sendJson(res, 201, { id: approval.id, status: 'waiting' });
    }
    const decide = p.match(/^\/inbox\/(A\d+)\/(approve|reject)$/);
    if (req.method === 'POST' && decide) {
      const approval = state.approvals.find((a) => a.id === decide[1]);
      if (!approval) return sendJson(res, 404, { error: 'No approval ' + decide[1] + '.' });
      if (approval.status !== 'waiting') {
        return sendJson(res, 409, { error: 'Already decided: ' + approval.status + '.', approval });
      }
      const decision = decide[2];
      approval.status = decision === 'approve' ? 'approved' : 'rejected';
      approval.decidedAt = nowIso();
      const answer = await resumeFlow(approval, decision);
      approval.answer = answer;
      if (answer.status === 0) {
        // n8n could not be reached: the flow is still waiting, so the decision can be made again.
        approval.status = 'waiting';
        approval.decidedAt = null;
      }
      logCall({
        method: 'POST',
        path: p,
        status: answer.status,
        service: 'Inbox',
        detail: 'A person chose ' + decision + '; n8n answered ' + (answer.status || 'nothing') + '.',
      });
      return sendJson(res, 200, { approval });
    }

    // Failures a flow reports
    if (req.method === 'POST' && p === '/alerts') {
      const alert = {
        id: 'F' + state.next.alert++,
        at: nowIso(),
        step: clean(body.step, 200) || '(no step named)',
        reason: clean(body.reason, 2000) || '(no reason given)',
        email: clean(body.email, 320),
        detail: clean(body.detail, 2000),
      };
      state.alerts.unshift(alert);
      logCall({ method: 'POST', path: p, status: 201, service: 'Alerts', detail: alert.step + ': ' + alert.reason });
      return sendJson(res, 201, alert);
    }

    // Faults on request
    if (p === '/faults') {
      if (req.method === 'GET') return sendJson(res, 200, state.faults);
      if (req.method === 'POST') {
        if (body.crm !== undefined && !CRM_FAULTS.includes(body.crm)) {
          return sendJson(res, 400, { error: 'crm must be one of ' + CRM_FAULTS.join(', ') + '.' });
        }
        if (body.ai !== undefined && !AI_FAULTS.includes(body.ai)) {
          return sendJson(res, 400, { error: 'ai must be one of ' + AI_FAULTS.join(', ') + '.' });
        }
        if (body.crm !== undefined) state.faults.crm = body.crm;
        if (body.ai !== undefined) state.faults.ai = body.ai;
        logCall({ method: 'POST', path: p, status: 200, service: 'Office', detail: 'Faults now: CRM ' + state.faults.crm + ', AI step ' + state.faults.ai + '.' });
        return sendJson(res, 200, state.faults);
      }
    }

    if (req.method === 'POST' && p === '/reset') {
      state = freshState();
      logCall({ method: 'POST', path: p, status: 200, service: 'Office', detail: 'The office was reset: everything emptied.' });
      return sendJson(res, 200, { reset: true });
    }

    // The lead form hands its enquiry to the office, which posts it to the flow's webhook.
    if (req.method === 'POST' && p === '/form/send') {
      const flowPath = clean(body.path, 120);
      const mode = body.mode === 'test' ? 'test' : 'live';
      if (!/^[a-z0-9][a-z0-9-]*$/.test(flowPath)) {
        return sendJson(res, 400, { error: 'The webhook path may hold small letters, digits and dashes only.' });
      }
      const enquiry = body.enquiry && typeof body.enquiry === 'object' ? body.enquiry : {};
      const target = n8nUrl + (mode === 'test' ? '/webhook-test/' : '/webhook/') + flowPath;
      let result;
      try {
        const r = await fetch(target, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(enquiry),
          signal: AbortSignal.timeout(60000),
        });
        const text = await r.text();
        result = { sentTo: target, status: r.status, body: text };
      } catch (e) {
        result = { sentTo: target, status: 0, body: 'The office could not reach n8n: ' + e.message };
      }
      logCall({
        method: 'POST',
        path: p,
        status: result.status,
        service: 'Form',
        detail: 'Sent to ' + target.replace(n8nUrl, '') + '; the flow answered ' + (result.status || 'nothing') + '.',
      });
      return sendJson(res, 200, result);
    }

    logCall({ method: req.method, path: p, status: 404, detail: 'The office has no such address.' });
    return sendJson(res, 404, { error: 'The practice office has no such address: ' + req.method + ' ' + p });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      const status = e.status || 500;
      if (!res.headersSent) sendJson(res, status, { error: e.message || 'The office failed.' });
    });
  });

  return {
    server,
    reset() {
      state = freshState();
    },
    get state() {
      return state;
    },
  };
}

function summarise(p, method, status, body, answer, url) {
  if (status === 401) return 'Refused: no badge header.';
  if (status === 500) return 'Failed on request (fault on).';
  if (status === 200 && answer && answer.ok === false) return 'Answered 200 but did nothing (fault on).';
  if (method === 'GET') {
    const by = url.searchParams.has('email') ? 'e-mail' : 'name';
    return answer.found ? 'Looked up by ' + by + ': found ' + answer.contact.id + '.' : 'Looked up by ' + by + ': not found.';
  }
  if (status === 409) return 'Refused: a contact with this e-mail exists (' + answer.id + ').';
  if (status === 201 && p === '/crm/contacts') return 'Created ' + answer.id + (body.note ? ' with its first note.' : ' with no note.');
  if (status === 201) return 'Added a note to ' + answer.contact + '.';
  return answer && answer.error ? answer.error : 'Answered ' + status + '.';
}

if (require.main === module) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3333);
  const office = createOffice();
  office.server.listen(port, host, () => {
    process.stdout.write('The practice office is open on http://' + host + ':' + port + '\n');
  });
  const stop = () => office.server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

module.exports = { createOffice, aiRead, figuresIn, BADGE_HEADER, BADGE_VALUE };
