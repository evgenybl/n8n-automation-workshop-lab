'use strict';
// tools/check-pasted.js, the CI step that compares the test summaries pasted on the testing page with what the run
// printed: it agrees on the same summary whatever the duration, and refuses any other difference or a missing block.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TOOL = path.join(__dirname, '..', 'tools', 'check-pasted.js');
const TAP = ['TAP version 13', 'ok 1 - a', '1..2', '# tests 2', '# pass 2', '# fail 0', '# duration_ms 812.5', ''].join('\n');
const page = (lines) => '# A page\n\n<!-- pasted (local) from: a run -->\n```text\n' + lines.join('\n') + '\n```\n';

function run(tap, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-pasted-'));
  try {
    fs.writeFileSync(path.join(dir, 'tap.txt'), tap);
    fs.writeFileSync(path.join(dir, 'page.md'), text);
    return spawnSync(process.execPath, [TOOL, path.join(dir, 'tap.txt'), path.join(dir, 'page.md'), 'local'], { encoding: 'utf8' }).status;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the same summary agrees, whatever the duration', () => {
  assert.equal(run(TAP, page(['1..2', '# tests 2', '# pass 2', '# fail 0', '# duration_ms 99.1'])), 0);
});

test('a different count, a missing line, or no block at all is refused', () => {
  assert.equal(run(TAP, page(['1..2', '# tests 2', '# pass 1', '# fail 0', '# duration_ms 99.1'])), 1);
  assert.equal(run(TAP, page(['1..2', '# tests 2', '# pass 2'])), 1);
  assert.equal(run(TAP, '# A page with nothing pasted\n'), 1);
  assert.equal(run('no summary here\n', page(['1..2'])), 1);
});
