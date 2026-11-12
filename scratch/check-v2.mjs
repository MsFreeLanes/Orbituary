/* check-v2.mjs — drives the built museum headlessly and reports what is true.
 *
 *   node scratch/check-v2.mjs            → probes
 *   node scratch/check-v2.mjs --shots    → probes + one photograph per room
 */
import { withBrowser, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const wantShots = process.argv.includes('--shots');

const PROBE = `(() => {
  const m = window.__museum;
  if (!m) return { fatal: 'no __museum handle — the bundle did not boot' };
  const { plan, rig, inside, S } = m;
  const out = { rooms: plan.rooms.length, rects: plan.walkable.rects.length, links: m.LINKS.length };

  // every room centre and every door mouth must be standable
  out.centreBad = plan.rooms.filter(r => !inside(plan.walkable, r.center.x, r.center.z, S.BODY_R))
    .map(r => r.cat);
  out.entryBad = plan.rooms.filter(r => !inside(plan.walkable, r.entry.x, r.entry.z, S.BODY_R * 0.6))
    .map(r => r.cat);

  // every guided route must stay inside the walls at body width
  out.pathBad = [];
  for (const room of plan.rooms) {
    if (!rig.walkTo(room.id)) { out.pathBad.push(room.cat + ': no route'); continue; }
    const legs = rig.touring.legs;
    for (const leg of legs) {
      const steps = Math.ceil(leg.d / 0.2);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = leg.a.x + (leg.b.x - leg.a.x) * t;
        const z = leg.a.z + (leg.b.z - leg.a.z) * t;
        if (!inside(plan.walkable, x, z, S.BODY_R)) {
          out.pathBad.push(room.cat + ' at ' + x.toFixed(2) + ',' + z.toFixed(2));
          break;
        }
      }
    }
    rig.stopTour();
  }

  // the rotunda itself, and the four arch mouths
  out.rotundaBad = [[0, 0], [0, S.ROTUNDA_R - 0.2], [0, -S.ROTUNDA_R + 0.2],
    [S.ROTUNDA_R - 0.2, 0], [-S.ROTUNDA_R + 0.2, 0]]
    .filter(p => !inside(plan.walkable, p[0], p[1], S.BODY_R * 0.6)).map(p => p.join(','));

  out.sky = { lst: +m.sky.state.lst.toFixed(3), sunAlt: +m.sky.state.sunAlt.toFixed(2),
    moonPhase: +m.sky.state.phase.toFixed(2), lat: m.sky.state.lat };
  out.lights = m.lighting.lights.length;
  out.plinths = plan.rooms.reduce((n, r) => n + r.plinths.length, 0) + plan.rotunda.plinths.length;
  // geometry that carries NaN will never draw and never be culled correctly
  const nans = [];
  m.view.scene.traverse((o) => {
    const g = o.geometry;
    const p = g && g.attributes && g.attributes.position;
    if (!p) return;
    for (let i = 0; i < p.array.length; i++) {
      if (!Number.isFinite(p.array[i])) {
        nans.push({ type: g.type, params: JSON.stringify(g.parameters || {}).slice(0, 120),
          at: [o.position.x, o.position.y, o.position.z].map((v) => +v.toFixed(2)) });
        break;
      }
    }
  });
  out.nanCount = nans.length;
  out.nan = nans.slice(0, 10);

  return out;
})()`;

await withBrowser(async ({ send, evaluate, sleep: nap, consoleLines }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message) + ' @' + (e.filename || 'inline') + ':' + e.lineno));
      window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));`
  });
  await send('Page.navigate', { url: URL_FILE });
  await nap(3500);

  const probe = await evaluate(PROBE);
  console.log('probe:', JSON.stringify(probe, null, 1));

  // walk a guided tour for a few seconds and see what the frame rate settles at
  await evaluate(`window.__museum.rig.walkTo('gaming')`);
  await nap(4000);
  const live = await evaluate(`(() => { const m = window.__museum;
    m.view.renderer.info.autoReset = false; m.view.renderer.info.reset();
    m.view.renderer.render(m.view.scene, m.camera);
    const info = m.view.renderer.info.render;
    m.view.renderer.info.autoReset = true;
    return {
      fps: Math.round(m.view.fps), tier: m.view.tier, room: m.rig.state.room,
      x: +m.rig.state.x.toFixed(2), z: +m.rig.state.z.toFixed(2),
      tour: m.rig.touring ? { t: +m.rig.touring.t.toFixed(2), dur: +m.rig.touring.dur.toFixed(2), total: +m.rig.touring.total.toFixed(1) } : null,
      calls: info.calls, tris: info.triangles,
      geoms: m.view.renderer.info.memory.geometries, texs: m.view.renderer.info.memory.textures,
      programs: m.view.renderer.info.programs.length,
      errors: window.__errors
    }; })()`);
  console.log('live:', JSON.stringify(live));

  if (wantShots) {
    await evaluate('window.__museum.hud.hideIntro()');
    const ids = ['rotunda', ...await evaluate('window.__museum.plan.rooms.map(r => r.id)')];
    for (const id of ids) {
      await evaluate(`(() => { const m = window.__museum;
        m.rig.teleportTo(${JSON.stringify(id)});
        const r = m.plan.byId(${JSON.stringify(id)});
        if (r && r.id !== 'rotunda') {
          const stand = Math.min(0.7, r.d * 0.18);
          m.rig.state.x = r.entry.x + r.n.x * stand;
          m.rig.state.z = r.entry.z + r.n.z * stand;
          m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, -0.05);
        }
      })()`);
      await nap(1400);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path.join(process.cwd(), 'scratch', 'room-' + id + '.png'),
        Buffer.from(shot.data, 'base64'));
      console.log('shot room-' + id + '.png');
    }

    /* four extra framings: down the north corridor from the rotunda, straight
       up the oculus, a wall label read from arm's length, and a window with the
       real sky behind it */
    const roomIds = await evaluate('window.__museum.plan.rooms.map(r => r.id)');
    const extras = [
      { name: 'corridor-north', set: `m.rig.state.x = 0; m.rig.state.z = 1.5; m.rig.setYawPitch(Math.PI, -0.02);` },
      { name: 'corridor-west', set: `m.rig.state.x = -1.5; m.rig.state.z = 0; m.rig.setYawPitch(Math.PI / 2, -0.02);` },
      { name: 'oculus', set: `m.rig.state.x = 0; m.rig.state.z = 1.2; m.rig.setYawPitch(Math.PI, 1.05);` },
      { name: 'window-privacy', set: `const r = m.plan.byId('privacy');
          m.rig.state.x = r.entry.x + r.n.x * 1.8; m.rig.state.z = r.entry.z + r.n.z * 1.8;
          m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), 0.16);` },
      { name: 'label-privacy', set: `const r = m.plan.byId('privacy');
          m.rig.state.x = r.entry.x + r.n.x * 1.0; m.rig.state.z = r.entry.z + r.n.z * 1.0;
          m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, -0.42);` }
    ];
    for (const ex of extras) {
      await evaluate(`(() => { const m = window.__museum; ${ex.set} })()`);
      await nap(1400);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path.join(process.cwd(), 'scratch', 'room-' + ex.name + '.png'),
        Buffer.from(shot.data, 'base64'));
      console.log('shot room-' + ex.name + '.png', roomIds.length);
    }
  }

  const seen = new Set();
  const bad = consoleLines.filter((l) => {
    if (/favicon|Autoplay|GPU stall|GroupMarkerNotSet|deprecated/i.test(l)) return false;
    const key = l.slice(0, 90);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(bad.length ? 'CONSOLE:\n' + bad.slice(0, 12).join('\n') : 'console: clean');
});
