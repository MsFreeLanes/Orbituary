/* ── lighting ────────────────────────────────────────────────────────────
   A fixed pool of lights that gets handed around the building as the visitor
   moves through it. The count never changes, so the shaders never recompile
   mid-walk; what changes is where each light sits and what colour it is, and
   those cross-fade, so a room fades up as you step in and down behind you.

   An anchor belongs to a storey. A cellar room's fixtures hang off a slab
   3.60 m under the ground floor, so a height built from `room.ceil` alone
   puts the lamp in the gallery upstairs and leaves the cellar rendering
   black with a light stuck in its ceiling. Every height here is measured up
   from the room's own slab, and the pool only takes anchors from the storey
   the visitor's feet are on. The head of the stair is the one anchor stamped
   on both storeys, because it hangs in a shaft that pierces them.

   Finding the anchors is a lookup, not a scan. Two storeys of this plan is
   458 anchors, and reading every one of them every frame measured 3.4 µs a
   frame — and allocated a 458-entry array to do it, which is a frame's worth
   of garbage sixty times a second. Small next to a draw call, but it is
   arithmetic spent on lamps on the far side of the building and under the
   floor. So the anchors are grouped by the space they belong to, the spaces
   are stamped onto a grid once at build, and a frame reads the nine cells
   around the visitor: the room it is standing in plus the rooms next door.

   One directional light carries the moon and throws the window openings
   onto the floor. That single shadow map is the whole trick that makes the
   night outside feel like it is actually outside, and it follows the visitor
   rather than covering the plan: a 2048 map stretched over a 100 m building
   is six centimetres a texel, and window bars at six centimetres a texel are
   not window bars. */
import * as THREE from 'three';
import { S } from './scale.js';

const POOL = 10;

/* the storey line is the middle of the flight: feet above it are upstairs,
   feet below it are in the cellar, and halfway down the stairs is exactly
   where the rotunda stops being the room you are in. */
const STOREY_Y = S.FLOOR_BASE / 2;
const CELL = 5.00;        // metres. one cell holds a room and the room next door
const CELL_SPAN = 1024;   // a grid key packs two signed cell indices into one int

const baseOf = (o) => (o.floor === 'basement' ? S.FLOOR_BASE : S.FLOOR_GROUND);

/* a fixture's height, asked of the room it stands in: measured up from that
   room's slab, and never pushed through the ceiling over it. the cellar has
   3.20 m of clear ceiling against a gallery's 4.20, so a sconce that is
   comfortably at 2.35 upstairs would be buried in the plaster downstairs. */
const fixtureY = (o, want) => baseOf(o) + Math.min(want, o.ceil - 0.55);

/* Where a cellar arm's shell begins. The plan starts a corridor at the centre
   of the hall it grows out of, and building.js starts the walls at that hall's
   wall; the pool's downlights have to sit under the ones you can see, so it
   needs the same line. The stair hall's own walkable rect is the one place the
   two of them already agree, so it is read from there rather than re-derived
   from a constant that could drift. */
function hallWall(plan, c) {
  const hall = plan.walkable.rects.find((r) => r.room === plan.stair.to);
  if (!hall) return c.t0;
  const st = Math.sin(hall.angle), ct = Math.cos(hall.angle);
  const lx = Math.abs(c.dir.x * ct - c.dir.z * st);   // the arm, in the hall's frame
  const lz = Math.abs(c.dir.x * st + c.dir.z * ct);
  return c.t0 + Math.min(lx > 1e-6 ? hall.halfX / lx : Infinity,
    lz > 1e-6 ? hall.halfZ / lz : Infinity);
}

/* intensities are in candela: three has used physical light units since r155,
   so a lamp needs tens of candela to light a 12 m room, and the falloff is a
   true 1/d². That is what gives the building its pools of light and the dark
   stretches of wall in between. */
