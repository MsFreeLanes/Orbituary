/* The quality ladder: on a slow renderer the watchdog should walk the tier up
   and buy back frames. Headless swiftshader is slow enough to exercise it. */
import fs from 'node:fs';
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const url = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url });
  for (let i = 0; i < 10; i++) {
    await sleep(5000);
    console.log(i * 5, await evaluate(`(() => { const v = window.__museum.view;
      return { fps: Math.round(v.fps), tier: v.tier, bloom: v.bloom.enabled,
        ratio: +window.__museum.view.renderer.getPixelRatio().toFixed(2) }; })()`));
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(process.cwd(), 'scratch', 'tier-max.png'), Buffer.from(shot.data, 'base64'));
  console.log('shot tier-max.png');
});
