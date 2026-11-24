'use strict';
// The workflow files: current with their generator; each starter is the previous stage's solution plus that stage's parts,
// each part as it is in the stage's solution except the setting left to the participant; each broken file differs from its
// repaired file in exactly the places its exercise names; every answer stays valid JSON for the worst names tried.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildAll, CODE_PLACEHOLDER, PARTS } = require('../tools/build-workflows.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'workflows');
const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const files = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const webhookOf = (wf) => wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
const byName = (wf) => new Map(wf.nodes.map((n) => [n.name, n]));

test('every workflow file is exactly what tools/build-workflows.js writes, and nothing else is in workflows/', () => {
  const built = buildAll();
  assert.deepEqual(Object.keys(built).sort(), files());
  for (const [file, flow] of Object.entries(built)) {
    assert.equal(fs.readFileSync(path.join(DIR, file), 'utf8'), JSON.stringify(flow, null, 2) + '\n', file);
  }
});

// A node as a participant sees it: its settings, without the webhook path, which differs from file to file.
function shape(n) {
  const parameters = JSON.parse(JSON.stringify(n.parameters));
  if (n.type === 'n8n-nodes-base.webhook') delete parameters.path;
  return { type: n.type, typeVersion: n.typeVersion, parameters, onError: n.onError || null, position: n.position };
}

function links(wf) {
  const out = [];
  for (const [from, entry] of Object.entries(wf.connections)) entry.main.forEach((list, i) => list.forEach((c) => out.push(from + ' -' + i + '-> ' + c.node)));
  return out.sort();
}

test('each starter is the previous stage\'s solution, with its own path, plus the stage\'s parts, not yet connected to it', () => {
  for (let n = 2; n <= 6; n++) {
    const starter = load('stage-' + n + '-starter.json');
    const previous = load('stage-' + (n - 1) + '-solution.json');
    const solution = load('stage-' + n + '-solution.json');
    const s = byName(starter);
    const prev = byName(previous);
    const sol = byName(solution);
    for (const [name, node] of prev) assert.deepEqual(shape(s.get(name)), shape(node), 'stage ' + n + ': ' + name + ' as in the previous solution');
    const parts = [...s.keys()].filter((name) => !prev.has(name));
    assert.equal(parts.length, PARTS[n].nodes.length, 'stage ' + n + ' brings its parts');
    const left = PARTS[n].left || {};
    for (const name of parts) {
      assert.ok(sol.has(name), 'stage ' + n + ': the part ' + name + ' is in the solution');
      const a = shape(s.get(name));
      const b = shape(sol.get(name));
      if (!left[name]) {
        assert.deepEqual(a, b, 'stage ' + n + ': the part ' + name + ' arrives finished');
      } else {
        assert.notDeepEqual(a.parameters, b.parameters, 'stage ' + n + ': the part ' + name + ' leaves ' + left[name] + ' to the participant');
        assert.deepEqual({ ...a, parameters: null }, { ...b, parameters: null }, 'stage ' + n + ': ' + name + ' is otherwise set');
      }
    }
    assert.equal(webhookOf(starter).parameters.path, 'stage-' + n);
    const extra = links(starter).filter((l) => !links(previous).includes(l));
    for (const l of extra) assert.ok(links(solution).includes(l), 'stage ' + n + ': the starter\'s link ' + l + ' is in the solution');
    for (const l of links(previous)) assert.ok(links(starter).includes(l), 'stage ' + n + ': the starter keeps ' + l);
  }
  const first = load('stage-1-starter.json');
  assert.equal(first.nodes.length, 1);
  assert.equal(webhookOf(first).parameters.path, 'stage-1');
  assert.equal(webhookOf(first).parameters.responseMode, 'onReceived', 'it answers at once, before the participant adds an answer');
});

test('what each starter leaves to the participant is blank, or a line that asks for it', () => {
  const lookup = byName(load('stage-3-starter.json')).get('Look up the contact').parameters.queryParameters.parameters;
  assert.deepEqual(lookup, [{ name: '', value: '' }]);
  assert.equal(byName(load('stage-4-starter.json')).get('Check the AI figures').parameters.jsCode, CODE_PLACEHOLDER);
  const resume = byName(load('stage-5-starter.json')).get('Ask a person').parameters.bodyParameters.parameters.find((x) => x.name === 'resumeUrl');
  assert.equal(resume.value, '');
});

