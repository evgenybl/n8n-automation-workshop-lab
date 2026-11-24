'use strict';
// Writes every workflow file in workflows/ from the definitions below.
//
//   node tools/build-workflows.js           writes the files
//   node tools/build-workflows.js --check   fails if a file in workflows/ differs from what this script writes
//
// A stage's solution is the finished flow of that stage. A stage's starter is the previous stage's solution, plus the
// stage's "parts": nodes already placed and mostly set up, not yet connected to the flow, so that the participant sets
// only what carries the stage's idea (PARTS below names what is left for them). Each broken file differs from its
// repaired file in the one place its exercise describes.
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
const CRM_TIMEOUT = 5000;

// The Code node of stage 4, as the participant pastes it.
const CHECK_FIGURES = [
  '// Use the AI summary only if the AI step answered and every figure in its summary is also in the enquiry.',
  "const enquiry = $('" + E + "').first().json.body;",
  'const answer = $input.first().json;',
  "const summary = answer.summary || '';",
  '',
  '// Every figure in a text, such as 12 or 1,200 (written 1200 here).',
  "const figures = (text) => (String(text || '').match(/\\d+(?:[.,]\\d+)*/g) || []).map((f) => f.replace(/,/g, ''));",
  '',
  'const inEnquiry = figures(enquiry.message);',
  'const notInEnquiry = figures(summary).filter((f) => !inEnquiry.includes(f));',
  'const aiFailed = Boolean(answer.error);',
  'const summaryUsed = !aiFailed && notInEnquiry.length === 0;',
  '',
  "let note = 'Message: ' + enquiry.message + '\\n';",
  "if (aiFailed) note += 'AI summary not used: the AI step did not answer.';",
  "else if (summaryUsed) note += 'AI summary (checked): ' + summary;",
  "else note += 'AI summary not used: it gives figures that are not in the enquiry (' + notInEnquiry.join(', ') + ').';",
  '',
  'return [{ json: { summaryUsed, notInEnquiry, note } }];',
].join('\n');

const CODE_PLACEHOLDER = ['// Paste the code from the lab guide here, replacing these two lines.', 'return $input.all();'].join('\n');
const CHECKED_NOTE = "={{ $('Check the AI figures').item.json.note }}";

// ---------- the nodes, finished ----------

