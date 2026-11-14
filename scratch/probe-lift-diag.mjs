/* probe-lift-diag.mjs — one question: what does the page actually have? */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4800);
  const out = await evaluate(`(() => {
    const m = window.__museum;
    const st = m.plan.stair, S = m.S;
    const px = st.x + st.w / 2 - S.LIFT_W + S.LIFT_PARTITION / 2;
    const midZ = st.z + st.run * 0.5;
    const near = m.plan.walkable.rects.filter((r) => r.kind === 'door' &&
      Math.abs(r.cx - px) < 2.4 && Math.abs(r.cz - midZ) < 3.6)
      .map((r) => ({ room: r.room, cx: +r.cx.toFixed(2), cz: +r.cz.toFixed(2),
        halfX: r.halfX, halfZ: r.halfZ, angle: +r.angle.toFixed(2), floor: r.floor }));
    return { view: typeof m.view, cam: typeof m.camera,
      camY: m.camera ? +m.camera.position.y.toFixed(2) : null,
      viewCam: m.view ? typeof m.view.camera : 'no view',
      liftKeys: Object.keys(m.built.lift || {}),
      liftX: m.built.lift && +m.built.lift.x.toFixed(2),
      shaftX: +px.toFixed(2), midZ,
      /* how the blocker list is tagged by storey, which is the question the
         storey test in check-collision is really asking */
      roomsByFloor: m.plan.rooms.reduce((a, r) => { a[r.floor] = (a[r.floor] || 0) + 1; return a; }, {}),
      cellarSample: (() => { const rs = m.plan.rooms.filter((x) => x.floor === 'basement');
        return { n: rs.length, sample: rs.slice(0, 6).map((r) => ({ id: r.id, kind: r.kind,
          plinths: (r.plinths || []).length, items: (r.items || []).length,
          props: r._props ? Object.keys(r._props).length : 0, nodes: (r._nodes || []).length })),
        plinthTotal: rs.reduce((a, r) => a + (r.plinths || []).length, 0) }; })(),
      groundSample: (() => { const rs = m.plan.rooms.filter((x) => x.floor === 'ground');
        return { plinthTotal: rs.reduce((a, r) => a + (r.plinths || []).length, 0),
          withPlinths: rs.filter((r) => (r.plinths || []).length).length, n: rs.length }; })(),
      obstacleRooms: (() => { const seen = {};
        (m.plan.obstacles || []).forEach((o) => { const r = m.plan.byId(o.room);
          const f = r ? r.floor : 'miss'; seen[f] = (seen[f] || 0) + 1; }); return seen; })(),
      byFloor: m.rig.blockers().reduce((a, b) => { a[b.floor] = (a[b.floor] || 0) + 1; return a; }, {}),
      byWhatFloor: m.rig.blockers().reduce((a, b) => { const k = b.what + '/' + b.floor; a[k] = (a[k] || 0) + 1; return a; }, {}),
      near, shaftBlockers: m.rig.blockers().filter((b) => b.what === 'lift shaft').length,
      storey: m.rig.state.storey,
      blockedAt: m.rig.blocked(px, midZ, 'ground'),
      blockedBelow: m.rig.blocked(px, midZ, 'basement'),
      /* a cellar crate, asked from the storey above it: the answer must be no,
         which is the thing the storey test in check-collision is for */
      crate: (() => { const c = m.rig.blockers().find((b) => b.what === 'prop' && b.floor === 'basement');
        return c ? { at: [+c.x.toFixed(1), +c.z.toFixed(1)], fromAbove: m.rig.blocked(c.x, c.z, 'ground'),
          fromBelow: m.rig.blocked(c.x, c.z, 'basement') } : 'none'; })(),
      /* and the stair's own walkable line: can the rig still reach the flight? */
      stairMouth: m.rig.blocked(st.x - st.w / 2 + 0.4, st.z + st.run - 0.4, 'ground') };
  })()`);
  console.log(JSON.stringify(out, null, 1));
});
