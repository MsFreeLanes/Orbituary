/* ── materials ───────────────────────────────────────────────────────────
   Everything the building is faced with. No image files: each surface is
   painted on a canvas at boot, then used as a PBR map under a generated
   environment map. That keeps the whole museum one file and lets a room ask
   for "marble, repeated 4×3" without a texture atlas. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TAU = Math.PI * 2;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, x: c.getContext('2d') };
}

/* deterministic noise so two runs of the build look identical */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function grain(x, w, h, amount, seed) {
  const rand = rng(seed);
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
}

function marbleTexture(base, vein) {
  const W = 512, { c, x } = canvas(W, W);
  x.fillStyle = base; x.fillRect(0, 0, W, W);
  const rand = rng(7);
  for (let i = 0; i < 26; i++) {
    x.strokeStyle = vein;
    x.globalAlpha = 0.05 + rand() * 0.16;
    x.lineWidth = 0.6 + rand() * 2.4;
    x.beginPath();
    let px = rand() * W, py = rand() * W;
    x.moveTo(px, py);
    for (let k = 0; k < 5; k++) {
      const nx = px + (rand() - 0.5) * 260, ny = py + (rand() - 0.5) * 260;
      x.quadraticCurveTo(px + (rand() - 0.5) * 120, py + (rand() - 0.5) * 120, nx, ny);
      px = nx; py = ny;
    }
    x.stroke();
  }
  x.globalAlpha = 1;
  grain(x, W, W, 10, 11);
  return c;
}

function woodTexture(base, dark, light) {
  const W = 512, H = 512, { c, x } = canvas(W, H);
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  const rand = rng(23);
  for (let i = 0; i < 260; i++) {
    const y = rand() * H;
    x.strokeStyle = rand() > 0.5 ? dark : light;
    x.globalAlpha = 0.05 + rand() * 0.14;
    x.lineWidth = 0.5 + rand() * 2.2;
    x.beginPath();
    x.moveTo(0, y);
    for (let px = 0; px <= W; px += 32) x.lineTo(px, y + Math.sin(px * 0.02 + i) * (2 + rand() * 5));
    x.stroke();
  }
  x.globalAlpha = 1;
  grain(x, W, H, 12, 5);
  return c;
}

function concreteTexture(base, seed) {
  const W = 512, { c, x } = canvas(W, W);
  x.fillStyle = base; x.fillRect(0, 0, W, W);
  const rand = rng(seed);
  for (let i = 0; i < 90; i++) {
    const r = 20 + rand() * 120;
    const g = x.createRadialGradient(rand() * W, rand() * W, 0, rand() * W, rand() * W, r);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.02 + rand() * 0.05) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, W);
  }
  grain(x, W, W, 26, seed + 1);
  return c;
}

function terrazzoTexture(seed) {
  const W = 512, { c, x } = canvas(W, W);
  x.fillStyle = '#a8a39a'; x.fillRect(0, 0, W, W);
  const rand = rng(seed);
  const chips = ['#8d8a83', '#6b7078', '#8a7a6d', '#4a5058', '#b3ab99', '#7d8478'];
  for (let i = 0; i < 700; i++) {
    x.fillStyle = chips[(rand() * chips.length) | 0];
    x.globalAlpha = 0.4 + rand() * 0.45;
    const r = 1.2 + rand() * 4.6;
    x.beginPath();
    x.ellipse(rand() * W, rand() * W, r, r * (0.6 + rand() * 0.8), rand() * TAU, 0, TAU);
    x.fill();
  }
  x.globalAlpha = 1;
  grain(x, W, W, 8, seed + 3);
  return c;
}

function carpetTexture() {
  const W = 256, { c, x } = canvas(W, W);
  x.fillStyle = '#1b1a22'; x.fillRect(0, 0, W, W);
  grain(x, W, W, 46, 41);
  const rand = rng(43);
  for (let i = 0; i < 400; i++) {
    x.fillStyle = 'rgba(120,110,140,' + (rand() * 0.06) + ')';
    x.fillRect(rand() * W, rand() * W, 2, 2);
  }
  return c;
}

