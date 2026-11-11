/* ── 05 · stage ──────────────────────────────────────────────────────────
   The building: floor, a low wall that stops short of the sky, the oculus
   column in the middle of the rotunda, dust in the air, and the lights that
   make it worth walking into. Every texture here is drawn on a canvas at boot,
   so the file stays self-contained and there is nothing to download.
   The sky itself — the planetarium over all of this — is section 05b. */
const world = {
  core: null, shaft: null, medallion: null, dust: null,
  daises: [], rims: [], columns: null, columnGlow: null,
  pool: null, poolRing: null, beam: null, selectionLight: null,
  ambientLights: [],
  sky: null, dome: null, stars: null, faintStars: null, skyGrid: null,
  shooting: null, plazaRim: null, horizon: null
};

let renderer, scene, camera, clock;

/* — procedural textures —————————————————————————————————──────────────── */
function canvas2d(size, height) {
  const c = document.createElement('canvas');
  c.width = size; c.height = height || size;
  return { c, x: c.getContext('2d') };
}
function textureFrom(canvas, wrap) {
  const t = new THREE.CanvasTexture(canvas);
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.encoding = THREE.sRGBEncoding;
  return t;
}

/* Terrazzo-ish floor: speckle, a few broad veins, concentric rings that echo
   the arcs the exhibits stand on. */
function floorTexture(radius) {
  const { c, x } = canvas2d(1024);
  const half = 512;
  x.fillStyle = '#0a0b13';
  x.fillRect(0, 0, 1024, 1024);
  const glow = x.createRadialGradient(half, half, 40, half, half, half);
  glow.addColorStop(0, 'rgba(70,86,140,0.34)');
  glow.addColorStop(0.45, 'rgba(30,34,58,0.16)');
  glow.addColorStop(1, 'rgba(4,4,10,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * half;
    const px = half + Math.cos(a) * d, py = half + Math.sin(a) * d;
    const shade = 120 + Math.random() * 110;
    x.fillStyle = 'rgba(' + shade + ',' + (shade * 1.05) + ',' + (shade * 1.4) + ',' +
                  (0.05 + Math.random() * 0.16) + ')';
    const s = 0.6 + Math.random() * 2.4;
    x.fillRect(px, py, s, s);
  }
  for (let ring = 1; ring <= 9; ring++) {
    const r = (ring / 9.6) * half;
    x.beginPath(); x.arc(half, half, r, 0, TAU);
    x.strokeStyle = 'rgba(150,175,255,' + (ring % 3 === 0 ? 0.09 : 0.04) + ')';
    x.lineWidth = ring % 3 === 0 ? 2.4 : 1.2;
    x.stroke();
  }
  x.save();
  x.translate(half, half);
  for (let spoke = 0; spoke < 48; spoke++) {
    x.rotate(TAU / 48);
    x.beginPath(); x.moveTo(60, 0); x.lineTo(half, 0);
    x.strokeStyle = 'rgba(140,165,255,0.025)';
    x.lineWidth = 1;
    x.stroke();
  }
  x.restore();
  void radius;
  return textureFrom(c);
}

/* Wall: darkest at eye level, a cool wash above where the cove light lands. */
function wallTexture() {
  const { c, x } = canvas2d(512, 256);
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.00, '#252d4a');
  g.addColorStop(0.28, '#161a2b');
  g.addColorStop(0.62, '#0a0b12');
  g.addColorStop(1.00, '#05060c');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.03) + ')';
    x.fillRect(Math.random() * 512, Math.random() * 256, 1.5, 1.5);
  }
  const t = textureFrom(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}

