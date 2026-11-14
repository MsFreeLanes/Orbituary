---
tags: [museum, project, handoff]
updated: 2026-11-14 (fourth pass)
build: v2
head: be58780
remote: https://github.com/MsFreeLanes/Orbituary
---

# Handoff — where the museum actually is

Read this with `MUSEUM-V2-PLAN.md` (the locked plan), `README.md` (what a
visitor sees) and `NIGHT-LOG.md` (the session that closed the gap between them,
step by step, with the backups and the decisions recorded as they were made).
This file is only about state: what is finished, what is half-finished, and
what is waiting on a decision.

## Where the build stands against the plan

| Phase | Plan says | Actual |
|---|---|---|
| 0 pipeline, vendor three, tag v1 | 1 h | **done** — `build.mjs`, three bundled, `v1-rotunda` tagged |
| 1 materials, lights, post, watchdog | 2 h | **done** — and the watchdog rebuilt to keep its own clock |
| 2 architecture, doors, windows, collision | 3.5 h | **done, and rebuilt**: the twelve rooms became fifty-one, with a cellar under the stair hall and a hull over the lot |
| 3 room theming + props | 4 h | **done** — theming in `CHARACTER`, props wired into twelve rooms and the hub, cellar atmosphere in `atmosphere.js`, the failing tubes in `tube.js` |
| 4 sky: catalogue, sidereal, planets, moon | 3 h | **done** — 16 astronomy checks pass, and the planet hangs under the keel |
| 5 rig, walk, tour, random room | 3 h | **done** — the tour and the random room now choose *rooms* |
| 6 footsteps, per-room reverb, tone, SFX | 1.5 h | **done** — and the cellar has its own footfall, reverb and drip |
| 7 ambient events + tests | 1.5 h | **done** — 2,000 events checked for clustering |
| 8 checks, offline build, README, zip | 2 h | **done** for the state as of `bb91cd5` |
| 9 acquisitions board, ticket, trophy stands | 0.75 h | **done** — the board, the ticket and brochure, four rooms about the museum, three empty trophy stands |

**There is no loose end in the code.** The one that used to be here — 849 lines
of `src/props.js` that nothing imported — was wired in on 2026-11-14.

## The numbers, as they actually are

51 rooms: 47 category rooms and 4 about the museum itself (Box Office,
Acquisitions Hall, Rules Room, Trophy Hall). 8 zones, 12 ranges (8 ground, 4
cellar arms), 16 corridors, 192 links, 204 pick nodes, 32 rooms with something on
the walls and 19 without — and all nineteen now have furniture in them, because
the fourteen cellar empties were given the archive's own shelving, flat file,
bench and pallet, and each one an empty plinth with a card saying what it is
waiting for. The cellar holds those 14 under a 10 × 8 m stair hall; the emptiest
categories were put there deliberately, so the basement is the place the museum
has not decided about yet.

