/* ── plan ────────────────────────────────────────────────────────────────
   The floor plan of a building, not a room. A domed rotunda at the centre,
   twelve ranges going out like the spokes of a wheel at 30° apart, and three
   slots per spoke: two side rooms off the corridor and one terminus hall at
   the end. Thirty-six slots for the thirty-two ground rooms — twenty-eight
   categories, four sub-rooms that are entered through their parent rather
   than off a corridor, and four spaces that are not galleries at all: the
   box office, the acquisitions hall, the trophy hall and the rules room.
   The fifteen emptiest categories live in a grid under the rotunda, reached
   by one grand stair down the middle of it, and *which* fifteen that is comes
   out of the data rather than out of this file (plan §10).

   Every room is described by a frame: an entry point on the corridor wall, a
   normal `n` pointing into the room, and `u` along the entry wall. Walls,
   windows, plinths, lights and collision all come out of that frame, so the
   geometry and the walkable space can never disagree. A basement room is the
   same frame with `floor: 'basement'` and no windows; nothing else about the
   frame knows what floor it is on, which is what lets building.js build both
   levels from one shape.

   Why the spokes stagger. At 30° apart, the wedge between two ranges is only
   ±15° wide, and a side room stands 9.3 m out to the side of its own axis
   (half a corridor plus 8 m of room). Put two of those at the same distance
   from the centre on neighbouring spokes and they grow into each other. So
   each spoke carries its near side room on one side and its far side room on
   the other, nine metres further along: on the bisector between two spokes
   one room is always passing the other. That is also why the near room starts
   20 m out rather than 10 — closer than that, a side room reaches across into
   the next spoke's corridor. */
import { S } from './scale.js';
import { LINKS, ROOMS, ROOM_BY_NAME, ROOM_COLOR, WING_NAMES } from './data.js';

const TAU = Math.PI * 2;

/* How many rooms the basement rule shelves downstairs. Plan §10 fixed the
   number at fifteen; the *identity* of those fifteen is computed below. */
const BASEMENT_SLOTS = 15;

/* The twelve spokes, named in order anticlockwise from north: +Z is north and
   +X is west, so the first step off north is a north-north-west range. */
const RANGE_NAMES = [
  'North', 'North North West', 'West North West', 'West', 'West South West', 'South South West',
  'South', 'South South East', 'East South East', 'East', 'East North East', 'North North East'
];

/* Which categories live on which spoke, and on which side of its corridor.
   side: +1 the near side room (the band nearest the rotunda), -1 the far side
   room, 0 the terminus hall. Grouped by affinity so a visit has a logic and a
   parent and its sub-room share a spoke where they can: play to the north,
   devices to the west-north-west, screens and code to the south-west, the
   entry sequence on the south arm by the front door, making and art to the
   south-east, work and systems to the east and north-east. The four leftover
   slots are the special spaces, and the box office sits on the south arm
   because that is the arm the front door is on. */
const ALLOCATION = [
  { range: 'North', rooms: [
    { cat: 'Modding', side: 1 }, { cat: 'Mod Development', side: -1 }, { cat: 'Gaming', side: 0 } ] },
  { range: 'North North West', rooms: [
    { cat: 'Hobbies', side: 1 }, { cat: 'Rules Room', side: -1 }, { cat: 'Game Development', side: 0 } ] },
  { range: 'West North West', rooms: [
    { cat: 'Windows and Mac', side: 1 }, { cat: 'Reverse Engineering', side: -1 }, { cat: 'Android Dev', side: 0 } ] },
  { range: 'West', rooms: [
    { cat: 'Emulation and Re(de)omps', side: 1 }, { cat: 'Recompiles and Decompiles', side: -1 }, { cat: 'PC Tweaks', side: 0 } ] },
  { range: 'West South West', rooms: [
    { cat: 'Red and Blue Hat', side: 1 }, { cat: 'AI', side: -1 }, { cat: 'Privacy', side: 0 } ] },
  { range: 'South South West', rooms: [
    { cat: 'Web Dev', side: 1 }, { cat: 'Trophy Hall', side: -1 }, { cat: 'Programming', side: 0 } ] },
  { range: 'South', rooms: [
    { cat: 'Box Office', side: 1 }, { cat: 'Social Networks', side: -1 }, { cat: 'Media', side: 0 } ] },
  { range: 'South South East', rooms: [
    { cat: 'Audio', side: 1 }, { cat: 'Photo and Video', side: -1 }, { cat: 'Content Creation', side: 0 } ] },
  { range: 'East South East', rooms: [
    { cat: 'Vtubing', side: 1 }, { cat: 'Acquisitions Hall', side: -1 }, { cat: 'Art', side: 0 } ] },
  { range: 'East', rooms: [
    { cat: 'Reading', side: 1 }, { cat: 'Education', side: -1 }, { cat: 'Productivity', side: 0 } ] },
  { range: 'East North East', rooms: [
    { cat: 'Shopping', side: 1 }, { cat: 'Ethical Shopping', side: -1 }, { cat: 'Self Hosting', side: 0 } ] },
  { range: 'North North East', rooms: [
    { cat: 'Business', side: 1 }, { cat: 'Charity', side: -1 }, { cat: 'Linux', side: 0 } ] }
];

