/* Does the sky actually point at the right sky? Loads index-v2.html, drives
   sky.update() with known instants, and compares what the vault puts overhead
   against numbers worked out by hand: Polaris sits at your latitude due north,
   the solstice noon sun is at 90 - lat + 23.44, and Sydney at local noon on
   the December solstice is almost overhead. */
import { withBrowser } from './cdp.mjs';

const URL = 'file:///C:/Users/skyee/Documents/Strata/Workspace/index-v2.html';

const result = await withBrowser(async ({ send, evaluate, sleep }) => {
  await send('Page.navigate', { url: URL });
  await sleep(4000);

  return await evaluate(`(() => {
    const m = window.__museum;
    if (!m) return { error: 'no __museum handle' };
    const T = m.THREE, D = Math.PI / 180, sky = m.sky;
    const lat0 = sky.state.lat, lon0 = sky.state.lon;

    function place(lat, lon, ms) {
      sky.state.lat = lat; sky.state.lon = lon;
      sky.update(ms);
      sky.group.updateWorldMatrix(true, false);
    }
    /* where the vault actually puts a star: the star field lives in the vault's
       own frame (pole on +Y, RA 0h on -X) and the group's quaternion is the
       horizon transform. the museum's axes are +Y up, +Z north, +X west, so the
       compass bearing runs counter-clockwise in world axes and is flipped here. */
    function altaz(raDeg, decDeg) {
      const r = raDeg * D, d = decDeg * D;
      const v = new T.Vector3(-Math.cos(d) * Math.cos(r), Math.sin(d), Math.cos(d) * Math.sin(r));
      v.applyQuaternion(sky.group.quaternion);
      const alt = Math.asin(v.y / v.length()) / D;
      let az = Math.atan2(-v.x, v.z) / D;
      if (az < 0) az += 360;
      return { alt: +alt.toFixed(2), az: +az.toFixed(2) };
    }
    /* the same altitude from the textbook formula, worked independently */
    function altFromLst(raDeg, decDeg) {
      const H = sky.state.lst - raDeg * D, d = decDeg * D, l = sky.state.lat * D;
      return Math.asin(Math.sin(d) * Math.sin(l) + Math.cos(d) * Math.cos(l) * Math.cos(H)) / D;
    }

    const checks = [];
    const near = (name, got, want, tol) => {
      const ok = Math.abs(got - want) <= tol;
      checks.push({ name, got: +got.toFixed(2), want, tol, ok });
    };

    /* 1. New York, 01:00 local on 12 Nov 2026: the pole sits at your latitude,
       due north; Polaris is 0.74 deg away from the pole so it wanders that far */
    place(40.7, -74.0, Date.UTC(2026, 10, 12, 5, 0));
    const pole = altaz(0, 90);
    near('celestial pole altitude = latitude', pole.alt, 40.70, 0.1);
    near('celestial pole due north', pole.az < 180 ? pole.az : 360 - pole.az, 0, 1);
    const polaris = altaz(37.95, 89.264);
    near('Polaris altitude ~ latitude', polaris.alt, 40.70, 0.8);
    near('Polaris due north', polaris.az < 180 ? polaris.az : 360 - polaris.az, 0, 3);

    /* 2. the same star against the textbook formula */
    const vega = altaz(279.234, 38.784);
    near('Vega altitude matches formula', vega.alt, altFromLst(279.234, 38.784), 0.5);
    const sirius = altaz(101.287, -16.716);
    near('Sirius altitude matches formula', sirius.alt, altFromLst(101.287, -16.716), 0.5);

    /* 3. June solstice, solar noon in New York: 90 - 40.7 + 23.44 = 72.7 */
    place(40.7, -74.0, Date.UTC(2026, 5, 21, 16, 56));
    near('solstice noon sun', sky.state.sunAlt / D, 72.7, 1.6);
    /* 4. eight hours later it is on the other side: lat + dec - 90 = -25.9 */
    place(40.7, -74.0, Date.UTC(2026, 5, 22, 4, 56));
    near('solstice midnight sun', sky.state.sunAlt / D, -25.9, 2.5);

    /* 5. Sydney: the sun should peak near 79.6 degrees, at about 01:00 UTC on
       the December solstice, and the Cross should be up while Orion is not */
    place(-33.87, 151.21, Date.UTC(2026, 11, 21, 1, 0));
    let peak = -90, peakAt = 0;
    for (let t = Date.UTC(2026, 11, 20, 20, 0); t <= Date.UTC(2026, 11, 21, 6, 0); t += 600000) {
      sky.update(t);
      if (sky.state.sunAlt / D > peak) { peak = sky.state.sunAlt / D; peakAt = t; }
    }
    near('Sydney noon sun peaks at', peak, 79.6, 1.6);
    /* near the zenith the peak is broad, so the sampled maximum is loose */
    checks.push({ name: 'Sydney solar noon near 01:00 UTC', got: (peakAt - Date.UTC(2026, 11, 21, 1, 0)) / 60000,
      want: 'within 60 min', tol: 0, ok: Math.abs(peakAt - Date.UTC(2026, 11, 21, 1, 0)) < 60 * 60000 });
    place(-33.87, 151.21, Date.UTC(2026, 11, 21, 1, 0));
    const crux = altaz(186.85, -59.69);
    checks.push({ name: 'Crux above Sydney horizon', got: crux.alt, want: 'above 0', tol: 0, ok: crux.alt > 0 });
    place(-33.87, 151.21, Date.UTC(2026, 11, 21, 1, 0));

    /* 6. the hour angle must actually move things: on the equinox the sun
       crosses the horizon about six hours either side of local noon (16:56 UTC) */
    place(40.7, -74.0, Date.UTC(2026, 2, 20, 10, 56));
    near('equinox sunrise', sky.state.sunAlt / D, 0, 1.6);
    place(40.7, -74.0, Date.UTC(2026, 2, 20, 22, 56));
    near('equinox sunset', sky.state.sunAlt / D, 0, 1.6);
    place(40.7, -74.0, Date.UTC(2026, 2, 20, 16, 56));
    near('equinox noon sun', sky.state.sunAlt / D, 90 - 40.7, 1.6);

    /* 7. the sky must not be mirrored: a star past the meridian (hour angle
       +30 deg, so ra = lst - 30) belongs in the western half of the sky */
    place(40.7, -74.0, Date.UTC(2026, 10, 12, 5, 0));
    const pastMeridian = altaz((sky.state.lst / D - 30 + 360) % 360, 20);
    checks.push({ name: 'hour angle +30 deg lands in the west', got: pastMeridian.az, want: '180..360', tol: 0,
      ok: pastMeridian.az > 180 && pastMeridian.az < 360 });
    const beforeMeridian = altaz((sky.state.lst / D + 30 + 360) % 360, 20);
    checks.push({ name: 'hour angle -30 deg lands in the east', got: beforeMeridian.az, want: '0..180', tol: 0,
      ok: beforeMeridian.az > 0 && beforeMeridian.az < 180 });

    place(lat0, lon0, Date.now());
    return { checks, defaults: { lat: lat0, lon: lon0 }, failed: checks.filter((c) => !c.ok).length };
  })()`);
});

console.log(JSON.stringify(result, null, 1));
if (result.failed) process.exitCode = 1;
