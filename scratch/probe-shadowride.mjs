/* probe-shadowride.mjs — does the sun's shadow box still ride with the visitor?
 *
 *   node scratch/probe-shadowride.mjs
 *
 * An earlier commit moved the shadow box off the origin and made it follow the
 * visitor, because a 2048 map stretched over the whole 100 m plan gives 6 cm a
 * texel and window bars at 6 cm a texel are not window bars. Sunlight is a
 * bigger ask than the old key light ever was — it rakes, so the bars are long
 * and the map is doing more work — so this checks the box was not quietly
 * pinned back to a fixed span: stand in rooms at the four ends of the plan and
 * read back where the shadow camera is looking and how wide it is.
 */
import { withBrowser } from './cdp.mjs';
import path from 'node:path';

const ROOMS = ['gaming', 'privacy', 'linux', 'art', 'artefacts', 'open-source', 'astronomy'];

const READ = `(() => {
  const m = window.__museum, sun = m.lighting.sun, cam = sun.shadow.camera;
  const t = sun.target.position;
  const d = Math.hypot(t.x - m.rig.state.x, t.z - m.rig.state.z);
  return {
    visitor: m.rig.state.x.toFixed(1) + ',' + m.rig.state.z.toFixed(1) + ' y' + m.rig.state.storey,
    target: t.toArray().map((v) => v.toFixed(1)).join(','),
    off: d.toFixed(2),
    span: (cam.right - cam.left).toFixed(0),
    far: cam.far.toFixed(0),
    lightR: sun.position.distanceTo(t).toFixed(0),
    alt: (Math.asin(sun.position.clone().sub(t).normalize().y) * 180 / Math.PI).toFixed(1),
    i: sun.intensity.toFixed(2)
  };
})()`;

await withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  /* the sun up at the moment the probe runs is the sun the box is being aimed
     with; the hour is left wherever the visitor left it */
  console.log('hour', await evaluate('document.querySelector(".sky-clock").textContent'), 'sunAlt',
    (await evaluate('window.__museum.sky.state.sunAlt') * 180 / Math.PI).toFixed(1));
  for (const id of ROOMS) {
    await evaluate(`window.__museum.rig.teleportTo('${id}')`);
    await sleep(700);
    const r = await evaluate(READ);
    console.log(id.padEnd(12), 'visitor ' + r.visitor.padEnd(22), 'target ' + r.target.padEnd(20),
      'off ' + r.off, '· box ' + r.span + ' m far ' + r.far + ' lightR ' + r.lightR,
      '· alt ' + r.alt + ' i ' + r.i);
  }
  /* walking: the same spoke, read at three distances, so the box can be seen
     moving rather than merely being somewhere other than the origin */
  console.log('\nwalking the North spoke out from the drum:');
  for (const z of [10, 20, 30, 40, 48]) {
    await evaluate(`(() => { const m = window.__museum; m.rig.state.storey = 'ground';
      m.rig.state.x = 0; m.rig.state.z = ${z}; })()`);
    await sleep(500);
    const r = await evaluate(READ);
    console.log(('z=' + z).padEnd(6), 'visitor ' + r.visitor.padEnd(14), 'target ' + r.target.padEnd(20),
      'off ' + r.off, '· box ' + r.span + ' m');
  }
});
