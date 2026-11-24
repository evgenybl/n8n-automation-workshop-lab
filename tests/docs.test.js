'use strict';
// The pages and the repository as a whole: plain ASCII and LF everywhere; no absolute path; e-mail addresses at
// example.com only; the honesty lines where they belong; the planned minutes and debrief questions in agreement; links,
// pictures and quoted answers that resolve; the licence and author lines.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
// A page's text as one line, with quote marks at line starts removed, so that a sentence split over lines is found.
const flat = (f) => read(f).replace(/^>\s?/gm, '').replace(/\s+/g, ' ');

function trackedFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
    const files = out.split('\0').filter(Boolean);
    if (files.length) return files;
  } catch (e) {
    // not a git checkout: walk the folder
  }
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const rel = dir ? dir + '/' + e.name : e.name;
      if (e.isDirectory()) walk(rel);
      else files.push(rel);
    }
  };
  walk('');
  return files;
}
const FILES = trackedFiles().filter((f) => fs.existsSync(path.join(ROOT, f)));
const PAGES = FILES.filter((f) => f.endsWith('.md'));

test('every file is plain ASCII, with LF line ends only', () => {
  for (const f of FILES) {
    const bytes = fs.readFileSync(path.join(ROOT, f));
    const high = bytes.findIndex((b) => b > 127);
    assert.equal(high, -1, f + ' has a byte outside ASCII at offset ' + high);
    assert.equal(bytes.indexOf(13), -1, f + ' has a CR byte');
  }
});

test('no file holds an absolute path of a computer (the one exception: n8n\'s own data folder inside its container)', () => {
  const bad = /(?:\b[A-Za-z]:[\\/](?![\\/])|\/Users\/|\/home\/(?!node\/\.n8n\b))/;
  for (const f of FILES) {
    const text = read(f);
    const m = text.match(bad);
    assert.equal(m, null, f + ' holds an absolute path near: ' + (m && text.slice(Math.max(0, m.index - 20), m.index + 20)));
  }
});

test('every e-mail address anywhere is at example.com', () => {
  for (const f of FILES) {
    for (const m of read(f).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []) {
      assert.match(m, /@example\.com$/, f + ': ' + m);
    }
  }
});

test('there are no package files: the lab installs nothing', () => {
  for (const f of ['package.json', 'package-lock.json', 'node_modules']) assert.ok(!fs.existsSync(path.join(ROOT, f)), f);
});

test('no page speaks of clients or customers, and none claims a class, a workshop delivered, or production use', () => {
  // This file is the one place that names the words, in order to look for them.
  for (const f of FILES.filter((x) => /\.(md|html|js|json|yaml|yml)$/.test(x) && x !== 'tests/docs.test.js')) {
    const text = read(f);
    assert.doesNotMatch(text, /\b(clients?|customers?)\b/i, f);
    assert.doesNotMatch(text, /\b(was taught|we taught|has been taught|delivered (this|the) (workshop|lab)|in production at)\b/i, f);
  }
});

const NOT_TAUGHT = 'has not been taught to a class of people';
const SCREEN = 'not walked through on a screen by a person';
const STAND_IN = 'stand-in that is not a model';

test('the "not taught" line is on the README, the testing page, the participant\'s index and every timed instructor page', () => {
  for (const f of ['README.md', 'docs/HOW-THIS-WAS-TESTED.md', 'participant/README.md', 'instructor/run-sheet.md', 'instructor/guide.md', 'instructor/variants.md', 'instructor/rubric.md', 'instructor/when-things-go-wrong.md']) {
    assert.ok(flat(f).includes(NOT_TAUGHT), f);
  }
});

test('every page that gives minutes calls them planned', () => {
  for (const f of ['README.md', 'instructor/run-sheet.md', 'instructor/guide.md', 'instructor/variants.md']) {
    assert.match(read(f), /planned/i, f);
    assert.match(read(f), /Planned minutes/, f);
  }
});

