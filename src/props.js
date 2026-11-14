/* ── props ───────────────────────────────────────────────────────────────
   Phase 3 of the plan: the rooms stop being boxes and start being rooms.

   Furniture is dozens of small boxes, cylinders and spheres. Added as meshes
   that is a draw call each, and twelve rooms of furniture would more than
   double the cost of the building. So a room's props are accumulated per
   material and merged into one mesh at the end: a bookcase is one draw call,
   a brass rail is one draw call, a whole room costs five or six.

   Everything is placed against the side walls or beside the doorway, because
   the middle of the room belongs to the plinths — and every long prop also
   registers a line of blocker circles, so you walk around the server rack
   instead of through it. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S } from './scale.js';

const TAU = Math.PI * 2;

/* the prop palette. names, not hexes, so a room reads as a set of materials
   and the merge buckets stay small. */
const PALETTE = {
  /* woods */
  oak: { hex: 0x6d4a2c, rough: 0.5 },
  oakLight: { hex: 0x8a5f38, rough: 0.45 },
  walnut: { hex: 0x3f2b1b, rough: 0.42 },
  crate: { hex: 0x7d6142, rough: 0.8 },
  /* metals */
  steel: { hex: 0x8b9096, rough: 0.3, metal: 0.85 },
  darkSteel: { hex: 0x2b2f36, rough: 0.45, metal: 0.7 },
  iron: { hex: 0x3a3d42, rough: 0.72, metal: 0.45 },
  brass: { hex: 0xb9a06a, rough: 0.3, metal: 0.85 },
  /* stone and cloth */
  marbleSlab: { hex: 0xc3beb5, rough: 0.28 },
  cloth: { hex: 0x5f2432, rough: 0.95 },
  dust: { hex: 0xb4ae9f, rough: 0.96, flat: true },
  paper: { hex: 0xd6cfc0, rough: 0.9 },
  canvasWhite: { hex: 0xdedbd2, rough: 0.9, emis: 0x1a1a18, ei: 0.35 },
  /* dark things */
  case: { hex: 0x191c22, rough: 0.55, metal: 0.2 },
  rubber: { hex: 0x14161a, rough: 0.9 },
  /* books and oddballs */
  bookRed: { hex: 0x6e2f2c, rough: 0.85 },
  bookGreen: { hex: 0x33513c, rough: 0.85 },
  bookBlue: { hex: 0x2f4260, rough: 0.85 },
  greenGlass: { hex: 0x2f6b4a, rough: 0.25, metal: 0.05, glass: 0.55 },
  /* light. these are all above the bloom threshold, so a prop that glows
     glows; the numbers are as low as they can go and still do that. The
     twelve-room building had one lamp per room and could afford a bright
     screen; the station has a lamp in every bay and the same value blooms a
     2 cm neon strip into a foot-wide blob. */
  crt: { hex: 0x0d1116, rough: 0.28, metal: 0.1, emis: 0x2f5f8f, ei: 0.8 },
  screenGreen: { hex: 0x0a1210, rough: 0.3, emis: 0x35d08a, ei: 0.85 },
  neonCyan: { hex: 0x0d1418, rough: 0.4, emis: 0x4fd0ff, ei: 1.25 },
  neonMagenta: { hex: 0x140d18, rough: 0.4, emis: 0xff5fae, ei: 1.1 },
  warmBulb: { hex: 0x1a1512, rough: 0.5, emis: 0xffc27a, ei: 2.2 },
  coldStrip: { hex: 0x0e131a, rough: 0.4, emis: 0x8fc4ff, ei: 1.0 },
  led: { hex: 0x0a0d10, rough: 0.4, emis: 0x54e08a, ei: 1.3 },
  ledAmber: { hex: 0x0a0d10, rough: 0.4, emis: 0xffb347, ei: 1.2 },
  lattice: { hex: 0x10161d, rough: 0.35, metal: 0.6, emis: 0x27435f, ei: 0.6 },
  glass: { glass: true }
};

const matCache = new Map();
function matFor(name) {
  if (matCache.has(name)) return matCache.get(name);
  const p = PALETTE[name];
  const m = new THREE.MeshStandardMaterial({
    color: p.hex,
    roughness: p.rough !== undefined ? p.rough : 0.6,
    metalness: p.metal !== undefined ? p.metal : 0,
    emissive: p.emis || 0x000000,
    emissiveIntensity: p.ei !== undefined ? p.ei : 1,
    flatShading: !!p.flat
  });
  if (p.glass) {
    m.transparent = true;
    m.opacity = typeof p.glass === 'number' ? p.glass : 0.5;
    m.depthWrite = false;
    m.side = THREE.DoubleSide;
  }
  m.envMapIntensity = 0.4;
  matCache.set(name, m);
  return m;
}

/* local room coordinates → world. the room group sits at the doorway with its
   +Z running into the room, so this is the same transform rig.js uses. */
function toWorld(room, x, z) {
  const e = room.entry || { x: 0, z: 0 };
  const a = room.angle || 0;
  const c = Math.cos(a), s = Math.sin(a);
  return { x: e.x + x * c + z * s, z: e.z - x * s + z * c };
}