function brickTexture() {
  const W = 512, H = 512, { c, x } = canvas(W, H);
  x.fillStyle = '#3a2b28'; x.fillRect(0, 0, W, H);
  const rand = rng(61);
  const bw = 64, bh = 26;
  for (let row = 0; row * bh < H; row++) {
    const off = (row % 2) * bw / 2;
    for (let col = -1; col * bw < W + bw; col++) {
      const px = col * bw + off + 2, py = row * bh + 2;
      const t = rand();
      x.fillStyle = 'rgb(' + (74 + t * 30 | 0) + ',' + (58 + t * 22 | 0) + ',' + (52 + t * 18 | 0) + ')';
      x.fillRect(px, py, bw - 4, bh - 4);
    }
  }
  grain(x, W, H, 14, 67);
  return c;
}

function brushedTexture(base) {
  const W = 512, { c, x } = canvas(W, W);
  x.fillStyle = base; x.fillRect(0, 0, W, W);
  const rand = rng(83);
  for (let i = 0; i < 700; i++) {
    const y = rand() * W;
    x.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    x.lineWidth = rand() * 1.5;
    x.beginPath(); x.moveTo(0, y); x.lineTo(W, y + (rand() - 0.5) * 3); x.stroke();
  }
  return c;
}

/* The hull's skin is painted as the plate it is: a field of butt-jointed
   panels, a row of fasteners along every joint, and a tonal shift from panel
   to panel so the joints are not the only thing giving the surface scale.
   Without the joints a 40 m spoke reads as one smooth extrusion and the
   building goes back to looking like a model of a building. The joints are
   drawn at the tile's edges as well as inside it, so a wall that starts
   mid-panel still ends at a joint. */
function hullPlateTexture() {
  const W = 512, { c, x } = canvas(W, W);
  x.fillStyle = '#767b82'; x.fillRect(0, 0, W, W);
  const rand = rng(131);
  const cell = 128;
  for (let r = 0; r * cell < W; r++) {
    for (let col = 0; col * cell < W; col++) {
      const t = rand();
      x.fillStyle = 'rgb(' + (112 + t * 26 | 0) + ',' + (118 + t * 24 | 0) + ',' + (126 + t * 22 | 0) + ')';
      x.fillRect(col * cell + 3, r * cell + 3, cell - 6, cell - 6);
      /* one panel in five is a stencilled access plate, which is where a
         station's surface stops being decoration and starts being plumbing */
      if (rand() < 0.22) {
        x.strokeStyle = 'rgba(232,236,240,0.10)';
        x.lineWidth = 2;
        x.strokeRect(col * cell + 26, r * cell + 26, cell - 52, cell - 52);
      }
    }
  }
  /* the joints themselves, and the fasteners along them */
  for (let g = 0; g <= W; g += cell) {
    x.fillStyle = 'rgba(14,16,20,0.55)';
    x.fillRect(g - 2, 0, 4, W);
    x.fillRect(0, g - 2, W, 4);
    x.fillStyle = 'rgba(226,232,238,0.16)';
    for (let p = 12; p < W; p += 26) {
      x.beginPath(); x.arc(g, p, 2.1, 0, TAU); x.fill();
      x.beginPath(); x.arc(p, g, 2.1, 0, TAU); x.fill();
    }
  }
  /* brushed, the way every other metal face in this building is finished */
  for (let i = 0; i < 500; i++) {
    const y = rand() * W;
    x.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    x.lineWidth = rand() * 1.4;
    x.beginPath(); x.moveTo(0, y); x.lineTo(W, y + (rand() - 0.5) * 3); x.stroke();
  }
  grain(x, W, W, 14, 137);
  return c;
}

