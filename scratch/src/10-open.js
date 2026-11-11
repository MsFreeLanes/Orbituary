/* ══════════════════════════════════════════════════════════════════════════
   THE CODE — one IIFE, nineteen numbered sections, read top to bottom:

     01 config      bootstrap guard, config, state, DOM handles
     02 utils       small maths / string helpers
     03 data        the collection itself
     04 layout      floor plan: turns 88 links into 12 wings of tiered arcs
     05 stage       the room: floor, dado, centrepiece, dust, lights
     05b sky        the planetarium overhead: nebula, stars, shooting stars
     06 labels      the atlases (one texture for every piece of text in the room)
     06b halls      the twelve rooms: backdrops, partitions, signs, paths
     07 exhibits    the 88 exhibits as instanced meshes + the panel shader
     08 camera      the orbit rig, cinematic flights, pinch zoom
     09 picking     raycasting, hover, selection, spotlight
     10 transitions fade / stagger when the collection is filtered
     11 interface   chips, search, exhibit panel, favourites, room tone
     11b jukebox    a fly-out deck of original chiptune, synthesised live
     12 catalogue   the 2D view of the same collection
     13 plan view   the clickable SVG floor plan
     14 tour        the guided tour
     15 render loop the render loop, the dirty flag, the stats readout
     16 boot        the order things happen in, and the console API

   Performance contract, so the behaviour is legible rather than surprising:
     · every plaque, frame, plinth and floor light is an InstancedMesh — the
       88 exhibits cost four draw calls, not 352, and the twelve halls cost six.
     · all text in the room comes from three canvas atlases (plaques, banners,
       hall signs), so there are three texture binds instead of 112.
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
  columnHeight: 15,    // the piers between halls

  /* the room */
  wallPad:      9,     // wall stands this far behind the outermost row
  floorPad:     12,
  dadoHeight:   7.2,   // the wall rises this far and stops: above it is sky
  beamHeight:   58,    // how far that shaft climbs up into the stars
  fogColor:     0x07070e,
  fogDensity:   0.0125,
  dustCount:    1300,

  /* the planetarium overhead */
  skyPad:       26,    // the sky sphere stands this far beyond the plaza edge
  skyLift:      10,    // and its equator sits this high
  skySpin:      0.0035,// radians a second: the whole dome turns, slowly
  starCount:    2200,  // bright stars, drawn as points so they can twinkle
  faintStars:   1800,  // the deep field behind them
  shootingStars: 6,
  gridMeridians: 12,
  gridParallels: 4,

  /* twelve themed halls instead of one open ring */
  hallTile:     { w: 512, h: 300 },
  hallCols:     4,
  hallRows:     3,     // 12 tiles — one emblem per wing
  signSize:     { w: 9.6, h: 5.6 },  // the wing's name plate, fixed proportions
  signLift:     0.9,   // its top edge sits this far below the coping
  washClear:    2.4,   // each backdrop stops this far above its own banner
  washInset:    2.4,   // it stands this far in front of the wall line
  dividerHeight: 11,   // the walls between halls
  dividerThickness: 0.5,
  dividerIn:    1.2,   // they begin this far outside the innermost row
  spokeInner:   13.5,  // the light path into a hall starts here…
  spokeWidth:   4.8,   // …and is never wider than this

  /* camera */
  camFov:       58,
  camRadius:    17.5,  // opening dolly distance once the intro flight lands
  camPhi:       1.22,  // low enough that the sky is in the frame
  camPhiMin:    0.18,  // how far down the tilt can go
  camPhiMax:    1.47,  // …and how near straight up
  camMin:       6,
  exhibitRange: 14.5,  // how far the camera stands back from a single plaque
  exhibitSwing: 0.12,  // and how far around the circle, so the row reads in depth
  exhibitEyeLift: 3.6, // camera height above the plaque centre
  wingEyeY:     9.5,   // eye height when a whole wing is framed
  wingSwing:    0.75,  // how far around from the hall's centre line to stand
  camTargetY:   6.2,
  introFrom:    { radius: 96, phi: 0.42, angle: -0.7 },

  /* atlases */
  tilePx:       320,
  atlasCols:    10,
  atlasRows:    9,     // 90 tiles — room for 88 exhibits and two spares
  bannerCols:   4,
  bannerRows:   3,
  bannerTile:   { w: 640, h: 160 },

  /* the jukebox — see section 11b */
  jukeVolume:   0.55,   // the volume slider's starting position, 0…1
  jukeLook:     0.14,   // seconds of music queued ahead of the audio clock
  jukeTick:     25,     // how often the sequencer wakes up, in ms
  jukeVu:       14,     // bars in the level meter

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
  juke: $('btn-juke'), sound: $('btn-sound'), reset: $('btn-reset'), help: $('btn-help'),
  helpClose: $('help-close'), stats: $('st-fps')
};
/* The jukebox's parts (section 11b): a deck, a request column, a transport. */
dom.juke = {
  root:   $('juke'),
  list:   $('juke-list'),
  title:  $('juke-title'),
  tag:    $('juke-tag'),
  side:   $('juke-side'),
  bpm:    $('juke-bpm'),
  vu:     $('juke-vu'),
  play:   $('juke-play'),
  prev:   $('juke-prev'),
  next:   $('juke-next'),
  vol:    $('juke-vol'),
  close:  $('juke-close')
};
dom.stats = $('stats');
dom.statValues = {
  fps: $('st-fps'), calls: $('st-calls'), tris: $('st-tris'), vis: $('st-vis')
};
