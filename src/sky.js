/* ── sky ─────────────────────────────────────────────────────────────────
   A sky you can set your watch by. One catalogue in equatorial coordinates,
   one quaternion per frame that turns the celestial sphere into this room's
   up-and-north, and the windows do the rest. Change the latitude and the
   longitude dials and the whole vault swings over: the same building, a
   different hemisphere.

   The bright stars are real (J2000 RA/Dec and magnitude). The faint
   population is generated — five thousand points weighted towards the
   galactic plane, which is what makes the Milky Way read as a band rather
   than as confetti.

   The same arithmetic answers a second question, for lighting.js rather than
   for the windows: where the sun actually is, in the building's own axes.
   That is the only sun the museum has — the key light is hung off it, so a
   new region or a new hour moves the shadows down the corridors with it.

   And because the museum is a station, the vault owes one more body: the
   planet itself. The dial is the sky above one of seven regions and the
   building floats over that region's ground track, so the region's zenith is
   the building's +Y and Earth hangs on the -Y axis — always below whichever
   region the card names. Its terminator is swept by the same real sun. */
import * as THREE from 'three';
import { S } from './scale.js';

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

/* ── Earth ───────────────────────────────────────────────────────────────
   The planet is painted here, not downloaded: the one thing that could
   leave the station with no Earth is a texture that fails to arrive. The
   day map — ocean, land, the lights of the inhabited coasts, banded cloud —
   is painted once from a fixed seed, and the terminator is swept over it by
   the real sun the way the moon's phase is.

   It is painted as *fields*, not as shapes. Every coast and every cloud edge
   in a world seen from orbit is a threshold crossing of something rough, and
   the only way to get an edge that stops being interesting when you are far
   from it is to let the roughness decide where it is. The first version of
   this map drew continents as closed walks and cloud as arcs, and at 300 m
   off the deck they read exactly as what they were: a pen, a steady hand, and
   forty-six spirals. Nothing here is drawn. Three noise fields are sampled
   per texel and thresholded, and the sea, the shore, the forest, the dust and
   the weather are what the thresholds say.

   Seen from above the ground track, the planet is a disc, not a globe: the
   terminator projects to an ellipse whose narrow axis is r·|sin(altitude)|,
   a line across the middle when the sun is on the region's horizon and the
   limb itself when the sun is at its zenith. */
const EARTH_S = 512;

/* value noise on an integer lattice: one hash per lattice corner, so a field
   can be rebuilt exactly from its seed and costs nothing to look up */
function lattice(seed) {
  return (i, j) => {
    let n = (Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1)) | 0;
    n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d);
    n = Math.imul(n ^ (n >>> 12), 0x297a2d39);
    return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
  };
}

/* the same noise summed over octaves, each half the width of the last.
   `cells` is the number of lattice cells across the map at the first octave,
   which is the only unit that means anything here: a field is judged by how
   many features fit on the disc, not by how far apart its corners are. One
   octave is a field of blobs; three is a coastline with inlets, or a cloud
   sheet with fringes — the difference between weather and a shape. */
function fbmField(size, cells, octaves, seed) {
  const a = new Float32Array(size * size);
  const noise = lattice(seed);
  let amp = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const step = size / (cells * (1 << o));   // pixels per lattice cell
    const inv = 1 / step;
    for (let j = 0; j < size; j++) {
      const y = j * inv, j0 = Math.floor(y), ty = y - j0, sy = ty * ty * (3 - 2 * ty);
      const row = j * size;
      for (let i = 0; i < size; i++) {
        const x = i * inv, i0 = Math.floor(x), tx = x - i0, sx = tx * tx * (3 - 2 * tx);
        const n00 = noise(i0, j0), n10 = noise(i0 + 1, j0);
        const n01 = noise(i0, j0 + 1), n11 = noise(i0 + 1, j0 + 1);
        a[row + i] += amp * (n00 + (n10 - n00) * sx + (n01 - n00) * sy + (n00 - n10 - n01 + n11) * sx * sy);
      }
    }
    norm += amp; amp *= 0.5;
  }
  for (let k = 0; k < a.length; k++) a[k] /= norm;
  return a;
}

