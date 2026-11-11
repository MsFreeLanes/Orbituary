/* ── 07 · exhibits ───────────────────────────────────────────────────────
   Eighty-eight exhibits, four draw calls. Each exhibit is a plinth, a frame,
   a printed plaque and a pool of light on the floor; all four are instanced
   meshes, and the exhibit's own fade/glow values ride along as per-instance
   attributes. Everything the room does to an exhibit — filtering, hovering,
   selecting, the guided tour — funnels through this module. */
const room = {
  plinth: null, frame: null, plaque: null, puck: null, banner: null,
  plaqueMaterial: null, bannerMaterial: null,
  attr: {}, count: 0, visibleCount: 0
};

/* Reused matrices: composing 88×5 transforms per change allocates nothing.
   They are filled in by initThreeScratch() at boot, so a machine without
   WebGL can still run the whole file — see 99-boot.js. */
let _m, _q, _v, _s, _up, _flat;
let raycaster, ndc, projected;
function initThreeScratch() {
  _m = new THREE.Matrix4();
  _q = new THREE.Quaternion();
  _v = new THREE.Vector3();
  _s = new THREE.Vector3();
  _up = new THREE.Vector3(0, 1, 0);
  _flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  raycaster = new THREE.Raycaster();
  ndc = new THREE.Vector2();
  projected = new THREE.Vector3();
  rig.target = new THREE.Vector3(0, CFG.camTargetY, 0);
}

/* A plaque's front normal is +Z, so spinning it to the wing's angle plus a
   half turn points it straight at the middle of the rotunda. */
const facing = (a) => a + Math.PI;

function compose(mesh, index, x, y, z, rotY, scale) {
  _v.set(x, y, z);
  _q.setFromAxisAngle(_up, rotY);
  _s.set(scale, scale, scale);
  _m.compose(_v, _q, _s);
  mesh.setMatrixAt(index, _m);
}
function composeBox(mesh, index, x, y, z, rotY, sx, sy, sz) {
  _v.set(x, y, z);
  _q.setFromAxisAngle(_up, rotY);
  _s.set(sx, sy, sz);
  _m.compose(_v, _q, _s);
  mesh.setMatrixAt(index, _m);
}
function composeFlat(mesh, index, x, y, z, scale) {
  _v.set(x, y, z);
  _s.set(scale, scale, scale);
  _m.compose(_v, _flat, _s);
  mesh.setMatrixAt(index, _m);
}

function addPanelAttributes(mesh, count, cols, rows) {
  const aTile = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
  const aGlow = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  const aWing = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  mesh.geometry.setAttribute('aTile', aTile);
  mesh.geometry.setAttribute('aAlpha', aAlpha);
  mesh.geometry.setAttribute('aGlow', aGlow);
  mesh.geometry.setAttribute('aWing', aWing);
  return { aTile, aAlpha, aGlow, aWing, cols, rows };
}
function flushPanelAttributes(attr) {
  attr.aTile.needsUpdate = true;
  attr.aAlpha.needsUpdate = true;
  attr.aGlow.needsUpdate = true;
  attr.aWing.needsUpdate = true;
}

function buildExhibits() {
  room.count = LINKS.length;

  /* plinths: unit box stretched to the height each plaque needs */
  room.plinth = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CFG.plinthW, 1, CFG.plinthW),
    new THREE.MeshStandardMaterial({ color: 0x1b1f31, roughness: 0.52, metalness: 0.35 }),
    room.count
  );
  /* frames: the mount the plaque sits on, tinted by wing */
  room.frame = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CFG.frame.w, CFG.frame.h, CFG.frame.d),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.65 }),
    room.count
  );
  /* light pools */
  room.puck = new THREE.InstancedMesh(
    new THREE.CircleGeometry(CFG.puckRadius, 32),
    new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false
    }),
    room.count
  );
  /* plaques: the only thing in the room that carries text */
  const plaqueGeometry = new THREE.PlaneGeometry(CFG.plaque.w, CFG.plaque.h);
  room.plaqueMaterial = panelMaterial(labels.plaqueTex, CFG.atlasCols, CFG.atlasRows, { boost: 1.06 });
  room.plaque = new THREE.InstancedMesh(plaqueGeometry, room.plaqueMaterial, room.count);
  room.plaque.frustumCulled = false;   // instanced bounds are cheap to get wrong, so skip it

  room.attr.plaque = addPanelAttributes(room.plaque, room.count, CFG.atlasCols, CFG.atlasRows);

  const color = new THREE.Color();
  LINKS.forEach((link, i) => {
    link._fade = 1;
    link._glow = 0;
    const bottom = link._y - CFG.plaque.h / 2;
    composeBox(room.plinth, i, link._x, (bottom - 0.05) / 2, link._z, link._a, 1, bottom - 0.05, 1);
    compose(room.frame, i, polarX(link._a, link._r + 0.09), link._y, polarZ(link._a, link._r + 0.09), facing(link._a), 1);
    compose(room.plaque, i, link._plate.x, link._plate.y, link._plate.z, facing(link._a), 1);
    composeFlat(room.puck, i, link._x, 0.04, link._z, 1);

    color.setHex(link._wing.color);
    room.frame.setColorAt(i, color);
    room.puck.setColorAt(i, color);

    const tile = tileOrigin(i, CFG.atlasCols, CFG.atlasRows);
    room.attr.plaque.aTile.setXY(i, tile[0], tile[1]);
    room.attr.plaque.aWing.setXYZ(i, color.r, color.g, color.b);
    room.attr.plaque.aAlpha.setX(i, 1);
  });

  [room.plinth, room.frame, room.puck, room.plaque].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  });
  flushPanelAttributes(room.attr.plaque);

  buildBanners();
  room.visibleCount = room.count;
}

