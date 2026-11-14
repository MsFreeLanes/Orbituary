/* dump-planes.mjs — every thin sheet near one wall of a room.
 *
 *   node scratch/dump-planes.mjs [roomId]
 *
 * The stripes across the door wall of a cellar room look like two surfaces
 * occupying the same plane: the room's own wall and whatever the corridor
 * builder puts at the same place. This prints the local bounding box of every
 * mesh in the room's group and in the arm's group whose box is thin and sits
 * within 40 cm of the room's door wall, so the two can be read against each
 * other.
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
    const m = window.__museum, S = m.S;
    const room = m.plan.byId(${JSON.stringify(id)});
    /* the room's group is the last child of its wing group that stands at the
       room's entry; the wing group is the parent */
    let rg = null;
    m.scene.traverse((o) => {
      if (o.isGroup && Math.abs(o.position.x - room.entry.x) < 0.01 &&
          Math.abs(o.position.z - room.entry.z) < 0.01 &&
          Math.abs(o.rotation.y - room.angle) < 0.001) rg = o;
    });
    if (!rg) return { ok: false };
    const wing = rg.parent;
    const f = (n) => Math.round(n * 100) / 100;
    const rows = [];
    const scan = (group, tag) => {
      group.children.forEach((o, i) => {
        if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        if (!b) return;
        const thinZ = (b.max.z - b.min.z) < 0.30;
        const thinX = (b.max.x - b.min.x) < 0.30;
        /* in world space for the arm's own meshes: undo the arm's transform,
           which for a wing group is the identity, then put it into the room's
           frame by the inverse of the room group's matrix */
        let bb = { min: { ...b.min }, max: { ...b.max } };
        if (tag === 'arm') {
          const inv = new m.THREE.Matrix4().copy(rg.matrixWorld).invert();
          const g2 = o.geometry.clone().applyMatrix4(inv);
          g2.computeBoundingBox();
          bb = { min: g2.boundingBox.min, max: g2.boundingBox.max };
          g2.dispose();
        }
        const nearDoor = bb.max.z > -0.7 && bb.min.z < 0.7;
        const nearFar = bb.max.z > room.d - 0.7 && bb.min.z < room.d + 0.7;
        const big = (bb.max.x - bb.min.x) > 0.8 || (bb.max.z - bb.min.z) > 0.8;
        if (big && (nearDoor || nearFar)) {
          rows.push({
            tag, i, geo: o.geometry.type || 'Buffer',
            mat: (o.material && o.material.color ? '#' + o.material.color.getHexString() : '?'),
            x: [f(bb.min.x), f(bb.max.x)], y: [f(bb.min.y), f(bb.max.y)], z: [f(bb.min.z), f(bb.max.z)],
            thick: f(Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z)),
            verts: o.geometry.attributes.position.count,
            atmo: (o.userData && o.userData.atmo) || null,
            where: nearDoor ? 'door wall' : (nearFar ? 'far wall' : 'side')
          });
        }
      });
    };
    scan(rg, 'room');
    scan(wing, 'arm');
    return { ok: true, code: room.code, cat: room.cat, w: room.w, d: room.d, t: S.WALL_T, rows };
  })()`);
  console.log(JSON.stringify({ code: out.code, cat: out.cat, w: out.w, d: out.d, t: out.t }));
  (out.rows || []).forEach((r) => console.log(JSON.stringify(r)));
  console.log('atmosphere meshes are tagged userData.atmo');
});