const N = {
  answerName: () => respond('Answer with the name', 200, '{\n  "status": "received",\n  "name": {{ JSON.stringify($json.body.name) }}\n}'),
  hasEmail: () => ifNode('Has an e-mail?', [['={{ $json.body.email }}', 'contains', '@']]),
  honeypot: () => ifNode('Honeypot empty?', [['={{ $json.body.website }}', 'empty']]),
  // Compared as text with "Convert types where required" on: true passes; false, "on" or nothing is refused, never an error.
  consent: () => ifNode('Consent given?', [['={{ $json.body.consent }}', 'equals', 'true']], true),
  refuseEmail: () => respond('Refuse: no e-mail', 400, '{\n  "status": "refused",\n  "reason": "The enquiry has no e-mail address."\n}'),
  refuseRobot: () => respond('Refuse: looks like a robot', 400, '{\n  "status": "refused",\n  "reason": "The hidden website field is filled in, so this looks like a robot."\n}'),
  refuseConsent: () => respond('Refuse: no consent', 400, '{\n  "status": "refused",\n  "reason": "The enquiry does not agree to be contacted: consent must be true."\n}'),
  lookup: (field) => http('Look up the contact', { url: OFFICE + '/crm/contacts', query: [[field || 'email', enquiry(field || 'email')]], badge: true, timeout: CRM_TIMEOUT }),
  known: () => ifNode('Known contact?', [['={{ $json.found }}', 'true']]),
  addNote: (noteText) => http('Add a note', { method: 'POST', url: '=' + OFFICE + '/crm/contacts/{{ $json.contact.id }}/notes', badge: true, body: [['text', noteText]], timeout: CRM_TIMEOUT }),
  create: (noteText) => http('Create the contact', {
    method: 'POST',
    url: OFFICE + '/crm/contacts',
    badge: true,
    body: [['name', enquiry('name')], ['email', enquiry('email')], ['company', enquiry('company')], ['note', noteText]],
    timeout: CRM_TIMEOUT,
  }),
  answerRecorded: () => respond('Answer: recorded', 200, '{\n  "status": "recorded",\n  "contact": "{{ $json.contact }}"\n}'),
  askAi: () => http('Ask the AI step', { method: 'POST', url: OFFICE + '/ai/read', body: [['name', '={{ $json.body.name }}'], ['message', '={{ $json.body.message }}']], onError: 'continueErrorOutput' }),
  checkFigures: (jsCode) => code('Check the AI figures', jsCode || CHECK_FIGURES),
  askPerson: (resumeUrl) => http('Ask a person', {
    method: 'POST',
    url: OFFICE + '/inbox',
    body: [['name', enquiry('name')], ['email', enquiry('email')], ['message', enquiry('message')], ['summary', '={{ $json.note }}'], ['resumeUrl', resumeUrl === undefined ? '={{ $execution.resumeUrl }}' : resumeUrl]],
    onError: 'continueErrorOutput',
  }),
  answerWaiting: () => respond('Answer: waiting for approval', 202, '{\n  "status": "waiting for approval",\n  "approval": "{{ $json.id }}"\n}'),
  answerNotQueued: () => respond('Answer: not queued', 503, '{\n  "status": "not queued",\n  "reason": "The approval inbox did not answer, so nothing was written. Please send the enquiry again later."\n}'),
  wait: () => wait('Wait for the decision'),
  approved: (condition) => ifNode('Approved?', [condition || ['={{ $json.body.decision }}', 'equals', 'approve']]),
  nothingWritten: () => respond('Tell the approver: nothing written', 200, '{\n  "status": "rejected",\n  "written": "nothing"\n}'),
  crmConfirmed: () => ifNode('CRM confirmed?', [['={{ $json.contact }}', 'notEmpty']]),
  tellLookupFailed: () => http('Tell the office: lookup failed', { method: 'POST', url: OFFICE + '/alerts', body: [['step', '={{ $prevNode.name }}'], ['reason', '={{ $json.error.message }}'], ['email', enquiry('email')]] }),
  answerNothingWritten: () => respond('Answer: nothing written', 502, '{\n  "status": "failed",\n  "step": "{{ $json.step }}",\n  "written": "nothing",\n  "alert": "{{ $json.id }}"\n}'),
  tellWriteFailed: () => http('Tell the office: write failed', { method: 'POST', url: OFFICE + '/alerts', body: [['step', '={{ $prevNode.name }}'], ['reason', '={{ $json.error.message }}'], ['email', enquiry('email')]] }),
  tellNotConfirmed: () => http('Tell the office: not confirmed', { method: 'POST', url: OFFICE + '/alerts', body: [['step', 'Write to the CRM'], ['reason', 'The CRM answered, but its answer did not confirm the write.'], ['email', enquiry('email')]] }),
  answerCheckCrm: () => respond('Answer: check the CRM', 502, '{\n  "status": "failed",\n  "step": "{{ $json.step }}",\n  "written": "unknown: check the CRM",\n  "alert": "{{ $json.id }}"\n}'),
};

// ---------- the six solutions ----------

function intake(f) {
  f.add(N.hasEmail()).add(N.honeypot()).add(N.consent()).add(N.refuseEmail()).add(N.refuseRobot()).add(N.refuseConsent())
    .connect(E, 'Has an e-mail?')
    .connect('Has an e-mail?', 'Honeypot empty?', 0)
    .connect('Has an e-mail?', 'Refuse: no e-mail', 1)
    .connect('Honeypot empty?', 'Consent given?', 0)
    .connect('Honeypot empty?', 'Refuse: looks like a robot', 1)
    .connect('Consent given?', 'Refuse: no consent', 1);
}

function crm(f, noteText, lookupField) {
  f.add(N.lookup(lookupField)).add(N.known()).add(N.addNote(noteText)).add(N.create(noteText)).add(N.answerRecorded())
    .connect('Look up the contact', 'Known contact?')
    .connect('Known contact?', 'Add a note', 0)
    .connect('Known contact?', 'Create the contact', 1)
    .connect('Add a note', 'Answer: recorded')
    .connect('Create the contact', 'Answer: recorded');
}

function ai(f) {
  f.add(N.askAi()).add(N.checkFigures())
    .connect('Consent given?', 'Ask the AI step', 0)
    .connect('Ask the AI step', 'Check the AI figures', 0)
    .connect('Ask the AI step', 'Check the AI figures', 1);
}