function roomAnchors(room, skyTint) {
  const A = [];
  const key = {
    x: room.center.x, z: room.center.z, y: baseOf(room) + room.ceil - 1.6,
    color: room.key, i: room.keyI * 11, r: Math.max(room.w, room.d) * 1.4, room: room.id
  };
  /* the plan says how hard this room's tube is trying. materials.js already
     dims the fitting's glow with it; the light has to sag with it too, or a
     tube that is visibly failing still pours the same candela into the room
     and the flicker reads as a dirty lens rather than a dying lamp. */
  if (room.flicker) key.flicker = room.flicker;
  A.push(key);
  room.windows.forEach((win) => {
    A.push({
      x: win.x + room.n.x * 0.4, z: win.z + room.n.z * 0.4,
      y: baseOf(room) + win.sill + win.h * 0.45,
      color: skyTint, i: 3.0, r: 7.5, room: room.id, cold: true
    });
  });
  A.push({
    x: room.entry.x + room.n.x * 0.8, z: room.entry.z + room.n.z * 0.8,
    y: fixtureY(room, 2.35), color: room.color, i: 3.5, r: 5.5, room: room.id
  });
  /* wall washers. a lamp in the middle of a room lights the floor and leaves
     the walls black, which is the one thing that makes a 3d room look like a
     photograph of a hole. real museums run small fixtures close to the walls
     for exactly this: the falloff is steep, so the wall gets a wash and the
     floor barely notices. */
  const sw = Math.max(0.7, room.w / 2 - 0.7);
  [-1, 1].forEach((s) => {
    A.push({
      x: room.center.x + room.u.x * sw * s, z: room.center.z + room.u.z * sw * s,
      y: fixtureY(room, 2.35), color: room.key, i: 2.2, r: 5.0, room: room.id, wash: true
    });
  });
  /* the far wall is the one you walk towards and the one a photograph of the
     room is really about, so it gets its own fixture. a room lit only from
     the middle has a bright floor and a black backdrop. */
  A.push({
    x: room.center.x + room.n.x * (room.d / 2 - 0.9),
    z: room.center.z + room.n.z * (room.d / 2 - 0.9),
    y: fixtureY(room, 2.6), color: room.key, i: 3.0, r: 6.5, room: room.id, wash: true
  });
  return A;
}

function corridorAnchors(c, start) {
  const A = [];
  /* the pool's lights sit under the fixtures building.js screws into the
     soffit, which for a cellar arm is the first thing past the stair hall's
     wall rather than the first thing outside the drum */
  const first = c.floor === 'basement' ? start + 1.4 : S.ROTUNDA_R + 1.5;
  for (let t = first; t < c.t1; t += 3.6) {
    A.push({
      x: c.dir.x * t, z: c.dir.z * t, y: baseOf(c) + c.ceil - 0.25,
      color: 0xffe9cf, i: 4.0, r: 5.2, room: 'corridor'
    });
  }
  return A;
}

/* the Stair Hall. the plan records it as a walkable rect rather than a room,
   so nothing else in the building knows it exists and the cellar doors all
   opened onto a black box. its one visible fitting is the cold tube north of
   the well, and building.js already gives that a light of its own; these
   anchors are the pool's share — enough to carry the four door mouths and the
   foot of the flight, not enough to double the hall out. */
function hallAnchors(hall) {
  /* the same height as the tube building.js hangs north of the well */
  const y = S.FLOOR_BASE + S.CEIL_BASE - 0.62;
  return [
    { x: 0, z: 1.4, y, color: 0xa9c8e8, i: 9, r: 11, room: 'stair-hall' },
    { x: 0, z: hall.cz - hall.halfZ + 1.0, y, color: 0xa9c8e8, i: 4, r: 6, room: 'stair-hall' },
    { x: hall.cx - hall.halfX + 1.0, z: 0, y, color: 0xa9c8e8, i: 3, r: 6, room: 'stair-hall' },
    { x: hall.cx + hall.halfX - 1.0, z: 0, y, color: 0xa9c8e8, i: 3, r: 6, room: 'stair-hall' }
  ];
}

/* one anchor at the head of the flight and one at its foot, in two halves of
   the well. the descent is the only place in the building where you are
   between two rooms, and with the pool filtered by storey it would otherwise
   be lit by neither: the head fixture hangs in the shaft and throws the light
   down, the foot fixture sits over the landing and throws it back up the
   treads. the head half is stamped on both storeys, because a shaft belongs to
   whichever end you are looking from; the foot half stays in the cellar, so a
   fixture under the ground slab never joins the pool upstairs. */
