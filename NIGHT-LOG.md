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
