/* glow-watch.mjs — sample a room's tube glow every 100 ms.
 *   node scratch/glow-watch.mjs [roomId] [samples]
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const id = process.argv[2] || 'journalism';
const n = Number(process.argv[3] ?? 40);
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const read = `(() => {
  const r = window.__museum.plan.byId(${JSON.stringify(id)});
  const g = r._lamps && r._lamps.glow;
  if (!g) return { none: true };
  let lights = [];
  window.__museum.scene.traverse((o) => {
    if (o.isPointLight && o.userData && o.userData.anchor && o.userData.anchor.room === ${JSON.stringify(id)} && o.userData.base > 0.5)
      lights.push(+(o.intensity / o.userData.base).toFixed(2));
  });
  return { glow: +g.emissiveIntensity.toFixed(3), env: +g.userData.env.toFixed(3), lights };
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  await evaluate(`window.__museum.rig.teleportTo(${JSON.stringify(id)})`);
  await nap(1500);
  const rows = [];
  for (let i = 0; i < n; i++) { rows.push(await evaluate(read)); await nap(100); }
  console.log(id, 'glow:', rows.map((r) => (r.glow ?? '-')).join(' '));
  console.log(id, 'env :', rows.map((r) => (r.env ?? '-')).join(' '));
  console.log(id, 'lit :', rows.map((r) => (r.lights || []).join(',')).join(' | '));
});
