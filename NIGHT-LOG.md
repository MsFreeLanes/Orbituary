---
tags: [museum, project, log]
session: overnight 2026-11-13 → 2026-11-14
started: 2026-11-14 00:44 (America/New_York)
head at start: 6141319
remote: https://github.com/MsFreeLanes/Orbituary
---

# Night log — the unattended build

Nobody is awake for this. The rule for the whole session: **every step is
committed, pushed, bundled, and written down here before the next one starts.**
If the machine dies at 04:00, the last entry in this file plus the last bundle
should be enough for someone to pick the building up without asking me anything.

## Backup routine (runs after every commit)

1. `git commit` — one commit per step, prose message, what and why.
2. `git push origin main` — off-machine copy (GitHub).
3. `git bundle create ..\Backups\orbituary-<sha>.bundle --all` — off-repo copy on
   disk, so a corrupted working tree or a bad `git gc` cannot take the history
   with it. Verified restorable: `git bundle verify`.
4. `index-v2.html` is rebuilt and committed with the step, so the built site
   itself is versioned — a checkout of any commit is a double-clickable museum.

Bundles taken this session. A bundle is named for the commit it holds, so the
row for a step's own commit is added at the top of the next step's entry:

| time | sha | file |
|---|---|---|
| 00:47 | 6141319 | `..\Backups\orbituary-6141319.bundle` |
| 00:50 | fa95d34 | `..\Backups\orbituary-fa95d34.bundle` |
| 00:58 | 34470f3 | `..\Backups\orbituary-34470f3.bundle` |
| 01:06 | 1c95417 | `..\Backups\orbituary-1c95417.bundle` |
| 01:18 | 84aa968 | `..\Backups\orbituary-84aa968.bundle` |
| 01:29 | bb91cd5 | `..\Backups\orbituary-bb91cd5.bundle` |
| 01:31 | 4d95a31 | `..\Backups\orbituary-4d95a31.bundle` |
| 01:42 | df1dea8 | `..\Backups\orbituary-df1dea8.bundle` |
| 01:44 | a70e273 | `..\Backups\orbituary-a70e273.bundle` |
| 01:45 | 0b42d7f | `..\Backups\orbituary-0b42d7f.bundle` |
| 01:52 | cb421ec | `..\Backups\orbituary-cb421ec.bundle` |
| 01:53 | 454e221 | `..\Backups\orbituary-454e221.bundle` |

A row is normally added at the top of the entry for the step that follows the
commit it names, so the row for a step's own commit appears in the commit after
it. The commits after `0b42d7f` only write rows, so they are not listed here —
each is still in `..\Backups\orbituary-<sha>.bundle`, named for its own sha, and
`git log` is the complete record.

## Green baseline before touching anything

`node scratch/check-v2.mjs` — boots, console clean, `nanCount: 0`, 12 lights,
204 plinths, 261 calls / 74k tris in the Cupola under headless Chrome.
`check-scale` 84 constants, all `S.*` resolve. `check-sky` 16 astronomy checks,
`failed: 0`. `check-events` 2,000 events, `verdict: ok`. `check-data` clean.

## The queue, in the order I decided to do it

Small and safe first, so the building is better even if a later step goes wrong.

| # | Step | Why this order |
|---|---|---|
| 1 | **Entry sequence**: ticket with the rules printed on it → brochure with controls, features, donation ask, socials | The front door is the one thing the owner asked for that does not exist at all. UI only, no geometry, so it cannot break the building. |
| 2 | **Room codes** stencilled on every door plate (`ENG-04`) | Cheap, and it is what makes eight zone colours enough. |
| 3 | **Trophy stands** and their plaque in the Trophy Hall | Small, in `building.js`, and it is a standing request. |
| 4 | **Props fit-out**: wire `props.js` into the 47-room plan | Biggest visual gap in the building and the biggest risk, so it goes after three safe wins. |
| 5 | **Basement atmosphere**: dust motes, cobwebs, damp, the tube that tries to start | Atmosphere on top of the fit-out, once there is furniture to gather dust. |
| 6 | Docs: `HANDOFF.md`, `README.md`, this log | Last, so it describes what actually shipped. |

All six landed: `fa95d34`, `34470f3`, `1c95417`, `84aa968`, `bb91cd5`, `4d95a31`.
Then a seventh step that was not on the queue, because the artifact step 5 left
behind turned out to be a geometry bug rather than a texture one: `df1dea8`.

## Decisions taken while nobody was asked

Recorded here as they are made, with the reason, so they can be overruled in
the morning rather than discovered.

- **Brand.** `ORBITUARY` is the entity — it goes on the ticket, the brochure and
  the page title. *The Museum of Useful Links* stays the name of the building
  you are standing in, which is what `README.md` already says. Nothing else in
  the building gets renamed tonight.

## Entries

### 00:44–00:47 — orientation and backups
Read `HANDOFF.md`, `MUSEUM-V2-PLAN.md`, `README.md`, `hud.js`, `main.js`,
`shell.html`, `materials.js`, and grepped the plan and the builder for what is
actually implemented. Findings:

- Everything was committed and pushed at `6141319`; nothing was in flight.
- `props.js` (849 lines) is **still not imported by anything** — the phase-3
  loose end from `HANDOFF.md` is real, and it is the largest thing missing.
- Done already, contrary to the stale handoff: the 47-room plan, the two rings,
  the cellar grid and stair, the hull, the sun, the Cupola and Earth, the brand
  palette, per-room fog, flickering cellar tubes, cellar drips in the audio,
  random-**room** and room-based tour.
- Not done: the ticket/brochure entry sequence, the trophy stands, room codes,
  the props, dust and cobwebs.
- `HANDOFF.md` and `README.md` both describe the twelve-room building and are
  now badly out of date. Fixing them is step 6.

### 00:44–00:49 — step 1: the ticket and the brochure

**What landed.** Agreeing to the rules *is* the door.

- `src/identity.js` is new and is the only file the owner needs to edit: the
  entity, the building's name, the thesis, the six rules printed on the ticket,
  the curation line, and two empty lists — `socials` and `donation` — that are
  empty because **I was never given a handle or a payment link and the museum
  will not invent one.** When they are filled in, the brochure prints them;
  until then it says so plainly. *This is the one thing I need from you.*
- The intro screen is now a **ticket**: paper white on the dark station, amber
  rule, a serial number that persists in `localStorage` (so a returning visitor
  gets the same number and a line saying how many times they have been
  admitted), the date, the counts read out of the live plan, and the six rules
  printed below a perforation. One button: `AGREE — TEAR THE TICKET`. No form,
  no scan, nothing to fill in.
