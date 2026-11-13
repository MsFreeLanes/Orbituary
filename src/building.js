/* ── building ────────────────────────────────────────────────────────────
   The shell: floors, walls with real openings, ceilings, the rotunda drum
   and dome, window frames and glazing, and a plinth for every exhibit.

   Walls are built as runs of boxes with the texture tiling baked into the
   geometry UVs, so one material per surface type serves the whole building
   and nothing is stretched. Every wall opening is a real hole — you can walk
   through it, and the light outside comes through it.

   Both storeys come out of the same builder: the plan says what floor a room
   or a corridor is on, and one offset puts its whole shell on that floor. */
import * as THREE from 'three';
import { S } from './scale.js';
import { LINKS } from './data.js';
import { plaqueAtlas, roomSign, uvRect } from './signage.js';

const TAU = Math.PI * 2;

/* which storey an object's shell is drawn on. the plan says what floor a room
   or a corridor is on; this is the only place that turns that into a height,
   and every room and corridor below hangs its whole group off it, so the
   cellar can sit under the rotunda without a second copy of the builder. */
const yOf = (o) => (o.floor === 'basement' ? S.FLOOR_BASE : 0);

/* a box whose UVs repeat the texture every `scale` metres on every face */
function boxUV(w, h, d, scale) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = faces[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * su / scale, uv.getY(k) * sv / scale);
    }
  }
  uv.needsUpdate = true;
  return g;
}

/* scale an existing geometry's UVs so a texture keeps its real-world tiling
   on curved surfaces (cylinders, spheres, discs) the way boxUV does for walls */
function uvScale(geo, ru, rv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
  uv.needsUpdate = true;
  return geo;
}

function planeUV(w, d, scale) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * w / scale, uv.getY(i) * d / scale);
  }
  uv.needsUpdate = true;
  return g;
}

function mesh(parent, geo, mat, x, y, z, opts) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (opts && opts.cast !== undefined) m.castShadow = opts.cast;
  if (opts && opts.receive !== undefined) m.receiveShadow = opts.receive;
  if (opts && opts.ry !== undefined) m.rotation.y = opts.ry;
  parent.add(m);
  return m;
}

/* A wall running along `run` ('x' or 'z') at the perpendicular coordinate
   `at`, spanning from→to, pierced by openings [{ c, w, y0, y1 }] where c is
   measured along the run. Returns nothing; the boxes go straight into the
   parent group, which keeps the transform stack shallow. */
function addWall(parent, mat, o) {
  const { run, at, from, to, h, t, openings = [], scale = 2.4 } = o;
  const along = (a, b) => {
    if (b - a < 0.01) return;
    const len = b - a, mid = (a + b) / 2;
    const geo = run === 'x' ? boxUV(len, h, t, scale) : boxUV(t, h, len, scale);
    mesh(parent, geo, mat,
      run === 'x' ? mid : at, h / 2, run === 'x' ? at : mid,
      { cast: true, receive: true });
  };
  const sorted = openings.slice().sort((a, b) => a.c - b.c);
  let cursor = from;
  for (const op of sorted) {
    const lo = op.c - op.w / 2, hi = op.c + op.w / 2;
    along(cursor, lo);
    if (op.y0 > 0.01) {
      const geo = run === 'x' ? boxUV(op.w, op.y0, t, scale) : boxUV(t, op.y0, op.w, scale);
      mesh(parent, geo, mat, run === 'x' ? op.c : at, op.y0 / 2, run === 'x' ? at : op.c,
        { cast: true, receive: true });
    }
    if (op.y1 < h - 0.01) {
      const gh = h - op.y1;
      const geo = run === 'x' ? boxUV(op.w, gh, t, scale) : boxUV(t, gh, op.w, scale);
      mesh(parent, geo, mat, run === 'x' ? op.c : at, op.y1 + gh / 2, run === 'x' ? at : op.c,
        { cast: true, receive: true });
    }
    cursor = hi;
  }
  along(cursor, to);
}

