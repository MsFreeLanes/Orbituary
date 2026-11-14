/* ── signage ─────────────────────────────────────────────────────────────
   Everything in a museum that has words on it. Two kinds:

   · a wall label on the face of every plinth — packed onto a canvas sheet
     holding up to sixteen of them, so 192 labels cost 33 textures instead
     of 192, and a room that needs more than one sheet gets another sheet
     rather than a taller one;
   · a name plate over every door, so you can read where you are going
     before you walk into it.

   All of it is painted at build-of-scene time with the 2D canvas. No fonts
   are fetched: Georgia and the system mono stack are already on every
   machine this file has to run on. */

const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, "Cascadia Mono", "Segoe UI Mono", Consolas, monospace';
const SANS = '"Segoe UI", system-ui, sans-serif';

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

function fitText(ctx, text, font, maxW, maxPx) {
  let px = maxPx;
  for (; px > 10; px--) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= maxW) break;
  }
  return px;
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const tryLine = line ? line + ' ' + w : w;
    if (ctx.measureText(tryLine).width > maxW && line) { lines.push(line); line = w; }
    else line = tryLine;
  }
  if (line) lines.push(line);
  return lines;
}

function spaced(ctx, text, x, y, gap) {
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + gap; }
}

function texture(cv, aniso) {
  const t = new THREEref.CanvasTexture(cv);
  t.colorSpace = THREEref.SRGBColorSpace;
  t.anisotropy = aniso || 4;
  t.generateMipmaps = true;
  t.minFilter = THREEref.LinearMipmapLinearFilter;
  return t;
}

let THREEref = null;

/* ── plinth labels ─────────────────────────────────────────────────────── */

const CELL_W = 384, CELL_H = 192, COLS = 4, MAX_ROWS = 4;

/* A plaque sheet stops at 1536 × 768. It used to grow downwards for as long
   as the room was long, and the biggest room in the building paid for a
   1536 × 1152 canvas — the single largest texture upload in the museum, for
   one wall of words. Past sixteen labels a room spills onto a second sheet
   of its own rather than making the first one taller, and a sheet is never
   wider than the labels it holds: a room with two of them gets a 768 × 192
   canvas, not a 1536 × 192 one with two empty cells on it. */
export function plaqueSheets(room, links, THREE, aniso) {
  THREEref = THREE;
  const items = room.items || [];
  const hex = room.zoneHex || room.hex || '#ffd9a0';
  const cells = new Array(items.length);
  const texs = [];

  for (let first = 0; first < items.length; first += COLS * MAX_ROWS) {
    const mine = items.slice(first, first + COLS * MAX_ROWS);
    const cols = Math.min(COLS, mine.length);
    const rows = Math.ceil(mine.length / cols);
    const cv = canvas(cols * CELL_W, rows * CELL_H);
    const ctx = cv.getContext('2d');

    mine.forEach((idx, j) => {
      const col = j % cols, row = Math.floor(j / cols);
      ctx.save();
      ctx.translate(col * CELL_W, row * CELL_H);
      paintLabel(ctx, room, links[idx] || null, hex);
      ctx.restore();
      /* cells are addressed in texture space; three flips canvas textures, so
         the row at canvas top sits at the top of v, which is v = 1 */
      cells[idx] = {
        sheet: texs.length,
        u0: col / cols, u1: (col + 1) / cols,
        v0: 1 - (row + 1) / rows, v1: 1 - row / rows
      };
    });

    const tex = texture(cv, aniso);
    tex.userData.kind = 'plaque';
    tex.userData.cells = mine.length;
    texs.push(tex);
  }
  return { texs, cells };
}

/* one label, painted at the canvas origin so a sheet of any width can lay its
   cells out around it */