function panelTexture() {
  const W = 512, { c, x } = canvas(W, W);
  x.fillStyle = '#4a3524'; x.fillRect(0, 0, W, W);
  const rand = rng(97);
  for (let i = 0; i < 8; i++) {
    const px = i * 64 + 4;
    x.fillStyle = 'rgba(255,220,170,0.05)';
    x.fillRect(px, 4, 56, W - 8);
    x.strokeStyle = 'rgba(0,0,0,0.35)';
    x.lineWidth = 2;
    x.strokeRect(px, 4, 56, W - 8);
  }
  const inner = woodTexture('#000', '#000', '#000'); // grain only, blended below
  x.globalAlpha = 0.35;
  x.drawImage(inner, 0, 0);
  x.globalAlpha = 1;
  grain(x, W, W, 12, 101);
  return c;
}

const SPECS = {
  marble: { paint: () => marbleTexture('#b8b2a6', '#7d7968'), rough: 0.34, metal: 0.0, tint: 0xc3beb5 },
  marbleDark: { paint: () => marbleTexture('#4a4f56', '#6d747e'), rough: 0.30, metal: 0.0, tint: 0xbcc2ca },
  terrazzo: { paint: () => terrazzoTexture(5), rough: 0.42, metal: 0.0, tint: 0xbdb8b0 },
  concrete: { paint: () => concreteTexture('#8d8b86', 13), rough: 0.72, metal: 0.0, tint: 0xc8c4be },
  concreteDark: { paint: () => concreteTexture('#4b4d52', 17), rough: 0.78, metal: 0.0, tint: 0xcfd2d8 },
  plaster: { paint: () => concreteTexture('#ded9cf', 29), rough: 0.86, metal: 0.0, tint: 0xd8d4cc },
  plasterDark: { paint: () => concreteTexture('#2f3238', 31), rough: 0.88, metal: 0.0, tint: 0x9aa0aa },
  oak: { paint: () => woodTexture('#8a5f38', '#5c3d22', '#b98a55'), rough: 0.44, metal: 0.0, tint: 0xffffff },
  oakParquet: { paint: () => woodTexture('#6d4a2c', '#452c18', '#966a3d'), rough: 0.38, metal: 0.0, tint: 0xffffff },
  woodPanel: { paint: () => panelTexture(), rough: 0.42, metal: 0.0, tint: 0xffffff },
  brick: { paint: () => brickTexture(), rough: 0.82, metal: 0.0, tint: 0xb4aca8 },
  steel: { paint: () => brushedTexture('#8b9096'), rough: 0.30, metal: 0.85, tint: 0xdfe3e8 },
  /* the same brushed steel the lamps are made of, jointed into plates: the
     hull is not a new colour in this building, it is the old one built up.
     It runs far less metallic than the lamp shades, and that is not a style
     call: a metal face in three.js is lit almost entirely by the environment
     map, which this scene keeps at a tenth strength, and a hull that is only
     lit by the map is a hull that disappears against a night sky. Plate on a
     station is painted, and painted plate is a diffuse surface with a sheen. */
  hull: { paint: () => hullPlateTexture(), rough: 0.62, metal: 0.26, tint: 0xcfd4da },
  carpet: { paint: () => carpetTexture(), rough: 0.95, metal: 0.0, tint: 0xffffff },
  velvet: { paint: () => carpetTexture(), rough: 0.92, metal: 0.0, tint: 0x6a2a3a },
  gravel: { paint: () => concreteTexture('#4a4c46', 37), rough: 0.9, metal: 0.0, tint: 0x3a3e39 }
};

