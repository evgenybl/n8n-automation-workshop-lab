'use strict';
// Temporary: small flows that prove, in CI, the n8n behaviours the guides will rely on. Removed once the real flows cover them.
const fs = require('node:fs');
const path = require('node:path');
const { Flow, webhook, respond, ifNode, http, code, wait, OFFICE } = require('../tools/flow-kit');

const out = path.join(__dirname, '..', 'workflows');
fs.mkdirSync(out, { recursive: true });
const E = 'Enquiry arrives';
const B = (field) => "{{ $('" + E + "').item.json.body." + field + ' }}';
const BF = (field) => "{{ $('" + E + "').first().json.body." + field + ' }}';

const flows = [];

// E1: If nodes and Respond to Webhook with a status code
{
  const f = new Flow('xValidate0000001', 'X1 validate');
  f.add(webhook(E, 'x-validate'), 0, 0)
    .add(ifNode('Has an e-mail?', [['={{ $json.body.email }}', 'contains', '@']]), 1, 0)
    .add(ifNode('Consent given?', [['={{ $json.body.consent }}', 'true']]), 2, 0)
    .add(ifNode('Honeypot empty?', [['={{ $json.body.website }}', 'empty']]), 3, 0)
    .add(respond('Answer: received', 200, '{\n  "received": "{{ $json.body.name }}"\n}'), 4, 0)
    .add(respond('Refuse: no e-mail', 400, '{\n  "refused": "no e-mail"\n}'), 2, 1)
    .add(respond('Refuse: no consent', 400, '{\n  "refused": "no consent"\n}'), 3, 1)
    .add(respond('Refuse: robot', 400, '{\n  "refused": "robot"\n}'), 4, 1)
    .connect(E, 'Has an e-mail?')
    .connect('Has an e-mail?', 'Consent given?', 0)
    .connect('Has an e-mail?', 'Refuse: no e-mail', 1)
    .connect('Consent given?', 'Honeypot empty?', 0)
    .connect('Consent given?', 'Refuse: no consent', 1)
    .connect('Honeypot empty?', 'Answer: received', 0)
    .connect('Honeypot empty?', 'Refuse: robot', 1);
  flows.push(f);
}

// E2: HTTP Request to the office by its compose name; look up, then create or add a note
{
  const f = new Flow('xCrm00000000001', 'X2 crm');
  f.add(webhook(E, 'x-crm'), 0, 0)
    .add(http('Look up the contact', { url: OFFICE + '/crm/contacts', query: [['email', '=' + B('email')]], badge: true }), 1, 0)
    .add(ifNode('Found?', [['={{ $json.found }}', 'true']]), 2, 0)
    .add(http('Add a note', { method: 'POST', url: '=' + OFFICE + '/crm/contacts/{{ $json.contact.id }}/notes', badge: true, body: [['text', '=' + B('message')]] }), 3, 0)
    .add(http('Create the contact', { method: 'POST', url: OFFICE + '/crm/contacts', badge: true, body: [['name', '=' + B('name')], ['email', '=' + B('email')], ['note', '=' + B('message')]] }), 3, 1)
    .add(respond('Answer: note', 200, '{\n  "done": "note",\n  "notes": "{{ $json.notes }}"\n}'), 4, 0)
    .add(respond('Answer: created', 200, '{\n  "done": "created",\n  "id": "{{ $json.id }}"\n}'), 4, 1)
    .connect(E, 'Look up the contact')
    .connect('Look up the contact', 'Found?')
    .connect('Found?', 'Add a note', 0)
    .connect('Found?', 'Create the contact', 1)
    .connect('Add a note', 'Answer: note')
    .connect('Create the contact', 'Answer: created');
  flows.push(f);
}

// E3: the error output of an HTTP Request node, with a timeout
{
  const f = new Flow('xError000000001', 'X3 error output');
  f.add(webhook(E, 'x-error'), 0, 0)
    .add(http('Create the contact', { method: 'POST', url: OFFICE + '/crm/contacts', badge: true, body: [['name', '=' + B('name')], ['email', '=' + B('email')]], timeout: 4000, onError: 'continueErrorOutput' }), 1, 0)
    .add(respond('Answer: created', 200, '{\n  "done": "created",\n  "id": "{{ $json.id }}"\n}'), 2, 0)
    .add(http('Tell the office', { method: 'POST', url: OFFICE + '/alerts', body: [['step', 'Create the contact'], ['reason', '={{ $json.error.message }}'], ['email', '=' + B('email')], ['detail', '={{ JSON.stringify($json) }}']] }), 2, 1)
    .add(respond('Answer: failed', 502, '{\n  "status": "failed",\n  "step": "{{ $json.step }}",\n  "reason": "{{ $json.reason }}"\n}'), 3, 1)
    .connect(E, 'Create the contact')
    .connect('Create the contact', 'Answer: created', 0)
    .connect('Create the contact', 'Tell the office', 1)
    .connect('Tell the office', 'Answer: failed');
  flows.push(f);
}