- Tearing it is an **iris closing over the paper** rather than a fade, then the
  brochure fades in. That is my reading of the loading transition in the
  identity handoff — I no longer have the exact wording, so this is the one
  place I guessed. Overrule it and it is a two-line CSS change.
- The **brochure** carries: what the building is, the controls, the features
  (guided walk, random *room*, ground track, the Cupola, the cellar, sound),
  and the ask — the curation statement, the donation line, the keeper's
  channels, and a note that the three trophy stands are empty on purpose.
  `H` opens the same sheet inside the museum, so the old help panel is gone:
  one document instead of two that said nearly the same thing.
- The **closing page** runs when a full circuit of the guided walk finishes —
  51 stops — on arrival, not on the last keypress, so it never lands on top of
  a walk.
- While the ticket is in the visitor's hand, no key does anything except `M`.
  A tour that starts before the rules are agreed to is a tour of a museum
  nobody has been admitted to. The "click to walk" hint moved to the far side
  of the door for the same reason, and the ambient-event clock now starts when
  you actually walk in rather than when the page booted.
- Page title is now `ORBITUARY — The Museum of Useful Links`, and the room
  card's brand line reads `ORBITUARY`. The building keeps its name; the entity
  is what signs the ticket.

**Proven, not assumed.** New probe `scratch/shot-entry.mjs` drives all three
stages and reads the text back out of the DOM: six rules present, no stray
`undefined`, `T` does nothing while the ticket is up, the brochure reopens on
`H`, `window.__errors` empty. Screenshots: `entry-ticket.png`,
`entry-brochure.png`, `entry-brochure-help.png`, `entry-inside.png` (ignored by
git, like all scratch PNGs). `check-v2` still boots clean: console clean,
`nanCount: 0`, 259 calls / 74k tris.

**Kept on purpose:** the gate element still carries class `intro` and
`.intro-kicker`, and `hud.hideIntro()` still closes everything, because about
twenty probes in `scratch/` drive the museum through those names.

### 00:49–00:57 — step 2: eight zones, and a code on every door

You said forty-seven colours was too many and to find a better approach. This is
it. **The colour belongs to the zone; the code belongs to the room.**

- **Eight zones**, your own list of subjects grouped by what you came to do:
  `PLY` Play 8 · `STU` Studio 7 · `DEV` Development 9 · `SYS` Systems 2 ·
  `SEC` Security 4 · `LIB` Library 10 · `MKT` Market 7 · `HUB` Hub 7. Accents:
  ember, the terminal amber, the signal cyan, coolant green, cold blue, paper
  sand, a litmus rose, panel white. They sit in the brand palette's family.
  **The accents are my pick and are the thing most worth overruling** — they are
  eight lines at the top of `src/plan.js`.
- **Codes**: `SEC-04`, `LIB-03`, `HUB-06`. Numbered inside each zone *in the
  order you meet the doors* — anticlockwise from the South arm, up each spoke
  near side, far side, hall, then the cellar rooms in the order you pass them
  off the stair. So a code is a place, not a row in a table. Astronomy is
  `LIB-03` even though it stands in the Cupola: the subject wins over the room.
- The same string appears on the **door plate**, the **plinth label** (top
  right), the **room card**, the **plaque** and the **acquisitions board**.
  `SEC-04 · PRIVACY · 10 LINKS` is the bottom line of a plate now, not the top:
  a corridor lamp sits over a ground-floor door often enough to bloom across
  whatever is printed there, and the code cannot be the thing that gets eaten.
  The zone name moved up to that decorative strip instead.
- **The floor plan is eight colours with a key** under it — zone, name, and how
  many doors that zone owns, counted out of the plan so it cannot go stale.
- **A bug found and fixed:** the acquisitions board set one row per room at a
  58 px pitch, which was right for twelve rooms and at fifty-one ran off the
  bottom of its own canvas — twenty rooms were simply not on the board. It is
  now two columns, hungriest first, with the zone key along the top.
- **The cost prints on the plaque**, which the plan always said it should and
  nothing did: the price goes in the corner of the 3D label in the palette's
  analogue amber, and the DOM plaque now carries the price, the wall-label text
  (`d`, which it also never showed) and the host.
- Door plates are self-lit at 0.72 rather than 0.5, for the same lamp reason.

**Proven:** `scratch/shot-codes.mjs` prints all 51 codes grouped by zone and
photographs a ground plate (`codes-door-privacy.png`), a cellar plate
(`codes-door-cellar.png`), the board (`codes-board-rotunda.png`) and the map
with its key (`codes-map-rotunda.png`). `check-scale`, `check-data`, `check-v2`
all green; console clean; 258 calls / 74k tris, unchanged.

### 00:57–01:05 — step 3: the four rooms about the museum itself

The Box Office, the Acquisitions Hall, the Rules Room and the Trophy Hall are
four identical 6 × 6 cabinets off the rotunda, and until tonight they were the
only rooms in the building with nothing in them. They are also the only rooms
whose subject is the museum, so they are now the only rooms furnished from
`identity.js` rather than from the link table.

- **Trophy Hall (HUB-04)** — three stands, nothing on any of them. Each is a
  base, a paper column, a machined cap and a mounting plate 13 cm across: the
  plate is the only thing on top, because an empty plinth with a bronze trophy
  already cast into it is a lie. On the side wall, the ladder — sponsor, then
  donor past a line that will be published, then the keeper's own work — and a
  bench in the palette's rust, the one surface a visitor wears.
- **Rules Room (HUB-03)** — the ticket the size of a door: all six rules,
  numbered, from `IDENTITY.rules`, with the footer *the door is the agreement ·
  no account · no signature · nothing to scan*. The body text is measured
  before it is drawn, so when you rewrite a rule the board re-fits itself.
- **Box Office (HUB-01)** — a counter facing the door, carcass in machine grey
  and the front panel in the same paper white as the ticket, with the sign on
  the counter's own face rather than on a wall: *TICKETS — take one. The rules
  are printed on the back, and the door is the agreement.* Six ticket blanks
  stacked badly on the top slab, and a stool pushed in behind it.
- **Acquisitions Hall (HUB-02)** — four framed cards on the two side walls,
  all four reading *WANTED — an acquisition for the hub*, two crates, and a
  ladder leaning on the wall under the window. One card texture serves all four
  frames: the emptiness is the same emptiness everywhere in this museum.

