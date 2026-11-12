/* ── sky ─────────────────────────────────────────────────────────────────
   A sky you can set your watch by. One catalogue in equatorial coordinates,
   one quaternion per frame that turns the celestial sphere into this room's
   up-and-north, and the windows do the rest. Change the latitude and the
   longitude dials and the whole vault swings over: the same building, a
   different hemisphere.

   The bright stars are real (J2000 RA/Dec and magnitude). The faint
   population is generated — five thousand points weighted towards the
   galactic plane, which is what makes the Milky Way read as a band rather
   than as confetti. */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const SKY_R = 380;

/* ── real bright stars: name, RA hours, Dec degrees, magnitude, B-V ── */
const BRIGHT = [
  ['Sirius', 6.7525, -16.716, -1.46, 0.00], ['Canopus', 6.399, -52.696, -0.74, 0.15],
  ['Arcturus', 14.261, 19.182, -0.05, 1.23], ['Vega', 18.615, 38.784, 0.03, 0.00],
  ['Capella', 5.278, 45.998, 0.08, 0.80], ['Rigel', 5.242, -8.202, 0.13, -0.03],
  ['Procyon', 7.655, 5.225, 0.34, 0.42], ['Betelgeuse', 5.919, 7.407, 0.42, 1.85],
  ['Achernar', 1.629, -57.237, 0.46, -0.16], ['Altair', 19.846, 8.868, 0.77, 0.22],
  ['Aldebaran', 4.599, 16.509, 0.85, 1.54], ['Antares', 16.490, -26.432, 0.96, 1.83],
  ['Spica', 13.420, -11.161, 0.97, -0.23], ['Pollux', 7.755, 28.026, 1.14, 1.08],
  ['Fomalhaut', 22.961, -29.622, 1.16, 0.20], ['Deneb', 20.690, 45.280, 1.25, 0.09],
  ['Mimosa', 12.795, -59.689, 1.25, -0.24], ['Regulus', 10.140, 11.967, 1.35, -0.11],
  ['Adhara', 6.977, -28.972, 1.50, -0.20], ['Castor', 7.577, 31.888, 1.58, 0.03],
  ['Shaula', 17.560, -37.104, 1.62, -0.22], ['Gacrux', 12.519, -57.113, 1.63, 1.60],
  ['Bellatrix', 5.419, 6.350, 1.64, -0.22], ['Elnath', 5.438, 28.608, 1.65, 0.94],
  ['Miaplacidus', 9.220, -69.720, 1.67, 0.10], ['Alnilam', 5.604, -1.202, 1.69, -0.18],
  ['Alnair', 22.137, -46.961, 1.74, 0.12], ['Alioth', 12.900, 55.960, 1.77, -0.03],
  ['Dubhe', 11.062, 61.751, 1.79, 1.07], ['Mirfak', 3.406, 49.862, 1.80, 0.63],
  ['Wezen', 7.140, -26.393, 1.83, 0.69], ['Sargas', 17.622, -42.998, 1.86, 0.39],
  ['Kaus Australis', 18.403, -34.385, 1.85, -0.06], ['Avior', 8.375, -59.510, 1.86, 1.07],
  ['Alkaid', 13.792, 49.313, 1.86, -0.03], ['Menkalinan', 5.992, 44.947, 1.90, 0.03],
  ['Atria', 16.811, -69.028, 1.92, 1.30], ['Alhena', 6.629, 16.399, 1.93, 0.00],
  ['Alpheratz', 0.140, 29.090, 2.06, -0.06], ['Polaris', 2.530, 89.264, 1.98, 0.60],
  ['Saiph', 5.796, -9.670, 2.09, -0.18], ['Denebola', 11.818, 14.572, 2.11, 0.09],
  ['Algol', 3.136, 40.956, 2.12, 0.08], ['Hamal', 2.114, 23.463, 2.00, 1.15],
  ['Almach', 2.064, 42.330, 2.10, 1.10], ['Nunki', 18.921, -26.297, 2.05, -0.10],
  ['Rasalhague', 17.582, 12.560, 2.08, 0.08], ['Kochab', 14.845, 74.156, 2.08, 1.24],
  ['Sadalsuud', 21.526, -5.574, 2.90, 0.10], ['Markab', 23.079, 15.205, 2.49, 0.28],
  ['Enif', 21.736, 9.875, 2.39, 1.57], ['Scheat', 23.063, 28.083, 2.42, 1.26],
  ['Izar', 14.749, 27.074, 2.35, 1.39], ['Rasalgethi', 17.245, 12.916, 2.77, 1.50],
  ['Cebalrai', 17.155, 4.567, 2.72, 1.23], ['Sabik', 17.148, -15.725, 2.56, 0.13],
  ['Yed Prior', 17.123, -16.652, 2.71, 1.30], ['Acrab', 16.607, -19.986, 2.56, -0.03],
  ['Dschubba', 16.005, -22.622, 2.29, -0.20], ['Kraz', 12.022, -17.152, 2.75, 0.30]
];

