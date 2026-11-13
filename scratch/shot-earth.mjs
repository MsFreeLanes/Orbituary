/* shot-earth.mjs — the three photographs the Cupola step is judged by:
 * looking up at the Cupola from the rotunda floor; standing in the Cupola
 * with Earth in the window; and the rotunda at night with the viewports lit
 * by the planet. The time dial is driven through the HUD's own slider, so
 * the sun — and with it the terminator on Earth and the earthshine on the
 * viewports — is the one the museum computes, not one the probe installs.
 */
import { withBrowser } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const shot = async (send, name) => {
  const img = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(process.cwd(), 'scratch', name), Buffer.from(img.data, 'base64'));
  console.log('wrote scratch/' + name);
};

const place = (x, z, yaw, pitch) => `(() => {
  const m = window.__museum;
  m.rig.state.x = ${x}; m.rig.state.z = ${z};
  m.rig.setYawPitch(${yaw}, ${pitch});
  m.rig.update(0.016);
})()`;

const setHour = (minutes) => `(() => {
  const s = document.querySelector('input.time');
  s.value = '${minutes}';
  s.dispatchEvent(new Event('input'));
})()`;

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  await evaluate('window.__museum.hud.hideIntro()');

  /* 1 — from the rotunda floor, looking up the oculus: the Cupola's glass,
     its lit rim, and the vault above it. Stand south of the well and face
     north, so the oculus sits above the far side of the gallery. */
  await evaluate('window.__museum.rig.teleportTo("rotunda")');
  await evaluate(place(-5.2, -4.0, -2.30, 0.42));
  await nap(3500);
  await shot(send, 'cupola-up.png');

  /* 2 — in the gallery, midday over the ground track: the sun is up, so the
     disc under the station is lit and the terminator sits near its limb.
     Stand at the rail and look down the shaft: the line of sight passes the
     rotunda glazing, the stair hall's open ceiling, and the glazed floor of
     the hall itself before it reaches the planet. */
  await evaluate(setHour(13 * 60));
  await nap(1200);
  await evaluate('window.__museum.rig.teleportTo("cupola")');
  await evaluate(place(0.35, 1.5, 0.42, -1.25));
  await nap(2500);
  await shot(send, 'cupola-earth.png');
  console.log('sky', JSON.stringify(await evaluate(`(() => {
    const s = window.__museum.sky.state;
    return { sunAlt: +(s.sunAlt * 180 / Math.PI).toFixed(1), lat: s.lat };
  })()`)));

  /* 3 — dusk: the local sky is dark and the key light is off, but the
     planet under the station is still lit, and that is what the viewports
     are glowing with. Stand in the gallery at the well's edge: the cold
     anchor in the shaft — earthlit, low, and cool — is the only thing
     lighting this room, and the glow comes up from the glazed floor. */
  await evaluate(setHour(17 * 60 + 20));
  await nap(1200);
  await evaluate('window.__museum.rig.teleportTo("cupola")');
  await evaluate(place(0.9, 3.6, 0.0, -0.35));
  await nap(3000);
  await shot(send, 'rotunda-earthlit.png');
  console.log('sky', JSON.stringify(await evaluate(`(() => {
    const m = window.__museum, s = m.sky.state;
    return { sunAlt: +(s.sunAlt * 180 / Math.PI).toFixed(1),
      sunI: +m.lighting.sun.intensity.toFixed(2) };
  })()`)));

  const errs = await evaluate('window.__errors || []');
  console.log('errors: ' + JSON.stringify(errs));
});