const solution = {
  1: (id, name, p) => new Flow(id, name).add(webhook(E, p)).add(N.answerName()).connect(E, 'Answer with the name'),
  2: (id, name, p) => {
    const f = new Flow(id, name).add(webhook(E, p));
    intake(f);
    return f.add(N.answerName()).connect('Consent given?', 'Answer with the name', 0);
  },
  3: (id, name, p, opts) => {
    const f = new Flow(id, name).add(webhook(E, p));
    intake(f);
    crm(f, enquiry('message'), opts && opts.lookupField);
    return f.connect('Consent given?', 'Look up the contact', 0);
  },
  4: (id, name, p, opts) => {
    const f = new Flow(id, name).add(webhook(E, p));
    intake(f);
    ai(f);
    crm(f, (opts && opts.noteText) || CHECKED_NOTE);
    return f.connect('Check the AI figures', 'Look up the contact');
  },
  5: (id, name, p, opts) => {
    const f = new Flow(id, name).add(webhook(E, p));
    intake(f);
    ai(f);
    f.add(N.askPerson()).add(N.answerWaiting()).add(N.answerNotQueued()).add(N.wait()).add(N.approved(opts && opts.approvedCondition)).add(N.nothingWritten())
      .connect('Check the AI figures', 'Ask a person')
      .connect('Ask a person', 'Answer: waiting for approval', 0)
      .connect('Ask a person', 'Answer: not queued', 1)
      .connect('Answer: waiting for approval', 'Wait for the decision')
      .connect('Wait for the decision', 'Approved?')
      .connect('Approved?', 'Tell the approver: nothing written', 1);
    crm(f, CHECKED_NOTE);
    return f.connect('Approved?', 'Look up the contact', 0);
  },
  6: (id, name, p) => {
    const f = solution[5](id, name, p);
    hardenCrm(f, true);
    return f;
  },
};

// Stage 6's changes to the CRM part; repair D's repaired file uses them without the confirmation check.
function hardenCrm(f, confirm) {
  for (const n of ['Look up the contact', 'Add a note', 'Create the contact']) f.node(n).onError = 'continueErrorOutput';
  f.add(N.tellLookupFailed()).add(N.answerNothingWritten()).add(N.tellWriteFailed()).add(N.answerCheckCrm())
    .connect('Look up the contact', 'Tell the office: lookup failed', 1)
    .connect('Tell the office: lookup failed', 'Answer: nothing written')
    .connect('Add a note', 'Tell the office: write failed', 1)
    .connect('Create the contact', 'Tell the office: write failed', 1)
    .connect('Tell the office: write failed', 'Answer: check the CRM');
  if (confirm) {
    f.disconnect('Add a note', 'Answer: recorded').disconnect('Create the contact', 'Answer: recorded');
    f.add(N.crmConfirmed()).add(N.tellNotConfirmed())
      .connect('Add a note', 'CRM confirmed?', 0)
      .connect('Create the contact', 'CRM confirmed?', 0)
      .connect('CRM confirmed?', 'Answer: recorded', 0)
      .connect('CRM confirmed?', 'Tell the office: not confirmed', 1)
      .connect('Tell the office: not confirmed', 'Answer: check the CRM');
  }
}

// ---------- the parts each starter brings ----------
// Each part is a node of the stage's solution. "left" names what the participant sets in it; everything else is set.

// An If node as n8n's editor adds it: one empty condition.
const emptyIf = (name) => () => ifNode(name, [['', 'equals', '']]);

const PARTS = {
  2: {
    nodes: [emptyIf('Has an e-mail?'), emptyIf('Honeypot empty?'), emptyIf('Consent given?'), N.refuseEmail, N.refuseRobot, N.refuseConsent],
    left: { 'Has an e-mail?': 'the condition', 'Honeypot empty?': 'the condition', 'Consent given?': 'the condition and the type conversion' },
    connections: [['Has an e-mail?', 'Refuse: no e-mail', 1], ['Honeypot empty?', 'Refuse: looks like a robot', 1], ['Consent given?', 'Refuse: no consent', 1]],
  },
  3: {
    nodes: [
      () => Object.assign(N.lookup(), { parameters: Object.assign(N.lookup().parameters, { queryParameters: { parameters: [{ name: '', value: '' }] } }) }),
      () => N.addNote(enquiry('message')),
      () => N.create(enquiry('message')),
      N.answerRecorded,
    ],
    left: { 'Look up the contact': 'the query parameter: which field is looked up' },
    connections: [['Add a note', 'Answer: recorded', 0], ['Create the contact', 'Answer: recorded', 0]],
  },
  4: {
    nodes: [N.askAi, () => N.checkFigures(CODE_PLACEHOLDER)],
    left: { 'Check the AI figures': 'the code' },
    connections: [['Ask the AI step', 'Check the AI figures', 0], ['Ask the AI step', 'Check the AI figures', 1]],
  },
  5: {
    nodes: [() => N.askPerson(''), N.answerWaiting, N.answerNotQueued, N.nothingWritten],
    left: { 'Ask a person': 'the value of resumeUrl' },
    connections: [['Ask a person', 'Answer: waiting for approval', 0], ['Ask a person', 'Answer: not queued', 1]],
  },
  6: {
    nodes: [N.crmConfirmed, N.tellLookupFailed, N.answerNothingWritten, N.tellWriteFailed, N.tellNotConfirmed, N.answerCheckCrm],
    connections: [
      ['CRM confirmed?', 'Answer: recorded', 0],
      ['CRM confirmed?', 'Tell the office: not confirmed', 1],
      ['Tell the office: not confirmed', 'Answer: check the CRM', 0],
      ['Tell the office: lookup failed', 'Answer: nothing written', 0],
      ['Tell the office: write failed', 'Answer: check the CRM', 0],
    ],
  },
};

