/* dump-at.mjs — everything the ray hits on its way through a wall.
 *   node scratch/dump-at.mjs [roomId] [localX] [localY]
 *
 * The hairlines vanish when the wall's map comes off but survive every other
 * switch, which is the signature of two coplanar surfaces: same colour, same
 * flat look with no map, different picture with one. This fires a ray from a
 * point inside the room, straight into the wall, and lists every surface it
 * passes through with the distance and whose group it belongs to.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const id = process.argv[2] || 'science';
const lx = Number(process.argv[3] ?? 2.0);
const ly = Number(process.argv[4] ?? 2.5);
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const probe = `(() => {
  const m = window.__museum, THREE = m.THREE;
  const room = m.plan.byId(${JSON.stringify(id)});
  const frame = new THREE.Matrix4().makeRotationY(room.angle);
  frame.setPosition(room.entry.x, m.S.FLOOR_BASE, room.entry.z);
  const P = new THREE.Vector3(${lx}, ${ly}, 0.175).applyMatrix4(frame);
  const n = new THREE.Vector3(room.n.x, 0, room.n.z);
  const from = P.clone().addScaledVector(n, -${Number(process.argv[5] ?? 1.0)});
  const ray = new THREE.Raycaster(from, n.clone(), 0.2, 3.0);
  const hits = ray.intersectObject(m.scene, true);
  const owner = (o) => {
    const chain = [];
    for (let p = o; p && p !== m.scene; p = p.parent) {
      const ud = p.userData || {};
      chain.push(ud.room ? ud.room.cat + '/' + ud.room.code : (ud.kind || (p.isGroup ? 'group' : p.type)));
    }
    return chain.slice(0, 4).join(' < ');
  };
  return hits.slice(0, 12).map((h) => ({
    d: +h.distance.toFixed(3),
    at: [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2)],
    localY: +(h.point.y - m.S.FLOOR_BASE).toFixed(2),
    colour: h.object.material && h.object.material.color ? h.object.material.color.getHexString() : null,
    verts: h.object.geometry && h.object.geometry.attributes.position ? h.object.geometry.attributes.position.count : null,
    transparent: h.object.material ? !!h.object.material.transparent : null,
    order: h.object.renderOrder,
    owner: owner(h.object),
  }));
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  const hits = await evaluate(probe);
  console.log('wall inner face at local', lx, ly, '— ray from 1 m inside the room, pointing into the wall');
  for (const h of hits) console.log(JSON.stringify(h));
  console.log('hits:', hits.length);
});