test('the pages that describe n8n\'s screen say the steps were not walked through on a screen by a person', () => {
  for (const f of ['docs/HOW-THIS-WAS-TESTED.md', 'participant/guide.md', 'participant/repairs.md', 'participant/README.md', 'instructor/guide.md', 'instructor/when-things-go-wrong.md']) {
    assert.ok(flat(f).includes(SCREEN), f);
  }
});

test('the practice AI step is called a stand-in that is not a model wherever it is presented', () => {
  for (const f of ['README.md', 'participant/guide.md', 'instructor/guide.md', 'practice/pages/window.html', 'practice/server.js']) {
    assert.ok(flat(f).includes(STAND_IN), f);
  }
});

// ---------- the planned minutes and the debrief questions ----------

function tableRows(text, header) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(header));
  assert.ok(start !== -1, 'a table starting ' + header);
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
  }
  return rows;
}

function runSheet() {
  return tableRows(read('instructor/run-sheet.md'), '| Part | Planned minutes |').map((r) => ({ part: r[0], minutes: Number(r[1]), debrief: r[3] }));
}

test('the run sheet\'s planned minutes add up to 180, and the README gives the same minutes for the same parts', () => {
  const sheet = runSheet();
  assert.equal(sheet.reduce((n, r) => n + r.minutes, 0), 180);
  const readme = tableRows(read('README.md'), '| Part | What is built | Planned minutes |').map((r) => ({ part: r[0], minutes: Number(r[2]) }));
  assert.deepEqual(readme.map((r) => [r.part, r.minutes]), sheet.map((r) => [r.part, r.minutes]));
});

function guideParts() {
  const text = read('instructor/guide.md');
  return text.split(/\n## /).slice(1).map((s) => {
    const title = s.split('\n')[0].trim();
    const minutes = (s.match(/\*\*Planned minutes:\*\* (\d+)/) || [])[1];
    const debrief = (s.match(/\*\*Debrief question:\*\* ([^\n]+(?:\n[^\n*][^\n]*)*)/) || [])[1];
    return { title, minutes: Number(minutes), debrief: debrief ? debrief.replace(/\s+/g, ' ').trim() : '' };
  });
}

test('the instructor guide gives each part of the run sheet the same planned minutes and the same debrief question', () => {
  const guide = guideParts();
  const sheet = runSheet().filter((r) => r.part !== 'Break');
  const guideTitle = (part) => (part === 'The repairs' ? 'The repairs' : part);
  for (const r of sheet) {
    const g = guide.find((x) => x.title === guideTitle(r.part));
    assert.ok(g, 'the instructor guide has a section for ' + r.part);
    assert.equal(g.minutes, r.minutes, r.part);
    if (r.debrief) assert.equal(g.debrief, r.debrief, r.part);
  }
  for (const g of guide) assert.ok(g.minutes > 0, g.title + ' has planned minutes');
});

test('each variant\'s sessions are ninety minutes', () => {
  const rows = tableRows(read('instructor/variants.md'), '| Session | Part | Planned minutes |');
  const bySession = {};
  for (const r of rows) bySession[r[0]] = (bySession[r[0]] || 0) + Number(r[2]);
  assert.deepEqual(bySession, { 1: 90, 2: 90 });
});

// ---------- links, files named, quoted answers ----------

test('every link and picture on every page resolves to a file in the repository', () => {
  for (const f of PAGES) {
    const text = read(f);
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const resolved = path.join(ROOT, path.dirname(f), target.split('#')[0]);
      assert.ok(fs.existsSync(resolved), f + ' links to ' + target);
    }
  }
});