/* value noise summed over octaves is heavily damped: the octaves average each
   other out and what comes back sits in a band a twentieth as wide as it
   looks. Stretched back around its middle, so a threshold set at the middle
   of the range is a threshold at the middle of the field. */
function contrast(a, k) {
  for (let i = 0; i < a.length; i++) a[i] = 0.5 + (a[i] - 0.5) * k;
  return a;
}

/* read a field at fractional pixel coordinates, clamped at the border */
function atField(a, size, u, v) {
  const i0 = Math.max(0, Math.min(size - 1, Math.floor(u)));
  const j0 = Math.max(0, Math.min(size - 1, Math.floor(v)));
  const i1 = Math.min(size - 1, i0 + 1), j1 = Math.min(size - 1, j0 + 1);
  const sx = Math.max(0, Math.min(1, u - i0)), sy = Math.max(0, Math.min(1, v - j0));
  const r0 = a[j0 * size + i0] + (a[j0 * size + i1] - a[j0 * size + i0]) * sx;
  const r1 = a[j1 * size + i0] + (a[j1 * size + i1] - a[j1 * size + i0]) * sx;
  return r0 + (r1 - r0) * sy;
}

/* smoothstep as a threshold: this is the soft edge. The band it crosses
   over is a few texels wide, which is what a coastline or a cloud front
   looks like from orbit — a gradient, not a line. */
