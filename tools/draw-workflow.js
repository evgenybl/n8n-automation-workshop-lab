'use strict';
// The picture tool: draws a workflow file as an SVG picture of its nodes and connections, from the file alone.
//
//   node tools/draw-workflow.js                 draws every file in workflows/ into docs/pictures/
//   node tools/draw-workflow.js --check         draws them in memory and fails if a picture differs from its file
//   node tools/draw-workflow.js <file.json>     prints one picture to the screen
//
// The same file always gives the same picture, byte for byte, so CI can compare.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const W = 214; // box width
const H = 76; // box height
const PAD = 40;
const TOP = 56;

const STYLE = {
  'n8n-nodes-base.webhook': { fill: '#e3f4e6', stroke: '#2e7d3c', kind: 'Trigger: webhook' },
  'n8n-nodes-base.respondToWebhook': { fill: '#f1e6f7', stroke: '#7b3fa0', kind: 'Respond to Webhook' },
  'n8n-nodes-base.if': { fill: '#fff5d6', stroke: '#9a7400', kind: 'If' },
  'n8n-nodes-base.httpRequest': { fill: '#e2edfb', stroke: '#2a5ea8', kind: 'HTTP Request' },
  'n8n-nodes-base.code': { fill: '#ececec', stroke: '#555555', kind: 'Code' },
  'n8n-nodes-base.wait': { fill: '#fde8dc', stroke: '#b0521d', kind: 'Wait' },
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > max) {
      lines.push(line);
      line = w;
    } else {
      line = line ? line + ' ' + w : w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 2) return [lines[0], lines.slice(1).join(' ').slice(0, max - 3) + '...'];
  return lines;
}

// A short second line: what the node is set to do.
function detail(node) {
  const p = node.parameters || {};
  switch (node.type) {
    case 'n8n-nodes-base.webhook':
      return (p.httpMethod || 'GET') + ' /' + (p.path || '');
    case 'n8n-nodes-base.respondToWebhook':
      return 'answers ' + ((p.options && p.options.responseCode) || 200);
    case 'n8n-nodes-base.httpRequest': {
      const url = String(p.url || '').replace(/^=/, '').replace('http://office:3333', '');
      const shortUrl = url.replace(/\{\{[^}]*\}\}/g, '{id}');
      return (p.method || 'GET') + ' ' + shortUrl;
    }
    case 'n8n-nodes-base.wait':
      return 'until its resume address is called';
    case 'n8n-nodes-base.if':
      return 'true / false';
    case 'n8n-nodes-base.code':
      return 'JavaScript';
    default:
      return '';
  }
}

function outputLabel(node, index) {
  if (node.type === 'n8n-nodes-base.if') return index === 0 ? 'true' : 'false';
  if (node.onError === 'continueErrorOutput') return index === 0 ? '' : 'error';
  return '';
}

