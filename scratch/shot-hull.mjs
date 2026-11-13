/* shot-hull.mjs — the three photographs the hull step is judged by.
 *
 *   node scratch/shot-hull.mjs
 *
 *   hull-rotunda-cupola.png   standing in the rotunda, looking up the Cupola
 *   hull-terminus-viewports.png   in a terminus hall, looking out its three viewports
 *   hull-outside-void.png   outside the station in void, looking back at the hull
 *   hull-outside-hull.png   the same from close enough to read the plating
 *
 * The rig's yaw runs the other way from the plan's: the view direction is
 * (-sin yaw, -cos yaw), so looking at the origin from (px, pz) is atan2(px, pz)
 * and looking into a room from its own door is the room's heading plus π.
 *
 * The outside shot switches the spoke cull off first: the cull decides what to
 * submit from where the visitor is standing, and a visitor standing 70 m away
 * in empty space would be told they can see nothing. The probe wants the whole
 * hull on screen, so it asks for the same thing probe-drawcalls asks for.
 */
import { withBrowser, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const SHOTS = [
  {
    name: 'hull-rotunda-cupola',
    set: `const m = window.__museum;
      m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = 1.5;
      m.rig.setYawPitch(Math.PI, 1.12);`
  },
  {
    name: 'hull-terminus-viewports',
    set: `const m = window.__museum;
      m.rig.teleportTo('gaming');
      const r = m.plan.byId('gaming');
      const stand = Math.min(0.9, r.d * 0.2);
      m.rig.state.x = r.entry.x + r.n.x * stand;
      m.rig.state.z = r.entry.z + r.n.z * stand;
      m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.03);`
  },
  {
    name: 'hull-corridor',
    set: `const m = window.__museum;
      m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = 26;
      m.rig.setYawPitch(Math.PI, -0.02);`
  },
  {
    name: 'hull-side-viewport',
    set: `const m = window.__museum;
      const r = m.plan.byId('modding');
      m.rig.teleportTo('modding');
      m.rig.state.x = r.entry.x + r.n.x * 1.8;
      m.rig.state.z = r.entry.z + r.n.z * 1.8;
      m.rig.setYawPitch(Math.atan2(-r.n.x, -r.n.z), 0.10);`
  },
  {
    name: 'hull-outside-hull',
    pre: `if (window.__museum.view.cull) window.__museum.view.cull.off();`,
    set: `const m = window.__museum;
      const px = 28, pz = 64, tx = 0, tz = 46;
      m.rig.state.storey = 'ground';
      m.rig.state.x = px; m.rig.state.z = pz;
      m.rig.setYawPitch(Math.atan2(-(tx - px), -(tz - pz)), 0.10);`
  },
  {
    name: 'hull-wedge-pinch',
    pre: `if (window.__museum.view.cull) window.__museum.view.cull.off();`,
    set: `const m = window.__museum;
      const a = 105 * Math.PI / 180;
      const px = Math.sin(a) * 44, pz = Math.cos(a) * 44;
      const tx = Math.sin(a) * 24, tz = Math.cos(a) * 24;
      m.rig.state.storey = 'ground';
      m.rig.state.x = px; m.rig.state.z = pz;
      m.rig.setYawPitch(Math.atan2(px - tx, pz - tz), 0.10);`
  },
  {
    name: 'hull-outside-void',
    pre: `if (window.__museum.view.cull) window.__museum.view.cull.off();`,
    set: `const m = window.__museum;
      const a = Math.PI / 12, d = 72;
      const px = Math.sin(a) * d, pz = Math.cos(a) * d;
      m.rig.state.storey = 'ground';
      m.rig.state.x = px; m.rig.state.z = pz;
      m.rig.setYawPitch(Math.atan2(px - 0, pz - 0), 0.06);`
  }
];

await withBrowser(async ({ send, evaluate, sleep: nap, consoleLines }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message) + ' @' + (e.filename || 'inline') + ':' + e.lineno));`
  });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  await evaluate('window.__museum.hud.hideIntro()');

  for (const shot of SHOTS) {
    if (shot.pre) await evaluate(shot.pre);
    await evaluate(`(() => { ${shot.set} window.__museum.rig.update(0.016); })()`);
    await nap(1600);
    const at = await evaluate(`(() => { const s = window.__museum.rig.state;
      return { x: +s.x.toFixed(1), z: +s.z.toFixed(1), room: s.room, storey: s.storey }; })()`);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', shot.name + '.png'),
      Buffer.from(img.data, 'base64'));
    console.log('shot scratch/' + shot.name + '.png at ' + JSON.stringify(at));
  }

  const bad = consoleLines.filter((l) => !/favicon|Autoplay|GPU stall|GroupMarkerNotSet|deprecated/i.test(l));
  console.log(bad.length ? 'CONSOLE:\n' + bad.slice(0, 8).join('\n') : 'console: clean');
  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors')));
});
