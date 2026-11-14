/* ── render ──────────────────────────────────────────────────────────────
   The look: ACES tone mapping, a bloom that only catches the lamps and the
   pucks, and a final pass that puts grain, vignette and a whisper of
   scanline over everything so the whole thing reads as one photograph
   rather than a render.

   A watchdog watches the frame time and steps the pixel ratio and the bloom
   down before the walk ever starts to stutter, then back up again when the
   machine has room. */
import * as THREE from 'three';
import { S } from './scale.js';
import { PALETTE } from './materials.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.055 },
    uVignette: { value: 1.06 },
    uScan: { value: 0.03 },
    uAberration: { value: 0.0016 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uScan, uAberration;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * uAberration * (0.4 + r2 * 3.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      float vig = smoothstep(0.92, 0.18, r2 * uVignette);
      col *= mix(0.62, 1.0, vig);
      /* scanlines at 3%. The HUD is DOM over the canvas, so this pass cannot
         reach its text at all — what it does reach is the building's own
         words: the door plates, the plinth labels, the acquisitions board.
         Those are the brightest thin detail in the frame, and a scanline that
         cuts 3% out of a stroke is a label that has gone grey. So the depth is
         carried by everything that is not already bright: full in the shadow
         and mid tones the walls live in, off on the ink. */
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float ink = 1.0 - smoothstep(0.52, 0.90, luma);
      float scan = 1.0 - uScan * (0.5 + 0.5 * sin(uv.y * 1200.0)) * ink;
      col *= scan;
      float g = (hash(uv * 1024.0 + fract(uTime) * 137.0) - 0.5) * uGrain;
      col += g;
      gl_FragColor = vec4(col, 1.0);
    }`
};

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, powerPreference: 'high-performance', stencil: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;

  const scene = new THREE.Scene();
  /* the fog stays exponential and stays per-room — main.js and plan.js still
     hand a density to every space, and the owner wants that depth to keep
     changing as you walk. Only its colour moves, to the palette's void: the
     haze used to be a blue-grey of its own, which meant the far end of a
     corridor faded toward a colour the station does not have, and the space
     outside the hull — which is the same distance, and is genuinely black —
     read as a different atmosphere from the air you are standing in. */
  scene.fog = new THREE.FogExp2(PALETTE.void, 0.010);

  /* ── what the building is willing to show ──────────────────────────────
     building.js hangs the museum in ranges and hands back a cull that says
     which of them the visitor can see from where they are standing. The frame
     asks it from the scene's own onBeforeRender, which three calls after the
     matrices are up and before it walks the graph — the only moment where
     saying "not this one" still saves the draw call. It lives here rather
     than in the frame loop so the answer is the same whether the composer or
     a scratch probe is holding the renderer.

     The cull's own rule is a distance: a range is on when its shell stands
     within six metres of the visitor. That is the wrong question to ask about
     a window. The side rooms lean out into the wedge between spokes and their
     viewports look straight at the next range's hull, three or four metres
     away, so walking down your own corridor takes you in and out of six
     metres and the hull behind the window blinks — scratch/probe-cull.mjs
     counts 224 standing positions where a range is culled while one of the
     visitor's own viewports is looking at it. What is behind a window cannot
     depend on where the visitor's feet happen to be, so the two ranges either
     side of any range that is on are on as well. The other way round — keep
     whatever every viewport can see — is a ray per window per frame; this is
     a subtraction over a list of twelve.

     The ranges are found once, off the groups the cull itself switches. Their
     bounding boxes say which of them are the drum and the cellar floor, which
     have no bearing to speak of and are already decided by radius and storey,
     and which are the cellar arms, which have no windows and so nothing to
     protect. Sorting the rest by bearing puts them in wheel order, so a
     range's neighbours are simply its two neighbours in the list. */
  let cullers = null;
  let childCount = -1;
  let ring = null;
  let lastCullT = 0;
  const box = new THREE.Box3();
  const fwd = new THREE.Vector3();

  function ringOf(owner) {
    const list = [];
    for (const g of owner.children) {
      box.setFromObject(g);
      const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      if (Math.hypot(cx, cz) < S.ROTUNDA_R) continue;      // the drum, the cellar floor
      if (box.max.y < S.FLOOR_GROUND) continue;            // a cellar arm: no windows
      list.push({ group: g, bearing: Math.atan2(cx, cz) });
    }
    if (list.length < 3) return null;
    list.sort((a, b) => a.bearing - b.bearing);
    list.forEach((r, i) => {
      r.neighbours = [list[(i + 1) % list.length].group,
        list[(i + list.length - 1) % list.length].group];
    });
    return list;
  }

  function keepNeighbours(pos) {
    if (!ring) return;
    /* in the drum the cull decides by which way the visitor is facing, and
       widening that to everything next door to the three they face would put
       half the station on the GPU to protect windows they are not standing
       beside. out on a spoke, though, the range you are in is on, and its
       neighbours have to be on with it. */
    if (Math.hypot(pos.x, pos.z) < S.ROTUNDA_R) return;
    /* the pass that decides is the one that reads, not the one that writes:
       forcing a neighbour on and then reading it as a decision would walk the
       rule round the whole wheel in a frame and put every range back on the
       list, which is the opposite of the point. */
    for (const r of ring) r.was = r.group.visible;
    for (const r of ring) {
      if (!r.was) continue;
      for (const g of r.neighbours) g.visible = true;
    }
  }

  scene.onBeforeRender = (renderer, sc, camera) => {
    if (cullers === null || scene.children.length !== childCount) {
      cullers = [];
      let owner = null;
      scene.traverse((o) => {
        if (!o.userData || !o.userData.cull) return;
        cullers.push(o.userData.cull);
        owner = o;
      });
      ring = ringOf(owner);
      childCount = scene.children.length;
    }
    /* the cull's grace period is counted in seconds, and the seconds it wants
       are the ones the frame took, not the ones the wall clock says: a probe
       that steps the building a hundred times in a heartbeat is asking about a
       walk, and a cull that read the clock would answer about the probe. */
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const dt = lastCullT ? Math.min((t - lastCullT) / 1000, 0.25) : 1 / 60;
    lastCullT = t;
    for (const c of cullers) c.update(camera.position, camera.getWorldDirection(fwd), dt);
    keepNeighbours(camera.position);
  };

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, null));
  /* the threshold is 0.70, and it used to be 1.30. At 1.30 nothing in this
     building glowed: the palette's cyan and amber, and the lamp faces that
     were tuned before either existed, all land between 0.7 and 1.2 of linear
     luminance, so the bloom pass was throwing away every emissive surface in
     the station and the fittings read as painted white discs. The intensities
     that were set to clear 1.30 — the hull's rim strips most of all — have
     come down to match, or the same photograph that used to have no glow in
     it now has nothing else in it either. The radius comes down with them,
     0.5 to 0.4: at the wider blur a fitting that is only just over the line
     spreads its few points across the whole frame, and in the Cupola the
     brightest thing that glows is a planet filling the floor, where that
     spread is the difference between a planet and a wash. */
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.4, 0.70);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grain = new ShaderPass(GrainShader);
  composer.addPass(grain);

  const tiers = [
    { ratio: Math.min(window.devicePixelRatio || 1, 2), bloom: true, shadows: true },
    { ratio: 1.0, bloom: true, shadows: true },
    { ratio: 1.0, bloom: false, shadows: true },
    { ratio: 0.75, bloom: false, shadows: false }
  ];
  let tier = 0;

  function applyTier() {
    const t = tiers[tier];
    renderer.setPixelRatio(t.ratio);
    renderer.shadowMap.enabled = t.shadows;
    bloom.enabled = t.bloom;
    composer.setSize(window.innerWidth, window.innerHeight);
  }

  const watchdog = { frames: 0, acc: 0, cooldown: 0, last: 0 };
  let fps = 60;

  function tickWatchdog() {
    /* the frame loop hands out a clamped dt so a stutter cannot fling the
       visitor through a wall, which means that number can never show a slow
       machine for what it is. the watchdog keeps its own clock. */
    const now = performance.now();
    if (!watchdog.last) watchdog.last = now;
    const real = (now - watchdog.last) / 1000;
    watchdog.last = now;
    watchdog.frames++;
    watchdog.acc += real;
    watchdog.cooldown -= real;
    if (watchdog.acc >= 1.0) {
      fps = watchdog.frames / watchdog.acc;
      watchdog.frames = 0; watchdog.acc = 0;
      if (fps < 34 && tier < tiers.length - 1 && watchdog.cooldown <= 0) {
        tier++; applyTier(); watchdog.cooldown = 8;
      } else if (fps > 56 && tier > 0 && watchdog.cooldown <= 0) {
        tier--; applyTier(); watchdog.cooldown = 14;
      }
    }
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  return {
    renderer, scene, composer, bloom, grain,
    /* the probe wants to put the whole building on the GPU once, to have a
       number to compare the standing positions against */
    get cull() { return cullers && cullers.length ? cullers[0] : null; },
    get fps() { return fps; },
    get tier() { return tier; },
    render(dt, camera) {
      tickWatchdog();
      grain.uniforms.uTime.value = performance.now() * 0.001;
      composer.passes[0].camera = camera;
      composer.render(dt);
    },
    setMood(fog, exposure, bloomStrength) {
      scene.fog.density += (fog - scene.fog.density) * 0.04;
      renderer.toneMappingExposure += (exposure - renderer.toneMappingExposure) * 0.04;
      bloom.strength += (bloomStrength - bloom.strength) * 0.04;
    }
  };
}
