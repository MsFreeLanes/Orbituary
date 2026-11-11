/* ── 08 · camera ─────────────────────────────────────────────────────────
   A hand-rolled orbit rig: spherical coordinates around a target that can
   itself move. The museum is a rotunda, so the camera lives inside the ring —
   plaques face inward, and being outside them means reading their backs. All
   motion is damped and every jump is an eased flight, which is what makes the
   difference between a viewer and a camera operator. */
const rig = {
  theta: 0,
  phi: CFG.camPhi,
  radius: CFG.camMax,
  target: null,               // THREE.Vector3, filled in by initThreeScratch()
  goal: null,
  dragging: false,
  velocity: { theta: 0, phi: 0 },
  pan: null
};

/* Spherical rig: theta points from the target TOWARD the camera. The plaques
   face the middle of the rotunda, so any pose that looks at something standing
   at angle `a` puts the camera on the far side of it — hence facingFrom(). */
const facingFrom = (a) => a + Math.PI;

function rigReset(soft) {
  flyTo({
    theta: facingFrom(plan.wings[0].aCenter),
    phi: CFG.camPhi,
    radius: CFG.camRadius,
    target: { x: 0, y: CFG.camTargetY, z: 0 },
    seconds: soft ? 1.1 : 0.01
  });
  rig.goal = null;
}

/* Fly to a pose. `seconds` 0 snaps. `look` offsets the aim, so a selected
   exhibit sits left of centre with the info panel breathing room. */
function flyTo(options) {
  if (!state.webgl) return;
  const o = options || {};
  const seconds = o.seconds === undefined ? CFG.flySeconds : o.seconds;
  rig.goal = {
    from: {
      theta: rig.theta, phi: rig.phi, radius: rig.radius,
      x: rig.target.x, y: rig.target.y, z: rig.target.z
    },
    to: {
      theta: o.theta === undefined ? rig.theta : o.theta,
      phi: clamp(o.phi === undefined ? rig.phi : o.phi, 0.18, 1.47),
      radius: clamp(o.radius === undefined ? rig.radius : o.radius, CFG.camMin, CFG.camMax * 2.4),
      x: o.target ? o.target.x : rig.target.x,
      y: o.target ? o.target.y : rig.target.y,
      z: o.target ? o.target.z : rig.target.z
    },
    start: performance.now(),
    ms: Math.max(0.01, seconds) * 1000,
    drift: o.drift === undefined ? 0 : o.drift
  };
  if (rig.goal.to.theta === undefined) rig.goal.to.theta = rig.theta;
  state.busy = seconds > 0;
  state.dirty = true;
}

/* Pose helper: say where the camera should stand and what it should look at,
   and the spherical rig works out its own numbers. Far easier to aim a room
   this way than by pushing theta/phi around. */
function poseFor(eye, target, seconds) {
  const dx = eye.x - target.x, dy = eye.y - target.y, dz = eye.z - target.z;
  const radius = Math.max(CFG.camMin, Math.hypot(dx, dy, dz));
  flyTo({
    theta: Math.atan2(dx, dz),          // same polar convention the room uses
    phi: clamp(Math.acos(clamp(dy / radius, -1, 1)), 0.18, 1.47),
    radius: radius,
    target: target,
    seconds: seconds
  });
}

/* Pose that shows one exhibit well: standing inside its arc, off to one side,
   plaque left of centre so the info panel has room to breathe. */
function flyToExhibit(index, seconds) {
  const link = LINKS[index];
  if (!link) return;
  const eyeA = link._a + CFG.exhibitSwing;
  const eyeR = Math.max(CFG.camMin, link._r - CFG.exhibitRange);
  poseFor(
    { x: polarX(eyeA, eyeR), y: link._y + CFG.exhibitEyeLift, z: polarZ(eyeA, eyeR) },
    { x: link._x, y: link._y - 0.35, z: link._z },
    seconds === undefined ? CFG.flySeconds : seconds
  );
}

/* Pose that shows a whole wing: stand inside the ring, a little around from the
   hall's centre line, and look across at it — the way a wing arrives when you
   walk in. The oculus core stays out of the way, off the far shoulder. */
function flyToWing(name, seconds) {
  const wing = plan.wings.find((w) => w.name === name);
  if (!wing) return;
  const eyeA = wing.aCenter + CFG.wingSwing;
  const eyeR = Math.min(plan.rMin - 6, wing.midR * 0.55);
  poseFor(
    { x: polarX(eyeA, eyeR), y: CFG.wingEyeY, z: polarZ(eyeA, eyeR) },
    { x: polarX(wing.aCenter, wing.midR), y: wing.midY, z: polarZ(wing.aCenter, wing.midR) },
    seconds === undefined ? 1.5 : seconds
  );
}

