/* ── sound ───────────────────────────────────────────────────────────────
   No files. Every sound is built in the browser at boot: a noise bed, a
   handful of filters, and an impulse response generated per room from its
   volume and what its floor is made of. A marble hall rings; a carpeted
   screening room does not.

   A room's `floor` is which storey it is on and `floorMat` is the surface
   underfoot, so the impulse and the footstep sample are picked off the
   material and the room tone is picked off the storey: the cellar is a damp
   concrete box under the rotunda, and it sounds like one whatever it is
   paved with.

   There is no music in this museum. What you hear is your own footsteps,
   the air of the room you are standing in, and the building settling. */

const IR = {
  marble: { len: 2.4, decay: 2.2, bright: 0.85 },
  terrazzo: { len: 1.9, decay: 2.6, bright: 0.8 },
  concrete: { len: 1.5, decay: 3.0, bright: 0.6 },
  concreteDark: { len: 1.5, decay: 3.0, bright: 0.55 },
  oak: { len: 1.1, decay: 3.4, bright: 0.45 },
  oakParquet: { len: 1.2, decay: 3.2, bright: 0.5 },
  woodPanel: { len: 1.0, decay: 3.6, bright: 0.4 },
  carpet: { len: 0.55, decay: 6.0, bright: 0.12 },
  velvet: { len: 0.6, decay: 5.5, bright: 0.15 }
};

/* the cellar: the slab above is the rotunda floor and the walls are damp, so
   the tail runs on — nothing down there is soft enough to stop it — while the
   top end of it is dead. a longer, deader room than any upstairs. */
const CELLAR_IR = { len: 2.9, decay: 2.1, bright: 0.22 };

const STEP = {
  marble: { f: 2600, q: 1.2, dur: 0.10, gain: 0.5, tone: 1400 },
  terrazzo: { f: 2300, q: 1.1, dur: 0.10, gain: 0.48, tone: 1200 },
  marbleDark: { f: 2400, q: 1.2, dur: 0.10, gain: 0.5, tone: 1300 },
  concrete: { f: 1500, q: 0.9, dur: 0.12, gain: 0.42, tone: 900 },
  concreteDark: { f: 1400, q: 0.9, dur: 0.12, gain: 0.42, tone: 880 },
  oak: { f: 900, q: 1.4, dur: 0.11, gain: 0.40, tone: 620 },
  oakParquet: { f: 950, q: 1.4, dur: 0.11, gain: 0.42, tone: 650 },
  woodPanel: { f: 850, q: 1.5, dur: 0.11, gain: 0.38, tone: 600 },
  carpet: { f: 420, q: 0.7, dur: 0.13, gain: 0.30, tone: 300 },
  velvet: { f: 400, q: 0.7, dur: 0.13, gain: 0.28, tone: 280 },
  gravel: { f: 3200, q: 0.5, dur: 0.16, gain: 0.3, tone: 1800 }
};

/* footsteps in the cellar. the concrete there is laid over damp earth under
   the rotunda slab, so the scuff lands and then something under it answers:
   a creak, low and slow, that a dry ground-floor corridor would never make. */
const CELLAR_STEP = { f: 1250, q: 0.7, dur: 0.2, gain: 0.34, tone: 660 };