/* The four spaces that hold no links: the parts of a museum that are not
   galleries. They take the slots the rooms did not need. */
const SPECIALS = {
  'Box Office': { title: 'The Box Office', hex: '#e8d5a2', sub: 'tickets · rules · the brochure' },
  'Acquisitions Hall': { title: 'The Acquisitions Hall', hex: '#c9b7a0', sub: 'crates, not yet catalogued' },
  'Trophy Hall': { title: 'The Trophy Hall', hex: '#d9c07a', sub: 'sponsors, donors, the ladder' },
  'Rules Room': { title: 'The Rules Room', hex: '#b9c7d6', sub: 'what you agreed to at the door' }
};

/* The cellar: four corridors off the stair hall, in the order you walk them
   out from the stair. The near band is only ever on the +side, because the
   wedge between two cellar arms is exactly where a room on both sides would
   run into the other arm's room; the -side rooms start one band further out. */
const BASE_ARMS = [
  { range: 'Basement North', dx: 0, dz: 1 },
  { range: 'Basement East', dx: -1, dz: 0 },
  { range: 'Basement South', dx: 0, dz: -1 },
  { range: 'Basement West', dx: 1, dz: 0 }
];
const BASE_SLOTS = [
  { side: 1, band: 1 }, { side: -1, band: 2 }, { side: 1, band: 2 }, { side: -1, band: 3 }
];

/* Room sizes. For a terminus hall, `w` is how wide the end of the spoke is and
   `d` how deep the hall runs out from the corridor's end. A side room swaps
   them: it stands `w` deep out from the corridor wall and `d` along it.

   The side rooms are 6 m deep, not the 8 m the four-range building used. At
   30° apart a room that stands 8 m off its own spoke reaches across into the
   next spoke's corridor no matter how far out you put it; 6 m is the depth
   that fits the wedge with two metres to spare. */
const SIZE = {
  hall: { w: 12.0, d: 11.0, ceil: S.CEIL_HALL },
  gallery: { w: 6.0, d: 8.0, ceil: S.CEIL_ROOM },
  cabinet: { w: 6.0, d: 6.0, ceil: S.CEIL_ROOM },
  cellar: { w: S.BASE_ROOM_W, d: S.BASE_ROOM_D, ceil: S.CEIL_BASE }
};

/* per-room character: what the floor and walls are made of, what the key
   light looks like, how the air feels. Consumed by materials.js and
   lighting.js; kept here so the plan is the one place that describes a room.
   `tone` is the key main.js looks up in its mood table — the basement rooms
   all share 'cellar', which that table does not have yet.

   Note `floorMat`, not `floor`: a room's `floor` is now which storey it is on
   ('ground' or 'basement'), which is a fact the building has to know before
   it can put a room under the rotunda at all. Anything that wants the
   surface underfoot — building.js, audio.js's reverb and footsteps, the prop
   kit — reads `floorMat`. */
