/* probe-terminator-angle.mjs — where did the paint actually put the night?
 *   node scratch/probe-terminator-angle.mjs
 * Reads the painted Earth canvas, finds the centre of the dark arc at 0.8 of the
 * disc radius, and prints it next to the angle each candidate convention says
 * the anti-sun should be at. One of these is the truth; the code has to agree
 * with the first number, not with the comment.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const probe = `(() => {
  const m = window.__museum, S = m.S;
  let earth = null;
  m.sky.group.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry' &&
        Math.abs(o.geometry.parameters.radius - S.EARTH_R) < 0.01) earth = o;
  });
  const c = earth.material.map.image, ctx = c.getContext('2d');
  const C = c.width, cc = C / 2, r = C * 0.47;
  const now = Date.now();
  const rows = [];
  for (const h of [2, 9, 16, 21]) {
    m.sky.update(now + h * 3600e3);
    const d = m.sky.state.sunDir, alt = m.sky.state.sunAlt;
    /* luminance all the way round the ring at 0.8 r */
    const ring = [];
    for (let a = 0; a < 360; a += 2) {
      const th = a * Math.PI / 180;
      const px = Math.round(cc + Math.cos(th) * r * 0.8), py = Math.round(cc + Math.sin(th) * r * 0.8);
      const q = ctx.getImageData(px - 2, py - 2, 5, 5).data;
      let s = 0;
      for (let i = 0; i < q.length; i += 4) s += 0.2126 * q[i] + 0.7152 * q[i + 1] + 0.0722 * q[i + 2];
      ring.push({ a, l: s / (q.length / 4) / 255 });
    }
    const mean = ring.reduce((s, p) => s + p.l, 0) / ring.length;
    const dark = ring.filter((p) => p.l < mean * 0.5);
    /* the centre of the dark arc, as a circular mean of its angles */
    let sx = 0, sz = 0;
    dark.forEach((p) => { sx += Math.cos(p.a * Math.PI / 180); sz += Math.sin(p.a * Math.PI / 180); });
    const painted = dark.length ? ((Math.atan2(sz, sx) * 180 / Math.PI) + 360) % 360 : null;
    const deg = (x) => ((x * 180 / Math.PI) + 360) % 360;
    rows.push({ h, alt: +(alt * 57.3).toFixed(1), darkPx: dark.length,
      painted: painted === null ? null : +painted.toFixed(1),
      plusZ: +deg(Math.atan2(d[2], d[0]) + Math.PI).toFixed(1),
      minusZ: +deg(Math.atan2(-d[2], d[0]) + Math.PI).toFixed(1),
      sunCanvas: +deg(Math.atan2(d[2], d[0])).toFixed(1) });
  }
  return rows;
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  (await evaluate(probe)).forEach((r) => console.log(JSON.stringify(r)));
});
