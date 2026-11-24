'use strict';
// The pages and the repository as a whole: plain ASCII and LF everywhere; no absolute path; e-mail addresses at
// example.com only; the honesty lines where they belong; the planned minutes and debrief questions in agreement; links,
// pictures and quoted answers that resolve; the evidence rows; the licence, third-party and author lines; the compose file.
// The lab guide, the repairs, the answer key and the practical check are held to the workflow files in tests/guide.test.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
// A page's text as one line, with quote marks at line starts removed, so that a sentence split over lines is found.
const flat = (f) => read(f).replace(/^\s*>\s?/gm, '').replace(/\s+/g, ' ');

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
const WORKFLOWS = fs.readdirSync(path.join(ROOT, 'workflows')).filter((f) => f.endsWith('.json'));

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

test('no page says the lab needs no payment, and nothing is left pending', () => {
  for (const f of PAGES) {
    assert.doesNotMatch(read(f), /\bpayment\b/i, f + ': Docker Desktop is not free for everyone; say what its terms are instead');
    assert.doesNotMatch(read(f), /PENDING/, f + ': something is still to be pasted');
  }
});

// ---------- the honesty lines ----------

const NOT_TAUGHT = 'has not been taught to a class of people';
const SCREEN = 'not walked through on a screen by a person';
const STAND_IN = 'stand-in that is not a model';

test('the "not taught" line is on the README, the testing page, the participant\'s index and guide, and every timed instructor page', () => {
  for (const f of ['README.md', 'docs/HOW-THIS-WAS-TESTED.md', 'participant/README.md', 'participant/guide.md', 'instructor/run-sheet.md', 'instructor/guide.md', 'instructor/variants.md', 'instructor/rubric.md', 'instructor/when-things-go-wrong.md']) {
    assert.ok(flat(f).includes(NOT_TAUGHT), f);
  }
});

test('every page that gives minutes calls them planned, not measured, and says what has not been done', () => {
  for (const f of ['README.md', 'instructor/run-sheet.md', 'instructor/guide.md', 'instructor/variants.md', 'participant/guide.md']) {
    assert.match(flat(f), /planned, not measured/, f);
  }
  assert.ok(flat('README.md').includes('Every timing in it is planned, not measured.'));
  assert.ok(flat('instructor/guide.md').includes('the mistakes listed are the ones the design expects, not ones observed in a room'));
  assert.ok(flat('instructor/rubric.md').includes('the rubric has not been used to mark anyone yet'));
  assert.ok(flat('instructor/practical-check.md').includes('This check has not been given to anyone yet.'));
});

test('the pages that describe n8n\'s screen say the steps were not walked through on a screen by a person', () => {
  for (const f of ['docs/HOW-THIS-WAS-TESTED.md', 'participant/setup.md', 'participant/guide.md', 'participant/repairs.md', 'participant/README.md', 'instructor/run-sheet.md', 'instructor/guide.md', 'instructor/when-things-go-wrong.md']) {
    assert.ok(flat(f).includes(SCREEN), f);
  }
});

