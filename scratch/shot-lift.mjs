/* shot-lift.mjs — the stair and the lift, from both ends.
 *   node scratch/shot-lift.mjs
 * The lift shares the stair well, so the two have to be read together: from the
 * rotunda you should see the flight on the left and the cabin behind glass on
 * the right, and from the hall below you should see the same shaft arriving at
 * the concrete.
 */
import path from 'node:path';
import fs from 'node:fs';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4800);
  await evaluate('window.__museum.hud.hideIntro()');
  const frames = [
    ['lift-from-rotunda', `(() => { const s = window.__museum.rig.state;
      s.x = 0; s.z = 1.6; s.yaw = 0; s.pitch = -0.12; s.storey = 'ground'; s.level = 0; return 'rotunda'; })()`],
    ['lift-from-hall', `(() => { const m = window.__museum, S = m.S; const s = m.rig.state;
      s.x = 0.95; s.z = -4.2; s.yaw = 0; s.pitch = 0.02; s.storey = 'basement'; s.level = S.FLOOR_BASE; return 'hall'; })()`],
    ['lift-from-the-cabin', `(() => { const m = window.__museum; const s = m.rig.state, L = m.built.lift;
      s.x = L.x; s.z = L.z; s.yaw = 0; s.pitch = -0.10; s.storey = 'ground'; s.level = 0;
      m.rig.update(0.05); m.rig.callLift();
      for (let i = 0; i < 60; i++) m.rig.update(0.05);
      return 'cabin at ' + L.cabin.position.y.toFixed(2); })()`]
  ];
  for (const [name, setup] of frames) {
    console.log(await evaluate(setup));
    await evaluate('window.__museum.rig.update(0.05)');
    await nap(1400);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(process.cwd(), 'scratch', name + '.png'), Buffer.from(shot.data, 'base64'));
    console.log('wrote scratch/' + name + '.png');
  }
});
