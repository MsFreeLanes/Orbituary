/* shot-moon.mjs — the moon, close enough to count craters.
 *   node scratch/shot-moon.mjs
 * Stands in the Observatory, steps the simulated clock until the moon is above
 * the horizon, aims the camera at it and takes the picture. The moon is drawn
 * once per phase change, so this also proves the painting does not throw.
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
  const r = await evaluate(`(() => {
    const m = window.__museum;
    m.rig.teleportTo('cupola');
    let moon = null;
    m.sky.group.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' &&
          Math.abs(o.geometry.parameters.width - 11) < 0.01) moon = o;
    });
    if (!moon) return { err: 'no moon mesh' };
    const now = Date.now();
    let found = null;
    for (let h = 0; h <= 20; h++) {
      m.sky.update(now + h * 3600e3);
      if (moon.visible) { found = h; break; }
    }
    if (found === null) return { err: 'moon never rose' };
    const p = new m.THREE.Vector3(); moon.getWorldPosition(p);
    const s = m.rig.state;
    const dx = p.x - s.x, dz = p.z - s.z;
    s.yaw = Math.atan2(-dx, -dz);
    s.pitch = Math.atan2(p.y - (s.level + 1.65), Math.hypot(dx, dz));
    return { hours: found, phase: +m.sky.state.phase.toFixed(3),
      dir: [+p.x.toFixed(0), +p.y.toFixed(0), +p.z.toFixed(0)],
      pitch: +(s.pitch * 57.3).toFixed(1), yaw: +(s.yaw * 57.3).toFixed(1) };
  })()`);
  console.log(JSON.stringify(r));
  /* the disc on screen is 40 pixels wide, which proves nothing about the
     painting. dump the texture itself and its mean luminance: the bloom
     threshold is 0.70 and the paint has to stay under it. */
  const tex = await evaluate(`(() => {
    const m = window.__museum;
    let moon = null;
    m.sky.group.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' &&
          Math.abs(o.geometry.parameters.width - 11) < 0.01) moon = o;
    });
    const c = moon.material.map.image;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let sum = 0, n = 0, inside = 0;
    for (let i = 0; i < d.length; i += 4) {
      const px = (i / 4) % c.width, py = (i / 4) / c.width | 0;
      const dx = px - c.width / 2, dy = py - c.height / 2;
      if (Math.hypot(dx, dy) > c.width * 0.34) continue;
      sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++;
      if (d[i + 3] > 200) inside++;
    }
    return { size: c.width, mean: +(sum / n / 255).toFixed(3), opaque: +(inside / n).toFixed(3) };
  })()`);
  console.log('texture', JSON.stringify(tex));
  const dataUrl = await evaluate(`(() => {
    const m = window.__museum;
    let moon = null;
    m.sky.group.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' &&
          Math.abs(o.geometry.parameters.width - 11) < 0.01) moon = o;
    });
    return moon.material.map.image.toDataURL('image/png');
  })()`);
  fs.writeFileSync(path.join(process.cwd(), 'scratch', 'moon-texture.png'),
    Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote scratch/moon-texture.png');
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.cwd(), 'scratch', 'moon-close.png'), Buffer.from(shot.data, 'base64'));
  console.log('wrote scratch/moon-close.png');
});
