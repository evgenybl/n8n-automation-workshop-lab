'use strict';
// The static checker: reads every workflow file and refuses one that is not safe or not sound to hand out.
//
//   node tools/check-workflows.js                 checks every file in workflows/
//   node tools/check-workflows.js <file> ...       checks the files named
//
// For each file: valid JSON; an id; a file name of the lab's pattern; only the stated keys (no account, owner, tag or
// instance id); no credentials block anywhere; only node types from the stated list; one webhook trigger with a path that
// no other file uses; every address points at the practice office; no e-mail address outside example.com; every node
// connected. Exit 0 when every file passes, 1 when one does not.

const fs = require('node:fs');
const path = require('node:path');

const ALLOWED_TYPES = {
  'n8n-nodes-base.webhook': [2.2],
  'n8n-nodes-base.respondToWebhook': [1.5],
  'n8n-nodes-base.if': [2.4],
  'n8n-nodes-base.httpRequest': [4.5],
  'n8n-nodes-base.code': [2],
  'n8n-nodes-base.wait': [1.1],
};
const TRIGGER = 'n8n-nodes-base.webhook';
const TOP_KEYS = ['id', 'name', 'active', 'nodes', 'connections', 'settings', 'pinData'];
const NODE_KEYS = ['parameters', 'id', 'name', 'type', 'typeVersion', 'position', 'onError', 'webhookId'];
const OFFICE_ORIGIN = 'http://office:3333';
const FILE_NAME = /^(stage-[1-6]-(starter|solution)|repair-[a-d]-(broken|fixed)|check-g-(broken|fixed))\.json$/;
const URL_PATTERN = /[a-z][a-z0-9+.-]*:\/\/[^\s"'<>{}]*/gi;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IP_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

function strings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

function hasKeyDeep(value, key) {
  if (Array.isArray(value)) return value.some((v) => hasKeyDeep(v, key));
  if (value && typeof value === 'object') {
    return Object.keys(value).some((k) => k === key || hasKeyDeep(value[k], key));
  }
  return false;
}

// Returns { problems: [...], id, path } for one file's text.
function checkText(fileName, text) {
  const problems = [];
  const result = { file: fileName, problems, id: null, webhookPath: null, nodes: 0 };
  if (!FILE_NAME.test(fileName)) {
    problems.push('the file name is not one of the lab\'s patterns (stage-N-starter, stage-N-solution, repair-X-broken, repair-X-fixed, check-g-broken, check-g-fixed)');
  }
  let wf;
  try {
    wf = JSON.parse(text);
  } catch (e) {
    problems.push('not valid JSON: ' + e.message);
    return result;
  }
  if (!wf || typeof wf !== 'object' || Array.isArray(wf)) {
    problems.push('not one JSON object');
    return result;
  }
  for (const k of Object.keys(wf)) {
    if (!TOP_KEYS.includes(k)) problems.push('an unexpected key at the top: "' + k + '" (only ' + TOP_KEYS.join(', ') + ')');
  }
  if (typeof wf.id !== 'string' || !/^[A-Za-z0-9]{10,32}$/.test(wf.id)) problems.push('no id, or an id that is not 10 to 32 letters and digits');
  result.id = wf.id;
  if (typeof wf.name !== 'string' || !wf.name.trim()) problems.push('no name');
  if (wf.active !== false) problems.push('"active" must be false: the load script publishes, the file does not');
  if (wf.pinData === undefined || JSON.stringify(wf.pinData) !== '{}') problems.push('pinData must be an empty object: a file carries no recorded data');
  if (hasKeyDeep(wf, 'credentials')) problems.push('a credentials block: no workflow file may carry one');
  if (!Array.isArray(wf.nodes) || wf.nodes.length === 0) {
    problems.push('no nodes');
    return result;
  }
  result.nodes = wf.nodes.length;

  const names = new Set();
  const ids = new Set();
  const triggers = [];
  for (const node of wf.nodes) {
    const label = '"' + node.name + '"';
    for (const k of Object.keys(node)) {
      if (!NODE_KEYS.includes(k)) problems.push('node ' + label + ' has an unexpected key "' + k + '"');
    }
    if (typeof node.name !== 'string' || !node.name) problems.push('a node with no name');
    if (names.has(node.name)) problems.push('two nodes named ' + label);
    names.add(node.name);
    if (ids.has(node.id)) problems.push('two nodes with the id ' + node.id);
    ids.add(node.id);
    const versions = ALLOWED_TYPES[node.type];
    if (!versions) {
      problems.push('node ' + label + ' has the type ' + node.type + ', which is not in the stated list: ' + Object.keys(ALLOWED_TYPES).join(', '));
    } else if (!versions.includes(node.typeVersion)) {
      problems.push('node ' + label + ' is ' + node.type + ' version ' + node.typeVersion + '; the lab states version ' + versions.join(' or '));
    }
    if (!Array.isArray(node.position) || node.position.length !== 2) problems.push('node ' + label + ' has no position');
    if (node.onError !== undefined && !['continueErrorOutput', 'continueRegularOutput', 'stopWorkflow'].includes(node.onError)) {
      problems.push('node ' + label + ' has an unknown onError value ' + node.onError);
    }
    const p = node.parameters || {};
    if (p.authentication !== undefined && p.authentication !== 'none') problems.push('node ' + label + ' uses authentication "' + p.authentication + '": the lab uses none');
    if (p.nodeCredentialType || p.genericAuthType) problems.push('node ' + label + ' names a credential type');
    if (node.type === TRIGGER) triggers.push(node);
    for (const s of strings(p, [])) {
      for (const m of s.match(URL_PATTERN) || []) {
        if (!(m === OFFICE_ORIGIN || m.startsWith(OFFICE_ORIGIN + '/'))) {
          problems.push('node ' + label + ' holds an address beyond the practice office: ' + m);
        }
      }
      for (const m of s.match(EMAIL_PATTERN) || []) {
        if (!/@example\.(com|org|net)$/i.test(m)) problems.push('node ' + label + ' holds an e-mail address outside example.com: ' + m);
      }
      for (const m of s.match(IP_PATTERN) || []) problems.push('node ' + label + ' holds an IP address: ' + m);
    }
  }

  if (triggers.length !== 1) problems.push('it needs exactly one Webhook trigger; it has ' + triggers.length);
  if (triggers.length === 1) {
    const t = triggers[0];
    const webhookPath = t.parameters && t.parameters.path;
    if (typeof webhookPath !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(webhookPath)) {
      problems.push('the webhook path must be small letters, digits and dashes; it is ' + JSON.stringify(webhookPath));
    }
    result.webhookPath = webhookPath;
    if (!t.webhookId) problems.push('the webhook node has no webhookId');
  }

  // Every node connected: every source and target exists; the trigger leads somewhere; every other node is reached.
  const incoming = new Map([...names].map((n) => [n, 0]));
  const outgoing = new Map([...names].map((n) => [n, 0]));
  const conns = wf.connections && typeof wf.connections === 'object' ? wf.connections : {};
  for (const [from, entry] of Object.entries(conns)) {
    if (!names.has(from)) {
      problems.push('a connection from a node that does not exist: "' + from + '"');
      continue;
    }
    for (const list of (entry && entry.main) || []) {
      for (const c of list || []) {
        if (!names.has(c.node)) {
          problems.push('a connection to a node that does not exist: "' + c.node + '"');
          continue;
        }
        outgoing.set(from, outgoing.get(from) + 1);
        incoming.set(c.node, incoming.get(c.node) + 1);
      }
    }
  }
  for (const node of wf.nodes) {
    if (node.type === TRIGGER) {
      if (outgoing.get(node.name) === 0 && wf.nodes.length > 1) problems.push('the trigger "' + node.name + '" leads nowhere');
    } else if (incoming.get(node.name) === 0) {
      problems.push('node "' + node.name + '" is not connected: nothing leads to it');
    }
  }
  return result;
}

function checkFiles(files) {
  const results = files.map((f) => checkText(path.basename(f), fs.readFileSync(f, 'utf8')));
  // Across files: ids and webhook paths are unique, so that every file can be published side by side.
  const seenIds = new Map();
  const seenPaths = new Map();
  for (const r of results) {
    if (r.id) {
      if (seenIds.has(r.id)) r.problems.push('the id ' + r.id + ' is also used by ' + seenIds.get(r.id));
      else seenIds.set(r.id, r.file);
    }
    if (r.webhookPath) {
      if (seenPaths.has(r.webhookPath)) r.problems.push('the webhook path ' + r.webhookPath + ' is also used by ' + seenPaths.get(r.webhookPath));
      else seenPaths.set(r.webhookPath, r.file);
    }
  }
  return results;
}

function main(argv) {
  let files = argv.slice(2);
  if (files.length === 0) {
    const dir = path.join(__dirname, '..', 'workflows');
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(dir, f));
  }
  const results = checkFiles(files);
  let bad = 0;
  for (const r of results) {
    if (r.problems.length) {
      bad++;
      console.log('FAIL  ' + r.file);
      for (const p of r.problems) console.log('      - ' + p);
    } else {
      console.log('ok    ' + r.file + '  (' + r.nodes + ' nodes, webhook path ' + r.webhookPath + ')');
    }
  }
  console.log(results.length - bad + ' of ' + results.length + ' workflow files pass the static checks.');
  return bad ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv));

module.exports = { checkText, checkFiles, ALLOWED_TYPES, OFFICE_ORIGIN };