**Two bugs found by looking, not by checking.** First: a board hung on the far
wall of any room sits *behind* that wall's window frame, whose inner lip then
cuts a grey cross through the words — the Trophy Hall plaque did exactly that,
and the fix is that every board in these four rooms hangs on a side wall,
which is the only solid wall a cabinet has. Second: the ladder leaned away
from the wall it was leaning on, because a positive `rx` takes the top of a
vertical box towards `+z` and the rungs were being set on the mirror of the
line the rails stood on.

Cost: 13 draw calls and 1.1k triangles for all four rooms, four textures.
271 calls / 75k tris at the Cupola probe, still well inside the budget.

**Proven:** `scratch/shot-purpose.mjs` photographs each room from just inside
its door (`purpose-<room>.png`), `scratch/shot-wall.mjs` photographs one wall
close up, and `scratch/inspect-room.mjs <room>` prints every mesh in a room's
group — geometry, colour, texture kind, size — which is how the window-frame
cross was found. All checks green, console clean.

### 01:05–01:17 — step 4: the old furniture moves into the new building

`src/props.js` is 849 lines of workbenches, easels, printing presses, vitrines,
bookcases and CRT cabinets, and nothing imported it. It was written for the
twelve-room building and orphaned when the plan became 51 rooms: its builders
are keyed by room id, and only seven of the twelve ids survived the split into
categories (gaming, media, privacy, shopping, ai, reading, linux). The other
five sets of furniture — easels, a workbench, a print shop, a handset wall, an
oscilloscope and a wall of curiosities' drawers — now have rooms under an
`ALIAS` map: Content Creation, PC Tweaks, Programming, Android Dev, Modding.
The rotunda got its crates, hand truck and ladder back too.

**The real work was not the wiring, it was the plinths.** props.js was written
for rooms that held a handful of exhibits; the new building puts up to 21
plinths in a hall, on a grid the prop author never saw. So every piece a
builder places now leaves its local bounding box on the room
(`room._propBoxes`), and `scratch/check-props.mjs` asks three questions of it:
does it stand on a plinth, does it poke through a wall, does it block a
doorway. The first run found **142 collisions**. It now reports zero, and the
fixes were mostly one line each: the shop counter moved 17 cm off the wall it
was standing on, the library chair moved behind its own desk, the scales' beam
shortened to the depth of the counter it stands on, the film shelf pulled in
from the wall, the arcade CRTs and the shop's dials moved clear of the door
reveal.

**Three bugs that were not about position.** `K.rod(name, r, len, x, y, z,
axis)` had its axis names backwards — a cylinder stands along +Y, so it takes
a turn about *Z* to lie along x, not about X — which is how the shop's velvet
rope ended up strung across the room instead of between its two posts, and how
three 11 m pipes in the Linux room ran out through the door wall into the
stair. The projector in the Screening Rooms stood 1.7 m from its own screen,
which put anybody walking in inside the beam cone, so the whole room washed
white; it now fires from the far end down the aisle. And the prop palette's
emissive values were tuned for a building with one lamp per room: in the
station, with a lamp in every bay, a 2 cm neon strip bloomed into a foot-wide
blob and the arcade read as twelve cyan rectangles floating in the dark. Every
glow in `PALETTE` came down (neon 2.1 → 1.25, cold strip 1.7 → 1.0, lattice
1.5 → 0.6) and the near-black bodies that were invisible against the near-black
walls — arcade cabinets, the AI room's fins — are steel now, so they catch the
lamp.

Cost: 55 draw calls and 12k triangles for twelve rooms and the hub (271 → 326
calls, 75k → 87k tris, 46 textures), which is about four calls a room because
each room's props weld into one mesh per material.