function stairSpaces(add, s) {
  const half = { halfX: s.w / 2, angle: 0 };
  add('both', [{
    cx: s.x, cz: s.z + s.run * 0.25, halfZ: s.run * 0.25 + S.STAIR_LAND, ...half
  }]).anchors.push({ x: s.x, z: s.z + 0.4, y: 1.90, color: 0xdfe8f8, i: 11, r: 9, room: 'stair' });
  add('basement', [{
    cx: s.x, cz: s.z + s.run * 0.75, halfZ: s.run * 0.25 + S.STAIR_LAND, ...half
  }]).anchors.push({
    x: s.x, z: s.z + s.run - 0.4, y: S.FLOOR_BASE + 2.50, color: 0xa9c8e8, i: 9, r: 8, room: 'stair'
  });
}

function rotundaAnchors() {
  const A = [{ x: 0, z: 0, y: S.CEIL_ROTUNDA - 0.8, color: 0xfff2dd, i: 18, r: 16, room: 'rotunda' }];
  /* a cove ring high on the drum. the sconces light the floor and your face;
     without something up high the wall above eye level and the whole dome
     above it go black, and the room stops reading as a tall one. */
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    A.push({
      x: Math.sin(a) * (S.ROTUNDA_R - 1.5), z: Math.cos(a) * (S.ROTUNDA_R - 1.5),
      y: S.CEIL_ROTUNDA - 1.4, color: 0xffeccf, i: 5.5, r: 9, room: 'rotunda', cove: true
    });
  }
  /* eight sconces on the rotunda piers, matching the fixtures in building.js */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    A.push({
      x: Math.sin(a) * (S.ROTUNDA_R - 0.66), z: Math.cos(a) * (S.ROTUNDA_R - 0.66),
      y: 2.77, color: 0xffe3b8, i: 3.5, r: 6, room: 'rotunda'
    });
  }
  return A;
}

/* One space the pool can be handed around: a room, a corridor, the rotunda,
   the Stair Hall or the flight itself. Its anchors are built once, here, and
   its footprint is what the frame looks a space up by. */
function spacesFor(plan, skyTint) {
  const spaces = [];
  const add = (storey, rects) => {
    const s = { storey, rects, anchors: [] };
    spaces.push(s);
    return s;
  };

  plan.rooms.forEach((room) => {
    const s = add(room.floor, [
      { cx: room.center.x, cz: room.center.z, halfX: room.w / 2, halfZ: room.d / 2, angle: room.angle },
      /* the doorway counts as part of the room, so standing in the corridor
         still reaches the anchors of the room whose door you are in */
      { cx: room.entry.x, cz: room.entry.z, halfX: room.door.w / 2, halfZ: S.DOOR_DEPTH, angle: room.angle }
    ]);
    s.anchors = roomAnchors(room, skyTint);
  });

  plan.corridors.forEach((c) => {
    const len = c.t1 - c.t0;
    const s = add(c.floor, [{
      cx: c.dir.x * (c.t0 + len / 2), cz: c.dir.z * (c.t0 + len / 2),
      halfX: c.half, halfZ: len / 2, angle: Math.atan2(c.dir.x, c.dir.z)
    }]);
    s.anchors = corridorAnchors(c, hallWall(plan, c));
  });

  const hall = plan.walkable.rects.find((r) => r.room === plan.stair.to);
  if (hall) {
    const s = add('basement', [hall]);
    s.anchors = hallAnchors(hall);
  }
  stairSpaces(add, plan.stair);

  const rot = add('ground', [{ cx: 0, cz: 0, halfX: S.ROTUNDA_R, halfZ: S.ROTUNDA_R, angle: 0 }]);
  rot.anchors = rotundaAnchors();
  return spaces;
}

/* Stamp every space onto the grid. A cell holds the spaces whose footprint
   touches it, so the frame's nine cells around the visitor are literally the
   room it is standing in plus the rooms next door. Footprints are stamped by
   their true bounding box, with a doorway's depth of slack so a space's
   anchors reach through its own doors. */
