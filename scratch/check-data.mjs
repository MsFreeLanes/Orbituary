import { readFileSync } from 'node:fs';
const src = readFileSync('src/data.js', 'utf8');
const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
const { LINKS, WINGS, WING_NAMES } = mod;

console.log('total links:', LINKS.length);
const byWing = {};
for (const l of LINKS) (byWing[l.c] ||= []).push(l);
const rows = Object.entries(byWing).sort((a, b) => b[1].length - a[1].length);
let sum = 0;
for (const [w, arr] of rows) { console.log(String(arr.length).padStart(3), w); sum += arr.length; }
console.log('sum:', sum, '| wings in data:', rows.length, '| wings defined:', WING_NAMES.length);

const unknown = rows.filter(([w]) => !WINGS[w]).map(([w]) => w);
console.log('unknown wings:', unknown.length ? unknown : 'none');
const emptyWings = WING_NAMES.filter(w => !byWing[w]);
console.log('defined-but-empty wings:', emptyWings.length ? emptyWings : 'none');

const dupNames = LINKS.map(l => l.n).filter((n, i, a) => a.indexOf(n) !== i);
console.log('duplicate names:', dupNames.length ? dupNames : 'none');

const urlCount = {};
for (const l of LINKS) urlCount[l.u] = (urlCount[l.u] || 0) + 1;
console.log('duplicate urls:', Object.entries(urlCount).filter(([, c]) => c > 1));

const badUrls = LINKS.filter(l => !/^https?:\/\/[^\s]+$/.test(l.u)).map(l => [l.n, l.u]);
console.log('malformed urls:', badUrls.length ? badUrls : 'none');
const missing = LINKS.filter(l => !l.n || !l.u || !l.c || !l.d);
console.log('entries missing fields:', missing.length);
const longest = LINKS.reduce((a, b) => (b.n.length > a.n.length ? b : a));
console.log('longest name:', longest.n.length, longest.n);
const longestD = LINKS.reduce((a, b) => (b.d.length > a.d.length ? b : a));
console.log('longest desc:', longestD.d.length, longestD.d);
const nonHttps = LINKS.filter(l => !l.u.startsWith('https://')).map(l => [l.n, l.u]);
console.log('non-https:', nonHttps);
// how many links per row if max 7 per row
for (const [w, arr] of rows) {
  const rowsN = Math.max(1, Math.min(3, Math.ceil(arr.length / 7)));
  console.log('  wing', w, 'items', arr.length, '-> rows', rowsN, 'perRow', Math.ceil(arr.length / rowsN));
}
