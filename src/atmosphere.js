/* ── atmosphere ──────────────────────────────────────────────────────────
   The cellar is where the museum keeps the things it has not decided about
   yet, and nobody rakes the corners down there. Upstairs the terrazzo is
   polished and the plaster is painted; downstairs the plaster is damp, the
   tubes have been on for years, and the dust has settled into a film you only
   notice because a cellar room is lit by one lamp, so its light is a shaft.

   Three things, all cheap, all cellar only:

     · a damp band along the base of the cellar walls — darker than the
       plaster and glossier than it, with a pale tide line of salt about a
       third of the way up. Wet plaster is *shinier* than dry, which is why
       you can read a damp wall before you can see one.
     · webs across the ceiling corners, lit by the room's own lamp, so they
       come up as you walk under them and are gone behind you.
     · dust in the air. Not a particle system: a few dozen points per room,
       moved by hand twenty times a second, and the whole cloud skipped while
       the arm they stand in is culled.

   The damp and the webs of an arm weld into one mesh and its dust into one
   cloud, so the building pays two extra draw calls per cellar arm — eight,
   and one more pair for the stair hall. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { S } from './scale.js';

const BAND_H = 0.44;          // how high the damp climbs
const WEB = 0.62;             // the corner web's reach
const WEB_D = WEB * 0.353;    // how far a web's centre sits off its corner

/* ── the two painters ──────────────────────────────────────────────────── */

/* Damp in plaster is not a colour, it is a gradient with a tide line in it:
   water carries salts up from the ground and stops, and the salts stay. So
   the sheet is darkest at the floor, fades out over its height, has a pale
   band where the water gave up, and has a few streaks where something ran
   down the wall more recently than the rest of it. */
