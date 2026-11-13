/* probe-drawcalls.mjs — what the GPU is actually handed, from five standing
 * positions that cover the building's five kinds of space: the hub, a range,
 * the hall at the end of a range, the cellar floor, and a cellar room.
 *
 *   node scratch/probe-drawcalls.mjs --before   → scratch/drawcalls-before.txt
 *   node scratch/probe-drawcalls.mjs --after    → scratch/drawcalls-after.txt
 *   add --shots for one photograph per position (drawcalls-<when>-<pos>.png)
 *
 * The counts come from one renderer.render() with info.autoReset switched off,
 * which is the same trick check-v2 uses: it counts the main pass and the
 * moon's shadow pass together, because that is what a frame costs. Absolute
 * fps on swiftshader is meaningless; the ratios are not.
 *
 * Culling is asked for by name (`view.cull.off()` / `.on()`) so the file can
 * report both what the whole building would cost and what one position costs.
 * On a build with no culling in it, that call simply is not there.
 */
import { withBrowser, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const when = process.argv.includes('--after') ? 'after' : 'before';
const wantShots = process.argv.includes('--shots');

/* Five places a visitor actually stands. Each one is a position, a storey and
   a heading: the heading matters, because what you can see from the rotunda is
   not what you can see from the middle of a range. */
const SPOTS = [
  {
    name: 'rotunda-centre',
    set: `m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = 0;
          m.rig.setYawPitch(0, 0.06);`
  },
  {
    name: 'mid-corridor-north',
    set: `m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = 26;
          m.rig.setYawPitch(Math.PI, -0.02);`
  },
  {
    name: 'terminus-hall-gaming',
    room: 'gaming'
  },
  {
    name: 'stair-hall',
    set: `m.rig.state.storey = 'basement'; m.rig.state.x = 0; m.rig.state.z = 1.4;
          m.rig.setYawPitch(0, -0.05);`
  },
  {
    name: 'cellar-room',
    cellar: true
  }
];

const PLACE = (spot) => `(() => {
  const m = window.__museum;
  ${spot.room ? `m.rig.teleportTo(${JSON.stringify(spot.room)});
    const r = m.plan.byId(${JSON.stringify(spot.room)});
    const stand = Math.min(0.7, r.d * 0.18);
    m.rig.state.x = r.entry.x + r.n.x * stand;
    m.rig.state.z = r.entry.z + r.n.z * stand;
    m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, -0.05);` : ''}
  ${spot.cellar ? `const r = m.plan.rooms.filter((x) => x.floor === 'basement')
        .sort((a, b) => b.items.length - a.items.length)[0];
      m.rig.teleportTo(r.id);
      const stand = Math.min(0.7, r.d * 0.18);
      m.rig.state.x = r.entry.x + r.n.x * stand;
      m.rig.state.z = r.entry.z + r.n.z * stand;
      m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, -0.05);` : ''}
  ${spot.set || ''}
  m.rig.update(0.016);
})()`;

/* One render, counted. The scene graph is walked too, so the file can say how
   many objects exist against how many were submitted — the gap is the cull. */
