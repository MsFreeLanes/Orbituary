/* Rough cross-reference check: every call site in the assembled script must
   resolve to a declaration in one of the parts, or to a known global. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const parts = readdirSync(src).filter((f) => f.endsWith('.js')).sort();
const js = parts.map((f) => readFileSync(join(src, f), 'utf8')).join('\n');

const declared = new Set();
for (const m of js.matchAll(/^\s*(?:function)\s+([A-Za-z_$][\w$]*)/gm)) declared.add(m[1]);
for (const m of js.matchAll(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) declared.add(m[1]);
for (const m of js.matchAll(/^\s*(?:const|let|var)\s*\{([^}]*)\}/gm))
  m[1].split(',').forEach((p) => declared.add(p.split(':').pop().trim()));
for (const m of js.matchAll(/(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
/* parameters and object shorthand are not globals; ignore the usual suspects */
'function,if,for,while,switch,catch,return,typeof,new,in,of,delete,void,await,async,get,set,do,else,try'.split(',').forEach((k) => declared.add(k));

const GLOBALS = new Set([
  'requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','setInterval','clearInterval',
  'Math','Number','String','Array','Object','Set','Map','JSON','Promise','Date','Boolean','parseInt','parseFloat',
  'isNaN','isFinite','URL','Error','Symbol','RegExp','console','document','window','localStorage','navigator',
  'performance','THREE','AudioContext','Float32Array','Uint8Array','Uint16Array','Uint32Array','Int32Array',
  'Image','Path2D','DOMParser','fetch','structuredClone','alert','String','escape','unescape'
]);

const called = new Map();
for (const m of js.matchAll(/(^|[^\w$.])([a-z_$][\w$]*)\s*\(/g)) {
  const name = m[2];
  if (declared.has(name) || GLOBALS.has(name)) continue;
  if (!called.has(name)) called.set(name, []);
  const line = js.slice(0, m.index).split('\n').length;
  called.get(name).push(line);
}

if (!called.size) console.log('ok: every call site resolves');
else {
  console.log('unresolved call sites:');
  for (const [name, lines] of called) console.log('  ' + name + '  → lines ' + lines.slice(0, 6).join(', '));
}

/* also report declarations that are never called anywhere */
const unused = [];
for (const name of declared) {
  if (!/^[a-z_$]/.test(name)) continue;
  const uses = (js.match(new RegExp('(^|[^\\w$.])' + name.replace(/\$/g, '\\$') + '\\s*\\(', 'g')) || []).length;
  const refs = (js.match(new RegExp('(^|[^\\w$.])' + name.replace(/\$/g, '\\$') + '(?!\\s*[:(])', 'g')) || []).length;
  if (uses === 0 && refs <= 1) unused.push(name);
}
console.log('\nnever referenced: ' + (unused.length ? unused.join(', ') : 'none'));