/* frame + glazing sitting in an opening */
function addWindow(parent, M, o) {
  const { run, at, c, w, y0, y1, t } = o;
  const glassMat = M.glass;
  const frame = M.solid(0x2b2f36, { roughness: 0.45, metalness: 0.6 });
  const fw = 0.06, fd = 0.10;
  const pane = run === 'x'
    ? new THREE.PlaneGeometry(w - fw * 2, y1 - y0 - fw * 2)
    : new THREE.PlaneGeometry(w - fw * 2, y1 - y0 - fw * 2);
  const m = mesh(parent, pane, glassMat, run === 'x' ? c : at, (y0 + y1) / 2, run === 'x' ? at : c,
    { ry: run === 'x' ? 0 : Math.PI / 2 });
  m.userData.window = true;
  /* the pane must not write depth. it is drawn in the transparent pass, and a
     pane that writes depth at eight metres quietly deletes the entire night
     sky standing three hundred and eighty metres behind it. */
  m.renderOrder = 5;
  const bars = [
    [w, fw, c, y0 + fw / 2], [w, fw, c, y1 - fw / 2],
    [fw, y1 - y0, c - w / 2 + fw / 2, (y0 + y1) / 2], [fw, y1 - y0, c + w / 2 - fw / 2, (y0 + y1) / 2],
    [fw * 0.7, y1 - y0, c, (y0 + y1) / 2]           // centre mullion
  ];
  for (const [bw, bh, bx, by] of bars) {
    const geo = run === 'x' ? new THREE.BoxGeometry(bw, bh, fd) : new THREE.BoxGeometry(fd, bh, bw);
    mesh(parent, geo, frame, run === 'x' ? bx : at, by, run === 'x' ? at : bx, { cast: false });
  }
  /* a sill lip, the way a real window has one */
  const sillGeo = run === 'x'
    ? new THREE.BoxGeometry(w + 0.16, 0.05, t + 0.14)
    : new THREE.BoxGeometry(t + 0.14, 0.05, w + 0.16);
  mesh(parent, sillGeo, M.solid(0x8a857c, { roughness: 0.6 }),
    run === 'x' ? c : at, y0 - 0.02, run === 'x' ? at : c, { cast: false, receive: true });
}

/* every lamp in the building shares two materials: a dark metal shade and a
   warm emissive disc. The disc sits above the bloom threshold so the light
   source itself glows, which is what makes a ceiling read as lit. */
function lampMats(M) {
  return {
    shade: M.solid(0x2a2c31, { roughness: 0.45, metalness: 0.7 }),
    glow: new THREE.MeshStandardMaterial({
      color: 0x14161a, emissive: 0xffe3b8, emissiveIntensity: 1.2, roughness: 0.5, metalness: 0
    })
  };
}

/* Downstairs the lamps are a different fitting: a cold tube in a steel shade,
   because there is no window to blend with and no colour in the room to warm
   up. Where the plan says the tube is failing (`room.flicker`) the room gets
   its own material so it can fail on its own; the warm set stays shared by
   the whole ground floor, so nothing upstairs recompiles. */
