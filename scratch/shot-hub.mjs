/* shot-hub.mjs — the hub from the front door, and the deck ring.
 *   node scratch/shot-hub.mjs
 * The Observatory used to be built twice, so the first thing a visitor saw was a
 * box of walls in the middle of the hub with a backwards sign on it. This stands
 * the player at the entrance and looks at it, then walks to the well.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4500);
  await evaluate('window.__museum.hud.hideIntro()');
  /* the front door, looking north into the hub */
  await evaluate(`(() => { const r = window.__museum.rig.state; r.x = 0; r.z = 4.2; r.yaw = Math.PI; r.pitch = -0.05; })()`);
  await nap(900);
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  await import('node:fs').then((fs) => fs.writeFileSync(path.join(process.cwd(), 'scratch', 'hub-door.png'), Buffer.from(shot.data, 'base64')));
  /* and the nameplate the player is standing under */
  const plate = await evaluate(`window.__museum.hud.roomName ? window.__museum.hud.roomName() : (window.__museum.rig.state.room)`);
  console.log('at the door, the rig says the room is:', JSON.stringify(plate));
  /* now stand on the deck and look at the ring */
  await evaluate('window.__museum.rig.teleportTo("cupola")');
  await nap(900);
  await evaluate(`(() => { const s = window.__museum.rig.state; s.pitch = 0; })()`);
  await nap(400);
  shot = await send('Page.captureScreenshot', { format: 'png' });
  await import('node:fs').then((fs) => fs.writeFileSync(path.join(process.cwd(), 'scratch', 'hub-deck.png'), Buffer.from(shot.data, 'base64')));
  const where = await evaluate(`(() => { const m = window.__museum, s = m.rig.state;
    return { room: s.room, x: +s.x.toFixed(2), z: +s.z.toFixed(2) }; })()`);
  console.log('on the deck:', JSON.stringify(where));
});