test('each solution listens at stage-N-solution, so that it can run beside the participant\'s own flow', () => {
  for (let n = 1; n <= 6; n++) assert.equal(webhookOf(load('stage-' + n + '-solution.json')).parameters.path, 'stage-' + n + '-solution');
});

test('every node keeps its place on the canvas from stage to stage', () => {
  const places = new Map();
  for (const f of files()) {
    for (const n of load(f).nodes) {
      const at = JSON.stringify(n.position);
      if (places.has(n.name)) assert.equal(at, places.get(n.name), f + ' / ' + n.name);
      else places.set(n.name, at);
    }
  }
});

// The differences between two workflows, node by node, as readable lines.
function differences(a, b) {
  const out = [];
  const sa = byName(a);
  const sb = byName(b);
  for (const name of new Set([...sa.keys(), ...sb.keys()])) {
    if (!sa.has(name)) out.push('added ' + name);
    else if (!sb.has(name)) out.push('removed ' + name);
    else {
      const x = shape(sa.get(name));
      const y = shape(sb.get(name));
      for (const key of ['type', 'typeVersion', 'parameters', 'onError']) {
        if (JSON.stringify(x[key]) !== JSON.stringify(y[key])) out.push(key + ' of ' + name);
      }
    }
  }
  if (JSON.stringify(a.connections) !== JSON.stringify(b.connections)) out.push('connections');
  return out.sort();
}

test('repair A: the broken and the repaired file differ only in the webhook path, which is misspelt in the broken one', () => {
  const broken = load('repair-a-broken.json');
  const fixed = load('repair-a-fixed.json');
  assert.deepEqual(differences(broken, fixed), []);
  assert.equal(webhookOf(broken).parameters.path, 'repiar-a');
  assert.equal(webhookOf(fixed).parameters.path, 'repair-a');
});

test('repair B: they differ only in what the lookup searches by: the name in the broken one, the e-mail in the repaired one', () => {
  const broken = load('repair-b-broken.json');
  const fixed = load('repair-b-fixed.json');
  assert.deepEqual(differences(broken, fixed), ['parameters of Look up the contact']);
  const q = (wf) => byName(wf).get('Look up the contact').parameters.queryParameters.parameters[0];
  assert.deepEqual(q(broken), { name: 'name', value: "={{ $('Enquiry arrives').item.json.body.name }}" });
  assert.deepEqual(q(fixed), { name: 'email', value: "={{ $('Enquiry arrives').item.json.body.email }}" });
});

test('repair C: they differ only in the approval check, which reads the approval id in the broken one', () => {
  const broken = load('repair-c-broken.json');
  const fixed = load('repair-c-fixed.json');
  assert.deepEqual(differences(broken, fixed), ['parameters of Approved?']);
  const cond = (wf) => byName(wf).get('Approved?').parameters.conditions.conditions[0];
  assert.equal(cond(broken).leftValue, '={{ $json.body.approval }}');
  assert.equal(cond(broken).operator.operation, 'notEmpty');
  assert.equal(cond(fixed).leftValue, '={{ $json.body.decision }}');
  assert.equal(cond(fixed).operator.operation, 'equals');
  assert.equal(cond(fixed).rightValue, 'approve');
});

test('repair D: the repaired file adds the header to the note call and gives every CRM call an error branch', () => {
  const broken = load('repair-d-broken.json');
  const fixed = load('repair-d-fixed.json');
  assert.deepEqual(differences(broken, fixed), [
    'added Answer: check the CRM',
    'added Answer: nothing written',
    'added Tell the office: lookup failed',
    'added Tell the office: write failed',
    'connections',
    'onError of Add a note',
    'onError of Create the contact',
    'onError of Look up the contact',
    'parameters of Add a note',
  ]);
  const note = (wf) => byName(wf).get('Add a note');
  assert.equal(note(broken).parameters.sendHeaders, undefined);
  assert.equal(note(broken).onError, 'continueRegularOutput');
  assert.deepEqual(note(fixed).parameters.headerParameters.parameters[0], { name: 'X-Office-Badge', value: 'practice-badge' });
  assert.equal(note(fixed).onError, 'continueErrorOutput');
});