export function makeMaterials(renderer) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const cache = new Map();

  function textureFor(key) {
    if (cache.has(key)) return cache.get(key);
    const tex = new THREE.CanvasTexture(SPECS[key].paint());
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    cache.set(key, tex);
    return tex;
  }

  /* one material per (surface, tiling) pair — the tiling is what makes a
     512 px painting read as a 12 m wall rather than a stretched poster */
  const mats = new Map();
  function mat(key, repeatU = 1, repeatV = 1) {
    const id = key + '|' + repeatU + 'x' + repeatV;
    if (mats.has(id)) return mats.get(id);
    const spec = SPECS[key] || SPECS.plaster;
    const tex = textureFor(key).clone();
    tex.needsUpdate = true;
    tex.repeat.set(repeatU, repeatV);
    const m = new THREE.MeshStandardMaterial({
      map: tex,
      color: spec.tint,
      roughness: spec.rough,
      metalness: spec.metal,
      envMapIntensity: 0.14
    });
    mats.set(id, m);
    return m;
  }

  const plain = new Map();
  function solid(key, opts) {
    if (plain.has(key)) return plain.get(key);
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: key, roughness: 0.6, metalness: 0 }, opts || {}));
    plain.set(key, m);
    return m;
  }

  /* glass is meant to be nearly absent: a window exists to show the sky, and
     anything more opaque turns the wall's best feature into a grey mirror */
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xa8c4dd, roughness: 0.03, metalness: 0,
    transparent: true, opacity: 0.045, side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 0.25
  });

  /* The glazing you walk on is a different problem. In a wall, glass that is
     nearly absent is right; underfoot, the same pane is indistinguishable from
     a hole, and a hole 300 m deep in a museum floor is a claim the building
     has to be able to make from the edge of it. So the floor panes are the
     same physical material with the polish up and the opacity raised a little:
     at a shallow sight line Fresnel does the rest on its own, and the pane
     goes from clear near the middle of the well to a bright film near its
     rim, which is the way real glass behaves and the way a visitor reads it.
     The clearcoat is the hard specular that catches the pendant; it is one
     extra program for two meshes, not a light, so no shadow moves. */
  const floorGlass = new THREE.MeshPhysicalMaterial({
    color: 0x9fb8d2, roughness: 0.02, metalness: 0,
    transparent: true, opacity: 0.10, side: THREE.DoubleSide,
    depthWrite: false, clearcoat: 1.0, clearcoatRoughness: 0.04,
    envMapIntensity: 0.6
  });

  /* A reflection for the walking glazing, painted rather than reflected: the
     building has no mirror and no probe, and either would cost more than the
     effect is worth. This is one small canvas laid additively over the pane,
     brightest at the rim where the sight line is shallowest — the same
     gradient Fresnel is already drawing on the pane under it — with two soft
     smears in it for the lamps the room is throwing back. It is geometry, so
     it moves no shadow and recompiles nothing, and it is faint on purpose:
     0.08 of added luminance at its brightest, well under the bloom. */
  function sheenTexture() {
    const N = 256, { c, x } = canvas(N, N);
    x.clearRect(0, 0, N, N);
    const rim = x.createRadialGradient(N / 2, N / 2, N * 0.26, N / 2, N / 2, N / 2);
    rim.addColorStop(0, 'rgba(188,212,236,0)');
    rim.addColorStop(0.62, 'rgba(188,212,236,0.035)');
    rim.addColorStop(0.93, 'rgba(206,226,248,0.15)');
    rim.addColorStop(1, 'rgba(206,226,248,0)');
    x.fillStyle = rim;
    x.fillRect(0, 0, N, N);
    for (const [cx, cy, rx, ry, a] of [[0.33, 0.29, 0.22, 0.055, 0.13], [0.68, 0.63, 0.16, 0.045, 0.09]]) {
      x.save();
      x.translate(cx * N, cy * N);
      x.scale(rx / ry, 1);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, ry * N);
      g.addColorStop(0, 'rgba(255,246,228,' + a + ')');
      g.addColorStop(1, 'rgba(255,246,228,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(0, 0, ry * N, 0, TAU); x.fill();
      x.restore();
    }
    return c;
  }

  const glazingSheen = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(sheenTexture()),
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, opacity: 0.55
  });
  glazingSheen.map.colorSpace = THREE.SRGBColorSpace;

  return { mat, solid, glass, floorGlass, glazingSheen, textureFor, SPECS };
}

export function applyEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = env.texture;
  /* RoomEnvironment is a bright white studio, and its PMREM values run well
     above 1.0. At full strength it lit this museum by itself — every floor
     came back at 220/255 with the lamps contributing almost nothing. The map
     is here to give glass and metal something to reflect, so it runs at a
     tenth strength and the lamps do the actual lighting. */
  scene.environmentIntensity = 0.1;
  pmrem.dispose();
  return env.texture;
}
