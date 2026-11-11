/* ── 11b · the jukebox ───────────────────────────────────────────────────
   A fly-out machine for the two traditions with the loudest soundtracks:
   video games and anime. It plays no recordings and no covers. The twelve
   tunes below are original patterns — one bar of sixteenths each, written
   out like a lead sheet — and a small step sequencer turns them into
   oscillators the moment you press play. The titles point at a genre, not
   at a track, and nothing is ever downloaded.

   The sequencer is the classic Web Audio pattern: a timer wakes up every
   CFG.jukeTick ms and queues whatever falls inside the next CFG.jukeLook
   seconds, scheduling each note at an exact audio-clock time. That is what
   keeps the timing rock steady while the tab is busy drawing the rotunda. */

/* — the tunes ————————————————————————————————————————───────────────────── */
/* Degrees are steps of the scale, counted from the chord's own root, so 0 /
   2 / 4 are the chord tones and the odd numbers are passing notes. A bar of
   sixteenth steps, null is a rest. `prog` is one chord root per bar, counted
   from the tonic. */
const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonic:   [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 3, 5, 7, 10]
};

/* Drum kits: step numbers inside the bar. */
const KITS = {
  four:   { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  break:  { kick: [0, 10, 14],   snare: [4, 12],  hat: [2, 6, 8, 14] },
  march:  { kick: [0, 8, 11],    snare: [4, 12],  hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  ballad: { kick: [0, 8],        snare: [],       hat: [] }
};

const JUKE_TUNES = [
  { name: 'Overworld Bounce', tag: 'platformer', hex: '#f5d08a',
    bpm: 152, scale: 'major', root: 48, prog: [0, 5, 3, 4], kit: 'four', swing: 0.10, arp: 2,
    bass: [0, null, null, 0, 4, null, null, 4, 3, null, null, 3, 4, null, null, null],
    lead: [0, null, 4, null, 2, null, 4, null, 7, null, 4, null, 2, null, 0, null] },

  { name: 'Mecha March', tag: 'giant robot', hex: '#ff7a6b',
    bpm: 128, scale: 'harmonic', root: 45, prog: [0, 5, 3, 4], kit: 'march', swing: 0, arp: 1,
    bass: [0, 0, null, 0, 0, null, 0, null, 4, 4, null, 4, 4, null, 4, null],
    lead: [0, null, null, null, 3, null, 2, null, 4, null, null, null, 2, null, null, null] },

  { name: 'Magical Girl Waltz', tag: 'moonlight transformation', hex: '#ff9ecb',
    bpm: 104, scale: 'major', root: 50, prog: [0, 3, 4, 5], kit: 'ballad', swing: 0, arp: 2,
    bass: [0, null, null, 4, null, null, 0, null, null, null, 4, null, null, null, 0, null],
    lead: [4, null, null, null, 2, null, null, null, 0, null, null, null, 7, null, null, null] },

  { name: 'Pixel Dungeon Hunt', tag: 'eight-bit adventure', hex: '#8de08a',
    bpm: 140, scale: 'harmonic', root: 47, prog: [0, 0, 5, 4], kit: 'break', swing: 0, arp: 2,
    bass: [0, null, 0, null, 0, null, 0, null, 6, null, 6, null, 0, null, 0, null],
    lead: [0, 2, 3, 2, 4, null, 3, 2, 0, null, null, 0, -1, null, null, null] },

  { name: 'Final Airship', tag: 'long way home', hex: '#7fd8ff',
    bpm: 116, scale: 'mixolydian', root: 46, prog: [0, 4, 5, 3], kit: 'four', swing: 0, arp: 2,
    bass: [0, null, null, null, 4, null, null, null, 0, null, null, null, 3, null, null, null],
    lead: [7, null, null, null, 6, null, null, null, 4, null, null, null, 2, null, null, null] },

  { name: 'Neon Drift', tag: 'night circuit', hex: '#6c8cff',
    bpm: 112, scale: 'minor', root: 43, prog: [0, 5, 2, 4], kit: 'four', swing: 0, arp: 2,
    bass: [0, null, 0, null, 0, null, 0, null, 5, null, 5, null, 4, null, 4, null],
    lead: [null, null, 2, null, null, null, 4, null, null, null, 7, null, 6, null, null, null] },

  { name: 'Cassette Battle Theme', tag: 'shōnen, second round', hex: '#ffb347',
    bpm: 156, scale: 'dorian', root: 45, prog: [0, 2, 5, 4], kit: 'break', swing: 0.05, arp: 2,
    bass: [0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 3, 3, 4, 4],
    lead: [0, null, 0, 2, 3, null, 2, 3, 4, null, 3, 4, 7, null, null, null] },

  { name: 'Lunar Lullaby', tag: 'ending credits', hex: '#c9b8ff',
    bpm: 72, scale: 'pentatonic', root: 48, prog: [0, 2, 4, 2], kit: 'ballad', swing: 0, arp: 0,
    bass: [0, null, null, null, null, null, null, null, 2, null, null, null, null, null, null, null],
    lead: [4, null, null, null, null, null, 2, null, 0, null, null, null, null, null, null, null] },

  { name: 'Coin Palace', tag: 'minigame, high stakes', hex: '#ffd166',
    bpm: 132, scale: 'major', root: 48, prog: [0, 4, 5, 3], kit: 'four', swing: 0.18, arp: 1,
    bass: [0, null, 4, null, 0, null, 4, null, 3, null, 7, null, 4, null, 7, null],
    lead: [0, null, 2, null, 4, null, 5, null, 7, null, 4, null, 2, null, 0, null] },

  { name: 'Super Robot Dash', tag: 'arcade, one credit left', hex: '#22d3ee',
    bpm: 168, scale: 'mixolydian', root: 45, prog: [0, 3, 4, 4], kit: 'break', swing: 0, arp: 2,
    bass: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    lead: [7, 7, 4, 7, 9, null, 7, 4, 7, 7, 9, 7, 11, null, 9, 7] },

  { name: 'Rainy Station, 1988', tag: 'slice of life, late', hex: '#9fb6d9',
    bpm: 84, scale: 'dorian', root: 48, prog: [0, 5, 2, 4], kit: 'ballad', swing: 0.08, arp: 1,
    bass: [0, null, null, null, 2, null, null, null, 0, null, null, null, 4, null, null, null],
    lead: [2, null, null, null, 4, null, null, null, 7, null, null, null, null, null, 4, null] },

  { name: 'Boss Gate', tag: 'final, second form', hex: '#e05c8a',
    bpm: 148, scale: 'harmonic', root: 43, prog: [0, 5, 6, 4], kit: 'break', swing: 0, arp: 1,
    bass: [0, null, null, null, 0, null, null, null, 5, null, null, null, 4, null, null, null],
    lead: [0, null, null, 0, null, null, 3, null, 4, null, null, 4, null, null, 7, null] }
];

/* — the machine ————————————————————————————————————─────────────────────── */
const juke = {
  open: false, playing: false, started: false,
  index: 0, level: CFG.jukeVolume,
  step: 0, bar: 0, nextTime: 0, timer: 0, raf: 0,
  bus: null, bassBus: null, analyser: null, data: null, noise: null,
  meter: []
};

/* Scale arithmetic: rotate the scale so it starts on the chord root, then
   count steps up or down from there. Math.floor keeps negative degrees (the
   seventh below the root, say) in the right octave. */
function degreeSemis(scale, degree) {
  const n = scale.length;
  return scale[((degree % n) + n) % n] + 12 * Math.floor(degree / n);
}
function ladderFor(scale, chordDegree) {
  const n = scale.length;
  const k = ((chordDegree % n) + n) % n;
  return scale.slice(k).concat(scale.slice(0, k));
}
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* — building the deck ———————————————————————————————────────────────────── */
function buildJukebox() {
  const remembered = store.read('jukebox', null);
  if (remembered) {
    juke.index = clamp(remembered.i | 0, 0, JUKE_TUNES.length - 1);
    juke.level = clamp(typeof remembered.v === 'number' ? remembered.v : CFG.jukeVolume, 0, 1);
  }
  dom.juke.vol.value = String(Math.round(juke.level * 100));

  dom.juke.list.innerHTML = JUKE_TUNES.map((tune, i) =>
    '<li><button class="jk-row" data-tune="' + i + '">' +
    '<span class="no">' + pad2(i + 1) + '</span>' +
    '<span class="nm">' + esc(tune.name) + '<em>' + esc(tune.tag) + '</em></span>' +
    '<span class="bp">' + tune.bpm + '</span></button></li>'
  ).join('');

  for (let i = 0; i < CFG.jukeVu; i++) {
    const bar = document.createElement('i');
    dom.juke.vu.appendChild(bar);
    juke.meter.push(bar);
  }
  juke.data = new Uint8Array(CFG.jukeVu);

  dom.juke.list.addEventListener('click', (event) => {
    const row = event.target.closest('[data-tune]');
    if (row) selectTune(Number(row.dataset.tune), true);
  });
  dom.juke.play.addEventListener('click', toggleJukePlay);
  dom.juke.prev.addEventListener('click', () => selectTune(juke.index - 1, juke.playing));
  dom.juke.next.addEventListener('click', () => selectTune(juke.index + 1, juke.playing));
  dom.juke.close.addEventListener('click', () => toggleJukebox(false));
  dom.juke.vol.addEventListener('input', () => {
    juke.level = Number(dom.juke.vol.value) / 100;
    if (juke.bus) juke.bus.gain.setTargetAtTime(juke.level, audio.ctx.currentTime, 0.02);
    rememberJukebox();
  });
  dom.buttons.juke.addEventListener('click', () => toggleJukebox());
  paintJukeDeck();
}

function rememberJukebox() {
  store.write('jukebox', { i: juke.index, v: juke.level });
}

function toggleJukebox(force) {
  juke.open = force === undefined ? !juke.open : !!force;
  dom.juke.root.classList.toggle('open', juke.open);
  document.body.classList.toggle('juke-on', juke.open);
  dom.juke.root.setAttribute('aria-hidden', juke.open ? 'false' : 'true');
  dom.buttons.juke.setAttribute('aria-pressed', juke.open ? 'true' : 'false');
  if (juke.open && !juke.started) selectTune(juke.index, true);
  if (juke.open) dom.juke.play.focus({ preventScroll: true });
}

/* — the deck face ——————————————————————————————————─────────────────────── */
function paintJukeDeck() {
  const tune = JUKE_TUNES[juke.index];
  dom.juke.root.style.setProperty('--tune', tune.hex);
  dom.juke.title.textContent = tune.name;
  dom.juke.tag.textContent = tune.tag + ' · ' + tune.scale + ' · ' + (tune.arp ? 'arpeggiated' : 'no arp');
  dom.juke.bpm.textContent = tune.bpm + ' bpm';
  dom.juke.side.textContent = juke.index < 6 ? 'side a' : 'side b';
  dom.juke.play.textContent = juke.playing ? '❚❚' : '▶';
  dom.juke.play.setAttribute('aria-pressed', juke.playing ? 'true' : 'false');
  dom.juke.play.setAttribute('aria-label', juke.playing ? 'Stop the jukebox' : 'Play the jukebox');
  dom.juke.root.classList.toggle('playing', juke.playing);
  const rows = dom.juke.list.querySelectorAll('[data-tune]');
  rows.forEach((row, i) => row.setAttribute('aria-current', i === juke.index ? 'true' : 'false'));
  /* restart the marquee so a short title starts from the left again */
  const span = dom.juke.title;
  span.style.animation = 'none';
  void span.offsetWidth;
  span.style.animation = '';
}

function selectTune(index, autoplay) {
  juke.index = ((index % JUKE_TUNES.length) + JUKE_TUNES.length) % JUKE_TUNES.length;
  const tune = JUKE_TUNES[juke.index];
  juke.step = 0;
  juke.bar = 0;
  paintJukeDeck();
  rememberJukebox();
  announce('Jukebox: ' + tune.name + ', ' + tune.bpm + ' beats per minute');
  if (autoplay) startJukebox();
}

/* — the sequencer ——————————————————————————————————─────────────────────── */
function buildJukeBus() {
  if (juke.bus) return;
  const ctx = audio.ctx;
  juke.bus = ctx.createGain();
  juke.bus.gain.value = juke.level;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 7200;
  juke.bassBus = ctx.createGain();
  juke.bassBus.gain.value = 1;
  const bassTone = ctx.createBiquadFilter();
  bassTone.type = 'lowpass';
  bassTone.frequency.value = 520;
  juke.bassBus.connect(bassTone).connect(juke.bus);
  juke.bus.connect(tone);
  /* one compressor on the whole machine: twelve oscillators can add up to a
     clipped square wave, and this is what keeps the lead from spitting */
  const squash = ctx.createDynamicsCompressor();
  squash.threshold.value = -18;
  squash.knee.value = 12;
  squash.ratio.value = 6;
  squash.attack.value = 0.004;
  squash.release.value = 0.16;
  tone.disconnect();
  tone.connect(squash);
  juke.analyser = ctx.createAnalyser();
  juke.analyser.fftSize = 64;
  juke.analyser.smoothingTimeConstant = 0.65;
  squash.connect(juke.analyser).connect(audio.master);

  /* one shared hiss for every snare and hi-hat */
  juke.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
  const data = juke.noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

function startJukebox() {
  const a = ensureAudio();
  if (!a) { toast('This browser has no Web Audio, so the jukebox stays silent'); return; }
  juke.ctx = a.ctx;
  buildJukeBus();
  if (a.ctx.state === 'suspended') a.ctx.resume();
  juke.started = true;
  juke.playing = true;
  juke.bus.gain.setTargetAtTime(juke.level, a.ctx.currentTime, 0.02);
  juke.nextTime = a.ctx.currentTime + 0.08;
  juke.timer = setInterval(pumpJukebox, CFG.jukeTick);
  pumpJukebox();
  paintJukeDeck();
  cancelAnimationFrame(juke.raf);
  juke.raf = requestAnimationFrame(paintJukeMeter);
}

function stopJukebox() {
  juke.playing = false;
  clearInterval(juke.timer);
  juke.timer = 0;
  cancelAnimationFrame(juke.raf);
  if (juke.bus) juke.bus.gain.setTargetAtTime(0.0001, audio.ctx.currentTime, 0.03);
  for (const bar of juke.meter) bar.style.height = '2px';
  paintJukeDeck();
}

function toggleJukePlay() {
  if (juke.playing) stopJukebox();
  else startJukebox();
}

/* Queue every step that falls inside the lookahead window. */
function pumpJukebox() {
  if (!juke.playing) return;
  const tune = JUKE_TUNES[juke.index];
  const sixteenth = 60 / tune.bpm / 4;
  const horizon = audio.ctx.currentTime + CFG.jukeLook;
  while (juke.nextTime < horizon) {
    const lazy = (juke.step % 2 === 1) ? tune.swing * sixteenth : 0;
    playJukeStep(tune, juke.step, juke.bar, juke.nextTime + lazy, sixteenth);
    juke.nextTime += sixteenth;
    juke.step++;
    if (juke.step >= 16) {
      juke.step = 0;
      juke.bar = (juke.bar + 1) % tune.prog.length;
    }
  }
}

function playJukeStep(tune, step, bar, time, gap) {
  const scale = SCALES[tune.scale];
  const ladder = ladderFor(scale, tune.prog[bar]);
  const chord = tune.root + degreeSemis(scale, tune.prog[bar]);

  const b = tune.bass[step];
  if (b !== null && b !== undefined) {
    jukeTone(time, midiHz(chord + degreeSemis(ladder, b)), gap * 1.7, 'triangle', 0.30, juke.bassBus);
  }
  const l = tune.lead[step];
  if (l !== null && l !== undefined) {
    jukeLead(time, midiHz(chord + 24 + degreeSemis(ladder, l)), gap * 2.1);
  }
  if (tune.arp === 1 && step % 2 === 0) jukeArp(ladder, chord, step / 2, time, gap);
  if (tune.arp === 2) jukeArp(ladder, chord, step, time, gap);

  const kit = KITS[tune.kit];
  if (kit.kick.indexOf(step) >= 0) jukeKick(time);
  if (kit.snare.indexOf(step) >= 0) jukeSnare(time);
  if (kit.hat.indexOf(step) >= 0) jukeHat(time);
}

/* — the voices: two squares for the lead, a filtered triangle for the bass,
     a sine that falls for the kick, the shared hiss for the rest —──────── */
function jukeTone(time, hz, dur, type, peak, bus, detune) {
  const ctx = audio.ctx;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(peak, time + 0.014);
  env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  env.connect(bus || juke.bus);
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, time);
  if (detune) osc.detune.setValueAtTime(detune, time);
  osc.connect(env);
  osc.start(time);
  osc.stop(time + dur + 0.03);
  return osc;
}

function jukeLead(time, hz, dur) {
  jukeTone(time, hz, dur, 'square', 0.11, null, -8);
  jukeTone(time, hz, dur, 'square', 0.07, null, 9);
  jukeTone(time, hz / 2, dur * 0.6, 'square', 0.03);
}

/* The arpeggio walks the chord tones and lifts an octave every time round. */
function jukeArp(ladder, chord, step, time, gap) {
  const shape = [0, 2, 4, 7];
  const pick = (step + Math.floor(step / shape.length)) % shape.length;
  const lift = 12 + 12 * (Math.floor(step / shape.length) % 2);
  jukeTone(time, midiHz(chord + lift + degreeSemis(ladder, shape[pick])),
    gap * 0.8, 'square', 0.045);
}

function jukeKick(time) {
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(152, time);
  osc.frequency.exponentialRampToValueAtTime(46, time + 0.11);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.42, time);
  env.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  osc.connect(env).connect(juke.bus);
  osc.start(time);
  osc.stop(time + 0.2);
}

function jukeHiss(time, cutoff, peak, dur) {
  const ctx = audio.ctx;
  const src = ctx.createBufferSource();
  src.buffer = juke.noise;
  src.playbackRate.value = 1;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = cutoff;
  const env = ctx.createGain();
  env.gain.setValueAtTime(peak, time);
  env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(filter).connect(env).connect(juke.bus);
  src.start(time);
  src.stop(time + dur + 0.02);
}

function jukeSnare(time) {
  jukeHiss(time, 1500, 0.20, 0.17);
  jukeTone(time, 196, 0.09, 'triangle', 0.10);
}
function jukeHat(time) { jukeHiss(time, 7200, 0.075, 0.045); }

/* — the level meter: the analyser is already in the signal path, so the
     bars are honest rather than decorative —────────────────────────────── */
function paintJukeMeter() {
  if (!juke.playing) return;
  juke.analyser.getByteFrequencyData(juke.data);
  for (let i = 0; i < juke.meter.length; i++) {
    /* the analyser reports decibels on a 0–255 ramp where a healthy band sits
       near 150, so a raw divide pins every bar to the ceiling. The floor keeps
       a silent band flat and the curve spreads the loud end out. */
    const raw = Math.max(0, juke.data[i + 1] - 70) / 160;
    const v = Math.min(1, Math.pow(raw, 0.7));
    juke.meter[i].style.height = (2 + v * 14).toFixed(1) + 'px';
  }
  juke.raf = requestAnimationFrame(paintJukeMeter);
}
