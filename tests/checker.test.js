'use strict';
// The static checker refuses each kind of unsafe or unsound workflow file, and passes every file in workflows/.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkText, checkFiles } = require('../tools/check-workflows.js');

const ROOT = path.join(__dirname, '..');
const GOOD_FILE = 'stage-3-solution.json';
const good = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', GOOD_FILE), 'utf8'));
const problemsOf = (wf, name) => checkText(name || GOOD_FILE, JSON.stringify(wf)).problems;
const node = (wf, name) => wf.nodes.find((n) => n.name === name);

function refuses(label, mutate, expected, name) {
  test('the checker refuses ' + label, () => {
    const wf = good();
    const out = mutate(wf) || wf;
    const problems = problemsOf(out, name);
    assert.ok(problems.some((p) => expected.test(p)), 'expected a problem matching ' + expected + ', got: ' + JSON.stringify(problems));
  });
}

test('every workflow file in workflows/ passes the static checks', () => {
  const dir = path.join(ROOT, 'workflows');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));
  assert.equal(files.length, 22);
  for (const r of checkFiles(files)) assert.deepEqual(r.problems, [], r.file);
});

test('the good file used below passes on its own', () => {
  assert.deepEqual(problemsOf(good()), []);
});

test('the checker refuses a file that is not JSON (the text itself)', () => {
  assert.match(checkText(GOOD_FILE, '{ "id": ').problems.join(' '), /not valid JSON/);
});
refuses('a file name outside the lab\'s patterns', () => undefined, /file name/, 'my-flow.json');
refuses('a missing id', (wf) => {
  delete wf.id;
}, /no id/);
refuses('a credentials block on a node', (wf) => {
  node(wf, 'Add a note').credentials = { httpHeaderAuth: { id: '1', name: 'CRM' } };
}, /credentials block/);
refuses('a credentials block anywhere, even inside parameters', (wf) => {
  node(wf, 'Add a note').parameters.options.credentials = 'x';
}, /credentials block/);
refuses('an account or instance id at the top', (wf) => {
  wf.meta = { instanceId: 'abc' };
}, /unexpected key at the top: "meta"/);
refuses('an owner or sharing record at the top', (wf) => {
  wf.shared = [{ role: 'workflow:owner' }];
}, /unexpected key at the top: "shared"/);
refuses('an unexpected key on a node', (wf) => {
  node(wf, 'Add a note').notesInFlow = true;
}, /unexpected key "notesInFlow"/);
refuses('a node type outside the stated list', (wf) => {
  node(wf, 'Add a note').type = 'n8n-nodes-base.gmail';
}, /not in the stated list/);
refuses('a stated node type at another version', (wf) => {
  node(wf, 'Add a note').typeVersion = 4.2;
}, /version 4\.2/);
refuses('an address beyond the practice office', (wf) => {
  node(wf, 'Add a note').parameters.url = 'https://crm.example.com/api/notes';
}, /beyond the practice office: https:\/\/crm\.example\.com/);
refuses('an address that only starts like the office', (wf) => {
  node(wf, 'Add a note').parameters.url = 'http://office:3333.example.com/notes';
}, /beyond the practice office/);
refuses('an e-mail address outside example.com', (wf) => {
  // Built at run time, so that no address outside example.com is written in this repository.
  node(wf, 'Create the contact').parameters.bodyParameters.parameters[1].value = ['someone', 'realmail.test'].join('@');
}, /outside example\.com/);
refuses('an IP address', (wf) => {
  node(wf, 'Add a note').parameters.url = 'http://office:3333/crm?via=' + ['10', '0', '0', '5'].join('.');
}, /IP address: 10\.0\.0\.5/);
refuses('authentication on an HTTP node', (wf) => {
  node(wf, 'Add a note').parameters.authentication = 'genericCredentialType';
}, /authentication/);
refuses('a node that nothing leads to', (wf) => {
  delete wf.connections['Known contact?'];
}, /not connected/);
refuses('a connection to a node that does not exist', (wf) => {
  wf.connections['Known contact?'].main[0].push({ node: 'Ghost', type: 'main', index: 0 });
}, /does not exist: "Ghost"/);
refuses('two webhook triggers', (wf) => {
  const copy = JSON.parse(JSON.stringify(node(wf, 'Enquiry arrives')));
  copy.name = 'Second trigger';
  copy.id = 'another-id';
  wf.nodes.push(copy);
  wf.connections['Second trigger'] = { main: [[{ node: 'Has an e-mail?', type: 'main', index: 0 }]] };
}, /exactly one Webhook trigger/);
refuses('a webhook path with capital letters or a slash', (wf) => {
  node(wf, 'Enquiry arrives').parameters.path = 'Stage/3';
}, /webhook path must be/);
refuses('a file that is published', (wf) => {
  wf.active = true;
}, /"active" must be false/);
refuses('recorded data (pinData)', (wf) => {
  wf.pinData = { 'Enquiry arrives': [{ json: { email: 'maya.rivers@example.com' } }] };
}, /pinData/);
refuses('two nodes with the same name', (wf) => {
  node(wf, 'Create the contact').name = 'Add a note';
}, /two nodes named/);

