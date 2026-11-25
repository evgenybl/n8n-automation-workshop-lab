'use strict';
// The lab guide, the repairs, the answer key and the practical check, against the workflow files.
//
// The main test reads each stage's table in participant/guide.md and applies its rows, one by one, to the stage's
// starter file, as a participant would on n8n's canvas: delete a connection, add a node, set a setting, paste a block.
// The result must be exactly the stage's solution file: the same nodes, the same settings, the same connections.
// Other tests hold the values written in the pages' prose (addresses, methods, status codes, the timeout, the badge, the
// On Error values, the form paths, the repairs' causes and fixes) to the files.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ifNode, TYPES } = require('../tools/flow-kit.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const load = (f) => JSON.parse(read('workflows/' + f));
const byName = (wf) => new Map(wf.nodes.map((n) => [n.name, n]));
const webhookOf = (wf) => wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
const clone = (v) => JSON.parse(JSON.stringify(v));
const unquote = (cell) => (/^`[^`]*`$/.test(cell) ? cell.slice(1, -1) : cell);

// ---------- reading the guide ----------

function stages() {
  const text = read('participant/guide.md');
  return text.split(/\n## Stage /).slice(1).map((s) => ({ n: Number(s[0]), text: s.split(/\n## /)[0] }));
}

function tableOf(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('| # | Do this |'));
  assert.ok(start !== -1, 'a table of steps');
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows;
}

function pastesOf(text) {
  const out = {};
  for (const m of text.matchAll(/^\*\*(P\d+)\*\* \(step[\s\S]*?```paste\n([\s\S]*?)```/gm)) {
    assert.ok(!(m[1] in out), 'one block ' + m[1]);
    out[m[1]] = m[2].replace(/\n$/, '');
  }
  return out;
}

// ---------- what a row does to a node ----------

const LABELS = {
  responseMode: { Immediately: 'onReceived', "Using 'Respond to Webhook' Node": 'responseNode' },
  respondWith: { JSON: 'json' },
  resume: { 'On Webhook Call': 'webhook' },
  onError: { 'Continue (using error output)': 'continueErrorOutput', Continue: 'continueRegularOutput', 'Stop Workflow': 'stopWorkflow' },
  onOff: { on: true, off: false },
};
const OPERATORS = {
  contains: { type: 'string', operation: 'contains' },
  'is equal to': { type: 'string', operation: 'equals' },
  'is empty': { type: 'string', operation: 'empty', singleValue: true },
  'is not empty': { type: 'string', operation: 'notEmpty', singleValue: true },
  'is true': { type: 'boolean', operation: 'true', singleValue: true },
};
const NODE_TYPES = { 'Respond to Webhook': 'respond', If: 'if', Wait: 'wait', 'HTTP Request': 'http', Code: 'code' };
const label = (kind, value) => {
  assert.ok(value in LABELS[kind], 'a known label for ' + kind + ': ' + value);
  return LABELS[kind][value];
};

// A new node as n8n's editor adds it, before the participant sets anything.
// A Respond to Webhook node's Response Body holds a sample when the node is added (n8n 2.48.8's source).
const SAMPLE_BODY = '{\n  "myField": "value"\n}';
function fresh(kind, name) {
  if (kind === 'if') return Object.assign({ name }, TYPES.if, { parameters: ifNode(name, [['', 'equals', '']]).parameters });
  if (kind === 'respond') return Object.assign({ name }, TYPES.respond, { parameters: { options: {}, responseBody: SAMPLE_BODY } });
  return Object.assign({ name }, TYPES[kind], { parameters: { options: {} } });
}

// What a box that a row pastes into holds before the paste.
function holds(node, setting) {
  const p = node.parameters;
  if (setting === 'Response Body') return p.responseBody;
  if (setting === 'left box') return p.conditions.conditions[0].leftValue;
  if (setting === 'Query Parameters: Value') return p.queryParameters.parameters[0].value;
  if (setting.startsWith('Body Parameters: ')) return (p.bodyParameters.parameters.find((x) => x.name === setting.slice(17)) || {}).value;
  if (setting === 'Code') return p.jsCode;
  return undefined;
}
const PASTE_ACTS = ['Paste', 'Paste (as an Expression)', 'Select everything in the box, then paste', 'Select everything in the box, then paste (as an Expression)'];

function apply(node, setting, value, where) {
  const p = node.parameters;
  const t = node.type.replace('n8n-nodes-base.', '');
  const field = (list, name) => {
    const f = (list && list.parameters || []).find((x) => x.name === name);
    assert.ok(f, where + ': ' + node.name + ' has a field ' + name);
    return f;
  };
  if (setting === 'On Error') node.onError = label('onError', value);
  else if (t === 'webhook' && setting === 'Path') p.path = value;
  else if ((t === 'webhook' || t === 'wait') && setting === 'HTTP Method') p.httpMethod = value;
  else if ((t === 'webhook' || t === 'wait') && setting === 'Respond') p.responseMode = label('responseMode', value);
  else if (t === 'wait' && setting === 'Resume') p.resume = label('resume', value);
  else if (t === 'respondToWebhook' && setting === 'Respond With') p.respondWith = label('respondWith', value);
  else if (t === 'respondToWebhook' && setting === 'Response Body') p.responseBody = '=' + value;
  else if (t === 'if' && setting === 'left box') p.conditions.conditions[0].leftValue = '=' + value;
  else if (t === 'if' && setting === 'operator') {
    const m = value.match(/^(String|Boolean), then `([^`]+)`(?:; right box `([^`]*)`)?$/);
    assert.ok(m, where + ': an operator cell reads "Type, then `operator`; right box `value`": ' + value);
    const op = OPERATORS[m[2]];
    assert.ok(op, where + ': a known operator ' + m[2]);
    assert.equal(op.type, m[1].toLowerCase(), where + ': ' + m[2] + ' is under ' + op.type);
    p.conditions.conditions[0].operator = clone(op);
    p.conditions.conditions[0].rightValue = m[3] === undefined ? '' : m[3];
  } else if (t === 'if' && setting === 'Convert types where required') {
    p.looseTypeValidation = label('onOff', value);
    p.conditions.options.typeValidation = p.looseTypeValidation ? 'loose' : 'strict';
  } else if (t === 'httpRequest' && setting === 'Query Parameters: Name') p.queryParameters.parameters[0].name = value;
  else if (t === 'httpRequest' && setting === 'Query Parameters: Value') p.queryParameters.parameters[0].value = '=' + value;
  else if (t === 'httpRequest' && setting.startsWith('Body Parameters: ')) field(p.bodyParameters, setting.slice(17)).value = '=' + value;
  else if (t === 'code' && setting === 'Code') p.jsCode = value;
  else assert.fail(where + ': no rule for the setting "' + setting + '" on a ' + t + ' node');
}

const OUTPUTS = { 'its output': 0, 'its **true** output': 0, 'its **false** output': 1, 'its **success** output': 0, 'its **error** output': 1 };

// ---------- applying a stage's table to its starter ----------

function walk(n, text) {
  const starter = load('stage-' + n + '-starter.json');
  const nodes = byName(clone(starter));
  const links = new Set();
  for (const [from, entry] of Object.entries(starter.connections)) {
    entry.main.forEach((list, i) => list.forEach((c) => links.add(from + '|' + i + '|' + c.node)));
  }
  const rows = tableOf(text);
  const pastes = pastesOf(text);
  const used = new Set();
  const need = (name, where) => {
    assert.ok(nodes.has(name), where + ': the node ' + name + ' is on the canvas');
    return nodes.get(name);
  };
  rows.forEach((r, i) => {
    const where = 'stage ' + n + ' row ' + (i + 1);
    assert.equal(r.length, 5, where + ' has five cells');
    assert.equal(Number(r[0]), i + 1, where + ' is numbered');
    const [, act, nodeCell, setting, valueCell] = r;
    const name = unquote(nodeCell);
    let value = unquote(valueCell);
    const pasted = valueCell.match(/^\*\*(P\d+)\*\*$/);
    if (pasted) {
      assert.ok(pasted[1] in pastes, where + ': the block ' + pasted[1] + ' is on the page');
      value = pastes[pasted[1]];
      used.add(pasted[1]);
    }
    assert.doesNotMatch(valueCell, /\{\{/, where + ': an expression is given in a block to paste, not in the table');
    if (i === 0) {
      assert.equal(act, '**Import into a new workflow**', where + ': every stage starts by importing its starter');
      assert.equal(value, 'workflows/stage-' + n + '-starter.json');
    } else if (act.startsWith('Publish')) {
      assert.equal(i, rows.length - 1, where + ': publishing is the last row');
    } else if (act === 'Look at') {
      const node = need(name, where);
      const before = clone(node);
      apply(node, setting, value, where);
      assert.deepEqual(node, before, where + ': ' + name + "'s " + setting + ' already is ' + value + ' in the starter');
    } else if (act === 'Set' || PASTE_ACTS.includes(act)) {
      assert.equal(act !== 'Set', Boolean(pasted), where + ': paste rows, and only they, name a block');
      const node = need(name, where);
      if (pasted) {
        const before = holds(node, setting);
        assert.equal(/^Select everything/.test(act), Boolean(before), where + ': "select everything" exactly where the box already holds a value (' + JSON.stringify(before) + ')');
        assert.equal(/\(as an Expression\)$/.test(act), setting !== 'Code', where + ': "(as an Expression)" on every expression, and only there');
      }
      apply(node, setting, value, where);
    } else if (act === 'Delete the node') {
      need(name, where);
      nodes.delete(name);
      for (const l of [...links]) if (l.startsWith(name + '|') || l.endsWith('|' + name)) links.delete(l);
    } else if (/^Add an? \*\*(.+)\*\* node, and rename it to `([^`]+)`$/.test(act)) {
      const [, typeName, renamed] = act.match(/^Add an? \*\*(.+)\*\* node, and rename it to `([^`]+)`$/);
      assert.equal(renamed, name, where + ': the row renames the new node to the name in its Node cell');
      const kind = NODE_TYPES[typeName];
      assert.ok(kind, where + ': a known node type');
      assert.ok(!nodes.has(name), where + ': ' + name + ' is new');
      assert.equal(setting, 'after');
      need(value, where);
      nodes.set(name, fresh(kind, name));
      links.add(value + '|0|' + name);
    } else if (act === 'Connect' || act === 'Delete the connection') {
      need(name, where);
      const to = value.match(/^to `([^`]+)`$/);
      assert.ok(to, where + ': the value names where the connection goes');
      need(to[1], where);
      const outs = setting === '' && act === 'Delete the connection' ? [0, 1] : [OUTPUTS[setting]];
      assert.ok(outs[0] !== undefined, where + ': a known output: ' + setting);
      const link = outs.map((o) => name + '|' + o + '|' + to[1]).filter((l) => act === 'Connect' || links.has(l));
      if (act === 'Connect') {
        assert.ok(!links.has(link[0]), where + ': ' + link[0] + ' is not connected yet');
        links.add(link[0]);
      } else {
        assert.equal(link.length, 1, where + ': exactly one connection from ' + name + ' to ' + to[1] + ' to delete');
        links.delete(link[0]);
      }
    } else {
      assert.fail(where + ': an unknown step "' + act + '"');
    }
  });
  assert.deepEqual([...used].sort(), Object.keys(pastes).sort(), 'stage ' + n + ': every block on the page is used by a row');
  return { nodes, links, rows };
}

