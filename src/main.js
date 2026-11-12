/* ── main ────────────────────────────────────────────────────────────────
   The wiring. Plan → materials → building → sky → lights → visitor →
   interface → air. One file, one boot, one requestAnimationFrame. */
import * as THREE from 'three';
import { S } from './scale.js';
import { LINKS, WINGS } from './data.js';
import { buildPlan, inside } from './plan.js';
import { makeMaterials, applyEnvironment } from './materials.js';
import { buildBuilding } from './building.js';
import { boardTexture } from './signage.js';
import { createSky, SKY_PRESETS } from './sky.js';
import { createLighting } from './lighting.js';
import { createRig } from './rig.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { createScheduler } from './events.js';
import { createRender } from './render.js';

/* per-room mood: [tone-mapping exposure, bloom strength]. The lamps do the
   work now, so these are mostly about how bright a room feels when you walk
   in and how much the fittings bloom. */
const MOOD = {
  grand: [0.96, 0.30], dark: [0.92, 0.66], vault: [1.00, 0.50], clinic: [1.10, 0.40],
  arcade: [1.04, 0.66], daylit: [1.20, 0.36], printshop: [1.10, 0.44], workshop: [1.08, 0.42],
  bank: [1.16, 0.40], engine: [0.98, 0.80], server: [1.00, 0.82], library: [1.10, 0.44],
  cabinet: [1.10, 0.48]
};

