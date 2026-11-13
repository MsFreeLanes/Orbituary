/* probe-cullfix.mjs — does the spoke cull still blink a hull out of a window?
 *
 *   node scratch/probe-cullfix.mjs
 *
 * The bug this is checking for: the cull decides what to submit from where the
 * visitor's feet are, and a side room's viewport looks at the next range's hull
 * three or four metres away. Walking down your own corridor used to take you in
 * and out of the cull's six-metre rule, and the hull behind the window came and
 * went with it. scratch/probe-cull.mjs counts 224 standing positions where that
 * happened before the fix.
 *
 * This drives the real cull in the real scene. For every ground room it stands
 * the visitor at the door, the middle and the window, and for every corridor at
 * three points along it, then asks: for each viewport of the range the visitor
 * is standing in, is the range that viewport looks at on the submit list? It
 * also walks one spoke end to end and prints the visible set at each step, so
 * the set can be seen to stay put while the visitor is in one range.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const SETUP = `(() => {
  const m = window.__museum, T = m.THREE, S = m.S;
  const owner = m.view.scene.children.find((o) => o.userData && o.userData.cull);
  const box = new T.Box3();
  const ground = m.plan.corridors.filter((c) => c.floor !== 'basement');
  window.__ranges = owner.children.map((g) => {
    box.setFromObject(g);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    const bearing = Math.atan2(cx, cz);
    /* the same two tests render.js uses to tell a range from the drum, the
       cellar floor and a cellar arm: a range has a bearing and stands above
       the ground slab */
    const isRange = Math.hypot(cx, cz) >= S.ROTUNDA_R && box.max.y >= S.FLOOR_GROUND;
    let best = null;
    ground.forEach((c) => {
      let d = Math.abs(((Math.atan2(c.dir.x, c.dir.z) - bearing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (!best || d < best.d) best = { d, range: c.range };
    });
    const range = isRange && best && best.d < 0.35 ? best.range : null;
    return { g, range,
      rects: (best && best.range ? m.plan.corridors.filter((c) => c.range === best.range && c.floor !== 'basement')
        .map((c) => ({ cx: c.dir.x * (c.t0 + c.t1) / 2, cz: c.dir.z * (c.t0 + c.t1) / 2,
          halfX: c.half, halfZ: (c.t1 - c.t0) / 2, angle: Math.atan2(c.dir.x, c.dir.z) })) : [])
        .concat(m.plan.rooms.filter((r) => r.range === (best && best.range)).map((r) => ({
          cx: r.center.x, cz: r.center.z, halfX: r.w / 2, halfZ: r.d / 2, angle: r.angle
        }))) };
  });
  window.__dist = (x, z, r) => {
    const st = Math.sin(r.angle), ct = Math.cos(r.angle);
    const dx = x - r.cx, dz = z - r.cz;
    const lx = Math.abs(dx * ct - dz * st) - r.halfX;
    const lz = Math.abs(dx * st + dz * ct) - r.halfZ;
    const ax = lx > 0 ? lx : 0, az = lz > 0 ? lz : 0;
    return Math.sqrt(ax * ax + az * az);
  };
  /* what each viewport of each ground room looks at: the other range nearest
     to it, which is the hull that has to stay on the submit list */
  window.__views = [];
  m.plan.rooms.filter((r) => r.floor !== 'basement' && r.windows.length).forEach((r) => {
    r.windows.forEach((w) => {
      let best = null;
      window.__ranges.forEach((rg) => {
        if (!rg.range || rg.range === r.range) return;
        for (const rect of rg.rects) {
          const d = window.__dist(w.x, w.z, rect);
          if (!best || d < best.d) best = { d, range: rg.range };
        }
      });
      if (best && best.d < 8) window.__views.push({ room: r.id, range: r.range, seen: best.range });
    });
  });
  window.__ask = (x, z) => {
    m.rig.state.storey = 'ground'; m.rig.state.x = x; m.rig.state.z = z;
    m.rig.update(0.016);
    m.view.renderer.render(m.view.scene, m.camera);   /* the cull answers in onBeforeRender */
    const mine = [...new Set(window.__ranges.filter((rg) => rg.range &&
      rg.rects.some((r) => window.__dist(x, z, r) < 6)).map((rg) => rg.range))];
    const seen = new Set(window.__views.filter((v) => mine.includes(v.range))
      .map((v) => v.seen));
    const byRange = {};
    window.__ranges.forEach((rg) => {
      if (!rg.range) return;
      byRange[rg.range] = !!byRange[rg.range] || rg.g.visible;
    });
    const missing = [...seen].filter((name) => !byRange[name]);
    let on = 0;
    window.__ranges.forEach((rg) => { if (rg.g.visible) on++; });
    const onList = Object.keys(byRange).filter((k) => byRange[k]).join('+');
    return { mine: mine.join('+'), on, onList, missing, hub: Math.hypot(x, z) < S.ROTUNDA_R };
  };
})()`;

const SPOTS = `(() => {
  const m = window.__museum, out = [];
  const add = (label, x, z) => { const r = window.__ask(x, z); out.push({ label, ...r }); };
  m.plan.rooms.filter((r) => r.floor !== 'basement').forEach((r) => {
    const w = r.windows[0];
    add(r.id + ' door', r.entry.x, r.entry.z);
    add(r.id + ' middle', r.center.x, r.center.z);
    if (w) add(r.id + ' window', w.x, w.z);
  });
  m.plan.corridors.filter((c) => c.floor !== 'basement').forEach((c) => {
    for (const t of [c.t0 + 4, (c.t0 + c.t1) / 2, c.t1 - 1]) {
      add(c.range + ' corridor', c.dir.x * t, c.dir.z * t);
    }
  });
  return out;
})()`;

const WALK = `(() => {
  const m = window.__museum;
  const c = m.plan.corridors.find((x) => x.floor !== 'basement' && x.dir.z > 0.5);
  const out = [];
  for (let t = c.t0 + 2; t <= c.t1 + 2; t += 4) {
    const r = window.__ask(c.dir.x * t, c.dir.z * t);
    out.push(String(Math.round(t)).padStart(3) + ': on ' + r.on + ' [' + r.onList + ']' +
      (r.missing.length ? ' MISSING ' + r.missing.join(',') : ''));
  }
  return out;
})()`;

await withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: URL_FILE });
  await sleep(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  await evaluate(SETUP);

  const map = await evaluate(`window.__ranges.map((rg, i) => i + ':' + (rg.range || '-')).join(' ')`);
  console.log('group → range: ' + map);

  const spots = await evaluate(SPOTS);
  /* standing in the drum is the cull's facing rule, not its distance rule, and
     from the drum a visitor looks down arches rather than at a neighbouring
     hull, so those positions are counted separately */
  const out2 = spots.filter((s) => !s.hub);
  const bad = out2.filter((s) => s.missing.length);
  const counts = out2.map((s) => s.on);
  console.log('standing positions checked: ' + spots.length + ' (' + out2.length +
    ' out on a spoke, ' + (spots.length - out2.length) + ' in the drum)');
  console.log('positions where a viewport looks at a culled range: ' + bad.length);
  if (bad.length) bad.slice(0, 12).forEach((s) => console.log('  ' + s.label + ' in ' + s.mine +
    ' → culled: ' + s.missing.join(', ')));
  console.log('groups on per position: min ' + Math.min(...counts) + ' max ' + Math.max(...counts) +
    ' (of ' + await evaluate('window.__ranges.length') + ' groups in the scene)');

  console.log('\nwalking the ' + await evaluate(`window.__museum.plan.corridors.find((c) => c.floor !== 'basement' && c.dir.z > 0.5).range`) +
    ' spoke, metres out from the centre:');
  (await evaluate(WALK)).forEach((l) => console.log('  ' + l));
});