/* The inlaid medallion under the oculus: rings, ticks, and a compass rose. */
function medallionTexture() {
  const { c, x } = canvas2d(512);
  const half = 256;
  x.clearRect(0, 0, 512, 512);
  x.translate(half, half);
  x.strokeStyle = 'rgba(190,205,255,0.55)';
  [0.98, 0.72, 0.44, 0.2].forEach((f, i) => {
    x.beginPath(); x.arc(0, 0, f * half, 0, TAU);
    x.lineWidth = i === 0 ? 3 : 1.4;
    x.stroke();
  });
  x.strokeStyle = 'rgba(150,170,230,0.35)';
  for (let tick = 0; tick < 72; tick++) {
    x.save(); x.rotate(tick * TAU / 72);
    x.beginPath(); x.moveTo(0, -0.98 * half); x.lineTo(0, -(tick % 6 === 0 ? 0.86 : 0.93) * half);
    x.lineWidth = tick % 6 === 0 ? 2 : 1;
    x.stroke(); x.restore();
  }
  for (let petal = 0; petal < 8; petal++) {
    x.save(); x.rotate(petal * TAU / 8);
    x.beginPath();
    x.moveTo(0, -0.7 * half); x.lineTo(0.09 * half, 0); x.lineTo(0, 0.7 * half); x.lineTo(-0.09 * half, 0);
    x.closePath();
    x.fillStyle = petal % 2 ? 'rgba(120,150,255,0.13)' : 'rgba(210,225,255,0.10)';
    x.fill();
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

/* A soft round falloff — used for floor pools of light and the fake bloom. */
function radialFade(inner, outer) {
  const { c, x } = canvas2d(256);
  const g = x.createRadialGradient(128, 128, 4, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

/* — the room —————————————————————————————————————————————————──────────── */
function createStage() {
  clock = new THREE.Clock();
  renderer = new THREE.WebGLRenderer({
    antialias: true, powerPreference: 'high-performance', alpha: false
  });
  renderer.domElement.id = 'view';
  dom.stage.appendChild(renderer.domElement);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CFG.maxDpr));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(CFG.fogColor, 1);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(CFG.fogColor, CFG.fogDensity);

  camera = new THREE.PerspectiveCamera(CFG.camFov, window.innerWidth / window.innerHeight, 0.1, 260);

  /* Light: a cool wash from above, warm bounce from the floor, and a bright
     core that reads as the building's own source of light. */
  scene.add(new THREE.HemisphereLight(0x33415f, 0x06070d, 0.75));
  scene.add(new THREE.AmbientLight(0x2a3050, 0.30));

  const moon = new THREE.DirectionalLight(0xa9c4ff, 0.55);
  moon.position.set(14, 34, 10);
  scene.add(moon);

  const rim = new THREE.DirectionalLight(0xff9a5c, 0.28);
  rim.position.set(-22, 8, -18);
  scene.add(rim);

  const coreLight = new THREE.PointLight(0x93b4ff, 1.2, 90, 2);
  coreLight.position.set(0, 14.5, 0);
  scene.add(coreLight);
  world.ambientLights.push(coreLight);

  const ember = new THREE.PointLight(0xffb066, 1.1, 62, 2);
  ember.position.set(6, 4, 6);
  scene.add(ember);
  world.ambientLights.push(ember);

  world.selectionLight = new THREE.PointLight(0xffffff, 0, 26, 2);
  world.selectionLight.position.set(0, 6, 0);
  scene.add(world.selectionLight);

  /* floor */
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(plan.floorR, 128),
    new THREE.MeshStandardMaterial({
      map: floorTexture(plan.floorR), color: 0x8f9dc4,
      roughness: 0.62, metalness: 0.42
    })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const medallion = new THREE.Mesh(
    new THREE.CircleGeometry(5.4, 96),
    new THREE.MeshBasicMaterial({ map: medallionTexture(), transparent: true, opacity: 0.5, depthWrite: false })
  );
  medallion.rotation.x = -Math.PI / 2;
  medallion.position.y = 0.02;
  scene.add(medallion);
  world.medallion = medallion;

  /* The wall is a dado: it rises just far enough to hold the exhibits' backs
     and then stops. Above it there is no ceiling — the sky comes all the way
     down to the horizon, which is what makes this a planetarium. */
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(plan.wallR, plan.wallR, CFG.dadoHeight + 1, 128, 1, true),
    new THREE.MeshStandardMaterial({
      map: wallTexture(), color: 0xffffff, roughness: 0.95, metalness: 0.05,
      side: THREE.BackSide
    })
  );
  wall.position.y = (CFG.dadoHeight + 1) / 2 - 1;
  scene.add(wall);

  /* a strip of light along the inside of that wall, and a lit coping on top
     of it, so the edge against the sky is a line of light and not a cut */
  const cove = new THREE.Mesh(
    new THREE.CylinderGeometry(plan.wallR - 0.15, plan.wallR - 0.15, 1.1, 128, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x6f8cff, transparent: true, opacity: 0.35,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  cove.position.y = CFG.dadoHeight - 0.9;
  scene.add(cove);

  const coping = new THREE.Mesh(
    new THREE.RingGeometry(plan.wallR - 0.6, plan.wallR + 0.15, 160),
    new THREE.MeshBasicMaterial({
      color: 0x9fb8ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  coping.rotation.x = -Math.PI / 2;
  coping.position.y = CFG.dadoHeight + 0.02;
  scene.add(coping);

  buildCore();
  buildWingFloors();
  buildColumns();
  buildDust();
  buildSelectionFixtures();
  buildSky();
}

/* The oculus: a shaft of light with a slowly turning armature inside it. */
function buildCore() {
  world.core = new THREE.Group();

  /* A shaft of light from the oculus: brightest where the sky is, thinning as
     it falls. It climbs past the wall and into the stars, which is the whole
     point of the building. Additive, depth-write off, so it never occludes an
     exhibit. */
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 2.6, CFG.beamHeight, 48, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uHigh: { value: new THREE.Color(0xa8c6ff) },
                  uLow: { value: new THREE.Color(0x16213f) } },
      vertexShader: [
        'varying float vH;',
        'void main(){',
        '  vH = uv.y;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uHigh; uniform vec3 uLow; uniform float uTime;',
        'varying float vH;',
        'void main(){',
        '  float grad = pow(vH, 1.7);',                        // light enters at the top
        '  float band = 0.88 + 0.12 * sin(uTime * 1.4 + vH * 9.0);',
        '  vec3 col = mix(uLow, uHigh, grad);',
        '  gl_FragColor = vec4(col * band, grad * 0.13);',
        '}'
      ].join('\n')
    })
  );
  shaft.position.y = CFG.beamHeight / 2;
  world.core.add(shaft);
  world.shaft = shaft;

  /* The museum's "heart": a slow stone satellite with a wire armature and three
     rings, lit by the core lamp. Small on purpose — it is a landmark, not a sun. */
  const heartGlow = 0.35;
  const heart = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshStandardMaterial({
      color: 0x0b1020, emissive: 0x1b2f66, emissiveIntensity: heartGlow,
      roughness: 0.9, metalness: 0.05, flatShading: true
    })
  );
  heart.position.y = 10.2;
  heart.userData.baseGlow = heartGlow;
  world.core.add(heart);
  world.heart = heart;

  const cage = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.9, 1),
    new THREE.MeshBasicMaterial({ color: 0x89a8ff, wireframe: true, transparent: true, opacity: 0.13 })
  );
  cage.position.y = 10.2;
  world.core.add(cage);
  world.cage = cage;

  world.torii = [];
  [[2.2, 0.05, 1.0, 0.35], [2.8, 0.035, -0.6, 0.9], [3.4, 0.03, 0.4, -1.3]].forEach((spec, i) => {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(spec[0], spec[1], 8, 120),
      new THREE.MeshBasicMaterial({
        color: i === 1 ? 0xffc98a : 0x8fb0ff, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    torus.position.y = 10.2;
    torus.rotation.x = Math.PI / 2 + (i - 1) * 0.5;
    torus.userData.spin = spec[2] * 0.16;
    torus.userData.tilt = spec[3] * 0.1;
    world.core.add(torus);
    world.torii.push(torus);
  });

  scene.add(world.core);
}

/* A dais and a lit lip for every wing: the plan becomes legible from the
   floor as well as from the plan view. */
function buildWingFloors() {
  const daisMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1d2e, roughness: 0.42, metalness: 0.55
  });
  plan.wings.forEach((wing) => {
    const theta = arcTheta(wing.aCenter);
    const dais = new THREE.Mesh(
      new THREE.RingGeometry(wing.rMin - 2.0, wing.rMax + 2.2, 64, 1, theta, wing.aSpan),
      daisMaterial
    );
    dais.rotation.x = -Math.PI / 2;
    dais.position.y = 0.035;
    scene.add(dais);
    world.daises.push(dais);

    const lip = new THREE.Mesh(
      new THREE.RingGeometry(wing.rMax + 2.2, wing.rMax + 2.7, 64, 1, theta, wing.aSpan),
      new THREE.MeshBasicMaterial({
        color: wing.color, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    );
    lip.rotation.x = -Math.PI / 2;
    lip.position.y = 0.05;
    scene.add(lip);
    world.rims.push(lip);

    const inner = new THREE.Mesh(
      new THREE.RingGeometry(wing.rMin - 2.5, wing.rMin - 2.0, 64, 1, theta, wing.aSpan),
      new THREE.MeshBasicMaterial({
        color: wing.color, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.05;
    scene.add(inner);
    world.rims.push(inner);
  });
}

/* The piers between halls. One column stands at the mouth of each boundary
   between two wings, with a thin lit strip on the face that looks into the
   hub, tinted with the colour of the wing behind it. Together with the
   partitions in section 06b this is what turns one wide ring of exhibits into
   twelve separate rooms. */
function buildColumns() {
  const count = plan.wings.length;
  const r = plan.dividerR - 0.7;
  const geometry = new THREE.CylinderGeometry(0.62, 0.78, CFG.columnHeight, 16, 1, false);
  world.columns = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x191d2c, roughness: 0.55, metalness: 0.35 }),
    count
  );
  world.columnGlow = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, CFG.columnHeight * 0.72, 0.16),
    new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false
    }),
    count
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  plan.wings.forEach((wing, i) => {
    const a = wing.aEnd;
    pos.set(polarX(a, r), CFG.columnHeight / 2, polarZ(a, r));
    q.setFromAxisAngle(up, a);
    m.compose(pos, q, s);
    world.columns.setMatrixAt(i, m);
    /* the strip sits on the hub-facing face of the pier, where the eye finds
       it, rather than inside the stone where it would never be seen */
    pos.set(polarX(a, r - 0.7), CFG.columnHeight * 0.5, polarZ(a, r - 0.7));
    m.compose(pos, q, s);
    world.columnGlow.setMatrixAt(i, m);
    world.columnGlow.setColorAt(i, new THREE.Color(wing.color));
  });
  world.columns.instanceMatrix.needsUpdate = true;
  world.columnGlow.instanceMatrix.needsUpdate = true;
  if (world.columnGlow.instanceColor) world.columnGlow.instanceColor.needsUpdate = true;
  scene.add(world.columns);
  scene.add(world.columnGlow);
}

