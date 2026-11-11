/* ── 10 · transitions ────────────────────────────────────────────────────
   Filtering the collection is not a boolean in this room: exhibits rise out of
   the floor and sink back into it, in a stagger that runs along the arc, so
   the eye can follow what went where. One target value per exhibit, one
   integrator per frame. */
const FADE_SPEED = 3.2;          // per second
const STAGGER = 0.028;           // seconds between neighbours

function matchesQuery(link, query) {
  if (!query) return true;
  return (link.n + ' ' + link.d + ' ' + link.c + ' ' + link.u).toLowerCase().indexOf(query) >= 0;
}

/* One predicate for every filter — wings, text, favourites — so the 3D room,
   the chips, the minimap and the catalogue can never disagree. */
function exhibitIsVisible(link, query) {
  return state.wingsOn.has(link.c) && passesFavourites(link) && matchesQuery(link, query);
}

function recomputeVisibility(options) {
  const opts = options || {};
  const query = state.query.trim().toLowerCase();
  const order = [];
  LINKS.forEach((link, i) => {
    const keep = exhibitIsVisible(link, query);
    link._target = keep ? 1 : 0;
    if (keep) order.push(i);
  });
  state.visible = order;
  state.visibleSet = new Set(order);

  /* Stagger along the arc the camera is facing, so a filter change reads as a
     wave crossing the room rather than a blink. (theta points from the target
     to the camera, so the exhibits in view sit half a turn away from it.) */
  const facingCamera = rig.theta + Math.PI;
  order.sort((a, b) => angularDistance(LINKS[a]._a, facingCamera) - angularDistance(LINKS[b]._a, facingCamera));
  order.forEach((i, rank) => { LINKS[i]._delay = rank * STAGGER; });
  LINKS.forEach((link) => { link._delay = state.visibleSet.has(link._i) ? link._delay : 0; });

  plan.wings.forEach((wing) => {
    wing._target = state.wingsOn.has(wing.name) && countInWing(wing, query) > 0 ? 1 : 0;
  });

  if (state.selected >= 0 && !state.visibleSet.has(state.selected)) closeLabel();

  /* Everything below this line talks to the room, which does not exist when
     the machine fell back to the catalogue. */
  if (state.webgl) {
    room.visibleCount = state.visible.length;
    syncPlanDots();
    if (opts.instant) {
      LINKS.forEach((link, i) => {
        link._fade = link._target;
        link._delay = 0;
        applyExhibitTransform(i);
      });
      plan.wings.forEach((wing) => { wing._fade = wing._target; });
      applyWingFades();
      flushExhibits();
    }
  }
  state.dirty = true;
  state.busy = state.webgl;
  dom.statValues.vis.textContent = state.visible.length + ' / ' + LINKS.length;
  updateChips();
  if (state.mode === 'catalogue') paintCatalogue();
}

function countInWing(wing, query) {
  let shown = 0;
  wing.items.forEach((i) => {
    const link = LINKS[i];
    if (passesFavourites(link) && matchesQuery(link, query)) shown++;
  });
  return shown;
}

function angularDistance(a, b) {
  let d = Math.abs(a - b) % TAU;
  return d > Math.PI ? TAU - d : d;
}

/* Returns true while anything is still moving — the render loop uses that to
   decide whether to keep drawing every frame or drop back to a heartbeat. */
function animateFades(delta, elapsed) {
  let moving = false;
  for (let i = 0; i < LINKS.length; i++) {
    const link = LINKS[i];

    /* light: the selected exhibit breathes, the hovered one lifts, the rest
       sit neutral. Central here so hover, selection and the tour all agree. */
    const glowGoal = state.selected === i
      ? 0.52 + 0.14 * Math.sin(elapsed * 2.4)
      : (state.hovered === i ? 0.85 : 0);
    if (Math.abs(link._glow - glowGoal) > 0.006) {
      link._glow += (glowGoal - link._glow) * Math.min(1, delta * 7);
      room.attr.plaque.aGlow.setX(i, link._glow);
      moving = true;
    }

    if (link._delay > 0) { link._delay -= delta; moving = true; continue; }
    const gap = link._target - link._fade;
    if (Math.abs(gap) > 0.003) {
      link._fade += gap * Math.min(1, delta * FADE_SPEED);
      applyExhibitTransform(i);
      moving = true;
    } else if (link._fade !== link._target) {
      link._fade = link._target;
      applyExhibitTransform(i);
      moving = true;
    }
  }
  plan.wings.forEach((wing) => {
    const gap = wing._target - wing._fade;
    if (Math.abs(gap) > 0.004) {
      wing._fade += gap * Math.min(1, delta * FADE_SPEED);
      moving = true;
    } else if (wing._fade !== wing._target) wing._fade = wing._target;
  });
  if (moving) {
    applyWingFades();
    flushExhibits();
  }
  return moving;
}

/* A wing's banner and its lit lip ride along with its exhibits. */
function applyWingFades() {
  plan.wings.forEach((wing, i) => {
    room.attr.banner.aAlpha.setX(i, wing._fade);
    compose(room.banner, i,
      polarX(wing.aCenter, wing._bannerR), wing._bannerY, polarZ(wing.aCenter, wing._bannerR),
      wing.aCenter + Math.PI, 0.9 + 0.1 * wing._fade);
    const rim = world.rims[i * 2], inner = world.rims[i * 2 + 1];
    rim.material.opacity = 0.55 * wing._fade;
    inner.material.opacity = 0.18 * wing._fade;
    rim.visible = wing._fade > 0.02;
    inner.visible = wing._fade > 0.02;
  });
  room.attr.banner.aAlpha.needsUpdate = true;
  room.banner.instanceMatrix.needsUpdate = true;
}

/* Staggered opening: the room assembles itself wing by wing behind the
   curtain, so the first thing you see is a building putting itself together. */
function assembleRoom() {
  const sorted = plan.wings.slice().sort((a, b) => a.aCenter - b.aCenter);
  LINKS.forEach((link) => { link._fade = 0; link._target = 1; link._delay = 0; });
  plan.wings.forEach((wing) => { wing._fade = 0; wing._target = 1; });
  sorted.forEach((wing, order) => {
    wing.items.forEach((i, k) => {
      LINKS[i]._delay = REDUCED_MOTION ? 0 : order * 0.11 + k * 0.055;
    });
  });
  applyWingFades();
  flushExhibits();
}
