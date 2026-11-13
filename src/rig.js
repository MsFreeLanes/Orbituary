/* ── rig ─────────────────────────────────────────────────────────────────
   The visitor. Human dimensions, not camera dimensions: eyes at 1.65 m, a
   body half a metre across, a stride that puts a footstep on the floor every
   0.78 m. Walking is a collision test against the same union of shapes the
   walls were built from, so the doorway you can see is the doorway you can
   walk through.

   A guided walk is a polyline through a graph — one node per room, plus the
   rotunda, the stair hall and both ends of the flight — so a route can never
   cut a corner through a wall. The ride is fast in the middle and settles at
   the end, the way a good map fly-to does, and if you grab the mouse
   mid-flight it stops steering and lets you look.

   The building has two storeys and the visitor can be on either one. The rig
   carries the storey, and it is not a guess off the camera height: the only
   place the building changes level is the flight, so the storey is sticky and
   can only change while you are standing on it. The eye height comes out of
   the same rule — the slab under your feet, plus EYE_H — which is what lets
   the HUD card, the light pool and the floor under the footsteps all agree
   about where you are. */
import * as THREE from 'three';
import { S } from './scale.js';
import { inside } from './plan.js';

const STRIDE = 0.78;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* the cellar arms are recorded from the middle of the stair hall outward, so
   the mouth of an arm is at the hall's wall, not at the start of the record.
   the same arithmetic building.js and lighting.js use to find where an arm
   begins. */
function hallWall(plan, c) {
  const hall = plan.walkable.rects.find((r) => r.room === plan.stair.to);
  const st = Math.sin(hall.angle), ct = Math.cos(hall.angle);
  const lx = Math.abs(c.dir.x * ct - c.dir.z * st), lz = Math.abs(c.dir.x * st + c.dir.z * ct);
  return Math.min(lx > 1e-6 ? hall.halfX / lx : Infinity, lz > 1e-6 ? hall.halfZ / lz : Infinity);
}

/* The route network is deliberately not "straight line to the door". A body
   has width, and a diagonal that cuts the corner of a corridor mouth ends up
   inside a wall. So every range gets a mouth node just inside the arch and a
   staithe node on the corridor axis level with each door, and the route is
   forced to turn there: rotunda → mouth → staithe → door → hub → centre. */
function graphOf(plan) {
  const nodes = { rotunda: { x: 0, z: 0, room: 'rotunda' } };
  const edges = [];
  const link = (a, b) => {
    if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z) > 0.05) edges.push([a, b]);
  };

  /* the two storeys are one graph joined by one edge, the flight, so a guided
     walk to a cellar room has exactly one way down and it is the way down.
     both flight nodes sit on the centreline: the flight is 3.00 m of clear
     width between its side walls, and a route that left the centreline would
     walk the visitor into the plaster. */
  const s = plan.stair;
  const hall = plan.walkable.rects.find((r) => r.room === s.to);
  nodes['stair:top'] = { x: s.x, z: s.z, room: 'stair' };
  nodes['stair:bottom'] = { x: s.x, z: s.z + s.run, room: 'stair' };
  nodes[s.to] = { x: hall.cx, z: hall.cz, room: s.to };
  edges.push(['rotunda', 'stair:top']);
  edges.push(['stair:top', 'stair:bottom']);
  edges.push(['stair:bottom', s.to]);

  plan.corridors.forEach((c, i) => {
    const id = 'range' + i;
    if (c.floor === 'basement') {
      /* just inside the arm, past the hall wall: a route that turned at the
         hall centre would clip the corner of the arm on the way out */
      const t = hallWall(plan, c) + 0.55;
      nodes[id] = { x: c.dir.x * t, z: c.dir.z * t, room: s.to };
      edges.push([s.to, id]);
      return;
    }
    nodes[id] = {
      x: c.dir.x * (S.ROTUNDA_R - 0.8), z: c.dir.z * (S.ROTUNDA_R - 0.8), room: 'corridor'
    };
    edges.push(['rotunda', id]);
  });

  plan.rooms.forEach((room) => {
    const ci = Math.max(0, plan.corridors.findIndex((c) => c.range === room.range));
    const c = plan.corridors[ci];
    /* the staithe is the point on the corridor axis level with the door. a
       terminus hall's door stands on the axis itself, so its staithe waits a
       pace short of the threshold: the route has to turn somewhere, and a
       zero-length leg is not a turn — it also drops the hall out of the graph
       when the link that would join it is skipped as degenerate. */
    const depth = room.entry.x * c.dir.x + room.entry.z * c.dir.z - (room.side === 0 ? 1.4 : 0);
    const st = room.id + ':staithe';
    nodes[st] = { x: c.dir.x * depth, z: c.dir.z * depth, room: c.floor === 'basement' ? s.to : 'corridor' };
    link('range' + ci, st);

    const door = { x: room.door.x, z: room.door.z, room: room.id };
    const hx = room.entry.x + room.n.x * 1.4, hz = room.entry.z + room.n.z * 1.4;
    nodes[room.id + ':door'] = door;
    nodes[room.id + ':hub'] = { x: hx, z: hz, room: room.id };
    nodes[room.id] = { x: room.center.x, z: room.center.z, room: room.id };
    link(st, room.id + ':door');
    edges.push([room.id + ':door', room.id + ':hub']);
    edges.push([room.id + ':hub', room.id]);
  });
  return { nodes, edges };
}