function paintLabel(ctx, room, link, hex) {
  /* plate: near-black with a top-to-bottom sheen, like an acrylic label */
  const bg = ctx.createLinearGradient(0, 0, 0, CELL_H);
  bg.addColorStop(0, '#191b22');
  bg.addColorStop(1, '#0d0e13');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CELL_W, CELL_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CELL_W - 2, CELL_H - 2);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 7, CELL_H);

  const name = (link && link.n) || 'Untitled';
  const url = (link && link.u) || '';
  const note = (link && link.d) || '';

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = hex;
  ctx.font = `600 17px ${MONO}`;
  spaced(ctx, `${room.cat || room.category || ''}`.toUpperCase(), 24, 34, 2.4);

  /* the room's code on the label as well: a plinth in the middle of a long
     hall should still be able to tell you which room you are standing in,
     and it is the same string the door over your head and the map use */
  ctx.font = `600 15px ${MONO}`;
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  const code = room.code || '';
  if (code) ctx.fillText(code, CELL_W - 24 - ctx.measureText(code).width, 33);

  const tpx = fitText(ctx, name, (p) => `${p}px ${SERIF}`, CELL_W - 48, 34);
  ctx.font = `${tpx}px ${SERIF}`;
  ctx.fillStyle = '#f4f1ea';
  const nameLines = wrap(ctx, name, CELL_W - 48).slice(0, 2);
  let y = 34 + tpx * 0.95;
  for (const ln of nameLines) { ctx.fillText(ln, 24, y); y += tpx * 1.08; }

  ctx.font = `15px ${SANS}`;
  ctx.fillStyle = '#98a0ae';
  const noteLines = wrap(ctx, note, CELL_W - 48);
  let ny = Math.max(y + 12, CELL_H - 66);
  for (const ln of noteLines.slice(0, 3)) {
    if (ny > CELL_H - 34) break;
    ctx.fillText(ln, 24, ny); ny += 19;
  }

  ctx.font = `14px ${MONO}`;
  ctx.fillStyle = '#5f6875';
  let host = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  /* the price, in the corner, in the palette's analogue colour: the plan says
     the cost prints on the plaque, and the cost table that arrived in
     November is the reason the field exists at all. It is set before the
     host so the host can be cut short rather than run under it. */
  const cost = (link && link.cost) ? String(link.cost) : '';
  let costW = 0;
  if (cost) {
    ctx.font = `600 15px ${MONO}`;
    costW = ctx.measureText(cost).width;
    ctx.fillStyle = '#ffb700';
    ctx.fillText(cost, CELL_W - 24 - costW, CELL_H - 18);
  }

  ctx.font = `14px ${MONO}`;
  ctx.fillStyle = '#5f6875';
  const hostMax = CELL_W - 48 - (cost ? costW + 26 : 0);
  while (ctx.measureText(host).width > hostMax && host.length > 4) host = host.slice(0, -2);
  ctx.fillText(host.length < url.replace(/^https?:\/\//, '').length ? host + '…' : host, 24, CELL_H - 18);
}

/* ── door name plates ──────────────────────────────────────────────────── */

export function roomSign(room, THREE, aniso) {
  THREEref = THREE;
  /* The plate is 1.44 × 0.36 m of wall over a door, and it is read from a
     couple of metres: 1024 px across it was more texture than the screen has
     pixels for it, times forty-seven doors. The canvas is scaled rather than
     the metrics, so the layout and the size of the letters in the world are
     exactly what they were for 44 % of the memory.

     The frame and the stencil take the *zone* accent, not the category's own
     colour: forty-seven hues over forty-seven doors was a building that
     could not be learned. The code above the name is the same one the floor
     plan and the room card use, so a door, a map and a card all say
     `LIB-03` about the same room. */
  const W = 768, H = 192, K = 0.75;
  const CW = 1024, CH = 256;
  const hex = room.zoneHex || room.hex || '#ffd9a0';
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.scale(K, K);

  ctx.fillStyle = '#0b0c11';
  ctx.fillRect(0, 0, CW, CH);
  const sheen = ctx.createLinearGradient(0, 0, 0, CH);
  sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.01)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.05)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, CW, CH);

  ctx.strokeStyle = hex;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, CW - 28, CH - 28);
  ctx.fillStyle = hex;
  ctx.fillRect(14, 14, 10, CH - 28);

  ctx.textBaseline = 'alphabetic';
  /* The zone name goes along the top and the code goes along the bottom with
     the category and the count. Not for looks: a corridor lamp sits directly
     over a ground-floor door often enough to be counted on, and its bloom sat
     on exactly the strip the code was printed on. The top line is decoration
     if a lamp eats it; the bottom line never is. */
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `600 24px ${MONO}`;
  if (room.zoneName) spaced(ctx, room.zoneName.toUpperCase(), 48, 62, 5);

  const title = room.name || room.title || String(room.id || '').toUpperCase();
  const tpx = fitText(ctx, title, (p) => `${p}px ${SERIF}`, CW - 96, 92);
  ctx.font = `${tpx}px ${SERIF}`;
  ctx.fillStyle = '#f6f3ec';
  ctx.fillText(title, 48, 62 + tpx * 0.92);

  ctx.font = `600 28px ${MONO}`;
  ctx.fillStyle = hex;
  const code = room.code || `ROOM ${String(room.no || 0).padStart(2, '0')}`;
  const bottom = `${code} · ${(room.cat || room.category || '').toUpperCase()} · ${(room.items || []).length} LINKS`;
  /* the long names in this collection — Emulation and Re(de)omps, Recompiles
     and Decompiles — do not fit at 28 px with the letterspacing, and a plate
     whose last word is cut off is worse than a plate with smaller type */
  const spacedW = (t, gap) => [...t].reduce((w, ch) => w + ctx.measureText(ch).width + gap, 0) - gap;
  let bpx = 28, bgap = 2.4;
  for (;;) {
    ctx.font = `600 ${bpx}px ${MONO}`;
    if (spacedW(bottom, bgap) <= CW - 96 || bpx <= 19) break;
    bpx -= 1;
    if (bpx < 24) bgap = 1.6;
  }
  spaced(ctx, bottom, 48, CH - 46, bgap);

  const tex = texture(cv, aniso);
  tex.userData.kind = 'sign';
  return tex;
}

