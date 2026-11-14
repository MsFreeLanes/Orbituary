/* dump-tex.mjs — save the map a material is actually using, at full size.
 *   node scratch/dump-tex.mjs [roomId]
 *
 * The hairlines go away when the map comes off the wall, so the picture itself
 * is suspect. This writes the canvas the painter produced, unscaled and
 * unfiltered, so a stripe in the paint is visible as a stripe in the file.
 */
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { withBrowser } from './cdp.mjs';

const id = process.argv[2] || 'science';
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const grab = `(() => {
  const m = window.__museum;
  const room = m.plan.byId(${JSON.stringify(id)});
  let rg = null;
  m.scene.traverse((o) => {
    if (o.isGroup && Math.abs(o.position.x - room.entry.x) < 0.01 &&
        Math.abs(o.position.z - room.entry.z) < 0.01 &&
        Math.abs(o.rotation.y - room.angle) < 0.001) rg = o;
  });
  const out = [];
  rg.children.forEach((o) => {
    const mt = o.material;
    if (!mt || !mt.color || mt.color.getHexString() !== '9aa0aa') return;
    const t = mt.map;
    if (!t) return;
    const src = t.image;
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    /* and a 2x2 tile of it, because a seam only shows where two tiles meet */
    const t2 = document.createElement('canvas');
    t2.width = src.width * 2; t2.height = src.height * 2;
    const x2 = t2.getContext('2d');
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) x2.drawImage(src, a * src.width, b * src.height);
    out.push({ w: src.width, h: src.height, single: c.toDataURL('image/png'), tiled: t2.toDataURL('image/png') });
  });
  return out;
})()`;

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  const got = await evaluate(grab);
  got.forEach((g, i) => {
    writeFileSync(path.join(process.cwd(), 'scratch', 'tex-' + id + '-' + i + '.png'),
      Buffer.from(g.single.split(',')[1], 'base64'));
    writeFileSync(path.join(process.cwd(), 'scratch', 'tex-' + id + '-' + i + '-tiled.png'),
      Buffer.from(g.tiled.split(',')[1], 'base64'));
    console.log('tex', i, g.w + 'x' + g.h);
  });
  console.log('wrote scratch/tex-' + id + '-*.png');
});
