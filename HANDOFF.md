---
tags: [museum, project, handoff]
updated: 2026-11-14 (third pass)
build: v2
head: bb91cd5
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
| 3 room theming + props | 4 h | **done** — theming in `CHARACTER`, props wired into twelve rooms and the hub, cellar atmosphere in `atmosphere.js` |
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
cellar arms), 16 corridors, 192 links, 198 plinths, 32 rooms with something on
the walls and 19 without. The cellar holds 14 of those empties under a 10 × 8 m
stair hall; the emptiest categories were put there deliberately, so the
basement is the place the museum has not decided about yet.

One storey up: rotunda 16 m across, dome springing at 6.5 m, cupola whose floor
is a hole, a stair down through the mouth. Cellar slab 3.6 m down, 3.2 m of
clear ceiling, and the pressure hull's belly 4 cm above the cellar soffit.
Lighting is a pool of 10 point lights handed between anchors, plus one static
light in the stair hall that the pool does not know about. The bundle is 882 KB
and the Cupola view runs 327 draw calls / 87k triangles / 49 textures.

## What landed on 2026-11-14

| step | commit | what |
|---|---|---|
| 1 | `fa95d34` | the ticket and the brochure: the door is the agreement, and the back of the ticket is the controls, the ask and the socials |
| 2 | `34470f3` | eight zones and a code on every door, plate, board and floor plan |
| 3 | `1c95417` | the four rooms about the museum itself, fitted out from `identity.js` |
| 4 | `84aa968` | the old furniture moved into the new building, and a check that keeps it off the plinths |
| 5 | `bb91cd5` | cellar damp, corner webs, drifting dust |
| 6 | this commit | `README.md` and this file rewritten against what the building is now |

## Waiting on the owner

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
- **Props do not stop you.** `props.js` writes its footprints into
  `plan.obstacles`, and `rig.js` does not read them, so you can walk through a
  workbench. Making them solid is a separate change to the collision, and it is
  the one that could break the walkability proof.

## Known artifacts, and where they stand

- **Hairlines on brightly lit cellar plaster.** Three or four horizontal lines
  across a wall, some stopping in mid-wall, one doubled. Not the atmosphere
  (`scratch/ab-atmo.mjs` proves it), not a stray transparent sheet
  (`scratch/dump-glass.mjs` finds none near the room). The wall is one welded
  buffer — two side runs that overshoot the door and far walls by a full wall
  thickness, a door wall centred on z = 0 with a header box over the opening, a
  far wall centred on z = d — and the lines sit at the heights where those boxes
  meet, so the leading explanation is a coincident-face seam. Only visible when
  a wall is evenly lit from close to.
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
  `check-events`, `check-data`, `check-candidates`, `check-props`.
- Screenshots and probes live in `scratch/` and are gitignored: they are
  evidence, not source. `window.__museum` exposes the live building, including
  `scene`, and every atmosphere mesh carries `userData.atmo`.
- Commit messages are prose, not tickets: what changed and why, in the
  imperative. See `git log`.
- A session that runs unattended keeps a `NIGHT-LOG.md`: a backup table, a
  green baseline, the queue, decisions taken without asking, and a timestamped
  entry per step. After every step: commit, push, `git bundle create` to
  `..\Backups\orbituary-<sha>.bundle`, verify the bundle.
