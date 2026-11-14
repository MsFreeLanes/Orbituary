/* probe-corridor-props.mjs — who is standing in the corridor?
 *   node scratch/probe-corridor-props.mjs
 * check-collision says ten furniture circles sit on a corridor centreline and
 * prints where. This prints what they are and which corridor, so the placement
 * rule that put them there can be found and fixed.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  const out = await evaluate(`(() => {
    const m = window.__museum;
    const blockers = m.rig.blockers();
    const rows = [];
    m.plan.walkable.rects.filter((r) => r.kind === 'corridor').forEach((c) => {
      const s = Math.sin(c.angle), ct = Math.cos(c.angle);
      for (let t = -c.halfZ + 0.4; t <= c.halfZ - 0.2; t += 0.5) {
        const x = c.cx - t * s, z = c.cz + t * ct;
        blockers.forEach((b) => {
          if (b.floor && b.floor !== c.floor) return;
          const d = Math.hypot(b.x - x, b.z - z);
          if (d > b.r + 0.3) return;
          /* how far the piece sits off the centreline, and which way to push it */
          const across = (b.x - c.cx) * -s + (b.z - c.cz) * ct;
          const key = b.what + '|' + b.x.toFixed(1) + '|' + b.z.toFixed(1);
          if (rows.some((r) => r.key === key)) return;
          rows.push({ key, corridor: c.room || 'corridor', floor: c.floor,
            r: +b.r.toFixed(2), what: b.what,
            at: [+b.x.toFixed(1), +b.z.toFixed(1)],
            push: +across.toFixed(2) >= 0 ? -1 : 1,
            need: +(b.r + 0.45 - Math.abs(across)).toFixed(2) });
        });
      }
    });
    return rows;
  })()`);
  out.forEach((r) => console.log(JSON.stringify(r)));
  console.log(out.length, 'pieces of furniture on a corridor centreline');
});
