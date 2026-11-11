/* ══════════════════════════════════════════════════════════════════════════
   THE CODE — one IIFE, fifteen numbered sections, read top to bottom:

     01 open        bootstrap guard, config, state, DOM handles
     02 utils       small maths / string helpers
     03 data        the collection itself
     04 layout      floor plan: turns 88 links into 12 wings of tiered arcs
     05 stage       the room: floor, wall, centrepiece, dust, lights
     06 plaques     the atlas (one texture for every piece of text in the room)
     07 exhibits    the 88 exhibits as instanced meshes + the panel shader
     08 camera      the orbit rig, cinematic flights, pinch zoom
     09 picking     raycasting, hover, selection, spotlight
     10 motion     fade / stagger transitions
     11 ui          chips, search, exhibit panel, favourites
     12 catalogue  the 2D view of the same collection
     13 plan        the clickable SVG floor plan
     14 tour        the guided tour
     15 loop/boot  the render loop, audio, boot sequence

   Performance contract, so the behaviour is legible rather than surprising:
     · every plaque, frame, plinth and floor light is an InstancedMesh — the
       88 exhibits cost four draw calls, not 352.
     · all text in the room comes from ONE canvas atlas (plus one for the wing
       banners), so there is one texture bind instead of 100.
     · the renderer sleeps when the room is still: a dirty flag drives
       rendering, an idle heartbeat keeps the centrepiece turning at 12 fps,
       and anything that moves wakes it to full rate.
     · device pixel ratio is capped at 2 and there are no shadow maps — the
       pools of light under each exhibit are additive discs, which are
       indistinguishable at this scale and cost nothing.
     · nothing is fetched at run time except three.js itself; the collection is
       bundled below, and the only typed input (search) is escaped before it
       touches the DOM.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ── 01 · config ─────────────────────────────────────────────────────────
   Every number that shapes the room lives here. The layout solver reads these
   and derives the radii, so changing the scale of the museum is a one-line
   edit rather than a hunt through the file. */
const CFG = {
  /* floor plan */
  pitch:        3.95,  // arc length each exhibit gets along its arc (world units)
  gapItems:     0.95,  // breathing room between wings, expressed in exhibits
  rowGap:       6.5,   // minimum radial distance between two rows of one wing
  maxRows:      3,     // a wing never stacks higher than three rows
  perRowCap:    7,     // ...nor wider than seven exhibits
  yBase:        4.4,   // plaque height of the innermost row
  ySlope:       0.34,  // plaques rise with radius: stadium seating, no occlusion

  /* furniture */
  plaque:       { w: 2.9, h: 2.9 },
  frame:        { w: 3.14, h: 3.16, d: 0.18 },
  plinthW:      2.0,
  puckRadius:   2.2,
  banner:       { w: 8.2, h: 2.05 },
  bannerLift:   2.6,   // banners float this far above their wing's outer row
  columnLift:   3.4,   // wall columns stand this far outside the outer row
  columnHeight: 20,

  /* the room */
  wallPad:      9,     // wall stands this far behind the outermost row
  floorPad:     12,
  ceilingY:     25,
  fogColor:     0x07070e,
  fogDensity:   0.0125,
  dustCount:    1300,

  /* camera */
  camFov:       56,
  camRadius:    17.5,  // opening dolly distance once the intro flight lands
  camPhi:       1.10,
  camMin:       6,
  exhibitRange: 14.5,  // how far the camera stands back from a single plaque
  exhibitSwing: 0.12,  // and how far around the circle, so the row reads in depth
  exhibitEyeLift: 3.6, // camera height above the plaque centre
  wingEyeY:     9.5,   // eye height when a whole wing is framed
  wingSwing:    0.75,  // how far around from the hall's centre line to stand
  camTargetY:   5.6,
  introFrom:    { radius: 96, phi: 0.42, angle: -0.7 },

  /* atlases */
  tilePx:       320,
  atlasCols:    10,
  atlasRows:    9,     // 90 tiles — room for 88 exhibits and two spares
  bannerCols:   4,
  bannerRows:   3,
  bannerTile:   { w: 640, h: 160 },

  /* feel */
  flySeconds:   1.15,
  tourSeconds:  3.0,
  heartbeat:    5,     // frames between renders while the room is idle
  maxDpr:       2
};

const TAU = Math.PI * 2;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Single mutable state bag. Anything the room remembers lives here, so it is
   obvious what a function may read and what it may change. */
const state = {
  mode: 'rotunda',            // 'rotunda' | 'catalogue'
  webgl: true,
  wingsOn: new Set(),         // wings currently lit (filter)
  query: '',                  // search text
  favs: new Set(),            // favourite urls (localStorage)
  visible: [],                // indices passing the current filter, in plan order
  visibleSet: new Set(),
  selected: -1,
  hovered: -1,
  tour: false,
  tourStep: 0,
  tourClock: 0,
  dirty: true,                // render-on-demand flag
  busy: false,                // something is animating → full frame rate
  sound: false,
  stats: false,
  favouritesOnly: false,      // M key: narrow the room to saved exhibits
  results: [],                // search hits shown under the search bar
  cursor: -1                  // keyboard cursor inside those hits
};

/* DOM handles, resolved once. */
const $ = (id) => document.getElementById(id);
const dom = {
  stage:      $('stage'),
  bloom:      $('bloom'),
  curtain:    $('curtain'),
  curtainBar: $('curtain-bar'),
  curtainStep:$('curtain-step'),
  curtainTag: $('curtain-tag'),
  search:     $('search'),
  searchClear:$('search-clear'),
  results:    $('results'),
  chips:      $('chips'),
  tip:        $('tip'),
  exhibit:    $('exhibit'),
  catalogue:  $('catalogue'),
  plan:       $('plan'),          // the framed map in the corner
  planSvg:    $('plan-svg'),      // the SVG drawn inside it
  planNote:   $('plan-note'),
  stats:      $('stats'),
  help:       $('help'),
  helpLegend: $('help-legend'),
  toast:      $('toast'),
  caption:    $('caption'),
  a11y:       $('a11y-status'),
  meta:       $('brand-meta')
};
/* The exhibit label's fields, looked up once — the panel is written to on
   every selection, so the handles are worth naming. */
dom.panel = {
  root:   dom.exhibit,
  wing:   $('ex-wing-name'),
  no:     $('ex-no'),
  title:  $('ex-title'),
  close:  $('ex-close'),
  desc:   $('ex-desc'),
  factWing:   $('f-wing'),
  factDomain: $('f-domain'),
  url:    $('ex-url'),
  visit:  $('ex-visit'),
  star:   $('ex-star'),
  prev:   $('ex-prev'),
  count:  $('ex-count'),
  next:   $('ex-next')
};
dom.buttons = {
  tour: $('btn-tour'), random: $('btn-random'), catalogue: $('btn-catalogue'),
  sound: $('btn-sound'), reset: $('btn-reset'), help: $('btn-help'),
  helpClose: $('help-close'), stats: $('st-fps')
};
dom.stats = $('stats');
dom.statValues = {
  fps: $('st-fps'), calls: $('st-calls'), tris: $('st-tris'), vis: $('st-vis')
};
