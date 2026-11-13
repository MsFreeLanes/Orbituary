/* shot-palette.mjs — the four photographs the palette step is judged by, plus
 * one the owner did not ask for but the rim retune needs: the station seen
 * from outside, which is the only place the rim strips have a job.
 *
 *   node scratch/shot-palette.mjs
 *
 *   palette-cupola-earth.png    the Cupola, looking straight down the well at
 *                               the planet. Framing and hour are the ones
 *                               shot-well.mjs used for well-cupola.png, so the
 *                               washed-out frame that started this step is
 *                               directly comparable with this one.
 *   palette-rotunda.png         the rotunda from its own floor. Same standing
 *                               position and heading as the exposure probe's
 *                               `rotunda` framing, so the numbers and the
 *                               photograph are the same photograph.
 *   palette-hall-sunlight.png   a terminus hall with the sun lying through the
 *                               glazing — the Privacy hall at four in the
 *                               afternoon, as shot-sun.mjs frames it.
 *   palette-corridor-night.png  a ground range at two in the morning: the
 *                               station on its own fittings, the sun off.
 *   palette-hull-outside.png    the whole wheel from outside the skin, with
 *                               the cull switched off, to check that the rim
 *                               still reads at eighty metres now that it is a
 *                               third of the brightness it was.
 */
import { withBrowser } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const URL_FILE = 'file:///' + path.join(process.cwd(), 'index-v2.html').replace(/\\/g, '/');

const SHOTS = [
  {
    name: 'palette-cupola-earth', hour: 13 * 60, night: true,
    set: `m.rig.teleportTo('cupola');
      m.rig.state.x = 0.20; m.rig.state.z = 0.95;
      m.rig.setYawPitch(Math.atan2(-(0.0 - 0.20), -(0.8 - 0.95)), -1.50);`
  },
  {
    name: 'palette-rotunda', hour: 7 * 60 + 47, night: true,
    set: `m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = 1.5;
      m.rig.setYawPitch(Math.PI, -0.02);`
  },
  {
    name: 'palette-hall-sunlight', hour: 16 * 60, night: false,
    set: `m.rig.teleportTo('privacy');
      const r = m.plan.byId('privacy');
      const stand = Math.min(0.9, r.d * 0.2);
      m.rig.state.x = r.entry.x + r.n.x * stand;
      m.rig.state.z = r.entry.z + r.n.z * stand;
      m.rig.setYawPitch(Math.atan2(r.n.x, r.n.z) + Math.PI, 0.02);`
  },
  {
    name: 'palette-corridor-night', hour: 2 * 60, night: true,
    set: `const c = m.plan.corridors.find((c) => c.dir.z > 0.5);
      m.rig.state.storey = 'ground'; m.rig.state.x = 0; m.rig.state.z = (c.t0 + c.t1) / 2;
      m.rig.setYawPitch(Math.PI, -0.05);`
  },
  {
    name: 'palette-hull-outside', hour: 7 * 60 + 47, night: true, outside: [58, 14, 86],
    set: `m.view.cull.off();`
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

  /* an exterior framing needs the camera held where the probe puts it: the rig
     writes camera.position from the visitor's feet every frame, so the only way
     to look at the station from outside is to let the rig run and then move the
     camera after it, which is the same patch probe-exposure uses to stand a
     camera on the cellar slab. */
  await evaluate(`(() => { const m = window.__museum;
    m.__cam = null;
    const upd = m.rig.update.bind(m.rig);
    m.rig.update = (dt) => { const out = upd(dt);
      if (m.__cam) { m.camera.position.set(m.__cam[0], m.__cam[1], m.__cam[2]);
        m.camera.lookAt(0, 4, 0); }
      return out; };
  })()`);

  for (const shot of SHOTS) {
    await evaluate(`(() => {
      const box = document.querySelector('.toggle input');
      box.checked = ${shot.night}; box.dispatchEvent(new Event('change'));
      const s = document.querySelector('input.time');
      s.value = '${shot.hour}'; s.dispatchEvent(new Event('input'));
    })()`);
    await nap(200);
    await evaluate(`(() => { const m = window.__museum; m.__cam = ${JSON.stringify(shot.outside || null)}; ${shot.set} m.rig.update(0.016); })()`);
    await nap(2500);
    const img = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(process.cwd(), 'scratch', shot.name + '.png'),
      Buffer.from(img.data, 'base64'));
    const sky = await evaluate(`(() => { const m = window.__museum, s = m.sky.state;
      return { sunAlt: +(s.sunAlt * 57.2958).toFixed(1), sunI: +m.lighting.sun.intensity.toFixed(2),
        bloom: +m.view.bloom.strength.toFixed(2), thr: +m.view.bloom.threshold.toFixed(2),
        exposure: +m.view.renderer.toneMappingExposure.toFixed(2), clock: document.querySelector('.sky-clock').textContent }; })()`);
    console.log('shot scratch/' + shot.name + '.png ' + JSON.stringify(sky));
  }

  const bad = consoleLines.filter((l) => !/favicon|Autoplay|GPU stall|GroupMarkerNotSet|deprecated/i.test(l));
  console.log(bad.length ? 'CONSOLE:\n' + bad.slice(0, 8).join('\n') : 'console: clean');
  console.log('errors: ' + JSON.stringify(await evaluate('window.__errors || []')));
});
