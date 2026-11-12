/* How much of the real sky is actually visible through a window? Count the
   catalogue and procedural stars inside the view cone of a room's window wall
   and report their brightness, plus what the haze band is doing. */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4000);
  console.log(await evaluate(`(() => {
    const m = window.__museum, T = m.THREE;
    const r = m.plan.byId('privacy');
    const eye = { x: r.entry.x + r.n.x * 1.8, y: 1.65, z: r.entry.z + r.n.z * 1.8 };
    let stars = null, planets = null, haze = null, vault = null;
    m.sky.group.children.forEach((o) => {
      if (o.isPoints) { if (!stars) stars = o; else planets = o; }
      if (o.isMesh) { if (o.geometry.type === 'CylinderGeometry') haze = o; else vault = o; }
    });
    const pos = stars.geometry.attributes.position;
    const col = stars.geometry.attributes.color;
    const dir = new T.Vector3(r.n.x, 0, r.n.z);
    let inCone = 0, above = 0, bright = 0, sum = 0;
    const v = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize().applyQuaternion(m.sky.group.quaternion);
      const dot = v.x * dir.x + v.y * dir.y + v.z * dir.z;
      const alt = Math.asin(v.y) * 57.2958;
      if (alt > 0) above++;
      if (dot > Math.cos(0.35)) {
        inCone++;
        if (alt > 0) {
          const lum = 0.3 * (col.getX(i) + col.getY(i) + col.getZ(i));
          sum += lum; if (lum > 0.5) bright++;
        }
      }
    }
    return {
      totalStars: pos.count, aboveHorizon: above,
      inWindowCone: inCone, inConeAboveHorizon: bright,
      meanStarColor: +(sum / Math.max(1, inCone)).toFixed(3),
      starSize: stars.material.size, starOpacity: stars.material.opacity,
      hazeOpacity: haze && haze.material.opacity, hazeH: haze && haze.geometry.parameters.height,
      vaultOpacity: vault && vault.material.opacity,
      skyState: { lat: m.sky.state.lat, lst: +(m.sky.state.lst * 57.3).toFixed(1), sunAlt: +m.sky.state.sunAlt.toFixed(2), phase: m.sky.state.phase }
    };
  })()`));
});
