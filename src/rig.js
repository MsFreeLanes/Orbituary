/* ── rig ─────────────────────────────────────────────────────────────────
   The visitor. Human dimensions, not camera dimensions: eyes at 1.65 m, a
   body half a metre across, a stride that puts a footstep on the floor every
   0.78 m. Walking is a collision test against the same union of shapes the
   walls were built from, so the doorway you can see is the doorway you can
   walk through.

   A guided walk is a polyline through a thirteen-node graph — one node per
   room plus the rotunda — so the route can never cut a corner through a
   wall. The ride is fast in the middle and settles at the end, the way a
   good map fly-to does, and if you grab the mouse mid-flight it stops
   steering and lets you look. */
import * as THREE from 'three';
import { S } from './scale.js';
import { inside } from './plan.js';

const STRIDE = 0.78;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

  plan.corridors.forEach((c, i) => {
    const id = 'range' + i;
    nodes[id] = {
      x: c.dir.x * (S.ROTUNDA_R - 0.8), z: c.dir.z * (S.ROTUNDA_R - 0.8), room: 'corridor'
    };
    edges.push(['rotunda', id]);
  });

  plan.rooms.forEach((room) => {
    const ci = Math.max(0, plan.corridors.findIndex((c) => c.range === room.range));
    const c = plan.corridors[ci];
    const depth = room.entry.x * c.dir.x + room.entry.z * c.dir.z;
    const st = room.id + ':staithe';
    nodes[st] = { x: c.dir.x * depth, z: c.dir.z * depth, room: 'corridor' };
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
  const keys = new Map();
  const state = {
    x: 0, z: 4.5, yaw: Math.PI, pitch: 0,
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

  function roomAt(x, z) {
    for (const rect of plan.walkable.rects) {
      if (rect.kind !== 'room') continue;
      const st = Math.sin(rect.angle), ct = Math.cos(rect.angle);
      const px = x - rect.cx, pz = z - rect.cz;
      if (Math.abs(px * ct - pz * st) <= rect.halfX && Math.abs(px * st + pz * ct) <= rect.halfZ) return rect.room;
    }
    if (Math.hypot(x, z) <= S.ROTUNDA_R) return 'rotunda';
    return 'corridor';
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
    return inside(plan.walkable, x, z, S.BODY_R) && !blocked(x, z);
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
  function walkTo(roomId, opts = {}) {
    const target = plan.byId(roomId);
    if (!target) return false;
    const here = state.room;
    const fromKey = here === 'rotunda' ? 'rotunda' : (here === 'corridor' ? 'rotunda' : here + ':hub');
    const toKey = roomId === 'rotunda' ? 'rotunda' : roomId + (opts.toDoor ? ':hub' : '');
    let path = shortest(graph, fromKey, toKey);
    if (!path.length) path = [graph.nodes['rotunda'], graph.nodes[roomId] || graph.nodes[roomId + ':hub']];
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

    /* head bob and footsteps, driven by distance travelled, not by time */
    const moved = state.speed * dt;
    if (state.speed > 0.01) {
      state.stride += moved;
      state.bob += dt * (state.speed > 2 ? 11.5 : 8.6);
      if (state.stride >= STRIDE) {
        state.stride -= STRIDE;
        const room = plan.byId(state.room) || plan.rotunda;
        if (hooks.onStep) hooks.onStep(room.floor || 'marble', state.speed > 2 ? 1.25 : 1);
      }
    } else {
      state.bob += (0 - state.bob) * Math.min(1, dt * 3);
    }

    const nextRoom = roomAt(state.x, state.z);
    if (nextRoom !== state.room) {
      state.room = nextRoom;
      if (hooks.onRoom) hooks.onRoom(nextRoom, false);
    }

    const bobY = Math.sin(state.bob) * 0.028 + Math.abs(Math.cos(state.bob * 0.5)) * 0.012;
    camera.position.set(state.x, S.EYE_H + bobY, state.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
    camera.rotation.z = Math.sin(state.bob * 0.5) * 0.004;
    fwd.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    return state;
  }

  return {
    state, update, walkTo, stopTour, teleportTo, lock, roomAt,
    get touring() { return state.touring; },
    setYawPitch(yaw, pitch) { state.yaw = yaw; state.pitch = pitch; }
  };
}
