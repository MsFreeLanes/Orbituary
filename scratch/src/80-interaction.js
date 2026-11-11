/* ── 09 · picking ────────────────────────────────────────────────────────
   Raycasting one InstancedMesh returns the instance id, so hit-testing 88
   exhibits costs a single ray. Hover lights the plaque and shows a chip; a
   click selects — the room lights up around the exhibit, the camera walks over
   and the label opens. Clicking an exhibit that is already open is the gesture
   for "take me there", so there is no tiny button hiding in the 3D view. */
/* raycaster, ndc and projected are the shared THREE scratch objects, created
   by initThreeScratch() in section 07. */

function pickAt(clientX, clientY, hoverOnly) {
  if (!state.webgl || state.mode !== 'rotunda') return;
  ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (!state.visible.length) { if (hoverOnly) setHover(-1); return; }

  /* Only the plaques are hit-testable: they are the visible face of an
     exhibit, they are all one mesh, and the instance id is the exhibit id. */
  const hits = raycaster.intersectObject(room.plaque, false);
  let found = -1;
  for (let i = 0; i < hits.length; i++) {
    const id = hits[i].instanceId;
    if (id === undefined || id === null) continue;
    if (!state.visibleSet.has(id)) continue;
    found = id;
    break;
  }
  if (hoverOnly) { setHover(found, clientX, clientY); return; }
  if (found >= 0) {
    if (found === state.selected) openLink(found);
    else selectExhibit(found, true);
  } else {
    closeLabel();
  }
}

function setHover(index, clientX, clientY) {
  if (index !== state.hovered) {
    /* The glow value is integrated in section 10, so hover, selection and the
       guided tour cannot end up fighting over the same attribute. */
    state.hovered = index;
    if (index >= 0) {
      const link = LINKS[index];
      dom.tip.querySelector('.wing').textContent = link.c;
      dom.tip.querySelector('.nm').textContent = link.n;
      dom.tip.style.setProperty('--wing', link._wing.hex);
      dom.tip.classList.add('on');
      dom.stage.classList.add('pointing');
      if (state.sound) blip(720, 0.05, 0.025);
    } else {
      dom.tip.classList.remove('on');
      dom.stage.classList.remove('pointing');
    }
    state.dirty = true;
  }
  if (index >= 0 && clientX !== undefined) moveTip(clientX, clientY);
}

function moveTip(clientX, clientY) {
  const w = dom.tip.offsetWidth || 180, h = dom.tip.offsetHeight || 34;
  dom.tip.style.left = Math.round(clamp(clientX - w / 2, 10, window.innerWidth - w - 10)) + 'px';
  dom.tip.style.top = Math.round(clamp(clientY - h - 16, 70, window.innerHeight - h - 10)) + 'px';
}

/* — selection —————————————————————————————————————————————————──────────── */
function selectExhibit(index, fly) {
  const link = LINKS[index];
  if (!link) return;
  /* off stage is not the same as unreachable: a plan dot in a soloed wing is
     still a request to go somewhere, so take the filters off and carry on */
  if (!state.visibleSet.has(index)) bringIntoView(link);
  state.selected = index;
  moveSelectionMark(index);
  paintLabel(link, index);
  dom.exhibit.classList.add('open');
  dom.exhibit.setAttribute('aria-hidden', 'false');
  document.body.classList.add('docked');
  dom.bloom.classList.add('on');
  hideCaption();
  highlightPlan(index);
  if (fly) flyToExhibit(index);
  if (state.sound) chime(index);
  announce('Exhibit ' + (index + 1) + ' of ' + LINKS.length + ': ' + link.n + ', ' + link.c + ' wing.');
  state.dirty = true;
}

function paintLabel(link, index) {
  dom.exhibit.style.setProperty('--wing', link._wing.hex);
  dom.panel.wing.textContent = link.c;
  dom.panel.no.textContent = '#' + pad2(index + 1) + ' / ' + LINKS.length;
  dom.panel.title.textContent = link.n;
  dom.panel.desc.textContent = link.d;
  dom.panel.url.textContent = link.u;
  dom.panel.visit.href = link.u;
  dom.panel.factWing.textContent = link.c;
  dom.panel.factDomain.textContent = hostOf(link.u);
  const favourite = state.favs.has(link.u);
  dom.panel.star.setAttribute('aria-pressed', favourite ? 'true' : 'false');
  dom.panel.star.title = favourite ? 'Remove from favourites (F)' : 'Save to favourites (F)';
  const rank = state.visible.indexOf(index);
  dom.panel.count.textContent = state.visible.length
    ? (rank + 1) + ' / ' + state.visible.length
    : 'none in view';
  dom.panel.prev.disabled = state.visible.length < 2;
  dom.panel.next.disabled = state.visible.length < 2;
}

function closeLabel() {
  if (state.selected < 0 && !dom.exhibit.classList.contains('open')) return;
  if (state.tour) stopTour();
  state.selected = -1;
  moveSelectionMark(-1);
  dom.exhibit.classList.remove('open');
  dom.exhibit.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('docked');
  dom.bloom.classList.remove('on');
  highlightPlan(-1);
  state.dirty = true;
}

function openLink(index) {
  const link = LINKS[index];
  if (!link) return;
  window.open(link.u, '_blank', 'noopener');
  if (state.sound) blip(880, 0.07, 0.04);
  toast('Opened ' + hostOf(link.u));
  announce('Opened ' + link.n + ' in a new tab.');
}

/* Step through the room in plan order — arrow keys and the panel's arrows.
   Wrapping is deliberate: a rotunda has no end. */
function stepExhibit(delta) {
  const list = state.visible;
  if (!list.length) return;
  const at = list.indexOf(state.selected);
  const next = at < 0
    ? (delta > 0 ? list[0] : list[list.length - 1])
    : list[(at + delta + list.length) % list.length];
  selectExhibit(next, true);
}

/* A wing chip can also mean "show me this wing": if nothing from it is on
   view, fly to the hall itself instead of selecting nothing. */
function selectNearestInWing(name) {
  const candidate = state.visible.find((i) => LINKS[i].c === name);
  if (candidate !== undefined) selectExhibit(candidate, true);
  else flyToWing(name);
}

/* Fake bloom: a CSS radial gradient parked over the selected exhibit's
   projected screen position — light bleed without a post-processing pass. */
function updateBloom() {
  if (state.selected < 0) return;
  const link = LINKS[state.selected];
  projected.set(link._plate.x, link._plate.y + 0.2, link._plate.z).project(camera);
  if (projected.z > 1) return;
  dom.bloom.style.setProperty('--bx', ((projected.x * 0.5 + 0.5) * window.innerWidth).toFixed(1) + 'px');
  dom.bloom.style.setProperty('--by', ((-projected.y * 0.5 + 0.5) * window.innerHeight).toFixed(1) + 'px');
  dom.bloom.style.setProperty('--bloom', link._wing.hex + '88');
}
