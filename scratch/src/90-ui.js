/* ── 11 · interface ──────────────────────────────────────────────────────
   Every control in the chrome, plus the keyboard map and the optional sound.
   Nothing in this section touches geometry: the UI asks the room to do
   something through the verbs defined earlier (selectExhibit, flyToWing,
   recomputeVisibility), which keeps the 3D code readable on its own. */

/* — sound —————————————————————————————————————————————————──────────────── */
/* A few oscillators instead of samples: an ambient chord for the room and a
   short pluck whose pitch is keyed to the exhibit's place in the collection.
   Off by default, and the AudioContext is only created on a user gesture. */
let audio = null;
function ensureAudio() {
  if (audio) return audio;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audio = { ctx: new Ctx(), master: null, drone: null };
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0.5;
  audio.master.connect(audio.ctx.destination);
  return audio;
}

function blip(frequency, duration, gain) {
  if (!state.sound) return;
  const a = ensureAudio();
  if (!a) return;
  const now = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  const env = a.ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(frequency, now);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.linearRampToValueAtTime(gain, now + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(env).connect(a.master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

const SCALE = [0, 3, 5, 7, 10, 12, 15];        // pentatonic: any two sound right together
function chime(index) {
  if (!state.sound) return;
  const step = SCALE[index % SCALE.length] + 12 * (Math.floor(index / SCALE.length) % 2);
  blip(392 * Math.pow(2, step / 12), 0.5, 0.05);
  blip(196 * Math.pow(2, step / 12), 0.9, 0.028);
}

function startDrone() {
  const a = ensureAudio();
  if (!a || audio.drone) return;
  const bus = a.ctx.createGain();
  bus.gain.value = 0;
  bus.connect(a.master);
  const voices = [55, 82.5, 110, 164.8].map((frequency, i) => {
    const osc = a.ctx.createOscillator();
    osc.type = i % 2 ? 'sine' : 'triangle';
    osc.frequency.value = frequency;
    const level = a.ctx.createGain();
    level.gain.value = 0.34 / (i + 1);
    /* a slow LFO on each voice's gain keeps the chord breathing */
    const lfo = a.ctx.createOscillator();
    lfo.frequency.value = 0.045 + i * 0.017;
    const depth = a.ctx.createGain();
    depth.gain.value = 0.1 / (i + 1);
    lfo.connect(depth).connect(level.gain);
    osc.connect(level).connect(bus);
    osc.start(); lfo.start();
    return [osc, lfo];
  });
  bus.gain.linearRampToValueAtTime(0.09, a.ctx.currentTime + 3);
  audio.drone = { bus: bus, voices: voices };
}

function stopDrone() {
  if (!audio || !audio.drone) return;
  const dying = audio.drone;
  audio.drone = null;
  const now = audio.ctx.currentTime;
  dying.bus.gain.cancelScheduledValues(now);
  dying.bus.gain.linearRampToValueAtTime(0, now + 0.7);
  setTimeout(() => dying.voices.forEach((pair) => pair.forEach((node) => node.stop())), 900);
}

function toggleSound() {
  state.sound = !state.sound;
  dom.buttons.sound.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
  if (state.sound) {
    const a = ensureAudio();
    if (a && a.ctx.state === 'suspended') a.ctx.resume();
    startDrone();
    toast('Room tone on');
  } else {
    stopDrone();
    toast('Room tone off');
  }
  state.dirty = true;
}

/* — wing chips ——————————————————————————————————————————————──────────────── */
function buildChips() {
  const fragment = document.createDocumentFragment();
  plan.wings.forEach((wing) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.style.setProperty('--wing', wing.hex);
    chip.setAttribute('aria-pressed', 'false');
    chip.innerHTML = '<i class="dot"></i><span>' + esc(wing.name) + '</span><span class="n"></span>';
    chip.title = 'Solo the ' + wing.name + ' wing — click it again to open the whole room';
    chip.addEventListener('click', () => soloWing(wing.name));
    wing._chip = chip;
    fragment.appendChild(chip);
  });
  dom.chips.appendChild(fragment);
  /* the chips are the filter, and every one of them starts lit */
  plan.wings.forEach((wing) => state.wingsOn.add(wing.name));
}

/* One wing at a time is the natural way to read a rotunda: the hall you are
   standing in, and nothing else. Clicking the soloed wing opens it up again. */
function soloWing(name) {
  const only = state.wingsOn.size === 1 && state.wingsOn.has(name);
  state.wingsOn.clear();
  if (only) plan.wings.forEach((wing) => state.wingsOn.add(wing.name));
  else state.wingsOn.add(name);
  recomputeVisibility();
  flyToWing(only ? null : name, 1.0);
  blip(520, 0.06, 0.03);
  announce(only ? 'All wings shown.' : 'Soloed the ' + name + ' wing.');
}

function updateChips() {
  const query = state.query.trim().toLowerCase();
  const soloed = state.wingsOn.size !== plan.wings.length;
  plan.wings.forEach((wing) => {
    const shown = countInWing(wing, query);
    const chip = wing._chip;
    if (!chip) return;
    chip.querySelector('.n').textContent = shown;
    chip.classList.toggle('empty', shown === 0);
    chip.setAttribute('aria-pressed', soloed && state.wingsOn.has(wing.name) ? 'true' : 'false');
  });
  dom.meta.innerHTML = state.visible.length === LINKS.length && !state.favouritesOnly
    ? LINKS.length + ' exhibits · ' + plan.wings.length + ' wings'
    : '<b>' + state.visible.length + '</b> of ' + LINKS.length + ' in view';
}

/* — search ————————————————————————————————————————————————────────────────── */
let searchFrame = 0;
function onSearchInput() {
  state.query = dom.search.value;
  dom.searchClear.classList.toggle('show', state.query.length > 0);
  renderResults();
  /* one frame of coalescing: typing should never re-shade the room per keystroke */
  cancelAnimationFrame(searchFrame);
  searchFrame = requestAnimationFrame(() => recomputeVisibility());
}

function renderResults() {
  const query = state.query.trim();
  if (!query) { dom.results.classList.remove('open'); dom.results.innerHTML = ''; return; }
  const lower = query.toLowerCase();
  const hits = [];
  LINKS.forEach((link, i) => {
    if (exhibitIsVisible(link, lower)) hits.push(i);
  });
  state.results = hits.slice(0, 12);
  state.cursor = state.results.length ? 0 : -1;
  if (!hits.length) {
    dom.results.innerHTML = '<div class="none">Nothing in the collection matches “' + esc(query) + '”.</div>';
  } else {
    const rows = state.results.map((i) => {
      const link = LINKS[i];
      return '<div class="result' + (i === state.results[0] ? ' cursor' : '') + '"' +
        ' data-index="' + i + '" style="--wing:' + link._wing.hex + '">' +
        '<i class="dot"></i><span class="nm">' + highlight(link.n, query) + '</span>' +
        '<span class="wing">' + esc(link.c) + '</span></div>';
    });
    rows.push(hits.length > state.results.length
      ? '<div class="none">' + (hits.length - state.results.length) + ' more — keep typing</div>' : '');
    dom.results.innerHTML = rows.join('');
  }
  dom.results.classList.add('open');
}

function moveResultCursor(delta) {
  if (!state.results || !state.results.length) return;
  state.cursor = (state.cursor + delta + state.results.length) % state.results.length;
  const rows = dom.results.querySelectorAll('.result');
  for (let i = 0; i < rows.length; i++) rows[i].classList.toggle('cursor', i === state.cursor);
  if (rows[state.cursor]) rows[state.cursor].scrollIntoView({ block: 'nearest' });
}

function chooseResult() {
  if (!state.results || !state.results.length) return;
  const index = state.results[clamp(state.cursor, 0, state.results.length - 1)];
  dom.results.classList.remove('open');
  selectExhibit(index, true);
}

function clearSearch() {
  dom.search.value = '';
  state.query = '';
  dom.searchClear.classList.remove('show');
  dom.results.classList.remove('open');
  recomputeVisibility();
}

/* — favourites ———————————————————————————————————————————────────────────── */
function loadFavourites() {
  const saved = store.read('favorites');
  if (Array.isArray(saved)) saved.forEach((url) => state.favs.add(url));
}

function toggleFavourite(index) {
  const link = LINKS[index];
  if (!link) return;
  const saving = !state.favs.has(link.u);
  if (saving) state.favs.add(link.u); else state.favs.delete(link.u);
  store.write('favorites', Array.from(state.favs));
  toast(saving ? 'Saved ' + link.n + ' to favourites' : 'Removed ' + link.n + ' from favourites');
  if (state.selected === index) paintLabel(link, index);
  if (state.mode === 'catalogue') paintCatalogue();
  if (state.favouritesOnly) recomputeVisibility();
  updateChips();
  announce(saving ? 'Saved to favourites.' : 'Removed from favourites.');
  blip(saving ? 1046 : 392, 0.09, 0.04);
}

function toggleFavouritesOnly() {
  state.favouritesOnly = !state.favouritesOnly;
  if (state.favouritesOnly && !state.favs.size) {
    state.favouritesOnly = false;
    toast('No favourites yet — press F while an exhibit is open');
    return;
  }
  toast(state.favouritesOnly ? 'Showing ' + state.favs.size + ' favourites' : 'Showing the whole collection');
  recomputeVisibility();
}

/* `onlyFavourites` is a filter like any other, so it lives inside the
   predicate the visibility solver already uses. */
function passesFavourites(link) {
  return !state.favouritesOnly || state.favs.has(link.u);
}

/* — mode ──────────────────────────────────────────────────────────────────── */
function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  document.body.classList.toggle('mode-catalogue', mode === 'catalogue');
  dom.buttons.catalogue.setAttribute('aria-pressed', mode === 'catalogue' ? 'true' : 'false');
  if (mode === 'catalogue') {
    paintCatalogue();
    dom.catalogue.scrollTop = 0;
    announce('Catalogue view: a readable list of every exhibit in view.');
  } else {
    announce('Back to the rotunda.');
    flyToWing(null, 0.9);
  }
  state.dirty = true;
}

/* — caption (the tour's subtitles) —————————————————───────────────────────── */
function showCaption(index) {
  const link = LINKS[index];
  dom.caption.style.setProperty('--wing', link._wing.hex);
  dom.caption.querySelector('.wing').textContent = link.c + ' wing';
  dom.caption.querySelector('.nm').textContent = link.n;
  dom.caption.querySelector('.d').textContent = link.d;
  dom.caption.classList.add('on');
}
function hideCaption() { dom.caption.classList.remove('on'); }

/* — help + stats —————————————————————————————————─────────────────────────── */
function toggleHelp(open) {
  const show = open === undefined ? !dom.help.classList.contains('open') : open;
  dom.help.classList.toggle('open', show);
  dom.help.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (show) dom.buttons.helpClose.focus();
}

function toggleStats() {
  state.stats = !state.stats;
  dom.stats.classList.toggle('on', state.stats);
  state.dirty = true;
}

/* — keyboard and the wing key ——————————————————————————───────────────────── */
/* The help sheet's colour key: every wing, in plan order, with how many
   exhibits it holds. Built from the plan so it can never drift from the room. */
function buildHelpLegend() {
  dom.helpLegend.innerHTML = plan.wings.map((wing) =>
    '<i style="--wing:' + WING_HEX[wing.name] + '"><s></s>' + esc(wing.name) +
    ' <em>' + wing.count + '</em></i>'
  ).join('');
}

function onKeydown(event) {
  const typing = event.target === dom.search;
  if (event.key === 'Escape') {
    if (dom.help.classList.contains('open')) toggleHelp(false);
    else if (dom.search.value) clearSearch();
    else if (dom.results.classList.contains('open')) dom.results.classList.remove('open');
    else if (state.mode === 'catalogue') setMode('rotunda');
    else if (juke.open) toggleJukebox(false);
    else closeLabel();
    return;
  }
  if (typing) {
    if (event.key === 'ArrowDown') { moveResultCursor(1); event.preventDefault(); }
    else if (event.key === 'ArrowUp') { moveResultCursor(-1); event.preventDefault(); }
    else if (event.key === 'Enter') { chooseResult(); event.preventDefault(); }
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  switch (event.key) {
    case '/': dom.search.focus(); dom.search.select(); event.preventDefault(); break;
    case 't': case 'T': toggleTour(); break;
    case 's': case 'S': randomExhibit(); break;
    case 'c': case 'C': setMode(state.mode === 'catalogue' ? 'rotunda' : 'catalogue'); break;
    case 'f': case 'F':
      if (state.selected >= 0) toggleFavourite(state.selected);
      else toast('Open an exhibit first — click any plaque');
      break;
    case 'm': case 'M': toggleFavouritesOnly(); break;
    case 'r': case 'R': rigReset(true); toast('View reset'); break;
    case 'v': case 'V': if (state.webgl) toggleStats(); break;
    case '?': case 'h': case 'H': toggleHelp(); break;
    case 'j': case 'J': toggleJukebox(); break;
    /* space works the jukebox transport — but only when the deck is out and
       nothing else holds the focus, because a focused button already answers
       to space itself, and a stray space should not start music behind a closed deck */
    case ' ':
      if (juke.open && (document.activeElement === document.body ||
          document.activeElement === document.documentElement)) {
        toggleJukePlay();
        event.preventDefault();
      }
      break;
    case 'ArrowLeft': stepExhibit(-1); event.preventDefault(); break;
    case 'ArrowRight': stepExhibit(1); event.preventDefault(); break;
    case 'ArrowUp': dollyBy(-0.12); event.preventDefault(); break;
    case 'ArrowDown': dollyBy(0.12); event.preventDefault(); break;
    /* the keyboard speaks in radians, not in drag pixels, so it goes through
       the camera's own verbs rather than the pointer's */
    case 'a': case 'A': turnBy(-0.3); break;
    case 'd': case 'D': turnBy(0.3); break;
    default: break;
  }
}

function randomExhibit() {
  if (!state.visible.length) { toast('Nothing in view to jump to'); return; }
  stopTour();
  const pick = state.visible[Math.floor(Math.random() * state.visible.length)];
  selectExhibit(pick, true);
  toast('Surprise: ' + LINKS[pick].n);
}

/* — copy the address ─————————————————————──────────────────────────────────── */
function copyUrl(link) {
  if (!link) return;
  const done = () => { toast('Copied ' + link.u); blip(660, 0.06, 0.03); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link.u).then(done, () => fallbackCopy(link.u, done));
  } else fallbackCopy(link.u, done);
}
function fallbackCopy(text, done) {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;top:-20px;opacity:0';
  document.body.appendChild(field);
  field.select();
  try { document.execCommand('copy'); done(); }
  catch (error) { toast('Copy blocked — select the address manually'); }
  document.body.removeChild(field);
}

/* — wire the chrome ———————————————————————────────────────────────────────── */
function bindChrome() {
  dom.search.addEventListener('input', onSearchInput);
  dom.search.addEventListener('focus', () => { if (state.query) renderResults(); });
  dom.searchClear.addEventListener('click', () => { clearSearch(); dom.search.focus(); });
  dom.results.addEventListener('click', (event) => {
    const row = event.target.closest('.result');
    if (!row) return;
    state.cursor = state.results.indexOf(Number(row.dataset.index));
    chooseResult();
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search')) dom.results.classList.remove('open');
  });

  dom.buttons.tour.addEventListener('click', toggleTour);
  dom.buttons.random.addEventListener('click', randomExhibit);
  dom.buttons.catalogue.addEventListener('click', () =>
    setMode(state.mode === 'catalogue' ? 'rotunda' : 'catalogue'));
  dom.buttons.sound.addEventListener('click', toggleSound);
  dom.buttons.reset.addEventListener('click', () => { rigReset(); flyToWing(null, 0.9); });
  dom.buttons.help.addEventListener('click', () => toggleHelp());
  dom.buttons.helpClose.addEventListener('click', () => toggleHelp(false));
  dom.help.addEventListener('click', (event) => { if (event.target === dom.help) toggleHelp(false); });

  dom.panel.close.addEventListener('click', closeLabel);
  dom.panel.prev.addEventListener('click', () => stepExhibit(-1));
  dom.panel.next.addEventListener('click', () => stepExhibit(1));
  dom.panel.star.addEventListener('click', () => { if (state.selected >= 0) toggleFavourite(state.selected); });
  dom.panel.url.addEventListener('click', () => copyUrl(LINKS[state.selected]));
  dom.panel.url.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      copyUrl(LINKS[state.selected]);
      event.preventDefault();
    }
  });
  document.addEventListener('keydown', onKeydown);
}
