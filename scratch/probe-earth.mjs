/* probe-earth.mjs — one question: after an update, where is the Earth disc
 * in the group's own frame and in the world, and what is the group's
 * quaternion doing to it? */
import { withBrowser } from './cdp.mjs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  console.log(JSON.stringify(await evaluate(`(() => {
    const m = window.__museum, THREE = m.THREE;
    let earth = null, limb = null;
    m.sky.group.traverse((o) => {
      if (!o.isMesh) return;
      if (o.renderOrder === -2) earth = o;
      if (o.renderOrder === -1) limb = o;
    });
    window.__before = [earth.position.x, earth.position.y, earth.position.z];
    return { before: window.__before, sunAlt0: m.sky.state.sunAlt, frames: m.sky.state.lst };
  })()`), null, 1));
  await nap(2500);
  console.log(JSON.stringify(await evaluate(`(() => {
    const m = window.__museum;
    let earth = null;
    m.sky.group.traverse((o) => { if (o.isMesh && o.renderOrder === -2) earth = o; });
    return { afterWait: [earth.position.x, earth.position.y, earth.position.z],
      sunAlt: +m.sky.state.sunAlt.toFixed(3), lst: +m.sky.state.lst.toFixed(3) };
  })()`), null, 1));
  await evaluate(`(() => {
    const m = window.__museum;
    m.sky.update(Date.now());
  })()`);
  console.log(JSON.stringify(await evaluate(`(() => {
    const m = window.__museum, THREE = m.THREE;
    let earth = null, limb = null;
    m.sky.group.traverse((o) => {
      if (!o.isMesh) return;
      if (o.renderOrder === -2) earth = o;
      if (o.renderOrder === -1) limb = o;
    });
    const q = m.sky.group.quaternion;
    return {
      localBefore: window.__before,
      local: [earth.position.x, earth.position.y, earth.position.z],
      limbLocal: [limb.position.x, limb.position.y, limb.position.z],
      quat: [q.x, q.y, q.z, q.w].map((v) => +v.toFixed(3)),
      earthQuat: [earth.quaternion.x, earth.quaternion.y, earth.quaternion.z, earth.quaternion.w].map((v) => +v.toFixed(3)),
      sunDir: m.sky.state.sunDir.map((v) => +v.toFixed(2)),
      drop: m.S.EARTH_DROP
    };
  })()`), null, 1));
});