const shape = (n) => {
  const parameters = clone(n.parameters);
  if (n.type === 'n8n-nodes-base.webhook') delete parameters.path;
  return { type: n.type, typeVersion: n.typeVersion, parameters, onError: n.onError || null };
};

test('following each stage\'s table on its starter gives exactly the stage\'s solution: its nodes, settings and connections', () => {
  const all = stages();
  assert.deepEqual(all.map((s) => s.n), [1, 2, 3, 4, 5, 6]);
  for (const { n, text } of all) {
    const { nodes, links } = walk(n, text);
    const solution = load('stage-' + n + '-solution.json');
    const sol = byName(solution);
    assert.deepEqual([...nodes.keys()].sort(), [...sol.keys()].sort(), 'stage ' + n + ': the same nodes');
    for (const [name, node] of sol) assert.deepEqual(shape(nodes.get(name)), shape(node), 'stage ' + n + ': ' + name);
    assert.equal(webhookOf({ nodes: [...nodes.values()] }).parameters.path, 'stage-' + n, 'stage ' + n + ': the flow keeps its own path');
    const solLinks = new Set();
    for (const [from, entry] of Object.entries(solution.connections)) {
      entry.main.forEach((list, i) => list.forEach((c) => solLinks.add(from + '|' + i + '|' + c.node)));
    }
    assert.deepEqual([...links].sort(), [...solLinks].sort(), 'stage ' + n + ': the same connections');
  }
});

