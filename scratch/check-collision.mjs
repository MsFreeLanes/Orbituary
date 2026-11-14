/* check-collision.mjs — does the rig agree with the room it is standing in?
 *   node scratch/check-collision.mjs
 *
 * The rig keeps a list of circles it refuses to walk through. Until today that
 * list came only from room plinths, was keyed by the room you were standing in
 * (so it went inert at every threshold), and ignored the 319 circles furniture
 * had been writing since it was built. This asks the rig directly, in the live
 * scene, and then walks a tour to prove the route it takes is one a body could
 * take.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const probe = `(() => {
  const m = window.__museum, rig = m.rig, plan = m.plan;
  const blockers = rig.blockers();
  const byWhat = {};
  blockers.forEach((b) => { byWhat[b.what] = (byWhat[b.what] || 0) + 1; });

  /* every pedestal the visitor can pick must be solid */
  const nodes = [];
  m.scene.traverse((o) => {
    if (o.userData.exhibit === undefined) return;
    const p = new m.THREE.Vector3(); o.getWorldPosition(p); nodes.push(p);
  });
  const soft = nodes.filter((p) => !rig.blocked(p.x, p.z, p.y < -1 ? 'basement' : 'ground'))
    .map((p) => '(' + p.x.toFixed(2) + ', ' + p.z.toFixed(2) + ')');

  /* a doorway is never allowed to be pinched by furniture */
  const doors = plan.walkable.rects.filter((r) => r.kind === 'door');
  const pinched = doors.filter((d) => rig.blocked(d.cx, d.cz, d.floor))
    .map((d) => d.room + ' (' + d.cx.toFixed(2) + ', ' + d.cz.toFixed(2) + ')');

  /* the centreline of every corridor, walked half a metre at a time */
  const stuck = [];
  plan.walkable.rects.filter((r) => r.kind === 'corridor').forEach((c) => {
    const s = Math.sin(c.angle), ct = Math.cos(c.angle);
    for (let t = -c.halfZ + 0.4; t <= c.halfZ - 0.2; t += 0.5) {
      const x = c.cx - t * s, z = c.cz + t * ct;
      if (rig.blocked(x, z, c.floor)) stuck.push((c.room || 'corridor') + ' (' + x.toFixed(1) + ', ' + z.toFixed(1) + ')');
    }
  });

  /* and the storey test: a blocker must not be solid on the floor above it.
     Only furniture is asked this. The lift's partition runs the whole height of
     the well and is deliberately solid on both storeys, and a check that flags
     a two-storey thing as a one-storey thing would only teach us to stop
     trusting it. */
  const wrongFloor = blockers.filter((b) => (b.what === 'plinth' || b.what === 'prop') &&
    b.floor && b.floor !== 'ground' &&
    rig.blocked(b.x, b.z)).length;

  return { blockers: blockers.length, byWhat, nodes: nodes.length, soft: soft.slice(0, 8), softCount: soft.length,
    doors: doors.length, pinched: pinched.slice(0, 8), stuck: stuck.slice(0, 8), stuckCount: stuck.length, wrongFloor };
})()`;

const IDS = ["rotunda", "journalism", "gaming", "reading", "cupola", "modding", "privacy", "shopping"];

const walk = `(async (ids) => {
  const m = window.__museum, rig = m.rig;
  const bad = [];
  /* the harness renders at a couple of frames a second, so waiting for the
     page's own loop would take minutes and prove nothing. step the rig by
     hand instead: same update, same collision, at whatever rate the test
     needs. */
  for (const id of ids) {
    rig.teleportTo('rotunda');
    if (!rig.walkTo(id, { arriveYaw: 0 })) { bad.push(id + ': no route'); continue; }
    let guard = 0;
    while (rig.touring && guard++ < 1200) {
      rig.update(0.05);
      const s = rig.state;
      if (rig.blocked(s.x, s.z)) { bad.push(id + ': inside a blocker at ' + s.x.toFixed(2) + ',' + s.z.toFixed(2)); break; }
      if (!m.inside(m.plan.walkable, s.x, s.z, 0.3, s.storey)) { bad.push(id + ': off the floor at ' + s.x.toFixed(2) + ',' + s.z.toFixed(2)); break; }
    }
    if (rig.touring) bad.push(id + ': never arrived after ' + guard + ' steps');
  }
  rig.stopTour();
  return bad;
})(${JSON.stringify(IDS)})`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  const r = await evaluate(probe);
  console.log('blockers', r.blockers, JSON.stringify(r.byWhat));
  console.log('pick nodes', r.nodes, ' not solid:', r.softCount, r.soft.join(' '));
  console.log('doors', r.doors, ' pinched by furniture:', r.pinched.length ? r.pinched.join(' ') : 'none');
  console.log('corridor centreline blocked:', r.stuckCount, r.stuck.join(' '));
  console.log('blockers on the wrong floor:', r.wrongFloor);
  const bad = await evaluate(walk);
  console.log('tours:', bad.length ? bad.slice(0, 6).join(' | ') : IDS.length + ' routes walked with no clipping');
});