function lampsFor(M, warm, o) {
  if (o.floor !== 'basement') return warm;
  if (!o._lamps) {
    const glow = new THREE.MeshStandardMaterial({
      color: 0x0f1216, emissive: 0xa9c8e8, emissiveIntensity: 1.15, roughness: 0.35, metalness: 0
    });
    if (o.flicker) {
      /* a failing starter, not a strobe: the tube holds steady and drops out
         now and then, more often the harder it is trying, and never goes fully
         dark — a dead lamp leaves a black hole in every photograph of the room */
      const base = glow.emissiveIntensity, k = o.flicker;
      const seed = (o.id || '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
      glow.onBeforeRender = () => {
        const slot = Math.floor(performance.now() / 90);
        const r = Math.abs(Math.sin(slot * 12.9898 + seed) * 43758.5453) % 1;
        glow.emissiveIntensity = r < k * 0.3 ? base * 0.16 : base * (0.9 + 0.1 * r);
      };
    }
    o._lamps = { shade: M.solid(0x23262b, { roughness: 0.4, metalness: 0.75 }), glow };
  }
  return o._lamps;
}

/* a pendant: stem from the ceiling, a shallow shade, a glowing face under it */
function addPendant(g, L, x, y, z, ceil, r) {
  mesh(g, new THREE.CylinderGeometry(0.014, 0.014, ceil - y, 6), L.shade, x, (y + ceil) / 2, z, { cast: false });
  mesh(g, new THREE.CylinderGeometry(r, r * 0.62, 0.07, 20), L.shade, x, y, z, { cast: false });
  const face = mesh(g, new THREE.CircleGeometry(r * 0.66, 20), L.glow, x, y - 0.038, z, { cast: false });
  face.rotation.x = Math.PI / 2;
}

/* a downlight recessed into a ceiling: a ring and a glowing disc */
function addDownlight(g, L, x, y, z, r) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.15, 0.022, 6, 20), L.shade);
  ring.position.set(x, y - 0.012, z);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const face = mesh(g, new THREE.CircleGeometry(r, 16), L.glow, x, y - 0.02, z, { cast: false });
  face.rotation.x = Math.PI / 2;
}

/* a wall sconce: a small metal box with a glowing lip, for the rotunda piers */
function addSconce(g, L, x, y, z, a) {
  const body = mesh(g, new THREE.BoxGeometry(0.16, 0.30, 0.09), L.shade, x, y, z, { cast: false, ry: a });
  const lip = mesh(g, new THREE.BoxGeometry(0.13, 0.03, 0.07), L.glow, x, y + 0.17, z, { cast: false, ry: a });
  return [body, lip];
}

/* each room type gets a different ceiling, so twelve rooms do not read as one.
   Everything hangs below the ceiling plane, so the light anchors stay valid. */
function addCeiling(g, L, M, room) {
  const w = room.w, d = room.d, h = room.ceil, zc = d / 2;
  const key = room.ceilKey;

  if (key === 'beam') {
    const beamMat = M.solid(0x3e3126, { roughness: 0.78, metalness: 0.02 });
    for (let i = 1; i <= 4; i++) {
      mesh(g, new THREE.BoxGeometry(w - 0.3, 0.26, 0.22), beamMat, 0, h - 0.13, (i / 5) * d, { cast: false });
    }
  } else if (key === 'coffer') {
    const rib = M.solid(0x8d8980, { roughness: 0.72 });
    for (let i = 1; i <= 2; i++) {
      mesh(g, new THREE.BoxGeometry(w - 0.4, 0.16, 0.14), rib, 0, h - 0.08, (i / 3) * d, { cast: false });
      mesh(g, new THREE.BoxGeometry(0.14, 0.16, d - 0.4), rib, (i - 1.5) * (w / 3), h - 0.08, zc, { cast: false });
    }
  } else if (key === 'tray') {
    const panel = M.solid(0x191b20, { roughness: 0.9 });
    const iw = w - 2.4, id = d - 2.4;
    const p = mesh(g, planeUV(iw, id, 2.6), panel, 0, h - 0.32, zc, { cast: false });
    p.rotation.x = Math.PI / 2;
    const edge = M.solid(0x24262c, { roughness: 0.85 });
    const rim = [
      [iw, 0.06, 0, zc - id / 2], [iw, 0.06, 0, zc + id / 2],
      [0.06, id, -iw / 2, zc], [0.06, id, iw / 2, zc]
    ];
    for (const [bw, bd, bx, bz] of rim) {
      mesh(g, new THREE.BoxGeometry(bw, 0.32, bd), edge, bx, h - 0.16, bz, { cast: false });
      mesh(g, new THREE.BoxGeometry(bw * 0.94, 0.04, bd * 0.94), L.glow, bx, h - 0.31, bz, { cast: false });
    }
  } else if (key === 'gallery') {
    for (const sx of [-1, 1]) {
      for (let i = 1; i <= 3; i++) addDownlight(g, L, sx * (w / 4), h - 0.01, (i / 4) * d, 0.08);
    }
  } else if (key === 'clerestory') {
    for (const sx of [-1, 1]) {
      mesh(g, new THREE.BoxGeometry(0.05, 0.11, d - 1.4), L.glow, sx * (w / 2 - 0.16), h - 0.46, zc, { cast: false });
    }
  }
}

