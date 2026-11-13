/* shot-well.mjs — the three photographs the well is judged by:
 *   1. in the Cupola, looking down the shaft at the planet;
 *   2. on the rotunda floor at the well's edge, looking down through the glass;
 *   3. in the Stair Hall, looking up through the well from below.
 * Framing 2 is shot twice, once close enough that the planet is in the tube's
 * cone and once back on the marble where the glass and its edge are the point.
 * The dial is pinned to midday over the ground track so the disc under the
 * station is lit and the terminator sits near its limb.
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

/* the rig looks down its own -Z, so the yaw that points at (tx, tz) from
   (x, z) is atan2(-(tx - x), -(tz - z)) */
const place = (x, z, tx, tz, pitch, storey) => `(() => {
  const m = window.__museum;
  m.rig.state.storey = ${JSON.stringify(storey || 'ground')};
  m.rig.state.x = ${x}; m.rig.state.z = ${z};
  m.rig.setYawPitch(Math.atan2(${-(tx - x)}, ${-(tz - z)}), ${pitch});
  m.rig.update(0.016);
})()`;

await withBrowser(async ({ send, evaluate, sleep: nap }) => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message) + ' @' + (e.filename || 'inline') + ':' + e.lineno));`
  });
  await send('Page.navigate', { url: URL_FILE });
  await nap(4000);
  await evaluate('window.__museum.hud.hideIntro()');
  for (let i = 0; i < 2; i++) {
    await evaluate(`(() => { const s = document.querySelector('input.time');
      s.value = '780'; s.dispatchEvent(new Event('input')); })()`);
    await nap(350);
  }

  /* 1 — the Cupola, standing on the glazing at the mouth's centre and
     looking straight down its axis: the mouth is 2.70 m across 5.26 m below,
     so the planet overflows it and the well's own wall is what frames it */
  await evaluate('window.__museum.rig.teleportTo("cupola")');
  await evaluate(place(0.20, 0.95, 0.0, 0.8, -1.50));
  await nap(2500);
  await shot(send, 'well-cupola.png');

  /* 2a — on the deck at the well's edge, 1.8 m out from its axis, looking
     down across it: the tube's own edge lets a 25° window of planet through,
     the funnel's wall frames the far side of it, and the marble and the
     sun's shadow lie under the eye. This is the framing the "hole or glass?"
     complaint was made in. */
  await evaluate('window.__museum.rig.teleportTo("rotunda")');
  await evaluate(place(0.75, 2.75, 0.0, 0.8, -1.10));
  await nap(2500);
  await shot(send, 'well-rotunda.png');

  /* 2b — back on the marble outside the deck ring, 4.8 m from the well's
     axis, where the glass, its edge and its sheen are the subject and the
     sun's shadow is lying across the floor. From here the well is a shallow
     cone and the planet is not in it: that is the geometry of a 1.45 m tube,
     and the shot is about the pane. */
  await evaluate(place(0.0, 5.60, 0.0, 0.8, -0.40));
  await nap(2500);
  await shot(send, 'well-rotunda-wide.png');

  /* 3 — the Stair Hall, looking up at the well's ceiling opening */
  await evaluate(place(0.40, 2.80, 0.0, 0.8, 0.72, 'basement'));
  await nap(2500);
  await shot(send, 'well-stairhall.png');

  console.log('sky', JSON.stringify(await evaluate(`(() => {
    const m = window.__museum, s = m.sky.state;
    return { sunAlt: +(s.sunAlt * 180 / Math.PI).toFixed(1), sunI: +m.lighting.sun.intensity.toFixed(2) };
  })()`)));
  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors || []')));
});
