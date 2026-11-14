/* dump-glass.mjs — every transparent surface in the building, and where it is.
 *
 *   node scratch/dump-glass.mjs [roomId]
 *
 * The hairlines across a cellar wall are the edges of something see-through:
 * two close parallel lines where a sheet crosses the wall at a shallow angle,
 * and the lines stop where the sheet stops. This lists every object whose
 * material is transparent, with its world bounding box, so the sheet can be
 * named.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const id = process.argv[2] || 'science';
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  const out = await evaluate(`(() => {
    const m = window.__museum;
    const room = m.plan.byId(${JSON.stringify(id)});
    const f = (n) => Math.round(n * 100) / 100;
    const rows = [];
    m.scene.updateMatrixWorld(true);
    m.scene.traverse((o) => {
      const mat = o.material;
      if (!mat || !mat.transparent) return;
      if (!o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = new m.THREE.Box3().setFromObject(o);
      const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
      const near = Math.hypot(cx - room.center.x, cz - room.center.z) < 14;
      rows.push({
        near, kind: (o.userData && (o.userData.atmo || o.userData.kind)) || null,
        geo: o.geometry.type || 'Buffer',
        mat: mat.type + (mat.map ? '+map' : '') + (mat.side === 2 ? '/2side' : ''),
        op: f(mat.opacity === undefined ? 1 : mat.opacity),
        order: o.renderOrder,
        x: [f(b.min.x), f(b.max.x)], y: [f(b.min.y), f(b.max.y)], z: [f(b.min.z), f(b.max.z)],
        verts: o.geometry.attributes.position ? o.geometry.attributes.position.count : 0
      });
    });
    rows.sort((a, b2) => (b2.near ? 1 : 0) - (a.near ? 1 : 0));
    return { ok: true, code: room.code, cat: room.cat, center: [f(room.center.x), f(room.center.z)], rows };
  })()`);
  console.log(JSON.stringify({ code: out.code, cat: out.cat, center: out.center }));
  (out.rows || []).slice(0, 40).forEach((r) => console.log(JSON.stringify(r)));
  console.log('total transparent objects: ' + (out.rows || []).length);
});