function makeKit(M, room, plan) {
  const buckets = new Map();
  const bucket = (name) => {
    let a = buckets.get(name);
    if (!a) buckets.set(name, a = []);
    return a;
  };
  const K = {
    put(name, geo, x, y, z, rx, ry, rz) {
      if (rz) geo.rotateZ(rz);
      if (rx) geo.rotateX(rx);
      if (ry) geo.rotateY(ry);
      geo.translate(x, y, z);
      bucket(name).push(geo);
      /* one box per piece, not one per merge bucket: three crate stacks welded
         into one buffer still leave three footprints, and a check that tests
         the union of them reports half the room as buried */
      geo.computeBoundingBox();
      if (geo.boundingBox) {
        const b = geo.boundingBox;
        (room._propBoxes = room._propBoxes || [])
          .push({ name, min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] });
      }
      return K;
    },
    box(name, w, h, d, x, y, z, rx, ry, rz) {
      return K.put(name, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
    },
    /* a slab lying flat: length along z, width along x */
    slab(name, w, t, len, x, y, z) {
      return K.box(name, w, t, len, x, y, z);
    },
    cyl(name, rt, rb, h, x, y, z, seg, rx, ry, rz) {
      return K.put(name, new THREE.CylinderGeometry(rt, rb, h, seg || 14), x, y, z, rx, ry, rz);
    },
    /* a horizontal rod. a cylinder stands along +Y, so it takes a quarter turn
       about X to lie along z and about Z to lie along x — the other way round
       from what the axis names sound like, which is how the velvet rope in the
       shop ended up strung across the room instead of between its two posts. */
    rod(name, r, len, x, y, z, axis, seg) {
      const rx = axis === 'z' ? Math.PI / 2 : 0;
      const rz = axis === 'x' ? Math.PI / 2 : 0;
      return K.cyl(name, r, r, len, x, y, z, seg || 10, rx, 0, rz);
    },
    ball(name, r, x, y, z, seg) {
      return K.put(name, new THREE.SphereGeometry(r, seg || 12, Math.max(6, (seg || 12) >> 1)), x, y, z);
    },
    ring(name, R, r, x, y, z, rx, ry, seg) {
      return K.put(name, new THREE.TorusGeometry(R, r, 6, seg || 18), x, y, z,
        rx === undefined ? Math.PI / 2 : rx, ry, 0);
    },
    plane(name, w, h, x, y, z, ry) {
      return K.put(name, new THREE.PlaneGeometry(w, h), x, y, z, 0, ry || 0, 0);
    },
    /* build one object from parts in its own little frame, then drop it at
       (x, z) turned by ry. this is how an easel, a robot or a pair of scales
       gets written once and placed twice. */
    assemble(x, z, ry, parts) {
      const c = Math.cos(ry), s = Math.sin(ry);
      for (const p of parts) {
        const name = p[0], geo = p[1], lx = p[2], ly = p[3], lz = p[4];
        const rx = p[5] || 0, rz = p[6] || 0;
        if (rz) geo.rotateZ(rz);
        if (rx) geo.rotateX(rx);
        if (ry) geo.rotateY(ry);
        geo.translate(x + lx * c + lz * s, ly, z - lx * s + lz * c);
        bucket(name).push(geo);
        geo.computeBoundingBox();
        if (geo.boundingBox) {
          const b = geo.boundingBox;
          (room._propBoxes = room._propBoxes || [])
            .push({ name, min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] });
        }
      }
      return K;
    },
    /* furniture keeps the visitor out: a long prop becomes a line of circles,
       which is the same collision the plinths already use */
    block(x0, z0, x1, z1, r) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.ceil(len / Math.max(0.25, r * 0.85)));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const w = toWorld(room, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
        plan.obstacles.push({ x: w.x, z: w.z, r, room: room.id });
      }
    },
    mat(name) { return matFor(name); },
    /* things that cannot go into a merge bucket: a textured wall, an eye that
       blinks, a cone of projector light. they are added as their own meshes. */
    extra(...ms) { for (const m of ms) K.extras.push(m); return ms[0]; },
    extras: [],
    flush(parent) {
      for (const [name, arr] of buckets) {
        const spec = PALETTE[name];
        const mat = spec.glass && !PALETTE[name].hex ? M.glass : matFor(name);
        let merged = null;
        try { merged = arr.length === 1 ? arr[0] : mergeGeometries(arr, false); } catch (e) { merged = null; }
        if (!merged) {
          /* a bad merge must not blank a room: fall back to the parts */
          for (const g of arr) {
            const m = new THREE.Mesh(g, mat);
            m.castShadow = true; m.receiveShadow = true;
            parent.add(m);
          }
        } else {
          const m = new THREE.Mesh(merged, mat);
          m.castShadow = true; m.receiveShadow = true;
          if (mat.transparent) { m.castShadow = false; m.renderOrder = 4; }
          parent.add(m);
        }
      }
      buckets.clear();
    }
  };
  return K;
}

/* ── small painters for the two rooms that want words on the wall ──────── */
function codeWallTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#12151b';
  x.fillRect(0, 0, 512, 256);
  const lines = [
    'const plan = buildPlan();',
    'for (const room of plan.rooms) {',
    '  const t = shortest(plan.graph, here, room.id);',
    '  if (!t) continue;          // no way in',
    '  walk(t, { ease: easeInOut, pace: 1.45 });',
    '}',
    '/* a room you cannot reach is not an exhibit, it is a wall */',
    'sky.update(Date.now());',
    'lights.assign(visitor.position);',
    'composer.render();'
  ];
  x.font = '16px ui-monospace, monospace';
  let seed = 7;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  lines.forEach((line, i) => {
    x.fillStyle = i % 3 === 0 ? '#7fd6a2' : i % 3 === 1 ? '#c9d3e0' : '#8fa2bd';
    x.fillText(line, 14, 34 + i * 22);
    if (rand() > 0.6) {
      x.fillStyle = '#3a4553';
      x.fillRect(14 + line.length * 9.05, 24 + i * 22, 6, 14);
    }
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ── the rooms ─────────────────────────────────────────────────────────── */

function gaming(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d, h = room.ceil;

  /* a neon cove tucked under the tray on both side walls: the only bright
     things in here, and they bloom because they sit above the threshold in
     linear space, not because anything about them is loud */
  K.box('neonCyan', 0.06, 0.07, d - 3.0, -(hw - 0.22), h - 1.15, d / 2);
  K.box('neonMagenta', 0.06, 0.07, d - 3.0, hw - 0.22, h - 1.15, d / 2);
  /* a cable tray along the spine, overhead where nothing can bump into it */
  K.box('darkSteel', 0.44, 0.10, d - 1.4, 0, h - 0.52, d / 2);
  for (let p = 1.6; p < d - 1.0; p += 2.4) K.box('iron', 0.62, 0.05, 0.08, 0, h - 0.42, p);

  /* cabinets along both walls, fronts turned in towards the plinths. the
     bodies are steel, not the near-black cabinet colour: in a room lit by one
     lamp a black cabinet is the same colour as the wall behind it and all you
     see is a neon strip floating on its own */
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 4; i++) {
      const z = 2.4 + i * 2.15;
      const x = s * (hw - 0.58);
      K.box('darkSteel', 0.76, 1.72, 0.74, x, 0.86, z);
      K.box('neonCyan', 0.04, 0.20, 0.60, x - s * 0.39, 1.58, z);
      K.box('crt', 0.03, 0.40, 0.50, x - s * 0.39, 1.16, z);
      K.box('steel', 0.80, 0.06, 0.78, x, 0.03, z);
      K.block(x, z, x, z, 0.44);
    }
  }

  /* the CRT wall: dead televisions stacked beside the doorway, the kind of
     hoard a gaming room keeps because somebody collected them. stacked close
     enough to the door reveal to be seen from the corridor, not close enough
     to stand in it */
  for (let s = -1; s <= 1; s += 2) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = s * (1.66 + c * 0.66);
        const y = 1.02 + r * 0.62;
        K.box('case', 0.58, 0.52, 0.44, x, y, 0.42);
        K.box('crt', 0.42, 0.34, 0.02, x, y, 0.65);
      }
    }
    K.block(s * 1.35, 0.2, s * 3.6, 0.2, 0.42);
  }

  /* one screen in the room is awake, and it flickers */
  const crtMat = K.mat('crt');
  anim.push((t) => { crtMat.emissiveIntensity = 0.75 + Math.sin(t * 0.0031) * 0.18 + (Math.random() < 0.012 ? 0.5 : 0); });
}

