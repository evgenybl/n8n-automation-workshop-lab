'use strict';
// Writes every workflow file in workflows/ from the definitions below, so that each starter is exactly the previous
// stage's solution and each broken file differs from its repaired file in the one place its exercise describes.
//
//   node tools/build-workflows.js           writes the files
//   node tools/build-workflows.js --check   fails if a file in workflows/ differs from what this script writes
//
// Webhook paths: a stage's starter listens at stage-N (the participant's own flow), its solution at stage-N-solution;
// a repair's broken file at repair-x (repair A: at a misspelt path), its repaired file at repair-x-fixed (repair A:
// at repair-a, the path the form sends to); the practical check at check-g and check-g-fixed.

const fs = require('node:fs');
const path = require('node:path');
const { Flow, webhook, respond, ifNode, http, code, wait, OFFICE } = require('./flow-kit');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'workflows');

const E = 'Enquiry arrives';
const enquiry = (field) => "={{ $('" + E + "').item.json.body." + field + ' }}';

// The Code node of stage 4, as the participant pastes it.
const CHECK_FIGURES = [
  '// Use the AI summary only if every figure in it is also in the enquiry.',
  "const enquiry = $('" + E + "').first().json.body;",
  "const summary = $input.first().json.summary || '';",
  '',
  '// Every figure in a text, such as 12 or 1,200 (written 1200 here).',
  "const figures = (text) => (String(text || '').match(/\\d+(?:[.,]\\d+)*/g) || []).map((f) => f.replace(/,/g, ''));",
  '',
  'const inEnquiry = figures(enquiry.message);',
  'const notInEnquiry = figures(summary).filter((f) => !inEnquiry.includes(f));',
  'const summaryUsed = notInEnquiry.length === 0;',
  '',
  'const note = summaryUsed',
  "  ? 'Message: ' + enquiry.message + '\\nAI summary (checked): ' + summary",
  "  : 'Message: ' + enquiry.message + '\\nAI summary not used: it gives figures that are not in the enquiry (' + notInEnquiry.join(', ') + ').';",
  '',
  'return [{ json: { summaryUsed, notInEnquiry, note } }];',
].join('\n');

// ---------- the six stages ----------

function stage1(id, name, p) {
  return new Flow(id, name)
    .add(webhook(E, p), 0, 0)
    .add(respond('Answer with the name', 200, '{\n  "status": "received",\n  "name": "{{ $json.body.name }}"\n}'), 1, 0)
    .connect(E, 'Answer with the name');
}

function stage1Starter(id, name, p) {
  return new Flow(id, name).add(webhook(E, p, 'onReceived'), 0, 0);
}

function addChecks(f) {
  f.add(ifNode('Has an e-mail?', [['={{ $json.body.email }}', 'contains', '@']]), 1, 0)
    .add(ifNode('Honeypot empty?', [['={{ $json.body.website }}', 'empty']]), 2, 0)
    .add(ifNode('Consent given?', [['={{ $json.body.consent }}', 'true']]), 3, 0)
    .add(respond('Refuse: no e-mail', 400, '{\n  "status": "refused",\n  "reason": "The enquiry has no e-mail address."\n}'), 2, 1)
    .add(respond('Refuse: looks like a robot', 400, '{\n  "status": "refused",\n  "reason": "The hidden website field is filled in, so this looks like a robot."\n}'), 3, 1)
    .add(respond('Refuse: no consent', 400, '{\n  "status": "refused",\n  "reason": "The enquiry does not agree to be contacted."\n}'), 4, 1)
    .connect(E, 'Has an e-mail?')
    .connect('Has an e-mail?', 'Honeypot empty?', 0)
    .connect('Has an e-mail?', 'Refuse: no e-mail', 1)
    .connect('Honeypot empty?', 'Consent given?', 0)
    .connect('Honeypot empty?', 'Refuse: looks like a robot', 1)
    .connect('Consent given?', 'Refuse: no consent', 1);
  return f;
}