test('every workflow file, picture and page named in backticks on a page exists', () => {
  for (const f of PAGES) {
    for (const m of read(f).matchAll(/`((?:workflows|docs|participant|instructor|tools|practice|tests)\/[^`\s]+\.(?:json|svg|md|js|html))`/g)) {
      if (m[1].includes('-N-') || m[1].includes('-X-')) continue; // a pattern such as stage-N-starter.json
      assert.ok(fs.existsSync(path.join(ROOT, m[1])), f + ' names ' + m[1]);
    }
  }
});

const VERBS = ['reset', 'fault', 'send', 'form', 'approve', 'reject', 'note', 'alert', 'check', 'offline', 'online'];
const WHO = ['maya', 'tom', 'm-rivers', 'no-email', 'robot', 'no-consent'];

test('every quoted answer is marked with the steps that produce it, and the steps name real flows and people', () => {
  const paths = new Set(fs.readdirSync(path.join(ROOT, 'workflows')).map((f) => JSON.parse(read('workflows/' + f)).nodes.find((n) => n.type === 'n8n-nodes-base.webhook').parameters.path));
  // The quoted repair A answer is sent to repair-a while the repaired file is offline; that path is the repaired file's.
  let count = 0;
  for (const f of PAGES) {
    const text = read(f);
    const markers = [...text.matchAll(/<!-- run: ([^>]*?) -->/g)];
    const blocks = [...text.matchAll(/<!-- run: ([^>]*?) -->\s*```text\n[\s\S]*?```/g)];
    assert.equal(blocks.length, markers.length, f + ': every run marker is followed by a text block');
    for (const m of markers) {
      count++;
      for (const step of m[1].split(';')) {
        const [verb, ...args] = step.trim().split(/\s+/);
        assert.ok(VERBS.includes(verb), f + ': unknown step ' + verb);
        if (verb === 'send' || verb === 'form') {
          assert.ok(paths.has(args[0]), f + ': no flow listens at ' + args[0]);
          assert.ok(WHO.includes(args[1]), f + ': nobody called ' + args[1]);
        }
        if (verb === 'offline' || verb === 'online') assert.ok(fs.existsSync(path.join(ROOT, 'workflows', args[0] + '.json')), f + ': ' + args[0]);
        if (verb === 'fault') assert.match(args[0], /^(crm=(off|fail|slow|wrong)|ai=(off|invent))$/, f);
      }
    }
  }
  assert.ok(count >= 20, 'the guides quote at least twenty answers, each replayed in CI; found ' + count);
});

test('every output block on a page is either replayed in CI or marked as pasted, so none is typed', () => {
  for (const f of PAGES) {
    const text = read(f);
    for (const m of text.matchAll(/```text\n/g)) {
      const before = text.slice(Math.max(0, m.index - 400), m.index);
      const lastComment = before.lastIndexOf('<!--');
      assert.ok(lastComment !== -1 && /<!-- (run:|pasted|try-it:output)/.test(before.slice(lastComment)), f + ': a text block at offset ' + m.index + ' is neither replayed nor marked as pasted');
    }
  }
});

// ---------- the lab guide against the solution files ----------

function guideStages() {
  const text = read('participant/guide.md');
  return text.split(/\n## Stage /).slice(1).map((s) => ({ n: Number(s[0]), text: s.split(/\n## /)[0] }));
}

test('each stage of the lab guide names only nodes that its solution file has, and every node of the solution is built', () => {
  for (const { n, text } of guideStages()) {
    const solution = JSON.parse(read('workflows/stage-' + n + '-solution.json'));
    const names = new Set(solution.nodes.map((x) => x.name));
    const named = [...text.matchAll(/\| Name \| `([^`]+)` \|/g)].map((m) => m[1]);
    for (const name of named) assert.ok(names.has(name), 'stage ' + n + ' names "' + name + '", which its solution does not have');
    const previous = n > 1 ? new Set(JSON.parse(read('workflows/stage-' + n + '-starter.json')).nodes.map((x) => x.name)) : new Set(['Enquiry arrives']);
    for (const name of names) assert.ok(previous.has(name) || named.includes(name), 'stage ' + n + ' never builds "' + name + '"');
  }
});

test('every expression the lab guide gives for a stage is in that stage\'s solution file', () => {
  for (const { n, text } of guideStages()) {
    const solution = read('workflows/stage-' + n + '-solution.json');
    for (const m of text.matchAll(/\{\{ [^`]*? \}\}/g)) {
      assert.ok(solution.includes(JSON.stringify(m[0]).slice(1, -1)), 'stage ' + n + ': ' + m[0]);
    }
  }
});