**Proven:** `scratch/check-props.mjs` (zero collisions; pass a room id to dump
every piece's box), `scratch/shot-props.mjs` photographs all twelve furnished
rooms from just inside their doors (`props-<room>.png`), `scratch/boot-error.mjs`
prints whatever the page threw on boot — it caught the first crash, where
`furnishRotunda` wrote to `plan.obstacles` before anything had created it.
`check-v2`, `check-scale`, `check-data`, `check-events` green; console clean.

### 01:17–01:28 — step 5: the cellar gets its weather

The cellar already had the *sound* of being damp — `audio.js` drips at random
intervals under a longer reverb and puts a different footfall on concrete — and
`CHARACTER` already gives every cellar room its own fog, its own lamp colour
and a `flicker` value that lighting.js runs on the tube. What it had none of
was anything to look at. So `src/atmosphere.js`, three things, cellar only:

- **A damp band** 44 cm up the base of the cellar walls: a transparent sheet
  over the plaster, darker than it and much glossier, painted as a gradient
  with soft blooms, a few streaks where something ran down more recently, and
  a pale broken line about two thirds up — the salt a wall keeps when the water
  in it gives up and evaporates. The gloss is the whole trick: wet plaster
  catches the lamp and dry plaster does not, which is how you can read a damp
  wall in the dark before you can see one.
- **Webs across the ceiling corners**, one in each of the two corners by the
  door — the corners a visitor looks at on the way in, and the two the sweep
  misses because the sweep never looks up. Lit by the room's own lamp, so they
  come up as you walk under them. This is the one thing that worked first try.
- **Dust in the air**: a few dozen points per room, each with its own phase,
  speed and reach, moved twenty times a second, and the whole cloud skipped
  while the arm it stands in is culled.

One damp sheet, one web sheet and one cloud **per cellar arm**, not per room,
welded across every room on the arm and hung in the arm's group — the cull
already switches a whole arm, so the damp and the drifting dust go off with it,
and the building pays two draw calls per arm instead of six per room. Measured
with `scratch/stats-in.mjs`: 32 calls in the Science room with three atmosphere
meshes on, 87 in the Sports room with six (the arm plus the stair hall), 140 in
the Library with none, 282 at the Cupola with the hall's three.

**The dust was wrong first.** At 2.2 cm and opacity 0.5, square because a
`Points` primitive is a square unless you give it a shape, the motes read as a
swarm of pixels and the eye starts counting them — several of them were even
tinted orange and blue by the bloom. Now: a soft disc from a radial-gradient
alphaMap, 1.6 cm, opacity 0.38, and about a third of the points per square
metre.

**Found, and left.** With the walls properly lit there are hairline stripes
across the plaster of a cellar room — three or four horizontal lines, some of
them stopping in mid-wall, one doubled, crisp enough to read as a crack. Not
tonight's work, and proved so: `scratch/ab-atmo.mjs` photographs the same view
with every atmosphere mesh hidden and the stripes are in both frames.
`scratch/dump-glass.mjs` lists every transparent surface within 14 m of the
room and there is no stray sheet in it; `scratch/dump-planes.mjs` shows the
wall is one buffer whose boxes are the two side runs (which overshoot the door
and far walls by a full wall thickness to close the corners), the door wall
centred on z = 0 with a header box over the opening, and the far wall centred
on z = d. The lines sit at the heights where those boxes meet, so the leading
explanation is a coincident-face seam between the header and the runs beside
it. It is visible only where a wall is evenly and brightly lit from close to,
which is not how the building is mostly walked, so it goes on the list rather
than into tonight.

*(Corrected in step 7 below: the leading explanation given here — a seam between
the header box and the runs beside it — was wrong. The coincident faces were the
range's shell and the room's door wall, a wall thickness apart in plan and the
same plane in the world.)*

**Proven:** `scratch/shot-cellar.mjs` (three views of a cellar room — level
into it, up at the corner, and back at the door with the lamp behind you —
plus the stair hall), `scratch/shot-doorwall.mjs` (the wall the door is in,
close up; set `CLIP='{"x":..,"y":..,"width":..,"height":..}'` to zoom a
region at 3×), `scratch/ab-atmo.mjs`, `scratch/dump-planes.mjs`,
`scratch/dump-glass.mjs`, `scratch/stats-in.mjs`. `window.__museum` now
exposes `scene`, which is what makes the last three possible. Every
atmosphere mesh carries `userData.atmo` = damp | web | dust.

### 01:28–01:31 — step 6: the two documents that still described last month

`README.md` opened with "a building that is being rebuilt from twelve rooms to
forty-seven … the page you can open today still shows the twelve". It shows
fifty-one. `HANDOFF.md` said the plan still builds twelve, that the prop kit is
"wired, not yet wired in", and that phase 9 was not started. Both were true on
2026-11-13 and neither is true now, and a document that lies about the state of
a build is worse than no document, so both were rewritten against the plan
rather than against memory.

The counts were taken from the running plan, not from the old files:

- **51 rooms** = 47 category rooms + 4 rooms about the museum itself. The
  rotunda, the stair hall and the stair are not rooms in `plan.rooms`; they are
  structures, which is why the zone legend adds to 54 and the room list to 51.
- **32 rooms have plinths, 19 do not** — 14 of those in the cellar, 4 are the
  purpose rooms, 1 is `PLY-08 Recompiles and Decompiles`, which is the only
  space in the building with nothing in it at all.
- **192 links, 198 plinths, 16 corridors over 12 ranges** (8 ground, 4 cellar
  arms), 8 zones, a 10-light pool plus one static light in the stair hall.
- 882 KB, 327 calls / 87k triangles / 49 textures at the Cupola.

`HANDOFF.md` now carries a "waiting on the owner" section — the empty `socials`
and `donation` in `identity.js`, the eight zone hexes, the iris transition, the
trophy ladder's missing threshold, and the fact that props do not stop the
visitor — and a "known artifacts" section that starts with the cellar hairlines
and names the probes that narrowed them.

**Proven:** the numbers came from `node -e` against `src/plan.js` and
`src/data.js`, and from `scratch/stats-in.mjs`. Both documents were read back
after writing.

*(The clock in this log drifted: the rows for bb91cd5 and 4d95a31 were written
with the time the next step was expected to finish, not the time the bundle was
made. Corrected against `git log --date=format:'%H:%M'`, which says 01:28, 01:30
and 01:42 for the three commits.)*

### 01:31–01:42 — step 7: the hairlines, and what they actually were

The one artifact left from step 5. Seven probes, each one ruling something out,
each one written before the next was guessed at:

| probe | question | answer |
|---|---|---|
| `ab-atmo.mjs` | the damp band and webs? | no — lines in both frames |
| `ab-wall.mjs` | the room's own wall mesh? | lines go with it, but that only proves they are on or in front of it |
| `ab-texture.mjs` | the picture on the wall? | **yes** — map off, lines gone, and the wall is one 148-vertex welded mesh with no bump or roughness map |
| `dump-tex.mjs` | is the painted canvas striped? | no — and the 2×2 tile is seamless |
| `ab-mip.mjs` | a mip jump at a UV seam? | no — lines survive mipmaps off |
| `ab-bloom.mjs` | the bloom buffer chain printing? | no — lines survive bloom off |
| `ab-shadow.mjs` | a point light's cube shadow seam? | no — lines survive shadows off (and only one light casts at all) |
| `dump-at.mjs` | what is actually at that point? | **two surfaces at the same distance**: `9aa0aa` 148 verts from the room, `d8d4cc` 48 verts from the range |

The plan puts every room's door wall exactly on its corridor's side plane — the
projection of `entry` onto the corridor's own axes comes out at `dx = ±half` to
the centimetre for all forty-seven rooms, `dz` 23 or 24 upstairs and 9 or 18 in
the cellar. `buildCorridor` laid its shell `from z0 to z1` with no openings, so
wherever a room stood, the shell's box and the room's door-wall box filled the
same volume with their faces coplanar. Two welded sheets at one depth: the depth
buffer decides per triangle, and the decision prints as a hairline along every
triangle edge. That is why the lines were straight, why some stopped in
mid-wall, why one was doubled, and why they only appeared on an evenly lit wall
seen close to.

The fix is that the shell stops at the mouth — `mouths(side)` finds the rooms
whose door wall lies on that side plane and hands `addWall` an opening the full
width of the room, floor to ceiling — and the mouth then gets a lining of the
shell's own plaster, 2 mm proud of the face the shell would have had, standing
on the corridor side of the room's wall. Nothing shares a plane; the arm keeps
the plaster it was lined in.

**Measured, not assumed:** `probe-exposure --hour 07:47` before and after, with
`src/building.js` stashed in between so the comparison is the same building
minus one change. The corridor's wall band goes 48 → 86 (the arm is properly
lined now). The dim cellar room's band is 7 before and 6 after, and the lit
cellar room's 49 → 48: **the cellar rooms did not get darker.** The bright wall
in the old close-ups was the range's shell showing through from inside the room,
which is the bug rather than the lighting. `check-v2` 326 calls / 87,303 tris /
252 geoms / 49 texs / `errors: []`, `console: clean`, `check-scale` 84 constants,
`check-props` clear, `check-events` ok.

The plaster maps were also not periodic: the blooms in `concreteTexture` were
drawn once and clipped at the canvas edge, so any wall that tiles the map cuts
them in half. They are now drawn again on the far side of the sheet when they
run off an edge, and `dump-tex`'s 2×2 tile is seamless. **This was not the
cause** — `ab-texture` and the rest say so — but the map was wrong regardless,
and it is fixed.

