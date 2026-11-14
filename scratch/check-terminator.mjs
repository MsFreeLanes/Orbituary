/* check-terminator.mjs — is the night side of the planet on the night side?
 *   node scratch/check-terminator.mjs
 * The Earth is painted with the terminator swept by the real sun. The canvas is
 * drawn top-down and the texture is uploaded bottom-up, so the bearing that
 * turns the brush has one sign that matters: get it wrong and the map is
 * mirrored across the equator and the dark half sits under the sun. This steps
 * the clock through a day and, at each hour, reads the painted canvas back and
 * compares the patch of ground turned towards the sun with the patch turned
 * away. While the sun is up, the sunward patch must be the brighter one; while
 * it is down, the other way round.
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
  if (!earth) return { err: 'no earth mesh' };
  const c = earth.material.map.image;
  const ctx = c.getContext('2d');
  const C = c.width, cc = C / 2, r = C * 0.47;
  const lum = (px, py) => {
    const d = ctx.getImageData(Math.max(0, Math.min(C - 9, px - 4)),
      Math.max(0, Math.min(C - 9, py - 4)), 9, 9).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return +(s / (d.length / 4) / 255).toFixed(3);
  };
  const now = Date.now();
  const rows = [];
  for (let h = 0; h < 24; h++) {
    m.sky.update(now + h * 3600e3);
    const d = m.sky.state.sunDir, alt = m.sky.state.sunAlt;
    const th = Math.atan2(d[2], d[0]);
    const sun = lum(cc + Math.cos(th) * r * 0.8, cc + Math.sin(th) * r * 0.8);
    const anti = lum(cc - Math.cos(th) * r * 0.8, cc - Math.sin(th) * r * 0.8);
    const up = alt > 0.15, down = alt < -0.15;
    /* The invariant is one direction only: the side turned away from the sun is
       the darker side. It is not true that a region in night must sit under
       darkness at 0.8 of the disc radius — that point is a long way towards the
       sun, where the sun is higher than it is at the centre, and it can honestly
       be in daylight while the centre is in night. Skip the hours where there is
       nothing to tell: the sun near the zenith, where the whole disc is lit, and
       the sun near the nadir, where the whole disc is dark. */
    let verdict = 'skip';
    if (alt < 1.45 && Math.max(sun, anti) > 0.12) verdict = sun > anti * 1.6 ? 'ok' : 'WRONG';
    rows.push({ h, alt: +(alt * 57.3).toFixed(1), sun, anti, verdict });
  }
  return rows;
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  const rows = await evaluate(probe);
  if (!Array.isArray(rows)) { console.log(JSON.stringify(rows)); process.exit(1); }
  rows.forEach((r) => console.log(
    String(r.h).padStart(2, '0') + ':00  sun alt ' + String(r.alt).padStart(6) +
    '  sunward ' + String(r.sun).padStart(6) + '  away ' + String(r.anti).padStart(6) + '  ' + r.verdict));
  const bad = rows.filter((r) => r.verdict === 'WRONG');
  console.log(bad.length ? 'FAIL: ' + bad.length + ' hours with the night side facing the sun'
    : 'terminator: the side turned away from the sun is the darker side at every hour that has a day side to compare it with');
});