test('what the guide says a starter brings is what it holds: stage 4\'s placeholder lines', () => {
  const { CODE_PLACEHOLDER } = require('../tools/build-workflows.js');
  const words = { one: 1, two: 2, three: 3 };
  const said = stages()[3].text.match(/empty except for (\w+) lines? that ask for the code/);
  assert.ok(said, 'stage 4 says how many lines the Code node holds');
  assert.equal(words[said[1]], CODE_PLACEHOLDER.split('\n').length);
  const node = byName(load('stage-4-starter.json')).get('Check the AI figures');
  assert.equal(node.parameters.jsCode, CODE_PLACEHOLDER);
});

test('the fault runs stage 6 lets a participant skip are the ones the run sheet cuts', () => {
  const guide = stages()[5].text.replace(/\s+/g, ' ').match(/\*\*Short of time\?\*\* Do \*([^*]+)\* and \*([^*]+)\*; \*([^*]+)\* and \*([^*]+)\* can wait\./);
  assert.ok(guide, 'stage 6 says which fault runs can wait');
  const sheet = read('instructor/run-sheet.md').replace(/\s+/g, ' ').match(/stage 6's \*([^*]+)\* and \*([^*]+)\* faults \(keep \*([^*]+)\* and \*([^*]+)\*[;)]/);
  assert.ok(sheet, 'the run sheet says which faults it cuts');
  assert.deepEqual([guide[3], guide[4]].sort(), [sheet[1], sheet[2]].sort(), 'the same faults wait');
  assert.deepEqual([guide[1], guide[2]].sort(), [sheet[3], sheet[4]].sort(), 'the same faults are kept');
  const window = read('practice/pages/window.html');
  for (const f of guide.slice(1)) assert.ok(window.includes('>' + f), 'the office window offers "' + f + '"');
});

test('the guide places things on n8n\'s screen as the screen showed or as n8n\'s documentation does, and says so where it cannot', () => {
  const pages = ['participant/guide.md', 'participant/repairs.md', 'participant/setup.md'];
  // Places the first versions of these pages invented; none is in n8n's documentation. The places the guide gives for
  // stages 1 and 2 were seen on n8n 2.48.8's screen, and are held by the sentences further down.
  for (const f of pages) assert.doesNotMatch(read(f), /top right|above the box|right-click it|the top one|the bottom one|at the top of the canvas|beside \*\*Parameters\*\*/, f);
  const text = read('participant/guide.md');
  const pagesNamed = {
    'Create and run workflows': 'https://docs.n8n.io/build/understand-workflows/create-and-run-workflows',
    'Save and publish workflows': 'https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows',
    'Work with nodes': 'https://docs.n8n.io/build/understand-workflows/workflow-components/work-with-nodes',
    'Connect nodes together': 'https://docs.n8n.io/build/understand-workflows/workflow-components/connect-nodes-together',
    'View executions for a single workflow': 'https://docs.n8n.io/build/understand-workflows/understand-executions/view-executions-for-a-single-workflow',
    Wait: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/',
    'Export and import': 'https://docs.n8n.io/build/manage-workflows/export-and-import',
  };
  // Stage 2 says to wait after typing in an If node's right box, where n8n 2.48.8's screen lost letters.
  const stage2 = text.slice(text.indexOf('## Stage 2:'), text.indexOf('## Stage 3:'));
  assert.ok(stage2.includes("**After you type in an If node's right box, wait two seconds before you do anything else.**"), 'stage 2: the wait after typing');
  assert.ok(stage2.includes('Row 11: after you type `true`, wait two seconds before you go on to row 12.'), 'stage 2: the wait is said beside the rows');
  for (const [title, url] of Object.entries(pagesNamed)) {
    assert.ok(text.includes('*' + title + '* (' + url + ')'), 'the guide names its documentation page ' + title + ', ' + url);
  }
  // The import, the first step of every stage: where it is on n8n 2.48.8's screen, the documentation's name for it, and
  // the question n8n asks the first time.
  const flatText = text.replace(/^>\s?/gm, '').replace(/\s+/g, ' ');
  assert.ok(flatText.includes("Beside the workflow's name, in the canvas header, there is a button with three dots. Select it, then **Import**, then **From file**."));
  assert.ok(flatText.includes("n8n's documentation calls the same thing **Import from File**, in a menu it calls the Workflow menu"));
  assert.ok(flatText.includes("Tick **Don't show again** and choose **Skip**"));
  assert.ok(flatText.includes("Select the three dots beside the workflow's name, then **Import**, then **From file**"));
  assert.ok(read('instructor/guide.md').replace(/\s+/g, ' ').includes("the import is behind the three dots beside the workflow's name: **Import**, then **From file**"));
  // The guide says who carried out which parts on a screen.
  assert.ok(flatText.includes("carried out the steps of *How every stage works* (not the test address), stages 1 and 2 and repair A on n8n 2.48.8's own screen, with n8n started without Docker"));
  assert.ok(flatText.includes('The same agent made the corrections, so this was not an independent test.'));
  assert.ok(flatText.includes('Stages 3 to 6 have not been carried out on a screen'));
  const unsure = 'This page was not written from a screen: if you cannot';
  assert.ok((text.replace(/\s+/g, ' ').match(new RegExp(unsure, 'g')) || []).length >= 1, 'the guide says so where the documentation does not place a thing and no screen was seen');
  const tested = read('docs/HOW-THIS-WAS-TESTED.md');
  for (const row of ['| The *Fixed* / *Expression* switch of a box, and where it sits |', '| The label *Convert types where required*, and where the switch sits on the If node |', "| Where a node's error output sits beside its normal one,"]) {
    assert.ok(tested.includes(row), 'the testing page lists ' + row);
  }
});

test('every address of n8n\'s documentation on a page is a page, not its source text or an address that only redirects', () => {
  // Addresses ending in .md serve the page's source text; these older ones redirect to the pages the lab now names.
  const old = ['https://docs.n8n.io/workflows/create/', 'https://docs.n8n.io/workflows/components/nodes/', 'https://docs.n8n.io/workflows/components/connections/', 'https://docs.n8n.io/n8n-community-license/community-license'];
  for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.md')).concat(['participant', 'instructor', 'docs', 'practice'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((x) => x.endsWith('.md')).map((x) => d + '/' + x)))) {
    const text = read(f);
    for (const m of text.matchAll(/https:\/\/docs\.n8n\.io\/[^\s)]*/g)) {
      assert.doesNotMatch(m[0], /\.md$/, f + ': ' + m[0]);
      assert.ok(!old.includes(m[0]), f + ': ' + m[0]);
    }
  }
});