### 01:44–01:47 — closing the night

Both storeys checked by eye after the shell change: the cellar arm reads as one
continuous lined surface (`scratch/arm-lined-science.png`), and the North
Corridor outside the Arcade Wing reads as light plaster with the room's dark
interior behind the doorway and the door plate lit over it
(`scratch/doorwall-gaming.png`). No hairlines in either.

**Where the build is at 01:47.** `df1dea8` is the last code change, `a70e273`
the last commit; both pushed to `origin/main` and bundled. 51 rooms, 8 zones,
192 links, 198 plinths, 882 KB, 326 draw calls / 87,303 triangles / 49 textures
at the Cupola. Every check green: `check-v2` (console clean, `errors: []`),
`check-scale` (84 constants, all `S.*` resolve, walkability to every room
including down the stair), `check-props`, `check-events`, `check-data`,
`check-candidates`, `check-sky` (16 astronomy checks).

**Two judgement calls left standing, with the numbers to argue from.**

- The cellar's dimmest room measures a wall band of 6 with 87% of it dark,
  against 48–49 for the lit cellar room and 86–94 for the ranges. That is the
  emptiest categories being filed in the basement as agreed, but it is a dial,
  not a law: the anchors in `lighting.js` are `i: 2.2` side washers and `i: 3.0`
  for the far wall in every room regardless of storey, and the cellar's own
  `tone` and fog sit on top. If the basement should read as a place you can
  look around rather than a place you feel your way through, the washers are the
  line to move.
- Props still do not stop the visitor. `props.js` writes its footprints into
  `plan.obstacles` and `rig.js` never reads them. `check-props` keeps them clear
  of plinths, walls and doorways, so nothing *looks* embedded, but you can walk
  through a workbench. Making them solid is a change to the collision, and the
  walkability proof in `check-scale` would have to be re-run against the props
  rather than the plan.

**What the owner owes the build:** the `socials` array and the `donation` link
in `src/identity.js`. The brochure prints *not posted yet* until then, and the
trophy ladder has no donor threshold written on it.


### 01:47–01:53 — step 8: the tube that tries to start

The queue closed before this line in it was finished. Step 5 read "dust motes,
cobwebs, damp, **the tube that tries to start**", and what landed at 01:17 was
the first three plus a wobble. The wobble was not a starting tube.

**What was actually there.** Two different inventions of the same idea, in two
files. The fitting's glow dropped out on a random 90 ms slot (`building.js`,
`lampsFor`), and the room's light sagged on two sines (`lighting.js`,
`flicker`). A fluorescent tube does neither: it sits dark, flashes once or
twice, goes dark again, and either catches and warms up or gives up for a
couple of seconds. Worse, the two versions were not the same shape, so the lamp
you can look at and the light coming out of it were disagreeing — which is the
one thing that turns a failing tube into a rendering bug.

**What is there now.** `src/tube.js`, forty lines, two exports. `tubePhase(id)`
hashes the room's name into a phase in seconds, so two rooms on the same arm
never strike together and a reload gives the same tube back. `tubeEnvelope(now,
phase, k)` returns a multiplier: an attempt every `7 + 16(1-k)` seconds — the
worse the starter, the more often it tries — of one to three flashes of
0.07–0.12 s separated by 0.16–0.26 s of dark, then either a catch (back to full
over about a second) or a failure (dark for two and a half seconds, then it
comes back on its own). Between attempts the tube holds, and a failing one
still beats a little. Both callers — the pool's anchor and the fitting's glow —
call it with `performance.now()`, so they are reading the same clock.

The Stair Hall's four anchors were left mostly steady: only the one under the
visible tube fails with it, or a striking starter would take the four cellar
door mouths down with it every sixteen seconds.

**One bug found by reading the numbers rather than the picture.** The recovery
ramp after a failed attempt was `0.06 + (since - 2.4) / 2.0` with no ceiling, so
once `since` passed 4.2 s the multiplier ran past 1 and kept going — the
Accessibility room sat at eight times its lamp for the rest of the cycle.
`scratch/tube-curve.mjs` printed it as a sparkline and the mistake was obvious
at a glance: a flat run of `@` for twenty seconds. Clamped at 1.

**Measured.** `check-tube` samples the shape in Node over 90 s and then asks
the page, forty times over five seconds, what the glow and the pool light are
each doing at that instant: 39 of 40 agree exactly, worst gap 0.025, and the
gap is the one-frame lag between a render-time callback and an update-time one,
not two shapes drifting. `shot-strike` sits through one attempt and keeps the
brightest and darkest frames: `strike-bright-journalism.png` at 1.6, the disc
white with a bloom halo, and `strike-dark-journalism.png` at 0.05, the disc grey
and the halo gone. A flash is a tenth of a second and a screenshot costs more
than that, so the peak is caught by the burst, not by aiming at it.

**Probes added:** `check-tube.mjs`, `tube-curve.mjs`, `shot-strike.mjs`,
`glow-watch.mjs`. `glow.userData.env` now carries the last multiplier so a
probe can read the number back off the material.

**Housekeeping:** `scratch/bundle.js` — esbuild's intermediate, 890 KB — was
tracked by `git add -A` in `cb421ec`. Untracked and ignored in `454e221`. It is
in that one commit's history; not worth rewriting a pushed branch over.

## 16:16–16:36 — the owner's list, worked through

The owner came back with decisions rather than questions: both a walk home and a
teleport home; the brochure moves to Tab; my judgement on pop-in and performance;
a better-looking moon; the ground track is not interactive; the grand stair stays
and an elevator is wanted too; controllers ignored for now; things need collision;
and two hours to work without stopping.

**Hardware, since it decides everything else.** This machine is a Ryzen 9 9900X3D,
an RTX 5090 and 62 GB, driving 3440×1440 at 143 Hz. The Cupola leg of the tour
runs 309 draw calls and 85k triangles. There is no object-count problem here.
Every fps number this file has ever printed — 2, 4, "live fps 2" — is the CDP
harness, which reports `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device
(Subzero)))`: the probes render in software. `probe-perf.mjs` now prints that
string so nobody reads those numbers as the machine again.