function stage2(id, name, p) {
  const f = new Flow(id, name).add(webhook(E, p), 0, 0);
  addChecks(f);
  f.add(respond('Answer with the name', 200, '{\n  "status": "received",\n  "name": "{{ $json.body.name }}"\n}'), 4, 0)
    .connect('Consent given?', 'Answer with the name', 0);
  return f;
}

// The CRM part: look the contact up by e-mail, then add a note or create it (with its first note).
// noteText: the expression for the note. at: [column, row] of the lookup.
function addCrm(f, noteText, at, lookupField) {
  const [c, r] = at;
  f.add(http('Look up the contact', { url: OFFICE + '/crm/contacts', query: [[lookupField || 'email', enquiry(lookupField || 'email')]], badge: true }), c, r)
    .add(ifNode('Known contact?', [['={{ $json.found }}', 'true']]), c + 1, r)
    .add(http('Add a note', { method: 'POST', url: '=' + OFFICE + '/crm/contacts/{{ $json.contact.id }}/notes', badge: true, body: [['text', noteText]] }), c + 2, r)
    .add(http('Create the contact', {
      method: 'POST',
      url: OFFICE + '/crm/contacts',
      badge: true,
      body: [['name', enquiry('name')], ['email', enquiry('email')], ['company', enquiry('company')], ['note', noteText]],
    }), c + 2, r + 1)
    .add(respond('Answer: recorded', 200, '{\n  "status": "recorded",\n  "contact": "{{ $json.contact }}"\n}'), c + 3, r)
    .connect('Look up the contact', 'Known contact?')
    .connect('Known contact?', 'Add a note', 0)
    .connect('Known contact?', 'Create the contact', 1)
    .connect('Add a note', 'Answer: recorded')
    .connect('Create the contact', 'Answer: recorded');
  return f;
}

function stage3(id, name, p, lookupField) {
  const f = new Flow(id, name).add(webhook(E, p), 0, 0);
  addChecks(f);
  addCrm(f, enquiry('message'), [0, 2], lookupField);
  f.connect('Consent given?', 'Look up the contact', 0);
  return f;
}

function addAi(f, at, checkAt) {
  const [c, r] = at;
  f.add(http('Ask the AI step', { method: 'POST', url: OFFICE + '/ai/read', body: [['name', '={{ $json.body.name }}'], ['message', '={{ $json.body.message }}']] }), c, r)
    .add(code('Check the AI figures', CHECK_FIGURES), checkAt[0], checkAt[1])
    .connect('Consent given?', 'Ask the AI step', 0)
    .connect('Ask the AI step', 'Check the AI figures');
  return f;
}

const CHECKED_NOTE = "={{ $('Check the AI figures').item.json.note }}";

function stage4(id, name, p, noteText) {
  const f = new Flow(id, name).add(webhook(E, p), 0, 0);
  addChecks(f);
  addAi(f, [4, 0], [0, 2]);
  addCrm(f, noteText || CHECKED_NOTE, [1, 2]);
  f.connect('Check the AI figures', 'Look up the contact');
  return f;
}

// Stage 5 lays the flow out in two bands: the intake on top, what happens after the decision below.
function addApproval(f, approvedCondition) {
  f.add(http('Ask a person', {
    method: 'POST',
    url: OFFICE + '/inbox',
    body: [['name', enquiry('name')], ['email', enquiry('email')], ['message', enquiry('message')], ['summary', '={{ $json.note }}'], ['resumeUrl', '={{ $execution.resumeUrl }}']],
  }), 1, 2)
    .add(respond('Answer: waiting for approval', 202, '{\n  "status": "waiting for approval",\n  "approval": "{{ $json.id }}"\n}'), 2, 2)
    .add(wait('Wait for the decision'), 3, 2)
    .add(ifNode('Approved?', [approvedCondition || ['={{ $json.body.decision }}', 'equals', 'approve']]), 4, 2)
    .add(respond('Tell the approver: nothing written', 200, '{\n  "status": "rejected",\n  "written": "nothing"\n}'), 4, 3)
    .connect('Check the AI figures', 'Ask a person')
    .connect('Ask a person', 'Answer: waiting for approval')
    .connect('Answer: waiting for approval', 'Wait for the decision')
    .connect('Wait for the decision', 'Approved?')
    .connect('Approved?', 'Tell the approver: nothing written', 1);
  return f;
}