test('the practice AI step is called a stand-in that is not a model wherever it is presented, and the CRM practice software', () => {
  for (const f of ['README.md', 'participant/guide.md', 'instructor/guide.md', 'practice/README.md', 'practice/pages/window.html', 'practice/server.js']) {
    assert.ok(flat(f).includes(STAND_IN), f);
  }
  for (const f of ['README.md', 'practice/README.md']) assert.ok(flat(f).includes('practice software, not a CRM product'), f);
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
const sum = (rows, col) => rows.reduce((n, r) => n + Number(r[col]), 0);

function runSheet() {
  const text = read('instructor/run-sheet.md');
  return [1, 2].map((s) => {
    const section = text.split('\n## Session ' + s + '\n')[1];
    assert.ok(section, 'the run sheet has session ' + s);
    const rows = tableRows(section, '| Part | Planned minutes |').map((r) => ({ session: s, part: r[0], minutes: Number(r[1]), debrief: r[3] }));
    const total = section.match(new RegExp('The planned total of session ' + s + ' is (\\d+) minutes'));
    return { rows, total: total && Number(total[1]) };
  });
}

test('each session of the run sheet adds up to its stated total of 120 planned minutes', () => {
  for (const [i, s] of runSheet().entries()) {
    assert.equal(s.total, 120, 'session ' + (i + 1) + ' states 120');
    assert.equal(s.rows.reduce((n, r) => n + r.minutes, 0), s.total, 'session ' + (i + 1) + ' adds up');
  }
});

test('the README gives the same sessions, parts and minutes as the run sheet', () => {
  const sheet = runSheet().flatMap((s) => s.rows).map((r) => [String(r.session), r.part, r.minutes]);
  const readme = tableRows(read('README.md'), '| Session | Part | What is built | Planned minutes |').map((r) => [r[0], r[1], Number(r[3])]);
  assert.deepEqual(readme, sheet);
});

function guideParts() {
  const text = read('instructor/guide.md');
  return text.split(/\n## /).slice(1).map((s) => {
    const title = s.split('\n')[0].trim();
    const minutes = (s.match(/\*\*Planned\s+minutes:\*\* (\d+)/) || [])[1];
    const debrief = (s.match(/\*\*Debrief question:\*\* ([^\n]+(?:\n[^\n*-][^\n]*)*)/) || [])[1];
    return { title, minutes: Number(minutes), debrief: debrief ? debrief.replace(/\s+/g, ' ').trim() : '' };
  });
}

test('the instructor guide has each part of the run sheet, in order, with the same planned minutes and debrief question', () => {
  const guide = guideParts();
  const sheet = runSheet().flatMap((s) => s.rows).filter((r) => r.part !== 'Break');
  assert.deepEqual(guide.map((g) => g.title), sheet.map((r) => r.part));
  for (const r of sheet) {
    const g = guide.find((x) => x.title === r.part);
    assert.equal(g.minutes, r.minutes, r.part);
    assert.equal(g.debrief, r.debrief || '', r.part);
  }
});

test('each variant adds up to its stated total, and gives every stage the run sheet\'s minutes', () => {
  const text = read('instructor/variants.md');
  const stageMinutes = Object.fromEntries(runSheet().flatMap((s) => s.rows).map((r) => [r.part, r.minutes]));
  for (const [heading, name] of [['## One half day', 'the half day'], ['## A ninety-minute taster', 'the taster']]) {
    const section = text.split(heading)[1].split('\n## ')[0];
    const rows = tableRows(section, '| Part | Planned minutes |');
    const total = section.match(new RegExp('The planned total of ' + name + ' is (\\d+) minutes'));
    assert.ok(total, name + ' states its total');
    assert.equal(sum(rows, 1), Number(total[1]), name);
    for (const r of rows.filter((x) => /^Stage \d/.test(x[0]))) assert.equal(Number(r[1]), stageMinutes[r[0]], name + ': ' + r[0]);
  }
  assert.ok(/ninety-minute/.test(text) && /The planned total of the taster is 90 minutes/.test(text));
});

// The one plan for the practical check, word for word on every page that schedules it.
const CHECK_PLAN = /When you assess, the practical check \(`instructor\/practical-check\.md`\) takes the place of repair D: repair C, then the practical check, in this part's (\d+) planned minutes\./;

test('the practical check has one plan, the same on the run sheet, the README, the variants and its own page', () => {
  const partD = runSheet()[1].rows.find((r) => r.part === 'Repairs C and D');
  for (const f of ['instructor/run-sheet.md', 'README.md', 'instructor/variants.md', 'instructor/practical-check.md']) {
    const m = flat(f).match(CHECK_PLAN);
    assert.ok(m, f + ' gives the plan');
    assert.equal(Number(m[1]), partD.minutes, f + ': the part it replaces has the run sheet\'s minutes');
  }
  assert.match(read('instructor/run-sheet.md'), /\| Repairs C and D \| \d+ \|[^\n]*when you assess, the practical check in place of repair D/);
  assert.match(read('README.md'), /\| Repairs C and D \|[^\n]*when assessing, the practical check in place of repair D/);
  const own = Number(flat('instructor/practical-check.md').match(/\*\*Planned minutes:\*\* (\d+)\./)[1]);
  assert.match(flat('instructor/variants.md'), new RegExp('The practical check takes ' + own + ' planned minutes\\.'));
  assert.ok(own <= partD.minutes, 'it fits the part it replaces');
  assert.ok(flat('instructor/practical-check.md').includes('It is handed out by the instructor only: no participant page mentions it.'));
  for (const f of PAGES.filter((x) => x.startsWith('participant/'))) assert.doesNotMatch(read(f), /practical check|check-g/i, f);
});

test('the repairs page says which repairs come when, as the run sheet does', () => {
  assert.ok(flat('participant/repairs.md').includes('**Which repairs, and when.** Session 1: repair A; repair B if you finish A. Session 2: repair C; repair D if you finish C.'));
  assert.match(read('instructor/run-sheet.md'), /\| Repair A or B \| \d+ \| Repair A for everyone; B for those who finish A \|/);
  assert.match(read('instructor/run-sheet.md'), /\| Repairs C and D \| \d+ \| Repair C for everyone; D for those who finish C[;|]/);
});

test('the repairs page for printing is the participant page without the causes, as its script writes it', () => {
  const { forPrinting } = require('../tools/print-repairs.js');
  const page = read('participant/repairs.md');
  const printed = read('instructor/repairs-for-printing.md');
  assert.equal(printed, forPrinting(page));
  assert.doesNotMatch(printed, /The cause, and the fix|<details>/);
  assert.equal((page.match(/The cause, and the fix/g) || []).length, 4);
  // Equal apart from the causes: every line of the printed page but the note and the unfolded hint labels is on the participant page.
  for (const line of printed.split('\n')) {
    if (/^> /.test(line) || line === '# The four repairs, for printing') continue;
    assert.ok(page.includes(line.replace(/^\*\*Hint \d\.\*\* /, '')), 'from the participant page: ' + line.slice(0, 60));
  }
  assert.ok(flat('instructor/run-sheet.md').includes('`instructor/repairs-for-printing.md`'));
  assert.ok(flat('participant/repairs.md').includes('prints `instructor/repairs-for-printing.md` instead'));
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
const WHO = ['maya', 'tom', 'm-rivers', 'no-email', 'robot', 'no-consent', 'consent-on', 'quoted', 'forging'];
const FAULT = /^(crm=(off|fail|slow|wrong|late-writes)|ai=(off|invent|fail)|inbox=(off|fail))$/;

test('every quoted answer is marked with the steps that produce it, and the steps name real flows, people and faults', () => {
  const paths = new Set(WORKFLOWS.map((f) => JSON.parse(read('workflows/' + f)).nodes.find((n) => n.type === 'n8n-nodes-base.webhook').parameters.path));
  const server = read('practice/server.js');
  for (const m of FAULT.source.matchAll(/(\w+)=\(([^)]+)\)/g)) {
    // the faults a marker may name are the faults the office offers
    const list = server.match(new RegExp('const ' + m[1].toUpperCase() + "_FAULTS = \\[([^\\]]+)\\]"));
    assert.ok(list, m[1]);
    assert.deepEqual(m[2].split('|').sort(), list[1].split(',').map((x) => x.trim().replace(/'/g, '')).sort(), m[1]);
  }
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
        if (verb === 'fault') assert.match(args[0], FAULT, f);
      }
    }
  }
  assert.ok(count >= 25, 'the guides quote at least twenty-five answers, each replayed in CI; found ' + count);
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

// ---------- the evidence the README and the testing page state ----------

test('the README and the testing page agree on what was done, at which commit, and what was not', () => {
  for (const f of ['README.md', 'docs/HOW-THIS-WAS-TESTED.md']) {
    const text = read(f);
    assert.match(text, /\| A new-user test \|[^\n]*Done twice, at commit 9785e5b and at commit 25e7f76, each by a separate AI agent[^\n]*not repeated on the current version/, f);
    assert.match(text, /\| An independent review \|[^\n]*Done once, at commit 9785e5b, by a separate AI agent[^\n]*not repeated on the current version/, f);
    assert.match(text, /\| The steps in n8n's own screen,? walked through by a person \|[^\n]*Not done/, f);
    assert.match(text, /\| Taught to a class of people \|[^\n]*Not done/, f);
    assert.ok(flat(f).includes('all ' + WORKFLOWS.length + ' '), f + ' gives the number of workflow files, ' + WORKFLOWS.length);
    for (const m of text.matchAll(/\ball (\d+) (?:imported|workflow files)/g)) assert.equal(Number(m[1]), WORKFLOWS.length, f);
  }
  assert.match(read('README.md'), new RegExp('\\| `workflows/` \\| ' + WORKFLOWS.length + ' workflow files'));
});

test('the testing page cites a CI run only with its commit, and the README carries the badge of the latest run', () => {
  const text = read('docs/HOW-THIS-WAS-TESTED.md');
  const runs = [...text.matchAll(/CI run (\d{8,})/g)];
  assert.ok(runs.length > 0);
  for (const m of runs) assert.match(text.slice(m.index, m.index + 80), /at commit [0-9a-f]{7}/, 'CI run ' + m[1]);
  const actions = 'https://github.com/evgenybl/n8n-automation-workshop-lab/actions/workflows/ci.yml';
  assert.ok(read('README.md').includes('[![CI: the latest run on main](' + actions + '/badge.svg?branch=main)](' + actions + ')'), 'the badge, with its full addresses');
});

test('every test file the testing page names exists, and every test file is named there', () => {
  const text = read('docs/HOW-THIS-WAS-TESTED.md');
  const named = new Set([...text.matchAll(/`((?:practice\/)?tests\/[a-z-]+\.test\.js)`/g)].map((m) => m[1]));
  const actual = ['tests', 'practice/tests'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.test.js')).map((f) => d + '/' + f));
  assert.deepEqual([...named].sort(), actual.sort());
});

// ---------- licence, third parties, author ----------

test('every teaching page carries the licence line', () => {
  for (const f of PAGES.filter((x) => /^(participant|instructor)\//.test(x))) {
    const text = read(f).replace(/\s+/g, ' ');
    assert.ok(text.includes('CC BY-NC 4.0') && text.includes('https://creativecommons.org/licenses/by-nc/4.0/'), f);
  }
  assert.match(read('LICENSE'), /MIT License\n\nCopyright \(c\) 2026 Evgeny Blekhman/);
  assert.match(read('LICENSE-TEXT.md'), /Creative Commons Attribution-NonCommercial 4\.0 International/);
});

test('the README\'s licence table and the licence notice name the same teaching text, and every tracked file has one licence', () => {
  const rows = tableRows(read('README.md'), '| Folder or file | Licence |');
  const paths = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const cc = rows.filter((r) => /BY-NC/.test(r[1])).flatMap((r) => paths(r[0]));
  const mit = rows.filter((r) => /MIT/.test(r[1])).flatMap((r) => paths(r[0]));
  const notice = [...read('LICENSE-TEXT.md').matchAll(/^- `([^`]+)`$/gm)].map((m) => m[1]);
  assert.deepEqual(cc.sort(), notice.sort());
  assert.ok(read('LICENSE-TEXT.md').includes('`docs/pictures/` included, is under the MIT licence'));
  const covers = (list, f) => list.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p));
  for (const f of FILES.filter((x) => !['LICENSE', 'LICENSE-TEXT.md'].includes(x))) {
    const inCc = covers(cc, f);
    const inMit = covers(mit, f);
    assert.ok(inCc !== inMit, f + ' is under exactly one licence in the README\'s table');
  }
});

test('the README and the setup page give the third parties\' terms', () => {
  for (const f of ['README.md', 'participant/setup.md']) {
    const text = flat(f);
    assert.ok(text.includes('not affiliated with or endorsed by n8n'), f);
    assert.ok(text.includes('https://docs.n8n.io/n8n-community-license)'), f);
    assert.ok(text.includes('does not redistribute n8n'), f);
    assert.ok(text.includes('https://docs.docker.com/subscription-billing/desktop-license/'), f);
    assert.match(text, /fewer than 250 employees and less than 10 million US dollars in annual revenue/, f);
  }
});

test('the setup page names the browsers, the documented password rule, the check by docker info, and the proxy', () => {
  const text = flat('participant/setup.md');
  assert.ok(text.includes('Chrome, Edge or Firefox'));
  assert.match(text, /Safari is reported, in a community report the lab has not verified/);
  assert.ok(text.includes('at least eight characters with at least one number and one capital letter'));
  assert.match(read('participant/setup.md'), /```bash\n\s*docker info\n/);
  assert.match(text, /Behind a company proxy\?/);
  assert.match(text, /Apple silicon/);
  assert.match(text, /several hundred megabytes/);
  assert.doesNotMatch(text, /port is already allocated/, 'the port message differs between systems: describe it, do not quote one');
});

test('the setup page names the right folder, keeps down -v out of the ordinary table, and asks for the lines the run sheet chases', () => {
  const page = read('participant/setup.md');
  const text = flat('participant/setup.md');
  assert.ok(text.includes('1. **Open a terminal in the folder where you can see `compose.yaml`.**'));
  assert.ok(text.includes("the lab's folder is **the folder where you can see `compose.yaml`**"));
  assert.ok(text.includes('https://docs.docker.com/desktop/setup/install/windows-install/'));
  assert.match(text, /WSL 2 feature turned on, and hardware virtualisation enabled/);
  const table = tableRows(page, '| To | Type |');
  assert.ok(table.every((r) => !r[1].includes('down -v')), 'the ordinary table has no down -v');
  assert.ok(text.includes('`docker compose down -v` stops it and **deletes your n8n account and every flow you built**.'));
  assert.ok(text.includes('**If `docker info` still fails, send its last lines to your instructor before the session**'));
  assert.ok(text.includes('send that line to your instructor'));
  assert.ok(flat('instructor/run-sheet.md').includes('send you the line the setup check shows, or, if `docker info` fails, its last lines'));
  assert.match(text, /If it still says so after three minutes, type `docker compose ps` and `docker compose logs --tail 20 n8n`/);
  assert.match(page, /<!-- pasted from: the step "Start n8n and the practice office" of CI run \d+, at commit [0-9a-f]{7} -->\n\s*```text\n(\s+ (Network|Volume|Container) [^\n]+\n)+\s*```/);
  assert.match(page, /no configuration file[\s\S]{0,400}<!-- pasted from: the step "What starting the lab prints in a folder without compose\.yaml" of CI run \d+, at commit [0-9a-f]{7} -->\n\s*```text\n\s*no configuration file provided[^\n]*\n\s*```/);
});

test('the README ends with the author line, and says nothing else about the author', () => {
  const text = read('README.md');
  assert.ok(text.trimEnd().endsWith('Built by Evgeny Blekhman. Written with Claude Code under the author\'s direction. linkedin.com/in/evgeny-blekhman'));
  assert.equal((text.match(/Evgeny Blekhman/g) || []).length, 1);
});

test('the README\'s text for the finished flow\'s picture says which calls have an error branch, as the file has them', () => {
  const wf = JSON.parse(read('workflows/stage-6-solution.json'));
  const calls = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
  const branch = (n) => n.onError === 'continueErrorOutput' && ((wf.connections[n.name] || {}).main || [])[1] && wf.connections[n.name].main[1].length > 0;
  const service = (n) => n.parameters.url.replace(/^=/, '').split('/')[3];
  assert.deepEqual(calls.filter(branch).map(service).sort(), ['ai', 'crm', 'crm', 'crm', 'inbox']);
  const without = calls.filter((n) => !branch(n));
  assert.ok(without.every((n) => service(n) === 'alerts' && /^Tell the office/.test(n.name)), 'the calls with no error branch are the alerts');
  const alt = read('README.md').match(/\[!\[The finished flow:([^\]]*)\]/)[1];
  assert.ok(alt.includes('each call to the AI step, the approval inbox and the CRM has an error branch'));
  assert.ok(alt.includes('the ' + ['zero', 'one', 'two', 'three', 'four'][without.length] + ' calls that tell the office about a failure have none'));
  assert.doesNotMatch(alt, /every outgoing call/);
});

test('the README marks its "Try it" command and output, as the scenario test that runs the command reads them', () => {
  const m = read('README.md').match(/<!-- try-it:command -->\s*```(?:bash)?\n([\s\S]*?)```[\s\S]*?<!-- try-it:output -->\s*```(?:text)?\n([\s\S]*?)```/);
  assert.ok(m);
  assert.deepEqual(m[1].trim().split('\n').map((l) => l.split(' ').slice(0, 2).join(' ')), ['docker compose', 'node tools/load.js', 'curl -s']);
  assert.match(m[1], /node tools\/load\.js --solutions\n/);
  assert.match(m[1], /http:\/\/localhost:5678\/webhook\/stage-6-solution/);
});

// ---------- the compose file and CI ----------

test('the pinned n8n version is the same in the compose file, the README and the testing page', () => {
  assert.match(read('compose.yaml'), /image: docker\.n8n\.io\/n8nio\/n8n:2\.48\.8\n[\s\S]*image: docker\.n8n\.io\/n8nio\/n8n:2\.48\.8\n/);
  assert.ok(read('README.md').includes('n8n 2.48.8'));
  assert.ok(read('docs/HOW-THIS-WAS-TESTED.md').includes('n8n 2.48.8'));
  assert.match(flat('README.md'), /pinned by its tag, not by its digest/);
});

test('every published port in the compose file is bound to 127.0.0.1', () => {
  const ports = read('compose.yaml').match(/^\s+- "[^"]*:\d+"$/gm) || [];
  assert.equal(ports.length, 2);
  for (const p of ports) assert.match(p, /- "127\.0\.0\.1:/);
});

test('the compose file gives the office and n8n the addresses the flows, the load script and the setup check use', () => {
  const compose = read('compose.yaml');
  const { OFFICE } = require('../tools/flow-kit.js');
  const office = new URL(OFFICE);
  assert.match(compose, new RegExp('\\n  ' + office.hostname + ':\\n'), 'a service named ' + office.hostname);
  assert.match(compose, new RegExp('PORT[=:] ?"?' + office.port + '\\b'), 'the office listens on ' + office.port);
  assert.match(compose, /N8N_URL[=:] ?"?http:\/\/n8n:5678\b/);
  assert.ok(read('participant/setup.md').includes('"n8nAddress":"http://n8n:5678"'));
  assert.match(compose, /- \.\/workflows:\/lab\/workflows:ro\n/);
  assert.ok(read('tools/load.js').includes('=/lab/workflows'));
});

test('every action in CI is pinned by its commit', () => {
  for (const m of read('.github/workflows/ci.yml').matchAll(/uses: (\S+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, m[1]);
});

test('CI loads every file for the scenarios, then proves the instructor\'s order frees the participants\' paths', () => {
  const ci = read('.github/workflows/ci.yml');
  const all = ci.indexOf('node tools/load.js --all');
  const scenarios = ci.indexOf('LAB_LIVE');
  const clear = ci.indexOf('node tools/load.js --clear');
  const solutions = ci.indexOf('node tools/load.js --solutions');
  assert.ok(all !== -1 && all < scenarios && scenarios < clear && clear < solutions);
  const sheet = read('instructor/run-sheet.md');
  assert.ok(sheet.indexOf('node tools/load.js --clear') < sheet.indexOf('node tools/load.js --solutions'));
});
