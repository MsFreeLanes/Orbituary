/* What merging the software-costs table would actually do to the museum.
   Reads the live collection (src/data.js) and the transcribed table
   (scratch/candidates-software-costs.js), then reports duplicates,
   dead domains, suspect entries, and the room sizes that would result.
   Nothing is written — this is a dry run. */
import { readFileSync } from 'node:fs';

const load = async (p) => {
  const src = readFileSync(p, 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
};

const live = await load('src/data.js');
const { CANDIDATES } = await load('scratch/candidates-software-costs.js');

const host = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, '').replace(/^(www|app|get)\./, ''); }
  catch { return '<bad url>'; }
};
const root = (h) => h.replace(/\.[^.]+$/, '');
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

console.log(`live collection: ${live.LINKS.length} entries`);
console.log(`candidate table: ${CANDIDATES.length} entries`);
console.log(`would total:     ${live.LINKS.length + CANDIDATES.length}\n`);

/* ── 1. duplicates against what is already hung on the walls ── */
const liveName = new Map(live.LINKS.map((l) => [norm(l.n), l]));
const liveHost = new Map();
for (const l of live.LINKS) {
  const h = root(host(l.u));
  if (!liveHost.has(h)) liveHost.set(h, []);
  liveHost.get(h).push(l);
}

console.log('── duplicates against the live collection ──');
let dup = 0;
for (const c of CANDIDATES) {
  const byName = liveName.get(norm(c.n));
  const h = root(host(c.u));
  const byHost = (liveHost.get(h) || []).filter((l) => norm(l.n) === norm(c.n));
  const near = (byName || byHost[0] || c.dup)
    ? null
    : live.LINKS.find((l) => Math.min(norm(l.n).length, norm(c.n).length) >= 5 &&
        (norm(l.n).includes(norm(c.n)) || norm(c.n).includes(norm(l.n))));
  if (byName || byHost.length || near || c.dup) {
    dup++;
    const hit = byName || byHost[0] || near || { n: '(noted in the table)', u: c.dup, c: '' };
    const how = byName || byHost.length ? 'same' : c.dup ? 'noted' : 'near';
    if (c.dup && !byName && !byHost.length && !near) console.log(`  [noted] ${c.n}  →  ${c.dup}`);
    else console.log(`  [${how}] ${c.n}  →  already have "${hit.n}" (${hit.u}) in ${hit.c}`);
  }
}
if (!dup) console.log('  none');

/* ── 2. duplicates inside the table itself ── */
console.log('\n── duplicates inside the table ──');
const seen = new Map();
let self = 0;
for (const c of CANDIDATES) {
  const k = norm(c.n);
  if (seen.has(k)) { self++; console.log(`  ${c.n} appears twice`); }
  seen.set(k, c);
  if (c.dup) { self++; console.log(`  ${c.n}: ${c.dup}`); }
}
if (!self) console.log('  none');

/* ── 3. entries that cannot be exhibited ── */
console.log('\n── dead domains (nothing to put on a plinth) ──');
const dead = CANDIDATES.filter((c) => c.dead);
for (const c of dead) console.log(`  ${c.n.padEnd(16)} ${c.u}  — ${c.dead}`);
console.log(`  ${dead.length} of ${CANDIDATES.length}`);

console.log('\n── suspect: domain resolves, but not to this product ──');
for (const c of CANDIDATES.filter((c) => c.sus)) console.log(`  ${c.n.padEnd(16)} ${c.u}  — ${c.sus}`);

console.log('\n── real product, wrong URL in the table ──');
for (const c of CANDIDATES.filter((c) => c.fix)) console.log(`  ${c.n.padEnd(16)} ${c.u}  — ${c.fix}`);

/* ── 4. what the building would look like ── */
console.log('\n── room load, before → after ──');
const before = {}, after = {};
for (const l of live.LINKS) before[l.c] = (before[l.c] || 0) + 1;
for (const c of CANDIDATES) after[c.c] = (after[c.c] || 0) + 1;
const kind = (n) => (n >= 10 ? 'hall' : n >= 5 ? 'gallery' : 'cabinet');
/* how many plinths actually fit: hall is 12.0 × 11.0 m, gallery 8.0 × 8.0,
   cabinet 6.0 × 6.0 — 1.70 m between plinths in a row, first row 2.2 m in. */
const fits = (n, w, d) => {
  const perRow = Math.floor((w - 2.6) / 1.70) + 1;
  const rows = Math.max(1, Math.ceil(n / perRow));
  const vStep = rows > 1 ? (d - 1.6 - Math.max(2.2, d * 0.3)) / (rows - 1) : 0;
  return { rows, vStep };
};
const cats = [...new Set([...Object.keys(before), ...Object.keys(after)])];
const bogus = cats.filter((c) => !live.WINGS[c]);
if (bogus.length) console.log('\n  !! categories with no room: ' + bogus.join(', '));
const table = cats.map((cat) => {
  const b = before[cat] || 0, a = b + (after[cat] || 0);
  const kb = kind(b), ka = kind(a);
  const g = fits(a, ka === 'hall' ? 12.0 : ka === 'gallery' ? 8.0 : 6.0, ka === 'hall' ? 11.0 : 8.0);
  return { cat, b, a, kb, ka, grew: kb !== ka, rows: g.rows, vStep: g.vStep };
}).sort((x, y) => y.a - y.a);
for (const r of table) {
  console.log(`  ${r.cat.padEnd(10)} ${String(r.b).padStart(3)} → ${String(r.a).padStart(3)}   ${r.kb.padEnd(8)} → ${r.ka.padEnd(8)}` +
    `  ${r.rows} rows deep, ${r.vStep.toFixed(2)} m between them`);
}
const tight = table.filter((r) => r.rows > 1 && r.vStep < 1.5);
console.log(`\n  rooms where plinths would sit closer than the 1.50 m turning circle: ${tight.length}` +
  (tight.length ? '\n    ' + tight.map((r) => `${r.cat} (${r.a} exhibits, ${r.vStep.toFixed(2)} m)`).join('\n    ') : ''));