function boot() {
  const canvas = document.getElementById('view');
  const view = createRender(canvas);
  const { scene } = view;

  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 900);
  scene.add(camera);

  const plan = buildPlan();
  const M = makeMaterials(view.renderer);
  applyEnvironment(view.renderer, scene);
  const built = buildBuilding(THREE, plan, M);
  scene.add(built.group);

  const sky = createSky(THREE);
  scene.add(sky.group);
  const lighting = createLighting(THREE, plan);
  lighting.lights.forEach((l) => scene.add(l));
  scene.add(lighting.moon.target);

  const audio = createAudio(plan);
  const scheduler = createScheduler(20261111);

  let skyPreset = SKY_PRESETS[0];
  sky.state.lat = skyPreset.lat;
  sky.state.lon = skyPreset.lon;

  /* ── interface ── */
  let timeOffset = 0;
  const hud = createHUD(plan, {
    skyPresets: SKY_PRESETS,
    setSky: (p) => {
      skyPreset = p;
      sky.state.lat = p.lat; sky.state.lon = p.lon;
      hud.toast('the sky swings over: ' + p.label);
    },
    setNight: (v) => { sky.state.alwaysNight = v; },
    setTime: (minutes) => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      timeOffset = (minutes - nowMin) * 60000;
    }
  });

  /* ── visitor ── */
  let moodTarget = MOOD.grand;
  let moodFog = 0.006;
  const rig = createRig(THREE, camera, canvas, plan, {
    onStep: (floor, strength) => audio.step(floor, strength),
    onRoom: (id, instant) => {
      const room = plan.byId(id) || plan.rotunda;
      hud.setRoom(id === 'corridor' ? plan.rotunda : room);
      if (id !== 'corridor') audio.enterRoom(room);
      const tone = (room && room.tone) || 'grand';
      moodTarget = MOOD[tone] || MOOD.grand;
      moodFog = (room && room.fog) || 0.008;
    },
    onArrive: (id) => {
      const room = plan.byId(id);
      if (room) hud.toast('arrived: ' + room.name + ' · ' + room.items.length + ' links');
    }
  });
  rig.teleportTo('rotunda');

  /* ── the tour circuit and the arrow that leads you ── */
  let circuit = 0;
  const arrow = new THREE.Group();
  {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb347, emissiveIntensity: 1.6, roughness: 0.4 }));
    stem.position.y = -0.28;
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.24, 12),
      new THREE.MeshStandardMaterial({ color: 0xffe6c0, emissive: 0xffb347, emissiveIntensity: 2.2, roughness: 0.4 }));
    arrow.add(stem, head);
  }
  arrow.visible = false;
  scene.add(arrow);

  function tourNext() {
    const id = plan.order[circuit % plan.order.length];
    circuit++;
    if (rig.walkTo(id)) {
      const room = plan.byId(id);
      hud.toast('walking you to ' + room.name);
    }
  }
  function tourRandom() {
    const pool = plan.rooms.filter((r) => r.id !== rig.state.room);
    const room = pool[(Math.random() * pool.length) | 0];
    if (rig.walkTo(room.id)) hud.toast('a room at random: ' + room.name);
  }

  /* ── exhibits: look at a plinth, press enter ── */
  const ray = new THREE.Raycaster();
  let target = null;
  let pickClock = 0;

  function pick() {
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    ray.far = 3.4;
    const hits = ray.intersectObjects(built.pickables, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node && !node.userData.exhibit) node = node.parent;
      if (node && node.userData.exhibit) {
        const ex = node.userData.exhibit;
        if (ex.link === null) { target = { wanted: true, room: ex.room }; return; }
        target = { link: LINKS[ex.link], room: plan.byId(ex.room) };
        return;
      }
    }
    target = null;
  }

  function openTarget() {
    if (!target) return;
    if (target.wanted) { hud.toast('nothing on that plinth yet — it is an acquisition slot'); return; }
    const link = target.link;
    window.open(link.u, '_blank', 'noopener');
    hud.toast('opened ' + link.t);
  }

  /* ── the board in the rotunda: what the museum wants next ── */
  {
    const tex = boardTexture(plan, THREE, 8);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.1),
      new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.42,
        roughness: 0.75, side: THREE.DoubleSide
      }));
    board.position.set(0, 1.78, -S.ROTUNDA_R + 0.32);
    scene.add(board);
  }

  /* ── keys ── */
  let muted = false;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.code;
    if (k === 'KeyT') tourNext();
    else if (k === 'KeyR') tourRandom();
    else if (k === 'KeyH') hud.toggleHelp();
    else if (k === 'KeyG') hud.root.classList.toggle('sky-open');
    else if (k === 'KeyM') {
      muted = !muted;
      audio.setMuted(muted);
      hud.toast(muted ? 'sound off' : 'sound on');
    } else if (k === 'Enter' || k === 'NumpadEnter') openTarget();
    else if (k === 'Escape') {
      rig.stopTour();
      hud.root.classList.remove('sky-open');
    }
  });

  canvas.addEventListener('click', () => {
    audio.resume();
    hud.hideIntro();
    if (target) { openTarget(); return; }
    rig.lock();
  });

  /* ── ambient events ── */
  const fx = [];
  const roomIds = plan.rooms.map((r) => r.id);
  let arrivedAt = performance.now();

  function fireEvent(ev) {
    const room = plan.byId(ev.room);
    if (!room) return;
    if (ev.type === 'peek') {
      fx.push({ room, t: 0, dur: 4.2 });
      if (Math.random() > 0.45) hud.toast('a light moves in the ' + room.name.toLowerCase(), 2000);
    }
    /* pan by where the room is relative to which way you are looking */
    const dx = room.center.x - rig.state.x, dz = room.center.z - rig.state.z;
    const toRoom = Math.atan2(-dx, -dz);
    let d = toRoom - rig.state.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    audio.distant(ev.type === 'peek' ? 'chime' : ev.type, Math.sin(d));
  }

  /* ── frame ── */
  const clock = new THREE.Clock();
  let skyClock = 0;
  let frames = 0;

  function fmt(ms) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: skyPreset.tz
      }).format(new Date(ms));
    } catch (err) { return ''; }
  }

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const now = performance.now();
    const elapsed = (now - arrivedAt) / 1000;

    rig.update(dt);

    skyClock += dt;
    if (skyClock > 0.1) {
      skyClock = 0;
      const ms = Date.now() + timeOffset;
      sky.update(ms);
      lighting.setMoonDirection(sky.state);
      hud.setSky(sky.state, fmt(ms));
    }
    lighting.update(camera.position, dt);

    /* mood follows the room you are standing in */
    view.setMood(moodFog, moodTarget[0], moodTarget[1]);

    /* the arrow points at the next corner of a guided walk */
    const tour = rig.touring;
    if (tour) {
      let wp = null;
      const eased = tour.t / tour.dur;
      const dist = (eased < 0.5 ? 4 * eased * eased * eased : 1 - Math.pow(-2 * eased + 2, 3) / 2) * tour.total;
      let acc = 0;
      for (const leg of tour.legs) {
        acc += leg.d;
        if (acc >= dist) { wp = leg.b; break; }
      }
      if (wp) {
        arrow.visible = true;
        arrow.position.set(wp.x, S.EYE_H + 0.55 + Math.sin(now * 0.004) * 0.09, wp.z);
        arrow.rotation.y = now * 0.0012;
      }
    } else arrow.visible = false;

    /* exhibits */
    pickClock += dt;
    if (pickClock > 0.09) { pickClock = 0; pick(); }
    hud.showPlaque(target && !target.wanted ? target.link : null, target ? target.room : null);

    /* ambient events */
    const ev = scheduler.next(elapsed, {
      room: rig.state.room, touring: !!tour, rooms: roomIds
    });
    if (ev) fireEvent(ev);
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      const k = Math.sin(Math.PI * Math.min(1, f.t / f.dur));
      if (f.room._puckMat) f.room._puckMat.emissiveIntensity = 0.3 + k * 3.4;
      if (f.t > f.dur) {
        if (f.room._puckMat) f.room._puckMat.emissiveIntensity = 0.3;
        fx.splice(i, 1);
      }
    }

    hud.setYou(rig.state.x, rig.state.z, rig.state.yaw);
    hud.setLevel(audio.level());
    frames++;
    if (frames % 30 === 0) {
      const room = rig.state.room === 'corridor' ? 'range' : rig.state.room;
      hud.setStats(Math.round(view.fps) + ' fps · tier ' + view.tier + ' · ' + room);
    }

    view.render(dt, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  hud.toast('click to walk · T for a guided walk · R for a random room', 5200);

  /* the works are left reachable from the console on purpose: the checks in
     scratch/ drive the museum through this, and anyone curious can walk it
     from the command line */
  window.__museum = { THREE, plan, rig, sky, lighting, hud, audio, view, camera, inside, LINKS, S, scheduler };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