function stage5(id, name, p, approvedCondition) {
  const f = new Flow(id, name).add(webhook(E, p), 0, 0);
  addChecks(f);
  addAi(f, [4, 0], [0, 2]);
  addApproval(f, approvedCondition);
  addCrm(f, CHECKED_NOTE, [0, 4]);
  f.connect('Approved?', 'Look up the contact', 0);
  return f;
}

const CRM_TIMEOUT = 5000;

function stage6(id, name, p) {
  const f = stage5(id, name, p);
  for (const n of ['Look up the contact', 'Add a note', 'Create the contact']) {
    const node = f.node(n);
    node.onError = 'continueErrorOutput';
    node.parameters.options.timeout = CRM_TIMEOUT;
  }
  f.node('Answer: recorded').position = [4 * 260, 4 * 180];
  f.disconnect('Add a note', 'Answer: recorded').disconnect('Create the contact', 'Answer: recorded');
  f.add(ifNode('CRM confirmed?', [['={{ $json.contact }}', 'notEmpty']]), 3, 4)
    .add(http('Tell the office', { method: 'POST', url: OFFICE + '/alerts', body: [['step', '={{ $prevNode.name }}'], ['reason', '={{ $json.error.message }}'], ['email', enquiry('email')]] }), 1, 6)
    .add(http('Tell the office: not confirmed', { method: 'POST', url: OFFICE + '/alerts', body: [['step', 'Write to the CRM'], ['reason', 'The CRM answered, but its answer did not confirm the write.'], ['email', enquiry('email')]] }), 4, 5)
    .add(respond('Answer: failed', 502, '{\n  "status": "failed",\n  "step": "{{ $json.step }}",\n  "written": "nothing",\n  "alert": "{{ $json.id }}"\n}'), 4, 6)
    .connect('Add a note', 'CRM confirmed?', 0)
    .connect('Create the contact', 'CRM confirmed?', 0)
    .connect('CRM confirmed?', 'Answer: recorded', 0)
    .connect('CRM confirmed?', 'Tell the office: not confirmed', 1)
    .connect('Look up the contact', 'Tell the office', 1)
    .connect('Add a note', 'Tell the office', 1)
    .connect('Create the contact', 'Tell the office', 1)
    .connect('Tell the office', 'Answer: failed')
    .connect('Tell the office: not confirmed', 'Answer: failed');
  return f;
}

// ---------- the files ----------

