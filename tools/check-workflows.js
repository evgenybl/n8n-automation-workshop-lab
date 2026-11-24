'use strict';
// The static checker: reads every workflow file and refuses one that is not safe or not sound to hand out.
//
//   node tools/check-workflows.js                 checks every file in workflows/
//   node tools/check-workflows.js <file> ...       checks the files named
//
// For each file it refuses: a file that is not JSON; no id, or a file name outside the lab's patterns; any key beyond the
// stated ones (so no account, owner, tag, instance id, static data or extra setting); a credentials block anywhere;
// authentication on any node; a node type outside the stated list, or at another version; an HTTP Request whose address
// is not written out as an address of the practice office (so none with no scheme, none built in an expression, none that
// only starts like the office); any other address, any e-mail address outside example.com, any IP address or any
// phone-like number in a parameter or a name; a token-like value in a header, a query parameter, a body or code; a header
// or query parameter named like a secret; a node or workflow name with a quote mark or longer than 60 characters; more or
// fewer than one Webhook trigger, or a path that is not small letters, digits and dashes, or that another file uses; and a
// node that the trigger does not lead to (a stage's starter may bring such nodes: the parts the participant connects).
// Exit 0 when every file passes, 1 when one does not.

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
const PHONE_PATTERN = /\+?\d[\d ()-]{7,}\d/g;
// Well-known key shapes, a bearer token, and any long run of letters and digits that holds both.
const TOKEN_PATTERNS = [
  /\b(sk|pk|rk)[-_][A-Za-z0-9_-]{8,}/,
  /\b(ghp|gho|ghs|ghu)_[A-Za-z0-9]{8,}/,
  /\bxox[abpr]-/,
  /\bAKIA[0-9A-Z]{8,}/,
  /\beyJ[A-Za-z0-9_-]{10,}/,
  /\bBearer\s+\S{8,}/i,
  /(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{24,}/,
];
const SECRET_NAMES = /^(authorization|cookie|x-api-key|api[-_]?key|apikey|token|access[-_]?token|secret|[c]lient[-_]?secret|password|key)$/i; // [c]: the lab's pages test for the word on its own

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

// Text outside n8n's {{ }}, where a fixed value sits.
const outsideExpressions = (s) => s.replace(/\{\{[\s\S]*?\}\}/g, ' ');

function tokenLike(s) {
  return TOKEN_PATTERNS.some((re) => re.test(s));
}

function checkName(label, name, problems) {
  if (typeof name !== 'string' || !name.trim()) return;
  if (/['"`]/.test(name)) problems.push(label + ' "' + name + '" holds a quote mark');
  if (name.length > 60) problems.push(label + ' "' + name + '" is longer than 60 characters');
  if (URL_PATTERN.test(name) || /\bwww\./i.test(name)) problems.push(label + ' "' + name + '" holds an address');
  URL_PATTERN.lastIndex = 0;
  if ((name.match(EMAIL_PATTERN) || []).length) problems.push(label + ' "' + name + '" holds an e-mail address');
  if ((name.match(IP_PATTERN) || []).length) problems.push(label + ' "' + name + '" holds an IP address');
  if ((name.match(PHONE_PATTERN) || []).length) problems.push(label + ' "' + name + '" holds a phone-like number');
}

// Returns { problems: [...], id, webhookPath, nodes, parts } for one file's text.
function checkText(fileName, text) {
  const problems = [];
  const result = { file: fileName, problems, id: null, webhookPath: null, nodes: 0, parts: 0 };
  if (!FILE_NAME.test(fileName)) {
    problems.push('the file name is not one of the lab\'s patterns (stage-N-starter, stage-N-solution, repair-X-broken, repair-X-fixed, check-g-broken, check-g-fixed)');
  }
  const isStarter = /^stage-\d-starter\.json$/.test(fileName);
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
  checkName('the workflow name', wf.name, problems);
  if (wf.active !== false) problems.push('"active" must be false: the load script publishes, the file does not');
  if (wf.pinData === undefined || JSON.stringify(wf.pinData) !== '{}') problems.push('pinData must be an empty object: a file carries no recorded data');
  if (JSON.stringify(wf.settings) !== JSON.stringify({ executionOrder: 'v1' })) problems.push('settings must be exactly {"executionOrder":"v1"}: no error workflow, time zone or other setting');
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
    checkName('the node name', node.name, problems);
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

    // An HTTP Request's address is written out, and is the practice office's.
    if (node.type === 'n8n-nodes-base.httpRequest') {
      const url = String(p.url || '').replace(/^=/, '');
      if (!url.startsWith(OFFICE_ORIGIN + '/')) problems.push('node ' + label + ' calls an address that is not written out as one of the practice office: ' + JSON.stringify(p.url));
      for (const group of ['headerParameters', 'queryParameters']) {
        for (const pair of (p[group] && p[group].parameters) || []) {
          if (SECRET_NAMES.test(String(pair.name || ''))) problems.push('node ' + label + ' sends a ' + (group === 'headerParameters' ? 'header' : 'query parameter') + ' named like a secret: ' + pair.name);
        }
      }
      if (p.sendHeaders && p.specifyHeaders === 'json') problems.push('node ' + label + ' gives its headers as JSON; the lab gives them as fields, so this checker can read them');
    }

    // Every string in the parameters: addresses, e-mail addresses, IP addresses, phone-like numbers, token-like values.
    const isCode = node.type === 'n8n-nodes-base.code';
    // n8n gives each If condition an id of the UUID form; such an id is not a value the file sends anywhere.
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    for (const s of strings(p, []).filter((x) => !UUID.test(x))) {
      for (const m of s.match(URL_PATTERN) || []) {
        if (!(m === OFFICE_ORIGIN || m.startsWith(OFFICE_ORIGIN + '/'))) {
          problems.push('node ' + label + ' holds an address beyond the practice office: ' + m);
        }
      }
      for (const m of s.match(EMAIL_PATTERN) || []) {
        if (!/@example\.(com|org|net)$/i.test(m)) problems.push('node ' + label + ' holds an e-mail address outside example.com: ' + m);
      }
      for (const m of s.match(IP_PATTERN) || []) problems.push('node ' + label + ' holds an IP address: ' + m);
      const fixed = outsideExpressions(s);
      if (!isCode) for (const m of fixed.match(PHONE_PATTERN) || []) problems.push('node ' + label + ' holds a phone-like number: ' + m);
      if (tokenLike(fixed)) problems.push('node ' + label + ' holds a token-like value: ' + fixed.slice(0, 40));
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

  // Connections: every source and target exists; then every node is reached from the trigger, except a starter's parts.
  const conns = wf.connections && typeof wf.connections === 'object' ? wf.connections : {};
  const next = new Map([...names].map((n) => [n, []]));
  for (const [from, entry] of Object.entries(conns)) {
    if (!names.has(from)) {
      problems.push('a connection from a node that does not exist: "' + from + '"');
      continue;
    }
    for (const list of (entry && entry.main) || []) {
      for (const c of list || []) {
        if (!names.has(c.node)) problems.push('a connection to a node that does not exist: "' + c.node + '"');
        else next.get(from).push(c.node);
      }
    }
  }
  if (triggers.length === 1) {
    const reached = new Set([triggers[0].name]);
    const queue = [triggers[0].name];
    while (queue.length) for (const n of next.get(queue.shift())) if (!reached.has(n)) reached.add(n) && queue.push(n);
    if (wf.nodes.length > 1 && next.get(triggers[0].name).length === 0) problems.push('the trigger "' + triggers[0].name + '" leads nowhere');
    for (const node of wf.nodes) {
      if (reached.has(node.name)) continue;
      if (isStarter) result.parts++;
      else problems.push('node "' + node.name + '" is not connected: the trigger does not lead to it');
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
      console.log('ok    ' + r.file + '  (' + r.nodes + ' nodes' + (r.parts ? ', ' + r.parts + ' not yet connected: the stage\'s parts' : '') + ', webhook path ' + r.webhookPath + ')');
    }
  }
  console.log(results.length - bad + ' of ' + results.length + ' workflow files pass the static checks.');
  return bad ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv));

module.exports = { checkText, checkFiles, ALLOWED_TYPES, OFFICE_ORIGIN };
