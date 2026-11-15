---
tags: [museum, project, bugs, review]
updated: 2026-11-15
head: a3f971f
state: read-only audit — no code was changed to produce this file
remote: https://github.com/MsFreeLanes/Orbituary
---

# MASTER BUGS — every defect found, ranked, with how each was found

Nothing in this document has been fixed. No source file was edited to write it.
Eight read-only audits ran over the source (about 9,800 lines across 19 files) and
over the test layer, plus the defect queue carried in `REVIEW-BRIEF.md` and the open
items in `NIGHT-LOG.md`. This is the consolidated list: 68 defects and 30 problems
with the checks. Finding IDs are stable and were assigned as findings landed, so
they are not contiguous within a tier.

## How to spend a paid model's budget on this file

If you only have one model's worth of usage, read **Tier 1** (7 items) and
**Tier 4** (the test layer) and stop. Tier 1 is where a visitor is hurt and a
fix is cheap. Tier 4 matters because several checks are lying, and a lying check
will tell a reviewer their fix worked when it did not.

- **Tier 1 — BREAKS.** A visitor falls, gets stuck, is trapped, or is shown
  nothing. Fix in this order.
- **Tier 2 — visibly wrong.** Wrong light, wrong sky, wrong geometry, pop-in.
- **Tier 3 — fragile.** Correct today, breaks on the next edit; duplicated rules;
  dead code that looks alive.
- **Tier 4 — the test layer.** Checks and probes that cannot fail, or that assert
  less than their name claims.
- **Tier 5 — open work and owner decisions.** Not defects; unfinished intent.

**Confidence labels.** *seen* = confirmed against the running build or by
computing from the source. *reasoned* = read from the code and followed through;
not executed. *suspected* = a smell worth a look, not established. Every entry
carries one. Do not let a fix be written for a *reasoned* item without first
making it *seen* — that is how a wrong "fix" breaks a correct thing.

## Method — how this list was built, and what it can't see

1. **Read the code in file clusters**, one auditor per cluster, each given the
   project's invariants first so they report violations rather than taste. The
   clusters: `plan.js`+`scale.js`; `building.js` 1–1100; `building.js` 1100–2145
   + `render.js`; `rig.js`+`render.js`; `sky.js`+`lighting.js`+`events.js`;
   `hud.js`+`signage.js`+`data.js`+`main.js`+`identity.js`+`audio.js`+`build.mjs`;
   `props.js`+`atmosphere.js`+`tube.js`.
2. **Confirm with the existing harness only.** No new scripts were written.
   Confirmations came from `scratch/cdp.mjs` (a real headless Chrome driven over
   the DevTools Protocol), the fifteen `check-*.mjs` scripts, the existing
   `probe-*.mjs`, `dump-at.mjs` (a ray into the geometry), and `node
   --input-type=module -e` computing directly from `src/plan.js`.
3. **Cross-check.** Two auditors independently found the doorway-exemption axis
   error and the walkable-hole-under-the-lift, from different files. Where two
   independent reads agree, confidence is high.
4. **Then audit the measuring instruments**, because three probes in this
   project have been wrong before, and a wrong probe both hides real bugs and
   invents fake ones.

**What this method cannot see.** Feel — whether the walk is too slow, the lift
ride too long, the cellar too oppressive. Anything a human notices incidentally
while wandering. Frame rate on real hardware (headless Chrome renders through
SwiftShader; every fps number in this repo is the harness, not the machine).
And anything that needs a probe that does not exist yet — several Tier 2 items
are *reasoned* for exactly that reason.

---

## Tier 1 — BREAKS

**B01 · `hud.js:509` · every exhibit plaque opens with a blank title** — *seen*
The plaque reads the field `link.t`; the data table stores names under `n`, and
nothing anywhere sets `.t`. Confirmed twice: the auditor drove the live page
(`showPlaque(LINKS[0])` → `.plaque-title` is `""`, `link.t === undefined`), and I
read `showPlaque` myself — `hud.js:506-516` sets the kicker from the room code and
category, the title from `link.t`, the cost from `link.cost`, the body from
`link.d` and the note from the URL, so a plaque shows everything about an exhibit
**except its name**. `main.js:270` toasts "opened undefined" for the same reason.
Grep over `src/` finds exactly two reads of `.t` and no write of it; the only `t`
fields in the codebase are the tour and lift timers.
This is the single most visible defect in the museum: the one text a visitor comes
to read is missing. No check reads the plaque, so `check-v2` is green.
*Regression net: none. A plaque probe (aim the pick ray at a plinth, read
`.plaque-title`) is the missing test.*

**B02 · `building.js:849` · every doorway in the building is plated over with
solid plaster** — *reasoned, from a precise code read*
The corridor's side wall is built with the room mouths as **openings**
(`addWall(..., { openings: left })`, `building.js:853-854`), so there is a hole the
room's full width and the corridor's full height. Then `lined()` (`:842-851`) fills
that same span with a 2 cm plaster panel — `boxUV(0.02, h, op.w, 2.4)` at
`x = side*(half - t/2 - 0.012)`, where `op.w` is `r.w`, the room's **whole width**,
and `h` the corridor's whole height. There is no door cutout. The panel stands
about 1 cm inside the corridor, proud of the wall plane, and the room's own wall
with its door hole is behind it. So from the range you see plaster where the mouth
is, the door plate is buried, and because the panel is batched geometry it was
never registered as a blocker — a visitor walks into what looks like a wall and
arrives in the room. The coplanarity this was written to avoid (the hairline fixed
in `df1dea8`) is real, so a fix must keep the shell short of the mouth **and** size
the lining to the mouth minus the door opening.
*Correction to my own evidence, kept in the open:* this was first labelled *seen*
on the strength of `dump-at.mjs science 0 1.6`. That was wrong. `dump-at` fires
along `room.n` from inside the room, which is the **window** wall and not the door,
and it builds its frame at `S.FLOOR_BASE` for every room (T24), so the ray height
was wrong as well. `plate-creative-writing.png` shows a blank plaster wall where the
shot script aims at a cellar door, which is consistent with B02 but is not proof.
**The probe that would settle it: a ray from the corridor centreline at eye height
1.65 along the door axis — expecting the far wall at `room.d`, and finding plaster
at the mouth.**

