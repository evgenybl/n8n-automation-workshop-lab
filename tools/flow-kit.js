'use strict';
// Builders for n8n workflow files: one function per node type the lab uses, with the type names, type versions and
// parameter names of n8n 2.48.8 (the defaults its editor writes for a new node). tools/build-workflows.js uses
// them to write every file in workflows/.

const crypto = require('node:crypto');

const OFFICE = 'http://office:3333';
const BADGE = { name: 'X-Office-Badge', value: 'practice-badge' };

// One layout for the finished flow, [column, row]; every stage uses the same places, so the nodes a starter brings never
// sit on the nodes the participant already has.
const POSITIONS = {
  'Enquiry arrives': [0, 0],
  'Has an e-mail?': [1, 0],
  'Honeypot empty?': [2, 0],
  'Consent given?': [3, 0],
  'Answer with the name': [4, 0],
  'Refuse: no e-mail': [2, 1],
  'Refuse: looks like a robot': [3, 1],
  'Refuse: no consent': [4, 1],
  'Ask the AI step': [0, 2],
  'Check the AI figures': [1, 2],
  'Ask a person': [2, 2],
  'Answer: waiting for approval': [3, 2],
  'Wait for the decision': [4, 2],
  'Answer: not queued': [3, 3],
  'Approved?': [0, 4],
  'Look up the contact': [1, 4],
  'Known contact?': [2, 4],
  'Add a note': [3, 4],
  'CRM confirmed?': [4, 4],
  'Answer: recorded': [5, 4],
  'Tell the approver: nothing written': [0, 5],
  'Create the contact': [3, 5],
  'Tell the office: not confirmed': [5, 5],
  'Tell the office: lookup failed': [1, 6],
  'Answer: nothing written': [2, 6],
  'Tell the office: write failed': [4, 6],
  'Answer: check the CRM': [5, 6],
};

const TYPES = {
  webhook: { type: 'n8n-nodes-base.webhook', typeVersion: 2.2 },
  respond: { type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.5 },
  if: { type: 'n8n-nodes-base.if', typeVersion: 2.4 },
  http: { type: 'n8n-nodes-base.httpRequest', typeVersion: 4.5 },
  code: { type: 'n8n-nodes-base.code', typeVersion: 2 },
  wait: { type: 'n8n-nodes-base.wait', typeVersion: 1.1 },
};

// A stable UUID made from a text, so that building twice writes the same file.
function uuidFrom(seed) {
  const h = crypto.createHash('sha256').update(seed).digest('hex').split('');
  h[12] = '4';
  h[16] = ['8', '9', 'a', 'b'][parseInt(h[16], 16) % 4];
  const s = h.join('');
  return [s.slice(0, 8), s.slice(8, 12), s.slice(12, 16), s.slice(16, 20), s.slice(20, 32)].join('-');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class Flow {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.nodes = [];
    this.connections = {};
  }

  // A node goes where the lab's one layout puts it (POSITIONS), so that it stays in the same place in every stage.
  add(node) {
    if (this.nodes.some((n) => n.name === node.name)) throw new Error('Two nodes named ' + node.name);
    const at = POSITIONS[node.name];
    if (!at) throw new Error('No position for ' + node.name);
    node.position = [at[0] * 260, at[1] * 180];
    this.nodes.push(node);
    return this;
  }

  node(name) {
    const n = this.nodes.find((x) => x.name === name);
    if (!n) throw new Error('No node named ' + name + ' in ' + this.id);
    return n;
  }

  // output 0 is the main (or "true") output; 1 is "false" on an If node, or "error" on a node set to use its error output.
  connect(from, to, output) {
    this.node(from);
    this.node(to);
    const out = output || 0;
    const entry = this.connections[from] || (this.connections[from] = { main: [] });
    while (entry.main.length <= out) entry.main.push([]);
    entry.main[out].push({ node: to, type: 'main', index: 0 });
    return this;
  }

  disconnect(from, to) {
    const entry = this.connections[from];
    if (!entry) throw new Error('No connection from ' + from);
    let removed = false;
    for (const list of entry.main) {
      const i = list.findIndex((c) => c.node === to);
      if (i !== -1) {
        list.splice(i, 1);
        removed = true;
      }
    }
    if (!removed) throw new Error('No connection from ' + from + ' to ' + to);
    return this;
  }

  remove(name) {
    this.node(name);
    this.nodes = this.nodes.filter((n) => n.name !== name);
    delete this.connections[name];
    for (const entry of Object.values(this.connections)) {
      for (const list of entry.main) {
        for (let i = list.length - 1; i >= 0; i--) if (list[i].node === name) list.splice(i, 1);
      }
    }
    return this;
  }

  copy(id, name) {
    const f = new Flow(id, name);
    f.nodes = clone(this.nodes);
    f.connections = clone(this.connections);
    return f;
  }

  toJSON() {
    // Node and webhook ids are derived from the workflow id and the node's name, so that every file is stable
    // and two files never share a webhook id.
    const nodes = this.nodes.map((n) => {
      const out = {
        parameters: n.parameters,
        id: uuidFrom(this.id + '/node/' + n.name),
        name: n.name,
        type: n.type,
        typeVersion: n.typeVersion,
        position: n.position,
      };
      if (n.onError) out.onError = n.onError;
      if (n.needsWebhookId) out.webhookId = uuidFrom(this.id + '/webhook/' + n.name);
      return out;
    });
    return {
      id: this.id,
      name: this.name,
      active: false,
      nodes,
      connections: this.connections,
      settings: { executionOrder: 'v1' },
      pinData: {},
    };
  }
}