// E4 and E4b: post to the approval inbox with the resume address, answer 202, wait, then act on the decision
function approvalFlow(id, name, pathName, ref) {
  const f = new Flow(id, name);
  f.add(webhook(E, pathName), 0, 0)
    .add(http('Ask a person', { method: 'POST', url: OFFICE + '/inbox', body: [['name', '={{ $json.body.name }}'], ['email', '={{ $json.body.email }}'], ['message', '={{ $json.body.message }}'], ['resumeUrl', '={{ $execution.resumeUrl }}']] }), 1, 0)
    .add(respond('Answer: waiting', 202, '{\n  "status": "waiting for approval",\n  "approval": "{{ $json.id }}"\n}'), 2, 0)
    .add(wait('Wait for the decision'), 3, 0)
    .add(ifNode('Approved?', [['={{ $json.body.decision }}', 'equals', 'approve']]), 4, 0)
    .add(http('Create the contact', { method: 'POST', url: OFFICE + '/crm/contacts', badge: true, body: [['name', '=' + ref('name')], ['email', '=' + ref('email')], ['note', '=' + ref('message')]] }), 5, 0)
    .add(respond('Tell the approver: written', 200, '{\n  "written": "{{ $json.id }}"\n}'), 6, 0)
    .add(respond('Tell the approver: nothing written', 200, '{\n  "written": "nothing"\n}'), 5, 1)
    .connect(E, 'Ask a person')
    .connect('Ask a person', 'Answer: waiting')
    .connect('Answer: waiting', 'Wait for the decision')
    .connect('Wait for the decision', 'Approved?')
    .connect('Approved?', 'Create the contact', 0)
    .connect('Approved?', 'Tell the approver: nothing written', 1)
    .connect('Create the contact', 'Tell the approver: written');
  return f;
}
flows.push(approvalFlow('xApprove0000001', 'X4 approve item', 'x-approve', B));
flows.push(approvalFlow('xApprove0000002', 'X4b approve first', 'x-approve-first', BF));

// E5: the Code node compares the AI step's figures with the enquiry
const CHECK = [
  "const enquiry = $('" + E + "').first().json.body;",
  'const summary = $input.first().json.summary || "";',
  'const figures = (text) => (String(text || "").match(/\\d+(?:[.,]\\d+)*/g) || []).map((f) => f.replace(/,/g, ""));',
  'const known = figures(enquiry.message);',
  'const unknown = figures(summary).filter((f) => !known.includes(f));',
  'return [{ json: { summaryUsed: unknown.length === 0, summary, unknown, reason: unknown.length ? "The AI summary has figures that are not in the enquiry: " + unknown.join(", ") : "Every figure in the AI summary is in the enquiry." } }];',
].join('\n');
{
  const f = new Flow('xCode0000000001', 'X5 code');
  f.add(webhook(E, 'x-code'), 0, 0)
    .add(http('Ask the AI step', { method: 'POST', url: OFFICE + '/ai/read', body: [['name', '={{ $json.body.name }}'], ['message', '={{ $json.body.message }}']] }), 1, 0)
    .add(code('Check the figures', CHECK), 2, 0)
    .add(Object.assign(respond('Answer', 200, '{}'), { parameters: { respondWith: 'firstIncomingItem', options: {} } }), 3, 0)
    .connect(E, 'Ask the AI step')
    .connect('Ask the AI step', 'Check the figures')
    .connect('Check the figures', 'Answer');
  flows.push(f);
}

// E6: On Error "Continue" (regular output): the failure is passed on as if it were a result
{
  const f = new Flow('xContinue000001', 'X6 continue');
  f.add(webhook(E, 'x-continue'), 0, 0)
    .add(http('Add a note', { method: 'POST', url: OFFICE + '/crm/contacts/C1/notes', body: [['text', 'hello']], onError: 'continueRegularOutput' }), 1, 0)
    .add(respond('Answer: done', 200, '{\n  "status": "done",\n  "saw": "{{ $json.error.message }}"\n}'), 2, 0)
    .connect(E, 'Add a note')
    .connect('Add a note', 'Answer: done');
  flows.push(f);
}

for (const f of flows) {
  fs.writeFileSync(path.join(out, 'x-' + f.id + '.json'), JSON.stringify(f, null, 2) + '\n');
}
console.log('wrote ' + flows.length + ' experiment flows');
