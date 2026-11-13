/* sun-track.mjs — what bearing the hull's key light would be hung off, hour by
 * hour across the time slider's span. The arithmetic is sky.js's own, copied
 * here so it can be read without a browser: the sun's ecliptic longitude, the
 * obliquity trick, then the local sidereal time for the default region.
 *   node scratch/sun-track.mjs
 */
const D2R = Math.PI / 180, TAU = Math.PI * 2;
const OBLIQ = 23.4393 * D2R;
const julian = (ms) => ms / 86400000 + 2440587.5;
const gmst = (ms) => {
  const d = julian(ms) - 2451545.0;
  return ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360 * D2R;
};
function solarLongitude(ms) {
  const n = julian(ms) - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) % 360;
  return (L + 1.915 * Math.sin(g * D2R) + 0.020 * Math.sin(2 * g * D2R)) * D2R;
}
function eclipticToEquatorial(lambda, beta) {
  const cb = Math.cos(beta), sb = Math.sin(beta);
  const y = cb * Math.sin(lambda) * Math.cos(OBLIQ) - sb * Math.sin(OBLIQ);
  const x = cb * Math.cos(lambda);
  const z = cb * Math.sin(lambda) * Math.sin(OBLIQ) + sb * Math.cos(OBLIQ);
  return { ra: (Math.atan2(y, x) + TAU) % TAU, dec: Math.asin(Math.max(-1, Math.min(1, z))) };
}
const eqToVec = (ra, dec, r) => [
  -r * Math.cos(dec) * Math.cos(ra), r * Math.sin(dec), r * Math.cos(dec) * Math.sin(ra)
];

const LAT = 40.7 * D2R, LON = -74.0;
const day = Date.UTC(2026, 10, 13);   // the day the museum is running on

let prev = null, swept = 0, up = 0;
for (let min = 0; min <= 1440; min += 30) {
  const ms = day + (min + 300) * 60000;   // the slider is local minutes; the zone is UTC-5
  const lst = gmst(ms) + LON * D2R;
  const st = Math.sin(lst), ct = Math.cos(lst), sl = Math.sin(LAT), cl = Math.cos(LAT);
  const upv = [ct * cl, st * cl, sl], north = [-ct * sl, -st * sl, cl], west = [st, -ct, 0];
  const sun = eclipticToEquatorial(solarLongitude(ms), 0);
  const sv = eqToVec(sun.ra, sun.dec, 1);
  /* sky.js puts every star in the vault's own frame and the horizon vectors
     too, so the altitude is the dot product of two vault-frame vectors */
  const e = [-west[0], west[2], west[1]], u = [-upv[0], upv[2], upv[1]], n = [-north[0], north[2], north[1]];
  const alt = Math.asin(sv[0] * u[0] + sv[1] * u[1] + sv[2] * u[2]);
  const dir = [e[0] * sv[0] + e[1] * sv[1] + e[2] * sv[2],
    u[0] * sv[0] + u[1] * sv[1] + u[2] * sv[2],
    n[0] * sv[0] + n[1] * sv[1] + n[2] * sv[2]];
  let az = Math.atan2(dir[0], dir[2]) / D2R;   // room axes: +x west, +z north
  if (az < 0) az += 360;
  if (prev !== null) {
    let d = az - prev;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    swept += d;
  }
  prev = az;
  if (alt > 0) up++;
  const hh = String(Math.floor(min / 60) % 24).padStart(2, '0'), mm = String(min % 60).padStart(2, '0');
  console.log(`${hh}:${mm}  alt ${(alt / D2R).toFixed(1).padStart(6)}°  bearing ${az.toFixed(1).padStart(6)}°` +
    (alt > 0 ? '  sun' : '  interior only'));
}
console.log('one slider span: bearing sweeps ' + Math.abs(swept).toFixed(1) +
  ' deg, sun up for ' + (up / 2).toFixed(1) + ' h');