function webhook(name, path, responseMode) {
  return Object.assign({ name, needsWebhookId: true }, TYPES.webhook, {
    parameters: { httpMethod: 'POST', path, responseMode: responseMode || 'responseNode', options: {} },
  });
}

// body: the JSON text of the answer, with n8n expressions inside {{ }} (as the editor writes it).
function respond(name, code, body) {
  const parameters = { respondWith: 'json', responseBody: '=' + body, options: {} };
  if (code !== 200) parameters.options.responseCode = code;
  return Object.assign({ name }, TYPES.respond, { parameters });
}

// A condition: [leftValue, kind, rightValue]. Kinds: contains, notContains, empty, notEmpty, equals, true, exists.
function condition(seed, left, kind, right) {
  const ops = {
    contains: { type: 'string', operation: 'contains' },
    notContains: { type: 'string', operation: 'notContains' },
    equals: { type: 'string', operation: 'equals' },
    empty: { type: 'string', operation: 'empty', singleValue: true },
    notEmpty: { type: 'string', operation: 'notEmpty', singleValue: true },
    true: { type: 'boolean', operation: 'true', singleValue: true },
    exists: { type: 'string', operation: 'exists', singleValue: true },
  };
  if (!ops[kind]) throw new Error('Unknown condition kind ' + kind);
  return { id: uuidFrom(seed), leftValue: left, rightValue: right === undefined ? '' : right, operator: clone(ops[kind]) };
}

// loose: the If node's "Convert types where required" switched on.
function ifNode(name, conditions, loose) {
  return Object.assign({ name }, TYPES.if, {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: loose ? 'loose' : 'strict', version: 4 },
        conditions: conditions.map((c, i) => condition(name + '/' + i, c[0], c[1], c[2])),
        combinator: 'and',
      },
      looseTypeValidation: Boolean(loose),
      options: {},
    },
  });
}

function pairs(list) {
  return { parameters: list.map(([n, v]) => ({ name: n, value: v })) };
}

// spec: { method, url, query: [[name, value]], badge: true, body: [[name, value]], timeout, onError }
function http(name, spec) {
  const parameters = { method: spec.method || 'GET', url: spec.url };
  if (spec.query) {
    parameters.sendQuery = true;
    parameters.queryParameters = pairs(spec.query);
  }
  if (spec.badge) {
    parameters.sendHeaders = true;
    parameters.headerParameters = pairs([[BADGE.name, BADGE.value]]);
  }
  if (spec.body) {
    parameters.sendBody = true;
    parameters.bodyParameters = pairs(spec.body);
  }
  parameters.options = {};
  if (spec.timeout) parameters.options.timeout = spec.timeout;
  const node = Object.assign({ name }, TYPES.http, { parameters });
  if (spec.onError) node.onError = spec.onError;
  return node;
}

function code(name, jsCode) {
  return Object.assign({ name }, TYPES.code, { parameters: { jsCode } });
}

function wait(name, responseMode) {
  return Object.assign({ name, needsWebhookId: true }, TYPES.wait, {
    parameters: { resume: 'webhook', httpMethod: 'POST', responseMode: responseMode || 'responseNode', options: {} },
  });
}

module.exports = { Flow, webhook, respond, ifNode, http, code, wait, OFFICE, BADGE, TYPES, POSITIONS, uuidFrom };
