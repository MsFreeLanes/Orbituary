/* ── 14 · tour ───────────────────────────────────────────────────────────
   The guided tour reads the building the way a docent would: one exhibit per
   wing, in plan order, with a title card as you cross into the next hall. It
   is a route through the same selection machinery the keyboard uses, so the
   tour can never show you something the filters have hidden. */
let tourRoute = [];
let captionClock = 0;

function buildTourRoute() {
  const route = [];
  plan.wings.forEach((wing) => {
    /* one representative per wing: the exhibit closest to the middle of its
       wedge, which is the one a visitor notices first on entering */
    let best = -1, bestDistance = Infinity;
    wing.items.forEach((i) => {
      if (!state.visibleSet.has(i)) return;
      const distance = angularDistance(LINKS[i]._a, wing.aCenter);
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    });
    if (best >= 0) route.push({ index: best, wing: wing.name, card: true });
  });
  /* a second pass through the wings that have exhibits to spare, so the tour
     also shows the deeper rows that a first visit would miss */
  plan.wings.forEach((wing) => {
    const visible = wing.items.filter((i) => state.visibleSet.has(i));
    if (visible.length < 4) return;
    route.push({ index: visible[Math.floor(visible.length / 2)], wing: wing.name, card: false });
  });
  return route;
}

function toggleTour() {
  if (state.tour) { stopTour(); return; }
  startTour();
}

function startTour() {
  tourRoute = buildTourRoute();
  if (!tourRoute.length) { toast('Nothing to tour — widen the filter first'); return; }
  state.tour = true;
  state.tourStep = -1;
  state.tourClock = CFG.tourSeconds;      // advance immediately on the first beat
  dom.buttons.tour.setAttribute('aria-pressed', 'true');
  if (state.mode === 'catalogue') setMode('rotunda');
  toast('Guided tour — ' + tourRoute.length + ' stops. Press T to stop.');
  announce('Guided tour started.');
  state.dirty = true;
}

function stopTour() {
  if (!state.tour) return;
  state.tour = false;
  captionClock = 0;
  hideCaption();
  dom.buttons.tour.setAttribute('aria-pressed', 'false');
  toast('Tour stopped');
  state.dirty = true;
}

function advanceTour() {
  state.tourStep = (state.tourStep + 1) % tourRoute.length;
  const stop = tourRoute[state.tourStep];
  selectExhibit(stop.index, true);
  if (stop.card) { showCaption(stop.index); captionClock = Math.min(2.4, CFG.tourSeconds * 0.8); }
  else hideCaption();
  if (state.tourStep === tourRoute.length - 1) dom.planNote.textContent = 'last stop — looping';
}

/* Driven by the render loop, so the tour keeps time with the camera rather
   than with a timer that does not know when the flight has landed. */
function updateTour(delta) {
  if (!state.tour) return;
  if (captionClock > 0) {
    captionClock -= delta;
    if (captionClock <= 0) hideCaption();
  }
  state.tourClock += delta;
  if (state.tourClock >= CFG.tourSeconds) {
    state.tourClock = 0;
    advanceTour();
  }
}