/* Dust, in the shader: it rises, drifts, wraps, and costs one draw call. */
function buildDust() {
  const count = CFG.dustCount;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = hash01(i * 3 + 1) * TAU;
    const r = 3 + hash01(i * 3 + 2) * (plan.floorR - 6);
    positions[i * 3] = polarX(a, r);
    positions[i * 3 + 1] = hash01(i * 3 + 3) * 22;
    positions[i * 3 + 2] = polarZ(a, r);
    seeds[i] = hash01(i) * 100;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  world.dust = new THREE.Points(geometry, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: [
      'attribute float aSeed;',
      'uniform float uTime;',
      'varying float vAlpha;',
      'void main(){',
      '  vec3 p = position;',
      '  float rise = mod(p.y + uTime * (0.25 + fract(aSeed) * 0.5), 22.0);',
      '  p.y = rise;',
      '  p.x += sin(uTime * 0.35 + aSeed) * 1.4;',
      '  p.z += cos(uTime * 0.3 + aSeed * 1.7) * 1.4;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  float depth = -mv.z;',
      '  vAlpha = smoothstep(4.0, 16.0, depth) * (1.0 - smoothstep(70.0, 150.0, depth)) * 0.5;',
      '  gl_PointSize = (26.0 / depth) * (0.6 + fract(aSeed * 3.1));',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uFade;',
      'varying float vAlpha;',
      'void main(){',
      '  float d = length(gl_PointCoord - 0.5);',
      '  float soft = smoothstep(0.5, 0.0, d);',
      '  gl_FragColor = vec4(vec3(0.72, 0.80, 1.0), soft * vAlpha * uFade);',
      '}'
    ].join('\n')
  }));
  scene.add(world.dust);
}