function addPlinth(parent, M, room, spot, i) {
  const h = S.PLINTH_H, w = S.PLINTH_W;
  const g = new THREE.Group();
  g.position.set(spot.u, 0, spot.v);
  g.rotation.y = spot.face;
  const body = M.solid(0x6f6b62, { roughness: 0.55, metalness: 0.02 });
  mesh(g, boxUV(w, h, w, 1.2), body, 0, h / 2, 0, { cast: true, receive: true });
  mesh(g, boxUV(w + 0.08, 0.05, w + 0.08, 1.2), body, 0, h + 0.025, 0, { cast: true });
  mesh(g, boxUV(w + 0.12, 0.07, w + 0.12, 1.2), body, 0, 0.035, 0, { cast: true, receive: true });
  /* the wall label, on the face that looks back at the door. one atlas per
     room, so 88 labels are 12 textures and one material each */
  if (room._cells && room._cells[i] && room._labelMat) {
    const geo = uvRect(new THREE.PlaneGeometry(0.44, 0.22), room._cells[i]);
    mesh(g, geo, room._labelMat, 0, 0.66, w / 2 + 0.008, { cast: false });
  }
  /* the colour puck: this is how you know which room you are in from a glance.
     one material per room, so an ambient event can light a whole room at once.
     it is an inlay, not a lamp — the room colour mixed back toward stone, and
     just enough emissive to find in the dark. at full saturation these read as
     neon plates and the room stops looking like a building. */
  if (!room._puckMat) {
    const c = room.color, k = 0.5, g = 82;
    const mix = (v) => Math.round(v * k + g * (1 - k));
    const inlay = (mix(c >> 16 & 255) << 16) | (mix(c >> 8 & 255) << 8) | mix(c & 255);
    room._puckMat = new THREE.MeshStandardMaterial({
      color: inlay,
      emissive: inlay,
      emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.1
    });
  }
  mesh(g, new THREE.CylinderGeometry(0.09, 0.09, 0.012, 24), room._puckMat, 0, h + 0.055, 0);
  parent.add(g);
  return g;
}

