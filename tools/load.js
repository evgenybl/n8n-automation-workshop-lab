'use strict';
// The load script: waits until the n8n started by compose.yaml is ready, imports every workflow file in workflows/,
// and publishes each one, so that its webhook answers at /webhook/<path>. Used by CI and by the instructor.
//
//   docker compose up -d
//   node tools/load.js
//
// It runs n8n's own command line inside the container (docker compose exec). Run it from the lab's folder.
// Settings (environment variables): N8N_URL (default http://127.0.0.1:5678), LOAD_WAIT_SECONDS (default 240).

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const N8N_URL = (process.env.N8N_URL || 'http://127.0.0.1:5678').replace(/\/+$/, '');
const WAIT_SECONDS = Number(process.env.LOAD_WAIT_SECONDS || 240);

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
      return { file: f, id: data.id, name: data.name };
    });
}

async function main() {
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
    process.exit(1);
  }
  console.log('n8n is ready after ' + Math.round((Date.now() - started) / 1000) + ' seconds.');

  const files = workflowFiles();
  console.log('Importing ' + files.length + ' workflow files from workflows/ ...');
  compose(['exec', '-T', 'n8n', 'n8n', 'import:workflow', '--separate', '--input=/lab/workflows'], { stdio: 'inherit' });

  for (const f of files) {
    compose(['exec', '-T', 'n8n', 'n8n', 'publish:workflow', '--id=' + f.id], { stdio: ['ignore', 'pipe', 'inherit'] });
    console.log('published  ' + f.file + '  (' + f.name + ')');
  }
  console.log('Loaded and published ' + files.length + ' workflows in ' + Math.round((Date.now() - started) / 1000) + ' seconds.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
