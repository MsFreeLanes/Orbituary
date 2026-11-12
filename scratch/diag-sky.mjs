/* pin down whether the group's quaternion matches the horizon matrix the code
   means to build, using the same numbers the probe uses */
import { withBrowser } from './cdp.mjs';

const out = await withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///C:/Users/skyee/Documents/Strata/Workspace/index-v2.html' });
  await sleep(4000);
  return await evaluate(`(() => {
    const m = window.__museum, sky = m.sky, T = m.THREE, D = Math.PI / 180;
    const lat = 40.7, lon = -74, ms = Date.UTC(2026, 10, 12, 5, 0);
    sky.state.lat = lat; sky.state.lon = lon;
    sky.update(ms);
    const lst = sky.state.lst;
    const st = Math.sin(lst), ct = Math.cos(lst);
    const sl = Math.sin(lat * D), cl = Math.cos(lat * D);
    const frame = (v) => [-v[0], v[2], v[1]];
    const e = frame([-st, ct, 0]), u = frame([ct * cl, st * cl, sl]), nv = frame([-ct * sl, -st * sl, cl]);
    const want = new T.Matrix4().set(e[0], e[1], e[2], 0, u[0], u[1], u[2], 0, nv[0], nv[1], nv[2], 0, 0, 0, 0, 1);
    const qWant = new T.Quaternion().setFromRotationMatrix(want);
    const qGot = sky.group.quaternion.clone();
    const pol = new T.Vector3(-Math.cos(89.264 * D) * Math.cos(37.95 * D), Math.sin(89.264 * D), Math.cos(89.264 * D) * Math.sin(37.95 * D));
    const a = pol.clone().applyQuaternion(qGot);
    const b = pol.clone().applyQuaternion(qWant);
    const altaz = (v) => ({ alt: +(Math.asin(v.y / v.length()) / D).toFixed(2), az: +(((Math.atan2(v.x, v.z) / D) + 360) % 360).toFixed(2) });
    return {
      lstDeg: +(lst / D).toFixed(3),
      qGot: qGot.toArray().map((v) => +v.toFixed(4)),
      qWant: qWant.toArray().map((v) => +v.toFixed(4)),
      dot: +Math.abs(qGot.dot(qWant)).toFixed(5),
      polarisViaGroup: altaz(a),
      polarisViaMatrix: altaz(b)
    };
  })()`);
});
console.log(JSON.stringify(out, null, 1));
