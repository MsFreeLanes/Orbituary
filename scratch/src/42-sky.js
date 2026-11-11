/* ── 05b · the sky ───────────────────────────────────────────────────────
   Above the dado the museum has no ceiling: it has a planetarium. One big
   inverted sphere carries a painted nebula; two layers of stars sit on its
   inner face as points, so they twinkle and stay perfectly round at any
   distance; a faint great-circle grid turns with them the way a real dome
   does, and every so often a shooting star crosses the field. All of it is
   drawn or generated at boot — there is nothing to download. */

/* star colours, weighted towards blue-white the way a real sky is */
const STAR_TINTS = [
  [0.76, 0.85, 1.00], [0.95, 0.97, 1.00], [1.00, 0.90, 0.76],
  [0.70, 0.92, 1.00], [1.00, 0.76, 0.66], [0.86, 0.80, 1.00]
];

/* A soft radial blob — the whole nebula is built out of these. */
function softBlob(ctx, px, py, radius, rgb, alpha) {
  const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
  g.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
  g.addColorStop(0.55, 'rgba(' + rgb + ',' + (alpha * 0.35) + ')');
  g.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, TAU);
  ctx.fill();
}

/* The painted sky, as one equirectangular canvas: zenith at the top of the
   canvas, horizon through the middle. Smooth washes ONLY — every crisp point
   of light is geometry. Painting 1-pixel stars into the texture looks fine on
   the canvas and turns into a shimmering lattice once it is minified onto a
   sphere, which is the opposite of the effect we are after. */
function nebulaTexture() {
  const W = 1024, H = 512;
  const { c, x } = canvas2d(W, H);

  x.fillStyle = '#03040a';
  x.fillRect(0, 0, W, H);

  /* depth: the zenith is the darkest, the horizon carries the room's glow.
     Kept deliberately shallow — a strong gradient here bands and dithers on
     weak GPUs, and the sky is meant to read as black, not as a blue screen. */
  const depth = x.createLinearGradient(0, 0, 0, H);
  depth.addColorStop(0.00, 'rgba(9,12,30,0.30)');
  depth.addColorStop(0.42, 'rgba(13,18,40,0.22)');
  depth.addColorStop(0.52, 'rgba(40,56,108,0.16)');
  depth.addColorStop(0.62, 'rgba(14,18,38,0.14)');
  depth.addColorStop(1.00, 'rgba(3,4,9,0.60)');
  x.fillStyle = depth;
  x.fillRect(0, 0, W, H);

  /* the galactic band: a river of light laid diagonally across the sphere */
  for (let i = 0; i < 110; i++) {
    const u = i / 110;
    const px = u * W;
    const py = H * 0.34 + Math.sin(u * TAU) * H * 0.13 + (Math.random() - 0.5) * 46;
    softBlob(x, px, py, 60 + Math.random() * 130, '118,148,232', 0.018 + Math.random() * 0.018);
  }
  /* two clouds of a different colour, so the sky is not one hue */
  softBlob(x, W * 0.18, H * 0.30, 250, '150,90,170', 0.038);
  softBlob(x, W * 0.72, H * 0.62, 300, '60,150,180', 0.038);
  softBlob(x, W * 0.50, H * 0.52, 360, '90,110,200', 0.030);

  /* horizon haze: where the room's light meets the sky */
  for (let i = 0; i < 30; i++) {
    softBlob(x, Math.random() * W, H * 0.52 + (Math.random() - 0.5) * 40,
      110 + Math.random() * 170, '118,158,252', 0.022);
  }

  /* the deep field, painted as soft grains rather than pixels: too far away to
     twinkle, just enough to make the black feel inhabited */
  for (let i = 0; i < 240; i++) {
    const py = 130 + Math.random() * (H - 260);
    softBlob(x, Math.random() * W, py, 1.0 + Math.random() * 1.0, '214,228,255',
      0.08 + Math.random() * 0.12);
  }
  return textureFrom(c);
}

