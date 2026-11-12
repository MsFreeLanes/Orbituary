/* static check: every S.CONSTANT used in src/ must exist in scale.js */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const src = path.join(process.cwd(), 'src');
const scale = readFileSync(path.join(src, 'scale.js'), 'utf8');
const defined = new Set([...scale.matchAll(/^\s{2}([A-Z][A-Z0-9_]*)\s*:/gm)].map((m) => m[1]));
if (!defined.size) {
  // fall back to any key form
  for (const m of scale.matchAll(/([A-Z][A-Z0-9_]{2,})\s*:/g)) defined.add(m[1]);
}
console.log('scale.js defines', defined.size, 'constants');

const bad = [];
for (const f of readdirSync(src)) {
  if (!f.endsWith('.js')) continue;
  const text = readFileSync(path.join(src, f), 'utf8');
  for (const m of text.matchAll(/\bS\.([A-Z][A-Z0-9_]*)/g)) {
    if (!defined.has(m[1])) bad.push(`${f}: S.${m[1]}`);
  }
}
console.log(bad.length ? 'MISSING: ' + [...new Set(bad)].join('\n') : 'all S.* references resolve');
