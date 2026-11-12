/* tiny probe: does teleportTo actually move the visitor? */
import { withBrowser, sleep } from './cdp.mjs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  console.log('start', JSON.stringify(await evaluate('({...window.__museum.rig.state})')));
  console.log('teleport gaming ->', JSON.stringify(await evaluate(`(() => {
    const m = window.__museum;
    const room = m.plan.byId('gaming');
    const before = { x: m.rig.state.x, z: m.rig.state.z, yaw: m.rig.state.yaw };
    m.rig.teleportTo('gaming');
    return { roomFound: !!room, center: room && room.center, n: room && room.n, d: room && room.d,
      before: { x: +before.x.toFixed(2), z: +before.z.toFixed(2) },
      after: { x: +m.rig.state.x.toFixed(2), z: +m.rig.state.z.toFixed(2), yaw: +m.rig.state.yaw.toFixed(2), room: m.rig.state.room } };
  })()`)));
  await nap(1500);
  console.log('after a frame', JSON.stringify(await evaluate('({x: +window.__museum.rig.state.x.toFixed(2), z: +window.__museum.rig.state.z.toFixed(2), room: window.__museum.rig.state.room})')));
  console.log('camera', JSON.stringify(await evaluate('({x: +window.__museum.camera.position.x.toFixed(2), y: +window.__museum.camera.position.y.toFixed(2), z: +window.__museum.camera.position.z.toFixed(2)})')));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(path.join(process.cwd(), 'scratch', 'probe-gaming.png'), Buffer.from(shot.data, 'base64'));
  console.log('wrote probe-gaming.png');
});