/* Banners hang above each wing's hall — the way a museum signs a gallery. */
function buildBanners() {
  const n = plan.wings.length;
  const geometry = new THREE.PlaneGeometry(CFG.banner.w, CFG.banner.h);
  room.bannerMaterial = panelMaterial(labels.bannerTex, CFG.bannerCols, CFG.bannerRows,
    { boost: 1.0, flat: true });
  room.banner = new THREE.InstancedMesh(geometry, room.bannerMaterial, n);
  room.attr.banner = addPanelAttributes(room.banner, n, CFG.bannerCols, CFG.bannerRows);
  const color = new THREE.Color();
  plan.wings.forEach((wing, i) => {
    wing._bannerR = wing.rMax + 4.4;
    wing._bannerY = wing.rows[0]._y + CFG.bannerLift + CFG.banner.h * 0.5;
    compose(room.banner, i, polarX(wing.aCenter, wing._bannerR), wing._bannerY,
      polarZ(wing.aCenter, wing._bannerR), wing.aCenter + Math.PI, 1);
    const tile = tileOrigin(i, CFG.bannerCols, CFG.bannerRows);
    room.attr.banner.aTile.setXY(i, tile[0], tile[1]);
    color.setHex(wing.color);
    room.attr.banner.aWing.setXYZ(i, color.r, color.g, color.b);
    room.attr.banner.aAlpha.setX(i, 1);
    wing._fade = 1;
  });
  room.banner.instanceMatrix.needsUpdate = true;
  scene.add(room.banner);
}

/* Write one exhibit's matrices for its current fade value. The plinth grows
   out of the floor and the plaque shrinks into it, so filtering an exhibit
   away reads as the room tidying itself up. */
function applyExhibitTransform(i) {
  const link = LINKS[i];
  const fade = link._fade;
  const bottom = link._y - CFG.plaque.h / 2;
  const height = (bottom - 0.05) * fade;
  const shrink = Math.max(0.001, fade);   // a filtered exhibit folds away entirely, frame included
  composeBox(room.plinth, i, link._x, height / 2, link._z, link._a, shrink, Math.max(0.001, height), shrink);
  compose(room.frame, i, polarX(link._a, link._r + 0.09), link._y, polarZ(link._a, link._r + 0.09),
    facing(link._a), shrink);
  compose(room.plaque, i, link._plate.x, link._plate.y, link._plate.z, facing(link._a), shrink);
  composeFlat(room.puck, i, link._x, 0.04, link._z, fade);
  room.attr.plaque.aAlpha.setX(i, fade);
  room.attr.plaque.aGlow.setX(i, link._glow);
}

/* Called once per animating frame: flush whatever changed onto the GPU. */
function flushExhibits() {
  [room.plinth, room.frame, room.puck, room.plaque].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
  });
  room.attr.plaque.aAlpha.needsUpdate = true;
  room.attr.plaque.aGlow.needsUpdate = true;
}

/* Selection fixtures: a pool of light, a ring on the floor, a beam from the
   ceiling, and a real point light so the exhibit actually brightens. */
const mark = { active: false, strength: 0, wing: 0xffffff };
function moveSelectionMark(index) {
  if (!state.webgl) return;
  if (index < 0) { mark.active = false; return; }
  const link = LINKS[index];
  mark.active = true;
  mark.wing = link._wing.color;
  const tint = new THREE.Color(link._wing.color);
  world.pool.material.color.copy(tint);
  world.poolRing.material.color.copy(tint);
  world.beam.material.uniforms.uTint.value.copy(tint);
  world.pool.position.set(link._x, 0.06, link._z);
  world.poolRing.position.set(link._x, 0.08, link._z);
  world.poolRing.rotation.z = link._a;
  const beamTop = link._y + 9;
  world.beam.position.set(link._x, link._y + 4.5, link._z);
  world.beam.scale.y = (beamTop - (link._y - 4.5)) / 14;
  world.selectionLight.color.copy(tint);
  world.selectionLight.position.set(
    polarX(link._a, link._r - 2.4), link._y + 1.4, polarZ(link._a, link._r - 2.4)
  );
}
function updateSelectionMark(delta) {
  const target = mark.active ? 1 : 0;
  if (Math.abs(mark.strength - target) < 0.004) return false;
  mark.strength += (target - mark.strength) * Math.min(1, delta * 5.5);
  world.pool.material.opacity = 0.5 * mark.strength;
  world.poolRing.material.opacity = 0.75 * mark.strength;
  world.beam.material.uniforms.uOpacity.value = 0.5 * mark.strength;
  world.selectionLight.intensity = 3.2 * mark.strength;
  world.pool.scale.setScalar(0.7 + 0.3 * mark.strength);
  world.poolRing.scale.setScalar(0.86 + 0.14 * mark.strength);
  return true;
}