const PLANETS = [
  ['Mercury', 0.24085, 4.40, 0.0], ['Venus', 0.61520, 3.18, 0.0],
  ['Mars', 1.88090, 6.20, 0.0], ['Jupiter', 11.862, 3.90, 0.0], ['Saturn', 29.457, 0.60, 0.0]
];

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const julian = (ms) => ms / 86400000 + 2440587.5;

function gmst(ms) {
  const d = julian(ms) - 2451545.0;
  return ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360 * D2R;
}

/* ecliptic longitude of the mean sun, then the obliquity trick */
function solarLongitude(ms) {
  const n = julian(ms) - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) % 360;
  return (L + 1.915 * Math.sin(g * D2R) + 0.020 * Math.sin(2 * g * D2R)) * D2R;
}

function moonLongitude(ms) {
  const n = julian(ms) - 2451545.0;
  const L = (218.316 + 13.176396 * n) * D2R;
  const M = (134.963 + 13.064993 * n) * D2R;
  return L + 6.289 * D2R * Math.sin(M);
}

const OBLIQ = 23.4393 * D2R;

function eclipticToEquatorial(lambda, beta) {
  const cb = Math.cos(beta), sb = Math.sin(beta);
  const y = cb * Math.sin(lambda) * Math.cos(OBLIQ) - sb * Math.sin(OBLIQ);
  const x = cb * Math.cos(lambda);
  const z = cb * Math.sin(lambda) * Math.sin(OBLIQ) + sb * Math.cos(OBLIQ);
  return { ra: (Math.atan2(y, x) + TAU) % TAU, dec: Math.asin(Math.max(-1, Math.min(1, z))) };
}

/* every star in the vault is placed in the vault's own frame, not the textbook
   equatorial one: SphereGeometry wraps its texture about its own Y axis, so
   here the celestial pole is +Y, RA 0h sits on -X and RA 6h on +Z. */
const eqToVec = (ra, dec, r) => [
  -r * Math.cos(dec) * Math.cos(ra), r * Math.sin(dec), r * Math.cos(dec) * Math.sin(ra)
];

/* B-V colour index to a plausible RGB, clamped so red dwarfs stay warm */
function starColor(bv) {
  const t = Math.max(-0.3, Math.min(2.2, bv));
  const r = t < 0.5 ? 1 : 1 - (t - 0.5) * 0.34;
  const g = t < 0.3 ? 1 : 1 - (t - 0.3) * 0.30;
  const b = t > 0.4 ? Math.max(0.35, 1 - (t - 0.4) * 0.42) : 1;
  return [r, g, b];
}