**`609b309` — the Observatory was built twice.** The generic room builder laid a
rectangular box of walls, a ceiling and a ring of pedestals over the circular
gallery that has its own builder: twelve pedestals for six exhibits, a second set
of walls inside the drum, and a plate that read backwards. The generic builder
stands down for `kind === 'cupola'`. The gallery's plinth spots are written in the
room's frame and were being read as hub coordinates, which is how one pedestal
came to stand inside the well. The gallery's walkable area was a 6.4 m box
reaching 6.4 m south of the well, so it claimed the middle of the hub and the
nameplate at the front door read *The Observatory*; it is a deck ring, so it is
now a disc of the radius the builder draws, and `roomAt` tests discs by radius.
Both pedestal rings were circles that knew nothing about the holes in the floor —
five of the rotunda's six stood dead centre in an arch opening and one stood in
mid-air over the stair well. `check-placement`: over a hole none, in no room
none, same spot twice none, undefined links none.

**`16e1a1c` — the building is solid.** The rig's blocker list was tagged by room
and skipped every tag that did not match the room you were standing in, so it went
inert at every threshold; the rotunda and the deck are structures rather than
rooms so their pedestals were never in it; and furniture had been writing 319
circles into `plan.obstacles` that nothing read. Blockers are world circles now,
per storey — the cellar grid lies under the hub, and a cellar crate was being
treated as a bollard on the terrazzo above it — and a circle that lands in a
doorway is dropped rather than obeyed. The tour lerps along a polyline and never
tested anything: positions now settle out of whatever they land inside, sliding
round an obstruction with no floor on the far side; the route network is bent
around furniture at startup; and the storey follows the floor under the feet with
a preference for where the rig already thinks you are, because a tour to the
cellar used to decide you were below before it had reached the stair and then
walked you through every wall on the way. `check-collision`: 523 blockers, all 204
pickable pedestals solid, no doorway pinched, nothing solid on the wrong floor,
eight tour routes walked with no clipping and no step off the floor.

**`014baf9` — four small things that each changed how a room felt.** The key light
hung 1.6 m below the ceiling whatever the room was, so fourteen cellar rooms (3.2 m
clear, tube 0.5 m down) were lit from eye height, 1.1 m under the fitting you
could see: `check-lights` says the lowest cellar key is now 2.58 m up, was 1.1.
`windowOffsets` measures first-opening to last-opening, so one opening returned
`-winW/2` and all 19 cabinet rooms had their window, their hole in the hull and
their daylight 0.6 m off the door axis. The flight's slab sat 2 cm below the
nosing line, so twenty tread boxes were 2 cm ribs in a smooth ramp while the panel
said *twenty steps down* and the audio played twenty footfalls — the stone is
thinner and hung lower, costing 4 cm of headroom where the south cellar arm
passes under. And the Observatory's plate was hung in the hub frame with no turn
while its texture is painted for a plate turned to face a corridor, so the first
thing a visitor read at the front door was the room's name backwards.

**`2788836` — a way home, and the panels get their cursor back.** H walks you to
the front door along the route network, Shift+H puts you there at once, Tab takes
over the brochure with `preventDefault`. The ground track has a slider and seven
buttons and the brochure has links, but the canvas holds the pointer from the
first click, so none of it could be touched — that is why the owner took the
planet for scenery. Opening either panel releases the lock. `check-keys` presses
each key through the browser's input pipeline: H starts a walk, Shift+H lands at
(0, 4.5), Tab opens the brochure.

**`6959ee6` — the pop-in was a threshold, not a count.** The cull switches whole
ranges, and its rule was one distance: lit within 6 m of a range's shell, not lit
beyond it. Walk down a corridor at the speed a body walks and the range on your
left arrives, leaves and arrives again. A range already lit now stays lit 3 m
further out, a range in the hub's view cone stays in it 10° past the edge, and a
range you are walking towards comes on 7 m before you reach it. `check-pop` walks
a fixed 223 m route and counts every flip with the distance at which it happened:
hysteresis off, 114 flips, 35 of them a range oscillating on a threshold;
hysteresis on, 84 flips, 11 oscillating. The cost is 309 draw calls becoming 461
and 85k triangles becoming 124k, which on this machine buys nothing back and
costs nothing.

**`9f57701` — the moon, drawn rather than photographed.** The owner asked for an
8k photo. A photograph cannot go into a file that has to double-click and work on
a train: an 8k NASA frame base64'd is 40–80 MB against a page of 888 KB. So the
disc is drawn, at 1024 px instead of 128, and drawn as the thing itself — the
maria at their real selenographic longitudes, latitudes and angular radii under
an orthographic projection, each one five overlapping blobs because the real
edges are irregular and a single 40° circle reads as a diagram; a crater field
whose points are picked on the disc and projected backwards, which keeps them all
on the near side and squashes the limb ones for free; Tycho and Copernicus
throwing rays; the terminator in three passes so it is a place rather than a cut;
earthshine on the unlit part, because the planet in that sky is four times the
diameter and thirty times the brightness of the moon. Craters are stroked rims:
the first attempt filled them and the surface came out looking like grey
confetti. `shot-moon` dumps the texture itself rather than the forty pixels of it
that reach the screen, and reports its mean luminance against the 0.70 bloom
threshold.

**`a31c0ac` — the planet was painted once at boot and never again.** The owner
said the ground track did nothing when they moved it, and they were right in a
way I had not suspected: the panel worked, the sun moved, the moon re-painted
itself, and the Earth kept the same face for the whole visit. Two faults, one
after the other. The repaint guard compared `Math.abs(a - b) > 0.01` against
`lastEarthAz`, which is initialised to `NaN` — and every comparison with `NaN`
is false, so `paintEarth` was never called from `update()` at all; the planet on
screen was the boot frame, `paintEarth(0, 0)`, with its half shadow sitting at a
constant 87 dark pixels. Fixing the guard exposed the second fault: the bearing
of the terminator was `atan2(-sunDir.z, sunDir.x)`, and the canvas is not in the
sky group's frame — the disc is a CircleGeometry turned -90° about X and the mesh
carries the sky group's inverse quaternion, so in world terms canvas +x is room
+X (west) and canvas +y is room +Z (north), and a room direction (dx, dz) has
canvas angle `atan2(dz, dx)`, with no negation. `probe-terminator-angle` finds
the centre of the painted dark arc and compares it with both conventions;
`check-terminator` steps twenty-four hours and samples the painted canvas
sunward and anti-sunward at 0.8r, asserting only the one-directional invariant —
a point 0.8r toward a sun that is below the horizon is genuinely more sunlit than
the centre, and an assertion that forgot that failed for twelve honest hours.

