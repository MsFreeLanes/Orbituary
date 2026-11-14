/* check-tube.mjs — the cellar tubes: shape in Node, agreement in the browser.
 *   node scratch/check-tube.mjs
 *
 * tube.js is a pure function, so its shape can be read straight off the module:
 * how many attempts in a minute, how long each flash lasts, whether the tube
 * catches. Then the page is asked what the fitting's glow and the room's light
 * are actually doing at the same instant — the whole point of one shared
 * function is that they cannot drift apart.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';
import { tubeEnvelope, tubePhase } from '../src/tube.js';

const ROOMS = ['science', 'journalism', 'accessibility', 'stair-hall'];
const K = { science: 0.22, journalism: 0.45, accessibility: 0.05, 'stair-hall': 0.12 };

console.log('--- shape over 90 s, sampled every 40 ms');
for (const id of ROOMS) {
  const ph = tubePhase(id);
  let attempts = 0, flashes = 0, dark = 0, caught = 0, prev = 1;
  const seen = new Set();
  for (let t = 0; t < 90; t += 0.04) {
    const v = tubeEnvelope(t, ph, K[id]);
    if (v > 1.3) { flashes++; if (!seen.has(Math.floor(t))) { seen.add(Math.floor(t)); } }
    if (v < 0.2) dark++;
    if (prev < 0.2 && v > 1.3) attempts++;
    if (prev < 0.6 && v > 0.9) caught++;
    prev = v;
  }
  console.log(`${id.padEnd(14)} k=${K[id]}  strikes ${flashes}  dark samples ${dark}  recoveries ${caught}`);
}

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const sample = `(() => {
  const m = window.__museum;
  const out = [];
  ['science', 'journalism', 'sports'].forEach((id) => {
    const room = m.plan.byId(id);
    const glow = room._lamps && room._lamps.glow;
    if (!glow) { out.push({ id, glow: null }); return; }
    const lights = [];
    m.scene.traverse((o) => {
      if (o.isPointLight && o.userData && o.userData.anchor && o.userData.anchor.room === id
          && o.userData.base > 0.5) {
        lights.push(+(o.intensity / (o.userData.base || 1)).toFixed(3));
      }
    });
    out.push({ id, glow: +(glow.emissiveIntensity / 0.95).toFixed(3), lights });
  });
  return out;
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  await evaluate('window.__museum.rig.teleportTo("journalism")');
  await nap(1200);
  let agree = 0, worst = 0, worstRow = null;
  for (let i = 0; i < 40; i++) {
    const rows = await evaluate(sample);
    for (const r of rows) {
      if (!r.glow || !r.lights.length) continue;
      /* the glow is written when the tube is drawn and the light when the pool
         is placed, so during a strike they can be a frame apart. what matters
         is that the gap never exceeds one frame of the beat. */
      const gap = Math.min(...r.lights.map((v) => Math.abs(v - r.glow)));
      if (gap < 0.02) agree++;
      if (gap > worst) { worst = gap; worstRow = r; }
    }
    await nap(120);
  }
  console.log('--- glow vs light over 5 s');
  console.log('agree', agree, 'of 40  worst gap', worst.toFixed(3));
  if (worst > 0.3) console.log('  worst row', JSON.stringify(worstRow));
});