/* the vault itself: a band of galaxy painted in equatorial UV space */
function skyTexture() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const img = x.createImageData(W, H);
  const d = img.data;
  /* north galactic pole in equatorial coords */
  const ngpRA = 192.8595 * D2R, ngpDec = 27.1284 * D2R;
  const n = [Math.cos(ngpDec) * Math.cos(ngpRA), Math.cos(ngpDec) * Math.sin(ngpRA), Math.sin(ngpDec)];
  const gcRA = 266.405 * D2R, gcDec = -28.936 * D2R;
  const gc = eqToVec(gcRA, gcDec, 1);
  const rand = rng(1337);

  for (let j = 0; j < H; j++) {
    const dec = (0.5 - (j + 0.5) / H) * Math.PI;
    const cd = Math.cos(dec), sd = Math.sin(dec);
    for (let i = 0; i < W; i++) {
      const ra = ((i + 0.5) / W) * TAU;
      const vx = cd * Math.cos(ra), vy = cd * Math.sin(ra), vz = sd;
      const b = Math.asin(Math.max(-1, Math.min(1, vx * n[0] + vy * n[1] + vz * n[2])));
      const dot = vx * gc[0] + vy * gc[1] + vz * gc[2];
      const bulge = Math.max(0, dot);
      let glow = Math.exp(-(b * b) / (2 * Math.pow(0.115, 2))) * (0.55 + 0.75 * Math.pow(bulge, 2.2));
      glow += Math.exp(-(b * b) / (2 * Math.pow(0.030, 2))) * (0.35 + 0.5 * Math.pow(bulge, 3));
      glow += 0.012;
      const dust = 1 - 0.45 * Math.exp(-(b * b) / (2 * 0.02 * 0.02)) * rand();
      const v = Math.min(1, glow * dust);
      const k = (j * W + i) * 4;
      d[k] = 6 + v * 46;
      d[k + 1] = 7 + v * 44;
      d[k + 2] = 12 + v * 52;
      d[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function dotTexture() {
  const S = 64, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSky(THREE) {
  const group = new THREE.Group();
  const vault = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_R, 64, 32),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false })
  );
  group.add(vault);
  /* the sky is all transparent, and everything in it sits at the same distance
     from the visitor, so three's painter sort has nothing to work with. these
     say which is behind which: vault, then the haze band, then the field. */
  vault.renderOrder = 0;

  /* catalogue */
  const pos = [], col = [], mag = [];
  const rand = rng(90210);
  const ngpRA = 192.8595 * D2R, ngpDec = 27.1284 * D2R;
  const n = [Math.cos(ngpDec) * Math.cos(ngpRA), Math.cos(ngpDec) * Math.sin(ngpRA), Math.sin(ngpDec)];
  for (const [name, raH, decD, m, bv] of BRIGHT) {
    const v = eqToVec(raH * 15 * D2R, decD * D2R, SKY_R * 0.98);
    pos.push(...v);
    const [r, g, b] = starColor(bv);
    const w = Math.pow(1.42, -m * 0.55);
    col.push(r * w, g * w, b * w);
    mag.push(m);
  }
  const FAINT = 5600;
  /* orthonormal basis lying in the galactic plane, used by the banded half */
  const u = [Math.cos(ngpRA + Math.PI / 2), Math.sin(ngpRA + Math.PI / 2), 0];
  const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const wl = Math.hypot(w[0], w[1], w[2]);
  w[0] /= wl; w[1] /= wl; w[2] /= wl;
  for (let i = 0; i < FAINT; i++) {
    /* two populations. most of the naked-eye sky does sit along the galactic
       plane, but a field that lives only in the band leaves every window that
       is not looking at the Milky Way empty, and a window with one star in it
       reads as a bug rather than as a sky. so a little under half are scattered
       over the whole sphere, the way the real 6000-odd are. */
    let vx, vy, vz;
    if (rand() < 0.42) {
      const yy = rand() * 2 - 1, ll = rand() * TAU, rr = Math.sqrt(1 - yy * yy);
      vx = rr * Math.cos(ll); vy = yy; vz = rr * Math.sin(ll);
    } else {
      /* pick a galactic latitude from a band, then a random longitude */
      const b = (Math.pow(rand(), 2.2) - 0.5) * 0.62;
      const l = rand() * TAU;
      const cb = Math.cos(b), sb = Math.sin(b);
      vx = cb * (Math.cos(l) * u[0] + Math.sin(l) * w[0]) + sb * n[0];
      vy = cb * (Math.cos(l) * u[1] + Math.sin(l) * w[1]) + sb * n[1];
      vz = cb * (Math.cos(l) * u[2] + Math.sin(l) * w[2]) + sb * n[2];
    }
    pos.push(-vx * SKY_R * 0.98, vz * SKY_R * 0.98, vy * SKY_R * 0.98);
    const m = 2.2 + Math.pow(rand(), 1.6) * 3.2;
    const [r, g, bb] = starColor((rand() - 0.35) * 1.6);
    const wgt = Math.pow(1.42, -m * 0.38);
    col.push(r * wgt, g * wgt, bb * wgt);
    mag.push(m);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 3.6, map: dotTexture(), vertexColors: true, transparent: true,
    depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false
  }));
  group.add(stars);
  stars.renderOrder = 2;

  /* the moon: a disc painted for tonight's phase */
  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = moonCanvas.height = 128;
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(11, 11),
    new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  moon.visible = false;
  group.add(moon);
  moon.renderOrder = 4;

  /* planets are points too, brighter and steadier than the field */
  const planetPos = [], planetCol = [];
  PLANETS.forEach(() => { planetPos.push(0, 0, 0); planetCol.push(1, 1, 1); });
  const planetGeo = new THREE.BufferGeometry();
  planetGeo.setAttribute('position', new THREE.Float32BufferAttribute(planetPos, 3));
  planetGeo.setAttribute('color', new THREE.Float32BufferAttribute(planetCol, 3));
  const planets = new THREE.Points(planetGeo, new THREE.PointsMaterial({
    size: 6, map: stars.material.map, vertexColors: true, transparent: true,
    depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false
  }));
  group.add(planets);
  planets.renderOrder = 3;

  /* world-aligned: horizon haze and light pollution never rotate with the sky.
     it hugs the horizon and stays thin: a tall haze band erases the low sky,
     and the low sky is exactly what a window looks at */
  const haze = new THREE.Mesh(
    new THREE.CylinderGeometry(SKY_R * 0.985, SKY_R * 0.99, 34, 64, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x1a2233, side: THREE.BackSide, transparent: true, opacity: 0.3,
      depthWrite: false, fog: false, toneMapped: false
    })
  );
  haze.position.y = 4;
  group.add(haze);
  haze.renderOrder = 1;

  const state = { lat: 40.7, lon: -74.0, alwaysNight: true, sunAlt: 0, lst: 0, phase: 0 };
  const m4 = new THREE.Matrix4();

  function paintMoon(phase) {
    const x = moonCanvas.getContext('2d');
    const S = 128;
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath(); x.arc(S / 2, S / 2, S * 0.34, 0, TAU); x.clip();
    x.fillStyle = '#f2eee2'; x.fillRect(0, 0, S, S);
    x.fillStyle = 'rgba(120,120,110,0.35)';
    const rand = rng(7);
    for (let i = 0; i < 22; i++) {
      x.beginPath();
      x.arc(S * (0.2 + rand() * 0.6), S * (0.2 + rand() * 0.6), 3 + rand() * 12, 0, TAU);
      x.fill();
    }
    /* the shadow: an ellipse sweeping across the disc */
    const k = Math.cos(TAU * phase);
    x.fillStyle = 'rgba(8,10,16,0.94)';
    x.beginPath();
    x.arc(S / 2, S / 2, S * 0.34, Math.PI / 2, -Math.PI / 2, phase > 0.5);
    x.ellipse(S / 2, S / 2, S * 0.34 * Math.abs(k), S * 0.34, 0, -Math.PI / 2, Math.PI / 2, k < 0);
    x.fill();
    x.restore();
    moonTex.needsUpdate = true;
  }

  let lastPhase = -1;

  function update(ms) {
    const lst = gmst(ms) + state.lon * D2R;
    state.lst = lst;
    const st = Math.sin(lst), ct = Math.cos(lst);
    const sl = Math.sin(state.lat * D2R), cl = Math.cos(state.lat * D2R);
    /* up and north, in textbook equatorial components (x = RA 0h, y = RA 6h,
       z = the north celestial pole) */
    const up = [ct * cl, st * cl, sl];
    const north = [-ct * sl, -st * sl, cl];
    /* The building's +Y is up and its +Z faces geographic north, so its +X
       faces west: three.js axes are right-handed, and a north-up east-right
       floor plan is a map seen from below. The row triple is therefore
       (west, up, north), which is a rotation; (east, up, north) would be a
       mirror image and would send the stars the wrong way round. */
    const west = [st, -ct, 0];
    /* re-expressed in the vault's frame, those three become the rows of the
       matrix that carries the whole sky into this room */
    const frame = (v) => [-v[0], v[2], v[1]];
    const e = frame(west), u = frame(up), nv = frame(north);
    m4.set(e[0], e[1], e[2], 0, u[0], u[1], u[2], 0, nv[0], nv[1], nv[2], 0, 0, 0, 0, 1);
    group.quaternion.setFromRotationMatrix(m4);
    /* the haze band belongs to the building, not to the sky: keep it upright */
    haze.quaternion.copy(group.quaternion).invert();

    /* sun: altitude drives the twilight, and the "always night" switch */
    const sun = eclipticToEquatorial(solarLongitude(ms), 0);
    const sv = eqToVec(sun.ra, sun.dec, 1);
    state.sunAlt = Math.asin(Math.max(-1, Math.min(1, sv[0] * u[0] + sv[1] * u[1] + sv[2] * u[2])));
    const night = state.alwaysNight || state.sunAlt < -6 * D2R;

    /* moon */
    const ml = moonLongitude(ms);
    const sunL = solarLongitude(ms);
    const phase = ((ml - sunL) % TAU + TAU) % TAU / TAU;
    if (Math.abs(phase - lastPhase) > 0.002) { paintMoon(phase); lastPhase = phase; }
    state.phase = phase;
    const mp = eclipticToEquatorial(ml, 3.5 * D2R * Math.sin(ml - sunL));
    const mv = eqToVec(mp.ra, mp.dec, SKY_R * 0.97);
    moon.position.set(mv[0], mv[1], mv[2]);
    moon.lookAt(0, 0, 0);
    const moonAlt = Math.asin(Math.max(-1, Math.min(1,
      (mv[0] * u[0] + mv[1] * u[1] + mv[2] * u[2]) / (SKY_R * 0.97))));
    /* where the moon actually is, in room axes, so the moonlight can follow it */
    state.moonDir = [e[0] * mv[0] + e[1] * mv[1] + e[2] * mv[2],
      u[0] * mv[0] + u[1] * mv[1] + u[2] * mv[2],
      nv[0] * mv[0] + nv[1] * mv[1] + nv[2] * mv[2]].map((v) => v / (SKY_R * 0.97));
    moon.visible = moonAlt > -6 * D2R && night;
    moon.material.opacity = night ? 0.95 : 0.15;

    /* planets */
    const days = julian(ms) - 2451545.0;
    const pp = planetGeo.attributes.position, pc = planetGeo.attributes.color;
    PLANETS.forEach(([name, years, epoch, i], k) => {
      const lam = ((days / (years * 365.25)) * TAU + epoch) % TAU;
      const e2 = eclipticToEquatorial(lam, 0);
      const v = eqToVec(e2.ra, e2.dec, SKY_R * 0.96);
      pp.setXYZ(k, v[0], v[1], v[2]);
      const vis = (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) > 0 && night ? 1 : 0;
      pc.setXYZ(k, vis, vis * 0.95, vis * 0.85);
    });
    pp.needsUpdate = true; pc.needsUpdate = true;

    stars.material.opacity = night ? 1 : 0.06;
    haze.material.color.setHex(night ? 0x1a2233 : 0x8fa8c8);
    haze.material.opacity = night ? 0.32 : 0.7;
    return state;
  }

  return { group, update, state, SKY_R };
}

export const SKY_PRESETS = [
  { id: 'us-east', label: 'USA — East', lat: 40.7, lon: -74.0, tz: 'America/New_York' },
  { id: 'us-central', label: 'USA — Central', lat: 41.9, lon: -87.6, tz: 'America/Chicago' },
  { id: 'us-west', label: 'USA — West', lat: 34.1, lon: -118.2, tz: 'America/Los_Angeles' },
  { id: 'eu-west', label: 'Europe — West', lat: 48.9, lon: 2.3, tz: 'Europe/Paris' },
  { id: 'eu-east', label: 'Europe — East', lat: 52.2, lon: 21.0, tz: 'Europe/Warsaw' },
  { id: 'oceania', label: 'Oceania', lat: -33.9, lon: 151.2, tz: 'Australia/Sydney' },
  { id: 'asia', label: 'Asia', lat: 35.7, lon: 139.7, tz: 'Asia/Tokyo' }
];