let dampTex = null;
function dampTexture() {
  if (dampTex) return dampTex;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 128);

  const grad = x.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(9,11,13,0)');
  grad.addColorStop(0.45, 'rgba(9,11,13,0.30)');
  grad.addColorStop(0.8, 'rgba(8,10,12,0.68)');
  grad.addColorStop(1, 'rgba(7,9,11,0.80)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 512, 128);

  /* the blooms: overlapping soft ellipses, so the edge of the damp is never
     a straight line and never quite the same height twice */
  for (let i = 0; i < 26; i++) {
    const cx = Math.random() * 512;
    const cy = 74 + Math.random() * 54;
    x.fillStyle = `rgba(8,10,12,${0.05 + Math.random() * 0.13})`;
    x.beginPath();
    x.ellipse(cx, cy, 18 + Math.random() * 74, 8 + Math.random() * 30, 0, 0, Math.PI * 2);
    x.fill();
  }

  /* the salt: a pale, broken line where the water stopped */
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(178,172,156,${0.05 + Math.random() * 0.10})`;
    x.beginPath();
    x.ellipse(Math.random() * 512, 62 + Math.random() * 22,
      10 + Math.random() * 34, 2.5 + Math.random() * 5, 0, 0, Math.PI * 2);
    x.fill();
  }

  /* three or four streaks: a pipe clamp, a run, something fixed to the wall
     and taken off again */
  for (let i = 0; i < 4; i++) {
    const sx = 40 + Math.random() * 430;
    const top = Math.random() * 30;
    const g2 = x.createLinearGradient(0, top, 0, 118);
    g2.addColorStop(0, 'rgba(6,8,10,0.30)');
    g2.addColorStop(1, 'rgba(6,8,10,0)');
    x.fillStyle = g2;
    x.fillRect(sx, top, 3 + Math.random() * 9, 118 - top);
  }

  dampTex = new THREE.CanvasTexture(c);
  dampTex.colorSpace = THREE.SRGBColorSpace;
  dampTex.wrapS = THREE.RepeatWrapping;
  dampTex.wrapT = THREE.ClampToEdgeWrapping;
  return dampTex;
}

/* A corner web, drawn in the corner's own frame: the corner is at the top
   left of the sheet and the two walls run away along its edges, so the same
   texture serves every corner in the building and only its turning changes. */
let webTex = null;
function webTexture() {
  if (webTex) return webTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(214,222,232,0.55)';
  x.lineWidth = 1.3;

  const spokes = [0.06, 0.22, 0.38, 0.55, 0.72, 0.9, 1.1, 1.3, 1.48];
  const R = 250;
  /* the anchor threads, each with a little sag in it */
  for (const a of spokes) {
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(Math.cos(a + 0.1) * R * 0.5, Math.sin(a + 0.1) * R * 0.5,
      Math.cos(a) * R, Math.sin(a) * R);
    x.stroke();
  }
  /* the spiral: arcs between the threads, closer together near the corner,
     each one pulled towards the corner by its own weight */
  for (let r = 26; r < 240; r *= 1.34) {
    x.beginPath();
    for (let i = 0; i < spokes.length; i++) {
      const a = spokes[i];
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) x.moveTo(px, py);
      else {
        const pa = spokes[i - 1];
        x.quadraticCurveTo(Math.cos((pa + a) / 2) * r * 0.93, Math.sin((pa + a) / 2) * r * 0.93, px, py);
      }
    }
    x.stroke();
  }
  /* one thread that broke, and the loose end of it */
  x.strokeStyle = 'rgba(214,222,232,0.30)';
  x.beginPath();
  x.moveTo(Math.cos(0.55) * 60, Math.sin(0.55) * 60);
  x.quadraticCurveTo(120, 190, 96, 232);
  x.stroke();

  webTex = new THREE.CanvasTexture(c);
  webTex.colorSpace = THREE.SRGBColorSpace;
  return webTex;
}

/* ── the materials, one set for the whole cellar ───────────────────────── */

/* A mote is a speck, not a square: the points are drawn as a soft disc, or
   the dust reads as a swarm of pixels and the eye starts counting them. */
let dustSprite = null;
function moteMap() {
  if (dustSprite) return dustSprite;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  dustSprite = new THREE.CanvasTexture(c);
  return dustSprite;
}

let mats = null;
function atmosphereMats() {
  if (mats) return mats;
  mats = {
    /* the band is a sheet of damp laid over the plaster: transparent so the
       wall shows through it, and much glossier than the wall, which is the
       whole trick */
    damp: new THREE.MeshStandardMaterial({
      map: dampTexture(), transparent: true, roughness: 0.28, metalness: 0.02,
      color: 0xffffff, depthWrite: true
    }),
    web: new THREE.MeshStandardMaterial({
      map: webTexture(), transparent: true, roughness: 1, metalness: 0,
      side: THREE.DoubleSide, depthWrite: false
    }),
    dust: new THREE.PointsMaterial({
      size: 0.016, color: 0x9aa3ae, alphaMap: moteMap(), transparent: true,
      opacity: 0.38, sizeAttenuation: true, depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  };
  return mats;
}

/* ── the pieces, all built in the room's own frame ─────────────────────── */

/* a damp band along one wall run. The room group stands at its doorway with
   +Z running in, so the four inner faces are z = t/2, z = d - t/2 and
   x = ±(w/2 - t/2). */
function band(w, x, y, z, ry, frame, out) {
  const g = new THREE.PlaneGeometry(w, BAND_H);
  /* the sheet tiles along the wall at one metre sixty a repeat and never
     repeats vertically: the gradient is the whole height of the band */
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 1.6), uv.getY(i));
  g.rotateY(ry);
  g.translate(x, y, z);
  if (frame) g.applyMatrix4(frame);
  out.push(g);
}

function roomBands(room, frame, out) {
  const t = S.WALL_T, w = room.w, d = room.d;
  const xw = w / 2 - t / 2;                 // inner face of a side wall
  const y = BAND_H / 2 + 0.006;
  const dw = (room.door && room.door.w) || 1.2;

  /* the door wall, in two pieces: the doorway is a hole, and damp does not
     climb across a hole */
  const run = xw - dw / 2 - 0.06;
  if (run > 0.25) {
    band(run, -xw + run / 2, y, t / 2 + 0.008, 0, frame, out);
    band(run, dw / 2 + 0.06 + run / 2, y, t / 2 + 0.008, 0, frame, out);
  }
  /* the far wall and the two sides */
  band(w - t, 0, y, d - t / 2 - 0.008, Math.PI, frame, out);
  band(d - t, -xw - 0.008, y, d / 2, Math.PI / 2, frame, out);
  band(d - t, xw + 0.008, y, d / 2, -Math.PI / 2, frame, out);
}

/* a web across a corner: a sheet turned 45° so its two ends land on the two
   walls that meet there. The corner is (x0, z0) and (sx, sz) is the direction
   that points away from both walls, into the room. */
function cornerWeb(x0, z0, sx, sz, y, frame, out) {
  const g = new THREE.PlaneGeometry(WEB, WEB);
  g.rotateY(Math.atan2(sx, sz));
  g.translate(x0 + sx * WEB_D, y, z0 + sz * WEB_D);
  if (frame) g.applyMatrix4(frame);
  out.push(g);
}

/* the two corners by the door: the ones a visitor looks at on the way in, and
   the two the sweep misses because the sweep never looks up */
function roomWebs(room, frame, out) {
  const t = S.WALL_T, w = room.w, h = room.ceil;
  const xw = w / 2 - t / 2;
  const y = h - WEB / 2 - 0.05;
  cornerWeb(-xw, t / 2, 1, 1, y, frame, out);
  cornerWeb(xw, t / 2, -1, 1, y, frame, out);
}

/* dust: points spread through the room's air, each with its own phase, its
   own speed and its own reach, so nothing in the cloud moves with the cloud */
function roomDust(room, frame, list) {
  const t = S.WALL_T, w = room.w, d = room.d, h = room.ceil;
  const n = Math.max(10, Math.round(room.w * room.d * 0.35));
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector3(
      (Math.random() - 0.5) * (w - t - 0.5),
      0.12 + Math.random() * (h - 0.4),
      0.35 + Math.random() * (d - t - 0.7)
    ).applyMatrix4(frame);
    list.push({
      x: p.x, y: p.y, z: p.z,
      a: Math.random() * Math.PI * 2,
      s: 0.00016 + Math.random() * 0.00028,
      r: 0.03 + Math.random() * 0.12
    });
  }
}

/* the room group's transform, baked into the geometry: the atmosphere lives
   in the arm's group rather than the room's, so one mesh serves every room on
   the arm and the cull already knows how to switch it off */
function roomFrame(room) {
  const m = new THREE.Matrix4();
  m.makeRotationY(room.angle);
  m.setPosition(room.entry.x, S.FLOOR_BASE, room.entry.z);
  return m;
}

/* the drift, shared by the arms and the hall: dust settles, and it also
   drifts, and which of the two it is doing depends on the draught, so each
   mote gets a slow climb, a longer fall and a sideways sway out of its own
   phase. Twenty updates a second, and none at all while the group is off. */
function drifter(geo, motes, group) {
  let last = 0;
  return (t) => {
    if (!group.visible || t - last < 50) return;
    last = t;
    const arr = geo.attributes.position.array;
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const k = t * m.s + m.a;
      arr[i * 3] = m.x + Math.sin(k) * m.r;
      arr[i * 3 + 1] = m.y + Math.sin(k * 0.37) * m.r * 1.6;
      arr[i * 3 + 2] = m.z + Math.cos(k * 0.71) * m.r;
    }
    geo.attributes.position.needsUpdate = true;
  };
}

function cloud(motes, group, mats) {
  const pos = new Float32Array(motes.length * 3);
  motes.forEach((m, i) => { pos[i * 3] = m.x; pos[i * 3 + 1] = m.y; pos[i * 3 + 2] = m.z; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
  const points = new THREE.Points(geo, mats.dust);
  group.add(points);
  return { geo, points };
}

/* ── entry points ──────────────────────────────────────────────────────── */

/* one cellar arm: every room on it, welded into one damp sheet, one web sheet
   and one cloud of dust. Returns the thing the frame has to move. */
export function cellarArm(group, rooms) {
  if (!rooms.length) return null;
  const mats = atmosphereMats();
  const damp = [], webs = [], motes = [];
  for (const room of rooms) {
    const frame = roomFrame(room);
    roomBands(room, frame, damp);
    roomWebs(room, frame, webs);
    roomDust(room, frame, motes);
  }

  const anims = [];
  const md = mergeGeometries(damp, false);
  if (md) {
    const m = new THREE.Mesh(md, mats.damp);
    m.receiveShadow = true;
    m.userData.atmo = 'damp';
    group.add(m);
  }
  const mw = mergeGeometries(webs, false);
  if (mw) {
    const m = new THREE.Mesh(mw, mats.web);
    m.renderOrder = 3;
    m.userData.atmo = 'web';
    group.add(m);
  }
  const c = cloud(motes, group, mats);
  c.points.userData.atmo = 'dust';
  /* the arm's group is what the cull switches, so the cloud stops the moment
     you go upstairs */
  anims.push(drifter(c.geo, motes, group));
  return anims;
}

/* the stair hall: the same treatment. The hall's group is already sitting on
   the cellar floor with no turning, so its pieces go in untransformed. Only
   the two walls that run with the flight get a band — the other two are taken
   up with the four cellar doors and the mouth of the well — and all four
   ceiling corners get a web, because the hall is where people stop. */
export function stairHall(group, hw, hd, gate) {
  const mats = atmosphereMats();
  const t = S.WALL_T, h = S.CEIL_BASE;
  const y = BAND_H / 2 + 0.006;
  const damp = [], webs = [], motes = [];

  band(2 * hd - t, -(hw - t / 2) - 0.008, y, 0, Math.PI / 2, null, damp);
  band(2 * hd - t, (hw - t / 2) + 0.008, y, 0, -Math.PI / 2, null, damp);

  const xw = hw - t / 2, zd = hd - t / 2, wy = h - WEB / 2 - 0.05;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) cornerWeb(sx * xw, sz * zd, -sx, -sz, wy, null, webs);
  }

  for (let i = 0; i < 40; i++) {
    motes.push({
      x: (Math.random() - 0.5) * (2 * hw - 1.2),
      y: 0.15 + Math.random() * (h - 0.5),
      z: (Math.random() - 0.5) * (2 * hd - 1.2),
      a: Math.random() * Math.PI * 2,
      s: 0.00016 + Math.random() * 0.00028,
      r: 0.03 + Math.random() * 0.12
    });
  }

  const anims = [];
  const md = mergeGeometries(damp, false);
  if (md) {
    const m = new THREE.Mesh(md, mats.damp);
    m.receiveShadow = true;
    m.userData.atmo = 'damp';
    group.add(m);
  }
  const mw = mergeGeometries(webs, false);
  if (mw) {
    const m = new THREE.Mesh(mw, mats.web);
    m.renderOrder = 3;
    m.userData.atmo = 'web';
    group.add(m);
  }
  const c = cloud(motes, group, mats);
  c.points.userData.atmo = 'dust';
  /* the hall's own group is never switched off — the cull works on the hub it
     hangs from — so the cloud asks the hub instead */
  anims.push(drifter(c.geo, motes, gate || group));
  return anims;
}
