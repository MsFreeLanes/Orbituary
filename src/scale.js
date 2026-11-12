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

  /* windows */
  SILL_H: 0.90,
  WIN_W: 1.20,
  WIN_H: 1.60,
  WIN_HEAD: 2.60,         // top of the glazing
  HALL_WIN_W: 1.80,
  HALL_WIN_H: 2.60,
  HALL_SILL: 0.45,

  /* the plan */
  ROTUNDA_R: 8.00,        // interior radius of the central hall
  SIDE_SETBACK: 2.00,     // axial distance from the rotunda wall to the first side room
  HALL_GAP: 1.50,         // axial gap between the side rooms and the terminus hall

  /* walk */
  WALK_SPEED: 1.45,       // m/s, a museum pace
  RUN_SPEED: 2.60,
  TURN_RATE: 2.2          // rad/s for keyboard turning
};