const soft = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function paintEarthBase(cv) {
  const x = cv.getContext('2d');
  const C = EARTH_S, c = C / 2, r = C * 0.47;
  const rand = rng(20261113);
  /* the warp is a pair of slow fields, sampled at quarter resolution: it
     moves where each texel reads the land and the cloud from, which is what
     breaks value noise's cells into peninsulas and fronts. It is kept slow
     and shallow on purpose. Warping by more than the wavelength of the
     finest octave shears that octave into filaments, and filaments at this
     scale are the white spiral doodles the first version of this map was
     accused of — a different pen stroke, the same complaint. */
  const QS = C / 4;
  const warpX = fbmField(QS, 1.6, 2, 5150);
  const warpY = fbmField(QS, 1.6, 2, 6260);
  /* the cell counts are set by how much of this map is ever on screen: the
     well shows the middle three quarters of the disc's radius at about a
     pixel and a half to the texel, so a feature three cells across the disc
     is a continent and one sixteen cells across is a weather system. Three
     octaves, and the finest of them is thirty-odd texels; anything finer is
     the blur at the end, not the field. */
  const elev = contrast(fbmField(C, 3, 4, 4471), 1.7);
  const bio = contrast(fbmField(C, 6, 3, 9007), 1.7);
  const cloud = contrast(fbmField(C, 4, 4, 1223), 2.6);
  const img = x.createImageData(C, C);
  const d = img.data;
  const coasts = [];
  for (let j = 0; j < C; j++) {
    const ny = (j + 0.5 - c) / r;
    for (let i = 0; i < C; i++) {
      const k = j * C + i, p = k * 4;
      const nx = (i + 0.5 - c) / r;
      const dd = Math.sqrt(nx * nx + ny * ny);
      const u = i + (atField(warpX, QS, i / 4, j / 4) - 0.5) * 15;
      const v = j + (atField(warpY, QS, i / 4, j / 4) - 0.5) * 15;
      const e = atField(elev, C, u, v);
      /* ocean: darker the further the field falls below the shore, paler over
         the shelf, so the sea has depth in it rather than a colour */
      const deep = Math.max(0, Math.min(1, (0.50 - e) * 2.0));
      let R = 38 - deep * 20, G = 88 - deep * 42, Bb = 126 - deep * 56;
      /* land: the elevation field crossed over a band thirteen texels wide,
         so a coast is a gradient a hundred kilometres deep and never a
         stroke. Above the shore the colour is not one colour: forest and dust
         from a slower field, and upland paler and drier as the field climbs,
         which is what stops a continent reading as a flat tan blob. */
      const land = soft(0.47, 0.60, e);
      if (land > 0) {
        const b = atField(bio, C, u, v);
        const forest = soft(0.38, 0.66, b);
        const high = soft(0.575, 0.66, e);
        R += (130 - forest * 78 + high * 46 - R) * land;
        G += (112 - forest * 26 + high * 40 - G) * land;
        Bb += (78 - forest * 26 + high * 36 - Bb) * land;
      }
      /* cloud: the same kind of field, thresholded against a band that runs
         across the disc, so the sheet organises into belts and clear gaps.
         The crossing is a fifth of the field's whole range wide, which is
         what makes the fronts soft and the masses irregular instead of
         cellular. The colour it crosses *to* is a cool grey, not a white, and
         that is a threshold question rather than a taste one: the high pass
         takes a whole texel once it is over the line, not the part of it above
         the line, so the 0.80 of (238,243,249) this used to top out at — 0.75
         of linear luminance, comfortably under the 1.30 the station used to
         run — is now a cloud sheet sitting a quarter of a point over 0.70 and
         glowing with the same authority as a lamp. Held to 0.63 at the crest,
         the sea underneath still reads a fifth as bright against it, which is
         all the contrast a planet needs and none of the bloom. */
      const thr = 0.47 + 0.09 * Math.cos(ny * 3.6 + 0.9);
      const cl = atField(cloud, C, u, v);
      const ca = soft(thr, thr + 0.16, cl) * 0.74;
      R += (206 - R) * ca; G += (214 - G) * ca; Bb += (226 - Bb) * ca;
      /* and the air standing off the limb: at the edge of a world the last
         few hundred kilometres of it are what you are looking through */
      const haze = soft(0.72, 1.0, dd) * 0.30;
      d[p] = R + (152 - R) * haze;
      d[p + 1] = G + (180 - G) * haze;
      d[p + 2] = Bb + (216 - Bb) * haze;
      d[p + 3] = 255;
      if (land > 0.15 && land < 0.55 && rand() < 0.0011) coasts.push([i, j]);
    }
  }
  x.putImageData(img, 0, 0);
  /* the lights of the inhabited coasts, and they are painted soft: a hard
     pixel at this size is a dead pixel, and a city from orbit is a bloom of
     them rather than a point. They go in the shore band, which is where the
     people are. */
  for (const [i, j] of coasts) {
    const rad = 1.6 + rand() * 2.8;
    const g = x.createRadialGradient(i, j, 0, i, j, rad);
    g.addColorStop(0, 'rgba(255,206,140,0.50)');
    g.addColorStop(0.45, 'rgba(255,198,132,0.22)');
    g.addColorStop(1, 'rgba(255,190,120,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(i, j, rad, 0, TAU); x.fill();
  }
  /* and one blur over the whole map. The fields are smooth but every one of
     them is read through a threshold, and a threshold is where a smooth
     field grows an edge; a texel and a half of blur is the distance at which
     the atmosphere, the optics and the eye would all have taken that edge
     off anyway. */
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = C;
  const t2 = tmp.getContext('2d');
  t2.drawImage(cv, 0, 0);
  x.clearRect(0, 0, C, C);
  x.filter = 'blur(1.1px)';
  x.drawImage(tmp, 0, 0);
  x.filter = 'none';
}

/* the atmospheric limb: one thin ring of blue standing off the edge of the
   disc. It is a gradient on a disc rather than geometry because the whole
   point is that it is thinner than any tube that would still read at this
   distance — and it has to stay under the bloom threshold, or the planet
   gets a halo the size of the corridor. */
function limbTexture() {
  const N = 256, c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(N / 2, N / 2, N * 0.4, N / 2, N / 2, N / 2);
  const edge = 1 - S.EARTH_LIMB / (S.EARTH_R + S.EARTH_LIMB);
  g.addColorStop(0, 'rgba(120,170,235,0)');
  g.addColorStop(edge - 0.004, 'rgba(120,170,235,0)');
  g.addColorStop(edge + 0.002, 'rgba(150,196,255,0.5)');
  g.addColorStop(1, 'rgba(120,170,235,0)');
  x.fillStyle = g; x.fillRect(0, 0, N, N);
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
  /* the field is additive, and its brightest point — Sirius, at 1.33 of linear
     luminance — is knowingly over the bloom threshold. A star is the one
     fitting in this building that is meant to glow: the pass spends its energy
     over the twelve pixels of a point and buys the halo that makes a star read
     as a star rather than as a dead pixel, and it cannot fog a photograph
     because there is no area to fog. The bodies that had to come under 0.70
     are the ones with an area — the planet, and the moon. */
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 3.6, map: dotTexture(), vertexColors: true, transparent: true,
    depthWrite: false, sizeAttenuation: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false
  }));
  group.add(stars);
  stars.renderOrder = 2;

  /* the moon: a disc painted for tonight's phase */
  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = moonCanvas.height = 1024;
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(11, 11),
    new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  moon.visible = false;
  group.add(moon);
  moon.renderOrder = 4;

  /* planets are points too, brighter and steadier than the field — and over
     the threshold for the same reason: 0.94 at Venus, over thirty pixels,
     where the glow is the whole of the effect and there is no area to spill */
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

  /* Earth, hung at the building's nadir. It is a child of the vault group
     only because main.js adds one object to the scene and that file is not
     here to be rewritten; like the haze it counter-rotates every frame, so
     the stars ride the vault and the planet stays on the -Y axis. It is
     opaque and it writes depth, and its renderOrder says draw it before the
     vault — that depth is what keeps the vault's inside face from painting
     over the disc, and what lets the additive star field depth-test itself
     out behind the planet without the field's own treatment changing at all.
     fog: false for the same reason the stars have it: the scene's fog is
     museum air, and at 300 m it would erase the planet. toneMapped stays on:
     the disc is painted, not lit, so the pass reads its paint at face value:
     the cloud crest is held at 0.63 of linear luminance, under the 0.70 the
      pass now cuts at, so the planet lights the room rather than blowing the
      middle of the photograph out. */
  const earthBase = document.createElement('canvas');
  earthBase.width = earthBase.height = EARTH_S;
  paintEarthBase(earthBase);
  const earthCanvas = document.createElement('canvas');
  earthCanvas.width = earthCanvas.height = EARTH_S;
  const earthCtx = earthCanvas.getContext('2d');
  const earthTex = new THREE.CanvasTexture(earthCanvas);
  earthTex.colorSpace = THREE.SRGBColorSpace;
  const earthGeo = new THREE.CircleGeometry(S.EARTH_R, 96);
  earthGeo.rotateX(-Math.PI / 2);            // face the station: +Y
  const earth = new THREE.Mesh(earthGeo,
    new THREE.MeshBasicMaterial({ map: earthTex, fog: false }));
  earth.renderOrder = -2;
  group.add(earth);

  const limbGeo = new THREE.CircleGeometry(S.EARTH_R + S.EARTH_LIMB, 96);
  limbGeo.rotateX(-Math.PI / 2);
  const limb = new THREE.Mesh(limbGeo, new THREE.MeshBasicMaterial({
    map: limbTexture(), transparent: true, depthWrite: false, fog: false
  }));
  limb.renderOrder = -1;
  group.add(limb);

  /* sweep the terminator: the night side is the half-disc away from the sun
     plus or minus the projected terminator ellipse, exactly as the moon's
     phase is painted, with the sun's bearing under the station turning the
     whole thing round the disc. */
  function paintEarth(alt, sunAz) {
    const C = EARTH_S, c = C / 2, r = C * 0.47, k = Math.sin(alt);
    earthCtx.clearRect(0, 0, C, C);
    earthCtx.save();
    earthCtx.beginPath(); earthCtx.arc(c, c, r, 0, TAU); earthCtx.clip();
    earthCtx.drawImage(earthBase, 0, 0);
    if (k < 0.995) {
      earthCtx.save();
      earthCtx.translate(c, c);
      earthCtx.rotate(sunAz + Math.PI);      // +x now points away from the sun
      /* the terminator is the one edge on this map that used to be a drawn
         line, and it is the one edge that is not: an atmosphere's worth of
         scattering lies across it, so the night is blurred into the day
         rather than butted against it */
      earthCtx.filter = 'blur(9px)';
      earthCtx.fillStyle = 'rgba(5,8,15,0.94)';
      earthCtx.beginPath();
      earthCtx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
      earthCtx.ellipse(0, 0, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
      earthCtx.fill();
      earthCtx.filter = 'none';
      earthCtx.restore();
    }
    earthCtx.restore();
    earthTex.needsUpdate = true;
  }
  paintEarth(0, 0);

  const state = { lat: 40.7, lon: -74.0, alwaysNight: true, sunAlt: 0, sunDir: null, lst: 0, phase: 0,
    earthDir: [0, -1, 0] };
  const m4 = new THREE.Matrix4();
  const iq = new THREE.Quaternion();
  let lastEarthAlt = Number.NaN, lastEarthAz = Number.NaN;

  /* The maria, at their real selenographic positions: longitude east of the
     central meridian, latitude, and an angular radius in degrees. A photograph
     cannot go into a file that has to double-click and work on a train, so the
     moon is drawn — but it is drawn as the thing itself, not as twenty-two grey
     blobs scattered on a 128 px disc, which is what it used to be. */
  const MARIA = [
    [34.3, 32.8, 30], [17.5, 28.0, 26], [59.1, 17.0, 15], [31.4, 8.5, 20],
    [51.7, -7.8, 22], [35.8, -15.2, 13], [0.6, -21.3, 15], [-38.6, -24.4, 16],
    [-57.0, 18.0, 40], [-23.3, -10.0, 11], [30.8, 7.5, 10], [60.0, 56.0, 20],
    [-15.0, 40.0, 13], [45.0, 40.0, 12], [-70.0, -5.0, 18]
  ];
  /* Tycho and Copernicus: the two that throw rays across the near side */
  const RAYS = [[-11.2, -43.0, 1.0], [-20.1, 9.7, 0.5]];

  /* orthographic projection of the near side: a point at selenographic (lon,
     lat) lands at (cos lat · sin lon, sin lat) on the unit disc, and is
     foreshortened by cos lat · cos lat... by cos lat · cos lon as it goes to
     the limb. Everything on the moon is drawn through this, so a mare near the
     edge is an ellipse and not a circle. */
  function moonPlace(lon, lat) {
    const l = lon * D2R, b = lat * D2R;
    const inc = Math.cos(b) * Math.cos(l);
    return { px: Math.cos(b) * Math.sin(l), py: -Math.sin(b), inc };
  }
  function moonSpot(x, C, R, p, rr, squash) {
    if (p.inc <= 0.03) return;
    const ang = Math.atan2(p.py, p.px);
    x.save();
    x.translate(C + p.px * R, C + p.py * R);
    x.rotate(ang);
    x.scale(squash === undefined ? p.inc : squash, 1);
    x.beginPath(); x.arc(0, 0, rr, 0, TAU); x.fill();
    x.restore();
  }
  /* the same, stroked: what a crater actually is at this scale */
  function moonRing(x, C, R, p, rr) {
    if (p.inc <= 0.03) return;
    const ang = Math.atan2(p.py, p.px);
    x.save();
    x.translate(C + p.px * R, C + p.py * R);
    x.rotate(ang);
    x.scale(p.inc, 1);
    x.beginPath(); x.arc(0, 0, rr, 0, TAU); x.stroke();
    x.restore();
  }

  function paintMoon(phase) {
    const x = moonCanvas.getContext('2d');
    const S = moonCanvas.width, C = S / 2, R = S * 0.34;
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath(); x.arc(C, C, R, 0, TAU); x.clip();
    /* moon white, and no longer quite white. The disc is unlit, so the bloom
       pass reads it at exactly what the paint is: this used to sit at 0.86 of
       linear luminance, which the 1.30 threshold the station used to run let
       through and the 0.70 it runs now turns into a lamp the size of a window.
       0.69 before the material's own opacity, and it is still the second
       brightest thing in the night sky after the planet's own clouds. */
    x.fillStyle = '#dcd9cf'; x.fillRect(0, 0, S, S);
    const rand = rng(7);
    /* weather in the highlands before anything sits on them */
    for (let i = 0; i < 120; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * R * 0.98;
      x.globalAlpha = 0.025 + rand() * 0.03;
      x.fillStyle = rand() > 0.45 ? '#cfccc2' : '#e8e5db';
      x.beginPath();
      x.arc(C + Math.cos(a) * d, C + Math.sin(a) * d, R * (0.03 + rand() * 0.11), 0, TAU);
      x.fill();
    }
    x.globalAlpha = 1;
    /* the maria: dark, low-albedo plains. Each one is a handful of overlapping
       blobs rather than one disc — the real ones have irregular, soft edges, and
       a single circle at 40° across is the thing that made this read as a
       diagram rather than a surface. */
    x.fillStyle = 'rgba(118,119,116,0.26)';
    MARIA.forEach(([lon, lat, rho]) => {
      const base = R * Math.sin(rho * D2R) * 0.9;
      for (let k = 0; k < 5; k++) {
        const q = moonPlace(lon + (rand() - 0.5) * rho * 1.1, lat + (rand() - 0.5) * rho * 0.9);
        moonSpot(x, C, R, q, base * (0.5 + rand() * 0.45));
      }
    });
    /* the crater field. A point is picked on the disc and the projection is
       inverted to find where on the moon it is, which keeps every crater on the
       near side and squashes the ones near the limb for free. A crater at this
       scale is a rim, not a disc: the first version filled them and the result
       read as grey confetti scattered on the surface. */
    for (let i = 0; i < 420; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * 0.98;
      const px = Math.cos(a) * d, py = Math.sin(a) * d;
      const b = Math.asin(Math.max(-1, Math.min(1, -py)));
      const cb = Math.cos(b);
      const sl = Math.max(-1, Math.min(1, px / Math.max(cb, 1e-4)));
      const inc = cb * Math.cos(Math.asin(sl));
      const rr = (0.8 + Math.pow(rand(), 3.4) * 17) * (S / 1024);
      const p = { px, py, inc };
      x.strokeStyle = 'rgba(250,248,241,0.30)';
      x.lineWidth = Math.max(0.6, rr * 0.34);
      moonRing(x, C, R, p, rr);
      if (rr > 9) {
        x.fillStyle = 'rgba(126,124,118,0.09)';
        moonSpot(x, C, R, p, rr * 0.72);
      }
      if (rand() > 0.94) {
        x.fillStyle = 'rgba(252,251,246,0.55)';
        moonSpot(x, C, R, p, rr * 0.5);
      }
    }
    /* ray systems: bright streaks thrown out of the two young craters */
    RAYS.forEach(([lon, lat, strength]) => {
      const p = moonPlace(lon, lat);
      if (p.inc <= 0.05) return;
      const cx = C + p.px * R, cy = C + p.py * R;
      x.strokeStyle = 'rgba(248,246,238,' + (0.05 * strength).toFixed(3) + ')';
      x.lineCap = 'round';
      for (let i = 0; i < 90; i++) {
        const a = rand() * TAU, len = R * (0.18 + rand() * 0.62) * strength;
        const w = 1 + rand() * 5;
        x.lineWidth = w * (S / 1024);
        x.beginPath();
        x.moveTo(cx + Math.cos(a) * R * 0.02, cy + Math.sin(a) * R * 0.02);
        x.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        x.stroke();
      }
      x.fillStyle = 'rgba(250,248,242,0.5)';
      x.beginPath(); x.arc(cx, cy, R * 0.018 * strength, 0, TAU); x.fill();
    });
    /* the shadow: an ellipse sweeping across the disc, with a soft edge so the
       terminator is a place rather than a cut */
    const k = Math.cos(TAU * phase);
    const shade = (w, alpha) => {
      x.fillStyle = 'rgba(8,10,16,' + alpha + ')';
      x.beginPath();
      x.arc(C, C, R, Math.PI / 2, -Math.PI / 2, phase > 0.5);
      x.ellipse(C, C, Math.max(0, R * Math.abs(k) + w), R + 2, 0, -Math.PI / 2, Math.PI / 2, k < 0);
      x.fill();
    };
    shade(R * 0.035, 0.30);
    shade(R * 0.018, 0.45);
    shade(0, 0.94);
    /* earthshine. The planet is four times the diameter of the moon and thirty
       times the brightness in that sky, and what comes back off it is enough to
       hold the outline of the unlit part of the disc. Without it the crescent
       hangs in the dark with no edge to it. */
    x.globalAlpha = 0.05;
    x.fillStyle = '#9fb4c8';
    x.beginPath(); x.arc(C, C, R, 0, TAU); x.fill();
    x.globalAlpha = 1;
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
    /* and the same direction in room axes, so the hull's key light can be hung
       off it. this is the bearing that matters after the museum became a
       station: it goes the whole way round in a day, while a ground observer
       only ever watches the half of it that is above their horizon. */
    state.sunDir = [e[0] * sv[0] + e[1] * sv[1] + e[2] * sv[2],
      u[0] * sv[0] + u[1] * sv[1] + u[2] * sv[2],
      nv[0] * sv[0] + nv[1] * sv[1] + nv[2] * sv[2]];
    /* Earth: the nadir of the ground track. The frame above maps the region's
       zenith onto the building's +Y, so the planet under the region is under
       the station on -Y — the disc counter-rotates off the group's inverse
       quaternion, exactly as the haze does, and stays there whatever the
       dial says. The terminator turns with the sun's bearing under the
       station: on the map +x runs west and +y runs south, so the anti-sun
       direction is atan2(-z, x) + pi in room axes. */
    iq.copy(group.quaternion).invert();
    earth.quaternion.copy(iq);
    limb.quaternion.copy(iq);
    earth.position.set(0, -S.EARTH_DROP, 0).applyQuaternion(iq);
    limb.position.copy(earth.position);
    const earthAz = Math.atan2(-state.sunDir[2], state.sunDir[0]);
    if (Math.abs(earthAz - lastEarthAz) > 0.01 || Math.abs(state.sunAlt - lastEarthAlt) > 0.01) {
      paintEarth(state.sunAlt, earthAz);
      lastEarthAz = earthAz;
      lastEarthAlt = state.sunAlt;
    }
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
    /* where the moon actually is, in room axes. nothing is lit off it any
       more — the sun is the key light now — but the disc in the window and the
       light that once came through it are the same answer, and the phase the
       dial reports comes from it */
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

  /* the vault should be right the moment it is added, not one frame later:
     the first update also puts Earth on its nadir, and a disc that has not
     been put there yet is a planet sitting in the middle of the rotunda */
  update(Date.now());

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
