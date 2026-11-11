/* Assembler: numbered parts in scratch/src → one openable index.html.
   Run:  node scratch/build.mjs
   The parts are authored in order (see the map at the top of 10-open.js);
   this script only concatenates, checks and reports. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const out = join(here, '..', 'index.html');

const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

const files = readdirSync(src).sort();
const shell = readFileSync(join(src, '00-shell.html'), 'utf8');
const parts = files.filter((f) => f.endsWith('.js') && f !== '00-shell.html').sort();

const js = parts
  .map((f) => readFileSync(join(src, f), 'utf8').replace(/\s+$/, ''))
  .join('\n\n');

const html = shell.replace(/\s+$/, '') +
  '\n\n<script src="' + THREE_CDN + '"></script>\n' +
  '<script>\n' + js + '\n</script>\n</body>\n</html>\n';

/* Syntax-check the concatenated program before it is ever opened in a browser.
   (The file is one IIFE, so node --check is a real gate, not a formality.) */
const checkFile = join(here, 'bundle.check.js');
writeFileSync(checkFile, js + '\n');
try {
  execFileSync(process.execPath, ['--check', checkFile], { stdio: 'pipe' });
} catch (error) {
  console.error('SYNTAX ERROR in the assembled program:\n');
  console.error(String(error.stderr || error.message));
  process.exit(1);
}

writeFileSync(out, html, 'utf8');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('parts:  ' + parts.length + '  (' + parts.join(', ') + ')');
console.log('script: ' + kb(js.length) + '   lines: ' + js.split('\n').length);
console.log('output: ' + out + '  (' + kb(html.length) + ')');
