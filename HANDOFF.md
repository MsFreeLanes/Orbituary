---
tags: [museum, project, handoff]
updated: 2026-11-13 (second pass)
build: v2
head: b59d59e + the cost-table merge
remote: https://github.com/MsFreeLanes/Orbituary
---

# Handoff — where the museum actually is

Read this with `MUSEUM-V2-PLAN.md` (the locked plan) and `README.md` (what a
visitor sees). This file is only about state: what is finished, what is
half-finished, and what is waiting on a decision.

## Where the build stands against the plan

| Phase | Plan says | Actual |
|---|---|---|
| 0 pipeline, vendor three, tag v1 | 1 h | **done** — `build.mjs`, three bundled, `v1-rotunda` tagged |
| 1 materials, lights, post, watchdog | 2 h | **done** — and the watchdog was rebuilt to keep its own clock |
| 2 architecture, 12 rooms, doors, windows, collision | 3.5 h | **done** — `src/plan.js` + `src/building.js`, walkability proven |
| 3 room theming + props | 4 h | **half done** — theming is in, the prop kit is written but **not wired in** |
| 4 sky: catalogue, sidereal, planets, moon | 3 h | **done** — 16 astronomy checks pass |
| 5 rig, walk, tour, random room | 3 h | **done** |
| 6 footsteps, per-room reverb, tone, SFX | 1.5 h | **done** |
| 7 ambient events + tests | 1.5 h | **done** — 2,000 events checked for clustering |
| 8 checks, offline build, README, zip | 2 h | **done** for the state as of `4bf5af5` |
| 9 acquisitions board, hidden XR button | 0.75 h | **not started** |

**The one loose end in the code:** `src/props.js` (849 lines — `furnish()` and
`furnishRotunda()`) is committed but nothing imports it, so it is not in the
bundle and none of it is visible in the building. Phase 3 ends the moment
`src/building.js` calls it. That is the next piece of work.

## The cost table: merged, and what it took

The 112-row cost table is **in**. `src/data.js` now holds **192 exhibits across
47 rooms**. `node scratch/merge-costs.mjs` performs the merge in one pass and
prints every move; `--write` is what rewrites the data file.

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
- **16 rooms are empty** — Apple Dev, Open Source, Creative Writing,
  Accessibility, Web Extension, GitHub Repo, Science, History and Archives,
  Sports, Journalism, Psychology, Philosophy, Astronomy, Paid, Music, and the
  Recompiles and Decompiles sub-room. They are the basement.

## What is not built yet

The data says 47 rooms; `src/plan.js` still builds 12. Until the plan is
rebuilt, the extra 35 rooms exist only as rows in a file. The rebuild is §10 of
the plan: two concentric ring corridors, radial wedge rooms, a basement grid
under the rotunda, sub-rooms hung off their parents, the ticket-and-brochure
entry, three trophy stands, and random/tour choosing rooms instead of exhibits.

## Conventions worth keeping

- `src/data.js` is the single source of truth. Never hand-edit the built
  `index-v2.html`.
- Every dimension in metres lives in `src/scale.js`; the plan is geometry and
  walkable space from one frame per room, so they cannot disagree.
- Checks are run from the repo root: `check-v2`, `check-scale`, `check-sky`,
  `check-events`, `check-data`, `check-candidates`.
- Commit messages are prose, not tickets: what changed and why, in the
  imperative. See `git log`.