function creative(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d;

  /* easels along both walls, canvases turned to the room */
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 3; i++) {
      const x = s * (hw - 0.85);
      const z = 2.6 + i * 2.6;
      const ry = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      K.assemble(x, z, ry, [
        ['oakLight', new THREE.BoxGeometry(0.06, 1.78, 0.06), -0.30, 0.88, 0.12, -0.10, 0],
        ['oakLight', new THREE.BoxGeometry(0.06, 1.78, 0.06), 0.30, 0.88, 0.12, -0.10, 0],
        ['oakLight', new THREE.BoxGeometry(0.06, 1.62, 0.06), 0, 0.80, -0.42, 0.52, 0],
        ['oakLight', new THREE.BoxGeometry(0.74, 0.06, 0.06), 0, 1.02, 0.16],
        ['canvasWhite', new THREE.BoxGeometry(0.78, 1.02, 0.03), 0, 1.56, 0.18]
      ]);
      K.block(x, z, x, z, 0.46);
    }
    /* a print cabinet between the easels and the door */
    const x = s * (hw - 0.42);
    K.box('walnut', 0.62, 0.98, 2.6, x, 0.49, 1.5);
    for (let r = 0; r < 3; r++) K.box('brass', 0.02, 0.04, 0.22, x - (s * 0.32), 0.34 + r * 0.28, 1.5);
    K.block(x, 0.3, x, 2.7, 0.42);
  }

  /* a wall of prints beside the doorway, and a drying line under the window.
     the first frame starts 1.85 m off the centre line so it is clear of the
     door reveal rather than over it */
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 3; i++) {
      const x = s * (1.85 + i * 0.92);
      K.box('walnut', 0.78, 1.02, 0.05, x, 1.72, 0.22);
      K.box('paper', 0.62, 0.86, 0.02, x, 1.72, 0.26);
    }
  }
  K.rod('iron', 0.02, room.w - 3.2, 0, room.ceil - 1.5, room.d - 1.1, 'x');
  for (let i = 0; i < 6; i++) K.box('paper', 0.52, 0.68, 0.01, -2.5 + i * 1.0, room.ceil - 1.86, room.d - 1.1);
}

function media(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d;

  /* a row of seats along both walls, facing the screen on the door wall */
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 4; i++) {
      const x = s * (hw - 0.62);
      const z = 2.2 + i * 2.0;
      K.box('cloth', 0.66, 0.12, 0.62, x, 0.46, z);
      K.box('cloth', 0.66, 0.72, 0.14, x + s * 0.26, 0.82, z);
      K.box('darkSteel', 0.06, 0.30, 0.58, x - s * 0.36, 0.60, z);
      K.box('darkSteel', 0.50, 0.06, 0.10, x, 0.20, z);
      K.block(x, z, x, z, 0.44);
    }
  }

  /* the screen, off centre because the doorway is in the way */
  const scx = 3.0, scz = 0.24;
  K.box('case', 3.60, 2.20, 0.10, scx, 1.90, scz);
  K.plane('canvasWhite', 3.36, 1.96, scx, 1.90, scz + 0.07);

  /* the projector on a tripod at the far end of the room, firing down the
     aisle at the screen beside the door. it stood 1.7 m from the screen, which
     is a slide viewer and not a projector, and it put anybody walking in
     straight into the middle of its own beam */
  const px = 3.4, pz = 8.6;
  K.assemble(px, pz, Math.PI, [
    ['darkSteel', new THREE.BoxGeometry(0.52, 0.22, 0.40), 0, 1.34, 0],
    ['darkSteel', new THREE.CylinderGeometry(0.09, 0.09, 0.16, 12), 0, 1.34, 0.26],
    ['iron', new THREE.CylinderGeometry(0.02, 0.02, 1.24, 8), -0.20, 0.62, 0.14, 0, 0.20],
    ['iron', new THREE.CylinderGeometry(0.02, 0.02, 1.24, 8), 0.20, 0.62, 0.14, 0, -0.20],
    ['iron', new THREE.CylinderGeometry(0.02, 0.02, 1.24, 8), 0, 0.62, -0.22, 0.18, 0],
    ['brass', new THREE.CylinderGeometry(0.17, 0.17, 0.04, 16), 0, 1.46, -0.14, Math.PI / 2, 0]
  ]);
  K.block(px, pz, px, pz, 0.40);

  /* the beam is a cone with its point at the lens. it is additive and writes
     no depth, so it brightens the air without hiding anything in it — which
     only works while the eye is outside it: a cone this bright around the
     camera is a wash over the whole room */
  const len = Math.hypot(scx - px, scz - pz);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.52, len, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xbfd6ee, transparent: true, opacity: 0.03,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
    })
  );
  beam.position.set((px + scx) / 2, 1.56, (pz + scz) / 2);
  beam.rotation.order = 'YXZ';
  beam.rotation.y = Math.atan2(pz - scz, scx - px);
  beam.rotation.z = Math.PI / 2;
  beam.renderOrder = 4;
  K.extra(beam);
  anim.push((t) => { beam.material.opacity = 0.05 + Math.sin(t * 0.0013) * 0.012; });

  /* film reels on a shelf by the window. the shelf is 2.4 m of board, so its
     centre has to sit 1.2 m clear of the wall or the outer end is in the
     corridor with the rest of the room behind it */
  K.box('walnut', 2.40, 0.06, 0.42, -(hw - 1.7), 1.15, d - 0.6);
  for (let i = 0; i < 5; i++) {
    K.cyl('brass', 0.19, 0.19, 0.05, -(hw - 0.9) + i * 0.40, 1.40, d - 0.6, 16, 0, 0, Math.PI / 2);
  }
  K.block(-(hw - 1.7), d - 0.6, -(hw - 1.7), d - 0.6, 0.36);
}

