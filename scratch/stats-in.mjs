/* stats-in.mjs — what one room costs the renderer.
 *   node scratch/stats-in.mjs [roomId ...]
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['cupola', 'science', 'sports'];

const stand = (id) => `(() => {
  const m = window.__museum;
  const room = m.plan.byId(${JSON.stringify(id)});
  const d = room.door, n = room.n;
  m.rig.state.storey = room.floor;
  m.rig.state.x = d.x + n.x * (room.d * 0.5);
  m.rig.state.z = d.z + n.z * (room.d * 0.5);
  m.rig.setYawPitch(Math.atan2(-(d.x - m.rig.state.x), -(d.z - m.rig.state.z)), 0);
  m.rig.update(0.016);
  return room.code;
})()`;

const stats = `(() => { const m = window.__museum;
  m.view.renderer.info.autoReset = false; m.view.renderer.info.reset();
  m.view.renderer.render(m.view.scene, m.camera);
  const info = m.view.renderer.info.render;
  m.view.renderer.info.autoReset = true;
  const on = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  let atmo = 0;
  m.scene.traverse((o) => { if (o.userData && o.userData.atmo && on(o)) atmo++; });
  return { storey: m.rig.state.storey,
    calls: info.calls, tris: info.triangles, atmoOn: atmo }; })()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  for (const id of ids) {
    console.log(id, await evaluate(stand(id)));
    await nap(1800);
    console.log('  ', JSON.stringify(await evaluate(stats)));
  }
  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors || []')));
});
