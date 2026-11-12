/* ── plan ────────────────────────────────────────────────────────────────
   The floor plan of a building, not a room. A domed rotunda at the centre,
   four ranges (north, east, south, west) going out like the arms of a cross,
   and three rooms per range: two side rooms off the corridor and one
   terminus hall at the end. Twelve rooms, one per category, plus the empty
   rotunda where future links land.

   Every room is described by a frame: an entry point on the corridor wall,
   a normal `n` pointing into the room, and `u` along the entry wall. Walls,
   windows, plinths, lights and collision all come out of that frame, so the
   geometry and the walkable space can never disagree. */
import { S } from './scale.js';
import { LINKS, WINGS, WING_NAMES, WING_HEX, WING_COLOR } from './data.js';

const TAU = Math.PI * 2;

/* which categories live on which range, and on which side of its corridor.
   side: -1 left, +1 right, 0 terminus hall. Grouped by affinity so a visit
   has a logic: play to the north, screens to the east, making to the south,
   systems to the west. */
const ALLOCATION = [
  { range: 'North', dx: 0, dz: 1, rooms: [{ cat: 'AI', side: 1 }, { cat: 'Linux', side: -1 }, { cat: 'Gaming', side: 0 }] },
  { range: 'West', dx: 1, dz: 0, rooms: [{ cat: 'Shopping', side: 1 }, { cat: 'Fun', side: -1 }, { cat: 'Media', side: 0 }] },
  { range: 'South', dx: 0, dz: -1, rooms: [{ cat: 'Reading', side: 1 }, { cat: 'Dev', side: -1 }, { cat: 'Creative', side: 0 }] },
  { range: 'East', dx: -1, dz: 0, rooms: [{ cat: 'Android', side: 1 }, { cat: 'Tools', side: -1 }, { cat: 'Privacy', side: 0 }] }
];

const SIZE = {
  hall: { w: 12.0, d: 11.0, ceil: S.CEIL_HALL },
  gallery: { w: 8.0, d: 8.0, ceil: S.CEIL_ROOM },
  cabinet: { w: 6.0, d: 6.0, ceil: S.CEIL_ROOM }
};

/* per-room character: what the floor and walls are made of, what the key
   light looks like, how the air feels. Consumed by materials.js and
   lighting.js; kept here so the plan is the one place that describes a room. */
const CHARACTER = {
  Gaming: { floor: 'concrete', wall: 'plasterDark', ceilKey: 'tray', key: 0xffd9c8, keyI: 2.2, accent: 1.6, fog: 0.010, tone: 'arcade' },
  Creative: { floor: 'oak', wall: 'plaster', ceilKey: 'clerestory', key: 0xfff2e0, keyI: 3.0, accent: 0.7, fog: 0.006, tone: 'daylit' },
  Media: { floor: 'carpet', wall: 'velvet', ceilKey: 'flat', key: 0xffc9a8, keyI: 1.2, accent: 1.9, fog: 0.020, tone: 'dark' },
  Privacy: { floor: 'terrazzo', wall: 'steel', ceilKey: 'coffer', key: 0xdfeaff, keyI: 1.6, accent: 1.7, fog: 0.012, tone: 'vault' },
  Tools: { floor: 'terrazzo', wall: 'plaster', ceilKey: 'flat', key: 0xf2f6ff, keyI: 2.4, accent: 1.0, fog: 0.008, tone: 'clinic' },
  Dev: { floor: 'oak', wall: 'brick', ceilKey: 'beam', key: 0xffe6c4, keyI: 2.0, accent: 1.1, fog: 0.010, tone: 'printshop' },
  Android: { floor: 'oak', wall: 'plaster', ceilKey: 'flat', key: 0xf6ffe9, keyI: 2.0, accent: 1.4, fog: 0.008, tone: 'workshop' },
  Shopping: { floor: 'marble', wall: 'marble', ceilKey: 'coffer', key: 0xfff6e2, keyI: 2.4, accent: 0.8, fog: 0.006, tone: 'bank' },
  AI: { floor: 'concrete', wall: 'plasterDark', ceilKey: 'tray', key: 0xbfd8ff, keyI: 1.0, accent: 2.4, fog: 0.024, tone: 'engine' },
  Reading: { floor: 'oakParquet', wall: 'woodPanel', ceilKey: 'gallery', key: 0xffdcae, keyI: 1.8, accent: 0.9, fog: 0.012, tone: 'library' },
  Linux: { floor: 'concrete', wall: 'steel', ceilKey: 'flat', key: 0xcfe6ff, keyI: 0.9, accent: 2.6, fog: 0.018, tone: 'server' },
  Fun: { floor: 'oakParquet', wall: 'woodPanel', ceilKey: 'gallery', key: 0xffe9c0, keyI: 1.6, accent: 1.5, fog: 0.010, tone: 'cabinet' },
  Rotunda: { floor: 'marble', wall: 'marble', ceilKey: 'dome', key: 0xfff0dc, keyI: 2.6, accent: 0.6, fog: 0.006, tone: 'grand' }
};

