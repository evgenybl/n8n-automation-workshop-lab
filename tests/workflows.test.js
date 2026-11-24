'use strict';
// The workflow files: current with their generator; each starter is the previous stage's solution; each broken file
// differs from its repaired file in exactly the places its exercise names; every answer a flow gives is valid JSON
// whatever the enquiry says.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildAll } = require('../tools/build-workflows.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'workflows');
const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const files = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const webhookOf = (wf) => wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');

test('every workflow file is exactly what tools/build-workflows.js writes, and nothing else is in workflows/', () => {
  const built = buildAll();
  assert.deepEqual(Object.keys(built).sort(), files());
  for (const [file, flow] of Object.entries(built)) {
    assert.equal(fs.readFileSync(path.join(DIR, file), 'utf8'), JSON.stringify(flow, null, 2) + '\n', file);
  }
});

// A workflow reduced to what a participant sees: node names with their settings, and the connections.
function shape(wf) {
  const nodes = {};
  for (const n of wf.nodes) {
    const parameters = JSON.parse(JSON.stringify(n.parameters));
    if (n.type === 'n8n-nodes-base.webhook') delete parameters.path;
    nodes[n.name] = { type: n.type, typeVersion: n.typeVersion, parameters, onError: n.onError || null, position: n.position };
  }
  return { nodes, connections: wf.connections };
}

test('each stage\'s starter is the previous stage\'s solution, with only its id, name and webhook path changed', () => {
  for (let n = 2; n <= 6; n++) {
    const starter = load('stage-' + n + '-starter.json');
    const previous = load('stage-' + (n - 1) + '-solution.json');
    assert.deepEqual(shape(starter), shape(previous), 'stage ' + n);
    assert.equal(webhookOf(starter).parameters.path, 'stage-' + n);
    assert.notEqual(starter.id, previous.id);
  }
  const first = load('stage-1-starter.json');
  assert.equal(first.nodes.length, 1);
  assert.equal(webhookOf(first).parameters.path, 'stage-1');
  assert.equal(webhookOf(first).parameters.responseMode, 'onReceived', 'it answers at once, before the participant adds an answer');
});

test('each solution listens at stage-N-solution, so that it can run beside the participant\'s own flow', () => {
  for (let n = 1; n <= 6; n++) assert.equal(webhookOf(load('stage-' + n + '-solution.json')).parameters.path, 'stage-' + n + '-solution');
});

// The differences between two workflows, node by node, as readable lines.
function differences(a, b) {
  const out = [];
  const sa = shape(a).nodes;
  const sb = shape(b).nodes;
  for (const name of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
    if (!sa[name]) out.push('added ' + name);
    else if (!sb[name]) out.push('removed ' + name);
    else {
      for (const key of ['type', 'typeVersion', 'parameters', 'onError']) {
        if (JSON.stringify(sa[name][key]) !== JSON.stringify(sb[name][key])) out.push(key + ' of ' + name);
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
  const q = (wf) => wf.nodes.find((n) => n.name === 'Look up the contact').parameters.queryParameters.parameters[0];
  assert.equal(q(broken).name, 'name');
  assert.equal(q(fixed).name, 'email');
});

test('repair C: they differ only in the approval check, which reads the approval id in the broken one', () => {
  const broken = load('repair-c-broken.json');
  const fixed = load('repair-c-fixed.json');
  assert.deepEqual(differences(broken, fixed), ['parameters of Approved?']);
  const cond = (wf) => wf.nodes.find((n) => n.name === 'Approved?').parameters.conditions.conditions[0];
  assert.equal(cond(broken).leftValue, '={{ $json.body.approval }}');
  assert.equal(cond(fixed).leftValue, '={{ $json.body.decision }}');
  assert.equal(cond(fixed).rightValue, 'approve');
});

test('repair D: the repaired file adds the header to the note call and gives every CRM call an error branch', () => {
  const broken = load('repair-d-broken.json');
  const fixed = load('repair-d-fixed.json');
  assert.deepEqual(differences(broken, fixed), [
    'added Answer: failed',
    'added Tell the office',
    'connections',
    'onError of Add a note',
    'onError of Create the contact',
    'onError of Look up the contact',
    'parameters of Add a note',
  ]);
  const note = (wf) => wf.nodes.find((n) => n.name === 'Add a note');
  assert.equal(note(broken).parameters.sendHeaders, undefined);
  assert.equal(note(broken).onError, 'continueRegularOutput');
  assert.equal(note(fixed).parameters.headerParameters.parameters[0].name, 'X-Office-Badge');
  assert.equal(note(fixed).onError, 'continueErrorOutput');
});

test('check G: they differ only in the note text, which is the unchecked AI summary in the broken one', () => {
  const broken = load('check-g-broken.json');
  const fixed = load('check-g-fixed.json');
  assert.deepEqual(differences(broken, fixed), ['parameters of Add a note', 'parameters of Create the contact']);
});

test('every answer a flow gives is valid JSON, and puts no free text from the enquiry or an error inside it', () => {
  // Run 1 of the lab's CI showed why: an error message with quote marks inside a JSON answer breaks the answer.
  for (const f of files()) {
    for (const n of load(f).nodes.filter((x) => x.type === 'n8n-nodes-base.respondToWebhook')) {
      const body = n.parameters.responseBody.replace(/^=/, '');
      const expressions = body.match(/\{\{[^}]*\}\}/g) || [];
      for (const e of expressions) {
        assert.doesNotMatch(e, /message|reason|error|summary|note|company/, f + ' / ' + n.name + ' puts free text in its answer: ' + e);
      }
      assert.doesNotThrow(() => JSON.parse(body.replace(/\{\{[^}]*\}\}/g, 'x')), f + ' / ' + n.name);
    }
  }
});

test('no node name holds a quote mark, so that an expression such as $(\'Node name\') can always name it', () => {
  for (const f of files()) for (const n of load(f).nodes) assert.doesNotMatch(n.name, /['"`]/, f + ' / ' + n.name);
});

test('every call to the practice CRM carries the badge header, except the one repair D breaks on purpose', () => {
  for (const f of files()) {
    for (const n of load(f).nodes.filter((x) => x.type === 'n8n-nodes-base.httpRequest' && /\/crm\//.test(x.parameters.url))) {
      const hasBadge = n.parameters.sendHeaders === true && n.parameters.headerParameters.parameters.some((h) => h.name === 'X-Office-Badge' && h.value === 'practice-badge');
      if (f === 'repair-d-broken.json' && n.name === 'Add a note') assert.equal(hasBadge, false);
      else assert.ok(hasBadge, f + ' / ' + n.name);
    }
  }
});