function draw(wf, sourceName) {
  const xs = wf.nodes.map((n) => n.position[0]);
  const ys = wf.nodes.map((n) => n.position[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const at = (n) => ({ x: n.position[0] - minX + PAD, y: n.position[1] - minY + TOP + PAD / 2 });
  const width = Math.max(...xs) - minX + W + PAD * 2;
  const height = Math.max(...ys) - minY + H + TOP + PAD * 2;
  const byName = new Map(wf.nodes.map((n) => [n.name, n]));

  const out = [];
  out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-labelledby="t d" font-family="Helvetica, Arial, sans-serif">');
  out.push('<title id="t">' + esc(wf.name) + '</title>');
  out.push('<desc id="d">' + esc('Drawn by tools/draw-workflow.js from ' + sourceName + '. Nodes: ' + wf.nodes.map((n) => n.name).join('; ') + '.') + '</desc>');
  out.push('<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5b6570"/></marker></defs>');
  out.push('<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#ffffff"/>');
  out.push('<text x="' + PAD + '" y="30" font-size="17" font-weight="bold" fill="#1b1f24">' + esc(wf.name) + '</text>');
  out.push('<text x="' + PAD + '" y="48" font-size="11" fill="#4a5561">' + esc('Drawn from ' + sourceName + ' by tools/draw-workflow.js') + '</text>');

  // Connections first, so that the boxes sit on top of them.
  for (const [from, entry] of Object.entries(wf.connections || {})) {
    const a = byName.get(from);
    if (!a) continue;
    (entry.main || []).forEach((list, index) => {
      for (const c of list || []) {
        const b = byName.get(c.node);
        if (!b) continue;
        const pa = at(a);
        const pb = at(b);
        const x1 = pa.x + W;
        const y1 = pa.y + H / 2 + (index === 0 ? -8 : 8);
        const x2 = pb.x;
        const y2 = pb.y + H / 2;
        const bend = Math.max(40, (x2 - x1) / 2);
        const label = outputLabel(a, index);
        const colour = label === 'error' ? '#a12121' : '#5b6570';
        let d;
        if (x2 > x1) {
          d = 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + bend) + ' ' + y1 + ', ' + (x2 - bend) + ' ' + y2 + ', ' + x2 + ' ' + y2;
        } else {
          // A connection that runs backwards: out to the right, along the gap above the target's row (or below
          // both boxes when the target is not lower), and into the target from the left.
          const yRun = pb.y > pa.y + H ? pb.y - 32 : Math.max(pa.y, pb.y) + H + 26;
          const xOut = x1 + 12 + 14 * index;
          const xIn = x2 - 24;
          d = 'M ' + x1 + ' ' + y1 + ' L ' + xOut + ' ' + y1 + ' L ' + xOut + ' ' + yRun + ' L ' + xIn + ' ' + yRun +
            ' L ' + xIn + ' ' + y2 + ' L ' + x2 + ' ' + y2;
        }
        out.push('<path d="' + d + '" fill="none" stroke="' + colour + '" stroke-width="1.6"' + (label === 'error' ? ' stroke-dasharray="5 3"' : '') + ' marker-end="url(#arrow)"/>');
        if (label) {
          out.push('<text x="' + (x1 + 6) + '" y="' + (y1 + (index === 0 ? -5 : 13)) + '" font-size="11" fill="' + colour + '">' + esc(label) + '</text>');
        }
      }
    });
  }

  for (const n of wf.nodes) {
    const p = at(n);
    const s = STYLE[n.type] || { fill: '#ffffff', stroke: '#000000', kind: n.type };
    const lines = wrap(n.name, 24);
    out.push('<g>');
    out.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + W + '" height="' + H + '" rx="8" fill="' + s.fill + '" stroke="' + s.stroke + '" stroke-width="1.6"/>');
    out.push('<text x="' + (p.x + 10) + '" y="' + (p.y + 15) + '" font-size="10" fill="' + s.stroke + '">' + esc(s.kind) + '</text>');
    lines.forEach((line, i) => {
      out.push('<text x="' + (p.x + 10) + '" y="' + (p.y + 34 + i * 17) + '" font-size="14" font-weight="bold" fill="#1b1f24">' + esc(line) + '</text>');
    });
    const sub = detail(n);
    if (sub) {
      out.push('<text x="' + (p.x + 10) + '" y="' + (p.y + H - 7) + '" font-size="10" fill="#4a5561">' + esc(sub.length > 36 ? sub.slice(0, 33) + '...' : sub) + '</text>');
    }
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('\n') + '\n';
}

function pictureName(file) {
  return path.basename(file, '.json') + '.svg';
}

function main(argv) {
  const args = argv.slice(2);
  const check = args.includes('--check');
  const named = args.filter((a) => !a.startsWith('--'));
  if (named.length) {
    for (const f of named) process.stdout.write(draw(JSON.parse(fs.readFileSync(f, 'utf8')), 'workflows/' + path.basename(f)));
    return 0;
  }
  const dir = path.join(ROOT, 'workflows');
  const pictures = path.join(ROOT, 'docs', 'pictures');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  let differ = 0;
  if (!check) fs.mkdirSync(pictures, { recursive: true });
  for (const f of files) {
    const svg = draw(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), 'workflows/' + f);
    const target = path.join(pictures, pictureName(f));
    if (check) {
      const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
      if (current !== svg) {
        differ++;
        console.log('DIFFERS  docs/pictures/' + pictureName(f) + (current === null ? ' (missing)' : ''));
      } else {
        console.log('same     docs/pictures/' + pictureName(f));
      }
    } else {
      fs.writeFileSync(target, svg);
      console.log('drew     docs/pictures/' + pictureName(f));
    }
  }
  if (check) {
    const extra = fs.existsSync(pictures)
      ? fs.readdirSync(pictures).filter((p) => p.endsWith('.svg') && !files.includes(p.replace(/\.svg$/, '.json')))
      : [];
    for (const e of extra) {
      differ++;
      console.log('EXTRA    docs/pictures/' + e + ' (no workflow file of that name)');
    }
    console.log(differ ? differ + ' picture(s) differ from their workflow files.' : 'Every picture matches its workflow file (' + files.length + ').');
  }
  return differ ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv));

module.exports = { draw };