const CHARACTER = {
  /* games: the arcade wing and the benches that make and change the games */
  Gaming: { floorMat: 'concrete', wall: 'plasterDark', ceilKey: 'tray', key: 0xffd9c8, keyI: 2.2, accent: 1.6, fog: 0.010, tone: 'arcade' },
  'Game Development': { floorMat: 'concrete', wall: 'steel', ceilKey: 'tray', key: 0xffe2bd, keyI: 2.2, accent: 1.8, fog: 0.010, tone: 'workshop' },
  Modding: { floorMat: 'oak', wall: 'brick', ceilKey: 'beam', key: 0xffe6c4, keyI: 2.0, accent: 1.2, fog: 0.010, tone: 'workshop' },
  'Mod Development': { floorMat: 'oakParquet', wall: 'woodPanel', ceilKey: 'gallery', key: 0xffdcae, keyI: 1.6, accent: 1.4, fog: 0.014, tone: 'cabinet' },

  /* screens and the people who watch each other on them */
  Media: { floorMat: 'carpet', wall: 'velvet', ceilKey: 'flat', key: 0xffc9a8, keyI: 1.2, accent: 1.9, fog: 0.020, tone: 'dark' },
  'Social Networks': { floorMat: 'marble', wall: 'plaster', ceilKey: 'clerestory', key: 0xfff2e0, keyI: 2.6, accent: 0.8, fog: 0.006, tone: 'daylit' },

  /* making things: the studio, the live room, the darkroom, the atelier */
  'Content Creation': { floorMat: 'oak', wall: 'plaster', ceilKey: 'clerestory', key: 0xfff4e4, keyI: 2.8, accent: 0.9, fog: 0.007, tone: 'daylit' },
  Audio: { floorMat: 'oakParquet', wall: 'woodPanel', ceilKey: 'beam', key: 0xffdcae, keyI: 1.8, accent: 1.2, fog: 0.010, tone: 'cabinet' },
  'Photo and Video': { floorMat: 'concrete', wall: 'plasterDark', ceilKey: 'flat', key: 0xff7a55, keyI: 0.8, accent: 2.2, fog: 0.016, tone: 'dark' },
  Art: { floorMat: 'oak', wall: 'plaster', ceilKey: 'clerestory', key: 0xfff2e0, keyI: 3.0, accent: 0.7, fog: 0.006, tone: 'daylit' },
  Vtubing: { floorMat: 'carpet', wall: 'plasterDark', ceilKey: 'tray', key: 0xbfe8c8, keyI: 1.6, accent: 2.0, fog: 0.014, tone: 'arcade' },

  /* platforms and hardware */
  'Android Dev': { floorMat: 'oak', wall: 'plaster', ceilKey: 'flat', key: 0xf6ffe9, keyI: 2.0, accent: 1.4, fog: 0.008, tone: 'workshop' },
  'Windows and Mac': { floorMat: 'terrazzo', wall: 'marble', ceilKey: 'coffer', key: 0xfff4e6, keyI: 2.4, accent: 0.7, fog: 0.006, tone: 'bank' },
  'PC Tweaks': { floorMat: 'terrazzo', wall: 'plaster', ceilKey: 'flat', key: 0xf2f6ff, keyI: 2.4, accent: 1.0, fog: 0.008, tone: 'clinic' },
  'Reverse Engineering': { floorMat: 'terrazzo', wall: 'steel', ceilKey: 'flat', key: 0xf0f6ff, keyI: 2.2, accent: 1.2, fog: 0.008, tone: 'clinic' },
  'Emulation and Re(de)omps': { floorMat: 'oakParquet', wall: 'woodPanel', ceilKey: 'gallery', key: 0xffe9c0, keyI: 1.6, accent: 1.5, fog: 0.010, tone: 'cabinet' },
  'Recompiles and Decompiles': { floorMat: 'concrete', wall: 'steel', ceilKey: 'tray', key: 0xe8f0ff, keyI: 1.8, accent: 1.8, fog: 0.012, tone: 'engine' },

  /* the quiet half of computing: the vault, the engine, the scriptorium */
  Privacy: { floorMat: 'terrazzo', wall: 'steel', ceilKey: 'coffer', key: 0xdfeaff, keyI: 1.6, accent: 1.7, fog: 0.012, tone: 'vault' },
  'Red and Blue Hat': { floorMat: 'concrete', wall: 'plasterDark', ceilKey: 'tray', key: 0xbfd8ff, keyI: 1.6, accent: 2.4, fog: 0.016, tone: 'engine' },
  AI: { floorMat: 'concrete', wall: 'plasterDark', ceilKey: 'tray', key: 0xbfd8ff, keyI: 1.0, accent: 2.4, fog: 0.024, tone: 'engine' },
  Programming: { floorMat: 'oak', wall: 'brick', ceilKey: 'beam', key: 0xffe6c4, keyI: 2.0, accent: 1.1, fog: 0.010, tone: 'printshop' },
  'Web Dev': { floorMat: 'oak', wall: 'brick', ceilKey: 'beam', key: 0xffe8cc, keyI: 2.2, accent: 1.0, fog: 0.009, tone: 'printshop' },

  /* systems: the farm and the alcove */
  'Self Hosting': { floorMat: 'concrete', wall: 'steel', ceilKey: 'tray', key: 0xcfe6ff, keyI: 1.4, accent: 2.6, fog: 0.018, tone: 'server' },
  Linux: { floorMat: 'concrete', wall: 'steel', ceilKey: 'flat', key: 0xcfe6ff, keyI: 0.9, accent: 2.6, fog: 0.018, tone: 'server' },

  /* work and money */
  Productivity: { floorMat: 'oakParquet', wall: 'woodPanel', ceilKey: 'coffer', key: 0xfff0d8, keyI: 2.4, accent: 0.8, fog: 0.006, tone: 'library' },
  Business: { floorMat: 'marbleDark', wall: 'woodPanel', ceilKey: 'coffer', key: 0xffeed8, keyI: 2.0, accent: 0.9, fog: 0.008, tone: 'bank' },
  Shopping: { floorMat: 'marble', wall: 'marble', ceilKey: 'coffer', key: 0xfff6e2, keyI: 2.4, accent: 0.8, fog: 0.006, tone: 'bank' },
  'Ethical Shopping': { floorMat: 'oak', wall: 'brick', ceilKey: 'beam', key: 0xffe9c0, keyI: 1.8, accent: 1.1, fog: 0.010, tone: 'printshop' },

  /* reading, and the two rooms that teach it */
  Reading: { floorMat: 'oakParquet', wall: 'woodPanel', ceilKey: 'gallery', key: 0xffdcae, keyI: 1.8, accent: 0.9, fog: 0.012, tone: 'library' },
  Education: { floorMat: 'oak', wall: 'plaster', ceilKey: 'beam', key: 0xfff2e0, keyI: 2.2, accent: 0.8, fog: 0.008, tone: 'clinic' },

  /* the odds and ends of the ground floor */
  Hobbies: { floorMat: 'oak', wall: 'brick', ceilKey: 'beam', key: 0xffe2b4, keyI: 1.8, accent: 1.3, fog: 0.012, tone: 'workshop' },
  Charity: { floorMat: 'oakParquet', wall: 'plaster', ceilKey: 'gallery', key: 0xffeacb, keyI: 2.0, accent: 0.8, fog: 0.008, tone: 'library' },

  /* the four spaces with no exhibits in them */
  'Box Office': { floorMat: 'marble', wall: 'marbleDark', ceilKey: 'coffer', key: 0xffe8c8, keyI: 2.6, accent: 0.9, fog: 0.006, tone: 'grand' },
  'Acquisitions Hall': { floorMat: 'terrazzo', wall: 'brick', ceilKey: 'beam', key: 0xffe6c4, keyI: 2.0, accent: 1.0, fog: 0.012, tone: 'printshop' },
  'Trophy Hall': { floorMat: 'marble', wall: 'marbleDark', ceilKey: 'coffer', key: 0xffeccf, keyI: 2.2, accent: 1.0, fog: 0.006, tone: 'grand' },
  'Rules Room': { floorMat: 'oakParquet', wall: 'woodPanel', ceilKey: 'coffer', key: 0xffe9c8, keyI: 2.0, accent: 0.7, fog: 0.008, tone: 'library' },

  /* ── the cellar ── concrete floor, damp plaster, a plaster slab flat as a
     table, and a tube that is trying to start. The fog is about twice what it
     is upstairs, and `flicker` is how hard that tube is trying — lighting.js
     does not read it yet, and will. */
  'Apple Dev': { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xc9d6e8, keyI: 1.1, accent: 1.0, fog: 0.022, tone: 'cellar', flicker: 0.30 },
  'Open Source': { floorMat: 'concreteDark', wall: 'concrete', ceilKey: 'flat', key: 0xcfd8e2, keyI: 1.3, accent: 1.2, fog: 0.020, tone: 'cellar', flicker: 0.18 },
  'Creative Writing': { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xd8cdb8, keyI: 1.0, accent: 0.8, fog: 0.024, tone: 'cellar', flicker: 0.10 },
  Accessibility: { floorMat: 'concreteDark', wall: 'plaster', ceilKey: 'flat', key: 0xd6e0ea, keyI: 1.5, accent: 0.7, fog: 0.018, tone: 'cellar', flicker: 0.05 },
  'GitHub Repo': { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xc4d2e4, keyI: 1.2, accent: 1.4, fog: 0.022, tone: 'cellar', flicker: 0.35 },
  Science: { floorMat: 'concrete', wall: 'plasterDark', ceilKey: 'flat', key: 0xcfdcea, keyI: 1.3, accent: 1.0, fog: 0.020, tone: 'cellar', flicker: 0.22 },
  'History and Archives': { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xd9cbb2, keyI: 0.9, accent: 0.7, fog: 0.026, tone: 'cellar', flicker: 0.12 },
  Sports: { floorMat: 'concreteDark', wall: 'concrete', ceilKey: 'flat', key: 0xc8d8d0, keyI: 1.4, accent: 1.3, fog: 0.020, tone: 'cellar', flicker: 0.40 },
  Journalism: { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xd2d6da, keyI: 1.2, accent: 0.9, fog: 0.022, tone: 'cellar', flicker: 0.45 },
  Psychology: { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xd0cfe0, keyI: 0.9, accent: 0.8, fog: 0.026, tone: 'cellar', flicker: 0.08 },
  Philosophy: { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xc9cfe0, keyI: 0.9, accent: 0.9, fog: 0.028, tone: 'cellar', flicker: 0.15 },
  Astronomy: { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xbcc8e0, keyI: 0.8, accent: 1.6, fog: 0.030, tone: 'cellar', flicker: 0.50 },
  Paid: { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xe0d2b4, keyI: 1.0, accent: 1.1, fog: 0.024, tone: 'cellar', flicker: 0.25 },
  Music: { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xcdd0dc, keyI: 1.0, accent: 1.2, fog: 0.024, tone: 'cellar', flicker: 0.33 },
  'Web Extension': { floorMat: 'concreteDark', wall: 'plasterDark', ceilKey: 'flat', key: 0xc6d4e6, keyI: 1.1, accent: 1.3, fog: 0.022, tone: 'cellar', flicker: 0.28 },

  Rotunda: { floorMat: 'marble', wall: 'marble', ceilKey: 'dome', key: 0xfff0dc, keyI: 2.6, accent: 0.6, fog: 0.006, tone: 'grand' }
};