const MEASURE = `(() => {
  const m = window.__museum, R = m.view.renderer, S = m.view.scene, cam = m.camera;
  const sources = new Map();
  S.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const mt of mats) {
      for (const slot of ['map', 'emissiveMap', 'roughnessMap', 'normalMap']) {
        const t = mt[slot];
        if (!t || !t.image) continue;
        const key = (t.source && t.source.uuid) || t.uuid;
        if (!sources.has(key)) {
          sources.set(key, { w: t.image.width || 0, h: t.image.height || 0,
            kind: (t.userData && t.userData.kind) || '' });
        }
      }
    }
  });
  let bytes = 0, atlasBytes = 0, atlases = 0, big = [0, 0];
  for (const s of sources.values()) {
    const b = s.w * s.h * 4;
    bytes += b;
    /* a plaque sheet is a whole number of 384x192 cells; the door plates are
       one fixed canvas each, and the acquisitions board is square */
    const plaque = s.kind ? s.kind === 'plaque'
      : (s.w % 384 === 0 && s.h % 192 === 0 && s.w <= 1536 && s.h <= 1152);
    if (plaque) { atlases++; atlasBytes += b; if (s.w * s.h > big[0] * big[1]) big = [s.w, s.h]; }
  }
  let objects = 0, submitted = 0;
  S.traverse((o) => {
    if (!o.geometry) return;
    objects++;
    let vis = o.visible;
    for (let p = o; p && vis; p = p.parent) vis = p.visible;
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    if (vis && mats.length && mats.every((mt) => mt.visible)) submitted++;
  });
  R.info.autoReset = false; R.info.reset();
  R.render(S, cam);
  const info = R.info.render;
  const out = {
    calls: info.calls, tris: info.triangles,
    geoms: R.info.memory.geometries, texs: R.info.memory.textures,
    programs: R.info.programs.length,
    objects, submitted,
    texMB: +(bytes * 1.33 / 1048576).toFixed(2),
    atlasCount: atlases, atlasMB: +(atlasBytes * 1.33 / 1048576).toFixed(2),
    atlasMax: big[0] + 'x' + big[1],
    lights: m.lighting.lights.length,
    poolLit: m.lighting.pool.filter((l) => l.intensity > 0.01).length,
    casters: (() => { let n = 0; S.traverse((o) => { if (o.isLight && o.castShadow) n++; }); return n; })()
  };
  R.info.autoReset = true;
  return out;
})()`;

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message) + ' @' + (e.filename || 'inline') + ':' + e.lineno));`
  });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  await evaluate('window.__museum.hud.hideIntro()');

  const lines = [];
  const say = (s) => { lines.push(s); console.log(s); };

  say(`draw calls — ${when} — ${new Date().toISOString()}`);
  say('');

  /* the whole building at once, with any culling switched off, so the per-
     position numbers below have something to be a fraction of */
  const whole = await evaluate(`(() => {
    const m = window.__museum;
    if (m.view.cull) m.view.cull.off();
    const r = ${MEASURE};
    if (m.view.cull) m.view.cull.enable();
    return r;
  })()`);
  say('whole building, nothing culled: ' + JSON.stringify(whole));
  say('');

  for (const spot of SPOTS) {
    await evaluate(PLACE(spot));
    /* let the frame loop run: the light pool cross-fades and the cull settles
       over a second, and a count taken the instant you teleport is a count of
       where you were a moment ago */
    await nap(1500);
    const r = await evaluate(MEASURE);
    const at = await evaluate(`(() => { const s = window.__museum.rig.state;
      return { x: +s.x.toFixed(1), z: +s.z.toFixed(1), y: +s.level.toFixed(2), room: s.room, storey: s.storey }; })()`);
    say(`${spot.name.padEnd(22)} at ${at.x},${at.z} (${at.storey}, ${at.room})`);
    say(`   ${String(r.calls).padStart(5)} calls · ${String(r.tris).padStart(7)} tris · ` +
        `${r.submitted}/${r.objects} objects submitted · ${r.texs} texs · ${r.programs} programs`);
    say(`   textures ${r.texMB} MB total, ${r.atlasCount} plaque sheets ${r.atlasMB} MB, largest ${r.atlasMax}`);
    say(`   lights ${r.lights} (${r.poolLit} lit) · shadow casters ${r.casters}`);
    say('');
    if (wantShots) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const file = 'drawcalls-' + when + '-' + spot.name + '.png';
      writeFileSync(path.join(process.cwd(), 'scratch', file), Buffer.from(shot.data, 'base64'));
      say('   shot scratch/' + file);
      say('');
    }
  }

  const errs = await evaluate('window.__errors');
  say('errors: ' + JSON.stringify(errs));
  writeFileSync(path.join(process.cwd(), 'scratch', 'drawcalls-' + when + '.txt'), lines.join('\n') + '\n');
  say('wrote scratch/drawcalls-' + when + '.txt');
});