function buildAll() {
  const files = {};
  const put = (file, flow) => {
    files[file] = flow;
  };

  const solutions = [stage1, stage2, stage3, stage4, stage5, stage6];
  const titles = ['Catch an enquiry', 'Refuse a bad one', 'No duplicates', 'Ask the AI step, and check it', 'A person approves', 'When it fails'];
  for (let n = 1; n <= 6; n++) {
    const sol = solutions[n - 1]('labStage' + n + 'Solution', 'Stage ' + n + ' solution: ' + titles[n - 1], 'stage-' + n + '-solution');
    put('stage-' + n + '-solution.json', sol);
    const starterId = 'labStage' + n + 'Starter00';
    const starterName = 'Stage ' + n + ' starter: ' + titles[n - 1];
    const starter = n === 1 ? stage1Starter(starterId, starterName, 'stage-1') : solutions[n - 2](starterId, starterName, 'stage-' + n);
    put('stage-' + n + '-starter.json', starter);
  }

  // Repair A: the webhook listens at a misspelt path; the form sends to repair-a.
  put('repair-a-broken.json', stage3('labRepairABroken0', 'Repair A, broken: nothing happens', 'repiar-a'));
  put('repair-a-fixed.json', stage3('labRepairAFixed00', 'Repair A, repaired', 'repair-a'));

  // Repair B: the duplicate check looks the contact up by name instead of e-mail.
  put('repair-b-broken.json', stage3('labRepairBBroken0', 'Repair B, broken: the second enquiry crashes', 'repair-b', 'name'));
  put('repair-b-fixed.json', stage3('labRepairBFixed00', 'Repair B, repaired', 'repair-b-fixed'));

  // Repair C: the approval check reads the wrong field, so a rejected enquiry is written anyway.
  put('repair-c-broken.json', stage5('labRepairCBroken0', 'Repair C, broken: a rejected enquiry is written', 'repair-c', ['={{ $json.body.approval }}', 'notEmpty']));
  put('repair-c-fixed.json', stage5('labRepairCFixed00', 'Repair C, repaired', 'repair-c-fixed'));

  // Repair D: the note call lacks its header, and its failure is passed on as if it were a result.
  const dBroken = stage3('labRepairDBroken0', 'Repair D, broken: says done, no note', 'repair-d');
  const note = dBroken.node('Add a note');
  delete note.parameters.sendHeaders;
  delete note.parameters.headerParameters;
  note.onError = 'continueRegularOutput';
  put('repair-d-broken.json', dBroken);
  // The repair: the header back on the note call, and every CRM call set to use its error output.
  const dFixed = stage3('labRepairDFixed00', 'Repair D, repaired', 'repair-d-fixed');
  for (const n of ['Look up the contact', 'Add a note', 'Create the contact']) dFixed.node(n).onError = 'continueErrorOutput';
  dFixed
    .add(http('Tell the office', { method: 'POST', url: OFFICE + '/alerts', body: [['step', '={{ $prevNode.name }}'], ['reason', '={{ $json.error.message }}'], ['email', enquiry('email')]] }), 1, 4)
    .add(respond('Answer: failed', 502, '{\n  "status": "failed",\n  "step": "{{ $json.step }}",\n  "written": "nothing",\n  "alert": "{{ $json.id }}"\n}'), 3, 4)
    .connect('Look up the contact', 'Tell the office', 1)
    .connect('Add a note', 'Tell the office', 1)
    .connect('Create the contact', 'Tell the office', 1)
    .connect('Tell the office', 'Answer: failed');
  put('repair-d-fixed.json', dFixed);

  // The practical check (instructor only): the note uses the AI summary as it came, not the checked note.
  put('check-g-broken.json', stage4('labCheckGBroken00', 'Check G, broken: a figure nobody wrote', 'check-g', "={{ $('Ask the AI step').item.json.summary }}"));
  put('check-g-fixed.json', stage4('labCheckGFixed000', 'Check G, repaired', 'check-g-fixed'));

  return files;
}

function main(argv) {
  const check = argv.includes('--check');
  const files = buildAll();
  let differ = 0;
  if (!check) fs.mkdirSync(DIR, { recursive: true });
  for (const [file, flow] of Object.entries(files)) {
    const text = JSON.stringify(flow, null, 2) + '\n';
    const target = path.join(DIR, file);
    if (check) {
      const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
      if (current !== text) {
        differ++;
        console.log('DIFFERS  workflows/' + file + (current === null ? ' (missing)' : ''));
      }
    } else {
      fs.writeFileSync(target, text);
    }
  }
  const present = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];
  for (const f of present) {
    if (!files[f]) {
      differ++;
      console.log((check ? 'EXTRA    ' : 'NOT MADE BY THIS SCRIPT ') + 'workflows/' + f);
    }
  }
  console.log(check
    ? (differ ? differ + ' workflow file(s) differ from tools/build-workflows.js.' : 'Every workflow file is what tools/build-workflows.js writes (' + Object.keys(files).length + ').')
    : 'Wrote ' + Object.keys(files).length + ' workflow files.');
  return differ ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { buildAll, CHECK_FIGURES };
