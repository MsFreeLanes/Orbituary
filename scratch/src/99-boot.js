/* ── 16 · boot ───────────────────────────────────────────────────────────
   The sequence that turns the text in this file into a building. It is staged
   and yields to the browser between steps, so the loading curtain can narrate
   what it is doing instead of freezing on a white screen — and if WebGL or the
   three.js CDN is unavailable, the same sequence ends in the readable
   catalogue rather than an error page. */

function hasWebGL() {
  try {
    const probe = document.createElement('canvas');
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch (error) {
    return false;
  }
}

const nextFrame = () => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
});

/* — window plumbing —————————————————————──────────────────────────────────── */
let resizeFrame = 0;
function onResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const width = window.innerWidth, height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CFG.maxDpr));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    state.dirty = true;
  });
}

function bindWindow() {
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibilityChange);
  /* the first gesture is the only moment a browser allows an AudioContext */
  window.addEventListener('pointerdown', () => { if (state.sound) ensureAudio(); }, { once: true });
}

/* — opening flight —————————————————————───────────────────────────────────── */
/* The visitor arrives from outside the building and is carried in over the
   oculus: a long eased dolly with a slow drift, which reads as walking rather
   than as a camera cut. */
function introFlight() {
  const first = plan.wings[0];
  rig.theta = CFG.introFrom.angle;
  rig.phi = CFG.introFrom.phi;
  rig.radius = CFG.introFrom.radius;
  rig.target.set(0, CFG.camTargetY + 6, 0);
  flyTo({
    theta: facingFrom(first.aCenter),
    phi: CFG.camPhi,
    radius: CFG.camRadius,
    target: { x: 0, y: CFG.camTargetY, z: 0 },
    seconds: REDUCED_MOTION ? 0.2 : 3.4,
    drift: REDUCED_MOTION ? 0 : 0.035
  });
}

/* — fallback ——————————————————————————————————───────────────────────────── */
/* No WebGL (or no three.js): the collection is still a collection. The same
   filter, search and favourites machinery runs; only the room is missing. */
function bootFallback(reason) {
  state.webgl = false;
  state.mode = 'catalogue';
  document.body.classList.add('mode-catalogue');
  dom.curtain.classList.add('failed');
  dom.curtainTag.textContent = reason;
  dom.curtainStep.textContent = 'opening the printed catalogue instead…';
  [dom.buttons.tour, dom.buttons.reset].forEach((button) => {
    button.disabled = true;
    button.title = 'Needs WebGL';
  });
  dom.plan.style.display = 'none';
  dom.stats.style.display = 'none';
  loadFavourites();
  buildFloorPlan();
  buildChips();
  buildHelpLegend();
  buildJukebox();
  bindChrome();
  bindCatalogue();
  recomputeVisibility({ instant: true });
  paintCatalogue();
  curtain(1, 'catalogue ready');
  setTimeout(() => dom.curtain.classList.add('lift'), 700);
  toast('3D unavailable — showing the catalogue');
}

/* — main sequence —————————————————————────────────────────────────────────── */
async function boot() {
  /* One deliberate leak for the curious: open the console and the whole museum
     is in there — state, plan, room, world — plus a few verbs. Nothing in the
     app reads it back. */
  window.museum = {
    state, plan, room, world, rig, CFG, LINKS, juke,
    /* the renderer and camera only exist once the stage is built, so these are
       read when asked for rather than captured now */
    get camera() { return camera; },
    get renderer() { return renderer; },
    get drawCalls() { return renderer ? renderer.info.render.calls : 0; },
    go: (index) => selectExhibit(index, true),
    find: (query) => { dom.search.value = query; onSearchInput(); },
    wing: (name) => { flyToWing(name, 1.2); soloWing(name); },
    tour: () => toggleTour(),
    catalogue: () => setMode('catalogue'),
    jukebox: (index) => {
      toggleJukebox(true);
      if (index === undefined) toggleJukePlay();
      else selectTune(index, true);
    }
  };

  const noLibrary = typeof THREE === 'undefined';
  if (noLibrary || !hasWebGL()) {
    bootFallback(noLibrary ? 'the three.js library could not be loaded' : 'this browser cannot open a 3D canvas');
    return;
  }

  curtain(0.06, 'reading the collection…');
  loadFavourites();
  buildFloorPlan();
  applyCameraLimits();
  dom.curtainTag.textContent = plan.wings.length + ' wings · ' + LINKS.length +
    ' exhibits · one rotunda ' + Math.round(plan.wallR * 2) + ' metres across';
  await nextFrame();

  curtain(0.18, 'raising the rotunda…');
  initThreeScratch();
  createStage();
  await nextFrame();

  curtain(0.44, 'etching ' + LINKS.length + ' plaques…');
  buildAtlases();
  await nextFrame();

  curtain(0.6, 'casting plinths, hanging banners, building halls…');
  buildExhibits();
  buildHalls();
  await nextFrame();

  curtain(0.72, 'drawing the plan…');
  buildPlan();
  buildChips();
  buildHelpLegend();
  buildJukebox();
  bindChrome();
  bindCatalogue();
  bindStageInput();
  bindWindow();
  await nextFrame();

  curtain(0.84, 'lighting the exhibits…');
  recomputeVisibility({ instant: true });
  assembleRoom();
  await nextFrame();

  curtain(0.95, 'opening the doors…');
  startLoop();
  introFlight();
  await nextFrame();

  curtain(1, 'welcome');
  setTimeout(() => {
    dom.curtain.classList.add('lift');
    if (!store.read('seen')) {
      store.write('seen', true);
      setTimeout(() => toast('Drag to walk the room · press ? for the map'), 1400);
    }
    announce('The Museum of Useful Links is open. ' + LINKS.length + ' exhibits across ' +
      plan.wings.length + ' wings. Press ? for the keyboard map.');
  }, 420);
}

/* Everything above is inside one immediately-invoked function, so nothing in
   this file leaks into the page. */
boot();
})();
