/* probe-well3.mjs — what is actually in the way when you look down the
 * Cupola well? Cast a fan of rays from the visitor's eye through the well and
 * report the first thing each one hits, its distance, and the angle it makes
 * with straight down. The answer says whether the planet is small or the
 * apertures between the rotunda floor and the cellar slab are.
 */
import { withBrowser } from './cdp.mjs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  await evaluate(`(() => {
    const m = window.__museum;
    m.rig.state.x = 0.35; m.rig.state.z = 1.5;
    m.rig.setYawPitch(0.42, -1.25);
    m.rig.update(0.016);
  })()`);
  await nap(800);

  const out = await evaluate(`(() => {
    const m = window.__museum, T = m.THREE, S = m.S;
    const eye = m.camera.position.clone();
    const rc = new T.Raycaster();
    const rows = [];
    /* a fan in the vertical plane through the well's centre, plus a level ring
       at the nadir, so the aperture chain and the planet's own limb both show up */
    const down = new T.Vector3(0, -1, 0);
    const wellC = new T.Vector3(0, 0, S.CUPOLA_WELL_Z);
    for (let deg = -50; deg <= 50; deg += 2) {
      const a = deg * Math.PI / 180;
      /* swing away from the well's centre so the ray passes over the opening */
      const dir = new T.Vector3(Math.sin(a) * 0.0 + 0, -Math.cos(a), Math.sin(a));
      dir.applyAxisAngle(down, Math.atan2(wellC.x - eye.x, wellC.z - eye.z) + Math.PI);
      const d = dir.clone().normalize();
      rc.set(eye, d);
      const hits = rc.intersectObject(m.view.scene, true).filter((h) => h.object.isMesh);
      const chain = hits.slice(0, 6).map((h) => (h.object.material.name || h.object.material.color.getHexString())
        + (h.object.material.transparent ? ' (glass)' : '') + '@' + h.distance.toFixed(2));
      const h = hits.find((x) => !x.object.material.transparent);
      rows.push({ deg,
        hit: h ? (h.object.material.name || h.object.material.color.getHexString()) + ' @' + h.distance.toFixed(2) : 'nothing',
        chain });
    }
    /* the planet's own angular radius from here */
    let earth = null;
    m.sky.group.traverse((o) => { if (o.isMesh && o.renderOrder === -2) earth = o; });
    const toC = new T.Vector3().subVectors(earth.getWorldPosition(new T.Vector3()), eye);
    const dist = toC.length();
    const ang = Math.atan(S.EARTH_R / Math.abs(eye.y - earth.getWorldPosition(new T.Vector3()).y)) * 180 / Math.PI;
    /* and the angular radius of each opening in the chain, from this eye */
    const ring = (y, r, z) => {
      const dy = eye.y - y;
      return +(Math.atan(r / dy) * 180 / Math.PI).toFixed(1);
    };
    return {
      eye: [eye.x, +eye.y.toFixed(2), eye.z],
      earth: { r: S.EARTH_R, drop: S.EARTH_DROP, halfAngle: +ang.toFixed(1), dist: +dist.toFixed(1) },
      apertures: {
        cupolaFloor: ring(0, S.CUPOLA_WELL_R, S.CUPOLA_WELL_Z),
        hallCeiling: ring(S.FLOOR_BASE + S.CEIL_BASE, S.CUPOLA_WELL_R + 0.10, S.CUPOLA_WELL_Z),
        hallFloor: ring(S.FLOOR_BASE, S.CUPOLA_WELL_R - 0.02, S.CUPOLA_WELL_Z)
      },
      fan: rows
    };
  })()`);
  console.log(JSON.stringify(out, null, 1));
});