function privacy(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d;

  /* the vault door, set into the wall beside the entrance */
  const vx = -3.4;
  K.cyl('steel', 1.05, 1.05, 0.14, vx, 1.72, 0.30, 32, Math.PI / 2, 0, 0);
  K.cyl('darkSteel', 0.86, 0.86, 0.06, vx, 1.72, 0.42, 32, Math.PI / 2, 0, 0);
  K.ring('brass', 0.40, 0.05, vx, 1.72, 0.50, 0, 0, 24);
  for (let i = 0; i < 4; i++) {
    /* four spokes turned about the face of the door, so eight arms */
    K.put('brass', new THREE.BoxGeometry(0.86, 0.07, 0.07), vx, 1.72, 0.50, 0, 0, i * Math.PI / 4);
  }
  K.cyl('steel', 0.10, 0.10, 0.16, vx, 1.72, 0.56, 12, Math.PI / 2, 0, 0);
  K.block(vx, 0.2, vx, 0.2, 0.5);

  /* vitrines down both sides: a steel base, a glass box, one object inside */
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 3; i++) {
      const x = s * (hw - 0.75);
      const z = 2.3 + i * 2.5;
      K.box('darkSteel', 0.92, 0.78, 0.78, x, 0.39, z);
      K.box('steel', 0.98, 0.05, 0.84, x, 0.80, z);
      K.box('glass', 0.80, 0.62, 0.66, x, 1.14, z);
      K.box('steel', 0.98, 0.04, 0.84, x, 1.46, z);
      if (i === 0) K.ball('brass', 0.11, x, 1.02, z, 14);
      if (i === 1) K.box('paper', 0.26, 0.20, 0.04, x, 1.00, z, 0, 0.4);
      if (i === 2) K.cyl('steel', 0.07, 0.09, 0.26, x, 1.03, z, 12);
      K.block(x, z, x, z, 0.5);
    }
    /* a run of cabinets fills the rest of the wall */
    K.box('darkSteel', 0.56, 1.85, 3.2, s * (hw - 0.34), 0.92, d - 2.4);
    for (let r = 0; r < 2; r++) K.box('steel', 0.02, 1.55, 0.04, s * (hw - 0.63), 0.92, d - 3.6 + r * 2.4);
    K.block(s * (hw - 0.34), d - 4.0, s * (hw - 0.34), d - 0.8, 0.42);
  }
}

function tools(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d;

  /* the bench, along the right-hand wall */
  const bx = hw - 0.55;
  K.box('oakLight', 0.72, 0.09, 3.4, bx, 0.92, 3.4);
  for (const z of [1.9, 4.9]) {
    K.box('iron', 0.62, 0.88, 0.10, bx, 0.44, z);
  }
  K.box('iron', 0.16, 0.22, 0.26, bx - 0.30, 1.06, 5.1);
  K.rod('steel', 0.02, 0.34, bx - 0.46, 1.06, 5.1, 'x', 8);
  K.block(bx, 1.7, bx, 5.2, 0.46);

  /* a pegboard over the bench with the tools hanging on it */
  K.box('oak', 0.03, 1.10, 2.8, hw - 0.19, 1.90, 3.4);
  for (let i = 0; i < 7; i++) {
    const z = 2.2 + i * 0.4;
    K.rod('steel', 0.016, 0.30 + (i % 3) * 0.08, hw - 0.28, 1.72, z, 'z', 6);
    K.box('steel', 0.05, 0.10, 0.05, hw - 0.28, 1.55, z);
  }

  /* the oscilloscope, awake, with a trace that breathes */
  K.box('case', 0.44, 0.32, 0.34, bx - 0.02, 1.13, 2.2);
  K.box('screenGreen', 0.02, 0.22, 0.28, bx - 0.25, 1.16, 2.2);
  for (let i = 0; i < 4; i++) K.cyl('brass', 0.03, 0.03, 0.03, bx + 0.10, 1.02, 2.05 + i * 0.09, 10, 0, 0, Math.PI / 2);
  const scope = K.mat('screenGreen');
  anim.push((t) => { scope.emissiveIntensity = 1.05 + Math.sin(t * 0.004) * 0.22; });

  /* the tool chest, and a wall of dials beside the door */
  K.box('iron', 0.66, 0.96, 1.30, -(hw - 0.52), 0.50, 3.6);
  for (let r = 0; r < 3; r++) K.box('steel', 0.02, 0.05, 0.5, -(hw - 0.86), 0.30 + r * 0.26, 3.6);
  K.box('rubber', 0.70, 0.06, 1.34, -(hw - 0.52), 1.00, 3.6);
  K.block(-(hw - 0.52), 3.0, -(hw - 0.52), 4.2, 0.44);

  for (let i = 0; i < 3; i++) {
    /* clear of the door reveal: a dial hung over the doorway is a dial you
       walk through on your way in */
    const x = -(1.75 + i * 0.72);
    K.ring('brass', 0.22, 0.03, x, 1.70, 0.24, 0, 0, 20);
    K.cyl('paper', 0.20, 0.20, 0.02, x, 1.70, 0.22, 20, Math.PI / 2, 0, 0);
    K.rod('iron', 0.012, 0.16, x, 1.70, 0.26, 'z', 6);
  }
}