test('the guide explains what the reading tests asked for: the Respond node, the two requests, a 502 per fault, a stage again', () => {
  const s = stages();
  assert.match(s[0].text, /A Webhook node can answer at once\s+by itself, or leave the answer to a later \*\*Respond to Webhook\*\* node/);
  const steps = s[4].text.match(/\*\*Two requests, two answers\. Read this before you build\.\*\*\n\n((?:\d\. [^\n]+\n)+)/);
  assert.ok(steps, 'stage 5 gives the two requests as numbered lines');
  assert.equal(steps[1].trim().split('\n').length, 4);
  assert.match(s[5].text, /\*\*Each fault must end with Status 502 under your decision in the inbox\.\*\*/);
  assert.match(s[5].text, /optional try, not a step; skip it when short of time/);
  assert.match(read('participant/guide.md'), /\*\*Starting a stage again\.\*\* Delete your half-built workflow/);
});

test('the repairs page names the path each repaired file listens at, as the files have it', () => {
  const text = read('participant/repairs.md');
  for (const x of ['a', 'b', 'c', 'd']) {
    const row = text.match(new RegExp('\\| ' + x.toUpperCase() + ' \\| `workflows/repair-' + x + '-fixed\\.json` \\| `([a-z0-9-]+)` \\| `http://localhost:3333/form\\?path=([a-z0-9-]+)` \\|'));
    assert.ok(row, 'repair ' + x + ' has its row');
    const listens = webhookOf(load('repair-' + x + '-fixed.json')).parameters.path;
    assert.equal(row[1], listens, 'repair ' + x);
    assert.equal(row[2], listens, 'repair ' + x);
  }
});