/* The cellar rooms all read as one kind of space; the character table carries
   the differences, the size comes from the scale file. */
const CELLAR = 'cellar';

/* A category the character table has never heard of still has to be built:
   plain plaster, a warm key, gallery air. The plan is never the reason the
   page does not boot. */
const DEFAULT_CH = { floorMat: 'terrazzo', wall: 'plaster', ceilKey: 'flat', key: 0xfff0dc, keyI: 2.0, accent: 1.0, fog: 0.008, tone: 'grand' };

const kindOf = (count) => (count >= 10 ? 'hall' : count >= 5 ? 'gallery' : 'cabinet');

/* a room's public face: what it is called and what colour it is. Categories
   come from data.js; the special spaces are defined in this file. A sub-room's
   parent is stored as the parent's room id, so plan.byId(room.parent) works. */
function metaOf(cat) {
  const room = ROOM_BY_NAME[cat];
  if (room) return { name: room.title, hex: room.hex, color: ROOM_COLOR[cat], parent: room.parent ? slug(room.parent) : null, sub: cat };
  const sp = SPECIALS[cat];
  return { name: sp.title, hex: sp.hex, color: parseInt(sp.hex.slice(1), 16), parent: null, sub: sp.sub };
}

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

/* One room, from its frame. Everything downstream — walls, windows, plinths,
   lights, collision — is derived from `entry` and `n`, so the geometry and
   the walkable space cannot disagree. Both floors come through here. */