test('every answer body the lab guide gives is the one in the solution file, as JSON', () => {
  const asJson = (body) => JSON.parse(body.replace(/^=/, '').replace(/\{\{[^}]*\}\}/g, (e) => e.replace(/"/g, "'")));
  for (const { n, text } of guideStages()) {
    const bodies = JSON.parse(read('workflows/stage-' + n + '-solution.json')).nodes
      .filter((x) => x.type === 'n8n-nodes-base.respondToWebhook')
      .map((x) => JSON.stringify(asJson(x.parameters.responseBody)));
    for (const m of text.matchAll(/\| Response Body(?: \(Expression\))? \| `([^`]+)` \|/g)) {
      assert.ok(bodies.includes(JSON.stringify(asJson(m[1]))), 'stage ' + n + ': ' + m[1]);
    }
  }
});

test('the code the lab guide gives for stage 4 is exactly the Code node of the solution files', () => {
  const m = read('participant/guide.md').match(/```javascript\n([\s\S]*?)```/);
  assert.ok(m);
  for (const f of ['stage-4-solution', 'stage-5-solution', 'stage-6-solution', 'check-g-fixed']) {
    const node = JSON.parse(read('workflows/' + f + '.json')).nodes.find((x) => x.name === 'Check the AI figures');
    assert.equal(node.parameters.jsCode + '\n', m[1], f);
  }
});

// ---------- licence and author ----------

test('every teaching page carries the licence line', () => {
  for (const f of PAGES.filter((x) => /^(participant|instructor)\//.test(x))) {
    const text = read(f).replace(/\s+/g, ' ');
    assert.ok(text.includes('CC BY-NC 4.0') && text.includes('https://creativecommons.org/licenses/by-nc/4.0/'), f);
  }
  assert.match(read('LICENSE'), /MIT License\n\nCopyright \(c\) 2026 Evgeny Blekhman/);
  assert.match(read('LICENSE-TEXT.md'), /Creative Commons Attribution-NonCommercial 4\.0 International/);
});

test('the README ends with the author line, and says nothing else about the author', () => {
  const text = read('README.md');
  assert.ok(text.trimEnd().endsWith('Built by Evgeny Blekhman. Written with Claude Code under the author\'s direction. linkedin.com/in/evgeny-blekhman'));
  assert.equal((text.match(/Evgeny Blekhman/g) || []).length, 1);
});

test('the README marks its "Try it" command and output, as the scenario test that runs the command reads them', () => {
  const m = read('README.md').match(/<!-- try-it:command -->\s*```(?:bash)?\n([\s\S]*?)```[\s\S]*?<!-- try-it:output -->\s*```(?:text)?\n([\s\S]*?)```/);
  assert.ok(m);
  assert.deepEqual(m[1].trim().split('\n').map((l) => l.split(' ')[0]), ['docker', 'node', 'curl']);
  assert.match(m[1], /http:\/\/localhost:5678\/webhook\/stage-6-solution/);
});

test('the README and the testing page agree on what is owed', () => {
  for (const f of ['README.md', 'docs/HOW-THIS-WAS-TESTED.md']) {
    const text = read(f);
    assert.match(text, /\| A new-user test \|[^\n]*Owed/, f);
    assert.match(text, /\| An independent review \|[^\n]*Owed/, f);
    assert.match(text, /Taught to a class of people \|[^\n]*Not done/, f);
  }
});

test('the pinned n8n version is the same in the compose file, the README and the testing page', () => {
  assert.match(read('compose.yaml'), /image: docker\.n8n\.io\/n8nio\/n8n:2\.48\.8\n[\s\S]*image: docker\.n8n\.io\/n8nio\/n8n:2\.48\.8\n/);
  assert.ok(read('README.md').includes('n8n 2.48.8'));
  assert.ok(read('docs/HOW-THIS-WAS-TESTED.md').includes('n8n 2.48.8'));
});

test('every published port in the compose file is bound to 127.0.0.1', () => {
  const ports = read('compose.yaml').match(/^\s+- "[^"]*:\d+"$/gm) || [];
  assert.equal(ports.length, 2);
  for (const p of ports) assert.match(p, /- "127\.0\.0\.1:/);
});

test('every action in CI is pinned by its commit', () => {
  for (const m of read('.github/workflows/ci.yml').matchAll(/uses: (\S+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, m[1]);
});
