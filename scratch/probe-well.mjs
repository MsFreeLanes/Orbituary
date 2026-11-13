/* probe-well.mjs — what stands between the gallery and the planet: fire a
 * ray down through the well and list everything it finds, then say where
 * the Earth disc actually is and what the three pierced sheets think. */
import { withBrowser } from './cdp.mjs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  const out = await evaluate(`(() => {
    const m = window.__museum, THREE = m.THREE;
    const shell = m.plan.rotunda.group.parent;
    const ray = new THREE.Raycaster();
    ray.set(new THREE.Vector3(0, 1.6, 0.8), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObject(shell, true).slice(0, 6).map((h) => ({
      y: +h.point.y.toFixed(2),
      mat: h.object.material && (h.object.material.name || h.object.material.type),
      order: h.object.renderOrder,
      transparent: h.object.material && h.object.material.transparent,
      geo: h.object.geometry && h.object.geometry.type,
      parent: h.object.parent && h.object.parent.name
    }));
    let earth = null;
    m.sky.group.traverse((o) => {
      if (o.isMesh && o.renderOrder === -2) {
        o.updateWorldMatrix(true, false);
        const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
        earth = { at: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
          visible: o.visible, mat: o.material.type, fog: o.material.fog,
          map: !!o.material.map, size: o.geometry.parameters && o.geometry.parameters.radius };
      }
    });
    // does the rotunda floor sheet still cover the well centre?
    const discHoles = [];
    m.plan.rotunda.group.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.type === 'ShapeGeometry')
        discHoles.push((o.geometry.parameters.shapes.holes || []).length);
    });
    return { hits, earth, discHoles };
  })()`);
  console.log(JSON.stringify(out, null, 1));
});
