/* static check: every material key used by plan.js must exist in materials.js
   SPECS, and every ceilKey must be a branch building.js knows how to build.
   ceilKeys are ceiling geometry, not surfaces, so they are checked separately. */
import { readFileSync } from 'node:fs';

const plan = readFileSync('src/plan.js', 'utf8');
const mats = readFileSync('src/materials.js', 'utf8');
const building = readFileSync('src/building.js', 'utf8');

const specs = new Set([...mats.matchAll(/^\s{2}([a-zA-Z][A-Za-z0-9]*)\s*:\s*\{/gm)].map((m) => m[1]));
const keys = new Set();
for (const m of plan.matchAll(/\b(floor|wall):\s*'([a-zA-Z]+)'/g)) keys.add(m[2]);
for (const m of mats.matchAll(/\bmat\('([a-zA-Z]+)'/g)) keys.add(m[2]);

const ceilKeys = new Set([...plan.matchAll(/\bceilKey:\s*'([a-zA-Z]+)'/g)].map((m) => m[1]));
const branches = new Set([...building.matchAll(/(?:case|===)\s*'([a-z]+)'/g)].map((m) => m[1]));
/* 'flat' means the plain slab with nothing on it, 'dome' belongs to the rotunda */
const known = new Set(['flat', 'dome']);

console.log('SPECS     :', [...specs].join(' '));
console.log('used      :', [...keys].sort().join(' '));
console.log('ceilKeys  :', [...ceilKeys].sort().join(' '));
const missing = [...keys].filter((k) => !specs.has(k));
const noBranch = [...ceilKeys].filter((k) => !branches.has(k) && !known.has(k));
if (missing.length) console.log('MISSING FROM SPECS: ' + missing.join(' '));
if (noBranch.length) console.log('NO CEILING BUILDER: ' + noBranch.join(' '));
console.log(missing.length || noBranch.length ? 'fail' : 'every surface key has a spec and every ceiling key has a builder');
