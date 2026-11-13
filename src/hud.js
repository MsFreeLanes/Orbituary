/* ── hud ─────────────────────────────────────────────────────────────────
   The parts of the museum that are paper, not plaster: the room card that
   scrambles into place when you walk in, the plaque that comes up when you
   look at an exhibit, the floor plan with you on it, and the sky dial.

   All of it is DOM over the canvas. The 3D view stays the size of the
   window and the interface stays crisp at any pixel density. */

const $ = (sel, root) => (root || document).querySelector(sel);

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

const GLYPHS = '▚▞▛▜▟▙█▓▒░/\\|<>=+-*·';

function scramble(node, text, ms = 620) {
  const start = performance.now();
  const chars = [...text];
  function step(now) {
    const t = Math.min(1, (now - start) / ms);
    const settled = Math.floor(t * chars.length * 1.35);
    node.textContent = chars
      .map((c, i) => (i < settled || c === ' ' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
      .join('');
    if (t < 1) requestAnimationFrame(step);
    else node.textContent = text;
  }
  requestAnimationFrame(step);
}

export function createHUD(plan, actions = {}) {
  const root = el('div', 'hud');
  document.body.appendChild(root);

  /* ── brand + room card ──
     The card opens on the building's own numbers rather than on a sentence
     somebody wrote when the museum was a quarter its size: how many rooms
     actually have something standing in them, and how many are shelved
     downstairs still waiting for their first exhibit. Both come out of the
     plan, so the line stays true when the counts cross and rooms move between
     the storeys. */
  const card = el('div', 'card');
  card.appendChild(el('div', 'brand', 'MUSEUM OF USEFUL LINKS'));
  const upstairs = plan.rooms.filter((r) => r.floor !== 'basement');
  const downstairs = plan.rooms.filter((r) => r.floor === 'basement');
  const withThings = plan.rooms.filter((r) => r.items.length && r.floor !== 'basement').length;
  const linkCount = plan.rooms.reduce((n, r) => n + r.items.length, 0);
  const roomName = el('div', 'room-name', 'The Rotunda');
  const roomSub = el('div', 'room-sub',
    `${withThings} rooms with something in them · ${downstairs.length} waiting downstairs`);
  card.appendChild(roomName);
  card.appendChild(roomSub);
  root.appendChild(card);

  /* ── sky dial ── */
  const sky = el('div', 'skybox');
  sky.appendChild(el('div', 'kicker', 'SKY'));
  const skyName = el('div', 'sky-name', 'USA — East');
  const skyClock = el('div', 'sky-clock', '');
  const dial = el('div', 'dial');
  (actions.skyPresets || []).forEach((p) => {
    const b = el('button', 'chip', p.label);
    b.dataset.id = p.id;
    b.onclick = () => { actions.setSky && actions.setSky(p); skyName.textContent = p.label; };
    dial.appendChild(b);
  });
  const timeRow = el('div', 'row');
  const timeSlider = el('input', 'time');
  timeSlider.type = 'range';
  timeSlider.min = '0'; timeSlider.max = '1439'; timeSlider.step = '1';
  timeSlider.value = String(new Date().getHours() * 60 + new Date().getMinutes());
  timeRow.appendChild(el('span', 'mini', 'TIME'));
  timeRow.appendChild(timeSlider);
  const nightWrap = el('label', 'toggle');
  const nightBox = el('input');
  nightBox.type = 'checkbox'; nightBox.checked = true;
  nightWrap.appendChild(nightBox);
  nightWrap.appendChild(el('span', 'mini', 'ALWAYS NIGHT'));
  nightBox.onchange = () => actions.setNight && actions.setNight(nightBox.checked);
  timeSlider.oninput = () => actions.setTime && actions.setTime(+timeSlider.value);
  timeRow.appendChild(nightWrap);
  sky.appendChild(skyName);
  sky.appendChild(skyClock);
  sky.appendChild(dial);
  sky.appendChild(timeRow);
  root.appendChild(sky);

  /* ── floor plan ────────────────────────────────────────────────────────
     One storey at a time. The building is about 106 m across, and a viewBox
     that holds both floors at once puts a room at nine pixels and lays the
     cellar grid directly under the ground corridors, where it reads as one
     grey mass. So the map is scaled to the storey the visitor is actually on
     and draws only that one; the other floor is a hint and a flight of steps
     away, not a sheet of ink under your feet. The stair mouth is marked on
     both, because it is the only door between them. */
  const mapBox = el('div', 'mapbox');
  const mapKicker = el('div', 'kicker', 'FLOOR PLAN');
  mapBox.appendChild(mapKicker);
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '188'); svg.setAttribute('height', '188');
  function shape(node, attrs, parent) {
    const n = document.createElementNS(svgNS, node);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(n);
    return n;
  }

  /* plan view: north up, east to the right. the building's +X faces west, so
     both world axes are flipped here; corners are computed in world space and
     flipped, which beats fighting SVG rotation composition */
  function rectNode(rect, cls, fill, parent) {
    const st = Math.sin(rect.angle), ct = Math.cos(rect.angle);
    const ex = [ct, -st], ez = [st, ct];
    const pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wx = rect.cx + sx * rect.halfX * ex[0] + sz * rect.halfZ * ez[0];
      const wz = rect.cz + sx * rect.halfX * ex[1] + sz * rect.halfZ * ez[1];
      pts.push(`${(-wx).toFixed(2)},${(-wz).toFixed(2)}`);
    }
    const order = [pts[0], pts[2], pts[3], pts[1]];
    const p = document.createElementNS(svgNS, 'polygon');
    p.setAttribute('points', order.join(' '));
    p.setAttribute('class', cls);
    if (fill) { p.setAttribute('fill', fill); p.setAttribute('fill-opacity', '0.28'); p.setAttribute('stroke', fill); }
    (parent || svg).appendChild(p);
    return p;
  }

  /* how far a storey reaches out from the centre, so each one can be drawn at
     the size of itself rather than at the size of the whole building */
  function reachOf(storey) {
    let r = storey === 'ground' ? plan.rotunda.r : 0;
    plan.rooms.forEach((room) => {
      if (room.floor !== storey) return;
      r = Math.max(r, Math.hypot(room.center.x, room.center.z) + Math.max(room.w, room.d) / 2);
    });
    return r;
  }

  const layers = {};
  const stairGlyph = {};
  ['ground', 'basement'].forEach((storey) => {
    const g = document.createElementNS(svgNS, 'g');
    if (storey === 'ground') {
      shape('circle', { cx: 0, cy: 0, r: plan.rotunda.r, class: 'rot' }, g);
    } else {
      /* the stair hall is the one cellar space the plan names, so it is drawn
         as a room: it is where you arrive, not a way through to somewhere */
      const hall = plan.walkable.rects.find((r) => r.room === plan.stairHall.id);
      if (hall) rectNode(hall, 'roomrect', plan.stairHall.hex, g);
    }
    plan.walkable.rects
      .filter((r) => r.floor === storey && r.kind === 'corridor' && r.room !== plan.stairHall.id)
      .forEach((rect) => rectNode(rect, 'corr', null, g));
    plan.walkable.rects
      .filter((r) => r.floor === storey && r.kind === 'room')
      .forEach((rect) => {
        const room = plan.byId(rect.room);
        rectNode(rect, 'roomrect', room ? room.hex : '#888', g);
      });
    const s = plan.stair;
    const x0 = -(s.x + s.w / 2), x1 = -(s.x - s.w / 2);
    const y0 = -(s.z + s.run), y1 = -(s.z);
    shape('rect', {
      x: x0.toFixed(2), y: y0.toFixed(2),
      width: (x1 - x0).toFixed(2), height: (y1 - y0).toFixed(2),
      fill: 'rgba(255, 217, 160, 0.16)', stroke: '#ffd9a0',
      'stroke-width': '0.3', 'stroke-dasharray': '1.2 0.8'
    }, g);
    stairGlyph[storey] = shape('text', {
      x: (-s.x).toFixed(2), y: (-(s.z + s.run / 2)).toFixed(2),
      fill: '#ffd9a0', 'text-anchor': 'middle', 'font-size': '4',
      'font-family': 'ui-monospace, monospace'
    }, g);
    stairGlyph[storey].textContent = storey === 'ground' ? '↓' : '↑';
    layers[storey] = g;
    svg.appendChild(g);
  });

  const you = document.createElementNS(svgNS, 'path');
  you.setAttribute('d', 'M0,-1.6 L1.2,1.4 L0,0.7 L-1.2,1.4 Z');
  you.setAttribute('class', 'you');
  svg.appendChild(you);
  mapBox.appendChild(svg);
  const mapHint = el('div', 'map-hint', '');
  const mapOther = el('div', 'map-hint', '');
  mapBox.appendChild(mapHint);
  mapBox.appendChild(mapOther);
  root.appendChild(mapBox);

  let shown = null;
  let youScale = 1;
  function setStorey(storey) {
    if (storey === shown) return;
    shown = storey;
    const span = (reachOf(storey) + 3) * 2;
    svg.setAttribute('viewBox', `${-span / 2} ${-span / 2} ${span} ${span}`);
    for (const k in layers) layers[k].setAttribute('display', k === storey ? '' : 'none');
    /* everything in here is in metres, including the arrow that says where
       you are and the glyph on the stair, so they are sized against the span
       or the wide ground view shrinks them out of existence */
    for (const k in stairGlyph) stairGlyph[k].setAttribute('font-size', (span / 26).toFixed(2));
    youScale = span / 44;
    mapKicker.textContent = 'FLOOR PLAN · ' + (storey === 'ground' ? 'GROUND' : 'CELLAR');
    mapOther.textContent = storey === 'ground'
      ? `↓ the stair · ${downstairs.length} rooms downstairs`
      : `↑ the stair · ${upstairs.length} rooms upstairs`;
  }
  setStorey('ground');

  /* ── exhibit plaque ── */
  const plaque = el('div', 'plaque');
  plaque.style.display = 'none';
  const plaqueKicker = el('div', 'kicker', '');
  const plaqueTitle = el('div', 'plaque-title', '');
  const plaqueNote = el('div', 'plaque-note', '');
  const plaqueGo = el('div', 'plaque-go', 'ENTER opens · click the plinth');
  plaque.appendChild(plaqueKicker);
  plaque.appendChild(plaqueTitle);
  plaque.appendChild(plaqueNote);
  plaque.appendChild(plaqueGo);
  root.appendChild(plaque);

  /* ── bottom bar ── */
  const bar = el('div', 'bar');
  const keys = el('div', 'keys',
    '<b>WASD</b> walk <b>SHIFT</b> stride <b>MOUSE</b> look <b>T</b> tour <b>R</b> random room <b>G</b> sky dial <b>M</b> mute <b>H</b> help');
  const meter = el('div', 'meter');
  for (let i = 0; i < 12; i++) meter.appendChild(el('i', ''));
  const stats = el('div', 'stats', '');
  bar.appendChild(keys);
  bar.appendChild(meter);
  bar.appendChild(stats);
  root.appendChild(bar);

  /* ── toasts ── */
  const toasts = el('div', 'toasts');
  root.appendChild(toasts);

  /* ── help ── */
  const help = el('div', 'help');
  help.style.display = 'none';
  help.innerHTML = `
    <h2>The building</h2>
    <p>A domed rotunda, twelve ranges, ${withThings} rooms with something standing in
    them, and ${downstairs.length} more under the floor. Each room holds one subject:
    the number of links on the door card is the number of plinths inside.</p>
    <p><b>Two storeys</b> — one grand stair comes down through the middle of the
    rotunda into a stair hall, and four cellar corridors run out of it. The floor
    plan draws the storey you are on, and marks the stair on both.</p>
    <p><b>Walk</b> — WASD, mouse to look, Shift to stride. Doorways are 1.1 m wide;
    the halls have 1.8 m arches.</p>
    <p><b>Guided walk</b> — <b>T</b> tours the next room on the circuit,
    <b>R</b> drops you in a room at random. The route follows the corridors;
    grab the mouse any time to look around on the way.</p>
    <p><b>Exhibits</b> — look at a plinth and press <b>ENTER</b>, or click it, to
    open the link in a new tab.</p>
    <p><b>Sky</b> — <b>G</b> opens the dial. Seven regions, and a time slider that
    swings the real sky over the building. Windows face the night.</p>
    <p><b>Sound</b> — footsteps take the floor they are on; every room has its own
    air. <b>M</b> mutes.</p>`;
  root.appendChild(help);

  /* ── intro ── */
  const intro = el('div', 'intro');
  intro.innerHTML = `
    <div class="intro-inner">
      <div class="intro-kicker">${linkCount} LINKS, ${withThings} ROOMS, AND A CELLAR</div>
      <h1>The Museum of<br>Useful Links</h1>
      <p>Click to walk in. The sky outside is tonight's sky.</p>
      <div class="intro-keys">WASD · MOUSE · SHIFT</div>
    </div>`;
  root.appendChild(intro);

  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const t = el('div', 'toast', msg);
    toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      setTimeout(() => t.remove(), 500);
    }, ms);
  }

  /* the card's second line says what the space is. A gallery counts its
     plinths; the rotunda, the stair, the hall under it and the corridors
     between rooms hold nothing, so they say what they are instead — and a
     corridor says how many doors hang off it, which is the only thing a
     corridor is for. */
  function subOf(room) {
    if (room.cat === 'Rotunda') return 'no links yet · acquisitions board';
    if (room.cat === 'Corridor') return `${room.doors} doors off it · ${room.range}`;
    if (room.cat === 'Stair' || room.cat === 'Stair Hall') return room.subtitle;
    const n = room.items.length;
    return `${room.cat} · ${n} ${n === 1 ? 'link' : 'links'} · ${room.range}`;
  }

  function setRoom(room) {
    if (!room) return;
    scramble(roomName, room.name || 'The Rotunda');
    roomSub.textContent = subOf(room);
    /* the room's own colour runs down the left of the card, the way the plaque
       already takes it: the stair and the hall have a colour of their own, and
       a card that stays amber below ground is still describing the floor
       above you */
    card.style.setProperty('--wing', room.hex || '#ffd9a0');
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
    mapHint.textContent = room.cat === 'Rotunda' ? 'you are here: centre' : `you are here: ${room.range}`;
  }

  function showPlaque(link, room) {
    if (!link) { plaque.style.display = 'none'; return; }
    plaque.style.display = 'block';
    plaqueKicker.textContent = (room ? room.cat : '').toUpperCase();
    plaqueTitle.textContent = link.t;
    plaqueNote.textContent = link.n || link.u;
    plaque.style.setProperty('--wing', room ? room.hex : '#fff');
  }

  function setYou(x, z, yaw) {
    you.setAttribute('transform',
      `translate(${(-x).toFixed(2)} ${(-z).toFixed(2)}) rotate(${(180 - yaw * 180 / Math.PI).toFixed(1)})` +
      ` scale(${youScale.toFixed(2)})`);
  }

  function setSky(state, label) {
    skyClock.textContent = label;
    if (state) skyName.textContent = skyName.textContent;
  }

  function setStats(text) { stats.textContent = text; }
  function setLevel(v) {
    const kids = meter.children;
    for (let i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('on', v * kids.length > i);
    }
  }

  function toggleHelp() {
    help.style.display = help.style.display === 'none' ? 'block' : 'none';
  }
  function hideIntro() { intro.classList.add('gone'); }

  return {
    root, setRoom, setStorey, showPlaque, setYou, setSky, setStats, setLevel,
    toast, toggleHelp, hideIntro, scramble,
    get introVisible() { return !intro.classList.contains('gone'); }
  };
}
