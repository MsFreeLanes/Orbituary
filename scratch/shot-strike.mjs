/* shot-strike.mjs — photograph a cellar tube in the act of trying to start.
 *   node scratch/shot-strike.mjs [roomId]
 *
 * tube.js is deterministic, so the next flash can be computed from the page's
 * own clock and the probe can wait for it rather than spraying frames and
 * hoping. Three frames: the strike, the dark beat just after it, and the
 * recovery.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';
import { tubeEnvelope, tubePhase } from '../src/tube.js';

const id = process.argv[2] || 'journalism';
const K = { science: 0.22, journalism: 0.45, accessibility: 0.05, sports: 0.40, music: 0.33 };
const k = K[id] ?? 0.2;
const phase = tubePhase(id);
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const pose = `(() => {
  const m = window.__museum;
  const room = m.plan.byId(${JSON.stringify(id)});
  const c = room.center;
  // stand a little off centre and look up at the tube over the middle of the room
  const px = c.x + Math.min(1.8, room.w / 2 - 0.8), pz = c.z + Math.min(1.8, room.d / 2 - 0.8);
  m.rig.state.storey = room.floor;
  m.rig.state.x = px; m.rig.state.z = pz;
  m.rig.setYawPitch(Math.atan2(-(c.x - px), -(c.z - pz)), 0.45);
  m.rig.update(0.016);
  return { code: room.code, cat: room.cat };
})()`;

const read = `(() => {
  const room = window.__museum.plan.byId(${JSON.stringify(id)});
  const glow = room._lamps && room._lamps.glow;
  return { glow: glow ? +glow.emissiveIntensity.toFixed(2) : null,
    env: glow && glow.userData.env != null ? +glow.userData.env.toFixed(3) : null,
    now: performance.now() * 0.001 };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  const set = await evaluate(pose);
  await nap(700);
  const at = await evaluate(read);
  console.log('room', set.code, set.cat, 'env', at.env, 'page clock', at.now.toFixed(2));
  if (at.env == null) { console.log('the tube is not in frame — nothing to photograph'); return; }

  // a flash is a tenth of a second and a screenshot costs more than that, so
  // the honest way to photograph an attempt is to sit through one and keep the
  // brightest and darkest frames of the run
  // sit through one attempt: predict when it starts, and start the run a
  // second ahead of it
  let dt = null;
  for (let t = at.now + 0.05; t < at.now + 40; t += 0.02) {
    if (tubeEnvelope(t, phase, k) > 1.3) { dt = t - at.now; break; }
  }
  if (dt === null) { console.log('no strike inside 40 s'); return; }
  console.log('next strike in', dt.toFixed(2) + ' s');
  if (dt > 1.2) await nap((dt - 1.0) * 1000);
  const frames = [];
  for (let i = 0; i < 26; i++) {
    const img = await send('Page.captureScreenshot', { format: 'png' });
    const g = await evaluate(`(() => { const r = window.__museum.plan.byId(${JSON.stringify(id)}); const g = r._lamps; return g && g.glow.userData.env != null ? +g.glow.userData.env.toFixed(2) : null; })()`);
    frames.push({ i, env: g, data: img.data });
  }
  const sorted = frames.filter((f) => f.env != null).sort((a, b) => a.env - b.env);
  const lo = sorted[0], hi = sorted[sorted.length - 1];
  console.log('env across the run:', frames.map((f) => f.env).join(' '));
  for (const [tag, f] of [['dark', lo], ['bright', hi]]) {
    writeFileSync(path.join(process.cwd(), 'scratch', 'strike-' + tag + '-' + id + '.png'), Buffer.from(f.data, 'base64'));
    console.log('wrote strike-' + tag + '-' + id + '.png at env ' + f.env + ' (frame ' + f.i + ')');
  }
});
