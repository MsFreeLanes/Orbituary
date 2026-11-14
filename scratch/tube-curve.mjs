/* tube-curve.mjs — print the tube's level as a sparkline, straight from tube.js.
 *   node scratch/tube-curve.mjs [roomId] [k] [seconds]
 */
import { tubeEnvelope, tubePhase } from '../src/tube.js';

const id = process.argv[2] || 'accessibility';
const k = Number(process.argv[3] ?? 0.05);
const secs = Number(process.argv[4] ?? 40);
const ph = tubePhase(id);
const BAR = ' .:-=+*#%@';
let line = '';
const marks = [];
for (let t = 0; t < secs; t += 0.1) {
  const v = tubeEnvelope(t, ph, k);
  line += BAR[Math.min(9, Math.max(0, Math.round(v * 4.5)))];
  if (v > 1.3) marks.push(+t.toFixed(1));
}
console.log(id, 'k=' + k, 'phase=' + ph.toFixed(2), 'T=' + (7 + 16 * (1 - k)).toFixed(1) + 's');
console.log(line);
console.log('flash samples:', marks.length, marks.slice(0, 12).join(' '));
let v0 = tubeEnvelope(0, ph, k);
for (let t = 0.1; t < 6; t += 0.1) {
  const v = tubeEnvelope(t, ph, k);
  if (Math.abs(v - v0) > 0.05) { console.log('  t=' + t.toFixed(1), v0.toFixed(2), '->', v.toFixed(2)); v0 = v; }
}