function dev(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d;

  /* a wall of type cases: the whole point of a print shop is a grid of little
     boxes with letters in them, so the grid is the prop */
  const cx = hw - 0.34;
  K.box('walnut', 0.44, 2.05, 3.6, cx, 1.02, 3.4);
  for (let r = 0; r < 6; r++) {
    K.box('oak', 0.06, 0.03, 3.4, cx - 0.22, 0.28 + r * 0.32, 3.4);
    for (let c = 0; c < 7; c++) {
      K.box('oakLight', 0.04, 0.26, 0.42, cx - 0.24, 0.44 + r * 0.32, 1.85 + c * 0.48);
    }
  }
  K.block(cx, 1.6, cx, 5.2, 0.42);

  /* the press on the opposite wall: a frame, a screw, a platen, a lever */
  const px = -(hw - 0.75);
  K.box('iron', 0.30, 1.90, 0.30, px, 0.95, 2.2);
  K.box('iron', 0.30, 1.90, 0.30, px, 0.95, 4.6);
  K.box('iron', 0.36, 0.30, 2.7, px, 2.05, 3.4);
  K.cyl('steel', 0.16, 0.16, 0.90, px, 1.55, 3.4, 14);
  K.box('oakLight', 0.90, 0.16, 1.30, px + 0.05, 1.02, 3.4);
  K.box('oak', 1.00, 0.10, 1.40, px + 0.05, 0.86, 3.4);
  K.rod('iron', 0.035, 1.10, px + 0.55, 2.05, 3.4, 'x', 8);
  K.ball('iron', 0.09, px + 1.10, 2.05, 3.4, 10);
  K.block(px, 2.0, px, 4.8, 0.5);

  /* paper, everywhere: stacks at the door, a galley on the press table. the
     two on the left stand clear of the reveal, which is 1.8 m of doorway
     centred on the wall and does not want a ream of paper in it */
  const stacks = [[-2.6, 0.9, 0.24], [-2.0, 0.9, 0.42], [1.9, 0.8, 0.30], [2.5, 0.7, 0.52]];
  for (const [x, w, hh] of stacks) {
    K.box('paper', w, hh, w * 1.3, x, hh / 2, 0.95);
    /* each stack is its own obstacle: the gap between them is how you get in */
    K.block(x, 0.95, x, 0.95, Math.max(0.3, w * 0.55));
  }

  /* the monospace wall */
  const tex = codeWallTexture();
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.3),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.9 })
  );
  wall.position.set(2.2, 1.72, 0.22);
  K.extra(wall);
  anim.push((t) => { wall.material.emissiveIntensity = 0.5 + Math.sin(t * 0.0009) * 0.08; });
}

function android(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d;

  /* oak shelving down both walls, with jars and boxes on it */
  for (let s = -1; s <= 1; s += 2) {
    const x = s * (hw - 0.36);
    K.box('oak', 0.52, 2.10, 0.06, x, 1.05, 1.3);
    K.box('oak', 0.52, 2.10, 0.06, x, 1.05, 4.9);
    K.box('oak', 0.52, 0.05, 3.66, x, 2.08, 3.1);
    K.box('oak', 0.52, 0.05, 3.66, x, 0.10, 3.1);
    for (let r = 0; r < 3; r++) K.box('oakLight', 0.48, 0.04, 3.5, x, 0.62 + r * 0.48, 3.1);
    for (let i = 0; i < 6; i++) {
      const z = 1.6 + i * 0.56;
      const r = 0.62 + (i % 3) * 0.48;
      if (i % 2 === 0) {
        K.cyl('greenGlass', 0.09, 0.09, 0.30, x - s * 0.06, r + 0.17, z, 12);
        K.cyl('brass', 0.05, 0.05, 0.05, x - s * 0.06, r + 0.34, z, 10);
      } else {
        K.box('walnut', 0.28, 0.22, 0.24, x - s * 0.06, r + 0.13, z);
      }
    }
    K.block(x, 1.3, x, 4.9, 0.42);
  }

  /* the robot, on a low plinth in the corner by the door */
  const rx = -(hw - 1.15), rz = 1.05;
  K.box('darkSteel', 0.70, 0.28, 0.70, rx, 0.14, rz);
  K.cyl('steel', 0.22, 0.26, 0.62, rx, 0.61, rz, 16);
  K.box('steel', 0.44, 0.34, 0.36, rx, 1.09, rz);
  K.ring('brass', 0.16, 0.02, rx, 1.09, rz - 0.19, 0, 0, 16);
  K.rod('steel', 0.016, 0.34, rx - 0.14, 1.42, rz, 'y', 6);
  K.rod('steel', 0.016, 0.34, rx + 0.14, 1.42, rz, 'y', 6);
  K.ball('brass', 0.035, rx - 0.14, 1.60, rz, 8);
  K.ball('brass', 0.035, rx + 0.14, 1.60, rz, 8);
  K.box('case', 0.16, 0.10, 0.04, rx - 0.10, 1.10, rz - 0.19);
  K.box('case', 0.16, 0.10, 0.04, rx + 0.10, 1.10, rz - 0.19);
  K.block(rx, rz, rx, rz, 0.46);

  /* the eyes get their own material so they can blink without taking the
     room's neon down with them */
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0d1418, emissive: 0x62e0ff, emissiveIntensity: 1.6, roughness: 0.4 });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMat);
  e1.position.set(rx - 0.10, 1.10, rz - 0.21);
  const e2 = e1.clone();
  e2.position.set(rx + 0.10, 1.10, rz - 0.21);
  K.extra(e1, e2);
  anim.push((t) => { eyeMat.emissiveIntensity = Math.sin(t * 0.0012) > 0.985 ? 0.1 : 1.6; });
}