test('check G: they differ only in the note text, which is the unchecked AI summary in the broken one', () => {
  const broken = load('check-g-broken.json');
  const fixed = load('check-g-fixed.json');
  assert.deepEqual(differences(broken, fixed), ['parameters of Add a note', 'parameters of Create the contact']);
  assert.ok(JSON.stringify(byName(broken).get('Add a note').parameters).includes("$('Ask the AI step').item.json.summary"));
  assert.ok(JSON.stringify(byName(fixed).get('Add a note').parameters).includes("$('Check the AI figures').item.json.note"));
});

// The fields an enquiry fills in, and an error's text: free text a person or a system wrote.
const FREE_TEXT = /\b(name|email|message|company|website|consent|reason|error|summary|note)\b/;

test('every answer stays valid JSON for a name with quote marks, a forging name, a backslash or a line break: free text enters an answer only through JSON.stringify, never inside quote marks', () => {
  // CI run 45318193799 showed why: an error message with quote marks inside a JSON answer broke the answer. The first
  // review showed that a name does the same, and can forge a field.
  for (const f of files()) {
    for (const n of load(f).nodes.filter((x) => x.type === 'n8n-nodes-base.respondToWebhook')) {
      const body = n.parameters.responseBody.replace(/^=/, '');
      for (const m of body.matchAll(/\{\{([^}]*)\}\}/g)) {
        if (!FREE_TEXT.test(m[1])) continue;
        assert.match(m[1], /^ JSON\.stringify\(.*\) $/, f + ' / ' + n.name + ' puts free text in its answer without JSON.stringify: ' + m[0]);
        const before = body.slice(0, m.index).trimEnd();
        assert.notEqual(before[before.length - 1], '"', f + ' / ' + n.name + ': the JSON.stringify value must not stand inside quote marks');
      }
      // Fill every expression with the worst value it could hold, as n8n would, and parse the answer.
      for (const worst of ['plain', 'Maya "MJ" Rivers', 'x", "status": "refused', 'back\\slash', 'line\nbreak']) {
        const filled = body.replace(/(")?\{\{([^}]*)\}\}(")?/g, (all, q1, expr, q2) =>
          /JSON\.stringify/.test(expr) ? JSON.stringify(worst) : (q1 || '') + (FREE_TEXT.test(expr) ? worst : 'C1') + (q2 || ''));
        const parsed = JSON.parse(filled);
        assert.equal(typeof parsed, 'object', f + ' / ' + n.name);
        if (/received/.test(body)) assert.equal(parsed.status, 'received', f + ' / ' + n.name + ': no field forged by ' + worst);
      }
    }
  }
});

test('no node name holds a quote mark, so that an expression such as $(\'Node name\') can always name it', () => {
  for (const f of files()) for (const n of load(f).nodes) assert.doesNotMatch(n.name, /['"`]/, f + ' / ' + n.name);
});

test('every call to the practice CRM carries the badge header and a five-second timeout, except the one repair D breaks on purpose', () => {
  for (const f of files()) {
    for (const n of load(f).nodes.filter((x) => x.type === 'n8n-nodes-base.httpRequest' && /\/crm\//.test(x.parameters.url))) {
      const hasBadge = n.parameters.sendHeaders === true && n.parameters.headerParameters.parameters.some((h) => h.name === 'X-Office-Badge' && h.value === 'practice-badge');
      if (f === 'repair-d-broken.json' && n.name === 'Add a note') assert.equal(hasBadge, false);
      else assert.ok(hasBadge, f + ' / ' + n.name);
      assert.equal(n.parameters.options.timeout, 5000, f + ' / ' + n.name);
    }
  }
});

test('the consent check compares as text with types converted, so that true passes and anything else is refused, never an error', () => {
  for (const f of files()) {
    const node = byName(load(f)).get('Consent given?');
    if (!node || f === 'stage-2-starter.json') continue; // stage 2's starter brings it empty, for the participant to set
    const c = node.parameters.conditions;
    assert.equal(node.parameters.looseTypeValidation, true, f);
    assert.equal(c.options.typeValidation, 'loose', f);
    assert.deepEqual([c.conditions[0].operator.type, c.conditions[0].operator.operation, c.conditions[0].rightValue], ['string', 'equals', 'true'], f);
  }
});