function starter(n, id, name, p) {
  if (n === 1) return new Flow(id, name).add(webhook(E, p, 'onReceived'));
  const f = solution[n - 1](id, name, p);
  for (const make of PARTS[n].nodes) f.add(make());
  for (const [from, to, out] of PARTS[n].connections) f.connect(from, to, out);
  return f;
}

// ---------- the files ----------

const TITLES = ['Catch an enquiry', 'Refuse a bad one', 'No duplicates', 'Ask the AI step, and check it', 'A person approves', 'When it fails'];

function buildAll() {
  const files = {};
  for (let n = 1; n <= 6; n++) {
    files['stage-' + n + '-solution.json'] = solution[n]('labStage' + n + 'Solution', 'Stage ' + n + ' solution: ' + TITLES[n - 1], 'stage-' + n + '-solution');
    files['stage-' + n + '-starter.json'] = starter(n, 'labStage' + n + 'Starter00', 'Stage ' + n + ' starter: ' + TITLES[n - 1], 'stage-' + n);
  }

  // Repair A: the webhook listens at a misspelt path; the form sends to repair-a.
  files['repair-a-broken.json'] = solution[3]('labRepairABroken0', 'Repair A, broken: nothing happens', 'repiar-a');
  files['repair-a-fixed.json'] = solution[3]('labRepairAFixed00', 'Repair A, repaired', 'repair-a');

  // Repair B: the duplicate check looks the contact up by name instead of e-mail.
  files['repair-b-broken.json'] = solution[3]('labRepairBBroken0', 'Repair B, broken: the second enquiry crashes', 'repair-b', { lookupField: 'name' });
  files['repair-b-fixed.json'] = solution[3]('labRepairBFixed00', 'Repair B, repaired', 'repair-b-fixed');

  // Repair C: the approval check reads the wrong field, so a rejected enquiry is written anyway.
  files['repair-c-broken.json'] = solution[5]('labRepairCBroken0', 'Repair C, broken: a rejected enquiry is written', 'repair-c', { approvedCondition: ['={{ $json.body.approval }}', 'notEmpty'] });
  files['repair-c-fixed.json'] = solution[5]('labRepairCFixed00', 'Repair C, repaired', 'repair-c-fixed');

  // Repair D: the note call lacks its header, and its failure is passed on as if it were a result.
  const dBroken = solution[3]('labRepairDBroken0', 'Repair D, broken: says done, no note', 'repair-d');
  const note = dBroken.node('Add a note');
  delete note.parameters.sendHeaders;
  delete note.parameters.headerParameters;
  note.onError = 'continueRegularOutput';
  files['repair-d-broken.json'] = dBroken;
  // The full repair: the header back, and every CRM call with an error branch, as in stage 6 (without its confirmation).
  const dFixed = solution[3]('labRepairDFixed00', 'Repair D, repaired', 'repair-d-fixed');
  hardenCrm(dFixed, false);
  files['repair-d-fixed.json'] = dFixed;

  // The practical check (instructor only): the note uses the AI summary as it came, not the checked note.
  files['check-g-broken.json'] = solution[4]('labCheckGBroken00', 'Check G, broken: a figure nobody wrote', 'check-g', { noteText: "={{ $('Ask the AI step').item.json.summary }}" });
  files['check-g-fixed.json'] = solution[4]('labCheckGFixed000', 'Check G, repaired', 'check-g-fixed');

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

module.exports = { buildAll, CHECK_FIGURES, CODE_PLACEHOLDER, PARTS };
