/* What is actually lighting a room? Print the pool: which anchor each point
   light is following, how bright it got, and where it is standing. */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4500);

  for (const room of ['gaming', 'privacy', 'linux']) {
    await evaluate(`(() => { const m = window.__museum; m.rig.teleportTo('${room}'); })()`);
    await sleep(1600);
    console.log(room, await evaluate(`(() => {
      const m = window.__museum;
      const r = m.plan.byId('${room}');
      const near = m.lighting.anchors
        .map((a) => ({ a, d: Math.hypot(a.x - m.rig.state.x, a.z - m.rig.state.z) }))
        .filter((p) => p.d < p.a.r * 2).sort((p, q) => p.d - q.d)
        .map((p) => (p.a.room || '?') + '@' + p.d.toFixed(1) + ' i' + p.a.i);
      const pool = m.lighting.pool.map((l) => ({
        i: +l.intensity.toFixed(1), d: +l.distance.toFixed(1),
        y: +l.position.y.toFixed(2),
        dx: +Math.hypot(l.position.x - m.rig.state.x, l.position.z - m.rig.state.z).toFixed(1)
      }));
      return { camY: m.rig.state.y, near: near.length, nearList: near.slice(0, 10), pool };
    })()`));
  }
});