/* — stars: points on the inside of the dome, twinkling in the shader ——————— */
const STAR_SHADER = {
  vertex: [
    'attribute float aSeed;',
    'attribute float aSize;',
    'attribute vec3 aTint;',
    'uniform float uTime;',
    'uniform float uScale;',
    'varying float vTw;',
    'varying vec3 vTint;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    /* two sines per star, both irrational-ish, so a field of them never
       pulses in step */
    '  float beat = 0.55 + fract(aSeed * 7.13) * 2.1;',
    '  float tw = 0.66 + 0.34 * sin(uTime * beat + aSeed * 17.0)',
    '                  + 0.10 * sin(uTime * beat * 2.7 + aSeed * 5.0);',
    '  vTw = clamp(tw, 0.25, 1.25);',
    '  vTint = aTint;',
    '  gl_PointSize = aSize * uScale * (0.7 + 0.55 * vTw) * (150.0 / max(1.0, -mv.z));',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n'),
  fragment: [
    'varying float vTw;',
    'varying vec3 vTint;',
    'void main(){',
    '  vec2 d = gl_PointCoord - 0.5;',
    '  float r = length(d) * 2.0;',
    '  float halo = smoothstep(1.0, 0.0, r);',
    '  float core = smoothstep(0.40, 0.0, r);',
    '  float a = halo * 0.30 + core * 0.95;',
    '  if (a < 0.012) discard;',
    '  gl_FragColor = vec4(vTint * (0.5 + 1.15 * core) * vTw, a * vTw);',
    '}'
  ].join('\n')
};

/* Points spread evenly over the part of the sphere that is above the horizon.
   (sin latitude is uniform, which is what makes the density even.) */
function starField(count, radius, sizeFloor, sizeCeil, dim, seed) {
  const position = new Float32Array(count * 3);
  const aSeed = new Float32Array(count);
  const aSize = new Float32Array(count);
  const aTint = new Float32Array(count * 3);
  const lowest = Math.sin(-3 * Math.PI / 180);
  for (let i = 0; i < count; i++) {
    const sinLat = lowest + (1 - lowest) * Math.random();
    const lat = Math.asin(sinLat);
    const lon = Math.random() * TAU;
    const cosLat = Math.cos(lat);
    position[i * 3] = Math.sin(lon) * cosLat * radius;
    position[i * 3 + 1] = sinLat * radius;
    position[i * 3 + 2] = Math.cos(lon) * cosLat * radius;
    aSeed[i] = (seed + i) * 0.6180339887;
    aSize[i] = sizeFloor + Math.pow(Math.random(), 3) * (sizeCeil - sizeFloor);
    const tint = STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)];
    aTint[i * 3] = tint[0] * dim;
    aTint[i * 3 + 1] = tint[1] * dim;
    aTint[i * 3 + 2] = tint[2] * dim;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geometry.setAttribute('aTint', new THREE.BufferAttribute(aTint, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: STAR_SHADER.vertex,
    fragmentShader: STAR_SHADER.fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  return new THREE.Points(geometry, material);
}

/* — the planetarium grid: meridians and parallels, barely there —────────── */
function skyGrid(radius) {
  const points = [];
  const push = (v) => points.push(v.x, v.y, v.z);
  const at = (lat, lon) => new THREE.Vector3(
    Math.sin(lon) * Math.cos(lat) * radius,
    Math.sin(lat) * radius,
    Math.cos(lon) * Math.cos(lat) * radius
  );
  for (let m = 0; m < CFG.gridMeridians; m++) {
    const lon = (m / CFG.gridMeridians) * TAU;
    let previous = at(-0.12, lon);
    for (let step = 1; step <= 14; step++) {
      const next = at(-0.12 + (step / 14) * (Math.PI / 2 + 0.12), lon);
      push(previous); push(next);
      previous = next;
    }
  }
  for (let p = 1; p <= CFG.gridParallels; p++) {
    const lat = (p / (CFG.gridParallels + 1)) * (Math.PI / 2);
    let previous = at(lat, 0);
    for (let step = 1; step <= 48; step++) {
      const next = at(lat, (step / 48) * TAU);
      push(previous); push(next);
      previous = next;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0x8fb4ff, transparent: true, opacity: 0.032,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
}

/* — shooting stars: one line per streak, animated entirely in the shader —── */
const STREAK_SHADER = {
  vertex: [
    'attribute vec3 aEnd;',
    'attribute float aSeed;',
    'attribute float aHead;',
    'uniform float uTime;',
    'varying float vAlpha;',
    'void main(){',
    '  float cycle = 15.0 + fract(aSeed * 13.37) * 21.0;',      // seconds between visits
    '  float t = fract((uTime + aSeed * 41.0) / cycle);',
    '  float travel = clamp(t / 0.30, 0.0, 1.0);',
    '  float lit = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.06, 0.30, t));',
    '  vAlpha = lit * mix(0.05, 1.0, aHead);',
    '  vec3 p = position + aEnd * travel;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
    '}'
  ].join('\n'),
  fragment: [
    'varying float vAlpha;',
    'void main(){',
    '  if (vAlpha < 0.01) discard;',
    '  gl_FragColor = vec4(vec3(0.86, 0.92, 1.0) * vAlpha, vAlpha);',
    '}'
  ].join('\n')
};

function shootingStars(radius) {
  const count = CFG.shootingStars;
  const position = new Float32Array(count * 2 * 3);
  const aEnd = new Float32Array(count * 2 * 3);
  const aSeed = new Float32Array(count * 2);
  const aHead = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    /* a start point high on the dome, and a tangent to travel along */
    const lat = 0.35 + Math.random() * 0.9;
    const lon = Math.random() * TAU;
    const start = new THREE.Vector3(
      Math.sin(lon) * Math.cos(lat) * radius,
      Math.sin(lat) * radius,
      Math.cos(lon) * Math.cos(lat) * radius
    );
    const up = start.clone().normalize();
    const dir = new THREE.Vector3(Math.random() - 0.5, -0.25 - Math.random() * 0.4, Math.random() - 0.5)
      .normalize();
    const tangent = dir.clone().sub(up.clone().multiplyScalar(dir.dot(up))).normalize();
    const length = 16 + Math.random() * 22;
    for (let v = 0; v < 2; v++) {
      const k = i * 2 + v;
      position[k * 3] = start.x; position[k * 3 + 1] = start.y; position[k * 3 + 2] = start.z;
      aEnd[k * 3] = tangent.x * length;
      aEnd[k * 3 + 1] = tangent.y * length;
      aEnd[k * 3 + 2] = tangent.z * length;
      aSeed[k] = i * 0.7548776662 + 0.11;
      aHead[k] = v;                       // 0 = tail, 1 = head
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  geometry.setAttribute('aHead', new THREE.BufferAttribute(aHead, 1));
  return new THREE.LineSegments(geometry, new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: STREAK_SHADER.vertex,
    fragmentShader: STREAK_SHADER.fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
}

/* — assembling the sky —————————————————————────────────────────────────── */
function buildSky() {
  const radius = plan.floorR + CFG.skyPad;
  world.sky = new THREE.Group();
  world.sky.position.y = CFG.skyLift;

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 48),
    new THREE.MeshBasicMaterial({
      map: nebulaTexture(), side: THREE.BackSide, fog: false, depthWrite: true
    })
  );
  world.sky.add(dome);
  world.dome = dome;

  /* the bright stars ride slightly inside the painted ones, so walking
     through the rotunda gives them a little parallax */
  world.stars = starField(CFG.starCount, radius * 0.90, 0.9, 4.2, 1.0, 0);
  world.faintStars = starField(CFG.faintStars, radius * 0.98, 0.5, 1.5, 0.42, 7);
  world.sky.add(world.stars);
  world.sky.add(world.faintStars);
  world.skyGrid = skyGrid(radius * 0.96);
  world.sky.add(world.skyGrid);
  world.shooting = shootingStars(radius * 0.94);
  world.sky.add(world.shooting);
  scene.add(world.sky);

  /* the lip of the plaza: one bright ring where the floor meets the sky */
  world.plazaRim = new THREE.Mesh(
    new THREE.RingGeometry(plan.floorR - 1.4, plan.floorR + 0.6, 160),
    new THREE.MeshBasicMaterial({
      color: 0x7fa8ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  world.plazaRim.rotation.x = -Math.PI / 2;
  world.plazaRim.position.y = 0.04;
  scene.add(world.plazaRim);

  /* and a soft glow standing just above it, so the horizon is not a hard line */
  world.horizon = new THREE.Mesh(
    new THREE.CylinderGeometry(plan.floorR - 0.4, plan.floorR - 0.4, 9, 128, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x2b3f78, transparent: true, opacity: 0.30, side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    })
  );
  world.horizon.position.y = 4.5;
  scene.add(world.horizon);
}

/* The dome turns — slowly enough that you only notice it in the grid. */
function updateSky(elapsed, delta) {
  if (!world.sky) return;
  world.sky.rotation.y += delta * CFG.skySpin;
  const scale = renderer.getPixelRatio();
  world.stars.material.uniforms.uTime.value = elapsed;
  world.stars.material.uniforms.uScale.value = scale;
  world.faintStars.material.uniforms.uTime.value = elapsed;
  world.faintStars.material.uniforms.uScale.value = scale * 0.8;
  world.shooting.material.uniforms.uTime.value = elapsed;
  world.plazaRim.material.opacity = 0.18 + 0.06 * Math.sin(elapsed * 0.7);
}
