/* ── 06b · halls ───────────────────────────────────────────────────────
   Twelve wings is not the same thing as twelve rooms. This section builds the
   architecture that makes them read that way from the hub:

     · a lit backdrop wall behind each wing's exhibits, tinted that wing's
       colour and painted procedurally with a retro-futurist sunburst;
     · a partition on every boundary, capped with a light line, so the eye
       reads a wall instead of an open ring;
     · a big enamel sign at eye level on the dado, with an emblem that belongs
       to that wing alone;
     · a path of light on the floor running into each hall;
     · a faint constellation joining each wing's exhibits to one another.

   Six draw calls in total: every piece is one instanced mesh (or one line
   set), and all of it dims away with its wing when a filter is applied. */
const halls = {
  wash: null, sign: null, dividers: null, dividerLight: null,
  spokes: null, constellations: null,
  attr: {}, washMaterial: null, signMaterial: null,
  lineWings: null
};

/* The backdrop. No texture: the shader draws the hall itself — rays fanning
   out of the base, the arch this hall is built under, a field of hairlines,
   and a pool of light where the wall meets the floor. */
function washMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aAlpha;
      attribute vec3 aWing;
      varying vec2 vLocal;
      varying float vAlpha;
      varying vec3 vWing;
      void main() {
        vLocal = uv;
        vAlpha = aAlpha;
        vWing = aWing;
        vec4 world = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          world = instanceMatrix * world;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vLocal;
      varying float vAlpha;
      varying vec3 vWing;
      void main() {
        if (vAlpha < 0.02) discard;
        float u = vLocal.x * 2.0 - 1.0;
        float v = vLocal.y;
        /* rays fanning out of the base of the hall */
        float ang = atan(v + 0.14, abs(u) + 0.03);
        float rays = 0.5 + 0.5 * sin(ang * 14.0 - uTime * 0.12);
        float fan = smoothstep(1.0, 0.15, v) * smoothstep(0.0, 0.18, v);
        /* the arch, and the hairlines of an eighties faceplate — wide enough
           apart that they survive being minified across the hall */
        float arch = abs(length(vec2(u * 0.78, (v - 0.10) * 1.15)) - 0.60);
        float archLine = smoothstep(0.018, 0.0, arch);
        float lines = smoothstep(0.075, 0.0, abs(fract(v * 11.0) - 0.5) - 0.40);
        /* light pooling at the base, where the hall is entered */
        float base = pow(max(0.0, 1.0 - abs(u)), 2.2) * (1.0 - v);
        float lift = 0.055 + 0.17 * rays * fan + 0.34 * base
                   + 0.60 * archLine + 0.13 * lines;
        vec3 rgb = vWing * lift + vec3(0.012, 0.016, 0.034);
        float a = vAlpha * (0.44 + 0.56 * smoothstep(0.0, 0.22, v));
        gl_FragColor = vec4(rgb * a, a);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

/* The floor path: bright at the hall end, gone by the time it reaches the
   hub, with soft edges so it reads as light on stone rather than a decal.
   The bright end is at the BOTTOM of the canvas: composeFloor() below puts
   uv.y = 0 at the outer edge of the plane. */
function spokeTexture() {
  const { c, x } = canvas2d(64, 256);
  const along = x.createLinearGradient(0, 0, 0, 256);
  along.addColorStop(0.00, 'rgba(255,255,255,0.00)');
  along.addColorStop(0.28, 'rgba(255,255,255,0.10)');
  along.addColorStop(0.70, 'rgba(255,255,255,0.38)');
  along.addColorStop(1.00, 'rgba(255,255,255,0.72)');
  x.fillStyle = along;
  x.fillRect(0, 0, 64, 256);
  x.globalCompositeOperation = 'destination-out';
  const edge = x.createLinearGradient(0, 0, 64, 0);
  edge.addColorStop(0.00, 'rgba(0,0,0,1)');
  edge.addColorStop(0.34, 'rgba(0,0,0,0)');
  edge.addColorStop(0.66, 'rgba(0,0,0,0)');
  edge.addColorStop(1.00, 'rgba(0,0,0,1)');
  x.fillStyle = edge;
  x.fillRect(0, 0, 64, 256);
  return textureFrom(c);
}

/* A floor plane laid down a radius. Lying it flat turns its +Y into -Z, so
   after the yaw its +Y points back toward the hub and uv.y = 0 is the outer
   edge — which is where the light path wants to be brightest. */
function composeFloor(mesh, index, angle, midRadius, width, length, y) {
  _v.set(polarX(angle, midRadius), y, polarZ(angle, midRadius));
  _q.setFromAxisAngle(_up, angle);
  _q.multiply(_flat);
  _s.set(width, length, 1);
  _m.compose(_v, _q, _s);
  mesh.setMatrixAt(index, _m);
}

function addWashAttributes(mesh, count) {
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
  const aWing = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  mesh.geometry.setAttribute('aAlpha', aAlpha);
  mesh.geometry.setAttribute('aWing', aWing);
  return { aAlpha, aWing };
}

function buildHalls() {
  const n = plan.wings.length;
  const color = new THREE.Color();

  /* — backdrops ———————————————————————————————————————————————————————
     Each one stops just above its own banner, so a hall is exactly as tall as
     the exhibits it houses and the sky still runs uninterrupted above it. */
  halls.washMaterial = washMaterial();
  halls.wash = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), halls.washMaterial, n);
  halls.wash.frustumCulled = false;
  halls.attr.wash = addWashAttributes(halls.wash, n);
  plan.wings.forEach((wing, i) => {
    wing._washBottom = CFG.dadoHeight;
    wing._washTop = wing._bannerY + CFG.banner.h * 0.5 + CFG.washClear;
    const height = wing._washTop - wing._washBottom;
    composeBox(halls.wash, i, polarX(wing.aCenter, plan.hallR),
      (wing._washTop + wing._washBottom) / 2, polarZ(wing.aCenter, plan.hallR),
      wing.aCenter + Math.PI, 2 * plan.hallR * Math.sin(wing.wedge / 2), height, 1);
    color.setHex(wing.color);
    halls.attr.wash.aWing.setXYZ(i, color.r, color.g, color.b);
    halls.attr.wash.aAlpha.setX(i, 1);
  });
  halls.wash.instanceMatrix.needsUpdate = true;
  halls.attr.wash.aWing.needsUpdate = true;
  halls.attr.wash.aAlpha.needsUpdate = true;
  scene.add(halls.wash);

  /* — signs ————————————————————————————————————————————————————————————
     Fixed size, mounted on the dado at eye level, so a small wing is not
     signed with a small name the way it would be if the sign spanned the bay. */
  halls.signMaterial = panelMaterial(labels.hallTex, CFG.hallCols, CFG.hallRows, { boost: 1.25 });
  halls.sign = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(CFG.signSize.w, CFG.signSize.h), halls.signMaterial, n
  );
  halls.attr.sign = addPanelAttributes(halls.sign, n, CFG.hallCols, CFG.hallRows);
  plan.wings.forEach((wing, i) => {
    const y = CFG.dadoHeight - CFG.signSize.h * 0.5 - CFG.signLift;
    compose(halls.sign, i, polarX(wing.aCenter, plan.wallR - 0.35), y,
      polarZ(wing.aCenter, plan.wallR - 0.35), wing.aCenter + Math.PI, 1);
    const tile = tileOrigin(i, CFG.hallCols, CFG.hallRows);
    halls.attr.sign.aTile.setXY(i, tile[0], tile[1]);
    color.setHex(wing.color);
    halls.attr.sign.aWing.setXYZ(i, color.r, color.g, color.b);
    halls.attr.sign.aAlpha.setX(i, 1);
  });
  halls.sign.instanceMatrix.needsUpdate = true;
  flushPanelAttributes(halls.attr.sign);
  scene.add(halls.sign);

  /* — partitions ———————————————————————————————————————————————————————
     One wall on each boundary, running from just outside the innermost row to
     the backdrop. They stop well below the top of the backdrops, so the halls
     feel partitioned without the rotunda ever feeling shut in. */
  const length = plan.dividerOutR - plan.dividerR;
  const midR = (plan.dividerOutR + plan.dividerR) / 2;
  halls.dividers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.28 }),
    n
  );
  halls.dividerLight = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
      transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false
    }),
    n
  );
  plan.wings.forEach((wing, i) => {
    const a = wing.aEnd;
    composeBox(halls.dividers, i, polarX(a, midR), CFG.dividerHeight / 2, polarZ(a, midR),
      a, CFG.dividerThickness, CFG.dividerHeight, length);
    composeBox(halls.dividerLight, i, polarX(a, midR), CFG.dividerHeight - 0.06, polarZ(a, midR),
      a, 0.16, 0.16, length);
    halls.dividers.setColorAt(i, color.setHex(wing.color).multiplyScalar(0.26));
    halls.dividerLight.setColorAt(i, color.setHex(wing.color));
  });
  halls.dividers.instanceMatrix.needsUpdate = true;
  halls.dividerLight.instanceMatrix.needsUpdate = true;
  halls.dividers.instanceColor.needsUpdate = true;
  halls.dividerLight.instanceColor.needsUpdate = true;
  scene.add(halls.dividers);
  scene.add(halls.dividerLight);

  /* — paths of light ————————————————————————————————————————————————— */
  halls.spokes = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: spokeTexture(), transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false
    }),
    n
  );
  plan.wings.forEach((wing, i) => {
    const outer = wing.rMax + 2.5;
    const width = Math.min(CFG.spokeWidth, 2 * CFG.spokeInner * Math.sin(wing.wedge / 2));
    composeFloor(halls.spokes, i, wing.aCenter, (CFG.spokeInner + outer) / 2,
      width, outer - CFG.spokeInner, 0.05);
    halls.spokes.setColorAt(i, color.setHex(wing.color));
  });
  halls.spokes.instanceMatrix.needsUpdate = true;
  halls.spokes.instanceColor.needsUpdate = true;
  scene.add(halls.spokes);

  /* — constellations ———————————————————————————————————————————————————
     Each wing's exhibits are joined along its arcs and between its rows, the
     way a planetarium joins stars into a figure. */
  const positions = [];
  const wingsOfLine = [];
  const pair = (a, b, wingIndex) => {
    positions.push(LINKS[a]._plate.x, LINKS[a]._plate.y, LINKS[a]._plate.z);
    positions.push(LINKS[b]._plate.x, LINKS[b]._plate.y, LINKS[b]._plate.z);
    wingsOfLine.push(wingIndex, wingIndex);
  };
  plan.wings.forEach((wing, wi) => {
    wing.rows.forEach((row, depth) => {
      for (let k = 0; k + 1 < row.length; k++) pair(row[k], row[k + 1], wi);
      const next = wing.rows[depth + 1];
      if (next) {
        pair(row[0], next[0], wi);
        pair(row[row.length - 1], next[next.length - 1], wi);
      }
    });
  });
  const figure = new THREE.BufferGeometry();
  figure.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  figure.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
  halls.lineWings = wingsOfLine;
  halls.constellations = new THREE.LineSegments(
    figure,
    new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  halls.constellations.frustumCulled = false;
  scene.add(halls.constellations);
  paintConstellations();
}

