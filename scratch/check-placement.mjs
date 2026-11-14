/* check-placement.mjs — is every pedestal actually standing where a floor is?
 *   node scratch/check-placement.mjs
 *
 * Nothing in the repo compares an exhibit position with the holes in the floor,
 * the corridor it might be standing in, or the room that owns it. Plinths are
 * laid out as circles about a point (the rotunda's six, the Cupola's six), and
 * a circle does not know about the stair well. This reads the positions out of
 * the live scene — the pick nodes the builder attaches to each pedestal — so it
 * tests what was built, not what the plan meant.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const probe = `(() => {
  const m = window.__museum, S = m.S, plan = m.plan;
  const nodes = [];
  m.scene.traverse((o) => {
    if (o.userData && o.userData.exhibit !== undefined) {
      const p = new m.THREE.Vector3(); o.getWorldPosition(p);
      nodes.push({ x: p.x, z: p.z, y: p.y, exhibit: o.userData.exhibit,
        parent: (o.parent && o.parent.name) || '', spot: o.userData.exhibit && o.userData.exhibit.spot });
    }
  });

  /* the two holes in the rotunda floor, and the corridor mouths */
  const stair = plan.stair;
  const hole = { x0: stair.x - stair.w / 2, x1: stair.x + stair.w / 2,
    z0: Math.min(stair.z, stair.z + stair.run), z1: Math.max(stair.z, stair.z + stair.run) };
  const well = { x: 0, z: S.CUPOLA_WELL_Z, r: S.CUPOLA_WELL_R };

  const corridors = plan.walkable.rects.filter((r) => r.kind === 'corridor');
  const inRect = (r, x, z) => {
    const dx = x - r.cx, dz = z - r.cz;
    if (!r.angle) return Math.abs(dx) <= r.halfX && Math.abs(dz) <= r.halfZ;
    const c = Math.cos(r.angle), s = Math.sin(r.angle);
    return Math.abs(dx * c + dz * s) <= r.halfX && Math.abs(-dx * s + dz * c) <= r.halfZ;
  };

  const bad = { hole: [], corridor: [], far: [], dupe: [], noLink: [] };
  const seen = [];
  nodes.forEach((n) => {
    if (n.x > hole.x0 - 0.3 && n.x < hole.x1 + 0.3 && n.z > hole.z0 - 0.3 && n.z < hole.z1 + 0.3) bad.hole.push(n);
    if (Math.hypot(n.x - well.x, n.z - well.z) < well.r + 0.3) bad.hole.push(n);
    /* a pedestal in a corridor is only an obstruction where the corridor meets
       something: the plan's corridor rects run from the centre of what they
       grow out of, so most of a spoke lies inside the hub, and a pedestal
       standing there is standing on hub floor. Only flag it past the drum. */
    const c = corridors.find((r) => inRect(r, n.x, n.z) && Math.hypot(n.x, n.z) > S.ROTUNDA_R);
    if (c) bad.corridor.push(Object.assign({ where: (c.room || 'corridor') }, n));
    /* whose room is it standing in? */
    const owner = plan.walkable.rects.filter((r) => r.room).find((r) => inRect(r, n.x, n.z));
    n.owner = owner ? owner.room : (Math.hypot(n.x, n.z) < S.ROTUNDA_R ? 'rotunda' : 'nothing');
    if (owner === undefined && n.owner === 'nothing') bad.far.push(n);
    const hit = seen.find((p) => Math.hypot(p.x - n.x, p.z - n.z) < 0.08);
    if (hit) bad.dupe.push({ x: +n.x.toFixed(2), z: +n.z.toFixed(2), first: hit.owner, second: n.owner });
    else seen.push(n);
    if (n.exhibit && n.exhibit.link === undefined) bad.noLink.push(n);
  });

  const byOwner = {};
  seen.forEach((n) => { byOwner[n.owner] = (byOwner[n.owner] || 0) + 1; });
  const fmt = (a) => a.map((n) => '(' + n.x.toFixed(2) + ', ' + n.z.toFixed(2) + ')').join(' ');
  return {
    nodes: nodes.length, distinct: seen.length,
    hole: fmt(bad.hole), corridor: fmt(bad.corridor), corridorWhere: bad.corridor.map((n) => n.where),
    far: fmt(bad.far), dupe: bad.dupe, noLink: bad.noLink.length,
    rotunda: byOwner.rotunda || 0, cupola: byOwner.cupola || 0,
    stair: hole, well
  };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  const r = await evaluate(probe);
  console.log('pick nodes', r.nodes, ' distinct positions', r.distinct);
  console.log('stair opening', JSON.stringify(r.stair), ' well', JSON.stringify(r.well));
  console.log('over a hole      :', r.hole || 'none');
  console.log('in a corridor    :', r.corridor || 'none', r.corridorWhere.length ? [...new Set(r.corridorWhere)].join(',') : '');
  console.log('in no room at all:', r.far || 'none');
  console.log('same spot twice  :', r.dupe.length ? JSON.stringify(r.dupe) : 'none');
  console.log('exhibit.link undefined:', r.noLink);
  console.log('rotunda nodes', r.rotunda, ' cupola nodes', r.cupola);
});
