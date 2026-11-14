/* probe-stuck.mjs — why does the rig stand inside a blocker it can see?
 *   node scratch/probe-stuck.mjs
 * Asks the rig to settle a point the tour left inside a blocker, and prints
 * every blocker within a metre of it, plus what settle answers.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const pts = [[-3.77, -0.05], [4.02, 23.0], [1.18, -18.0]];

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  const rows = await evaluate(`(() => {
    const m = window.__museum, rig = m.rig;
    const rows = [];
    for (const [x, z] of ${JSON.stringify(pts)}) {
      const near = rig.blockers().filter((b) => Math.hypot(b.x - x, b.z - z) < 1.4)
        .map((b) => b.what + ' r' + b.r.toFixed(2) + ' ' + b.floor + ' (' + b.x.toFixed(2) + ',' + b.z.toFixed(2) + ')');
      const rects = m.plan.walkable.rects.filter((r) => Math.hypot(r.cx - x, r.cz - z) < 6)
        .map((r) => r.kind + ' ' + (r.room || '') + ' floor=' + r.floor + ' c(' + r.cx.toFixed(2) + ',' + r.cz.toFixed(2) +
          ') half(' + r.halfX.toFixed(2) + ',' + r.halfZ.toFixed(2) + ') ang=' + (r.angle * 57.3).toFixed(1));
      const cover = ['ground', 'basement'].map((f) => f + ':' + m.inside(m.plan.walkable, x, z, 0.3, f));
      rows.push({ at: [x, z], cover, rects, near });
    }
    rig.state.storey = 'ground';
    return rows;
  })()`);
  rows.forEach((r) => {
    console.log('at', r.at.join(','), '| covered at body width:', r.cover.join(' '));
    r.rects.forEach((n) => console.log('    ', n));
    r.near.forEach((n) => console.log('     blocker', n));
  });
});
