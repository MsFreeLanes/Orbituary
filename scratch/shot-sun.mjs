/* shot-sun.mjs — the three photographs the sunlight step is judged by.
 *
 *   node scratch/shot-sun.mjs
 *
 *   sun-privacy-hall-1600.png   the Privacy hall (west-south-west range) at
 *                               four in the afternoon: the sun's bearing is
 *                               120°, the hall's glazing faces 120°, and the
 *                               light comes straight in and lies the window
 *                               bars the length of the hall
 *   sun-privacy-hall-1200.png   the same hall, the same framing, at noon: the
 *                               bearing has swept 54° round and the light now
 *                               rakes in from the other side
 *   sun-night-rotunda-0200.png  the rotunda at two in the morning, the sun 52°
 *                               under the horizon, the station running on its
 *                               own fittings with the key light off
 *
 * The hour is set the way a visitor sets it: the HUD's time slider, which hands
 * main.js a minute of the day and lets the sky work out where that puts the
 * sun. ALWAYS NIGHT is switched off for the daylight framings, because a
 * visitor who has wound the dial to four in the afternoon and is standing in
 * sunlight is not going to leave the sky pinned to a starfield.
 *
 * The framing is the one shot-hull.mjs uses for a terminus hall — stand in the
 * doorway and look out through the viewports — so these are comparable with the
 * hull step's photographs. The rig's yaw runs the other way from the plan's:
 * the view direction is (-sin yaw, -cos yaw), so looking into a room from its
 * own door is the room's heading plus π.
 */
import { withBrowser, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const SHOTS = [
  {
    name: 'sun-privacy-hall-1600', hour: 16 * 60, day: true,
    set: `const m = window.__museum;
      m.rig.teleportTo('privacy');
      const r = m.plan.byId('privacy');
      const stand = Math.min(0.9, r.d * 0.2);
      m.rig.state.x = r.entry.x + r.n.x * stand;
      m.rig.state.z = r.entry.z + r.n.z * stand;
      m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.02);`
  },
  {
    name: 'sun-privacy-hall-1200', hour: 12 * 60, day: true,
    set: `const m = window.__museum;
      m.rig.teleportTo('privacy');
      const r = m.plan.byId('privacy');
      const stand = Math.min(0.9, r.d * 0.2);
      m.rig.state.x = r.entry.x + r.n.x * stand;
      m.rig.state.z = r.entry.z + r.n.z * stand;
      m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.02);`
  },
  {
    name: 'sun-night-rotunda-0200', hour: 2 * 60,
    set: `const m = window.__museum;
      m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = 2.2;
      m.rig.setYawPitch(Math.PI, 0.22);`
  }
];

const LIGHT = `(() => {
  const m = window.__museum, s = m.sky.state, sun = m.lighting.sun;
  const d = sun.position.clone().sub(sun.target.position);
  const alt = Math.asin(d.y / d.length()) * 57.2958;
  let az = Math.atan2(d.x, d.z) * 57.2958; if (az < 0) az += 360;
  return { sunAlt: +(s.sunAlt * 57.2958).toFixed(1), sunBearing: +(s.sunDir
      ? Math.atan2(s.sunDir[0], s.sunDir[2]) * 57.2958 : 0).toFixed(1),
    lightAlt: +alt.toFixed(1), lightBearing: +az.toFixed(1),
    intensity: +sun.intensity.toFixed(2), hemi: +m.lighting.hemi.intensity.toFixed(2),
    casters: (() => { let n = 0; m.view.scene.traverse((o) => { if (o.isLight && o.castShadow) n++; }); return n; })() };
})()`;

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
    /* the slider is the only honest way to move the hour: it is what the
       visitor touches, and it runs through main.js's setTime. the HUD rebuilds
       the row when the time changes, so the minutes go in one step and the
       element is found again and told about them in the next */
    await evaluate(`(() => {
      const box = document.querySelector('.toggle input');
      box.checked = ${shot.day ? 'false' : 'true'}; box.dispatchEvent(new Event('change'));
      const s = document.querySelector('input.time');
      s.value = '${shot.hour}'; s.dispatchEvent(new Event('input'));
    })()`);
    await nap(150);
    await evaluate(`(() => { const s = document.querySelector('input.time');
      s.dispatchEvent(new Event('change')); })()`);
    await evaluate(`(() => { ${shot.set} window.__museum.rig.update(0.016); })()`);
    await nap(1800);
    const at = await evaluate(`(() => { const s = window.__museum.rig.state;
      return { x: +s.x.toFixed(1), z: +s.z.toFixed(1), room: s.room, storey: s.storey,
        clock: document.querySelector('.sky-clock').textContent }; })()`);
    const light = await evaluate(LIGHT);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', shot.name + '.png'),
      Buffer.from(img.data, 'base64'));
    console.log('shot scratch/' + shot.name + '.png at ' + JSON.stringify(at));
    console.log('   ' + JSON.stringify(light));
  }

  const bad = consoleLines.filter((l) => !/favicon|Autoplay|GPU stall|GroupMarkerNotSet|deprecated/i.test(l));
  console.log(bad.length ? 'CONSOLE:\n' + bad.slice(0, 8).join('\n') : 'console: clean');
  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors')));
});
