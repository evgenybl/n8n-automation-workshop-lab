'use strict';
// Checks that a test summary pasted into a page is the one a run prints now.
//
//   node tools/check-pasted.js <tap-output-file> <page.md> <name>
//
// The page marks the pasted block with <!-- pasted (<name>) from: ... --> followed by a ```text block. The block must equal
// the summary at the end of the run's TAP output (from the line "1..N" to the end), except the duration line, which
// differs from run to run. Exit 0 when they agree, 1 when they do not.

const fs = require('node:fs');

function summary(tap) {
  const lines = tap.replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => /^1\.\.\d+$/.test(l));
  if (start === -1) return null;
  return lines.slice(start).filter((l) => l.trim() !== '');
}

function pasted(page, name) {
  const re = new RegExp(String.raw`<!-- pasted \(` + name + String.raw`\) from:[^>]*-->\s*` + '```text\n([^]*?)```');
  const m = page.match(re);
  return m ? m[1].split('\n').filter((l) => l.trim() !== '') : null;
}

const withoutDuration = (lines) => lines.filter((l) => !/^# duration_ms /.test(l));

function main(argv) {
  const [tapFile, pageFile, name] = argv;
  if (!tapFile || !pageFile || !name) {
    console.error('usage: node tools/check-pasted.js <tap-output-file> <page.md> <name>');
    return 2;
  }
  const got = summary(fs.readFileSync(tapFile, 'utf8'));
  const want = pasted(fs.readFileSync(pageFile, 'utf8'), name);
  if (!got) {
    console.error('No summary (a line "1..N") in ' + tapFile);
    return 1;
  }
  if (!want) {
    console.error('No block marked "pasted (' + name + ')" in ' + pageFile);
    return 1;
  }
  const a = withoutDuration(got).join('\n');
  const b = withoutDuration(want).join('\n');
  if (a !== b) {
    console.log('The block pasted (' + name + ') in ' + pageFile + ' is not what this run printed.');
    console.log('This run printed:\n' + got.join('\n'));
    console.log('The page has:\n' + want.join('\n'));
    return 1;
  }
  console.log('The block pasted (' + name + ') in ' + pageFile + ' is what this run printed (the duration aside).');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { summary, pasted };
