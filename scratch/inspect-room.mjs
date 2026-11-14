/* inspect-room.mjs — print every mesh in one room's group: geometry, material
 * colour, texture kind, size and position. Used to find the thing that turned
 * up in the Trophy Hall that was not supposed to be there.
 *
 *   node scratch/inspect-room.mjs trophy-hall
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const id = process.argv[2] || 'trophy-hall';
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  const rows = await evaluate(`(() => {
    const m = window.__museum;
    const room = m.plan.byId(${JSON.stringify(id)});
    const out = [];
    room.group.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      const s = o.geometry.boundingBox.getSize(new (o.position.constructor)());
      out.push({
        geo: o.geometry.type,
        kind: (o.material.map && o.material.map.userData && o.material.map.userData.kind) || null,
        col: o.material.color ? '#' + o.material.color.getHexString() : null,
        size: [s.x.toFixed(2), s.y.toFixed(2), s.z.toFixed(2)],
        pos: [o.position.x.toFixed(2), o.position.y.toFixed(2), o.position.z.toFixed(2)],
        verts: o.geometry.attributes.position.count,
        inst: o.isInstancedMesh ? o.count : null
      });
    });
    return out;
  })()`);
  for (const r of rows) console.log(JSON.stringify(r));
});