**`fd9a41c` — the lift stands in the east metre of the stair well.** The owner
asked for both ways down. The well is the one place in the building where a shaft
already exists: 3.00 m wide, of which the flight only needs 1.84, so the lift
takes the remainder and the plan does not move by a centimetre — the well's
rectangle, the holes it leaves in the rotunda floor and in the stair hall's
ceiling, and the walkable union are exactly what they were. Four constants
(LIFT_W 1.10, LIFT_PARTITION 0.06, LIFT_IN 1.60, LIFT_RIDE 5.0, which is
0.72 m/s, a lift you feel rather than a door that opens somewhere else). The
shaft is glazed the height of the well with the same 0.90 m parapet the well's
own walls carry; each storey gets a landing frame standing on the floor just
outside the well's edge, because without a frame a lift in a floor opening reads
as a white booth on the terrazzo and hides the stair behind it. The cabin is
1.00 × 1.60 m inside — one person and a box of books, not a stretcher, which is
what the stair is for — dark steel outside, the palette's bright token and a lamp
strip inside, and its own Object3D rather than part of the welded hub, because it
moves. `E` answers when you are standing in the cabin and says where the cabin is
when you are not; the storey, the HUD's name and the light pool change at the
door rather than halfway down the shaft, because a lift has no halfway. The
partition is 14 circles per storey at 0.40 m spacing, r 0.24: the first spacing,
0.55 with r 0.18, left gaps the body walked through. The cabin parks itself back
at the top dock while the visitor is downstairs, because a top dock without a
cabin in it is a hole you can walk into, and the flight takes ten seconds against
the return's five. `check-lift` walks it end to end — down, out, the cabin
returning, up again, and the refusal from the middle of the rotunda — 20
assertions green. Blockers 523 → 551; `check-collision`'s storey test now asks
only furniture whether it is solid on the floor above it, since the partition is
deliberately solid on both.

### 17:0x — the corridor obstruction turned out to be a measurement error, and then it didn't

`check-collision` reported ten points down a corridor that were solid, and
`check-placement` said nine pick nodes sat inside corridor rects. Both numbers
were wrong, and the wrong part was ours: the probes measured the corridors
**across**. A walkable rect's long axis is `(sin angle, cos angle)` and its short
axis is `(cos angle, −sin angle)` — the pair `plan.js inside()` uses — and the
probes walked `(−sin, cos)`, which is the rig's *forward* convention rather than
the rect's. On a spoke at 0.52 rad that is a chord, not a centreline, and over a
37 m corridor it reports an obstruction wherever the furniture is standing
politely in its own room. `check-placement`, `check-collision` and
`probe-corridor-props` all had it. With the axes corrected, the nine pedestals in
corridors are **zero**: they were never there, and `probe-plinth-corridor` now
prints the same thing from the plan alone.

One real thing survived the correction, and it was the deck. The twelve spokes
leave the hub at 0, 30, 60 … and at the deck's radius their 2.6 m strips overlap
one another, so there is no gap between them to stand in — only the middle. The
six pedestals on the Observatory ring were at world bearings 29, 64, 143, 235,
277 and 343: all but a degree or two off the spokes themselves, so each one stood
in a walking line. They now sit at 45, 75, 105, 255, 285 and 315 measured from the
middle of the drum — 1.04 m off the nearest spoke, the widest the deck offers,
clear of the front door's bearing and of the well. The numbers written in
`plan.js` are untidy on purpose (53.3, 86.4, 116.4 …) because the ring is centred
on the well, which is 0.8 m north of the middle the spokes are measured from, and
the comment says so. **`14d9a3c`**: corridor centreline blocked 10 → 0, in a
corridor 9 → 0.

The plan also now checks its own pedestals against its own circulation while it
builds — smallest push first, deeper into the room, never out of the room's rect,
never within 1.25 m of a neighbour — and names anything it could not move in
`plan.plinthRepairs`. It has nothing to report, and `check-placement` prints that
so the guard stays honest instead of becoming code nobody reads.

### 17:2x — the cellar is a storeroom now, and it is solid

`be58780`. The fourteen cellar rooms — `apple-dev`, `open-source`,
`creative-writing`, `journalism`, `music` and the rest — had nothing in them. Not
nothing to display: nothing *built*. `furnish()` had a builder for twelve
categories and an alias for five more, and the cellar rooms matched none of them,
so they were empty shells with a cold tube in the ceiling and nothing you could
not walk through. The plan explains why they are down there — the emptiest
categories are shelved below, and a category with nothing in it is always
downstairs until something arrives — but an empty room is not a storeroom, and
the ticket already promises *fourteen waiting in the cellar*.

They get the archive's own furniture: shelving down both side walls with the
boxes things arrived in stacked along them; a flat file against the back wall with
one drawer out; a bench under a cold strip with a vise, three crates and a
clipboard; a pallet by the door still strapped; a ladder leaning, because a ladder
is never put away; pipes along the ceiling painted the same colour as the slab so
you only notice them when something is dripping. Same system in every room, a
different disorder, seeded from the room's own id, so the same storeroom is
untidy in the same way every visit. `shot-cellar.mjs` photographs it
(`cellar-bench.png`, `cellar-shelving.png`, `cellar-door.png`).

Prop circles 319 → 1187, and they are tagged to the cellar at last: an obstacle's
storey comes from the room that owns it, which was always correct and never had
anything to be correct about. `check-collision`'s storey test was rewritten in the
same commit, because the question it asked was not the question worth asking. Two
storeys sharing a plan position is normal here — the cellar arms run under the
galleries — and it is not an invisible wall, since the rig filters by floor. What
matters is whether a piece of furniture is solid where it actually stands: **0
inert out of 1419**.

### 17:1x — a wing now waits a third of a second before it goes away (`47cf506`)

Hysteresis and the look-ahead point took a 223 m walk from 114 flips and 35
oscillations to 84 and 11. The 11 were a wing arriving, leaving and arriving again
within five metres of walking — a threshold crossed twice, which is the pop a
visitor actually sees because it happens in front of them. So the cull holds a
wing up for **0.35 s** after it stops qualifying: coming on is still instant, only
going away waits. Same walk: 84 → 78 flips, 46 → 43 going out behind you, 37 → 34
appearing ahead, **11 → 5 oscillating**. A longer grace (0.45 s) bought one fewer
oscillation and held two metres of building on for nothing, so it is not taken.

The wait is counted in seconds handed in by the frame rather than read off the
clock, because the probes step the building a hundred times in a heartbeat and a
cull that read the wall clock would answer about the probe; `check-pop` now passes
the 0.05 s it steps by. The first attempt changed nothing at all — 84 and 11,
exactly, twice — because the helper asked a wing record for a `visible` field it
has never had, and `undefined` is falsy, so every wing took the fast path out.

### 17:2x — the hardware question, answered once (`5730d35`)

