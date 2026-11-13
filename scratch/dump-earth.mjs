/* dump-earth.mjs — write the painted planet map out as a file, so the
 * texture can be judged on its own and not through 300 m of well.
 */
import { withBrowser } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  const data = await evaluate(`(() => {
    const m = window.__museum;
    let tex = null;
    m.sky.group.traverse((o) => {
      if (o.material && o.material.map && o.material.map.image &&
          o.material.map.image.width >= 512) tex = o.material.map;
    });
    return tex ? tex.image.toDataURL('image/png') : null;
  })()`);
  if (!data) { console.log('no earth texture found'); return; }
  writeFileSync(path.join(process.cwd(), 'scratch', 'earth-map.png'),
    Buffer.from(data.split(',')[1], 'base64'));
  console.log('wrote scratch/earth-map.png');
});
