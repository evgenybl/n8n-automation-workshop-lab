'use strict';
// The load script: waits until the n8n started by compose.yaml is ready, then loads workflow files into it, or clears it.
//
//   node tools/load.js --solutions   the instructor's own check: imports and publishes the six stage solutions only.
//                                    They listen at stage-N-solution, so the paths a participant uses (stage-N,
//                                    repair-x) stay free, and the instructor can still do the lab on the same n8n.
//   node tools/load.js --all         CI: imports and publishes every file in workflows/ (starters, solutions, repairs,
//                                    the practical check). This takes the participants' paths; use it only for testing.
//   node tools/load.js --clear       unpublishes every workflow in this n8n (n8n's unpublish:workflow --all), so that
//                                    every path is free again. The workflows stay, unpublished.
//
// After loading, it waits until every published webhook is live, and checks that no other lab path answers.
// It runs n8n's own command line inside the container (docker compose exec). Run it from the lab's folder, after
// "docker compose up -d". Settings (environment variables): N8N_URL (default http://127.0.0.1:5678),
// LOAD_WAIT_SECONDS (default 240).

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const N8N_URL = (process.env.N8N_URL || 'http://127.0.0.1:5678').replace(/\/+$/, '');
const WAIT_SECONDS = Number(process.env.LOAD_WAIT_SECONDS || 240);
const USAGE = 'usage: node tools/load.js --solutions | --all | --clear';

function compose(args, options) {
  return execFileSync('docker', ['compose', ...args], Object.assign({ cwd: ROOT, encoding: 'utf8' }, options || {}));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ready() {
  let logs = '';
  try {
    logs = compose(['logs', 'n8n'], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return false;
  }
  if (!logs.includes('Editor is now accessible')) return false;
  try {
    const r = await fetch(N8N_URL + '/healthz/readiness', { signal: AbortSignal.timeout(3000) });
    return r.status === 200;
  } catch (e) {
    return false;
  }
}

function workflowFiles() {
  const dir = path.join(ROOT, 'workflows');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const trigger = data.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
      return { file: f, id: data.id, name: data.name, path: trigger.parameters.path };
    });
}

// Is a POST webhook live at this path? A GET to it answers 404 either way, but n8n's message differs: for a path that is
// registered for POST it asks "Did you mean to make a POST request?". A GET starts no flow, so this probe has no effect.
async function live(webhookPath) {
  try {
    const r = await fetch(N8N_URL + '/webhook/' + webhookPath, { signal: AbortSignal.timeout(3000) });
    const text = await r.text();
    return r.status !== 404 || /Did you mean to make a POST request/.test(text);
  } catch (e) {
    return false;
  }
}

// Waits until each path is live (wanted true) or gone (wanted false). Returns the paths that did not get there.
async function settle(paths, wanted) {
  const waiting = new Set(paths);
  for (let i = 0; i < WAIT_SECONDS && waiting.size; i++) {
    for (const p of [...waiting]) if ((await live(p)) === wanted) waiting.delete(p);
    if (waiting.size) await sleep(1000);
  }
  return [...waiting];
}

async function main(argv) {
  const mode = argv[0];
  if (!['--solutions', '--all', '--clear'].includes(mode) || argv.length !== 1) {
    console.error(USAGE);
    return 2;
  }
  const started = Date.now();
  process.stdout.write('Waiting for n8n to be ready');
  let ok = false;
  for (let i = 0; i < WAIT_SECONDS / 2; i++) {
    if (await ready()) {
      ok = true;
      break;
    }
    process.stdout.write('.');
    await sleep(2000);
  }
  process.stdout.write('\n');
  if (!ok) {
    console.error('n8n did not become ready within ' + WAIT_SECONDS + ' seconds. Is "docker compose up -d" running?');
    return 1;
  }
  console.log('n8n is ready after ' + Math.round((Date.now() - started) / 1000) + ' seconds.');

  const all = workflowFiles();
  if (mode === '--clear') {
    compose(['exec', '-T', 'n8n', 'n8n', 'unpublish:workflow', '--all'], { stdio: ['ignore', 'pipe', 'inherit'] });
    const still = await settle(all.map((f) => f.path), false);
    if (still.length) {
      console.error('These paths still answer: ' + still.join(', '));
      return 1;
    }
    console.log('Every workflow is unpublished; no lab path answers.');
    return 0;
  }

  const chosen = mode === '--all' ? all : all.filter((f) => /^stage-\d-solution\.json$/.test(f.file));
  console.log('Importing ' + chosen.length + ' workflow files ...');
  if (mode === '--all') {
    compose(['exec', '-T', 'n8n', 'n8n', 'import:workflow', '--separate', '--input=/lab/workflows'], { stdio: 'inherit' });
  } else {
    for (const f of chosen) compose(['exec', '-T', 'n8n', 'n8n', 'import:workflow', '--input=/lab/workflows/' + f.file], { stdio: 'inherit' });
  }
  for (const f of chosen) {
    compose(['exec', '-T', 'n8n', 'n8n', 'publish:workflow', '--id=' + f.id], { stdio: ['ignore', 'pipe', 'inherit'] });
    console.log('published  ' + f.file + '  (' + f.name + ')');
  }

  // A running n8n applies a publish shortly, not at once: wait until every published webhook is live.
  const notLive = await settle(chosen.map((f) => f.path), true);
  if (notLive.length) {
    console.error('These webhooks did not go live: ' + notLive.join(', '));
    return 1;
  }
  console.log('Every published webhook is live: ' + chosen.map((f) => '/webhook/' + f.path).join(' '));
  const others = [];
  for (const f of all) if (!chosen.includes(f) && (await live(f.path))) others.push(f.path);
  if (others.length) {
    console.error('Other lab paths answer too, so a participant could not publish there: ' + others.join(', ') + '. Run "node tools/load.js --clear" first.');
    return 1;
  }
  if (mode === '--solutions') console.log('No other lab path answers: stage-1 to stage-6 and the repair paths are free.');
  console.log('Done in ' + Math.round((Date.now() - started) / 1000) + ' seconds.');
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    console.error(e.message);
    process.exit(1);
  },
);