/* Fixtures that mark whichever exhibit is currently in hand. */
function buildSelectionFixtures() {
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 64),
    new THREE.MeshBasicMaterial({
      map: radialFade('rgba(255,255,255,0.85)', 'rgba(255,255,255,0)'),
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.06;
  scene.add(pool);
  world.pool = pool;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 2.8, 64),
    new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  scene.add(ring);
  world.poolRing = ring;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 3.1, 14, 32, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0 }, uTint: { value: new THREE.Color(0xffffff) } },
      vertexShader: 'varying float vH;\nvoid main(){ vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform float uOpacity; uniform vec3 uTint; varying float vH;',
        'void main(){',
        '  float grad = pow(vH, 1.6) * 0.75;',
        '  gl_FragColor = vec4(uTint, grad * uOpacity);',
        '}'
      ].join('\n')
    })
  );
  scene.add(beam);
  world.beam = beam;
}

/* Per-frame business for the room: turning rings, breathing light, dust. */
function updateStage(elapsed, delta) {
  updateSky(elapsed, delta);
  updateHalls(elapsed);
  if (world.shaft) world.shaft.material.uniforms.uTime.value = elapsed;
  if (world.dust) world.dust.material.uniforms.uTime.value = elapsed;
  if (world.heart) {
    world.heart.rotation.y += delta * 0.18;
    world.heart.rotation.x += delta * 0.06;
    /* the heart breathes, gently, around its own base glow */
    const base = world.heart.userData.baseGlow;
    world.heart.material.emissiveIntensity = base + Math.sin(elapsed * 1.2) * base * 0.35;
  }
  if (world.cage) {
    world.cage.rotation.y -= delta * 0.1;
    world.cage.rotation.z += delta * 0.04;
  }
  world.torii.forEach((torus) => {
    torus.rotation.z += delta * torus.userData.spin;
    torus.rotation.x += delta * torus.userData.tilt * 0.2;
  });
  if (world.medallion) world.medallion.rotation.z += delta * 0.02;
  world.ambientLights[1].position.x = Math.cos(elapsed * 0.13) * 12;
  world.ambientLights[1].position.z = Math.sin(elapsed * 0.13) * 12;
}
