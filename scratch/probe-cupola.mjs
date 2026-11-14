/* probe-cupola.mjs — is the Cupola built once or twice?
 *   node scratch/probe-cupola.mjs
 *
 * buildRoom runs for every room in plan.rooms, and the Cupola is a room. The
 * Observatory also has its own circular gallery builder. This asks the live
 * scene what is actually standing in the middle of the rotunda.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const probe = `(() => {
  const m = window.__museum, S = m.S, plan = m.plan;
  const room = plan.rooms.find((r) => r.kind === 'cupola');
  const g = room.group;
  const box = new m.THREE.Box3();
  if (g) box.setFromObject(g);
  let meshes = 0, tris = 0;
  if (g) g.traverse((o) => {
    if (o.isMesh) { meshes++; const p = o.geometry.attributes.position; tris += (p ? p.count : 0) / 3; }
  });
  /* every pick node whose exhibit says cupola, and which group it hangs off */
  const nodes = [];
  m.scene.traverse((o) => {
    if (o.userData && o.userData.exhibit && o.userData.exhibit.room === 'cupola') {
      const p = new m.THREE.Vector3(); o.getWorldPosition(p);
      nodes.push({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), group: (o.parent && o.parent.uuid.slice(0, 6)) || '',
        link: o.userData.exhibit.link === undefined ? 'undefined' : o.userData.exhibit.link });
    }
  });
  const groups = {};
  nodes.forEach((n) => { groups[n.group] = (groups[n.group] || 0) + 1; });
  /* does the gallery's rect cover the middle of the hub? */
  const inRect = (r, x, z) => {
    const dx = x - r.cx, dz = z - r.cz, c = Math.cos(r.angle), s = Math.sin(r.angle);
    return Math.abs(dx * c + dz * s) <= r.halfX && Math.abs(-dx * s + dz * c) <= r.halfZ;
  };
  return {
    kind: room.kind, w: room.w, d: room.d, entry: room.entry, angle: +room.angle.toFixed(3),
    groupChildren: g ? g.children.length : 0, meshes, tris: Math.round(tris),
    bbox: { min: [box.min.x.toFixed(2), box.min.y.toFixed(2), box.min.z.toFixed(2)],
      max: [box.max.x.toFixed(2), box.max.y.toFixed(2), box.max.z.toFixed(2)] },
    pickNodes: nodes.length, byGroup: groups, links: nodes.map((n) => n.link).join(','),
    hubCentreReadsAs: plan.roomAt ? plan.roomAt(0, 0) : 'n/a',
    entryReadsAs: plan.roomAt ? plan.roomAt(0, 4.5) : 'n/a',
    plinthCount: room.plinths.length
  };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  const r = await evaluate(probe);
  console.log(JSON.stringify(r, null, 1));
});