function shortest(graph, from, to) {
  const { nodes, edges } = graph;
  const adj = {};
  edges.forEach(([a, b]) => {
    (adj[a] ||= []).push(b);
    (adj[b] ||= []).push(a);
  });
  const dist = { [from]: 0 };
  const prev = {};
  const seen = [];
  const queue = [from];
  while (queue.length) {
    let best = 0;
    for (let i = 1; i < queue.length; i++) if ((dist[queue[i]] ?? 1e9) < (dist[queue[best]] ?? 1e9)) best = i;
    const cur = queue.splice(best, 1)[0];
    seen.push(cur);
    for (const nb of (adj[cur] || [])) {
      const a = nodes[cur], b = nodes[nb];
      const w = Math.hypot(a.x - b.x, a.z - b.z);
      const alt = (dist[cur] ?? 1e9) + w;
      if (alt < (dist[nb] ?? 1e9)) { dist[nb] = alt; prev[nb] = cur; queue.push(nb); }
    }
  }
  if (!(to in dist)) return [];
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path.map((k) => nodes[k]);
}

export function createRig(THREE, camera, canvas, plan, hooks = {}) {
  const graph = graphOf(plan);
  const stair = plan.stair;
  /* the flight is twenty steps, and the tread pitch is what the drop and the
     riser say it is — the same arithmetic building.js cut the treads with. */
  const TREAD = stair.run / Math.round(stair.drop / S.STAIR_RISER);
  const keys = new Map();
  const state = {
    x: 0, z: 4.5, yaw: Math.PI, pitch: 0,
    storey: 'ground', level: S.FLOOR_GROUND,
    speed: 0, room: 'rotunda', moving: false, bob: 0, stride: 0,
    touring: null, mouseIdle: 0, locked: false
  };

  const blockers = [];
  plan.rooms.forEach((room) => {
    room.plinths.forEach((spot) => {
      const c = Math.cos(room.angle), s = Math.sin(room.angle);
      blockers.push({
        x: room.entry.x + spot.u * c + spot.v * s,
        z: room.entry.z - spot.u * s + spot.v * c,
        r: 0.52, room: room.id
      });
    });
  });

  /* How far down the flight you are: 0 at the head, 1 at the foot, or null if
     your feet are not on it. `pad` pulls the test in to the handrail line, so
     a body cannot stand with its shoulder inside the side wall.

     The flight is not in the walkable union — that union is one storey at a
     time — so it is held as a latch rather than read off the plan: you walk
     onto it at one of its two ends, the head from the rotunda floor or the
     foot from the hall, and you stay on it until you reach the other. Without
     the latch, the flight's footprint is just a patch of plan under the
     rotunda, and walking south across the well would drop the visitor onto
     the bottom step. */
  let onFlight = false;

  function flightT(x, z, pad = 0) {
    if (Math.abs(x - stair.x) > stair.w / 2 - pad) return null;
    if (z < stair.z || z > stair.z + stair.run) return null;
    const t = (z - stair.z) / stair.run;
    if (onFlight) return t;
    /* getting on: only at the end your own storey puts you at, and only
       within a step of it. the head is at ground level, the foot is on the
       cellar slab; anywhere in between you are over the flight or under it,
       which is not the same thing as being on it. */
    const near = (t * stair.run < 0.35) || ((1 - t) * stair.run < 0.35);
    if (!near) return null;
    return (state.storey === 'basement' ? t > 0.5 : t < 0.5) ? t : null;
  }

  /* The slab under the feet. On the flight that is the nosing line, so the
     descent is twenty treads of slope and not a jump at the mouth; off it, it
     is whichever storey the rig is standing on. */
  function levelAt(x, z) {
    const t = flightT(x, z);
    if (t !== null) return S.FLOOR_GROUND - stair.drop * t;
    return state.storey === 'basement' ? S.FLOOR_BASE : S.FLOOR_GROUND;
  }

  function roomAt(x, z, storey = state.storey) {
    if (flightT(x, z) !== null) return 'stair';
    let hall = null;
    for (const rect of plan.walkable.rects) {
      if (rect.floor !== storey) continue;
      const st = Math.sin(rect.angle), ct = Math.cos(rect.angle);
      const px = x - rect.cx, pz = z - rect.cz;
      if (Math.abs(px * ct - pz * st) > rect.halfX || Math.abs(px * st + pz * ct) > rect.halfZ) continue;
      if (rect.kind === 'room') return rect.room;
      /* the stair hall is the one corridor the plan gives a name to: it is a
         floor you stand on, not a way through to somewhere else. the cellar
         arms are recorded from its centre outward, so they cover it too and
         the named rect has to win. */
      if (rect.kind === 'corridor' && rect.room) hall = rect.room;
    }
    if (storey === 'ground' && Math.hypot(x, z) <= S.ROTUNDA_R) return 'rotunda';
    return hall || 'corridor';
  }

  function blocked(x, z) {
    const room = roomAt(x, z);
    for (const b of blockers) {
      if (b.room !== room) continue;
      const dx = x - b.x, dz = z - b.z;
      if (dx * dx + dz * dz < b.r * b.r) return true;
    }
    return false;
  }

  function canStand(x, z) {
    if (blocked(x, z)) return false;
    if (flightT(x, z, S.BODY_R) !== null) return true;
    return inside(plan.walkable, x, z, S.BODY_R, state.storey);
  }

  /* What the footstep sample and the room tone are told about the ground
     underfoot: the storey, and what it is made of. A room carries both; a
     corridor has no record, so the rig describes the space — terrazzo
     upstairs, laid concrete down here, and the flight cut from the same
     concrete as the cellar slab. */
  function stepSurface() {
    const room = plan.byId(state.room);
    if (room) return room;
    const mat = state.storey === 'basement' || state.room === 'stair' ? 'concrete' : 'terrazzo';
    return { floor: state.storey, floorMat: mat };
  }

  /* ── input ── */
  function onKeyDown(e) {
    keys.set(e.code, true);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());

  function onMouseMove(e) {
    if (!state.locked) return;
    state.yaw -= e.movementX * 0.0022;
    state.pitch -= e.movementY * 0.0022;
    state.pitch = Math.max(-1.45, Math.min(1.45, state.pitch));
    state.mouseIdle = 0;
  }
  window.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
  });

  function lock() {
    if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
  }

  /* ── guided walks ── */

  /* Where a walk starts from. A corridor is not a node, so it hands in the
     hall it hangs off — and down here that is the stair hall, not the rotunda
     two storeys directly above it. Halfway down the flight picks the nearer
     end of the flight, so a walk started on the stairs does not turn around. */
  function hereKey() {
    const here = state.room;
    if (here === 'stair') return (flightT(state.x, state.z) ?? 0) > 0.5 ? 'stair:bottom' : 'stair:top';
    if (here === stair.to) return stair.to;
    if (here === 'rotunda' || here === 'corridor') return state.storey === 'basement' ? stair.to : 'rotunda';
    return here + ':hub';
  }

  function walkTo(roomId, opts = {}) {
    const target = plan.byId(roomId);
    if (!target) return false;
    const toKey = roomId === 'rotunda' ? 'rotunda' : roomId + (opts.toDoor ? ':hub' : '');
    const path = shortest(graph, hereKey(), toKey);
    /* no route means the graph does not know this room. say so: the old
       fallback drew a line to a node that did not exist and the walk died
       inside Math.hypot. */
    if (!path.length) return false;
    const pts = [{ x: state.x, z: state.z }].concat(path);
    let total = 0;
    const legs = [];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      legs.push({ a: pts[i - 1], b: pts[i], d });
      total += d;
    }
    const cruise = Math.max(opts.speed || 3.4, 1.2);
    const dur = Math.min(9, Math.max(0.9, total / cruise + 0.5));
    state.touring = { legs, total, dur, t: 0, room: roomId, arriveYaw: opts.arriveYaw };
    return true;
  }

  function stopTour() { state.touring = null; }

  function teleportTo(roomId) {
    const room = plan.byId(roomId);
    if (!room) return;
    stopTour();
    if (roomId === 'rotunda') { state.x = 0; state.z = 4.5; state.yaw = 0; }
    else {
      /* stand just inside the door, not in the middle of the room: the first
         plinth row is 1.9 m in, and arriving on top of it hides the exhibits */
      const stand = Math.min(1.3, room.d * 0.35);
      state.x = room.entry.x + room.n.x * stand;
      state.z = room.entry.z + room.n.z * stand;
      state.yaw = Math.atan2(room.n.x, room.n.z) + Math.PI;
    }
    state.pitch = 0;
    /* a teleport is the one time the storey is not inherited from where you
       were standing: the plan already knows which storey this room sits on.
       and you arrive off the flight, wherever you arrive. */
    onFlight = false;
    state.storey = room.floor === 'basement' ? 'basement' : 'ground';
    state.level = levelAt(state.x, state.z);
    state.room = roomAt(state.x, state.z);
    if (hooks.onRoom) hooks.onRoom(state.room, true);
  }

  /* ── frame ── */
  const fwd = new THREE.Vector3();

  function update(dt) {
    state.mouseIdle += dt;
    const tour = state.touring;

    if (tour) {
      tour.t = Math.min(tour.dur, tour.t + dt);
      const u = easeInOut(tour.t / tour.dur) * tour.total;
      let acc = 0, px = state.x, pz = state.z, heading = state.yaw;
      for (const leg of tour.legs) {
        if (acc + leg.d >= u || leg.d < 1e-6) {
          const k = leg.d < 1e-6 ? 0 : (u - acc) / leg.d;
          px = leg.a.x + (leg.b.x - leg.a.x) * k;
          pz = leg.a.z + (leg.b.z - leg.a.z) * k;
          heading = Math.atan2(-(leg.b.x - leg.a.x), -(leg.b.z - leg.a.z));
          break;
        }
        acc += leg.d;
      }
      state.x = px; state.z = pz;
      if (state.mouseIdle > 1.1) {
        let want = heading;
        if (tour.t >= tour.dur - 0.001 && tour.arriveYaw !== undefined) want = tour.arriveYaw;
        let d = want - state.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        state.yaw += d * Math.min(1, dt * 3.4);
        state.pitch += (0 - state.pitch) * Math.min(1, dt * 2.2);
      }
      const speedNow = tour.d > 0 ? (tour.total / tour.dur) * 2.2 * Math.min(1, 4 * tour.t / tour.dur * (1 - tour.t / tour.dur) + 0.15) : 0;
      state.speed = speedNow;
      if (tour.t >= tour.dur) {
        state.touring = null;
        if (hooks.onArrive) hooks.onArrive(tour.room);
      }
    } else {
      let ax = 0, az = 0;
      if (keys.get('KeyW') || keys.get('ArrowUp')) az += 1;
      if (keys.get('KeyS') || keys.get('ArrowDown')) az -= 1;
      if (keys.get('KeyA')) ax -= 1;
      if (keys.get('KeyD')) ax += 1;
      const turn = (keys.get('ArrowLeft') ? 1 : 0) - (keys.get('ArrowRight') ? 1 : 0);
      if (turn) state.yaw += turn * S.TURN_RATE * dt;
      const run = keys.get('ShiftLeft') || keys.get('ShiftRight');
      const max = run ? S.RUN_SPEED : S.WALK_SPEED;
      const len = Math.hypot(ax, az);
      if (len > 0) {
        ax /= len; az /= len;
        const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
        /* the camera looks down its own -Z, so forward at this yaw is
           (-sin, -cos); right is (cos, -sin) */
        const wx = ax * cos - az * sin;
        const wz = -ax * sin - az * cos;
        const step = max * dt;
        const nx = state.x + wx * step, nz = state.z + wz * step;
        if (canStand(nx, nz)) { state.x = nx; state.z = nz; }
        else if (canStand(nx, state.z)) state.x = nx;
        else if (canStand(state.x, nz)) state.z = nz;
        state.speed = max;
      } else state.speed = 0;
    }

    /* where the feet are, in this order: the flight latch, then the storey,
       then the slab. the storey only moves while the latch is on, and it
       flips at the middle of the flight — the same line lighting.js draws to
       choose its light pool, so the room you are lit by, the room the HUD
       names and the room your footsteps ring in are one room. a rule that
       flipped at the mouth would jitter there, because the head of the flight
       and the rotunda floor are the same patch of plan. */
    const down = flightT(state.x, state.z, S.BODY_R);
    onFlight = down !== null;
    if (onFlight) state.storey = down > 0.5 ? 'basement' : 'ground';
    state.level = levelAt(state.x, state.z);

    /* head bob and footsteps, driven by distance travelled, not by time */
    const moved = state.speed * dt;
    if (state.speed > 0.01) {
      /* on the flight the stride is the tread, not the 0.78 m of a level
         floor: twenty treads, twenty footfalls, so the descent sounds like the
         slope you are on. */
      const stride = down === null ? STRIDE : TREAD;
      state.stride += moved;
      state.bob += dt * (state.speed > 2 ? 11.5 : 8.6);
      if (state.stride >= stride) {
        state.stride -= stride;
        if (hooks.onStep) hooks.onStep(stepSurface(), state.speed > 2 ? 1.25 : 1);
      }
    } else {
      state.bob += (0 - state.bob) * Math.min(1, dt * 3);
    }

    const nextRoom = roomAt(state.x, state.z);
    if (nextRoom !== state.room) {
      state.room = nextRoom;
      if (hooks.onRoom) hooks.onRoom(nextRoom, false);
    }

    /* the flight is the one place the head moves vertically for a reason: the
       eye rides the nosing line, and every tread crossed gets a tick. */
    const tread = down === null ? 0
      : Math.abs(Math.cos(down * Math.PI * (stair.run / TREAD))) * 0.018;
    const bobY = Math.sin(state.bob) * 0.028 + Math.abs(Math.cos(state.bob * 0.5)) * 0.012 + tread;
    camera.position.set(state.x, state.level + S.EYE_H + bobY, state.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
    camera.rotation.z = Math.sin(state.bob * 0.5) * 0.004;
    fwd.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    return state;
  }

  return {
    state, update, walkTo, stopTour, teleportTo, lock, roomAt, flightT,
    get touring() { return state.touring; },
    setYawPitch(yaw, pitch) { state.yaw = yaw; state.pitch = pitch; }
  };
}