test('no stage has more than 14 steps, and the README says so', () => {
  for (const { n, text } of stages()) assert.ok(tableOf(text).length <= 14, 'stage ' + n + ' has ' + tableOf(text).length + ' steps');
  assert.match(read('README.md'), /No stage has more than 14 steps/);
});

test('the guide gives the two rules in bold at the top, and every check yourself starts by resetting the office', () => {
  const text = read('participant/guide.md');
  assert.ok(text.includes('**Every stage starts by importing its starter file into a new workflow.**'));
  assert.ok(text.includes('**Paste every value shown in a grey block; do not type it.**'));
  // A printout cannot be pasted from: the blocks are in the file in the lab's folder.
  const where = "is also in this page's file in the lab's folder, `participant/guide.md`, which you can open in a text editor and copy from.";
  assert.ok(text.replace(/\s+/g, ' ').includes(where));
  assert.ok(read('instructor/run-sheet.md').replace(/\s+/g, ' ').includes("A printout cannot be pasted from: every grey block of the guide is also in the same page's file in the lab's folder, `participant/guide.md`"));
  for (const { n, text: s } of stages()) {
    const checks = [...s.matchAll(/\*\*Check yourself[^*]*\*\* ([^\n]+)/g)];
    assert.equal(checks.length, 1, 'stage ' + n + ' has one "check yourself"');
    assert.match(checks[0][1], /^Choose \*\*Reset the office\*\*/, 'stage ' + n);
  }
});

