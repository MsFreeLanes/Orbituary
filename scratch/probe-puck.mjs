/* Print what the plinth puck material and geometry actually are in the built
   page, in case an edit is in the source but not on screen. */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/') });
  await sleep(4000);
  console.log(await evaluate(`(() => {
    const m = window.__museum;
    const r = m.plan.byId('gaming');
    const p = r._puckMat;
    const seen = [];
    m.view.scene.traverse((o) => {
      if (o.isMesh && o.material && o.material === p) {
        const g = o.geometry.parameters || {};
        seen.push({ rTop: g.radiusTop, h: g.height, seg: g.radialSegments, y: +o.position.y.toFixed(3) });
      }
    });
    return {
      mat: p && {
        color: '#' + p.color.getHexString(), emissive: '#' + p.emissive.getHexString(),
        ei: p.emissiveIntensity, rough: p.roughness, metal: p.metalness
      },
      count: seen.length, first: seen[0]
    };
  })()`));
});