function shopping(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d;

  /* the counter, a single marble slab on two blocks. it runs the right wall,
    45 cm clear of it: the plinth grid puts a column at x = 1.7 in a room this
    narrow, and a slab centred where the wall wants it stands on that plinth */
  const cx = hw - 0.45;
  K.box('marbleSlab', 0.78, 0.12, 4.2, cx, 1.00, 3.3);
  K.box('marbleSlab', 0.62, 0.94, 0.60, cx, 0.47, 1.6);
  K.box('marbleSlab', 0.62, 0.94, 0.60, cx, 0.47, 4.9);
  K.rod('brass', 0.028, 4.2, cx - 0.39, 0.34, 3.3, 'z', 8);
  for (const z of [1.5, 5.1]) K.rod('brass', 0.028, 0.7, cx - 0.39, 0.17, z, 'y', 8);
  K.block(cx, 1.3, cx, 5.3, 0.5);

  /* the scales on the counter: the beam is as wide as the slab is deep, or
     the further pan hangs out through the wall */
  const sx = cx, sz = 3.3;
  K.assemble(sx, sz, 0, [
    ['brass', new THREE.CylinderGeometry(0.16, 0.20, 0.06, 16), 0, 1.09, 0],
    ['brass', new THREE.CylinderGeometry(0.025, 0.025, 0.62, 10), 0, 1.42, 0],
    ['brass', new THREE.BoxGeometry(0.52, 0.04, 0.05), 0, 1.70, 0, 0, 0, 0.05],
    ['brass', new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16), -0.26, 1.60, 0],
    ['brass', new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16), 0.26, 1.66, 0],
    ['brass', new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), -0.26, 1.78, 0],
    ['brass', new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), 0.26, 1.78, 0]
  ]);

  /* the safe beside the door, and the keys on the wall opposite */
  K.box('darkSteel', 1.10, 1.20, 0.90, -2.4, 0.60, 0.68);
  K.box('steel', 0.90, 1.00, 0.06, -2.4, 0.60, 1.16);
  K.cyl('brass', 0.16, 0.16, 0.05, -2.4, 0.62, 1.22, 20, Math.PI / 2, 0, 0);
  K.ring('brass', 0.20, 0.03, -2.4, 0.62, 1.26, 0, 0, 20);
  K.block(-2.9, 0.7, -1.9, 0.7, 0.5);

  for (let i = 0; i < 6; i++) {
    const z = 1.8 + i * 0.5;
    K.rod('brass', 0.014, 0.14, -(hw - 0.20), 1.72, z, 'x', 6);
    K.ring('brass', 0.06, 0.014, -(hw - 0.30), 1.62, z, 0, 0, 12);
    K.box('brass', 0.05, 0.09, 0.02, -(hw - 0.30), 1.53, z);
  }

  /* a velvet rope across the far end: this side of the line is business. the
     posts go in the gap between two plinth columns, which in this room is a
     strip about a metre wide down the middle */
  for (const z of [2.75, 3.85]) {
    K.cyl('brass', 0.05, 0.09, 0.92, 0.85, 0.46, z, 12);
    K.ball('brass', 0.06, 0.85, 0.94, z, 10);
    K.block(0.85, z, 0.85, z, 0.22);
  }
  K.rod('cloth', 0.022, 1.10, 0.85, 0.80, 3.30, 'z', 8);
}

function ai(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d, h = room.ceil;

  /* the engine: a lattice hung from the ceiling, turning slowly. it hangs over
     the middle of the room now — over the doorway it was 60 cm from the face
     of anybody walking in, where a 1.4 m ring is not an object but a colour
     wash across the whole frame */
  const lx = 0, lz = d / 2, ly = h - 0.85;
  /* this one cannot be merged into the room: it has to turn, so it stays a
     group of a dozen meshes hanging off the ceiling */
  const latMat = matFor('lattice');
  const lat = new THREE.Group();
  const addPart = (geo, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, latMat);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true;
    lat.add(m);
  };
  addPart(new THREE.TorusGeometry(0.72, 0.035, 6, 28));
  addPart(new THREE.TorusGeometry(0.60, 0.035, 6, 28), Math.PI / 2);
  addPart(new THREE.TorusGeometry(0.48, 0.035, 6, 28), 0, Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    addPart(new THREE.BoxGeometry(0.03, 0.03, 1.44), 0, (i / 8) * Math.PI, Math.PI / 2);
  }
  addPart(new THREE.SphereGeometry(0.14, 12, 8));
  lat.position.set(lx, ly, lz);
  K.extra(lat);
  K.rod('darkSteel', 0.014, 0.5, lx, h - 0.35, lz, 'y', 6);

  /* cold rim light in the two far corners, and a bank of fins on each wall:
     the fins are bare steel, because a black fin against a black wall is a
     wall, and the tubes sit 9 cm off the plaster so they read as fitted to it
     rather than as two bars of light standing in the room */
  for (let s = -1; s <= 1; s += 2) {
    K.box('coldStrip', 0.05, 2.6, 0.05, s * (hw - 0.09), 1.5, d - 0.22);
    for (let i = 0; i < 6; i++) {
      const z = 2.0 + i * 0.62;
      K.box('steel', 0.10, 2.20, 0.34, s * (hw - 0.28), 1.10, z);
    }
    K.block(s * (hw - 0.28), 2.0, s * (hw - 0.28), 5.1, 0.32);
  }

  anim.push((t) => {
    lat.rotation.y = t * 0.00012;
    lat.rotation.x = Math.sin(t * 0.0002) * 0.12;
    latMat.emissiveIntensity = 0.55 + Math.sin(t * 0.0016) * 0.12;
  });
}