The building is solid: 1433 collision circles by storey (218 pedestals, 1187
pieces of furniture, 28 for the lift's partition), none of them inert where they
stand, none of them pinching a doorway, and no corridor centreline blocked.

One storey up: rotunda 16 m across, dome springing at 6.5 m, cupola whose floor
is a hole, a stair down through the mouth and a lift beside it. Cellar slab 3.6 m
down, 3.2 m of clear ceiling, and the pressure hull's belly 4 cm above the cellar
soffit. Lighting is a pool of 10 point lights handed between anchors, plus one
static light in the stair hall that the pool does not know about. The bundle is
895 KB and the Cupola view runs 477 draw calls / 125k triangles / 52 textures.

## What landed on 2026-11-14

| step | commit | what |
|---|---|---|
| 1 | `fa95d34` | the ticket and the brochure: the door is the agreement, and the back of the ticket is the controls, the ask and the socials |
| 2 | `34470f3` | eight zones and a code on every door, plate, board and floor plan |
| 3 | `1c95417` | the four rooms about the museum itself, fitted out from `identity.js` |
| 4 | `84aa968` | the old furniture moved into the new building, and a check that keeps it off the plinths |
| 5 | `bb91cd5` | cellar damp, corner webs, drifting dust |
| 6 | `4d95a31` | `README.md` and this file rewritten against what the building is now |
| 7 | `df1dea8` | the hairlines on the cellar plaster, which were the range's shell lying in the same plane as the room's door wall |
| 8 | `cb421ec` | the cellar tubes now try to start — one shape in `tube.js` for the fitting's glow and the room's light, which had been inventing two different ones |

## What landed in the fourth pass, 2026-11-14 afternoon

The owner came back with a list: both a walk home and a teleport home, the
brochure on Tab, my own answer on pop-in and performance, a better moon, the
ground track is not operable, the grand stair stays and an elevator is wanted,
controllers deferred, everything needs collision, and the hardware question.

| step | commit | what |
|---|---|---|
| 1 | `609b309` | the Observatory was being built twice — the generic room box over the circular gallery is gone, the deck is a disc, both pedestal rings moved off the holes in the floor |
| 2 | `16e1a1c` | collision rebuilt: 523 world blockers by storey, `settle`, the route network bent around furniture, the tour no longer walking through walls — `check-collision` |
| 3 | `014baf9` | cellar lamps at their fittings, a lone window centred, the flight reading as steps, the Observatory plate no longer backwards — `check-lights` |
| 4 | `2788836` | H walks you to the front door, Shift+H puts you there, Tab is the brochure, and opening a panel releases the pointer lock — `check-keys` |
| 5 | `6959ee6` | the cull got hysteresis and a look-ahead: 114 flips and 35 oscillations over a 223 m walk became 84 and 11 — `check-pop` |
| 6 | `9f57701` | the moon: 1024 px, real maria positions under an orthographic projection, craters as rims, ray systems, soft terminator, earthshine — `shot-moon` |
| 7 | `a31c0ac` | the Earth was painted once at boot and never again: the terminator now turns with the sun, and the side turned away from it is the darker side at every hour — `check-terminator` |
| 8 | `fd9a41c` | the lift: a glazed shaft in the east metre of the stair well beside the flight, a cabin that carries one person and a box of books, `E` to ride, the storey changing at the door — `check-lift`, 20 assertions |
| 9 | `14d9a3c` | the pedestals on the Observatory deck were standing in the spokes; and three probes had been measuring the corridors across, which is where the phantom obstructions came from — blocked centrelines 10 → 0 |
| 10 | `be58780` | the cellar is a storeroom: shelving, flat file, bench, pallet, ladder, pipes, and 868 new collision circles tagged to the basement |
| 11 | `47cf506` | a wing waits 0.35 s before it goes away: the walk's oscillations 11 → 5, and the cull now counts seconds handed in by the frame instead of reading the clock |
| 12 | `5730d35` | `HARDWARE.md` — what this machine runs, in plain language, measured with `nvidia-smi` rather than remembered |
| 13 | `655f2b1` | the cellar's empty plinths with a WANTED card, and the fix for a bug since the plinth kit: **every wall label in the building was in the doorway, 4.72 m from its plinth** |

**The hardware, since it changes what is worth doing.** Ryzen 9 9900X3D, RTX
5090 with 32 GB of its own memory, 62 GB, 3440×1440 at 143 Hz. The whole station
is 309–478 draw calls and 85k–125k triangles. There is no object-count problem on
this machine, and every fps figure in `NIGHT-LOG.md` is the CDP harness rendering
through SwiftShader, not the machine. Effort belongs on correctness and on what a
visitor sees. `HARDWARE.md` is the longer answer, in plain language, including
which local models this box will actually run.

**Not done, in the order I would take them.**
- The fourteen cellar rooms are furnished but hold **no exhibits**: no links, no
  plinths, no pick nodes. The tour walks you into a storeroom with nothing in it.
  This is a content decision, not a build one — see *Waiting on the owner*.
- A real distance fade at the wing edges. Hysteresis and a look-ahead point are in
  (`6959ee6`: 114 flips and 35 oscillations over a 223 m walk became 84 and 11);
  the fade itself is not.
- Door and window placement beyond the lone-window fix.
- Creature ambience out of sight; ships and comets outside; gating sound and
  effects to the visibility set.
- Controllers, deferred by the owner until the building is right.

## Waiting on the owner

- **The elevator is built, and one thing about it is still yours.** It stands in
  the east metre of the stair well (`fd9a41c`): the flight narrowed from 3.00 m to
  1.84 m to make room, the shaft is glazed the height of the well with a 0.90 m
  parapet, and each storey got a landing frame standing on the floor just outside
  the well's edge, because without a frame a lift in a floor opening reads as a
  white booth on the terrazzo. It carries one person and a box of books, takes
  five seconds a storey, and the storey changes at the door rather than halfway
  down the shaft. What is yours: **the shaft has no doors.** The cabin's grille
  and the glazed partition are the only thing between a visitor and a 3.6 m hole,
  and the rig keeps you out of the well with collision circles rather than with
  metal. Door panels at both docks would be honest about what a lift is; they
  would also hide the flight from the rotunda, which is why they are not there yet.
- **Which categories get their first exhibit, and does any of it go downstairs?**
  The fourteen cellar rooms now look like storerooms and still have nothing to
  look at. `apple-dev`, `open-source`, `creative-writing`, `accessibility`,
  `web-extension`, `github-repo`, `science`, `history-and-archives`, `sports`,
  `journalism`, `psychology`, `philosophy`, `paid`, `music` — each is a room with a
  code on its door, a cold tube that is trying to start, and no plinth. The plan
  says a category with nothing in it is always downstairs until something arrives,
  which is true of the museum and not very welcoming of the room.
- **What is the front door called?** The door at (0, 4.5) stands on the
  Observatory's deck ring, so the nameplate there reads *The Observatory*. That
  is geometrically true — the deck is the ring you are standing on — but it may
  not be what a visitor should read on the way in. The hub annulus from r 4.6 to
  r 8 correctly reads *The Rotunda*.

- **`src/identity.js` is the only file that needs a human.** `socials` is empty
  and `donation` is null, because nothing was ever supplied; the brochure prints
  *not posted yet* rather than inventing a handle. Everything else in that file —
  name, parent, building, thesis, the six rules, the curation note — is already
  driving the door plate, the Rules Room board and the ticket.
- **The eight zone colours are my pick**, eight lines at the top of `src/plan.js`
  (`ZONES`: play rust, studio amber, development cyan, systems green, security
  periwinkle, library parchment, market rose, hub panel-white). They are the
  thing most worth overruling, and overruling them is eight hex edits.
- **The iris transition** — the ticket tearing open into the brochure — is my
  reading of the identity brief's loading-screen note, not a spec.
- **The trophy ladder** says sponsor, then donor past a published line, then the
  keeper's own work. The line has no number on it yet.
- **Props stop you now.** `props.js` writes its footprints into
  `plan.obstacles` and `rig.js` turns them into 1187 circles, tagged to the
  storey of the room that owns them, so a workbench is a workbench downstairs and
  a crate is a crate in the cellar. The route network bends around them and
  `settle` pushes a visitor out of anything they end up inside. What to watch: the
  circles come from the *drawn* geometry's bounding box, so a piece of furniture
  that moves in a builder needs a circle written by hand, and the doorway
  exemption silently drops any circle that lands in a door — which is why
  `check-collision` counts how many pieces of furniture are inert where they
  stand, and why that number is 0.

## Known artifacts, and where they stand

- **~~Hairlines on brightly lit cellar plaster~~ — fixed in `df1dea8`.** They
  were two walls in the same plane: the plan puts every room's door wall exactly
  on its corridor's side plane, and `buildCorridor` laid its shell the whole
  length of the range, so the shell's box and the room's door-wall box filled
  one volume with coplanar faces, and the depth buffer decided per triangle. The
  shell now stops at each mouth and the mouth gets a lining of the shell's own
  plaster 2 mm proud of the face. `scratch/dump-at.mjs` is the probe that found
  it — a ray into the plaster coming back with two hits at the same distance —
  and `NIGHT-LOG.md` keeps the six probes that ruled everything else out. The
  cellar rooms did not get darker: `probe-exposure --hour 07:47` measures the
  same framings at 7 and 6 either way.
- **SYS has two rooms** (Self Hosting, Linux) against PLY's eight. That is what
  the categories actually contain, not an oversight; the zone is honest about it.
- **Astronomy is pinned to the Cupola** rather than placed by the emptiness
  rule, because it is the only room whose subject is what the room looks at.
- **Room lamps keep their own colours** even though zones have colours. Lighting
  is atmosphere, signage is wayfinding; the two are allowed to disagree.
- **`PLY-08 Recompiles and Decompiles`** is a sub-room with no plinths and no
  links yet: the only room in the building with nothing in it at all.

## The cost table: merged, and what it took

The 112-row cost table is **in**. `src/data.js` holds **192 exhibits across the
47 category rooms**, and `src/plan.js` builds all of them.
`node scratch/merge-costs.mjs` performs the merge in one pass and prints every
move; `--write` is what rewrites the data file.

- **9 rows dropped.** Strong, Movora and Monkey do not exist as described
  (strong.app is a gym log, movora.com sells veterinary orthopaedics,
  monkey.app is a stranger-video app). Melon became Streamlabs Talk Studio.
  Ethereal is what Wireshark was called until 2006, so it is a line on the
  Wireshark plaque, not a plinth. Umanari — the thing the table spelled
  "Unmanarr" — is a Japanese blog about one man's horse-racing prediction
  program. Plus the three genuine duplicates: Docker Desktop, Tdarr Agent,
  Kdenlive.
- **13 wrong URLs corrected**, each verified against the vendor: 010 Editor is
  SweetScape, not "sweetberry"; Vegas is vegascreativesoftware.com and owned by
  Boris FX, not Magix; Lightworks is lwks.com; Subtitle Edit is nikse.dk;
  xEdit's old domain is dead and the project is tes5edit.github.io; Tdarr is
  tdarr.io; TruffleHog is trufflesecurity.com; MelonLoader's docs are
  melonwiki.xyz and melon-loader.com is an SEO clone.
- **8 rows the owner supplied back** were real products with mangled names —
  Drauger OS, FuzzIt (defunct, kept as a headstone), LiveWeb (a hobby repo),
  SAMMI, LioranBoard 2, KubeSpy under pulumi, the Zoom F8N Pro (a field
  recorder, not a "fuzzer"), Board. Two of the owner's corrections did not
  survive checking: Umanari (above) and askfuzz.ai, which is an Indian
  stock-market research service.
- **The "Astra" row is OpenAI's GPT-6 Astra**, not a Kubernetes UI, and sits in
  the Engine. **Charybdis** is an IRC daemon and sits in the Server Alcove.

## Conventions worth keeping

- `src/data.js` is the single source of truth for exhibits and
  `src/identity.js` for the museum's own words. Never hand-edit the built
  `index-v2.html`; `build.mjs` owns it.
- Every dimension in metres lives in `src/scale.js`. `src/plan.js` is geometry
  and walkable space from one frame per room; `src/building.js` is meshes. A
  room's local frame has its doorway at the origin and +Z running in.
- Checks run from the repo root: `check-v2`, `check-scale`, `check-sky`,
  `check-events`, `check-data`, `check-candidates`, `check-props`, `check-tube`,
  `check-placement`, `check-collision`, `check-lights`, `check-keys`,
  `check-pop`, `check-terminator`, `check-lift`. The last four are the ones that
  caught real bugs this pass: the storey test, the cull's thresholds, the Earth
  painted once at boot, and the lift's mid-shaft storey flip.
- Probes and checks live in `scratch/` and **are tracked** — they are how a claim
  in this file can be re-checked a week later. The `.png` evidence they write and
  `scratch/bundle.js` are gitignored. `window.__museum` exposes the live building,
  including `scene`, `rig`, `plan`, `sky`, `lighting` and `built`, and every
  atmosphere mesh carries `userData.atmo`. Note `built.lift` is the cabin's
  Object3D: anything that moves is never part of the welded batch.
- Commit messages are prose, not tickets: what changed and why, in the
  imperative. See `git log`.
- A session that runs unattended keeps a `NIGHT-LOG.md`: a backup table, a
  green baseline, the queue, decisions taken without asking, and a timestamped
  entry per step. After every step: commit, push, `git bundle create` to
  `..\Backups\orbituary-<sha>.bundle`, verify the bundle.