const kindOf = (count) => (count >= 10 ? 'hall' : count >= 5 ? 'gallery' : 'cabinet');

/* openings along a wall: n windows evenly spaced, returned as offsets from
   the centre of the wall measured along `u`. */
function windowOffsets(width, count, winW) {
  const span = Math.min(width - 1.6, count * winW + (count - 1) * 1.0);
  const step = count > 1 ? span / (count - 1) : 0;
  const out = [];
  for (let i = 0; i < count; i++) out.push(-span / 2 + i * step);
  return out;
}

function layoutPlinths(room) {
  /* rows run along `u`, facing back towards the door. Depth is capped so the
     back row still has clearance under the window head, and spacing honours
     the 1.50 m turning circle at every plinth. */
  const usableU = room.w - 2.6;
  const vStart = Math.max(2.2, room.d * 0.3);
  const vEnd = room.d - 1.6;
  const perRow = Math.max(1, Math.min(room.items.length,
    Math.floor(usableU / S.EXHIBIT_GAP) + 1));
  const rows = Math.max(1, Math.ceil(room.items.length / perRow));
  const vStep = rows > 1 ? (vEnd - vStart) / (rows - 1) : 0;
  const spots = [];
  let left = room.items.length;
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(perRow, left);
    left -= inRow;
    const uSpan = (inRow - 1) * S.EXHIBIT_GAP;
    for (let i = 0; i < inRow; i++) {
      spots.push({
        u: -uSpan / 2 + i * S.EXHIBIT_GAP,
        v: vStart + r * vStep,
        face: Math.PI // plaque faces the entry wall
      });
    }
  }
  return spots;
}