export function createAudio(plan) {
  let ctx = null, master = null, dry = null, wet = null, conv = null, analyser = null;
  let toneSrc = null, toneGain = null, toneFilter = null;
  let started = false, muted = false;
  let currentRoom = null;
  let dripAt = null;
  const noise = { buf: null };

  function noiseBuffer(seconds) {
    const n = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return b;
  }

  function makeIR(spec, volume) {
    const len = Math.max(0.3, Math.min(3.4, spec.len * (0.6 + volume / 900)));
    const n = Math.floor(ctx.sampleRate * len);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const early = i < ctx.sampleRate * 0.02 ? 1.0 : 0.35;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, spec.decay) * early;
      }
      /* a little pre-delay so the room has size, and a bright tail on hard floors */
      const pre = Math.floor(ctx.sampleRate * (0.006 + volume / 12000));
      for (let i = 0; i < pre; i++) d[i] *= 0.2;
      if (spec.bright > 0.5) {
        for (let i = 1; i < n; i++) d[i] = d[i] * 0.6 + d[i - 1] * 0.4 * (1 - spec.bright);
      }
    }
    return b;
  }

  function start() {
    if (started) return;
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    analyser = ctx.createAnalyser(); analyser.fftSize = 64;
    dry = ctx.createGain(); dry.gain.value = 0.86;
    wet = ctx.createGain(); wet.gain.value = 0.34;
    conv = ctx.createConvolver();
    dry.connect(master); wet.connect(conv); conv.connect(master);
    master.connect(analyser); analyser.connect(ctx.destination);
    noise.buf = noiseBuffer(3);

    /* room tone: a brown bed, coloured by the room, never quite silent */
    toneSrc = ctx.createBufferSource();
    toneSrc.buffer = noise.buf; toneSrc.loop = true;
    toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass'; toneFilter.frequency.value = 220; toneFilter.Q.value = 0.6;
    toneGain = ctx.createGain(); toneGain.gain.value = 0.0;
    toneSrc.connect(toneFilter); toneFilter.connect(toneGain); toneGain.connect(dry);
    toneSrc.start();
    const drone = ctx.createOscillator();
    drone.type = 'sine'; drone.frequency.value = 47;
    const dg = ctx.createGain(); dg.gain.value = 0.012;
    drone.connect(dg); dg.connect(dry); drone.start();
  }

  function resume() {
    if (!started) start();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function enterRoom(room) {
    if (!started || !room) return;
    currentRoom = room;
    /* the impulse is the surface underfoot, which is `floorMat`; the tone is
     * the storey, which is `floor`. reading the impulse off `floor` is what
     * made every room upstairs ring like concrete — `floor` is the storey
     * now, and there is no material by that name in the table. */
    const cellar = room.floor === 'basement';
    const floor = cellar ? CELLAR_IR : (IR[room.floorMat] || IR.concrete);
    const volume = (room.r ? Math.PI * room.r * room.r * room.ceil : room.w * room.d * room.ceil);
    const ir = makeIR(floor, volume);
    const t = ctx.currentTime;
    wet.gain.cancelScheduledValues(t);
    wet.gain.setValueAtTime(wet.gain.value, t);
    wet.gain.linearRampToValueAtTime(0.02, t + 0.25);
    setTimeout(() => { conv.buffer = ir; }, 260);
    wet.gain.linearRampToValueAtTime(0.22 + floor.bright * 0.3, t + 1.4);
    toneFilter.frequency.linearRampToValueAtTime(140 + floor.bright * 420, t + 1.2);
    toneGain.gain.linearRampToValueAtTime(0.02 + floor.bright * 0.03, t + 1.2);
    setDrip(cellar);
  }

  /* the one thing in the cellar that moves is water. a drop every few
     seconds, at a random pitch and landing somewhere off to one side, with
     the tail of the room on it: rare enough that you stop hearing it, and
     then you hear it. it stops the moment you are back upstairs. */
  function drip() {
    dripAt = null;
    if (!currentRoom || currentRoom.floor !== 'basement') return;
    const t = ctx.currentTime;
    const hz = 780 + Math.random() * 620;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(hz, t);
    o.frequency.exponentialRampToValueAtTime(hz * 0.42, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.3);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); pan.connect(dry); pan.connect(wet); }
    else { g.connect(dry); g.connect(wet); }
    o.start(t); o.stop(t + 0.35);
    dripAt = setTimeout(drip, 2400 + Math.random() * 5200);
  }

  function setDrip(on) {
    if (on) { if (!dripAt) dripAt = setTimeout(drip, 1400 + Math.random() * 2600); }
    else if (dripAt) { clearTimeout(dripAt); dripAt = null; }
  }

  function step(where, strength) {
    if (!started || muted) return;
    /* `where` is the space underfoot. the rig hands in the room record, which
       carries the storey and the material; a bare material name still works,
       for anything driving the audio by hand from the console. */
    const mat = (where && where.floorMat) || (typeof where === 'string' ? where : '') || 'concrete';
    const cellar = !!where && where.floor === 'basement';
    const spec = cellar ? CELLAR_STEP : (STEP[mat] || STEP.concrete);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise.buf;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = spec.f * (0.9 + Math.random() * 0.2); bp.Q.value = spec.q;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = spec.tone * 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(spec.gain * strength, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + spec.dur);
    src.connect(bp); bp.connect(lp); lp.connect(g);
    g.connect(dry); g.connect(wet);
    src.start(t, Math.random() * 2);
    src.stop(t + spec.dur + 0.05);
    /* the scuff of the other foot, a hair later and quieter */
    if (Math.random() > 0.55) {
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, t + 0.03);
      g2.gain.linearRampToValueAtTime(spec.gain * 0.18, t + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.14);
      const s2 = ctx.createBufferSource(); s2.buffer = noise.buf;
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass';
      f2.frequency.value = spec.f * 0.6; f2.Q.value = 0.8;
      s2.connect(f2); f2.connect(g2); g2.connect(dry);
      s2.start(t + 0.03, Math.random() * 2); s2.stop(t + 0.2);
    }
    /* down here the slab answers: a low band sliding down a fifth under the
       scuff, a few hundredths late, which is what a boot on concrete laid
       over damp earth does. */
    if (cellar) {
      const s3 = ctx.createBufferSource(); s3.buffer = noise.buf;
      s3.playbackRate.value = 0.4;
      const f3 = ctx.createBiquadFilter(); f3.type = 'bandpass';
      f3.frequency.setValueAtTime(190, t + 0.02);
      f3.frequency.exponentialRampToValueAtTime(118, t + 0.3);
      f3.Q.value = 6;
      const g3 = ctx.createGain();
      g3.gain.setValueAtTime(0, t + 0.02);
      g3.gain.linearRampToValueAtTime(0.05 * strength, t + 0.07);
      g3.gain.exponentialRampToValueAtTime(0.0004, t + 0.34);
      s3.connect(f3); f3.connect(g3); g3.connect(dry); g3.connect(wet);
      s3.start(t + 0.02, Math.random()); s3.stop(t + 0.4);
    }
  }

  /* the building making a noise somewhere else */
  function distant(kind, pan) {
    if (!started || muted) return;
    const t = ctx.currentTime;
    const out = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (out) { out.pan.value = Math.max(-1, Math.min(1, pan || 0)); out.connect(master); }
    const bus = out || master;
    if (kind === 'door') {
      const s = ctx.createBufferSource(); s.buffer = noise.buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 2.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0006, t + 0.5);
      s.connect(f); f.connect(g); g.connect(bus);
      s.start(t, Math.random() * 2); s.stop(t + 0.6);
    } else if (kind === 'chime') {
      [660, 880, 1320].forEach((hz, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + i * 0.01);
        g.gain.linearRampToValueAtTime(0.05 / (i + 1), t + i * 0.01 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0004, t + 1.6);
        o.connect(g); g.connect(bus);
        o.start(t); o.stop(t + 1.8);
      });
    } else if (kind === 'steps') {
      for (let i = 0; i < 4; i++) {
        const s = ctx.createBufferSource(); s.buffer = noise.buf;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.value = 700 + Math.random() * 300; f.Q.value = 1.2;
        const g = ctx.createGain();
        const tt = t + i * 0.34;
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(0.05, tt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0004, tt + 0.2);
        s.connect(f); f.connect(g); g.connect(bus);
        s.start(tt, Math.random() * 2); s.stop(tt + 0.3);
      }
    } else if (kind === 'breath') {
      const s = ctx.createBufferSource(); s.buffer = noise.buf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.8);
      g.gain.linearRampToValueAtTime(0, t + 2.4);
      s.connect(f); f.connect(g); g.connect(bus);
      s.start(t, Math.random()); s.stop(t + 2.6);
    }
  }

  function level() {
    if (!analyser) return 0;
    const arr = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(arr);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    return Math.min(1, sum / arr.length / 90);
  }

  function setMuted(v) {
    muted = v;
    if (master) master.gain.setTargetAtTime(v ? 0 : 0.9, ctx.currentTime, 0.08);
  }

  return { start, resume, enterRoom, step, distant, level, setMuted, get started() { return started; } };
}