**B03 · `rig.js:362-366` · the stair well is walkable air** — *seen*
`canStand` falls back to `inside(plan.walkable, …, 'ground')`, and that union is
a full disc of radius 8. The hole cut out of the rotunda floor for the stair and
lift (x ±1.5, z −6.6…−1.0) is never subtracted from it. The flight latch only
engages within 0.35 m of the flight's ends and only when the storey matches, so
crossing the well sideways, or stepping in at the foot of the flight, leaves the
visitor standing at eye height 1.65 over a 3.6 m drop — and through the 0.9 m
parapet at x ±1.675. `probe-lift-diag.mjs` prints `stairMouth: false` for a
point 0.4 m inside the hole. The tour graph makes it worse: the leg
`rotunda → stair:top` runs the whole length of the well at level 0, so a guided
tour walks across the hole on air (`rig.js:277-297`).
*Regression net: `check-collision.mjs`'s tour walk asserts `inside(…, 0.3,
storey)`, which the disc always satisfies — it cannot see this.*

**B04 · `building.js:1394` + `rig.js:224-227` · the lift shaft is a hole you can
stand in** — *seen*
All 28 shaft circles sit on the west partition line (x 0.43, z −6.30…−1.10).
Nothing blocks the shaft's east or south edge, and the well's east wall geometry
stops at z −4.0. `rig.blocked(1.2, -2.6, 'ground')` is false and the point is
inside the walkable union. `REVIEW-BRIEF.md` D7 said the circles were the only
thing between a visitor and a 3.6 m hole; they cover one side of four. Re-run
myself at 06:3x: `node scratch/probe-lift-diag.mjs` reports `shaftBlockers: 28` all
at `shaftX: 0.43`, and `stairMouth: false` for the well — the only side of the
shaft the rig can see is the one facing the partition.

**B05 · `rig.js:577-581` + `301-313` · the lift can fail to deliver you** —
*reasoned, high confidence*
`flightT` tests `stair.w` — the 3.00 m **well**, not the 1.84 m **flight** — so
the lift's own dock at (0.95, −6.6) counts as being on the flight. Standing at
the cabin door latches `onFlight`, and on the arrival frame line 579 overwrites
the ride's storey: the visitor ends at level −0.51 inside the shaft, storey
`ground`, HUD naming "The Stair", and walking out returns them to the rotunda.
`check-lift.mjs` passes because it starts every ride at the cabin centre
(−5.8), where the latch never engages.

**B06 · `rig.js:165` (with `building.js:1429`) · calling the lift from the cellar
slams the cabin 3.6 m in one frame** — *seen*
`callLift` starts from `lift.bottom` rather than the cabin's live y, and the
auto-park has already parked the cabin at the top dock. Measured: cabin at 0.00
before the call, −3.60 after the first update frame. `check-lift.mjs` asserts the
arrival height and never the start height.

**B07 · `main.js:154-157` · after a guided tour the closing brochure cannot be
used** — *reasoned*
`showBrochure('closing')` never calls `freeCursor()`, unlike the Tab and G paths.
The pointer stays locked, the cursor is hidden, and a click goes to the canvas
(which re-enters the museum) instead of the ×, KEEP WALKING, or any link. The
first Escape press is consumed by the browser to release pointer lock, so the
panel looks dead. Related: `main.js:299-306` calls `preventDefault()` on Tab in a
global handler, so once through the door **Tab never moves focus** — the time
slider, the always-night checkbox, the brochure's × and WALK IN are mouse-only.

---

## Tier 2 — visibly wrong

**B08 · `rig.js:189-191` vs `plan.js:998` · the doorway exemption box is
rotated the wrong way on every diagonal door** — *seen, found twice independently*
`inDoorway` uses `lx = dx·cos + dz·sin`, `lz = −dx·sin + dz·cos` — the transpose
of the plan's own axes (`lx = dx·ct − dz·st`, `lz = dx·st + dz·ct`). The two
agree only when sin(angle) is 0 or ±1, so all eight spokes at ±30°/±60° are off
by twice their bearing, up to 120°. Measured over all 51 door rects: **16
disagree**. Consequences: furniture beside a doorway on a diagonal spoke becomes
walk-through, and a circle genuinely inside a door is kept. `check-collision`'s
"doors pinched" test samples only door centres, which are inside both boxes, so
it cannot see this.

**B09 · `plan.js:700` · all six Observatory pedestals stand inside a 2.6 m
spoke corridor** — *seen*
At r 3.9 the widest gap between spokes is 1.14 m from a spoke centreline, less
than the corridor's half-width of 1.3 m, so the "between the spokes" reasoning
was wrong: at that radius the twelve strips overlap everywhere. `probe-plinth-
corridor.mjs` puts all six inside a corridor rect; `probe-deck-ring.mjs` measures
0.93–1.14 m off the nearest spoke, i.e. 0.16–0.37 m inside it. The comment in
`plan.js` claiming "1.04 m … never stands in the walking line" is wrong for four
of six. **This corrects a claim I made in commit `14d9a3c` and in `NIGHT-LOG.md`:
the re-bearing did not clear the pedestals from the corridors, and the
"centrelines blocked: 0" number that justified it only ever tested the exact
centreline.**

**B10 · `plan.js:817` · the rotunda's six pedestals are never tested against
circulation at all** — *seen*
The repair pass iterates `rooms`, which excludes `plan.rotunda`. Five sit 1.29 m
across a spoke centreline (0.01 m inside the rect), the r-4.2 one 1.09 m
(0.21 m inside). No existing check covers it.

**B11 · `building.js:2026` · stand in the rotunda and all twelve ranges light up
and never go off** — *seen*
The grace distance for an already-lit wing is REACH+LEAVE = 9 m, but every
range's shell begins 7.6 m from the drum centre, so once the facing cone lights a
range the distance test holds it forever. Measured by hiding all wings and
stepping the cull at (0, 0.8) turning 30° at a time: visible count ran 4, 6, 8,
10, 12 and stayed at 12 through 40 idle frames. This defeats the cull in the one
place it was written for.

**B12 · `building.js:2028` + `render.js:178` · wings vanish when you look down at
a label** — *seen*
The look-ahead point follows the camera's pitched direction, so 7 m ahead
becomes 0.85 m of ground at maximum pitch, and that test gets no grace band. At
(11, −2) the same standing point gave 12 wings lit at pitch 0 and 5 at pitch
−0.6. `check-pop.mjs` and `probe-cull.mjs` both pass a flat forward vector, so
neither can see it.

**B13 · `building.js:2103` · the Observatory counts as part of the first
spoke** — *seen*
`wingOf` has no `'Centre'` key, so the fallback `|| wings[0]` registers the
cupola rect (0.9, 2.2, 3.2×3.2) on range 0. `wings[0].rects.length` is 5 where
every other wing has 4, so range 0 stays lit whichever way you face.

**B14 · `building.js:1988` · the hub, and with it the whole lift shaft,
disappears down a straight corridor you are looking along** — *seen*
The hub is kept within 20 m of the centre and the stair hall within 9 m of the
well, while the cellar arms run 32.6 m and the ground ranges 36.5–38.5 m
straight. Hub hidden at (0, −16) cellar and at (0, −25) and (0, −30) ground;
visible at (0, −12).

**B15 · `building.js:1354`, `:1429` · the lift's cellar dock stands inside the
south cellar arm** — *seen*
The shaft spans x 0.40–1.50, z −6.60…−1.00 while the Basement South corridor is
drawn from z −4 outward at x ±1.1. The parked cabin (x 0.47–1.43, z −6.6…−5.0)
blocks the corridor's east half and pokes 0.16 m through its east wall; the
glazed partition cuts the corridor for 2.6 m; the corridor's ceiling sheet
(y −0.6) crosses the shaft. Also: the arrival point is the cabin centre
(0.95, −5.80), but the walkable strip there only reaches |x| ≤ 0.82 once the body
radius is applied — the lift hands you over 0.13 m outside where the rig says you
can stand.

**B16 · `building.js:935` + `lighting.js:220` · the rotunda's lights are not at
its lamps** — *reasoned*
Twelve sconces are placed at 15°, 45°, 75°…; the light pool still carries the
pre-12-spoke ring of eight at 22.5°, 67.5°… — 0.96 m off the arc at r 7.34, with
four fixtures unlit. The comment says "matching the fixtures in building.js".
Separately, the sconce box itself floats 8.5 cm off the pilaster it is fixed to.

**B17 · `lighting.js:175-180` · the stair hall is double-lit and the flickering
light hangs inside the glazed well** — *seen*
The pool's flicker anchor is at (0, 1.4), y −1.02; the fitting and its own static
30 cd light hang at (3.30, 1.10), y −1.72 — 3.3 m away and 0.7 m lower. (0, 1.4)
is 0.6 m from the well axis, inside `CUPOLA_WELL_R` 1.45, the spot `building.js`
says to avoid. The hall gets 39 cd, the tube's glow dims on a phase thrown by a
light 3.3 m off it, and the static light never dims. `check-lights.mjs` passes
because it only measures height above the floor.

**B18 · `sky.js:596` · the Moon's largest near-side mare is painted on the wrong
half of the disc** — *reasoned*
`MARIA[0] = [34.3, 32.8, 30]` puts Mare Imbrium at 34.3°**E**; it is at 32.8°N,
34.1°**W**. The flipped sign stacks it on Tranquillitatis and Vaporum and leaves
the western near side missing its biggest dark patch. Every other mare and both
ray craters match published coordinates, which is why this one reads as
"almost right".

**B19 · `sky.js:133-144` · the Milky Way's bulge is painted 32.6° away from the
galactic centre** — *seen*
The bulge centre is built in the vault frame while the per-texel direction is
textbook equatorial, so the dot product measures the wrong axis: the effective
bulge lands at RA 276.5°, Dec −60.9° instead of 266.4°, −28.9°. The band itself
is right.

**B20 · `main.js:341`, `:424` · ambient events fire in rooms you cannot see, on
the other storey** — *seen*
The scheduler's pool is every room in the plan (51), not the culled set and not
the visitor's storey. A "peek" can light a cellar puck behind a slab while you
stand in the Cupola, and the toast still names the room. This is the open item
"gate effects to what is visible", now with a measured cause.

**B21 · `main.js:79-83` + `:365-371` · the hour slider does not set the hour the
card names** — *reasoned*
`setTime` anchors the offset to the browser's minutes-of-day while the display
prints the instant in the selected zone's timezone. Pick Asia/Tokyo, drag to
18:00: the card reads about 08:00, and the sun, the terminator and the key light
all follow 08:00.

**B22 · `building.js:741` · every terminus hall's door plate is clipped by the
corridor ceiling** — *reasoned*
`signY = door.h + 0.32` is 2.92 for a hall (DOOR_BIG_H 2.60) and the plate is
0.36 tall, so it spans 2.74–3.10 while the corridor ceiling is at 3.00. The
guard tests `room.ceil` (6.00 for a hall) instead of the corridor's.

**B23 · `building.js:371` · tray ceilings z-fight around the recess in eight
rooms** — *reasoned*
The recess panel lies at exactly `h − 0.32` and the rim boxes' undersides are at
exactly `h − 0.32`, so two downward faces coincide over a 3 cm band, welded into
two different meshes. Same family as the hairline bug fixed in `df1dea8`.

**B24 · `building.js:706` · 17.5 cm of wall sticks into the corridor either side
of every doorway** — *reasoned*
Side walls run `from: -t, to: room.d + t` rather than −t/2 … d+t/2, overshooting
the door wall's outer face by t/2; at the window end their ends land inside the
hull plate.

**B25 · `src/shell.html:66-68` · the ground-track panel is unreadable while you
walk** — *reasoned*
`.skybox { opacity: .34 }` with `:hover`/`.sky-open` as the only route to full
opacity — and the pointer is locked while walking, so it cannot be hovered. The
9–10 px labels, the seven zone chips and the clock are all at a third contrast
until you press G.

**B26 · `rig.js:234-256` · `settle()` leaves you half inside the thing it pushed
you out of, and gives up silently** — *reasoned*
It moves the point to `b.r + 0.03` with no body radius, tests the floor at
`BODY_R*0.5` (0.14 m from a wall), never re-tests the other circles, and if all
four tries are off-floor returns the original point — still inside the furniture,
no report. `probe-stuck.mjs` cannot catch a regression because it never calls
`settle` (see T06).

**B27 · `building.js:1871-1905` + `rig.js:209-227` · welded fittings have no
collision at all** — *seen*
`plan.obstacles` is written only by `props.js`, so the blocker list is plinth,
prop and lift-shaft only. The four Cupola benches, the two sign posts, the Cupola
rail (r 1.62, rails at y 0.52/1.02 and 12 posts), the well parapets and the lift
door frame are all walk-through.

**B28 · `rig.js:539-542` · nothing detects a stuck visitor, and arrival is
claimed whatever happens** — *reasoned*
A tour is purely time-based; `onArrive` toasts "arrived: X" regardless of the
final position. If `settle` pins the visitor they walk in place for the whole
duration and then the museum announces success.

**B29 · `rig.js:381-388` · WASD and arrows move you while the ticket or brochure
is open** — *reasoned*
`main.js:295` deliberately refuses every other key while a panel is showing, but
the rig's own keydown listener has no such gate.

**B30 · `plan.js:37` · the plan says fifteen cellar rooms and shelves fourteen** —
*seen*
`BASEMENT_SLOTS = 15` never binds: all fifteen emptiest categories hold zero
links, the zero-count rule re-adds exactly the names the slice picked, and the
pin then drops Astronomy. The sixteenth-emptiest (Business, 1 link) is not
shelved. The constant and the header comment both say fifteen.

**B58 · `props.js:1010` · a 3.1 m ladder stands in the mouth of a rotunda arch** —
*seen*
`furnishRotunda` puts it at local (R−1.4, −3.2) = r 7.34, which is 0.26 m inside
where the corridor begins and 0.53 m off a range centreline; its r 0.5 circle
leaves that centreline clear by 3 cm. Arches are not `kind: 'door'` rects, so the
doorway exemption never applies. `check-props.mjs:44` skips every wall and doorway
test for `kind 'rotunda'`, and `probe-corridor-props.mjs` only walks corridor
rects, which start at r 8 — neither covers the ring where the arches are.

**B59 · `props.js:898` · the storeroom stool is solid nowhere: you walk through it
in all fourteen cellar rooms** — *seen*
The bench's blocker line stops at z 6.92 while the stool sits at z 7.16, leaving
0.21 m of clear space around it. Measured headless over all 14 rooms.
`check-collision.mjs` prints "furniture inert where it stands: 0", which cannot
see a prop that was never given a circle at all.

**B60 · `props.js:880` · the flat file's pulled-out drawer blocks 0.26 m less than
it occupies** — *seen*
Circles sit at z 7.38 with r 0.42, covering z ≥ 6.96, while the open drawer's
front face is at z 6.70. The drawer's 0.34 m pull-out is applied to the geometry
and never to the footprint.

**B61 · `props.js:668` · the AI gallery's two cold rim strips are invisible —
they are inside the wall** — *seen*
The box spans x 3.885–3.935 and the wall occupies 3.825–4.175, so the strip is
6 cm *into* the plaster rather than the 9 cm off it that the comment claims: `hw`
is measured to the wall's centre line, not its inner face. `check-props.mjs:45`
tests ±w/2 with a 0.02 tolerance, so anything buried inside the 0.175 m wall
thickness passes.

**B62 · `props.js:939` · all fourteen cellar tubes strike together, on the last
room's phase, and none of them matches the light in that room** — *seen*
`matCache` (props.js:64) keys by material name only, so `K.mat('coldStrip')` is
one material for the whole building; fourteen animators overwrite its
`emissiveIntensity` every frame using their own `Math.sin`, not `tube.js` and not
the room's candela envelope (`lighting.js:438`). The AI room's rim strips inherit
the cellar's flicker. The rod also pierces the room's own pendant stem — both at
x 0, z d/2.

**B63 · `props.js:776` · the oscilloscope and the terminal screen pulse in
lockstep across two rooms** — *reasoned*
Both builders write `emissiveIntensity` on the shared `screenGreen` material every
frame, so each room's value lands on the other's props. Same root cause as B35:
materials are cached by name and mutated per room. See also B45.

---

## Tier 3 — fragile: correct today, breaks on the next edit

**B31 · `plan.js:934` · the plinth-repair safety net can never fire** — *seen*
The trigger asks whether a plinth sits within 0.55 m of a corridor edge, but
`layoutPlinths` puts every row at v ≥ 2.2 m from the entry wall, which is exactly
the corridor boundary + 2.2 m. Measured: the closest non-cupola plinth is 2.20 m
**outside** the nearest corridor edge; zero triggers, ever. It also skips
`kind === 'cupola'`, which is why B09 was never repaired. `plan.plinthRepairs`
prints "nothing" because the code is unreachable, not because the building is
clean.

**B32 · `plan.js:734` · the Observatory's disc shape is honoured by the rig and
not by the plan** — *reasoned*
`deck.shape = 'disc'` is read by `rig.roomAt` but not by `plan.inside()`, so every
plan-side test still sees a 9.2 m square reaching 6.5 m at its corners — about
1.9 m of floor the builder never draws. Harmless today only because the square
sits inside the rotunda disc.

**B33 · `plan.js:577` · the spare-slot refill path is dead, and would mis-size a
room if it ran** — *seen that it is dead, reasoned about the rest*
No allocated category has zero links, so `spare` is always empty. If one emptied,
`kindOf()` could return 'hall' for a side slot and give it 12 m of depth in a
band that fits 6, reaching into the neighbouring spoke's corridor. It also ignores
the "terminus slot is a hall" rule and DOOR_BIG.

**B34 · `plan.js:420` · the guard on the wanted plinth can never be false** —
*seen*
`!PURPOSE_CATS.has(room.cat)` never excludes anything, because `floorOf()` returns
'ground' for the four purpose rooms.

**B35 · `plan.js:946` + `scale.js` · two different minimum-clearance rules, one of
them never used** — *seen*
The repair pass uses a bare 1.25 m while `TURN_CIRCLE` (1.50 m, "the minimum
clear floor at every exhibit") is referenced by no file at all. Unused scale
constants: `EYE_MIN`, `EYE_MAX`, `IPD`, `TURN_CIRCLE`, `PLAQUE_TILT`, `WIN_HEAD`.

**B36 · `plan.js:332` · the "clearance under the window head" rule is a number,
not a rule** — *seen*
`vEnd` uses a bare 1.6 (that is `WIN_H`, not the head) and `S.WIN_HEAD` (2.60) is
read by nothing.

**B37 · metres living outside `scale.js`** — *seen*
`plan.js`: cupola w 6.4, `+ 1.0`, ceil 3.60, ring r 3.9, entry offset 0.9;
rotunda plinth radii 4.2/5.0; repair pads 0.55/0.35/0.6; layout pads 2.6/2.2/1.6/
0.4; window offsets 1.6/1.0. `building.js`: door plate 1.44×0.36 and its +0.32;
label 0.44×0.22 at 0.66; window frame 0.06/0.10/0.14/0.09; trophy stands ±1.85
and z 3.4; mouth lining 0.012/0.02; downlight pitch 3.6 and first lamp 1.4/1.5;
the lift's `top: 0` where `bottom` uses `S.FLOOR_BASE`.

**B38 · `plan.js:495` + `building.js:914` · the spoke count has two sources** —
*seen*
`ALLOCATION.length` (12) drives the plan; `S.SPOKE_COUNT` (12) drives the arch and
pendant loops. Nothing asserts they agree.

**B39 · `plan.js:941` · a loop variable that is never used** — *reasoned*
`for (const sgn of [1, -1])` never reads `sgn`, so the same candidate point is
tested twice and the intended "go round either hand" search does not exist.

**B40 · `plan.js:315` · dead arithmetic in `windowOffsets`** — *reasoned*
`span` and `step` are computed, the `: 0` arm is unreachable, and the
`count === 1` return throws both away — the single-window fix was bolted on after
the maths.

**B41 · `rig.js:82` · an unknown range silently becomes spoke 0** — *reasoned*
`Math.max(0, findIndex(...))` gives any range with no corridor the spoke-0 axis.
The Cupola (range 'Centre') only works because spoke 0 happens to be the North
range. Same root cause as B13.

**B42 · `rig.js:364` vs `:318`/`:325` · the flight is asked with two different
pads** — *reasoned*
`flightT` is queried with `BODY_R` for standing and 0 for height and naming, so at
x 1.4 (the shaft half of the well) a point is accepted as rotunda floor, rides the
flight's slope, and is named "The Stair".

**B43 · `rig.js:445-471`, `:420` · teleporting or starting a walk does not clear a
running ride** — *reasoned*
`Shift+H` mid-ride toasts "at the front door" and the next frame snaps you back to
the cabin; `T` mid-ride queues a tour that starts inside the lift.

**B44 · `rig.js:277-297` · tour legs are never tested against furniture** —
*reasoned*
The graph is bent around obstacles but the legs between nodes are not walked, and
a node needing more than 0.55 m is left inside a crate. `check-collision`'s
routes are eight ground rooms only — no cellar route is ever walked.

**B45 · `building.js:913` · the rotunda silently restyles two other rooms** —
*reasoned*
`wallMat.side = THREE.DoubleSide` mutates the cached `marbleDark|1x1` material, so
the Box Office and Trophy Hall walls inherit DoubleSide and cast double-sided
shadows.

**B46 · `sky.js:836-843` · planets sit at unphysical elongations** — *reasoned*
A heliocentric mean longitude is used as a geocentric one, so there are no
conjunctions, no retrograde motion, and Venus can stand opposite the sun. The only
gate is "above the horizon and it is night".

**B47 · `sky.js:809` + `lighting.js:415` · the sky says night while the interior
says day** — *reasoned*
The vault gates on `alwaysNight || sunAlt < -6°` (always-night is on by default)
but the key light gates on the real `sunAlt` alone: stars at full opacity and a
visible moon while the sun rakes window bars down the corridor.

**B48 · `sky.js:504-513`, `:766` · the horizon haze drifts with the sidereal
clock** — *reasoned*
The haze counter-rotates so its axis stays vertical, but unlike the Earth and the
limb its *position* is never counter-rotated, so its 4 m offset rides the group
and the band's centre swings with the clock, flipping sign in the southern
hemisphere.

**B49 · `sky.js:719-729`, `:817` · the crescent never tilts, and the Moon's
latitude is invented** — *reasoned*
The shade ellipse is always drawn along the texture's x axis and the disc is
oriented by `lookAt` with world-up, so the terminator axis never answers where the
sun is; the latitude is `3.5°·sin(elongation)` rather than a 27.3-day term.

**B50 · `lighting.js:105-107` · the cold window lights hang outside the hull** —
*reasoned*
The anchor is `win + room.n*0.4` and `room.n` points *out* through the windowed
wall, so the light sits 0.4 m beyond the glass rather than just inside it.

**B51 · `hud.js:332` · a corrupt or tampered `orbituary.serial` goes straight into
the ticket's innerHTML** — *reasoned*
`serial.no` is interpolated unescaped (`esc()` covers identity strings only) and
never validated. Markup injection, or a ticket wrecked by a long value.

**B52 · `main.js:258` + `src/shell.html` · one thrown module means a black page,
and a throw inside the frame loop freezes it** — *reasoned*
`boot()` has no try/catch, the frame loop has none, and the built file contains no
`onerror`, `unhandledrejection` or watchdog. A throw like `LINKS[ex.link]` being
undefined kills the animation loop and the last frame stays on screen forever.

**B53 · `build.mjs:32-45` · the build reports success without proving the bundle
is complete** — *reasoned*
Only esbuild's exit status is checked. A `src/*.js` not imported by `main.js` is
silently absent from `index-v2.html`; there is no size or boot sanity check; and
the esbuild binary path is hardcoded to `@esbuild/win32-x64`, so the build breaks
on any other platform.

**B54 · `signage.js:378-387` · the Rules Room board's fit test under-counts and
the text ends 20 px above the footer** — *seen*
The shrink loop measures `hpx+10+n*(bpx+8)+24` per rule but the drawing adds a
further `bpx` for each rule's first body line, under-counting by six lines.
Measured off the live canvas: last rule body ends at row 933, footer ink starts
at 953, canvas is 1024 tall.

**B55 · `signage.js:133`, `:141` · on a plinth label the category stencil and the
room code are 7 px apart** — *seen*
`spaced()` has no fit check and the code is right-aligned into the same gutter.
Measured: "EMULATION AND RE(DE)OMPS" ends at x 303.5 while "PLY-07" starts at
310.5 in a 384 px cell. A longer category overprints the code.

**B56 · `signage.js:533-541` · the cellar WANTED card has 12 px of bottom
margin** — *seen*
Two paragraphs stack with no height budget on a 512×256 canvas; ink stops at row
244 of 256 on all fourteen cards. One more line of room name prints off the card.

**B57 · `data.js` + `plan.js:306` · a room's `parent` reference is never
validated** — *reasoned*
The table itself is clean (192 links, no duplicate names or URLs, no malformed
URLs, no missing fields, one non-https link), but `plan.js` slugs a `parent` that
may not exist.

**B64 · `props.js:180` · the collision circles are hand-written, not derived from
what is drawn — so a moved prop silently keeps a stale circle** — *seen*
`K.block` calls are typed by hand next to each builder; `room._propBoxes` (the
drawn boxes, props.js:116 and :166) is read only by `check-props.mjs`, while
`rig.js:215` consumes `plan.obstacles`. Nothing compares the two. This is the root
of B59, B60 and B65, and it corrects what `REVIEW-BRIEF.md` D2 claims — see
*Corrections* below. `check-props.mjs` already holds every drawn box per room, so
it is the right place for the missing circle-vs-footprint comparison.

**B65 · `props.js:275`, `:918` · 59 floor props leave 0.06–0.17 m of their
footprint outside their circle** — *seen*
Gaming cabinets, privacy vitrine bases, programming paper stacks, the reading
ladder and modding clutter are one r≈0.44 circle at the piece's centre against a
half-diagonal of ~0.53; the cellar pallet's corners sit 0.15 m outside every
blocker. Measured headless across all furnished rooms. Not a fall hazard, but the
visitor clips corners of things they can see.

**B66 · `props.js:987` · `K.block` sits inside the crate loop, so the rotunda
stacks push 3, 4 and 2 identical circles at the same point** — *reasoned*
Nine duplicate blockers for three stacks. Harmless today; it moves
`check-collision.mjs`'s prop-circle count, which is used as a baseline.

**B67 · `atmosphere.js:250` · the cellar's damp pattern and every dust mote are
re-randomised on each visit** — *reasoned*
`roomDust` and `dampTexture` call `Math.random()`; only `props.js`'s storage seeds
from `room.id`. This breaks the project's own invariant 3 — a room should be
untidy the same way every time. Note the good news: dust *is* gated on
`group.visible` (atmosphere.js:282) and the cull toggles that group, so the
atmosphere half of `REVIEW-BRIEF.md` D6 is already handled.

---

## Tier 4 — the test layer: checks that lie

These matter more than most Tier 2 items. A check that cannot fail will tell a
reviewer their fix worked when it did not.

**T01 · `check-collision.mjs` · "corridor centreline blocked: 0" tests only the
exact centreline.** An object 1 m off-centre inside a 2.6 m corridor is never
reported. This is the number I used to claim the deck-ring pedestals were clear
(B09). The name promises more than the test delivers.

**T02 · `check-collision.mjs` · "doors pinched by furniture: none" samples only
door centres.** Both the correct and the transposed doorway box contain the
centre, so B08 is invisible to it.

**T03 · `check-collision.mjs` · the tour walk asserts `inside(…, 0.3, storey)`,
which the full rotunda disc always satisfies** — so it cannot see the stair well
(B03) or the tour leg that crosses it. Its route list is eight ground rooms; no
cellar route is ever walked.

**T04 · `check-lights.mjs` · only reads key lights (`a.i > 5`)**, so the rotunda
sconce anchors (i 3.5) and the stair-hall flicker anchor are never checked —
which is how B16 and B17 survived. It also prints a false alarm: "below 1.2 m:
stair −1.1", because `plan.stairRoom.floor` is rewritten to the visitor's storey
by `main.js:132` and the check subtracts the wrong base. A check that cries wolf
hides the next real one.

**T05 · `check-scale.mjs` · resolves `S.*` names but does not report unused
constants** — and `REVIEW-BRIEF.md` claims it catches "none unused". That claim in
my own brief is wrong; B35/B36 and the unused-constant list are the proof.

**T06 · `probe-stuck.mjs` · never calls `settle()`**, despite a header saying it
asks settle. It prints blockers, rects and cover. It cannot catch a regression in
the function most likely to leave a visitor stuck (B26).

**T07 · `check-lift.mjs` · starts every ride at the cabin centre and triggers
auto-park by teleporting to z +0.2.** The real dock (z −6.6) and the real exit are
never tested, which is how B05, B06 and the open-hole case survived. It also never
asserts that the arrival point is walkable (B15).

**T08 · `check-pop.mjs` · passes a flat forward vector**, so it cannot see the
pitch-dependent cull bug (B12). Its numbers are also not reproducible: the brief
records 223 m / 78 flips / 34 ahead / 5 oscillating; a clean solo run today gives
230 m / 104 flips / 46 ahead / 6 oscillating. Until the walk is deterministic, the
baseline in `REVIEW-BRIEF.md` cannot be used to detect a regression.

**T09 · every CDP harness binds port 9223** (`scratch/cdp.mjs:18`). Two scripts run
at once read each other's page. An auditor running `check-lift` alongside
`check-pop` got five phantom lift failures. Always run these one at a time.

**T10 · `probe-stair-up.mjs` reports `storeyAgainstRoom: 130` — a false positive
in the probe, not a bug.** The cellar's north arm runs under the Cupola deck rect;
two storeys sharing a plan position is normal here. **Do not "fix" the rig to
satisfy that watcher — it would break the cellar.**

**T11 · no check reads the plaque, the brochure, the ticket or the ground-track
panel.** B01, B07, B25 and B51–B56 are all in that blind spot. `check-keys.mjs`
asserts that shortcuts *open* things; it never asserts that controls are reachable
or that a panel can be closed.

**T12 · `check-v2.mjs` · the counters in the green-baseline table are
time-dependent, so they cannot gate a regression.** They are read from wherever the
tour happened to reach after 4 s of wall clock at 2 fps. A run today, with `src/`
byte-identical to the head the brief was written at, gives **462 calls / 120437
tris / 368 geoms / 52 texs / 64 programs** against the recorded
476 / 125229 / 376 / 53 / 66 — all five moved with nothing changed. No verdict, no
exit code. *Fix: pin the camera to a named standing point before reading counters.*

**T13 · `check-collision.mjs` · two of its headline numbers are tautologies.**
`rig.blocked(x, z, storey)` takes **no radius**, so querying a point at a blocker's
own centre is always blocked. "pick nodes not solid: 0" is guaranteed because nodes
sit exactly at `spotToWorld` (`building.js:485` vs `rig.js:212`), and "furniture
inert where it stands: 0" is guaranteed because each blocker is queried with its own
floor tag. Both can never be anything but zero — so the evidence line behind
`REVIEW-BRIEF.md` D2 measures nothing at all.

**T14 · `check-tube.mjs` · its headline number is wrong by a factor of three, and
it is not awaited.** `withBrowser(...)` is not awaited, there is no verdict and no
exit code, and `agree++` fires per room per sample, so the real denominator is up to
120 while the printout says "agree 38 of 40". The true agreement is about a third.
The Node half samples `accessibility` and the stair hall, which the browser half
never checks, and the `k` values are hand-copied.

**T15 · `check-terminator.mjs` · an all-black canvas prints success.** The verdict
is skipped unless `alt < 1.45 && max(sun, anti) > 0.12`, so a black or uniform
Earth gives 24 skips and the success line; `sun > anti*1.6` passes on any nonzero
sunward value; `FAIL` prints but `process.exitCode` is never set.

**T16 · `check-keys.mjs` · it never asserts that a key did anything.** After `H` the
x/z are unchanged (`touring: true`) and nothing checks that the visitor moved, so a
completely dead `H` key prints the same line. No `keyUp` is dispatched; `E` and
pointer lock are untested; the `windowsVirtualKeyCode` it sends is bogus (137 for
`H`).

**T17 · `check-events.mjs` · one rule is unreachable and two are copies.** Rule 6
(`rooms.includes('rotunda')`) can never fire because the check builds the pool
without rotunda and `events.js:62` already excludes the visitor's room. Rules 3 and
4 hardcode 90/60/140 instead of reading `ROOM_COOL`, `GAP_MIN` and `GAP_JITTER`, so
editing `events.js` silently disables the check that guards it.

**T18 · `check-props.mjs` · it can pass by seeing nothing.** `if (!boxes ||
!boxes.length) continue` means 24 rooms print nothing; if `_propBoxes` were renamed
the check would print only its success line and exit 0. There is no count assertion,
and it hardcodes `HALF 0.31` and `PLINTH_H 1.0` "from scale.js".

**T19 · nine of the fifteen checks set no exit code — only `check-lift.mjs` does.**
Everything else can print a failure and still exit 0, so no script, no CI step and
no agent loop can ever fail on them. This is why "all checks pass" has been a weak
sentence all night.

**T20 · `check-scale.mjs` · the `defined` regex requires two-space indentation.** A
re-indented `scale.js` silently falls back to a looser pattern and the count drifts.

**T21 · `check-sky.mjs` · one test is self-referential and two have slack.** The
Vega/Sirius "matches formula" test reads `sky.state.lst` on both sides, so it can
catch a wrong vault quaternion but **never a wrong sidereal clock**. Crux is
asserted only as `> 0` and measured 39.16. Sydney noon is ±60 min sampled at 10-minute
steps and measured 50. The equinox sunrise and sunset checks sit at 1.46 and 1.48 of
a 1.6 tolerance.

**T22 · `check-candidates.mjs` · it prints a real signal and ignores it.** "!!
categories with no room: Creative, Dev, Tools" — categories that have links and no
room — while its `fits()` and `kind()` use hardcoded 12.0×11.0 / 8.0 / 6.0 / 1.70 /
2.2 / 1.50 instead of `scale.js`, so its clearances cannot be checked against the
real plan. Report only, no verdict.

**T23 · `probe-corridor-props.mjs` · it cannot run.** Backticks around `inside()`
inside the template body make it a `SyntaxError`; it prints nothing. `node --check`
says it is the only broken file in `scratch/`. Even if it parsed, it compares
room-local `_propBoxes` against world corridor points, so it would name the wrong
prop — and its header still cites findings that were the phantom axis bug.

**T24 · `dump-at.mjs` · its frame is built at `S.FLOOR_BASE` for every room**, so
local Y and the ray height are 3.6 m wrong for any ground-floor room. This is the
probe I used to "confirm" B02, and it also fires along `room.n`, which is the window
wall, not the door.

**T25 · `probe-cellar-empty.mjs` · it reads `l.cat` where the data uses `c`,** so it
prints "categories in data 1" and "in data 0" for all fourteen cellar rooms: it
answers its own question backwards. Run today it still prints one useful line — the
ground rooms with nothing in them are `rules-room`, `recompiles-and-decompiles`,
`trophy-hall`, `box-office`, `acquisitions-hall` and `cupola`.

**T26 · `probe-deck-ring.mjs` · it prints the pedestal-to-spoke distance and never
compares it to `halfX`,** which it also prints. "0.4 m off the nearest spoke" can
still be 0.9 m inside a corridor. This is exactly how B09 survived: the probe looked
like a pass.

**T27 · `probe-wanted.mjs` · a broken probe prints a perfect score.** If the card
texture tag is missing, `cards = 0`, `off` stays null and `worstOff` prints 0 m. It
prints; it does not assert — `REVIEW-BRIEF.md` says it asserts 204 pick nodes and 0
without an exhibit, and it does neither.

**T28 · `probe-plinth-corridor.mjs` · its answer is not comparable to the code it
audits.** It uses pad 0 and includes the cupola, while the repair pass in `plan.js`
uses pad 0.55 and skips the cupola, and it ignores the 0.52 m collision radius.

**T29 · `probe-perf.mjs` · it reports frame-time percentiles and a GPU string from
SwiftShader,** which the repo's own rule says mean nothing, and its header claims
frame times fix that. There is no baseline to compare to either.

**T30 · the small ones.** `probe-lift-diag.mjs`'s `near` list uses an axis-aligned
box on rotated door rects (its `fromAbove`/`fromBelow` crate test is a genuine
storey test). `probe-terminator-angle.mjs` has no null guard on `earth` and prints
angles without computing the difference. `probe-card.mjs` reads real HUD text but
teleports then calls one `rig.update(0.05)`, which can leave a stale card, and has
no expected-wording baseline. `probe-stair-up.mjs` is sound — correct rect axes, a
real verdict — and its `storeyAgainstRoom` count is the false positive T10 warns
about.

---

## Tier 5 — open work and owner decisions (not defects)

- **Fourteen cellar rooms have furniture and an empty WANTED plinth each, and no
  exhibits.** Which categories get a first exhibit, and whether any of it goes
  downstairs, is a content decision.
- **`PLY-08 Recompiles and Decompiles`** is the only room in the building with
  nothing in it at all: no links, no plinths, and not a cellar room, so it does not
  even get the wanted plinth.
- **The lift shaft has no doors.** Given B04, the question has changed from
  "should it look honest" to "what stops a visitor walking into a 3.6 m hole".
- **A real distance fade at the wing edges** is still not implemented. Given
  B11–B14, fix the cull's logic before adding a fade.
- **Door and window placement is asserted by nothing** (B22, B24, B40).
- **Creature ambience out of sight, ships and comets outside**: not started.
- **Controllers**: deferred by the owner.
- **`src/identity.js`** still has empty `socials` and a null `donation`; the
  brochure prints "not posted yet" rather than inventing a handle. The trophy
  ladder's donor threshold has no number.
- **The eight zone hexes, the iris transition, the front door reading *The
  Observatory*, SYS's two rooms, Astronomy pinned to the Cupola** are deliberate
  choices, listed in `REVIEW-BRIEF.md` under *Deliberate*. Do not "fix" them.

## Dirt map — where the code is hardest to change safely

1. **`src/building.js`, 2145 lines, one file, five concerns.** Geometry kits,
   room shells, the cupola and rotunda, the lift, and the visibility cull. The
   cull alone is ~150 lines of stateful logic at the bottom of a file whose other
   job is welding plaster. Most of Tier 1 and Tier 2 lives here.
2. **`src/plan.js`, 1003 lines doing four jobs**: choosing which categories go
   downstairs, laying out rooms and corridors, placing openings and pedestals, and
   ordering the tour. The allocation logic and the metre arithmetic sit in the same
   functions, which is why a placement rule (B31) can be unreachable for months
   without anything noticing.
3. **`src/rig.js`, 641 lines**: walking, collision, the route graph, tours, the
   lift ride and key handling, with the storey rules spread across `canStand`,
   `flightT`, `levelAt` and the ride branch. Three of the five walkable-hole bugs
   (B03, B04, B05) come from those four places disagreeing with each other.
4. **`src/props.js`, 1033 lines of hand-placed coordinates** — every builder
   positions its own furniture in metres with no shared vocabulary for "against
   this wall", so footprints and drawings drift apart (B27's root, and the reason
   the collision circles come from bounding boxes).
5. **The measuring layer is a pile, not a suite**: 118 scripts in `scratch/`, no
   index, no shared assertion helper, every one re-implementing its own harness,
   all binding the same port. Several of them disagree with their own headers
   (T06, T10).
6. **The generated artifact is tracked**: `index-v2.html` is 897 KB in every
   commit. `.gitattributes` now stops it churning, but any diff of the museum
   against its own source is unreadable, so a reviewer must read `src/` and never
   the built file.

## Corrections — claims in this project's own documents that are wrong

A reviewer working from an old note will "fix" the wrong thing. Every claim below
appears in a committed document or a source comment and is now known to be false.

| Where | Claim | Truth |
| --- | --- | --- |
| `REVIEW-BRIEF.md` D2 | a furniture collision circle comes from the drawn bounding box | circles are hand-written in `K.block`; the drawn boxes are never compared to them (B64) |
| `REVIEW-BRIEF.md` D6 | atmosphere keeps animating out of sight | dust is gated on `group.visible` and the cull toggles that group; only the *audio* half of D6 is still open (B67) |
| `REVIEW-BRIEF.md` D7 | the shaft circles are the only thing between a visitor and a 3.6 m hole | they guard one of four sides; the east and south edges are open (B04) |
| `REVIEW-BRIEF.md`, `check-scale` row | the scale check reports "none unused" | it only resolves `S.*` references; six constants are unused (T05, B35) |
| `REVIEW-BRIEF.md` pop-in row | 223 m / 78 flips / 34 ahead / 5 oscillating | today it gives 222 m / 104 flips / 56 off / 46 ahead / **9 oscillating**, identical across two runs, with no source change since the brief was written — so the recorded baseline is stale or was wrong (T08) |
| `REVIEW-BRIEF.md` green baseline, Cupola row | 476 calls / 125229 tris / 376 geoms / 53 texs / 66 programs | those counters are read from wherever the tour reached after 4 s of wall clock; a run with `src/` byte-identical gives 462 / 120437 / 368 / 52 / 64. The row is a description, not a gate (T12) |
| my own note in this file, first draft | B02 was *seen* via `dump-at.mjs science 0 1.6` | that probe fires along `room.n` — the window wall, not the door — and builds its frame at `S.FLOOR_BASE` for every room. B02 stands on the code read, not on that ray (T24) |
| commit `14d9a3c`, `NIGHT-LOG.md` | the Cupola deck ring was re-broken clear of the corridors, proved by "centrelines blocked: 0" | all six pedestals are still inside spoke corridors; that number only ever sampled the exact centreline (B09, T01) |
| `plan.js` deck-ring comment | "1.04 m … never stands in the walking line" | wrong for four of six pedestals |
| `lighting.js:174` comment | the stair-hall anchor is at the tube's height, north of the well | the anchor is 3.3 m from the fitting and inside the well (B17) |
| `lighting.js:220` comment | the sconce ring matches the fixtures in `building.js` | it is the old eight-lamp ring, 0.96 m off and four short (B16) |
| `props.js:668` comment | the rim strips sit 9 cm off the wall | they are 6 cm inside it (B61) |
| `probe-stuck.mjs` header | the probe asks `settle` | it never calls it (T06) |
| `probe-stair-up.mjs` output | `storeyAgainstRoom: 130` is a defect | it is a false positive; the cellar arm legitimately runs under the Cupola deck. **Do not change the rig to satisfy it** (T10) |

## What was not audited

Every file in `src/` has been read end to end by at least one auditor, plus
`build.mjs`, `src/shell.html` and the whole of the measuring layer: fifteen checks
run one at a time and twelve probes read. No audit looked for *missing features*
beyond Tier 5, and none of them ran the museum on real hardware — the headless
harness renders through SwiftShader, so no frame-rate claim in this file means
anything about the 5090. And after a pass whose whole subject was untrustworthy
measurements, the honest caveat on this document is its own: **the numbers quoted
here were produced by instruments described in Tier 4.** Where a number matters,
the entry says which instrument produced it.