function buildRoom(parent, plan, M, room, pickables, L) {
  const g = new THREE.Group();
  /* one offset for the whole room: the slab, the four walls, the ceiling, the
     plinths, the sign and the pendant all hang off this group, so a cellar
     room goes down a storey without a single mesh having to know about it */
  g.position.set(room.entry.x, yOf(room), room.entry.z);
  g.rotation.y = room.angle;
  parent.add(g);

  const lamps = lampsFor(M, L, room);
  const wallMat = M.mat(room.wall, 1, 1);
  /* room.floor is now which storey the room is on; room.floorMat is what the
     surface underfoot is made of. The fallback is for any room still carrying
     the old key. */
  const floorMat = M.mat(room.floorMat || room.floor, 1, 1);
  /* the ceiling is always a darker surface than the walls: a lamp hanging in
     a room will always find the ceiling closest, and a bright plaster slab
     overhead is the surest way to flatten the whole picture */
  const ceilMat = M.mat('plasterDark', 1, 1);
  const t = S.WALL_T, h = room.ceil;

  /* floor and ceiling */
  const floor = mesh(g, planeUV(room.w, room.d, 2.2), floorMat, 0, 0, room.d / 2,
    { receive: true });
  floor.rotation.set(-Math.PI / 2, 0, 0);
  /* the ceiling has to cast: the moon is a directional light, and a roof that
     throws no shadow is a roof that lets the whole sky pour into the room.
     for a cellar room this one sheet is the slab the ground floor stands on,
     so it stays unbroken: the corridor ceiling out there is at the same height
     on the same storey, and the joint at the doorway lets no light through */
  const ceil = mesh(g, planeUV(room.w, room.d, 2.6), ceilMat, 0, h, room.d / 2,
    { cast: true, receive: true });
  ceil.rotation.set(Math.PI / 2, 0, 0);

  /* four walls: door wall at z=0, window wall at z=d, sides at x=±w/2 */
  addWall(g, wallMat, {
    run: 'x', at: 0, from: -room.w / 2, to: room.w / 2, h, t,
    openings: [{ c: 0, w: room.door.w, y0: 0, y1: room.door.h }], scale: 2.4
  });
  addWall(g, wallMat, {
    run: 'x', at: room.d, from: -room.w / 2, to: room.w / 2, h, t,
    openings: room.windows.map((win) => ({
      c: win.u, w: room.winW, y0: room.winSill, y1: room.winSill + room.winH
    })), scale: 2.4
  });
  addWall(g, wallMat, { run: 'z', at: -room.w / 2, from: -t, to: room.d + t, h, t, openings: [], scale: 2.4 });
  addWall(g, wallMat, { run: 'z', at: room.w / 2, from: -t, to: room.d + t, h, t, openings: [], scale: 2.4 });

  for (const win of room.windows) {
    addWindow(g, M, {
      run: 'x', at: room.d, c: win.u, w: room.winW,
      y0: room.winSill, y1: room.winSill + room.winH, t
    });
  }

  /* words on the walls: a plate over the door for the corridor, and one
     atlas of wall labels for every plinth in here */
  if (room.items.length && !room._labelMat) {
    const atlas = plaqueAtlas(room, LINKS, THREE, 4);
    room._cells = atlas.cells;
    room._labelMat = new THREE.MeshStandardMaterial({
      map: atlas.tex, emissive: 0xffffff, emissiveMap: atlas.tex,
      emissiveIntensity: 0.40, roughness: 0.7, metalness: 0
    });
  }
  const signY = room.door.h + 0.32;
  if (signY < room.ceil - 0.45) {
    if (!room._signMat) {
      const signTex = roomSign(Object.assign({ no: plan.rooms.indexOf(room) + 1 }, room), THREE, 4);
      room._signMat = new THREE.MeshStandardMaterial({
        map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.5,
        roughness: 0.8, side: THREE.DoubleSide
      });
    }
    mesh(g, new THREE.PlaneGeometry(1.44, 0.36), room._signMat,
      0, signY, -S.WALL_T / 2 - 0.02, { cast: false, ry: Math.PI });
  }

  addCeiling(g, lamps, M, room);
  /* the pendant the room's key light hangs from. The group origin is the door,
     local +Z runs into the room, so the room centre is (0, ?, d/2). A cellar
     ceiling is too low to hang anything from, so there the tube sits back
     against the slab the way a service room's does. */
  addPendant(g, lamps, 0, room.ceil - (room.ceil > S.CEIL_BASE ? 1.6 : 0.5),
    room.d / 2, room.ceil, room.kind === 'hall' ? 0.26 : 0.17);

  room.plinths.forEach((spot, i) => {
    const node = addPlinth(g, M, room, spot, i);
    node.userData.exhibit = { room: room.id, link: room.items[i], spot };
    spot.node = node;
    pickables.push(node);
  });
  room.group = g;
  return g;
}

/* Where a corridor's shell begins. The plan puts a corridor's own start (`t0`)
   at the centre of whatever it grows out of, so the walls have to begin
   further out, at that hall's wall. The stair hall is already in the plan's
   walkable record — reading the edge there is what keeps the shell and the
   walkable union from disagreeing about where the four cellar doors are. */
function hallWall(plan, c) {
  const hall = plan.walkable.rects.find((r) => r.room === plan.stair.to);
  if (!hall) return c.t0;
  const st = Math.sin(hall.angle), ct = Math.cos(hall.angle);
  const lx = Math.abs(c.dir.x * ct - c.dir.z * st);   // the arm, in the hall's frame
  const lz = Math.abs(c.dir.x * st + c.dir.z * ct);
  return c.t0 + Math.min(lx > 1e-6 ? hall.halfX / lx : Infinity,
    lz > 1e-6 ? hall.halfZ / lz : Infinity);
}

