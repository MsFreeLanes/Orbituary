/* ── scale ───────────────────────────────────────────────────────────────
   Every dimension in the building, in metres, in one place. A later walk/VR
   pass changes numbers here and nothing else. If a magic number appears in
   another file, it is a bug. */
export const S = {
  /* the visitor */
  EYE_H: 1.65,            // standing eye height, average adult
  EYE_MIN: 1.35,          // seated / child
  EYE_MAX: 1.85,
  IPD: 0.065,             // stereo separation for the XR rig
  BODY_R: 0.28,           // collision radius around the head

  /* openings and circulation */
  DOOR_W: 1.10,           // clear opening, single leaf (0.90 is the legal floor)
  DOOR_BIG: 1.80,         // hall doorways, double leaf
  DOOR_H: 2.15,
  DOOR_BIG_H: 2.60,
  DOOR_DEPTH: 0.90,       // how deep a doorway counts as when walking through it:
                          // wide enough to swallow two wall thicknesses and the
                          // threshold, so the walkable union has no pinch point
  CORRIDOR_W: 2.60,       // two people pass comfortably
  TURN_CIRCLE: 1.50,      // minimum clear floor at every exhibit

  /* exhibits */
  PLINTH_H: 0.95,
  PLINTH_W: 0.62,
  PLAQUE_TILT: 30 * Math.PI / 180,
  EXHIBIT_GAP: 1.70,      // centre-to-centre along a row

  /* shells */
  WALL_T: 0.35,
  CEIL_CORRIDOR: 3.00,
  CEIL_ROOM: 4.20,
  CEIL_HALL: 6.00,
  CEIL_ROTUNDA: 6.50,     // top of the drum; the dome rises above it
  DOME_RISE: 3.20,

  /* the sun's shadow: one map for the whole building, and the only thing
     that throws the window openings onto the floor. it follows the visitor
     instead of covering the plan, because a 2048 map stretched over a 100 m
     plan is 6 cm a texel and window bars at 6 cm a texel are not window
     bars. this half-span is 40 m across — under 2 cm a texel — and still
     reaches the wall outside a room from anywhere inside it. */
  SHADOW_SPAN: 20.00,

  /* the key light is the sun (2026-11-13: the station orbits a star, so the
     light across its hull is sunlight, not moonlight on a lawn). sky.js
     already computes where the real sun is for the region and the hour the
     visitor chose, and the light is hung off that: the real bearing, and the
     real altitude floored to a graze.
     The floor is the orbital part. A station in orbit is above its planet's
     horizon, so the sun it sees does not set behind the local terrain — the
     bearing keeps sweeping, one full turn across the time slider's span,
     instead of stopping at the end of a ground observer's day. The light
     itself is off while the real sun is under the horizon, which is the
     night the museum already runs on: interior lamps only. */
  SUN_GRAZE: 6 * Math.PI / 180,   // the lowest the key light may be aimed from
  SUN_RISE: 12 * Math.PI / 180,   // the altitude at which it is at full strength
  SUN_I: 2.40,                    // full sunlight across the hull
  /* with the sun off there is no cold light coming through the windows any
     more, so the bounce off the station's own fittings has to carry the night
     by itself. 0.72 is where the cellar corridors, the stair hall and the
     rotunda read as well lit as they did with the moon's 0.3 outside them —
     scratch/probe-exposure-night.mjs measures it against the light that used
     to be there. */
  HEMI_NIGHT: 0.72,

  /* Earth, seen from the station (2026-11-13: a station has a planet under
     it). The sky dial is the sky above one of seven regions and the museum
     floats over that region's ground track, so the region's zenith is the
     building's +Y and the planet hangs on the -Y axis whatever the hour: the
     stars swing over the roof and the Earth stays below. When the dial says
     the ground track is Asia, Earth is under Asia.
     The disc is sized by the chain of openings it has to fall through, not by
     how big a disc looks nice: from a Cupola eye at 1.65 m the well stands
     41° off the nadir, the stair hall's ceiling 37°, and the mouth of the
     light well — the last thing in the way, 5.25 m down — 28°. A planet that
     is to overflow the well rather than sit in it has to subtend more than
     that, so it is 210 m in radius at 300 m down: 35° off the nadir. A real
     low orbit is nearer 70°; this is as far as the hull and the viewports
     will stand, since the limb then sits 55° below the horizon line of
     anything looking out, and no window that is not looking down sees it.
     The limb ring keeps its old share of the radius, so it stays as thin a
     line as it was. */
  EARTH_DROP: 300.00,     // the disc's centre below the rotunda floor
  EARTH_R: 210.00,        // its radius
  EARTH_LIMB: 5.00,       // the atmospheric ring standing off the limb

  /* earthshine: the lit planet below is a second window for the interior,
     and it is not allowed a lamp of its own — a thirteenth light would
     recompile every shader in the building the moment it was switched on.
     It borrows the viewports' anchors instead: this is the multiplier they
     reach for when the sun is up over the region, and the altitude band the
     fill fades across on the way into the planet's night side. */
  EARTH_FILL: 2.40,
  EARTH_FILL_DUSK: -15 * Math.PI / 180,   // below this the visible disc is dark
  EARTH_FILL_DAY: 6 * Math.PI / 180,      // above this the fill is at full strength

  /* windows */
  SILL_H: 0.90,
  WIN_W: 1.20,
  WIN_H: 1.60,
  WIN_HEAD: 2.60,         // top of the glazing
  HALL_WIN_W: 1.80,
  HALL_WIN_H: 2.60,
  HALL_SILL: 0.45,

  /* the pressure hull (2026-11-13: the building is a station, not a house).
     The skin is a second wall bolted onto the outside of the outer wall: a
     viewport's reveal passes through both leaves, and the reveal is cut to
     HULL_OUT, so the frame and the skin cannot drift apart.
     There is no cavity behind the plate. The plan interleaves the side rooms
     of neighbouring spokes, and the tightest pair of rooms on two ranges
     stands 1.16 m clear of each other (scratch/hull-clearance.mjs measures
     it); a skin standing off the wall at 30 cm on each side of that gap does
     not fit, so the plate is bonded down flat and the services run inside the
     rooms rather than behind the wall. */
  HULL_T: 0.30,           // the skin's own plate thickness
  HULL_OUT: 0.475,        // room wall centreline → hull skin's outer face:
                          // WALL_T/2 + HULL_T, the skin lying on the wall face
  HULL_BELLY: -0.36,      // the keel. 4 cm above the cellar soffit (-0.40): the
                          // hull's belly and the cellar's ceiling must not be
                          // the same plane or they fight for every pixel
  HULL_CLEAR: 0.55,       // room ceiling → hull roof: the duct run over the rooms
  HULL_DRUM: 8.42,        // the drum's outer skin. The drum wall ends at 8.35,
                          // and 7 mm clear is what stops the two skins z-fighting
  HULL_CUPOLA: 8.72,      // the cupola's shell, one skin clear of the dome
  VIEW_FLANGE: 0.16,      // the hole in the hull is this much wider and taller
                          // than the glazing: the space the pressure frame fills

  /* the lit edge of the skin (2026-11-13: the palette's cyan, and a bloom
     threshold of 0.70). The strip used to be 0.12 wide and stand 0.14 proud,
     which was a size chosen for an emissive that had to clear a 1.30
     threshold — it only had to be bright enough to see, so it was allowed to
     be a bar. At 0.70 the same cross-section is a bar of light three metres
     from the eye, and from inside the Cupola it fogs the whole gallery. Half
     as proud: what reads at eighty metres is the line, not the depth. */
  RIM_W: 0.10,            // across the skin
  RIM_T: 0.05,            // how far it stands proud of it
  RIM_TUBE: 0.045,        // the same edge where it runs as a ring, outside
  RIM_TUBE_TRIM: 0.028,   // ... and where it is seen from inside the room
  RIM_MARK: 0.20,         // the amber marker at each upper corner of an end cap

  /* the Cupola gallery (2026-11-13: the oculus gets a floor under it). The
     well is the room's window and it is in the floor: the sky dial puts the
     ground track's zenith at the building's +Y, so Earth hangs straight
     below and the one opening you look *down* through is the one that shows
     it. The well sits north of the drum's centre on purpose — it shares the
     rotunda floor sheet and the keel with the stair well, and the two holes
     must not meet. */
  CUPOLA_WELL_R: 1.45,    // the glazed well, comfortably inside the oculus ring
  CUPOLA_WELL_Z: 0.80,    // its centre: 0.35 m clear of the stair well's edge
  CUPOLA_RING_R: 4.60,    // the gallery deck's outer edge
  CUPOLA_RAIL_R: 1.62,    // the rail standing at the well's edge
  /* the well does not stay the same size on the way down. A straight shaft
     puts the cellar slab 5.25 m under a Cupola eye, and at 1.45 m that slab
     is the whole view: the planet becomes a coin in a grey plate, which is
     what the first Cupola drawings looked like. So the shaft opens out into a
     light well as it drops through the stair hall's ceiling void, and the
     mouth it arrives at is what frames the planet. The mouth cannot be a full
     circle — the flight lands inside one — so it is a circle with a chord
     across the south, and the lining stops at that chord: the stair comes in
     through the side of the well, which is the only way it can. */
  CUPOLA_LIGHT_R: 2.70,   // the mouth's radius at the cellar slab
  /* half the sector the well's lining leaves out, radians, measured from due
     south — the side the stair comes in from. The lining is a cone from the
     1.45 m tube down to this mouth, and the flight crosses the circle that
     cone sweeps about 3.1 m down, within 31° of south; the wall stops 50°
     short of south so the treads and the handrail posts pass through the gap
     instead of through the wall. The bottom landing then stands inside the
     mouth, on the glazing. */
  CUPOLA_LIGHT_GAP: 0.87,

  /* the plan: a twelve-spoke wheel (2026-11-13 revision) */
  ROTUNDA_R: 8.00,        // interior radius of the central hall
  SPOKE_COUNT: 12,        // ranges radiating off the rotunda
  SPOKE_STEP: 30 * Math.PI / 180,
                          // one range every 30°: twelve spokes, thirty-six slots
  SIDE_SETBACK: 12.00,    // rotunda wall → the near side room. It used to be 2.00,
                          // and at four ranges 90° apart that was fine. At 30° apart
                          // a side room stands 7.3 m off its own spoke axis (half a
                          // corridor plus 6 m of room), and the wedge between spokes
                          // is only ±15°, so the room has to start 20 m out from the
                          // centre or it reaches into the next spoke's corridor.
  SIDE_STAGGER: 9.00,     // the far side room starts this much further along the
                          // spoke than the near one. Two neighbouring spokes then
                          // interleave in the wedge between them instead of
                          // overlapping: on the bisector between two spokes, one
                          // spoke's near room is always passing the other's far
                          // room. With 20 m of setback this leaves 2.0 m between
                          // the two rooms' walls; shorten it and they meet.
  HALL_GAP: 1.50,         // axial gap between the side rooms and the terminus hall

  /* the basement: a grid under the rotunda, one grand stair off its floor */
  FLOOR_GROUND: 0.00,     // the level the ground floor is drawn at
  FLOOR_BASE: -3.60,      // the cellar slab: 3.20 m of clear ceiling plus 0.40 m
                          // of slab, services and the rotunda floor above
  BASE_ROOM_W: 8.00,      // every basement room is the same size: the categories
  BASE_ROOM_D: 8.00,      // down here are the emptiest, so size buys nothing
  CEIL_BASE: 3.20,        // plaster slab over your head, pipes painted the same
  BASE_CORRIDOR_W: 2.20,  // narrower than upstairs: service corridors, not processional
  BASE_STUB: 1.60,        // how far a cellar corridor runs past its last door
  BASE_BAND_0: 9.00,      // axial centre of the first room band, from the stair hall centre
  BASE_BAND_STEP: 9.00,   // band pitch: an 8 m room plus a 1 m wall-to-wall gap
  STAIR_HALL_W: 10.00,    // the hall the stair lands in, and the four cellar doors off it
  STAIR_HALL_D: 8.00,
  STAIR_W: 3.00,          // a grand stair: two people abreast, and a stretcher
  STAIR_RUN: 5.60,        // horizontal run of the flight; 3.60 m down over 5.60 m is 33°
  STAIR_DROP: 3.60,       // what the flight falls through: exactly one storey, so the
                          // slab it lands on is the ground floor slab above
  STAIR_RISER: 0.18,      // a step's rise. 3.60 / 0.18 is twenty steps, and twenty
                          // steps across the 5.60 m run is a 0.28 m tread: twice the
                          // rise plus the tread is 0.64 m, the old rule of thumb for a
                          // flight you can walk down without reaching for the rail
  STAIR_LAND: 1.60,       // flat at each end, so the door is never on the slope
  STAIR_INSET: 1.40,      // how far inside the drum the top of the stair stands

  /* walk */
  WALK_SPEED: 1.45,       // m/s, a museum pace
  RUN_SPEED: 2.60,
  TURN_RATE: 2.2          // rad/s for keyboard turning
};