test('every expression anywhere in a stage, also in its prose, is in that stage\'s solution file', () => {
  for (const { n, text } of stages()) {
    const solution = read('workflows/stage-' + n + '-solution.json');
    for (const m of text.matchAll(/\{\{ [^`\n]*? \}\}/g)) {
      assert.ok(solution.includes(JSON.stringify(m[0]).slice(1, -1)), 'stage ' + n + ': ' + m[0]);
    }
  }
});

test('each stage\'s form address and planned minutes agree with its starter and the run sheet', () => {
  const sheet = read('instructor/run-sheet.md');
  for (const { n, text } of stages()) {
    const form = text.match(/\*\*Your form address:\*\*\s+`http:\/\/localhost:3333\/form\?path=([a-z0-9-]+)`/);
    assert.ok(form, 'stage ' + n + ' names its form address');
    assert.equal(form[1], webhookOf(load('stage-' + n + '-starter.json')).parameters.path, 'stage ' + n);
    const minutes = text.match(/\*\*Planned minutes:\*\* (\d+)\./);
    assert.ok(minutes, 'stage ' + n + ' gives its planned minutes');
    const row = sheet.match(new RegExp('\\| Stage ' + n + ': [^|]+\\| (\\d+) \\|'));
    assert.ok(row, 'the run sheet has stage ' + n);
    assert.equal(minutes[1], row[1], 'stage ' + n + ': the same planned minutes as the run sheet');
  }
});

test('stage 2 says which checks compare text as it is, as its solution sets them, and asks about an enquiry with no name', () => {
  const text = stages()[1].text.replace(/\s+/g, ' ');
  const said = text.match(/\*\*The other two checks compare text as it is\.\*\* \*([^*]+)\* and \*([^*]+)\* leave \*Convert types where required\* off/);
  assert.ok(said, 'stage 2 names the two checks that compare text as it is');
  const nodes = byName(load('stage-2-solution.json'));
  for (const name of [said[1], said[2]]) {
    assert.equal(nodes.get(name).parameters.looseTypeValidation, false, name);
    assert.equal(nodes.get(name).parameters.conditions.options.typeValidation, 'strict', name);
  }
  assert.equal(nodes.get('Consent given?').parameters.looseTypeValidation, true, 'the third converts types');
  assert.ok(text.includes('is not tried by any test of this lab.'));
  assert.ok(text.includes('The stage 2 flow does not check the name.'));
  assert.ok(text.includes('An enquiry with no name is not tried by any test of this lab'));
});

test('the stage 4 check, run in plain Node, lets through what the guide says it lets through', () => {
  const { aiRead } = require('../practice/server.js');
  const js = byName(load('stage-6-solution.json')).get('Check the AI figures').parameters.jsCode;
  assert.equal(pastesOf(stages()[3].text).P1, js, 'the code the guide pastes is the finished flow\'s');
  // The Code node's two inputs, as n8n hands them over: the enquiry (read with $) and the AI step's answer ($input).
  const run = (body, answer) => new Function('$', '$input', js)(() => ({ first: () => ({ json: { body } }) }), { first: () => ({ json: answer }) })[0].json;
  const text = stages()[3].text.replace(/\s+/g, ' ');
  const box = text.split('It also reads only the message,')[1];
  assert.ok(box, 'stage 4 says what else its check lets through');
  // A figure in the name.
  const m = box.match(/the name `([^`]+)` with the message `([^`]+)` gives "([^"]+)"/);
  assert.ok(m, 'the example of a figure in the name');
  const enquiry = { name: m[1], message: m[2] };
  const named = run(enquiry, aiRead(enquiry, 'off'));
  assert.equal(named.note, 'Message: ' + m[2] + '\n' + m[3]);
  assert.equal(named.summaryUsed, false);
  assert.ok(!m[2].includes(named.notInEnquiry[0]) && m[1].includes(named.notInEnquiry[0]), 'the figure reported as invented is the name\'s');
  // An answer with no summary, and a summary that is not text, are labelled checked.
  const maya = { name: 'Maya Rivers', message: 'How much for 12 seats?' };
  const none = run(maya, {});
  assert.equal(none.note, 'Message: How much for 12 seats?\nAI summary (checked): ');
  assert.ok(box.includes('An answer with no summary is labelled checked: the note says "AI summary (checked):" and no summary follows.'));
  const shaped = run(maya, { summary: { budget: 9999 } });
  assert.equal(shaped.summaryUsed, true);
  assert.equal(shaped.note, 'Message: How much for 12 seats?\nAI summary (checked): [object Object]');
  assert.ok(box.includes('a summary sent as an object gives "AI summary (checked): [object Object]"'));
  // An enquiry with no message.
  const silent = run({ name: 'Maya Rivers' }, aiRead({ name: 'Maya Rivers' }, 'off'));
  assert.match(silent.note, /^Message: undefined\n/);
  assert.ok(box.includes('An enquiry with no message gives a note that starts "Message: undefined".'));
  // And what the guide shows in its runs: a failed AI step, and an invented figure.
  assert.equal(run(maya, { error: { message: '500' } }).note, 'Message: How much for 12 seats?\nAI summary not used: the AI step did not answer.');
  assert.equal(run(maya, aiRead(maya, 'invent')).note, 'Message: How much for 12 seats?\nAI summary not used: it gives figures that are not in the enquiry (4800).');
});

test('stage 5 states the limits of its design, the entry webhook\'s among them, and going further repeats them', () => {
  const s5 = stages()[4].text;
  const start = s5.indexOf('> **The limits of this design.**');
  assert.ok(start !== -1, 'stage 5 has its limits box');
  const box = s5.slice(start).split('\n').filter((l, i, all) => all.slice(0, i + 1).every((x) => x.startsWith('>'))).join(' ').replace(/>\s?/g, ' ').replace(/\s+/g, ' ');
  for (const point of [
    'a place to learn, not something to put in front of real enquiries as it is',
    'whoever has the link can approve',
    'waits with no time limit',
    'the person who sent it gets only the first answer',
    "The flow's own webhook takes an enquiry from anyone who can reach its address",
    "the honeypot, is the flow's only defence against robots",
    "n8n keeps each run's data, the enquirer's name and e-mail address included",
    'The calls to the AI step and to the inbox have no timeout of their own in the files, unlike the CRM calls',
  ]) assert.ok(box.includes(point), 'the limits box says: ' + point);
  // What the box says of the timeouts is what the files hold.
  for (const n of httpNodes(5)) {
    const crm = /\/crm\//.test(n.parameters.url);
    assert.equal(n.parameters.options.timeout, crm ? 5000 : undefined, n.name);
  }
  assert.deepEqual(httpNodes(5).filter((n) => !/\/crm\//.test(n.parameters.url)).map((n) => n.name).sort(), ['Ask a person', 'Ask the AI step']);
  const further = read('participant/guide.md').split('**Going further: not taught here')[1].replace(/\s+/g, ' ');
  assert.ok(further.includes("The flow's own webhook takes an enquiry from anyone who can reach its address, and the honeypot is its only defence against robots."));
  assert.ok(further.includes("n8n keeps each run's data, names and e-mail addresses included."));
  assert.ok(further.includes('This lab is a place to learn, not something to put in front of real enquiries as it is.'));
});

// ---------- the values in the prose ----------

function httpNodes(n) {
  return load('stage-' + n + '-solution.json').nodes.filter((x) => x.type === 'n8n-nodes-base.httpRequest');
}

test('every office address a stage names is called by a node of its solution, with the method the text gives', () => {
  for (const { n, text } of stages()) {
    for (const m of text.matchAll(/`(http:\/\/office:3333[^`]*)`/g)) {
      const at = m[1];
      let nodes = httpNodes(n).filter((x) => x.parameters.url.replace(/^=/, '').startsWith(at));
      assert.ok(nodes.length, 'stage ' + n + ': a node calls ' + at);
      // When the sentence names the node in bold just before the address, it is that node's address and method.
      const before = text.slice(Math.max(0, m.index - 160), m.index);
      const named = [...before.matchAll(/\*\*([^*]+)\*\*/g)].pop();
      const own = named && httpNodes(n).find((x) => x.name === named[1]);
      if (own) {
        assert.ok(own.parameters.url.replace(/^=/, '').startsWith(at), 'stage ' + n + ': ' + own.name + ' calls ' + at);
        nodes = [own];
      }
      const method = before.slice(-80).match(/`(GET|POST)`[^`]*$/);
      if (method && at !== 'http://office:3333') {
        assert.ok(nodes.some((x) => x.parameters.method === method[1]), 'stage ' + n + ': ' + method[1] + ' ' + at);
      }
    }
  }
});

test('every status code the text gives beside an answer\'s name is that answer\'s code', () => {
  for (const { n, text } of stages()) {
    const answers = load('stage-' + n + '-solution.json').nodes.filter((x) => x.type === 'n8n-nodes-base.respondToWebhook');
    for (const a of answers) {
      const re = new RegExp('[*`]' + a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[*`]([^\\n]{0,40})', 'g');
      for (const m of text.matchAll(re)) {
        const code = m[1].match(/\b([2-5]\d\d)\b/);
        if (code) assert.equal(Number(code[1]), a.parameters.options.responseCode || 200, 'stage ' + n + ': ' + a.name + ' ' + m[0]);
      }
    }
  }
});

test('the timeout, the badge and the On Error settings the text describes are those of the files', () => {
  for (const { n, text } of stages()) {
    if (/five-second timeout/.test(text)) {
      for (const x of httpNodes(n).filter((y) => /\/crm\//.test(y.parameters.url))) assert.equal(x.parameters.options.timeout, 5000, 'stage ' + n + ': ' + x.name);
    }
    const badge = text.match(/header\s+`([^`]+)` with the value `([^`]+)`/);
    if (badge) {
      for (const x of httpNodes(n).filter((y) => /\/crm\//.test(y.parameters.url))) {
        assert.deepEqual(x.parameters.headerParameters.parameters, [{ name: badge[1], value: badge[2] }], 'stage ' + n + ': ' + x.name);
      }
    }
    for (const node of load('stage-' + n + '-starter.json').nodes) {
      const re = new RegExp('\\*\\*' + node.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\*\\*(?:(?!\\*\\*)[^]){0,200}?\\*On Error\\* (?:setting )?is already +\\*([^*]+)\\*', 'g');
      for (const m of text.matchAll(re)) assert.equal(node.onError, label('onError', m[1]), 'stage ' + n + ': ' + node.name);
    }
  }
  assert.match(stages()[2].text, /header\s+`X-Office-Badge` with the value `practice-badge`/, 'stage 3 names the badge');
});

test('the status the pages give for a second contact with the same e-mail is the one the practice CRM answers', async () => {
  const { createOffice } = require('../practice/server.js');
  const said = [];
  const s3 = stages()[2].text.replace(/\s+/g, ' ').match(/refuses a second contact with the same e-mail, with status (\d+)/);
  assert.ok(s3, 'stage 3 says what the practice CRM answers to a second contact');
  said.push(['participant/guide.md', s3[1]]);
  for (const m of read('instructor/guide.md').replace(/\s+/g, ' ').matchAll(/refuses the second with (\d+)/g)) said.push(['instructor/guide.md', m[1]]);
  assert.ok(said.length >= 3, 'the stage 3 guide and the instructor guide give it');
  const office = createOffice({ n8nUrl: 'http://127.0.0.1:9' });
  await new Promise((r) => office.server.listen(0, '127.0.0.1', r));
  try {
    const base = 'http://127.0.0.1:' + office.server.address().port;
    const create = () => fetch(base + '/crm/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-office-badge': 'practice-badge' },
      body: JSON.stringify({ name: 'Maya Rivers', email: 'maya.rivers@example.com' }),
    });
    assert.equal((await create()).status, 201);
    const second = (await create()).status;
    for (const [f, code] of said) assert.equal(Number(code), second, f);
  } finally {
    await new Promise((r) => office.server.close(r));
  }
});

// ---------- the repairs ----------

function repairSections() {
  const text = read('participant/repairs.md');
  return Object.fromEntries(text.split(/\n## Repair /).slice(1).map((s) => [s[0].toLowerCase(), s.split(/\n## /)[0]]));
}
const pick = (text, re, what) => {
  const m = text.match(re);
  assert.ok(m, what);
  return m;
};

test('each repair names its file and its form address as the files have them', () => {
  const sections = repairSections();
  assert.deepEqual(Object.keys(sections), ['a', 'b', 'c', 'd']);
  for (const [x, s] of Object.entries(sections)) {
    assert.equal(pick(s, /\*\*The file:\*\* `workflows\/([a-z0-9-]+\.json)`/, x)[1], 'repair-' + x + '-broken.json');
    const form = pick(s, /form\?path=([a-z0-9-]+)`/, x)[1];
    const broken = webhookOf(load('repair-' + x + '-broken.json')).parameters.path;
    const fixed = webhookOf(load('repair-' + x + '-fixed.json')).parameters.path;
    if (x === 'a') {
      assert.equal(form, fixed, 'repair A: the form sends to the path the repaired file listens at');
      assert.notEqual(form, broken);
    } else {
      assert.equal(form, broken, 'repair ' + x);
    }
  }
});

test('each repair\'s cause is what its broken file holds, and its fix is what its repaired file holds', () => {
  const s = repairSections();
  const node = (f, name) => byName(load(f)).get(name);
  // A
  assert.equal(webhookOf(load('repair-a-broken.json')).parameters.path, pick(s.a, /path is `([^`]+)`/, 'A cause')[1]);
  assert.equal(webhookOf(load('repair-a-fixed.json')).parameters.path, pick(s.a, /\*\*Path\*\* of \*Enquiry arrives\* to `([^`]+)`/, 'A fix')[1]);
  // B
  const q = (f) => node(f, 'Look up the contact').parameters.queryParameters.parameters[0];
  assert.equal(q('repair-b-broken.json').name, pick(s.b, /lookup searches by `([^`]+)`/, 'B cause')[1]);
  assert.equal(q('repair-b-fixed.json').name, pick(s.b, /query parameter's Name to `([^`]+)`/, 'B fix name')[1]);
  assert.equal(q('repair-b-fixed.json').value, '=' + pick(s.b, /```paste\n([^\n]+)\n```/, 'B fix value')[1]);
  // C
  const c = (f) => node(f, 'Approved?').parameters.conditions.conditions[0];
  const cause = pick(s.c, /asks whether `([^`]+)` is not empty/, 'C cause')[1];
  assert.equal(c('repair-c-broken.json').leftValue, '=' + cause);
  assert.equal(c('repair-c-broken.json').operator.operation, 'notEmpty');
  assert.equal(c('repair-c-fixed.json').leftValue, '=' + pick(s.c, /```paste\n([^\n]+)\n```/, 'C fix')[1]);
  const op = pick(s.c, /operator to (String), then `([^`]+)`, and type `([^`]+)` in the right box/, 'C operator');
  assert.deepEqual(c('repair-c-fixed.json').operator, OPERATORS[op[2]]);
  assert.equal(c('repair-c-fixed.json').rightValue, op[3]);
  // D
  const note = (f) => node(f, 'Add a note');
  assert.equal(note('repair-d-broken.json').parameters.sendHeaders, undefined, 'D cause: no header');
  assert.match(s.d, /no `X-Office-Badge` header/);
  const header = pick(s.d, /Name `([^`]+)` and Value\s+`([^`]+)`/, 'D fix header');
  assert.deepEqual(note('repair-d-fixed.json').parameters.headerParameters.parameters, [{ name: header[1], value: header[2] }]);
  assert.equal(note('repair-d-broken.json').onError, label('onError', pick(s.d, /\*On Error\* is `([^`]+)`/, 'D hint')[1]));
  const full = pick(s.d, /\*\*The full repair\*\*[\s\S]*?set \*\*On Error\*\* to `([^`]+)`/, 'D full repair')[1];
  for (const n of ['Look up the contact', 'Add a note', 'Create the contact']) assert.equal(node('repair-d-fixed.json', n).onError, label('onError', full), n);
  assert.equal(label('onError', pick(s.d, /\*\*The minimum repair\.\*\*[\s\S]*?set \*\*On Error\*\* back to `([^`]+)`/, 'D minimum')[1]), 'stopWorkflow');
});

test('the answer key\'s causes are in the broken files, and its files exist', () => {
  const key = read('instructor/answer-key.md');
  for (const m of key.matchAll(/`((?:workflows|docs\/pictures)\/[^`]+)`/g)) assert.ok(fs.existsSync(path.join(ROOT, m[1])), m[1]);
  const row = (x) => pick(key, new RegExp('\\| ' + x + ' \\| `workflows/repair-' + x.toLowerCase() + '-broken\\.json` \\|[^|]+\\|([^\\n]+)\\|'), 'answer key ' + x)[1];
  const node = (x, name) => byName(load('repair-' + x + '-broken.json')).get(name);
  assert.equal(webhookOf(load('repair-a-broken.json')).parameters.path, row('A').match(/`([^`]+)`/)[1]);
  assert.equal(node('b', 'Look up the contact').parameters.queryParameters.parameters[0].name, row('B').match(/`([^`]+)`/)[1]);
  assert.equal(node('c', 'Approved?').parameters.conditions.conditions[0].leftValue, '=' + row('C').match(/`([^`]+)`/)[1]);
  assert.equal(node('d', 'Add a note').onError, row('D').match(/`([^`]+)`/)[1]);
});

test('the practical check\'s cause is in its broken file, its repair in its repaired file, and its minutes are scheduled', () => {
  const text = read('instructor/practical-check.md');
  const broken = read('workflows/check-g-broken.json');
  const fixed = read('workflows/check-g-fixed.json');
  const cause = pick(text, /note field reads `([^`]+)`/, 'the cause')[1];
  const repair = pick(text, /\*note\* in \*Create the contact\*\) to\s+`([^`]+)`/, 'the repair')[1];
  assert.ok(broken.includes(JSON.stringify('=' + cause)) && !fixed.includes(JSON.stringify('=' + cause)));
  assert.ok(fixed.includes(JSON.stringify('=' + repair)) && !broken.includes(JSON.stringify('=' + repair)));
  assert.equal(pick(text, /form\?path=([a-z0-9-]+)`/, 'the form')[1], webhookOf(JSON.parse(broken)).parameters.path);
  const minutes = Number(pick(text, /\*\*Planned minutes:\*\* (\d+)/, 'its minutes')[1]);
  const words = { fifteen: 15, ten: 10, twenty: 20 };
  assert.equal(words[pick(text, /You have (\w+) minutes/, 'the task')[1]], minutes, 'the task gives the planned minutes');
  assert.match(read('instructor/variants.md'), new RegExp('practical check[^]{0,80}?takes ' + minutes + ' planned minutes'));
});
