/* probe-card.mjs — what the room card says about a room with nothing in it.
 *   node scratch/probe-card.mjs [room-id ...]
 * The door plate, the plinth card and the room card are meant to use the same
 * word for an empty room. This reads the card the HUD writes for each room.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');
const ROOMS = process.argv.slice(2);
if (!ROOMS.length) ROOMS.push('creative-writing', 'journalism', 'privacy', 'recompiles');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4600);
  for (const id of ROOMS) {
    const out = await evaluate(`(() => {
      const m = window.__museum;
      m.rig.teleportTo(${JSON.stringify(id)});
      m.rig.update(0.05);
      const h = document.querySelector('.room-sub');
      const head = document.querySelector('.room-name');
      const line = (head ? head.textContent.trim() + ' — ' : '') + (h ? h.textContent.trim() : '(no card element found)');
      return { room: m.rig.state.room, line };
    })()`);
    console.log(out.room.padEnd(18), out.line);
  }
});
