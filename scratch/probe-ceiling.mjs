/* Why is the ceiling of a small room black? Stand in Linux, read the pixels at
   the top of the frame, and dump which lights the pool actually chose. */
import fs from 'node:fs';
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const url = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url });
  await sleep(4200);
  const out = await evaluate(`(() => {
    const m = window.__museum, S = m.S;
    const intro = document.querySelector('.intro');
    if (intro) intro.click();
    m.rig.teleportTo('linux');
    const r = m.plan.byId('linux');
    m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), 0.45);
    /* the pool cross-fades over about a quarter of a second, so one frame after
       a teleport still has every light where the last room left it */
    for (let i = 0; i < 3; i++) m.rig.update(0.05);
    for (let i = 0; i < 60; i++) m.lighting.update(m.rig.state, 0.05);
    m.view.render(0.016, m.camera);
    const gl = m.view.renderer.getContext();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const band = (y0, y1) => {
      const px = new Uint8Array(W * (y1 - y0) * 4);
      gl.readPixels(0, y0, W, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let s = 0, n = 0, dark = 0;
      for (let i = 0; i < px.length; i += 4) {
        const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        s += l; n++; if (l < 12) dark++;
      }
      return { mean: Math.round(s / n), dark: Math.round(100 * dark / n) };
    };
    const pool = m.lighting.pool.map((p) => ({
      i: +p.intensity.toFixed(1), col: '#' + p.color.getHexString(),
      y: +p.position.y.toFixed(1)
    }));
    /* A/B: crank the room's key light and see whether the ceiling responds at
       all. If it does not, the light is not reaching that surface. */
    const ceilNow = band(Math.round(0.80 * H), Math.round(0.92 * H));
    const key = m.lighting.pool.reduce((best, p) => (!best || p.intensity > best.intensity) ? p : best, null);
    const was = { i: key.intensity, y: +key.position.y.toFixed(2) };
    key.intensity = 120;
    m.view.render(0.016, m.camera);
    const ceilHot = band(Math.round(0.80 * H), Math.round(0.92 * H));
    key.intensity = was.i;
    /* what is actually in front of the camera up there? */
    const ray = new m.THREE.Raycaster();
    const hits = [];
    for (const ny of [0.92, 0.8, 0.6, 0.2]) {
      ray.setFromCamera(new m.THREE.Vector2(0, ny), m.camera);
      const h = ray.intersectObject(m.view.scene, true)[0];
      hits.push({ ny, hit: h ? h.object.material.type + ' #' + h.object.material.color.getHexString() : 'nothing',
        d: h && +h.distance.toFixed(1),
        pt: h && [h.point.x, h.point.y, h.point.z].map((v) => +v.toFixed(1)),
        nd: h && +h.object.material.emissiveIntensity.toFixed(2) });
    }
    const near = m.lighting.anchors
      .map((a) => ({ a: (a.room || '?') + (a.wash ? ':wash' : a.cove ? ':cove' : ''),
        d: Math.hypot(a.x - m.rig.state.x, a.z - m.rig.state.z).toFixed(1), i: a.i, y: a.y }))
      .filter((a) => a.d < 12).sort((p, q) => p.d - q.d).slice(0, 14);
    return { ceil: ceilNow,
      ceilH: r.ceil, ceilHot, keyWas: was, hits,
      up: band(Math.round(0.60 * H), Math.round(0.72 * H)),
      poolCount: pool.length, pool, near,
      ceilMesh: (() => {
        let hit = null;
        m.view.scene.traverse((o) => {
          if (o.isMesh && o.material && o.material.map && o.geometry.type === 'PlaneGeometry'
              && Math.abs(o.position.y - r.ceil) < 0.02) hit = o;
        });
        if (!hit) return null;
        const n = new m.THREE.Vector3(0, 0, 1).applyQuaternion(hit.quaternion);
        return { normal: [n.x, n.y, n.z].map((v) => +v.toFixed(2)),
          cast: hit.castShadow, receive: hit.receiveShadow,
          color: '#' + hit.material.color.getHexString(), rough: hit.material.roughness,
          env: hit.material.envMapIntensity };
      })() };
  })()`);
  console.log(JSON.stringify(out, null, 1));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.cwd(), 'scratch', 'ceil-linux.png'), Buffer.from(shot.data, 'base64'));
  console.log('shot ceil-linux.png');
});