function makeRoom(walkable, o) {
  const angle = Math.atan2(o.n.x, o.n.z);
  const u = { x: Math.cos(angle), z: -Math.sin(angle) };
  const room = {
    id: o.id,
    cat: o.cat,
    range: o.range,
    side: o.side,
    floor: o.floor,
    parent: o.parent,
    name: o.name,
    subtitle: o.sub,
    hex: o.hex,
    color: o.color,
    kind: o.kind,
    w: o.w,
    d: o.d,
    ceil: o.ceil,
    items: o.items,
    entry: o.entry,
    n: o.n,
    u,
    angle,
    center: { x: o.entry.x + o.n.x * o.d / 2, z: o.entry.z + o.n.z * o.d / 2 },
    door: {
      x: o.entry.x, z: o.entry.z,
      w: o.doorW, h: o.doorH,
      angle: Math.atan2(-o.n.x, -o.n.z)
    },
    ...DEFAULT_CH,
    ...CHARACTER[o.cat]
  };

  /* windows on the wall opposite the door — and downstairs there is no
     outside, so the cellar has none and the wall there is solid plaster */
  if (o.winCount) {
    room.windows = windowOffsets(o.w, o.winCount, o.winW).map((off) => ({
      u: off,
      x: o.entry.x + o.n.x * o.d + u.x * off,
      z: o.entry.z + o.n.z * o.d + u.z * off,
      w: o.winW, h: o.winH, sill: o.sill,
      angle
    }));
  } else {
    room.windows = [];
  }
  room.winW = o.winW; room.winH = o.winH; room.winSill = o.sill;

  room.plinths = layoutPlinths(room);
  o.items.forEach((li, i) => { LINKS[li]._room = room.id; LINKS[li]._spot = i; });

  walkable.rects.push({
    cx: room.center.x, cz: room.center.z,
    halfX: o.w / 2, halfZ: o.d / 2, angle,
    room: room.id, kind: 'room', floor: room.floor
  });
  /* the doorway itself, so the union has no pinch point at the threshold:
     as wide as the leaves and deep enough to swallow the wall thickness */
  walkable.rects.push({
    cx: o.entry.x, cz: o.entry.z,
    halfX: room.door.w / 2, halfZ: S.DOOR_DEPTH, angle,
    room: room.id, kind: 'door', floor: room.floor
  });
  return room;
}

/* a corridor as walkable space. `t0` deliberately starts at the centre of
   whatever it grows out of — the rotunda, the stair hall — so the union of
   shapes has no pinch where the corridor meets the hall it opens off. */
function addCorridor(walkable, c) {
  const len = c.t1 - c.t0;
  walkable.rects.push({
    cx: c.dir.x * (c.t0 + len / 2), cz: c.dir.z * (c.t0 + len / 2),
    halfX: c.half, halfZ: len / 2, angle: Math.atan2(c.dir.x, c.dir.z),
    room: null, kind: 'corridor', floor: c.floor
  });
}