export function buildPlan() {
  const counts = {};
  LINKS.forEach((link, i) => {
    (counts[link.c] ||= []).push(i);
  });

  const rotunda = {
    id: 'rotunda', cat: 'Rotunda', range: 'Centre', side: null,
    name: 'The Rotunda', subtitle: 'no links yet',
    hex: '#e8e2d6', color: 0xe8e2d6, kind: 'rotunda',
    r: S.ROTUNDA_R, ceil: S.CEIL_ROTUNDA, items: [],
    ...CHARACTER.Rotunda
  };

  const rooms = [];
  const corridors = [];
  const walkable = { disc: { x: 0, z: 0, r: S.ROTUNDA_R }, rects: [] };

  ALLOCATION.forEach((arm) => {
    const dir = { x: arm.dx, z: arm.dz };
    const lat = { x: arm.dz, z: -arm.dx }; // +1 side of the range
    const half = S.CORRIDOR_W / 2;

    const specs = arm.rooms.map((spec) => {
      const items = counts[spec.cat] || [];
      const kind = kindOf(items.length);
      return { ...spec, items, kind, size: SIZE[kind] };
    });

    const sideMax = specs.filter((s) => s.side !== 0)
      .reduce((m, s) => Math.max(m, s.size.d), 0);
    const hall = specs.find((s) => s.side === 0);
    const sideT0 = S.ROTUNDA_R + S.SIDE_SETBACK;
    const hallT0 = sideT0 + sideMax + S.HALL_GAP;

    /* the corridor runs from inside the rotunda to the door of the hall */
    const corridor = {
      range: arm.range,
      cx: dir.x * hallT0 / 2, cz: dir.z * hallT0 / 2,
      t0: 0, t1: hallT0, half, dir, lat,
      ceil: S.CEIL_CORRIDOR
    };
    corridors.push(corridor);
    walkable.rects.push({
      cx: dir.x * (hallT0 / 2), cz: dir.z * (hallT0 / 2),
      halfX: half, halfZ: hallT0 / 2, angle: Math.atan2(dir.x, dir.z),
      room: null, kind: 'corridor'
    });

    specs.forEach((spec) => {
      const items = spec.items;
      const size = spec.size;
      let entry, n, u, w, d, angle;

      if (spec.side === 0) {
        /* terminus hall: door in the middle of the near wall, glazing on the
         	 far wall, the corridor ends at its threshold */
        w = size.w; d = size.d;
        entry = { x: dir.x * hallT0, z: dir.z * hallT0 };
        n = { x: dir.x, z: dir.z };
      } else {
        /* side room: door in the corridor wall, windows on the outer wall */
        w = size.d; d = size.w;
        const outward = { x: lat.x * spec.side, z: lat.z * spec.side };
        const tMid = sideT0 + size.d / 2;
        entry = { x: dir.x * tMid + lat.x * spec.side * half,
                  z: dir.z * tMid + lat.z * spec.side * half };
        n = outward;
      }

      /* the room frame: local +Z points into the room from the door, local
         +X runs along the door wall. Every wall, window and plinth below is
         placed in this frame and then rotated into the world by `angle`. */
      angle = Math.atan2(n.x, n.z);
      u = { x: Math.cos(angle), z: -Math.sin(angle) };

      const room = {
        id: spec.cat.toLowerCase(),
        cat: spec.cat,
        range: arm.range,
        side: spec.side,
        name: WINGS[spec.cat].title,
        subtitle: spec.cat,
        hex: WING_HEX[spec.cat],
        color: WING_COLOR[spec.cat],
        kind: spec.kind,
        w, d,
        ceil: size.ceil,
        items,
        entry, n, u,
        center: { x: entry.x + n.x * d / 2, z: entry.z + n.z * d / 2 },
        angle,
        door: {
          x: entry.x, z: entry.z,
          w: spec.side === 0 ? S.DOOR_BIG : S.DOOR_W,
          h: spec.side === 0 ? S.DOOR_BIG_H : S.DOOR_H,
          angle: Math.atan2(-n.x, -n.z)
        },
        ...CHARACTER[spec.cat]
      };

      /* windows on the wall opposite the door */
      const winCount = spec.kind === 'hall' ? 3 : spec.kind === 'gallery' ? 2 : 1;
      const winW = spec.kind === 'hall' ? S.HALL_WIN_W : S.WIN_W;
      const winH = spec.kind === 'hall' ? S.HALL_WIN_H : S.WIN_H;
      const sill = spec.kind === 'hall' ? S.HALL_SILL : S.SILL_H;
      room.windows = windowOffsets(w, winCount, winW).map((off) => ({
        u: off,
        x: entry.x + n.x * d + u.x * off,
        z: entry.z + n.z * d + u.z * off,
        w: winW, h: winH, sill,
        angle: Math.atan2(n.x, n.z)
      }));
      room.winW = winW; room.winH = winH; room.winSill = sill;

      room.plinths = layoutPlinths(room);
      items.forEach((li, i) => { LINKS[li]._room = room.id; LINKS[li]._spot = i; });

      rooms.push(room);
      walkable.rects.push({
        cx: room.center.x, cz: room.center.z,
        halfX: w / 2, halfZ: d / 2, angle,
        room: room.id, kind: 'room'
      });
      /* the doorway itself, so the union has no pinch point at the threshold:
         as wide as the leaves and deep enough to swallow the wall thickness */
      walkable.rects.push({
        cx: entry.x, cz: entry.z,
        halfX: room.door.w / 2, halfZ: 0.9, angle,
        room: room.id, kind: 'door'
      });
    });
  });

  /* rotunda plinths: six empty pedestals under the oculus, waiting */
  rotunda.plinths = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    rotunda.plinths.push({ u: Math.sin(a) * 5.0, v: Math.cos(a) * 5.0, face: a + Math.PI });
  }

  let reach = 0;
  rooms.forEach((room) => {
    const r = Math.hypot(room.center.x, room.center.z) + Math.max(room.w, room.d) / 2;
    reach = Math.max(reach, r);
  });

  /* tour order: a sensible walk — start in the rotunda, then each range
     anticlockwise, side rooms first, hall last */
  const order = [];
  ALLOCATION.forEach((arm) => {
    const mine = rooms.filter((room) => room.range === arm.range);
    mine.sort((a, b) => (a.side === 0 ? 1 : a.side === 1 ? -1 : 0) - (b.side === 0 ? 1 : b.side === 1 ? -1 : 0));
    mine.forEach((room) => order.push(room.id));
  });

  return {
    rotunda, rooms, corridors, walkable, order,
    reach,
    wingNames: WING_NAMES,
    byId: (id) => (id === 'rotunda' ? rotunda : rooms.find((room) => room.id === id) || null)
  };
}

/* Is (x, z) inside the building with `pad` clearance from every wall?
   The union is a disc plus rectangles — cheap, exact, and it is the same
   union the tour paths are built from, so nothing can clip. */
export function inside(walkable, x, z, pad) {
  const disc = walkable.disc;
  const dx = x - disc.x, dz = z - disc.z;
  if (dx * dx + dz * dz <= (disc.r - pad) * (disc.r - pad)) return true;
  for (const rect of walkable.rects) {
    const st = Math.sin(rect.angle), ct = Math.cos(rect.angle);
    const px = x - rect.cx, pz = z - rect.cz;
    const lx = px * ct - pz * st;   // along the rect's local +X
    const lz = px * st + pz * ct;   // along its local +Z
    if (Math.abs(lx) <= rect.halfX - pad && Math.abs(lz) <= rect.halfZ - pad) return true;
  }
  return false;
}
