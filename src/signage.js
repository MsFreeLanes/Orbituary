/* ── signage ─────────────────────────────────────────────────────────────
   Everything in a museum that has words on it. Two kinds:

   · a wall label on the face of every plinth — one canvas atlas per room,
     so 88 labels cost 12 textures instead of 88;
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

const CELL_W = 384, CELL_H = 192, COLS = 4;

export function plaqueAtlas(room, links, THREE, aniso) {
  THREEref = THREE;
  const items = room.items || [];
  const rows = Math.max(1, Math.ceil(items.length / COLS));
  const cv = canvas(COLS * CELL_W, rows * CELL_H);
  const ctx = cv.getContext('2d');
  const hex = room.hex || '#ffd9a0';

  items.forEach((idx, i) => {
    const cx = (i % COLS) * CELL_W, cy = Math.floor(i / COLS) * CELL_H;
    ctx.save();
    ctx.translate(cx, cy);

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

    const link = links[idx] || null;
    const name = (link && link.n) || 'Untitled';
    const url = (link && link.u) || '';
    const note = (link && link.d) || '';

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = hex;
    ctx.font = `600 17px ${MONO}`;
    spaced(ctx, `${room.cat || room.category || ''}`.toUpperCase(), 24, 34, 2.4);

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
    while (ctx.measureText(host).width > CELL_W - 48 && host.length > 4) host = host.slice(0, -2);
    ctx.fillText(host.length < url.replace(/^https?:\/\//, '').length ? host + '…' : host, 24, CELL_H - 18);

    ctx.restore();
  });

  /* cells are addressed in texture space; three flips canvas textures, so
     the row at canvas top sits at the top of v, which is v = 1 */
  const cells = items.map((_, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    return {
      u0: col / COLS, u1: (col + 1) / COLS,
      v0: 1 - (row + 1) / rows, v1: 1 - row / rows
    };
  });
  return { tex: texture(cv, aniso), cells };
}

/* ── door name plates ──────────────────────────────────────────────────── */

export function roomSign(room, THREE, aniso) {
  THREEref = THREE;
  const W = 1024, H = 256;
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d');
  const hex = room.hex || '#ffd9a0';

  ctx.fillStyle = '#0b0c11';
  ctx.fillRect(0, 0, W, H);
  const sheen = ctx.createLinearGradient(0, 0, 0, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.01)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.05)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = hex;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.fillStyle = hex;
  ctx.fillRect(14, 14, 10, H - 28);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 26px ${MONO}`;
  spaced(ctx, `ROOM ${String(room.no || 0).padStart(2, '0')}`, 48, 66, 4);

  const title = room.name || room.title || String(room.id || '').toUpperCase();
  const tpx = fitText(ctx, title, (p) => `${p}px ${SERIF}`, W - 96, 92);
  ctx.font = `${tpx}px ${SERIF}`;
  ctx.fillStyle = '#f6f3ec';
  ctx.fillText(title, 48, 66 + tpx * 0.92);

  ctx.font = `600 28px ${MONO}`;
  ctx.fillStyle = hex;
  spaced(ctx, `${(room.cat || room.category || '').toUpperCase()} · ${(room.items || []).length} LINKS`,
    48, H - 46, 3);

  return texture(cv, aniso);
}

/* ── the acquisitions board in the rotunda ─────────────────────────────── */

export function boardTexture(plan, THREE, aniso) {
  THREEref = THREE;
  const W = 1024, H = 1024;
  const cv = canvas(W, H);
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#12100c';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,217,160,0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd9a0';
  ctx.font = `600 30px ${MONO}`;
  spaced(ctx, 'THE MUSEUM OF USEFUL LINKS', 60, 96, 5);
  ctx.font = `84px ${SERIF}`;
  ctx.fillStyle = '#f6f3ec';
  ctx.fillText('Acquisitions wanted', 58, 190);
  ctx.font = `italic 30px ${SERIF}`;
  ctx.fillStyle = '#a9a294';
  ctx.fillText('Eighty-eight things worth keeping, in twelve rooms.', 60, 236);

  let y = 300;
  for (const room of plan.rooms) {
    ctx.fillStyle = room.hex;
    ctx.fillRect(60, y - 20, 14, 26);
    ctx.font = `34px ${SERIF}`;
    ctx.fillStyle = '#efe9dd';
    ctx.fillText(room.cat, 92, y);
    ctx.font = `26px ${MONO}`;
    ctx.fillStyle = '#8d8778';
    const label = `${room.items.length} held · ${room.name}`;
    ctx.fillText(label, 92, y + 34);
    const bar = Math.min(1, room.items.length / 16) * (W - 480);
    ctx.fillStyle = 'rgba(255,217,160,0.16)';
    ctx.fillRect(W - 420, y - 16, W - 480, 18);
    ctx.fillStyle = room.hex;
    ctx.fillRect(W - 420, y - 16, bar, 18);
    y += 58;
  }

  ctx.font = `24px ${MONO}`;
  ctx.fillStyle = '#6f6a5e';
  ctx.fillText('WALK TO A ROOM · OR PRESS R FOR THE NEXT ONE', 60, H - 60);
  return texture(cv, aniso);
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