function buildCorridor(parent, M, corridor, L, plan) {
  const g = new THREE.Group();
  g.position.set(0, yOf(corridor), 0);
  g.rotation.y = Math.atan2(corridor.dir.x, corridor.dir.z);
  parent.add(g);

  const lamps = lampsFor(M, L, corridor);
  const t = S.WALL_T, h = corridor.ceil, half = corridor.half;
  /* a ground range starts inside the drum, under the arch; a cellar arm starts
     at the wall of the stair hall it opens off */
  const z0 = corridor.floor === 'basement' ? hallWall(plan, corridor) : S.ROTUNDA_R - 0.4;
  const z1 = corridor.t1;

  const floor = mesh(g, planeUV(half * 2, z1 - z0, 2.2), M.mat('terrazzo', 1, 1), 0, 0, (z0 + z1) / 2);
  floor.rotation.set(-Math.PI / 2, 0, 0);
  floor.receiveShadow = true;
  /* the same sheet the cellar rooms' ceilings are cut from, at the same height,
     so the slab over your head runs the length of the arm without a joint */
  const ceil = mesh(g, planeUV(half * 2, z1 - z0, 2.6), M.mat('plasterDark', 1, 1), 0, h, (z0 + z1) / 2,
    { cast: true, receive: true });
  ceil.rotation.set(Math.PI / 2, 0, 0);

  addWall(g, M.mat('plaster', 1, 1), { run: 'z', at: -half, from: z0, to: z1, h, t, openings: [], scale: 2.4 });
  addWall(g, M.mat('plaster', 1, 1), { run: 'z', at: half, from: z0, to: z1, h, t, openings: [], scale: 2.4 });

  /* the same downlights the light pool follows, so the black ceiling reads as
     lit. the pool's anchors are still laid out for the ground ranges, so the
     cellar lamps keep their own spacing from the near end of the shell. */
  const first = corridor.floor === 'basement' ? z0 + 1.4 : S.ROTUNDA_R + 1.5;
  for (let p = first; p < corridor.t1; p += 3.6) addDownlight(g, lamps, 0, h - 0.01, p, 0.11);
  corridor.group = g;
  return g;
}

