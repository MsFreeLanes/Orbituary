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

Bundles taken this session:

| time | sha | file |
|---|---|---|
| 00:47 | 6141319 | `..\Backups\orbituary-6141319.bundle` |

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

### 00:44–00:50 — orientation and backups
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

### 00:50–01:20 — step 1: the ticket and the brochure

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