function reading(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d;

  /* the gallery along one wall: a floor, a rail, and the bookcases underneath
     it. the ladder says you could go up; nothing says you should */
  const gx = -(hw - 0.62);
  K.box('oak', 1.24, 0.10, d - 1.6, gx, 2.16, d / 2);
  K.box('walnut', 0.06, 0.92, d - 1.6, gx + 0.60, 2.68, d / 2);
  for (let i = 0; i < 7; i++) K.rod('walnut', 0.022, 0.86, gx + 0.60, 2.60, 1.3 + i * 0.62, 'y', 6);
  K.rod('walnut', 0.03, d - 1.6, gx + 0.60, 3.08, d / 2, 'z', 8);
  for (const z of [1.4, d - 1.4]) K.box('oak', 1.20, 2.10, 0.12, gx, 1.05, z);
  K.block(gx, 1.2, gx, d - 1.2, 0.5);

  /* books below the gallery and along the opposite wall */
  const bookMats = ['bookRed', 'bookGreen', 'bookBlue'];
  for (let s = -1; s <= 1; s += 2) {
    const x = s * (hw - 0.30);
    K.box('walnut', 0.44, 1.90, 0.05, x, 0.95, 1.15);
    K.box('walnut', 0.44, 1.90, 0.05, x, 0.95, d - 1.15);
    for (let r = 0; r < 4; r++) {
      K.box('oak', 0.42, 0.04, d - 2.3, x, 0.30 + r * 0.46, d / 2);
      let z = 1.35;
      let i = 0;
      while (z < d - 1.35) {
        const w = 0.035 + ((i * 37) % 5) * 0.012;
        const hh = 0.24 + ((i * 53) % 7) * 0.018;
        K.box(bookMats[i % 3], 0.30, hh, w, x - s * 0.04, 0.32 + r * 0.46 + hh / 2, z);
        z += w + 0.006;
        i++;
      }
    }
    K.block(x, 1.2, x, d - 1.2, 0.38);
  }

  /* the ladder, leaning */
  K.assemble(-(hw - 1.35), 1.5, 0, [
    ['oakLight', new THREE.BoxGeometry(0.05, 2.5, 0.05), -0.22, 1.20, 0, 0.28, 0],
    ['oakLight', new THREE.BoxGeometry(0.05, 2.5, 0.05), 0.22, 1.20, 0, 0.28, 0],
    ...[0, 1, 2, 3, 4, 5].map((i) => ['oakLight', new THREE.BoxGeometry(0.46, 0.035, 0.05), 0, 0.34 + i * 0.40, i * 0.115])
  ]);
  K.block(-(hw - 1.35), 1.5, -(hw - 1.35), 1.5, 0.34);

  /* a desk and a chair by the door, and two warm lamps on the gallery rail.
     the chair is on the far side of the desk from the door: put it where the
     room's first plinth column runs and it is an exhibit instead of a seat */
  K.box('oak', 1.10, 0.07, 0.66, 1.55, 0.76, 0.95);
  for (const dx of [-0.48, 0.48]) K.box('walnut', 0.07, 0.76, 0.58, 1.55 + dx, 0.38, 0.95);
  K.box('paper', 0.30, 0.05, 0.22, 1.35, 0.82, 0.95, 0, 0.3);
  K.block(1.1, 0.95, 2.0, 0.95, 0.42);
  K.assemble(1.55, 0.42, Math.PI, [
    ['walnut', new THREE.BoxGeometry(0.44, 0.06, 0.44), 0, 0.46, 0],
    ['walnut', new THREE.BoxGeometry(0.44, 0.52, 0.06), 0, 0.75, -0.19],
    ...[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([dx, dz]) =>
      ['walnut', new THREE.BoxGeometry(0.05, 0.46, 0.05), dx, 0.23, dz])
  ]);
  K.block(1.55, 0.42, 1.55, 0.42, 0.34);

  for (const z of [2.2, 4.2]) {
    K.cyl('warmBulb', 0.075, 0.075, 0.14, gx + 0.60, 3.20, z, 12);
    K.rod('brass', 0.014, 0.22, gx + 0.60, 3.38, z, 'y', 6);
  }
}

function linux(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d, h = room.ceil;

  /* two racks, one per wall, with the units stacked and the LEDs awake */
  for (let s = -1; s <= 1; s += 2) {
    const x = s * (hw - 0.42);
    K.box('darkSteel', 0.72, 2.05, 1.30, x, 1.02, 3.3);
    for (let u = 0; u < 9; u++) {
      K.box('case', 0.04, 0.16, 1.14, x - s * 0.38, 0.28 + u * 0.21, 3.3);
      K.box('steel', 0.02, 0.03, 0.20, x - s * 0.40, 0.28 + u * 0.21, 2.85);
    }
    K.block(x, 2.7, x, 3.9, 0.48);
    /* the LEDs are one merged mesh per room, so the blink is the material's */
    for (let u = 0; u < 9; u++) {
      K.ball(u % 4 === 3 ? 'ledAmber' : 'led', 0.018, x - s * 0.41, 0.28 + u * 0.21, 3.72, 6);
    }
  }

  /* cable trays overhead, and a terminal in the corner by the door */
  for (let i = 0; i < 3; i++) {
    K.rod('darkSteel', 0.05, room.w - 0.9, 0, h - 0.42 - i * 0.09, 1.5 + i * 0.16, 'x', 8);
  }
  const tx = hw - 1.05, tz = 1.05;
  K.box('oakLight', 0.90, 0.06, 0.62, tx, 0.74, tz);
  for (const dx of [-0.38, 0.38]) K.box('iron', 0.06, 0.74, 0.56, tx + dx, 0.37, tz);
  K.box('case', 0.46, 0.36, 0.40, tx, 0.95, tz);
  K.box('screenGreen', 0.36, 0.26, 0.02, tx, 0.97, tz - 0.21);
  K.box('case', 0.44, 0.04, 0.18, tx, 0.79, tz + 0.10);
  K.block(tx, tz, tx, tz, 0.5);

  const led = K.mat('led');
  const amber = K.mat('ledAmber');
  const scope = K.mat('screenGreen');
  anim.push((t) => {
    led.emissiveIntensity = 1.6 + Math.abs(Math.sin(t * 0.0035)) * 1.4;
    amber.emissiveIntensity = Math.sin(t * 0.0011) > 0.4 ? 2.2 : 0.15;
    scope.emissiveIntensity = 1.0 + Math.sin(t * 0.0027) * 0.18;
  });
}