// Key-shaped values are built at run time, so that this repository holds none written out.
const TOKEN = ['sk', 'live', 'A1b2C3d4E5f6G7h8I9j0K1l2'].join('-');
const LONG = ['Q7w2E9r4T6y1U3i8', 'O5p0A2s7D4f9G6h3'].join('');

refuses('a key-shaped value as a header value', (wf) => {
  node(wf, 'Look up the contact').parameters.headerParameters.parameters[0].value = TOKEN;
}, /token-like value/);
refuses('a long run of letters and digits as a query value', (wf) => {
  node(wf, 'Look up the contact').parameters.queryParameters.parameters.push({ name: 'ref', value: LONG });
}, /token-like value/);
refuses('a bearer token in a body field', (wf) => {
  node(wf, 'Create the contact').parameters.bodyParameters.parameters.push({ name: 'auth', value: 'Bearer ' + LONG });
}, /token-like value/);
refuses('a header named like a secret', (wf) => {
  node(wf, 'Look up the contact').parameters.headerParameters.parameters.push({ name: 'Authorization', value: 'x' });
}, /header named like a secret: Authorization/);
refuses('a query parameter named like a secret', (wf) => {
  node(wf, 'Look up the contact').parameters.queryParameters.parameters.push({ name: 'api_key', value: 'x' });
}, /query parameter named like a secret: api_key/);
refuses('an address with no scheme', (wf) => {
  node(wf, 'Add a note').parameters.url = 'collector.vendor.example.org/in';
}, /not written out as one of the practice office/);
refuses('an address built in an expression', (wf) => {
  node(wf, 'Add a note').parameters.url = "={{ 'ht' + 'tp:' + '//collector.vendor.example.org/in' }}";
}, /not written out as one of the practice office/);
refuses('an address that hides another host behind the office\'s name', (wf) => {
  node(wf, 'Add a note').parameters.url = ['http://office:3333', 'vendor.example.org/in'].join('@');
}, /not written out as one of the practice office/);
refuses('a phone-like number in a body field', (wf) => {
  node(wf, 'Create the contact').parameters.bodyParameters.parameters.push({ name: 'phone', value: '+1 415 555 0134' });
}, /phone-like number/);
refuses('an address in a node name', (wf) => {
  node(wf, 'Known contact?').name = 'Known at https://crm.example.com';
  wf.connections['Look up the contact'].main[0][0].node = 'Known at https://crm.example.com';
  wf.connections['Known at https://crm.example.com'] = wf.connections['Known contact?'];
  delete wf.connections['Known contact?'];
}, /node name "Known at https:\/\/crm\.example\.com" holds an address/);
refuses('an e-mail address in the workflow name', (wf) => {
  wf.name = 'For ' + ['someone', 'realmail.test'].join('@');
}, /workflow name .* holds an e-mail address/);
refuses('a node name longer than sixty characters', (wf) => {
  node(wf, 'Known contact?').name = 'K'.repeat(61);
}, /longer than 60 characters/);
refuses('an error workflow or another setting', (wf) => {
  wf.settings.errorWorkflow = 'abc123';
}, /settings must be exactly/);
refuses('a disabled node', (wf) => {
  node(wf, 'Known contact?').disabled = true;
}, /unexpected key "disabled"/);

test('the checker allows a key-free value: the practice badge, the stage-4 code, and the ids n8n gives If conditions', () => {
  for (const f of ['stage-3-solution.json', 'stage-4-solution.json', 'stage-6-solution.json']) {
    const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', f), 'utf8'));
    assert.deepEqual(checkText(f, JSON.stringify(wf)).problems, [], f);
  }
});

test('a starter may bring nodes that the trigger does not lead to yet (the stage\'s parts); any other file may not', () => {
  const starter = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', 'stage-3-starter.json'), 'utf8'));
  const r = checkText('stage-3-starter.json', JSON.stringify(starter));
  assert.deepEqual(r.problems, []);
  assert.equal(r.parts, 4);
  assert.match(checkText('stage-3-solution.json', JSON.stringify(starter)).problems.join(' '), /"Look up the contact" is not connected/);
});

test('the checker refuses two files with the same webhook path, or the same id', () => {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'lab-checker-'));
  try {
    const a = good();
    const b = good();
    b.id = 'anotherWorkflowId1';
    fs.writeFileSync(path.join(dir, 'stage-3-solution.json'), JSON.stringify(a));
    fs.writeFileSync(path.join(dir, 'stage-4-solution.json'), JSON.stringify(b));
    let results = checkFiles([path.join(dir, 'stage-3-solution.json'), path.join(dir, 'stage-4-solution.json')]);
    assert.match(results[1].problems.join(' '), /webhook path stage-3-solution is also used by stage-3-solution\.json/);
    b.id = a.id;
    node(b, 'Enquiry arrives').parameters.path = 'elsewhere';
    fs.writeFileSync(path.join(dir, 'stage-4-solution.json'), JSON.stringify(b));
    results = checkFiles([path.join(dir, 'stage-3-solution.json'), path.join(dir, 'stage-4-solution.json')]);
    assert.match(results[1].problems.join(' '), /the id .* is also used/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a lone trigger is allowed (the first starter has nothing to connect yet)', () => {
  const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', 'stage-1-starter.json'), 'utf8'));
  assert.equal(wf.nodes.length, 1);
  assert.deepEqual(checkText('stage-1-starter.json', JSON.stringify(wf)).problems, []);
});