`HARDWARE.md`. Measured rather than remembered: `nvidia-smi` says 32607 MiB and
driver 621.24; WMI's `AdapterRAM` says 4 GB for a 5090, which is a 32-bit counter
and not a fact. The verdict in the file: the museum is not the problem (477 pieces
of geometry, 125k triangles, against a machine that draws cities), the demanding
part of this box is a screen of 4.95 million pixels refreshed every 7 ms, so a
missed frame would come from the post chain and not the geometry; and a local
language model fits with room to spare up to about 30 billion parameters, with a
70-billion one running out of the card into ordinary memory, where it works and is
slow and nothing in this repository can fix that.

### 17:2x — the cellar's empty plinths, and the labels that were not on any plinth (`655f2b1`)

Fourteen cellar rooms have furniture and nothing to look at, so they get a plinth
and a card that says what the plinth is for: **WANTED**, the room's code, *the
first thing in The Newsroom*. It is the sentence the Acquisitions Hall already
says with four empty frames, said in the room where the things are kept. The plan
hands it out in `makeRoom` — middle of the room, facing the door, clear of the
shelving, bench, flat file and pallet — and the building draws it as stone with
the room's colour inlaid and a circle you cannot walk through (plinth blockers
204 → 218). It is deliberately not a pick node: the pointer aims at exhibits and
there is nothing here for a plaque to open, so 204 pick nodes still all have one.

**Putting a card on it found a bug that has been in the building since the plinth
kit was written.** A plinth's wall label was welded into the room's batch at
`(sin face · labelD, 0.66, cos face · labelD)` — the offset from the stone,
without the stone's own place in the room. A room's origin is its doorway, so
**every wall label in the station was standing in the door reveal, at knee height,
4.72 m from the plinth it belonged to.** `scratch/probe-wanted.mjs` measures the
distance from a card to the stone it should be on: 4.72 m → **0.32 m**, which is
the half-width of the plinth plus the 8 mm it stands proud. Two hundred and four
labels are on their plinths now (`privacy-bench.png`, `wanted-plinth.png`).

### 17:3x — an empty room says WANTED, in all three places (`5faee66`)

The door plate's last line was a stock count — `LIB-04 · CREATIVE WRITING · 0
LINKS` — which is what a storeroom looks like from the corridor. A room that has
been handed a plinth with a card saying what it is waiting for should not then
report what it lacks on its own door, so the plate and the HUD's room card both
say **WANTED**, the word the Acquisitions Hall's four empty frames, the trophy
stands and the ticket already use. `probe-card.mjs` reads the cards back:
`LIB-04 · Creative Writing · wanted · Basement North` against
`SEC-04 · Privacy · 10 links · West South West`.

**Where the pass stopped.** Head `5faee66`, pushed, bundled, tree clean. Eight
commits this afternoon: the lift, the deck ring and the corridor measurement
error, the cellar as a storeroom, the handoff and log rewritten, the hardware
answer, the cull's dwell, the cellar's empty plinths and the 204 wall labels that
were standing in doorways, and the wording. Everything the checks cover is green:
`check-v2` at 476 calls / 125229 tris with a clean console, `check-scale`,
`check-sky`, `check-events`, `check-data`, `check-candidates`, `check-props`,
`check-tube`, `check-placement`, `check-collision`, `check-lights`, `check-keys`,
`check-pop`, `check-terminator`, `check-lift`.

### 18:0x — a brief for whoever reviews this next

The owner is handing the museum to another AI for review and defect resolution,
which is a different audience from `HANDOFF.md`: someone continuing the project
wants state and decisions, someone debugging it wants the mechanics. So
`REVIEW-BRIEF.md`: how to build and run the fifteen checks; the **green baseline**
as a table, so a reviewer can tell a regression from a change (897 KB, 476 calls,
125229 triangles, 204 pick nodes with none lacking an exhibit, 1433 collision
circles with none inert, 78 pop events and 5 oscillations over 223 m); the eight
**invariants** the building rests on, with the walkable-rect axis math spelled out
because getting it wrong is the most expensive mistake available here; the
**traps** that cost this session hours (the rig's forward vector is not the rect
axis, `view` has no `.camera`, the cull's dwell counts frame-supplied seconds, a
comparison against `NaN` silently disables a check, `git bundle` needs `--all`,
headless Chrome's fps is SwiftShader); a **numbered defect queue** where every
entry names the probe that proves it exists; and a section headed *Deliberate* —
the wanted plinths that are not pickable, the front door reading *The
Observatory*, SYS's two rooms, the open lift shaft — so a well-meaning reviewer
does not "fix" the design decisions that are the owner's to make.

The queue is honest about what is weak in what I built today: the deck ring's
pedestal bearings are hand-tuned numbers that will break if the ring moves; a
furniture collision circle comes from the drawn bounding box and the doorway
exemption drops silently; nothing at all asserts how doors and windows are
placed; and the plinth-repair pass has never once had to move anything, so it is
untested in anger. `HANDOFF.md`'s head is bumped to the current commit and points
at the brief.

### 19:1x — `.gitattributes`, so the built museum stops churning

Every commit has been warning `in the working copy of 'index-v2.html', LF will be
replaced by CRLF the next time Git touches it`. The museum is generated and
tracked at once — it is the file a visitor double-clicks — so a line-ending
rewrite in it is an 897 KB diff that means nothing. `.gitattributes` declares the
policy once: source, checks and prose are LF in the repository; `index-v2.html` is
`-text` and stored byte for byte (last matching pattern wins, which is why that
line sits after `*.html`); images and bundles are binary. Verified before
committing: `git add -A` stages only the new file, nothing else re-normalises, and
`git check-attr text -- index-v2.html` comes back `unset`. This was defect D9 in
`REVIEW-BRIEF.md`, and it is the only file I touched while being told not to touch
code.

**Still open, in the order I would take them.**

- The fourteen cellar rooms are furnished and now hold an empty plinth each, but
  still have **no exhibits**: no links, no pick nodes. Which categories get a
  first exhibit, and whether any of it goes downstairs, is a content decision for
  the owner.
- A real distance fade at the wing edges. Hysteresis, the look-ahead point and now
  a dwell are in; the fade itself is not, and with the oscillations down to 5 it
  may not be worth the transparency it would cost.
- Door and window placement beyond the lone-window fix.
- The small-creature ambience out of sight, ships and comets outside, and gating
  sound and effects to what is actually visible.
- The front door stands on the Observatory's deck, so the plate there says *The
  Observatory*: geometrically true, and a design question for the owner rather
  than something to hack.
- Controllers, deferred by you until the building is right.
