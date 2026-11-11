/* ── 13 · plan view ──────────────────────────────────────────────────────
   A drawn plan in the corner, not a rendered minimap: twelve wedges, eighty
   eight dots and a marker for where you are standing. It is also an input —
   click a wing to walk into it, click a dot to open that exhibit — which
   makes the whole collection navigable in one gesture. */
const PLAN_NS = 'http://www.w3.org/2000/svg';
const PLAN_R = 50;                     // svg units of clearance inside the viewBox
const planRefs = { beam: null, you: null, selected: null };
let planScale = 1;                     // world metres → svg units, set from the plan

function planPoint(angle, radius) {
  /* the same polar convention the room uses, so the plan and the view agree */
  return { x: Math.sin(angle) * radius * planScale, y: Math.cos(angle) * radius * planScale };
}

function svgTag(name, attrs) {
  const node = document.createElementNS(PLAN_NS, name);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  return node;
}

/* a wedge of the plan, drawn as an arc band between two radii */
function arcBandPath(aStart, aEnd, rIn, rOut) {
  const p1 = planPoint(aStart, rOut), p2 = planPoint(aEnd, rOut);
  const q1 = planPoint(aEnd, rIn), q2 = planPoint(aStart, rIn);
  const sweep = aEnd - aStart > Math.PI ? 1 : 0;
  const outer = (rOut * planScale).toFixed(2), inner = (rIn * planScale).toFixed(2);
  return 'M ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2) +
    ' A ' + outer + ' ' + outer + ' 0 ' + sweep + ' 1 ' + p2.x.toFixed(2) + ' ' + p2.y.toFixed(2) +
    ' L ' + q1.x.toFixed(2) + ' ' + q1.y.toFixed(2) +
    ' A ' + inner + ' ' + inner + ' 0 ' + sweep + ' 0 ' + q2.x.toFixed(2) + ' ' + q2.y.toFixed(2) + ' Z';
}

function buildPlan() {
  planScale = PLAN_R / plan.wallR;
  const svg = dom.planSvg;
  svg.innerHTML = '';

  /* the rotunda itself: floor edge, camera clearance and the oculus */
  svg.appendChild(svgTag('circle', {
    cx: 0, cy: 0, r: PLAN_R.toFixed(2),
    fill: 'none', stroke: 'rgba(255,255,255,.10)', 'stroke-width': 0.7
  }));
  svg.appendChild(svgTag('circle', {
    cx: 0, cy: 0, r: (plan.camMax * planScale).toFixed(2),
    fill: 'none', stroke: 'rgba(255,255,255,.07)', 'stroke-width': 0.5, 'stroke-dasharray': '1.5 2'
  }));
  svg.appendChild(svgTag('circle', { cx: 0, cy: 0, r: 3, fill: 'rgba(147,180,255,.16)' }));

  plan.wings.forEach((wing) => {
    const group = svgTag('g', {});
    group.appendChild(svgTag('path', {
      d: arcBandPath(wing.aStart, wing.aStart + wing.aSpan, wing.rMin - 1.6, wing.rMax + 1.6),
      fill: wing.hex, opacity: 0.16
    }));
    /* an invisible wedge from the centre outwards: the clickable part */
    const hit = svgTag('path', {
      d: arcBandPath(wing.aStart, wing.aStart + wing.aSpan, 3.2, wing.rMax + 1.6),
      class: 'wedge-hit'
    });
    hit.addEventListener('click', () => { flyToWing(wing.name, 1.2); soloWing(wing.name); });
    group.appendChild(hit);
    svg.appendChild(group);
  });

  /* exhibit dots — small enough to read as a collection, big enough to hit */
  LINKS.forEach((link) => {
    const at = planPoint(link._a, link._r);
    const dot = svgTag('circle', {
      cx: at.x.toFixed(2), cy: at.y.toFixed(2), r: 0.95,
      class: 'dot', fill: link._wing.hex, opacity: 1
    });
    dot.addEventListener('click', (event) => {
      event.stopPropagation();
      selectExhibit(link._i, true);
    });
    link._dot = dot;
    svg.appendChild(dot);
  });

  /* view cone + you-are-here marker, moved by the render loop */
  planRefs.beam = svgTag('path', { class: 'beam', d: 'M 0 0 L 0 0 L 0 0 Z' });
  planRefs.you = svgTag('circle', { class: 'you', cx: 0, cy: 0, r: 1.7 });
  svg.appendChild(planRefs.beam);
  svg.appendChild(planRefs.you);

  dom.planNote.textContent = 'click a wing to walk in';
}

/* Dots fade with the filter. CSS transitions do the easing, and the stagger
   delay is recomputed here so the plan animates in step with the room. */
function syncPlanDots() {
  LINKS.forEach((link) => {
    if (!link._dot) return;
    const rank = state.visible.indexOf(link._i);
    link._dot.style.transitionDelay = (rank >= 0 ? Math.min(rank, 24) * 0.028 : 0) + 's';
    link._dot.setAttribute('opacity', rank >= 0 ? 0.95 : 0.07);
  });
  const shown = plan.wings.filter((wing) => state.wingsOn.has(wing.name)).length;
  dom.planNote.textContent = shown === plan.wings.length
    ? 'click a wing to walk in'
    : shown + ' of ' + plan.wings.length + ' wings lit';
}

function highlightPlan(index) {
  if (planRefs.selected) {
    planRefs.selected.setAttribute('r', 0.95);
    planRefs.selected.removeAttribute('stroke');
    planRefs.selected.removeAttribute('stroke-width');
  }
  const dot = index >= 0 && LINKS[index] ? LINKS[index]._dot : null;
  planRefs.selected = dot || null;
  if (dot) {
    dot.setAttribute('r', 2.1);
    dot.setAttribute('stroke', '#ffffff');
    dot.setAttribute('stroke-width', 0.55);
  }
}

/* Called every frame: a marker for the camera and a triangle for what it is
   looking at. Two attribute writes, no DOM churn. The marker is read from the
   camera itself, so it stays honest however the rig is posed. */
function updatePlanMarker() {
  if (!planRefs.you || state.mode !== 'rotunda') return;
  const worldAngle = Math.atan2(camera.position.x, camera.position.z);
  const worldRadius = Math.hypot(camera.position.x, camera.position.z);
  const here = planPoint(worldAngle, worldRadius);
  planRefs.you.setAttribute('cx', here.x.toFixed(2));
  planRefs.you.setAttribute('cy', here.y.toFixed(2));

  /* view cone: from where you stand, half a field of view either way, out to
     the far wall — enough to see which exhibits you are facing. */
  const half = (CFG.camFov * Math.PI / 180) * 0.9;
  const reach = plan.wallR;
  const towards = Math.atan2(rig.target.x - camera.position.x, rig.target.z - camera.position.z);
  const a = planPoint(towards - half, reach), b = planPoint(towards + half, reach);
  planRefs.beam.setAttribute('d',
    'M ' + here.x.toFixed(2) + ' ' + here.y.toFixed(2) +
    ' L ' + a.x.toFixed(2) + ' ' + a.y.toFixed(2) +
    ' A ' + (reach * planScale).toFixed(2) + ' ' + (reach * planScale).toFixed(2) + ' 0 0 1 ' +
    b.x.toFixed(2) + ' ' + b.y.toFixed(2) + ' Z');
}
