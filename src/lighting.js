/* ── lighting ────────────────────────────────────────────────────────────
   A fixed pool of lights that gets handed around the building as the visitor
   moves through it. The count never changes, so the shaders never recompile
   mid-walk; what changes is where each light sits and what colour it is, and
   those cross-fade, so a room fades up as you step in and down behind you.

   One directional light carries the moon and throws the window openings
   onto the floor. That single shadow map is the whole trick that makes the
   night outside feel like it is actually outside. */
import * as THREE from 'three';
import { S } from './scale.js';

const POOL = 10;

function anchorsFor(plan, skyTint) {
  /* intensities are in candela: three has used physical light units since
     r155, so a lamp needs tens of candela to light a 12 m room, and the
     falloff is a true 1/d². That is what gives the building its pools of
     light and the dark stretches of wall in between. */
  const A = [];
  plan.rooms.forEach((room) => {
    A.push({
      x: room.center.x, z: room.center.z, y: room.ceil - 1.6,
      color: room.key, i: room.keyI * 11, r: Math.max(room.w, room.d) * 1.4, room: room.id
    });
    room.windows.forEach((win) => {
      A.push({
        x: win.x + room.n.x * 0.4, z: win.z + room.n.z * 0.4,
        y: win.sill + win.h * 0.45,
        color: skyTint, i: 3.0, r: 7.5, room: room.id, cold: true
      });
    });
    A.push({
      x: room.entry.x + room.n.x * 0.8, z: room.entry.z + room.n.z * 0.8, y: 2.35,
      color: room.color, i: 3.5, r: 5.5, room: room.id
    });
    /* wall washers. a lamp in the middle of a room lights the floor and leaves
       the walls black, which is the one thing that makes a 3d room look like a
       photograph of a hole. real museums run small fixtures close to the
       walls for exactly this: the falloff is steep, so the wall gets a wash
       and the floor barely notices. */
    const sw = Math.max(0.7, room.w / 2 - 0.7);
    [-1, 1].forEach((s) => {
      A.push({
        x: room.center.x + room.u.x * sw * s, z: room.center.z + room.u.z * sw * s,
        y: 2.35, color: room.key, i: 2.2, r: 5.0, room: room.id, wash: true
      });
    });
    /* the far wall is the one you walk towards and the one a photograph of the
       room is really about, so it gets its own fixture. a room lit only from
       the middle has a bright floor and a black backdrop. */
    A.push({
      x: room.center.x + room.n.x * (room.d / 2 - 0.9),
      z: room.center.z + room.n.z * (room.d / 2 - 0.9),
      y: 2.6, color: room.key, i: 3.0, r: 6.5, room: room.id, wash: true
    });
  });
  plan.corridors.forEach((c) => {
    for (let t = S.ROTUNDA_R + 1.5; t < c.t1; t += 3.6) {
      A.push({
        x: c.dir.x * t, z: c.dir.z * t, y: c.ceil - 0.25,
        color: 0xffe9cf, i: 4.0, r: 5.2, room: 'corridor'
      });
    }
  });
  A.push({ x: 0, z: 0, y: S.CEIL_ROTUNDA - 0.8, color: 0xfff2dd, i: 18, r: 16, room: 'rotunda' });
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

export function createLighting(THREE, plan) {
  const skyTint = 0x9fc0ff;
  const hemi = new THREE.HemisphereLight(0x2a3a58, 0x14161c, 0.42);

  const moon = new THREE.DirectionalLight(0xbfd4ff, 0.5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const span = plan.reach + 12;
  moon.shadow.camera.left = -span; moon.shadow.camera.right = span;
  moon.shadow.camera.top = span; moon.shadow.camera.bottom = -span;
  moon.shadow.camera.near = 1; moon.shadow.camera.far = span * 4;
  moon.shadow.bias = -0.0009;
  moon.shadow.normalBias = 0.03;

  const pool = [];
  for (let i = 0; i < POOL; i++) {
    const p = new THREE.PointLight(0xffffff, 0, 12, 2);
    p.userData.anchor = null;
    pool.push(p);
  }

  const anchors = anchorsFor(plan, skyTint);
  const assigned = new Array(POOL).fill(null);
  const tmp = new THREE.Vector3();
  const scratchColor = new THREE.Color();

  function setMoonDirection(state) {
    /* the moonlight comes from wherever the sky has actually put the moon;
       when it has set we keep the bearing and lift it above the roofline */
    const r = plan.reach * 1.6;
    if (state.moonDir) {
      const d = state.moonDir;
      const len = Math.hypot(d[0], d[2]) || 1;
      const lift = Math.max(0.22, d[1]);
      const horiz = Math.sqrt(1 - lift * lift);
      tmp.set((d[0] / len) * horiz * r, lift * r, (d[2] / len) * horiz * r);
    } else {
      const alt = Math.max(0.12, Math.abs(state.sunAlt) + 0.25);
      const az = state.lst * 0.5;
      tmp.set(Math.sin(az) * Math.cos(alt) * r, Math.sin(alt) * r, Math.cos(az) * Math.cos(alt) * r);
    }
    moon.position.copy(tmp);
    moon.target.position.set(0, 0, 0);
    const night = state.alwaysNight || state.sunAlt < -0.1;
    /* phase 0 is a new moon and 0.5 is a full one */
    const bright = Math.abs(state.phase - 0.5) < 0.25 ? 1 : 0.35;
    moon.intensity = night ? 0.26 + 0.2 * bright : 1.6;
    moon.color.setHex(night ? 0xbfd4ff : 0xfff3dd);
  }

  function update(cameraPos, dt) {
    /* nearest anchors, then hand them to the pool with a cross-fade */
    const near = [];
    for (const a of anchors) {
      const dx = a.x - cameraPos.x, dz = a.z - cameraPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < a.r * a.r * 4) near.push({ a, d2 });
    }
    near.sort((p, q) => p.d2 - q.d2);
    const chosen = near.slice(0, POOL).map((p) => p.a);

    for (let i = 0; i < POOL; i++) {
      const want = chosen[i] || null;
      const l = pool[i];
      if (assigned[i] !== want) {
        assigned[i] = want;
        l.userData.anchor = want;
      }
      const target = want || { x: l.position.x, z: l.position.z, y: l.position.y, i: 0, color: 0xffffff, r: 12 };
      const k = Math.min(1, dt * 4);
      l.position.x += (target.x - l.position.x) * k;
      l.position.y += (target.y - l.position.y) * k;
      l.position.z += (target.z - l.position.z) * k;
      l.distance += ((target.r || 12) - l.distance) * k;
      l.intensity += (target.i - l.intensity) * k;
      scratchColor.setHex(target.color);
      l.color.lerp(scratchColor, k);
    }
  }

  return {
    lights: [hemi, moon, ...pool],
    hemi, moon, pool, anchors,
    setMoonDirection, update
  };
}