function fun(K, room, plan, anim) {
  const hw = room.w / 2, d = room.d;

  /* the vitrine in the corner by the door: a case, and everything that would
     not fit anywhere else in the building */
  const vx = -(hw - 1.05), vz = 1.15;
  K.box('walnut', 1.05, 0.90, 0.86, vx, 0.45, vz);
  K.box('walnut', 1.15, 0.06, 0.96, vx, 0.94, vz);
  K.box('glass', 0.94, 0.72, 0.76, vx, 1.33, vz);
  K.box('walnut', 1.15, 0.06, 0.96, vx, 1.70, vz);
  K.cyl('brass', 0.05, 0.05, 0.10, vx, 1.76, vz, 10);
  K.ball('brass', 0.09, vx - 0.22, 1.10, vz, 12);
  K.put('paper', new THREE.ConeGeometry(0.06, 0.42, 10), vx + 0.16, 1.28, vz - 0.10, 0, 0, -0.5);
  K.ring('brass', 0.10, 0.03, vx + 0.20, 1.12, vz + 0.16, 0.4, 0, 14);
  K.ball('steel', 0.08, vx - 0.02, 1.10, vz + 0.22, 7);
  K.block(vx, vz, vx, vz, 0.6);

  /* a wall of small drawers, the cabinet of curiosities' signature move */
  const wx = hw - 0.26;
  K.box('walnut', 0.36, 1.90, 3.0, wx, 0.95, 3.3);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      const y = 0.30 + r * 0.34;
      const z = 2.0 + c * 0.48;
      K.box('oakLight', 0.04, 0.28, 0.42, wx - 0.20, y, z);
      K.ball('brass', 0.022, wx - 0.24, y, z, 8);
    }
  }
  K.block(wx, 1.9, wx, 4.7, 0.36);

  /* the clutter the museum keeps buying: a barrel, a crate, books on the
     floor. in a 6 m cabinet the floor beside the door is the only part of the
     room the plinth grid has not claimed */
  K.cyl('oak', 0.30, 0.34, 0.72, hw - 0.75, 0.36, 1.15, 16);
  K.ring('iron', 0.31, 0.02, hw - 0.75, 0.20, 1.15, Math.PI / 2, 0, 18);
  K.ring('iron', 0.33, 0.02, hw - 0.75, 0.54, 1.15, Math.PI / 2, 0, 18);
  K.block(hw - 0.75, 1.15, hw - 0.75, 1.15, 0.4);
  K.box('crate', 0.62, 0.50, 0.52, -(hw - 0.75), 0.25, d - 1.0, 0, 0.3);
  K.block(-(hw - 0.75), d - 1.0, -(hw - 0.75), d - 1.0, 0.42);
  for (let i = 0; i < 4; i++) {
    K.box(['bookRed', 'bookBlue', 'bookGreen', 'bookRed'][i], 0.30, 0.05, 0.22,
      -(hw - 0.65), 0.03 + i * 0.055, 1.55 + (i % 2) * 0.02, 0, 0.2 + i * 0.14);
  }
}

const BUILDERS = {
  gaming, creative, media, privacy, tools, dev, android, shopping, ai, reading, linux, fun
};

/* The 51-room building split and renamed the twelve categories, so five of
   these sets of furniture no longer share a name with a room. They still
   belong where they were written: the easels in Content Creation, the
   workbench in PC Tweaks, the terminals in Programming, the handset wall in
   Android Dev, the oscilloscope and the LED strips in Modding. */
const ALIAS = {
  'content-creation': creative,
  'pc-tweaks': tools,
  'programming': dev,
  'android-dev': android,
  'modding': fun
};

/* ── the rotunda: nothing on display yet, so it stores things ──────────── */
export function furnishRotunda(g, plan, M) {
  const K = makeKit(M, plan.rotunda, plan);
  const R = S.ROTUNDA_R;

  /* crates in the diagonal quadrants, stacked the way a museum stacks things
     it has bought and not yet unpacked */
  const stacks = [
    { a: Math.PI / 4, n: 3 },
    { a: (5 * Math.PI) / 4, n: 4 },
    { a: (7 * Math.PI) / 4, n: 2 }
  ];
  for (const st of stacks) {
    const cx = Math.sin(st.a) * (R - 1.5);
    const cz = Math.cos(st.a) * (R - 1.5);
    let y = 0;
    for (let i = 0; i < st.n; i++) {
      const s = 0.95 - i * 0.12;
      const ry = st.a + (i % 2 ? 0.35 : -0.2);
      K.put('crate', new THREE.BoxGeometry(s, s * 0.8, s), cx + (i % 2 ? 0.18 : -0.12), y + s * 0.4, cz + (i % 2 ? -0.14 : 0.16), 0, ry, 0);
      y += s * 0.8;
      K.block(cx, cz, cx, cz, 0.62);
    }
    /* one of them has been shrouded, which is what a crate looks like when
       the museum is waiting for something to put in it */
    if (st.n > 2) {
      K.put('dust', new THREE.SphereGeometry(0.78, 10, 8), cx, y - 0.30, cz, 0, st.a, 0);
      K.put('dust', new THREE.BoxGeometry(1.5, 0.06, 1.5), cx, 0.03, cz, 0, st.a, 0);
    }
  }

  /* a hand truck standing by the north arch, and a ladder against the drum
     where somebody is meant to be changing a sign */
  K.assemble(-2.4, R - 1.9, 0.6, [
    ['iron', new THREE.BoxGeometry(0.52, 0.06, 1.10), 0, 0.06, 0],
    ['iron', new THREE.BoxGeometry(0.05, 1.12, 0.05), -0.24, 0.58, -0.52, 0.22, 0],
    ['iron', new THREE.BoxGeometry(0.05, 1.12, 0.05), 0.24, 0.58, -0.52, 0.22, 0],
    ['iron', new THREE.BoxGeometry(0.52, 0.05, 0.05), 0, 1.12, -0.40],
    ['rubber', new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12), -0.24, 0.11, 0.42, 0, 0, Math.PI / 2],
    ['rubber', new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12), 0.24, 0.11, 0.42, 0, 0, Math.PI / 2]
  ]);
  const w = toWorld(plan.rotunda, -2.4, R - 1.9);
  plan.obstacles.push({ x: w.x, z: w.z, r: 0.55, room: 'rotunda' });

  K.assemble(R - 1.4, -3.2, -1.25, [
    ['oakLight', new THREE.BoxGeometry(0.06, 3.1, 0.06), -0.24, 1.55, 0, 0.16, 0],
    ['oakLight', new THREE.BoxGeometry(0.06, 3.1, 0.06), 0.24, 1.55, 0, 0.16, 0],
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => ['oakLight', new THREE.BoxGeometry(0.50, 0.04, 0.06), 0, 0.42 + i * 0.42, i * 0.07])
  ]);
  const w2 = toWorld(plan.rotunda, R - 1.4, -3.2);
  plan.obstacles.push({ x: w2.x, z: w2.z, r: 0.5, room: 'rotunda' });

  K.flush(g);
}

/* ── entry point ───────────────────────────────────────────────────────── */
export function furnish(g, plan, room, M) {
  if (!plan.obstacles) plan.obstacles = [];
  const build = BUILDERS[room.id] || ALIAS[room.id];
  if (!build) return null;
  const K = makeKit(M, room, plan);
  const anim = [];
  build(K, room, plan, anim);
  K.flush(g);
  K.extras.forEach((m) => g.add(m));
  room._props = { anim, obstacles: plan.obstacles.filter((o) => o.room === room.id) };
  return room._props;
}