/* ── the acquisitions board in the rotunda ─────────────────────────────── */

export function boardTexture(plan, THREE, aniso) {
  THREEref = THREE;
  /* The board used to set one row per room at a 58 px pitch, which was right
     for twelve rooms and ran off the bottom of the canvas at fifty-one — the
     last rooms on it were simply not on the board. So the list is set in two
     columns, hungriest first, with the zone key along the top: an
     acquisitions board exists to show you which walls are still empty. */
  const W = 1024, H = 1024;
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#12100c';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,217,160,0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  const held = plan.rooms.reduce((n, r) => n + r.items.length, 0);
  const empty = plan.rooms.filter((r) => !r.items.length).length;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd9a0';
  ctx.font = `600 26px ${MONO}`;
  spaced(ctx, 'ORBITUARY · THE MUSEUM OF USEFUL LINKS', 60, 92, 4);
  ctx.font = `76px ${SERIF}`;
  ctx.fillStyle = '#f6f3ec';
  ctx.fillText('Acquisitions wanted', 58, 172);
  ctx.font = `italic 28px ${SERIF}`;
  ctx.fillStyle = '#a9a294';
  ctx.fillText(`${held} things worth keeping, in ${plan.rooms.length} rooms — ${empty} of them still empty.`, 60, 214);

  /* the zone key, so the eight colours on the board and the eight on the
     floor plan are the same eight */
  let kx = 60;
  ctx.font = `600 20px ${MONO}`;
  plan.zones.forEach((z) => {
    ctx.fillStyle = z.hex;
    ctx.fillRect(kx, 246, 14, 14);
    ctx.fillStyle = '#8d8778';
    const tag = `${z.key} ${z.rooms}`;
    ctx.fillText(tag, kx + 22, 259);
    kx += 22 + ctx.measureText(tag).width + 30;
  });

  const rows = plan.rooms.slice()
    .sort((a, b) => (a.items.length - b.items.length) || a.cat.localeCompare(b.cat));
  const perCol = Math.ceil(rows.length / 2);
  const pitch = Math.min(25, (H - 360) / perCol);
  rows.forEach((room, i) => {
    const col = Math.floor(i / perCol);
    const x = 60 + col * 460;
    const y = 316 + (i % perCol) * pitch;
    ctx.fillStyle = room.zoneHex || room.hex;
    ctx.fillRect(x, y - 13, 9, 17);
    ctx.font = `600 19px ${MONO}`;
    ctx.fillStyle = '#c9c2b4';
    ctx.fillText(room.code || '', x + 18, y);
    ctx.font = `22px ${SERIF}`;
    ctx.fillStyle = '#efe9dd';
    let cat = room.cat;
    while (ctx.measureText(cat).width > 230 && cat.length > 6) cat = cat.slice(0, -2);
    ctx.fillText(cat, x + 96, y);
    ctx.font = `19px ${MONO}`;
    ctx.fillStyle = room.items.length ? '#8d8778' : '#ffd9a0';
    ctx.fillText(room.items.length ? `${room.items.length} held` : 'WANTED', x + 340, y);
  });

  ctx.font = `24px ${MONO}`;
  ctx.fillStyle = '#6f6a5e';
  ctx.fillText('WALK TO A ROOM · OR PRESS R FOR ONE AT RANDOM', 60, H - 52);
  const tex = texture(cv, aniso);
  tex.userData.kind = 'board';
  return tex;
}

/* stamp a uv rect onto a small plane so one atlas can serve many meshes */
export function uvRect(geo, cell) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, cell.u0 + u * (cell.u1 - cell.u0), cell.v0 + v * (cell.v1 - cell.v0));
  }
  uv.needsUpdate = true;
  return geo;
}
