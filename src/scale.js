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

  /* the moon's shadow: one map for the whole building, and the only thing
     that throws the window openings onto the floor. it follows the visitor
     instead of covering the plan, because a 2048 map stretched over a 100 m
     plan is 6 cm a texel and window bars at 6 cm a texel are not window
     bars. this half-span is 40 m across — under 2 cm a texel — and still
     reaches the wall outside a room from anywhere inside it. */
  SHADOW_SPAN: 20.00,

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
