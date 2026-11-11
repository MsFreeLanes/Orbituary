/* ── 15 · render loop ────────────────────────────────────────────────────
   One rAF, one clock. The room renders on demand: anything that can change
   sets state.dirty or keeps state.busy true, and when nothing is happening at
   all the loop still draws every CFG.heartbeat-th frame so the dust and the
   ember keep drifting — at a fifth of the cost. */
let rafId = 0, tick = 0, rendered = 0, fpsClock = 0, fpsValue = 0;

function frame() {
  rafId = requestAnimationFrame(frame);
  const delta = Math.min(0.05, clock.getDelta());      // clamped: a hidden tab must not jump the world
  const elapsed = clock.elapsedTime;
  tick++;

  /* the catalogue is plain DOM: while it is up the room is not drawn at all */
  if (state.mode === 'catalogue') return;

  const fading = animateFades(delta, elapsed);
  const flying = !!rig.goal;
  const settling = Math.abs(rig.velocity.theta) > 1e-5 || Math.abs(rig.velocity.phi) > 1e-5;
  const moving = fading || flying || settling || rig.dragging || state.tour || mark.active;

  if (flying || fading || state.tour) state.busy = true;
  updateCamera(delta);
  updateTour(delta);
  updateStage(elapsed, delta);
  updateSelectionMark(delta);
  /* the two DOM overlays only need touching when the world actually moved */
  if (moving || state.dirty) {
    if (state.selected >= 0) updateBloom();
    updatePlanMarker();
  }

  const worthDrawing = state.dirty || moving || tick % CFG.heartbeat === 0;
  if (worthDrawing) {
    renderer.render(scene, camera);
    rendered++;
    state.dirty = false;
  }
  if (!moving) state.busy = false;

  /* fps is measured over a second of wall time, not frame counts */
  fpsClock += delta;
  if (fpsClock >= 0.5) {
    fpsValue = Math.round(rendered / fpsClock);
    rendered = 0;
    fpsClock = 0;
    if (state.stats) paintStats();
  }
}

function paintStats() {
  const info = renderer.info;
  dom.statValues.fps.textContent = fpsValue + ' fps';
  dom.statValues.calls.textContent = info.render.calls + ' calls';
  dom.statValues.tris.textContent = (info.render.triangles / 1000).toFixed(1) + 'k tris';
  dom.statValues.vis.textContent = room.visibleCount + '/' + LINKS.length;
}

function startLoop() {
  if (rafId) return;
  clock.start();
  rafId = requestAnimationFrame(frame);
}

/* Pause cleanly when the tab is hidden: rAF already stops in every browser,
   but the clock must be restarted so nothing leaps on return. */
function onVisibilityChange() {
  if (document.hidden) {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  } else if (!rafId) {
    clock.getDelta();
    startLoop();
  }
  state.dirty = true;
}