function updateCamera(delta) {
  if (rig.goal) {
    const g = rig.goal;
    const t = clamp((performance.now() - g.start) / g.ms, 0, 1);
    const e = easeInOut(t);
    rig.theta = lerp(g.from.theta, g.to.theta, e);
    rig.phi = lerp(g.from.phi, g.to.phi, e);
    rig.radius = lerp(g.from.radius, g.to.radius, e);
    rig.target.set(
      lerp(g.from.x, g.to.x, e),
      lerp(g.from.y, g.to.y, e),
      lerp(g.from.z, g.to.z, e)
    );
    if (g.drift) rig.theta += g.drift * delta;
    if (t >= 1) {
      rig.goal = null;
      state.busy = false;
    }
  } else {
    /* inertia: keep drifting after a drag, settling within a couple of frames */
    if (!rig.dragging && (Math.abs(rig.velocity.theta) > 1e-5 || Math.abs(rig.velocity.phi) > 1e-5)) {
      rig.theta += rig.velocity.theta;
      rig.phi = clamp(rig.phi + rig.velocity.phi, 0.18, 1.47);
      rig.velocity.theta *= 0.90;
      rig.velocity.phi *= 0.90;
      state.dirty = true;
    }
  }

  const sinPhi = Math.sin(rig.phi);
  camera.position.set(
    rig.target.x + rig.radius * sinPhi * Math.sin(rig.theta),
    rig.target.y + rig.radius * Math.cos(rig.phi),
    rig.target.z + rig.radius * sinPhi * Math.cos(rig.theta)
  );
  /* Keep the camera off the floor and inside the innermost ring of exhibits:
     the plaques face inward, so from outside them you would only ever see the
     backs of the frames. This one clamp is what makes every pose readable. */
  camera.position.y = Math.max(0.9, camera.position.y);
  const worldRadius = Math.hypot(camera.position.x, camera.position.z);
  const limit = plan.rMin - 2;
  if (worldRadius > limit) {
    const k = limit / worldRadius;
    camera.position.x *= k;
    camera.position.z *= k;
  }
  camera.lookAt(rig.target);
}

/* — input —————————————————————————————————————————————————──────────────── */
function orbitBy(dx, dy) {
  rig.goal = null;
  rig.velocity.theta = -dx * 0.005;
  rig.velocity.phi = -dy * 0.005;
  rig.theta += rig.velocity.theta;
  rig.phi = clamp(rig.phi + rig.velocity.phi, 0.18, 1.47);
  state.dirty = true;
}
function zoomBy(factor) {
  rig.goal = null;
  rig.radius = clamp(rig.radius * factor, CFG.camMin, CFG.camMax);
  state.dirty = true;
}

/* Pointer: drag to orbit, wheel to dolly. A click that barely moved is a pick. */
function bindStageInput() {
  const canvas = dom.stage;
  let last = null, moved = 0, pointerId = null;
  const pinch = { distance: 0, active: false };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    pointerId = event.pointerId;
    rig.dragging = true;
    moved = 0;
    last = { x: event.clientX, y: event.clientY };
    rig.velocity.theta = rig.velocity.phi = 0;
    canvas.setPointerCapture(pointerId);
    document.body.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' && !rig.dragging) pickAt(event.clientX, event.clientY, true);
    if (!rig.dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - last.x, dy = event.clientY - last.y;
    moved += Math.abs(dx) + Math.abs(dy);
    last = { x: event.clientX, y: event.clientY };
    orbitBy(dx, dy);
  });
  const release = (event) => {
    if (!rig.dragging) return;
    rig.dragging = false;
    document.body.classList.remove('dragging');
    if (moved < 6) pickAt(event.clientX, event.clientY, false);
    else announce('Moved the camera.');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => {
    rig.dragging = false;
    document.body.classList.remove('dragging');
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? 1.09 : 0.92);
  }, { passive: false });

  /* pinch to dolly, two fingers */
  const pointers = new Map();
  canvas.addEventListener('pointerdown', (event) => pointers.set(event.pointerId, event));
  canvas.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, event);
    if (pointers.size === 2) {
      const list = Array.from(pointers.values());
      const distance = Math.hypot(list[0].clientX - list[1].clientX, list[0].clientY - list[1].clientY);
      if (pinch.distance) zoomBy(pinch.distance / distance);
      pinch.distance = distance;
      rig.dragging = false;
    }
  });
  const forget = (event) => { pointers.delete(event.pointerId); pinch.distance = 0; };
  canvas.addEventListener('pointerup', forget);
  canvas.addEventListener('pointercancel', forget);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}
