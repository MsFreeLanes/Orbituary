/* ── hud ─────────────────────────────────────────────────────────────────
   The parts of the museum that are paper, not plaster: the room card that
   scrambles into place when you walk in, the plaque that comes up when you
   look at an exhibit, the floor plan with you on it, and the sky dial.

   All of it is DOM over the canvas. The 3D view stays the size of the
   window and the interface stays crisp at any pixel density. */

import { IDENTITY } from './identity.js';

const $ = (sel, root) => (root || document).querySelector(sel);

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

const GLYPHS = '▚▞▛▜▟▙█▓▒░/\\|<>=+-*·';

/* anything that came out of identity.js goes through here before it reaches
   innerHTML: the owner is meant to be able to type a sentence into that file
   without wondering whether an angle bracket will take the page down */
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* The ticket keeps a number. A visitor who has been admitted before gets the
   same number back and a line at the bottom saying how many times they have
   come through, which is the only thing the museum remembers about anybody.
   localStorage is not guaranteed on a file:// page, so all of it is optional
   and a visitor with no storage simply gets a fresh ticket every time. */
function ticketSerial() {
  let store = null;
  try { store = window.localStorage; } catch (err) { store = null; }
  let no = null;
  try { no = store && store.getItem('orbituary.serial'); } catch (err) { no = null; }
  if (!no) {
    no = String(100001 + ((Math.random() * 899998) | 0));
    try { if (store) store.setItem('orbituary.serial', no); } catch (err) { /* fine */ }
  }
  let visits = 0;
  try {
    if (store) {
      visits = (+store.getItem('orbituary.visits') || 0) + 1;
      store.setItem('orbituary.visits', String(visits));
    }
  } catch (err) { visits = 0; }
  const d = new Date();
  const two = (n) => String(n).padStart(2, '0');
  return {
    no, visits,
    date: `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
  };
}

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
  card.appendChild(el('div', 'brand', IDENTITY.entity));
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

  /* ── the ground track ──
     The panel used to be labelled SKY, which on a station is not what it is
     showing: the museum is not standing under a sky, it is flying over a
     place, and the seven buttons pick which place the hull is passing. The
     dial's own labels come from sky.js and are untouched — a region is still
     a region — only the word over the top of the panel tells the truth. */
  const sky = el('div', 'skybox');
  sky.appendChild(el('div', 'kicker', 'GROUND TRACK'));
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
      if (hall) rectNode(hall, 'roomrect', plan.stairHall.zoneHex || plan.stairHall.hex, g);
    }
    plan.walkable.rects
      .filter((r) => r.floor === storey && r.kind === 'corridor' && r.room !== plan.stairHall.id)
      .forEach((rect) => rectNode(rect, 'corr', null, g));
    plan.walkable.rects
      .filter((r) => r.floor === storey && r.kind === 'room')
      .forEach((rect) => {
        /* the map is coloured by zone, not by room: forty-seven hues made a
           diagram nobody could read, and eight make one you can learn */
        const room = plan.byId(rect.room);
        rectNode(rect, 'roomrect', room ? (room.zoneHex || room.hex) : '#888', g);
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
  /* the key: eight zones, and how many doors each one owns. The counts come
     out of the plan, so the key cannot fall out of date with the building,
     and when a category moves between the storeys the map and the key move
     with it. */
  const key = el('div', 'zonekey');
  (plan.zones || []).forEach((z) => {
    const row = el('div', 'zk');
    const dot = el('i', '');
    dot.style.background = z.hex;
    row.appendChild(dot);
    row.appendChild(el('span', 'zk-code', z.key));
    row.appendChild(el('span', 'zk-name', z.name.toLowerCase()));
    row.appendChild(el('span', 'zk-n', String(z.rooms)));
    key.appendChild(row);
  });
  mapBox.appendChild(key);
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
  const plaqueCost = el('div', 'plaque-cost', '');
  const plaqueText = el('div', 'plaque-text', '');
  const plaqueNote = el('div', 'plaque-note', '');
  const plaqueGo = el('div', 'plaque-go', 'ENTER opens · click the plinth');
  plaque.appendChild(plaqueKicker);
  plaque.appendChild(plaqueTitle);
  plaque.appendChild(plaqueCost);
  plaque.appendChild(plaqueText);
  plaque.appendChild(plaqueNote);
  plaque.appendChild(plaqueGo);
  root.appendChild(plaque);

  /* ── bottom bar ── */
  const bar = el('div', 'bar');
  const keys = el('div', 'keys',
    '<b>WASD</b> walk <b>SHIFT</b> stride <b>MOUSE</b> look <b>T</b> tour <b>R</b> random room <b>G</b> ground track <b>M</b> mute <b>E</b> lift <b>H</b> front door <b>TAB</b> brochure');
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

  /* ── the door: a ticket, then a brochure ─────────────────────────────
      The rules and the disclaimer used to be a room you could walk past.
      They are now the door itself: the rules are printed on the ticket, and
      agreeing to them is what tears it. Nothing is asked for beyond the
      click — no account, no form, nothing scanned — and the ticket keeps a
      serial so the same visitor gets the same number back.

      Past the ticket comes the brochure: what the building is, how to move
      through it, and the ask at the end. The same brochure answers `H`
      inside the museum, and the same closing page runs when a full circuit
      of the guided walk finishes, so the tour ends where every museum ends
      — at the desk that asks you to keep it open.

      The element keeps the class `intro` and the `.intro-kicker` inside it,
      because the probes in scratch/ drive the museum through those names. */
  const serial = ticketSerial();
  const gate = el('div', 'intro gate');
  gate.innerHTML = `
    <div class="ticket">
      <div class="ticket-head">
        <span class="intro-kicker">${esc(IDENTITY.entity)} · ${esc(IDENTITY.parent)}</span>
        <span class="ticket-no">ADMIT ONE · No. ${serial.no} · ${serial.date}</span>
      </div>
      <h1>${esc(IDENTITY.building)}</h1>
      <div class="ticket-count">${linkCount} links · ${withThings} rooms with something in them · ${downstairs.length} waiting in the cellar</div>
      <div class="perf"><span>the rules are printed on the ticket</span></div>
      <ol class="ticket-rules">
        ${IDENTITY.rules.map((r) => `<li><b>${esc(r[0])}</b><span>${esc(r[1])}</span></li>`).join('')}
      </ol>
      <button class="stamp" type="button">AGREE — TEAR THE TICKET</button>
      <div class="ticket-foot">agreeing to these rules is the door. ${serial.visits > 1 ? `you have been admitted ${serial.visits} times.` : 'there is nothing else to fill in.'}</div>
    </div>`;
  root.appendChild(gate);

  const brochure = el('div', 'brochure');
  brochure.style.display = 'none';
  brochure.innerHTML = `
    <div class="brochure-inner">
      <div class="brochure-head">
        <span class="kicker">${esc(IDENTITY.entity)} · BROCHURE</span>
        <button class="brochure-x" type="button" title="close">×</button>
      </div>
      <h2 id="brochure-title">Before you walk in</h2>
      <p class="brochure-thesis">${esc(IDENTITY.thesis)}</p>

      <div class="kicker">WHAT YOU ARE STANDING IN</div>
      <p>A station, not a hall: a domed rotunda with the Cupola over it, ranges of
      rooms off two ring corridors, and fifteen of the emptiest categories under
      the floor with the lights that try to start. ${linkCount} links on
      ${withThings} sets of walls, and ${downstairs.length} rooms downstairs
      waiting for their first exhibit.</p>
      <p>Every room is one subject. The number on the door card is the number of
      plinths inside, and the cost on a plaque is what the thing cost the day the
      plaque was written.</p>

      <div class="kicker">CONTROLS</div>
      <table class="brochure-keys">
        <tr><td><b>W A S D</b></td><td>walk, back off, sidestep — <b>Shift</b> to stride</td></tr>
        <tr><td><b>mouse</b></td><td>look around; click a plinth to open its link</td></tr>
        <tr><td><b>Enter</b></td><td>open whatever you are looking at</td></tr>
        <tr><td><b>T</b></td><td>the next stop on the guided walk</td></tr>
        <tr><td><b>R</b></td><td>a room at random</td></tr>
        <tr><td><b>G</b></td><td>the ground track: seven regions and an hour</td></tr>
        <tr><td><b>M</b></td><td>mute</td></tr>
        <tr><td><b>E</b></td><td>the lift, at the north end of the stair well — stand in the cabin and press it</td></tr>
        <tr><td><b>H</b></td><td>walk back to the front door</td></tr>
        <tr><td><b>Shift + H</b></td><td>stand at the front door now</td></tr>
        <tr><td><b>Tab</b></td><td>this brochure</td></tr>
        <tr><td><b>Esc</b></td><td>stop walking, stop being walked</td></tr>
      </table>

      <div class="kicker">WHAT THE MUSEUM DOES FOR YOU</div>
      <p><b>The guided walk.</b> <b>T</b> takes you room to room along the
      corridors on an eased route, with an arrow hanging in front of you. A full
      circuit ends at the desk at the end of this brochure.</p>
      <p><b>A room at random.</b> <b>R</b> picks a <i>room</i>, not a link —
      ${withThings + downstairs.length} choices instead of ${linkCount} — and
      walks you there. You find the links inside it.</p>
      <p><b>The ground track.</b> The hull flies over a real place. <b>G</b>
      opens the dial: seven regions, and a slider that swings the sun the whole
      way round the limb. <b>ALWAYS NIGHT</b> keeps the stars out whether the
      clock likes it or not.</p>
      <p><b>The Cupola.</b> The dome over the rotunda looks down the well at the
      Earth the station is passing. Stand under it and wait.</p>
      <p><b>The cellar.</b> The fifteen categories with the least in them live
      under the floor, off one grand stair. They are dusty, the tubes flicker,
      and the floor creaks. When a category gets its first exhibit it moves
      upstairs on its own.</p>
      <p><b>Sound.</b> Footsteps take the floor under them, every room has its
      own air sized to its own volume, and occasionally something happens in a
      room you are not in. <b>M</b> mutes.</p>

      <div class="kicker">THE ASK</div>
      <p>${esc(IDENTITY.curation)}</p>
      ${IDENTITY.donation
        ? `<p>Keeping the museum open costs money. <a href="${esc(IDENTITY.donation.url)}" target="_blank" rel="noopener">${esc(IDENTITY.donation.line || 'Give here')}</a>.</p>`
        : `<p class="brochure-blank">The donation link is not posted yet. When it is, it is printed here.</p>`}
      ${IDENTITY.socials.length
        ? `<p>${IDENTITY.socials.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ')}</p>`
        : `<p class="brochure-blank">The keeper’s channels are not posted yet.</p>`}
      <p class="brochure-foot">Three stands in the Trophy Hall are empty on purpose:
      company sponsors, then donors over a threshold, then the keeper’s own work.
      Nothing has earned one yet.</p>

      <button class="brochure-go" type="button">WALK IN</button>
    </div>`;
  root.appendChild(brochure);

  const brochureTitle = $('#brochure-title', brochure);
  const goBtn = $('.brochure-go', brochure);
  let brochureMode = 'entry';

  function showBrochure(mode) {
    brochureMode = mode || 'entry';
    brochure.style.display = 'block';
    brochure.classList.remove('gone');
    brochureTitle.textContent = brochureMode === 'closing'
      ? 'That is the end of the circuit'
      : brochureMode === 'help' ? 'The brochure' : 'Before you walk in';
    goBtn.textContent = brochureMode === 'closing' ? 'KEEP WALKING' : 'WALK IN';
    $('.brochure-inner', brochure).scrollTop = 0;
  }
  function closeBrochure() {
    brochure.style.display = 'none';
  }

  /* tearing the ticket: an aperture opening rather than a fade, because the
     identity spec asks for a shutter and a shutter is what a station door is */
  gate.addEventListener('click', (e) => {
    if (!e.target.classList.contains('stamp')) return;
    gate.classList.add('torn');
    setTimeout(() => {
      gate.style.display = 'none';
      showBrochure('entry');
    }, 620);
  });
  brochure.addEventListener('click', (e) => {
    if (e.target.classList.contains('brochure-x')) { closeBrochure(); return; }
    if (e.target.classList.contains('brochure-go')) {
      const firstEntry = brochureMode === 'entry';
      brochureMode = 'help';
      closeBrochure();
      /* the way-in hint used to fire at boot, which meant it scrolled past
         behind a ticket nobody had read yet. it belongs on this side of the
         door, so the brochure hands the moment back to main.js */
      if (firstEntry && actions.onEnter) actions.onEnter();
    }
  });

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
    const code = room.code ? `${room.code} · ` : '';
    if (room.cat === 'Rotunda') return `${code}no links yet · acquisitions board`;
    if (room.cat === 'Corridor') return `${room.doors} doors off it · ${room.range}`;
    if (room.cat === 'Stair' || room.cat === 'Stair Hall') return `${code}${room.subtitle}`;
    const n = room.items.length;
    /* the same word as the door plate and the empty plinth inside: the room is
       not short of something, it is asking for something */
    if (n === 0) return `${code}${room.cat} · wanted · ${room.range}`;
    return `${code}${room.cat} · ${n} ${n === 1 ? 'link' : 'links'} · ${room.range}`;
  }

  function setRoom(room) {
    if (!room) return;
    scramble(roomName, room.name || 'The Rotunda');
    roomSub.textContent = subOf(room);
    /* the zone's colour runs down the left of the card, the way the door
       plate and the map now take it: the stair and the hall have a colour of
       their own, and a card that stays amber below ground is still describing
       the floor above you */
    card.style.setProperty('--wing', room.zoneHex || room.hex || '#ffd9a0');
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
    mapHint.textContent = room.cat === 'Rotunda' ? 'you are here: centre' : `you are here: ${room.range}`;
  }

  function showPlaque(link, room) {
    if (!link) { plaque.style.display = 'none'; return; }
    plaque.style.display = 'block';
    plaqueKicker.textContent = (room
      ? (room.code ? `${room.code} · ${room.cat}` : room.cat)
      : '').toUpperCase();
    plaqueTitle.textContent = link.t;
    /* the price, when the collection knows it: the plan says the cost prints
       on the plaque, and the 3D label already carries it in the corner */
    plaqueCost.textContent = link.cost ? String(link.cost) : '';
    plaqueCost.style.display = link.cost ? 'block' : 'none';
    plaqueText.textContent = link.d || '';
    plaqueText.style.display = link.d ? 'block' : 'none';
    plaqueNote.textContent = String(link.u || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    plaque.style.setProperty('--wing', room ? (room.zoneHex || room.hex) : '#fff');
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
    if (brochure.style.display === 'none') showBrochure('help');
    else closeBrochure();
  }
  /* the probes in scratch/ still call this to get the interface out of the
     way before they photograph or measure the building, so it closes both
     halves of the door rather than only the one that used to exist */
  function hideIntro() {
    gate.classList.add('torn');
    gate.style.display = 'none';
    closeBrochure();
  }

  return {
    root, setRoom, setStorey, showPlaque, setYou, setSky, setStats, setLevel,
    toast, toggleHelp, hideIntro, showBrochure, closeBrochure, scramble,
    get gateVisible() {
      return gate.style.display !== 'none' && !gate.classList.contains('torn');
    },
    get introVisible() {
      return gate.style.display !== 'none' || brochure.style.display !== 'none';
    }
  };
}