export function buildPlan() {
  const counts = {};
  LINKS.forEach((link, i) => {
    (counts[link.c] ||= []).push(i);
  });
  const held = (cat) => (counts[cat] || []).length;

  /* ── the basement rule, read off the data ───────────────────────────────
     Rank the categories that have no parent by how many exhibits they hold
     and shelve the fifteen emptiest downstairs. A category with nothing in
     it is always downstairs, whatever the count says, until something
     arrives; and a sub-room is never downstairs on its own, because you
     reach it through its parent. Nothing here is hard-coded: when the counts
     cross, the rooms move. */
  const trunk = ROOMS.filter((r) => !r.parent);
  const ranked = trunk.slice().sort((a, b) =>
    (held(a.name) - held(b.name)) || a.name.localeCompare(b.name));
  const downstairs = new Set(ranked.slice(0, BASEMENT_SLOTS).map((r) => r.name));
  trunk.forEach((r) => { if (!held(r.name)) downstairs.add(r.name); });
  const floorOf = (cat) => {
    const room = ROOM_BY_NAME[cat];
    if (!room || room.parent) return 'ground';
    return downstairs.has(cat) ? 'basement' : 'ground';
  };

  const rotunda = {
    id: 'rotunda', cat: 'Rotunda', range: 'Centre', side: null,
    floor: 'ground', parent: null,
    name: 'The Rotunda', subtitle: 'no links yet',
    hex: '#e8e2d6', color: 0xe8e2d6, kind: 'rotunda',
    r: S.ROTUNDA_R, ceil: S.CEIL_ROTUNDA, items: [],
    ...CHARACTER.Rotunda
  };

  const rooms = [];
  const corridors = [];
  const walkable = { disc: { x: 0, z: 0, r: S.ROTUNDA_R }, rects: [] };
  const placed = new Set();
  const spare = [];      // ground slots left empty, in ring order
  const unplaced = [];   // rooms the plan could not find a slot for

  /* ── the ground floor: twelve spokes ─────────────────────────────────── */
  ALLOCATION.forEach((arm, i) => {
    const a = i * S.SPOKE_STEP;
    const dir = { x: Math.sin(a), z: Math.cos(a) };
    const lat = { x: dir.z, z: -dir.x }; // +1 side of the range
    const half = S.CORRIDOR_W / 2;

    const specs = arm.rooms.map((spec) => {
      const items = counts[spec.cat] || [];
      /* a terminus slot is a hall whatever it holds: that is the shape of the
         end of a range, and it is where the biggest rooms go */
      const kind = spec.side === 0 ? 'hall' : kindOf(items.length);
      return { ...spec, items, kind, size: SIZE[kind] };
    });

    const sideMax = specs.filter((s) => s.side !== 0)
      .reduce((m, s) => Math.max(m, s.size.d), 0);
    const sideT0 = S.ROTUNDA_R + S.SIDE_SETBACK;
    const hallT0 = sideT0 + S.SIDE_STAGGER + sideMax + S.HALL_GAP;

    /* the corridor runs from inside the rotunda to the door of the hall */
    const corridor = {
      range: arm.range, floor: 'ground',
      cx: dir.x * hallT0 / 2, cz: dir.z * hallT0 / 2,
      t0: 0, t1: hallT0, half, dir, lat,
      ceil: S.CEIL_CORRIDOR
    };
    corridors.push(corridor);
    addCorridor(walkable, corridor);

    specs.forEach((spec) => {
      if (floorOf(spec.cat) !== 'ground') {
        /* the rule moved this one downstairs since the allocation was
           written; leave the niche locked rather than build a room that
           should not be here */
        spare.push({ range: arm.range, side: spec.side, spoke: i });
        return;
      }

      const meta = metaOf(spec.cat);
      const size = spec.size;
      let entry, n, w, d;

      if (spec.side === 0) {
        /* terminus hall: door in the middle of the near wall, glazing on the
           far wall, the corridor ends at its threshold */
        w = size.w; d = size.d;
        entry = { x: dir.x * hallT0, z: dir.z * hallT0 };
        n = { x: dir.x, z: dir.z };
      } else {
        /* side room: door in the corridor wall, windows on the outer wall.
           the +side room is the near band, the -side room the far one. */
        w = size.d; d = size.w;
        const outward = { x: lat.x * spec.side, z: lat.z * spec.side };
        const band0 = sideT0 + (spec.side === 1 ? 0 : S.SIDE_STAGGER);
        const tMid = band0 + size.d / 2;
        entry = { x: dir.x * tMid + lat.x * spec.side * half,
                  z: dir.z * tMid + lat.z * spec.side * half };
        n = outward;
      }

      const winCount = spec.kind === 'hall' ? 3 : spec.kind === 'gallery' ? 2 : 1;
      rooms.push(makeRoom(walkable, {
        id: slug(spec.cat), cat: spec.cat, range: arm.range, side: spec.side,
        floor: 'ground', parent: meta.parent,
        name: meta.name, sub: meta.sub, hex: meta.hex, color: meta.color,
        kind: spec.kind, w, d, ceil: size.ceil, items: spec.items,
        entry, n,
        doorW: spec.side === 0 ? S.DOOR_BIG : S.DOOR_W,
        doorH: spec.side === 0 ? S.DOOR_BIG_H : S.DOOR_H,
        winCount,
        winW: spec.kind === 'hall' ? S.HALL_WIN_W : S.WIN_W,
        winH: spec.kind === 'hall' ? S.HALL_WIN_H : S.WIN_H,
        sill: spec.kind === 'hall' ? S.HALL_SILL : S.SILL_H
      }));
      placed.add(spec.cat);
    });
  });

  /* If the rule moved a room upstairs since the allocation was written, it
     takes the first empty slot in ring order rather than vanishing. */
  ROOMS.forEach((r) => {
    if (placed.has(r.name) || floorOf(r.name) !== 'ground') return;
    const slot = spare.shift();
    if (!slot) { unplaced.push(r.name); return; }
    const i = slot.spoke;
    const a = i * S.SPOKE_STEP;
    const dir = { x: Math.sin(a), z: Math.cos(a) };
    const lat = { x: dir.z, z: -dir.x };
    const sideT0 = S.ROTUNDA_R + S.SIDE_SETBACK;
    const band0 = sideT0 + (slot.side === 1 ? 0 : S.SIDE_STAGGER);
    const items = counts[r.name] || [];
    const kind = kindOf(items.length);
    const size = SIZE[kind];
    const tMid = band0 + size.d / 2;
    const meta = metaOf(r.name);
    rooms.push(makeRoom(walkable, {
      id: slug(r.name), cat: r.name, range: ALLOCATION[i].range, side: slot.side,
      floor: 'ground', parent: meta.parent,
      name: meta.name, sub: meta.sub, hex: meta.hex, color: meta.color,
      kind, w: size.d, d: size.w, ceil: size.ceil, items,
      entry: { x: dir.x * tMid + lat.x * slot.side * S.CORRIDOR_W / 2,
               z: dir.z * tMid + lat.z * slot.side * S.CORRIDOR_W / 2 },
      n: { x: lat.x * slot.side, z: lat.z * slot.side },
      doorW: S.DOOR_W, doorH: S.DOOR_H,
      winCount: kind === 'gallery' ? 2 : 1,
      winW: S.WIN_W, winH: S.WIN_H, sill: S.SILL_H
    }));
    placed.add(r.name);
  });
  Object.keys(SPECIALS).forEach((cat) => { if (!placed.has(cat)) unplaced.push(cat); });

  /* ── the cellar: a grid under the rotunda ──────────────────────────────
     One grand stair comes down through the middle of the rotunda floor into a
     stair hall, and four corridors run out of that hall with the basement
     rooms along them. Every cellar room is the same size, because the rooms
     down here are the ones with nothing to show yet. */
  const cellar = ROOMS.filter((r) => floorOf(r.name) === 'basement').map((r) => r.name);
  const bandCentre = (band) => S.BASE_BAND_0 + (band - 1) * S.BASE_BAND_STEP;
  const baseHalf = S.BASE_CORRIDOR_W / 2;
  let cellarAt = 0;              // the emptiest rooms fill the arms in order, so
                                 // the last arm simply comes up one door short
  const cellarOrder = {};        // arm → its room ids, in the order you pass them

  BASE_ARMS.forEach((arm) => {
    const dir = { x: arm.dx, z: arm.dz };
    const lat = { x: dir.z, z: -dir.x };
    const mine = BASE_SLOTS
      .map((slot) => ({ slot, cat: cellar[cellarAt++] }))
      .filter((s) => s.cat);

    const t1 = mine.length
      ? Math.max(...mine.map((s) => bandCentre(s.slot.band) + S.BASE_ROOM_D / 2)) + S.BASE_STUB
      : S.STAIR_HALL_D / 2 + S.BASE_STUB;
    const corridor = {
      range: arm.range, floor: 'basement',
      cx: dir.x * t1 / 2, cz: dir.z * t1 / 2,
      t0: 0, t1, half: baseHalf, dir, lat,
      ceil: S.CEIL_BASE
    };
    corridors.push(corridor);
    addCorridor(walkable, corridor);

    mine.forEach(({ slot, cat }) => {
      const meta = metaOf(cat);
      const items = counts[cat] || [];
      const tMid = bandCentre(slot.band);
      const room = makeRoom(walkable, {
        id: slug(cat), cat, range: arm.range, side: slot.side,
        floor: 'basement', parent: meta.parent,
        name: meta.name, sub: meta.sub, hex: meta.hex, color: meta.color,
        kind: CELLAR,
        w: S.BASE_ROOM_D, d: S.BASE_ROOM_W, ceil: S.CEIL_BASE, items,
        entry: { x: dir.x * tMid + lat.x * slot.side * baseHalf,
                 z: dir.z * tMid + lat.z * slot.side * baseHalf },
        n: { x: lat.x * slot.side, z: lat.z * slot.side },
        doorW: S.DOOR_W, doorH: S.DOOR_H,
        winCount: 0, winW: 0, winH: 0, sill: 0
      });
      rooms.push(room);
      (cellarOrder[arm.range] ||= []).push(room.id);
      placed.add(cat);
    });
  });
  cellar.forEach((cat) => { if (!placed.has(cat)) unplaced.push(cat); });

  /* ── the stair ─────────────────────────────────────────────────────────
     A straight flight down the south side of the rotunda into the middle of
     the stair hall. In plan it is two landings and the flight between them;
     the record is what the rig and the tour will use to take the stairs
     instead of walking through the floor. */
  const stairTop = { x: 0, z: -(S.ROTUNDA_R - S.STAIR_INSET) };
  const stairBottom = { x: stairTop.x, z: stairTop.z + S.STAIR_RUN };
  [stairTop, stairBottom].forEach((p) => walkable.rects.push({
    cx: p.x, cz: p.z,
    halfX: S.STAIR_W / 2, halfZ: S.STAIR_LAND / 2, angle: 0,
    room: null, kind: 'corridor', floor: 'basement'
  }));
  /* the hall itself, so the four cellar doors are reachable from the stair */
  walkable.rects.push({
    cx: 0, cz: 0,
    halfX: S.STAIR_HALL_W / 2, halfZ: S.STAIR_HALL_D / 2, angle: 0,
    room: 'stair-hall', kind: 'corridor', floor: 'basement'
  });
  const stair = {
    x: stairTop.x, z: stairTop.z, down: true,
    from: 'rotunda', to: 'stair-hall',
    w: S.STAIR_W, run: S.STAIR_RUN, drop: S.FLOOR_GROUND - S.FLOOR_BASE
  };

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

  /* ── the tour ──────────────────────────────────────────────────────────
     A sensible walk: in at the south arm, round the spokes anticlockwise,
     and down each spoke in the order you pass the doors — near side room,
     far side room, terminus hall. Then the cellar, one corridor at a time,
     after the stair. */
  const order = [];
  const spokeOrder = RANGE_NAMES.map((_, i) => i).sort((a, b) => {
    const ka = (a - 6 + RANGE_NAMES.length) % RANGE_NAMES.length;
    const kb = (b - 6 + RANGE_NAMES.length) % RANGE_NAMES.length;
    return ka - kb;
  });
  const rank = { 1: 0, '-1': 1, 0: 2 };
  spokeOrder.forEach((i) => {
    const mine = rooms.filter((room) => room.range === RANGE_NAMES[i]);
    mine.sort((p, q) => (rank[p.side] ?? 3) - (rank[q.side] ?? 3));
    mine.forEach((room) => order.push(room.id));
  });
  BASE_ARMS.forEach((arm) => {
    (cellarOrder[arm.range] || []).forEach((id) => order.push(id));
  });

  return {
    rotunda, rooms, corridors, walkable, order, stair, unplaced,
    reach,
    wingNames: WING_NAMES,
    byId: (id) => (id === 'rotunda' ? rotunda : rooms.find((room) => room.id === id) || null)
  };
}

