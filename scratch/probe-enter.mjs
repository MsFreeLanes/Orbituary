/* probe-enter.mjs — stand in front of a pedestal and press Enter.
 *   node scratch/probe-enter.mjs [roomId]
 *
 * The Cupola's six pedestals were built by the generic room builder with
 * `link: r.items[i]`, and Astronomy holds no links, so the pick data carries
 * `link: undefined`. openTarget() then reads link.u. This drives the real key
 * path and reports what the console says.
 */
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const id = process.argv[2] || 'cupola';
const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const aim = `(() => {
  const m = window.__museum;
  const want = ${JSON.stringify(id)};
  const room = m.plan.rooms.find((r) => r.id === want || r.kind === want || r.cat === want)
    || (m.plan.rotunda && m.plan.rotunda.id === want ? m.plan.rotunda : null);
  if (!room) return { err: 'no such room' };
  const spots = room.plinths || [];
  if (!spots.length) return { err: 'no plinths' };
  const node = spots.map((s) => s.node).find((n) => n && n.userData.exhibit && n.userData.exhibit.link === undefined)
    || spots[0].node;
  if (!node) return { err: 'no pick node' };
  const p = new m.THREE.Vector3(); node.getWorldPosition(p);
  const yaw = Math.atan2(-(p.x - m.rig.state.x), -(p.z - m.rig.state.z));
  const dist = 1.15;
  m.rig.state.x = p.x + Math.sin(yaw + Math.PI) * dist;
  m.rig.state.z = p.z + Math.cos(yaw + Math.PI) * dist;
  m.rig.setYawPitch(yaw, -0.62);
  m.rig.update(0.016);
  return { at: [+p.x.toFixed(2), +p.z.toFixed(2)], link: node.userData.exhibit.link,
    room: node.userData.exhibit.room };
})()`;

const press = `(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
  return document.querySelector('.toast') ? document.querySelector('.toast').textContent : null;
})()`;

withBrowser(async ({ send, evaluate, sleep: nap, consoleLines }) => {
  await send('Page.navigate', { url: URL_FILE });
  await nap(4200);
  await evaluate('window.__museum.hud.hideIntro()');
  const a = await evaluate(aim);
  console.log('aim', JSON.stringify(a));
  await nap(500);
  const toast = await evaluate(press);
  await nap(400);
  const plaque = await evaluate(`(() => {
    const p = document.querySelector('.plaque');
    return p ? { shown: p.style.display !== 'none', text: p.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60) } : null;
  })()`);
  console.log('plaque', JSON.stringify(plaque));
  console.log('toast', JSON.stringify(toast));
  const errs = consoleLines.filter((l) => /error|uncaught|TypeError/i.test(l));
  console.log('console errors:', errs.length ? errs.slice(0, 4).join('\n') : 'none');
});
