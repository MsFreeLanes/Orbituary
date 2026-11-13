/* probe-well2.mjs — stand where the screenshot stands and ask the whole
 * scene (not just the shell) what the camera actually sees down the well,
 * and what colour the Earth canvas holds at that moment. */
import { withBrowser } from './cdp.mjs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(6000);
  console.log(JSON.stringify(await evaluate(`(() => {
    const m = window.__museum, THREE = m.THREE;
    m.rig.state.x = 0.9; m.rig.state.z = 2.7;
    m.rig.setYawPitch(0.44, -0.95);
    m.rig.update(0.016);
    const ray = new THREE.Raycaster();
    const fwd = m.camera.getWorldDirection(new THREE.Vector3());
    ray.set(m.camera.position.clone(), fwd);
    ray.far = 900;
    const hits = ray.intersectObject(m.view.scene, true).slice(0, 8).map((h) => ({
      d: +h.distance.toFixed(2),
      pt: [h.point.x, h.point.y, h.point.z].map((v) => +v.toFixed(2)),
      mat: h.object.material && (h.object.material.type + '/' + h.object.material.color.getHexString()),
      geo: h.object.geometry && h.object.geometry.type,
      order: h.object.renderOrder,
      inSky: (function p(o){ while (o) { if (o === m.sky.group) return true; o = o.parent; } return false; })(h.object)
    }));
    let earth = null;
    m.sky.group.traverse((o) => { if (o.isMesh && o.renderOrder === -2) earth = o; });
    earth.updateWorldMatrix(true, false);
    const p = new THREE.Vector3().setFromMatrixPosition(earth.matrixWorld);
    // sample the earth canvas: is it painted?
    const cv = earth.material.map.image;
    const x = cv.getContext('2d');
    const px = [ [256,256], [180,180], [330,300], [256,80] ].map(([a,b]) => Array.from(x.getImageData(a,b,1,1).data));
    return { camPos: [m.camera.position.x, m.camera.position.y, m.camera.position.z].map((v)=>+v.toFixed(2)),
      earthWorld: [p.x, p.y, p.z].map((v)=>+v.toFixed(1)),
      texSize: [cv.width, cv.height], px, hits };
  })()`), null, 1));
});