/* ids are the category, lower-cased and hyphenated, so they survive being
   used as object keys, as dataset values and as screenshot filenames */
function slug(cat) {
  return cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* Is (x, z) inside the building with `pad` clearance from every wall?
   The union is a disc plus rectangles — cheap, exact, and it is the same
   union the tour paths are built from, so nothing can clip.
   `storey` narrows the union to one level. The disc is the ground-floor
   slab and every rect carries the storey it belongs to, so a walker who is
   upstairs cannot leave the building through a cellar rect that happens to
   sit under the rotunda wall: the cellar rooms stand out to the side of the
   ground corridors, and flat, they are a door into thin air. Left out, the
   union stays flat, which is what the plan checks want when they are asking
   whether a room is a room rather than where the visitor is standing. */
export function inside(walkable, x, z, pad, storey = null) {
  const disc = walkable.disc;
  if (storey === null || storey === 'ground') {
    const dx = x - disc.x, dz = z - disc.z;
    if (dx * dx + dz * dz <= (disc.r - pad) * (disc.r - pad)) return true;
  }
  for (const rect of walkable.rects) {
    if (storey !== null && rect.floor !== storey) continue;
    const st = Math.sin(rect.angle), ct = Math.cos(rect.angle);
    const px = x - rect.cx, pz = z - rect.cz;
    const lx = px * ct - pz * st;   // along the rect's local +X
    const lz = px * st + pz * ct;   // along its local +Z
    if (Math.abs(lx) <= rect.halfX - pad && Math.abs(lz) <= rect.halfZ - pad) return true;
  }
  return false;
}