function buildRotunda(parent, plan, M, pickables, L) {
  const g = new THREE.Group();
  parent.add(g);
  const R = S.ROTUNDA_R, h = S.CEIL_ROTUNDA;
  const marble = M.mat('marble', 1, 1);
  const wallMat = M.mat('marbleDark', 1, 1);

  const floor = mesh(g, planeUV(R * 2, R * 2, 2.4), marble, 0, 0, 0);
  floor.geometry = uvScale(new THREE.CircleGeometry(R, 64), (R * 2) / 2.4, (R * 2) / 2.4);
  floor.rotation.set(-Math.PI / 2, 0, 0);
  floor.receiveShadow = true;

  /* the drum, pierced by four arches one per range */
  const half = Math.asin(S.CORRIDOR_W / 2 / R);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const start = a + half, span = TAU / 4 - half * 2;
    const seg = uvScale(new THREE.CylinderGeometry(R, R, h, 24, 1, true, start, span),
      (R * span) / 2.4, h / 2.4);
    const m = new THREE.Mesh(seg, wallMat);
    m.position.y = h / 2;
    m.material.side = THREE.DoubleSide;
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);

    /* the arch above each doorway */
    const lintelH = h - S.DOOR_BIG_H;
    const lintel = uvScale(new THREE.CylinderGeometry(R, R, lintelH, 8, 1, true, a - half, half * 2),
      (R * half * 2) / 2.4, lintelH / 2.4);
    const lm = new THREE.Mesh(lintel, wallMat);
    lm.position.y = S.DOOR_BIG_H + lintelH / 2;
    g.add(lm);
  }

  /* dome with an oculus, sitting on the drum. the oculus is the one place in
     this building where the sky is not framed by a window: stand in the middle
     of the rotunda and the star map is directly overhead */
  const thetaHole = 0.30;
  const dome = new THREE.Mesh(
    uvScale(new THREE.SphereGeometry(R, 48, 24, 0, TAU, thetaHole, Math.PI / 2 - thetaHole),
      (TAU * R) / 2.6, (R * (Math.PI / 2 - thetaHole)) / 2.6),
    new THREE.MeshStandardMaterial({ map: M.textureFor('plaster'), side: THREE.DoubleSide, roughness: 0.92, color: 0xa9a49a })
  );
  dome.scale.y = S.DOME_RISE / R;
  dome.position.y = h;
  dome.castShadow = true;
  dome.receiveShadow = true;
  g.add(dome);

  /* ribs along the meridians: eight torus arcs, each one the curve the dome
     already follows, so the bowl reads as built rather than printed */
  const ribMat = M.solid(0x8e897f, { roughness: 0.85 });
  for (let i = 0; i < 8; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(R - 0.06, 0.11, 6, 22, Math.PI / 2 - thetaHole), ribMat);
    rib.scale.y = S.DOME_RISE / R;
    rib.position.y = h;
    rib.rotation.y = (i / 8) * TAU + TAU / 16;
    g.add(rib);
  }
  /* a cornice ring where the dome meets the drum, the usual place for a moulding */
  const cornice = new THREE.Mesh(new THREE.TorusGeometry(R - 0.10, 0.14, 8, 64), ribMat);
  cornice.position.y = h + 0.06;
  cornice.rotation.x = Math.PI / 2;
  g.add(cornice);

  const oculusR = R * Math.sin(thetaHole);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(oculusR, 0.16, 10, 64), M.solid(0xb9a06a, { roughness: 0.35, metalness: 0.8 }));
  ring.position.y = h + R * Math.cos(thetaHole) * (S.DOME_RISE / R);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  /* pilasters marking the four axes, so the doorways read as doorways */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const p = mesh(g, boxUV(0.5, h, 0.5, 1.6), M.solid(0xa9a49a, { roughness: 0.5 }),
      Math.sin(a) * (R - 0.28), h / 2, Math.cos(a) * (R - 0.28), { cast: true, receive: true });
    p.rotation.y = a;
    addSconce(g, L, Math.sin(a) * (R - 0.66), 2.6, Math.cos(a) * (R - 0.66), a);
  }

  /* one big pendant under the oculus, so the hall has a single bright object */
  addPendant(g, L, 0, S.CEIL_ROTUNDA - 0.8, 0, S.CEIL_ROTUNDA + S.DOME_RISE, 0.34);

  plan.rotunda.plinths.forEach((spot, i) => {
    const node = addPlinth(g, M, plan.rotunda, spot);
    node.userData.exhibit = { room: 'rotunda', link: null, spot };
    spot.node = node;
    pickables.push(node);
  });
  plan.rotunda.group = g;
  return g;
}

function buildGrounds(parent, M, plan) {
  /* the courtyard stops well short of the sky dome on purpose: a window that
     looks out onto gravel all the way to the horizon shows you a floor, not a
     night sky, and the whole point of the glazing is the sky */
  const ground = new THREE.Mesh(planeUV(240, 240, 4), M.mat('gravel', 1, 1));
  ground.rotation.set(-Math.PI / 2, 0, 0);
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  parent.add(ground);

  /* low courtyard walls in the diagonal quadrants: the windows need something
     to look at before the planting goes in */
  const low = M.solid(0x54564f, { roughness: 0.85 });
  const d = plan.reach * 0.72;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const wall = mesh(parent, boxUV(16, 1.6, 0.4, 2.4), low,
      Math.sin(a) * d, 0.8, Math.cos(a) * d, { cast: true, receive: true });
    wall.rotation.y = a;
  }
  return ground;
}

export function buildBuilding(THREE, plan, M) {
  const group = new THREE.Group();
  const pickables = [];
  const L = lampMats(M);
  buildGrounds(group, M, plan);
  buildRotunda(group, plan, M, pickables, L);
  plan.corridors.forEach((corridor) => buildCorridor(group, M, corridor, L, plan));
  plan.rooms.forEach((room) => buildRoom(group, plan, M, room, pickables, L));
  return { group, pickables };
}
