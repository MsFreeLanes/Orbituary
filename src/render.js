/* ── render ──────────────────────────────────────────────────────────────
   The look: ACES tone mapping, a bloom that only catches the lamps and the
   pucks, and a final pass that puts grain, vignette and a whisper of
   scanline over everything so the whole thing reads as one photograph
   rather than a render.

   A watchdog watches the frame time and steps the pixel ratio and the bloom
   down before the walk ever starts to stutter, then back up again when the
   machine has room. */
import * as THREE from 'three';
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
    uScan: { value: 0.02 },
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
      float scan = 1.0 - uScan * (0.5 + 0.5 * sin(uv.y * 1200.0));
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
  scene.fog = new THREE.FogExp2(0x0b0d12, 0.010);

  /* ── what the building is willing to show ──────────────────────────────
     building.js hangs the museum in ranges and hands back a cull that says
     which of them the visitor can see from where they are standing. The frame
     asks it from the scene's own onBeforeRender, which three calls after the
     matrices are up and before it walks the graph — the only moment where
     saying "not this one" still saves the draw call. It lives here rather
     than in the frame loop so the answer is the same whether the composer or
     a scratch probe is holding the renderer. */
  let cullers = null;
  let childCount = -1;
  const fwd = new THREE.Vector3();
  scene.onBeforeRender = (renderer, sc, camera) => {
    if (cullers === null || scene.children.length !== childCount) {
      cullers = [];
      scene.traverse((o) => { if (o.userData && o.userData.cull) cullers.push(o.userData.cull); });
      childCount = scene.children.length;
    }
    for (const c of cullers) c.update(camera.position, camera.getWorldDirection(fwd));
  };

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, null));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 1.30);
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
