/* probe-perf.mjs — what the page actually costs, and on what GPU.
 *   node scratch/probe-perf.mjs [roomId]
 *
 * The headless harness reports a misleading fps unless you ask for frame times
 * directly, so this samples requestAnimationFrame deltas in the page, prints the
 * unmasked GPU string, and reports the renderer's own counters. Use it before
 * and after any change to the cull or the material count.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const room = process.argv[2] || 'cupola';
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const read = `(() => {
  const m = window.__museum;
  const gl = m.view.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const info = dbg ? { vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) } : {};
  const c = m.view.renderer.info;
  return { info, calls: c.render.calls, tris: c.render.triangles, geoms: c.memory.geometries,
    texs: c.memory.textures, programs: c.programs ? c.programs.length : 0, tier: m.view.tier,
    dpr: devicePixelRatio, size: [innerWidth, innerHeight] };
})()`;

const frames = `new Promise((res) => {
  const t = []; let last = performance.now(); let n = 0;
  const step = () => { const now = performance.now(); t.push(now - last); last = now;
    if (++n < 120) requestAnimationFrame(step); else res(t.slice(20)); };
  requestAnimationFrame(step);
})`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  await evaluate(`window.__museum.rig.teleportTo(${JSON.stringify(room)})`);
  await nap(1200);
  const base = await evaluate(read);
  const dts = await evaluate(frames);
  const sorted = dts.slice().sort((a, b) => a - b);
  const pct = (p) => sorted[Math.floor(sorted.length * p)].toFixed(1);
  console.log('gpu     ', JSON.stringify(base.info));
  console.log('window  ', base.size.join('x'), 'dpr', base.dpr, 'tier', base.tier);
  console.log('counters', 'calls', base.calls, 'tris', base.tris, 'geoms', base.geoms, 'texs', base.texs, 'programs', base.programs);
  console.log('frame ms median', pct(0.5), 'p95', pct(0.95), 'worst', sorted[sorted.length - 1].toFixed(1),
    '=> ~', Math.round(1000 / Number(pct(0.5))), 'fps');
});