function gridFor(spaces) {
  const grid = new Map();
  spaces.forEach((s, i) => {
    s.rects.forEach((r) => {
      const st = Math.abs(Math.sin(r.angle)), ct = Math.abs(Math.cos(r.angle));
      const ex = ct * r.halfX + st * r.halfZ + S.DOOR_DEPTH;
      const ez = st * r.halfX + ct * r.halfZ + S.DOOR_DEPTH;
      for (let ix = Math.floor((r.cx - ex) / CELL); ix <= Math.floor((r.cx + ex) / CELL); ix++) {
        for (let iz = Math.floor((r.cz - ez) / CELL); iz <= Math.floor((r.cz + ez) / CELL); iz++) {
          const list = grid.get(ix * CELL_SPAN + iz);
          if (list) { if (!list.includes(i)) list.push(i); } else grid.set(ix * CELL_SPAN + iz, [i]);
        }
      }
    });
  });
  return grid;
}

export function createLighting(THREE, plan) {
  const skyTint = 0x9fc0ff;
  const hemi = new THREE.HemisphereLight(0x2a3a58, 0x14161c, 0.42);

  const moon = new THREE.DirectionalLight(0xbfd4ff, 0.5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const span = S.SHADOW_SPAN;
  const moonR = plan.reach * 1.6;   // how far off the light sits from its target
  const cam = moon.shadow.camera;
  cam.left = -span; cam.right = span;
  cam.top = span; cam.bottom = -span;
  cam.near = 1; cam.far = moonR + span * 2;
  /* three never refreshes a directional shadow's orthographic projection, so
     the box set above is not the box you get until you ask for it. left at its
     default the map covers ±5 m around the target, which on a 100 m plan means
     the moon throws no window openings anywhere the visitor actually is. */
  cam.updateProjectionMatrix();
  moon.shadow.bias = -0.0009;
  moon.shadow.normalBias = 0.03;

  const pool = [];
  for (let i = 0; i < POOL; i++) {
    const p = new THREE.PointLight(0xffffff, 0, 12, 2);
    p.userData.anchor = null;
    /* the cross-faded intensity, before the flicker is folded in. the fade
       smooths over about a quarter of a second, which would iron out a tube
       that sags and catches, so the sag is applied after it. */
    p.userData.base = 0;
    pool.push(p);
  }

  const spaces = spacesFor(plan, skyTint);
  const anchors = spaces.reduce((all, s) => all.concat(s.anchors), []);
  /* an anchor's colour never changes, so it is taken out of sRGB and into the
     working space once here. doing it in the fade instead costs a colour
     conversion per light per frame, which is most of what the fade costs. */
  anchors.forEach((a) => { a.rgb = new THREE.Color(a.color); });
  const grid = gridFor(spaces);
  const stamp = new Int32Array(spaces.length).fill(-1);
  let generation = 0;
  let scanned = 0;
  let clock = 0;

  const assigned = new Array(POOL).fill(null);
  const bestA = new Array(POOL).fill(null);
  const bestD = new Array(POOL).fill(Infinity);
  /* the moon's shadow box follows the visitor. it is snapped to half a metre
     so the texel grid does not crawl under their feet every frame, and it is
     centred on the floor they are standing on, so the cellar sits in the
     middle of the depth range when they are down there rather than clipped
     off the end of it. */
  const SNAP = 0.5;
  const moonDir = new THREE.Vector3(0, 1, 0);
  const visitor = new THREE.Vector3(0, 0, 0);
  const shadowAt = new THREE.Vector3(Number.NaN, 0, Number.NaN);
  const white = new THREE.Color(0xffffff);

  function placeMoon() {
    const x = Math.round(visitor.x / SNAP) * SNAP;
    const z = Math.round(visitor.z / SNAP) * SNAP;
    const y = Math.round((visitor.y - S.EYE_H) / SNAP) * SNAP;
    if (x === shadowAt.x && y === shadowAt.y && z === shadowAt.z) return;
    shadowAt.set(x, y, z);
    moon.target.position.set(x, y, z);
    moon.position.set(x + moonDir.x, y + moonDir.y, z + moonDir.z);
  }

  function setMoonDirection(state) {
    /* the moonlight comes from wherever the sky has actually put the moon;
       when it has set we keep the bearing and lift it above the roofline */
    const r = moonR;
    if (state.moonDir) {
      const d = state.moonDir;
      const len = Math.hypot(d[0], d[2]) || 1;
      const lift = Math.max(0.22, d[1]);
      const horiz = Math.sqrt(1 - lift * lift);
      moonDir.set((d[0] / len) * horiz * r, lift * r, (d[2] / len) * horiz * r);
    } else {
      const alt = Math.max(0.12, Math.abs(state.sunAlt) + 0.25);
      const az = state.lst * 0.5;
      moonDir.set(Math.sin(az) * Math.cos(alt) * r, Math.sin(alt) * r, Math.cos(az) * Math.cos(alt) * r);
    }
    placeMoon();
    const night = state.alwaysNight || state.sunAlt < -0.1;
    /* phase 0 is a new moon and 0.5 is a full one */
    const bright = Math.abs(state.phase - 0.5) < 0.25 ? 1 : 0.35;
    moon.intensity = night ? 0.26 + 0.2 * bright : 1.6;
    moon.color.setHex(night ? 0xbfd4ff : 0xfff3dd);
  }

  function flicker(a) {
    /* two sines at unrelated rates: one tube alone pulses like a switch, and
       the beat between them sags and catches the way a failing one does. the
       phases come from where the fixture stands, so two cellar rooms on the
       same arm are never in step with each other. */
    const w = 0.5 + 0.5 * Math.sin(clock * 2.9 + a.x) * Math.sin(clock * 7.7 + a.z);
    return 1 - a.flicker * (0.2 + 0.8 * w);
  }

  function update(cameraPos, dt) {
    clock += dt;
    visitor.copy(cameraPos);
    placeMoon();

    /* the storey the visitor's feet are on. a probe that hands in rig.state
       has no y at all, and `undefined < n` is false, so that reads as the
       ground floor — which is what the rig thinks it is standing on too. */
    const storey = (cameraPos.y - S.EYE_H) < STOREY_Y ? 'basement' : 'ground';

    /* the nine cells around the visitor, and the anchors of every space that
       touches them. the ten nearest are kept in an insertion-sorted pair of
       arrays: no sort, no allocation, and the radius gate drops the rest
       before they cost anything. */
    const ix = Math.floor(cameraPos.x / CELL), iz = Math.floor(cameraPos.z / CELL);
    for (let i = 0; i < POOL; i++) { bestA[i] = null; bestD[i] = Infinity; }
    generation++;
    scanned = 0;
    for (let cx = ix - 1; cx <= ix + 1; cx++) {
      for (let cz = iz - 1; cz <= iz + 1; cz++) {
        const list = grid.get(cx * CELL_SPAN + cz);
        if (!list) continue;
        for (const si of list) {
          if (stamp[si] === generation) continue;
          stamp[si] = generation;
          const s = spaces[si];
          if (s.storey !== storey && s.storey !== 'both') continue;
          for (const a of s.anchors) {
            scanned++;
            const dx = a.x - cameraPos.x, dz = a.z - cameraPos.z;
            const d2 = dx * dx + dz * dz;
            if (d2 >= a.r * a.r * 4 || d2 >= bestD[POOL - 1]) continue;
            let j = POOL - 1;
            while (j > 0 && bestD[j - 1] > d2) { bestA[j] = bestA[j - 1]; bestD[j] = bestD[j - 1]; j--; }
            bestA[j] = a;
            bestD[j] = d2;
          }
        }
      }
    }

    for (let i = 0; i < POOL; i++) {
      const want = bestA[i];
      const l = pool[i];
      if (assigned[i] !== want) {
        assigned[i] = want;
        l.userData.anchor = want;
      }
      /* a slot with no anchor under it fades out where it stands, rather than
         flying across the building to the lamp it was never handed. the ternary
         is deliberate: the object this used to build was ten allocations a
         frame, every frame, for as long as the visitor stood still. */
      const k = Math.min(1, dt * 4);
      l.position.x += ((want ? want.x : l.position.x) - l.position.x) * k;
      l.position.y += ((want ? want.y : l.position.y) - l.position.y) * k;
      l.position.z += ((want ? want.z : l.position.z) - l.position.z) * k;
      l.distance += ((want ? want.r : 12) - l.distance) * k;
      l.userData.base += ((want ? want.i : 0) - l.userData.base) * k;
      l.intensity = l.userData.base * (want && want.flicker ? flicker(want) : 1);
      l.color.lerp(want ? want.rgb : white, k);
    }
  }

  return {
    lights: [hemi, moon, ...pool],
    hemi, moon, pool, anchors, spaces,
    get scanned() { return scanned; },
    setMoonDirection, update
  };
}
