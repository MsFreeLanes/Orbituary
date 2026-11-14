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
