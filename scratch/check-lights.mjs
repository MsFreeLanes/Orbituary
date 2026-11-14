/* check-lights.mjs — is the light where the fitting is?
 *   node scratch/check-lights.mjs
 * The key light for every room used to hang 1.6 m below the ceiling whatever
 * the room was, which in a 3.2 m cellar room put the source at eye height and
 * 1.1 m below the tube you could see. This reports the lowest key light above
 * its own floor, storey by storey.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  const r = await evaluate(`(() => {
    const m = window.__museum, S = m.S;
    const base = { ground: S.FLOOR_GROUND, basement: S.FLOOR_BASE };
    const byRoom = {};
    m.lighting.anchors.forEach((a) => {
      if (!a.room) return;
      const room = m.plan.byId(a.room);
      if (!room) return;
      const h = a.y - base[room.floor === 'basement' ? 'basement' : 'ground'];
      const key = a.i > 5;
      const rec = byRoom[a.room] || (byRoom[a.room] = { ceil: room.ceil, floor: room.floor, keys: [] });
      if (key) rec.keys.push(+h.toFixed(2));
    });
    const rows = Object.entries(byRoom).map(([id, r]) => ({ id, ceil: +r.ceil.toFixed(2), floor: r.floor, low: Math.min(...r.keys) }));
    const low = rows.filter((r) => r.low < 1.2);
    const byStorey = {};
    rows.forEach((r) => { const k = r.floor; byStorey[k] = Math.min(byStorey[k] ?? 99, r.low); });
    return { rooms: rows.length, byStorey, low: low.slice(0, 6), worst: rows.sort((a, b) => a.low - b.low).slice(0, 3) };
  })()`);
  console.log('rooms with a key light:', r.rooms, ' lowest key above its floor by storey:', JSON.stringify(r.byStorey));
  console.log('below 1.2 m:', r.low.length ? JSON.stringify(r.low) : 'none');
  console.log('three lowest:', JSON.stringify(r.worst));
});