/* The lines carry their brightness in their vertex colour, so fading a wing
  costs nothing but a colour write. */
function paintConstellations() {
  const attribute = halls.constellations.geometry.attributes.color;
  const color = new THREE.Color();
  halls.lineWings.forEach((wingIndex, vertex) => {
    const wing = plan.wings[wingIndex];
    color.setHex(wing.color).multiplyScalar(0.42 * wing._fade);
    attribute.setXYZ(vertex, color.r, color.g, color.b);
  });
  attribute.needsUpdate = true;
}

/* Dim the whole hall — backdrop, sign, partitions, path and constellation —
   with the wing it belongs to. Called from applyWingFades() in section 10. */
function applyHallFades() {
  const color = new THREE.Color();
  plan.wings.forEach((wing, i) => {
    const fade = wing._fade;
    halls.attr.wash.aAlpha.setX(i, fade);
    halls.attr.sign.aAlpha.setX(i, fade);
    halls.dividers.setColorAt(i, color.setHex(wing.color).multiplyScalar(0.02 + 0.28 * fade));
    halls.dividerLight.setColorAt(i, color.setHex(wing.color).multiplyScalar(0.9 * fade));
    halls.spokes.setColorAt(i, color.setHex(wing.color).multiplyScalar(0.40 * fade));
  });
  halls.attr.wash.aAlpha.needsUpdate = true;
  halls.attr.sign.aAlpha.needsUpdate = true;
  halls.dividers.instanceColor.needsUpdate = true;
  halls.dividerLight.instanceColor.needsUpdate = true;
  halls.spokes.instanceColor.needsUpdate = true;
  paintConstellations();
}

/* The backdrops and the dust both breathe, so the room is never quite still. */
function updateHalls(elapsed) {
  halls.washMaterial.uniforms.uTime.value = elapsed;
}
