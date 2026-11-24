'use strict';
// The pictures: drawn from the workflow files alone, the same every time, one for each file, and current.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { draw } = require('../tools/draw-workflow.js');

const ROOT = path.join(__dirname, '..');
const workflows = fs.readdirSync(path.join(ROOT, 'workflows')).filter((f) => f.endsWith('.json')).sort();
const load = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', f), 'utf8'));

test('drawing the same file twice gives the same picture, byte for byte', () => {
  const wf = load('stage-6-solution.json');
  assert.equal(draw(wf, 'workflows/stage-6-solution.json'), draw(load('stage-6-solution.json'), 'workflows/stage-6-solution.json'));
});

test('every workflow file has its picture in docs/pictures, and every picture is current', () => {
  const pictures = fs.readdirSync(path.join(ROOT, 'docs', 'pictures')).filter((f) => f.endsWith('.svg')).sort();
  assert.deepEqual(pictures, workflows.map((f) => f.replace(/\.json$/, '.svg')));
  for (const f of workflows) {
    const current = fs.readFileSync(path.join(ROOT, 'docs', 'pictures', f.replace(/\.json$/, '.svg')), 'utf8');
    assert.equal(current, draw(load(f), 'workflows/' + f), f);
  }
});

test('a picture names every node, its workflow and its source file, and draws one line per connection', () => {
  for (const f of workflows) {
    const wf = load(f);
    const svg = draw(wf, 'workflows/' + f);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /<\/svg>\n$/);
    assert.ok(svg.includes('<title id="t">' + wf.name.replace(/&/g, '&amp;') + '</title>'), f);
    assert.ok(svg.includes('Drawn from workflows/' + f), f);
    for (const n of wf.nodes) assert.ok(svg.includes(n.name.replace(/&/g, '&amp;')) || svg.includes(n.name.split(' ')[0]), f + ' / ' + n.name);
    let connections = 0;
    for (const entry of Object.values(wf.connections)) for (const list of entry.main) connections += list.length;
    assert.equal((svg.match(/<path d="M [^"]*" fill="none"/g) || []).length, connections, f);
  }
});

test('error branches are drawn dashed and labelled "error"; the If outputs are labelled true and false', () => {
  const svg = draw(load('stage-6-solution.json'), 'workflows/stage-6-solution.json');
  assert.equal((svg.match(/stroke-dasharray/g) || []).length, 3, 'three error branches in the finished flow');
  assert.ok((svg.match(/>error</g) || []).length >= 3);
  assert.ok(svg.includes('>true<') && svg.includes('>false<'));
});
