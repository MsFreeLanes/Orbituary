---
tags: [museum, project, handoff]
updated: 2026-11-13
build: v2
head: f89ab78 — wip: a prop kit and twelve room builders
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

## The pending decision: the software-costs table

On 2026-11-12 a 110-row cost table (`software-costs.md`) was handed over with
instructions to add it to the project and remove duplicates. It is **transcribed
but not merged**. Nothing in `src/data.js` has changed; the collection is still
88 entries.

- `scratch/candidates-software-costs.js` — the table in the museum's own entry
  shape, cost attached, my proposed room for each.
- `scratch/check-candidates.mjs` — dry run. `node scratch/check-candidates.mjs`
  prints everything below; re-run it before merging.

What the dry run found:

- **110 rows in, 88 already hung.** Merging as-is gives 198 exhibits.
- **4 collisions with the live collection:** Docker Desktop (we have Docker),
  Obsidian Canvas (we have Obsidian), Lazydocker (near-name only, keep), and
  Kdenlive, which was dropped from the table on transcription because the
  Atelier has had it since v1.
- **1 collision inside the table:** Tdarr and Tdarr Agent are the same project.
- **8 rows point at domains that do not resolve at all** — Drauger, FuzzIt,
  LiveWeb, SAMMI, F8N-Scanner, LioranBoard, Unmanarr, KubeSpy. There is no
  product behind them and nothing to put on a plinth.
- **9 more resolve to something else entirely** — Strong, Ethereal, Monkey,
  Melon, Astra, Charybdis, Movora, MelonLoader, Gopass. Spot-checked three of
  them: ethereal.ai is a fintech API, melon.com is Korean e-commerce,
  charybdis.org is an IRC daemon.
- **13 rows are real products with the wrong URL** — Lightworks, Cockpit,
  Hoppscotch, Tdarr, Open3D Engine, Subtitle Edit, TruffleHog, 010 Editor,
  Substance, Vegas, Notion, Metasploit, xEdit. Corrected URLs are already in
  the candidate file.
- **The building does not hold the result.** Creative would take 52 exhibits
  (plinths 0.76 m apart), Dev 33 (1.22 m), Media 30 (1.53 m). The plan's
  turning circle is 1.50 m and the largest room is 12 × 11 m.

**Blocked on three answers:** drop or keep the 17 unverifiable rows; whether to
split the big rooms / add rooms / cap the rooms; and whether cost belongs on a
plaque at all. See the plan's Decisions table — rooms are locked to the twelve
categories that already have links, so any answer that adds rooms reopens that.

## Conventions worth keeping

- `src/data.js` is the single source of truth. Never hand-edit the built
  `index-v2.html`.
- Every dimension in metres lives in `src/scale.js`; the plan is geometry and
  walkable space from one frame per room, so they cannot disagree.
- Checks are run from the repo root: `check-v2`, `check-scale`, `check-sky`,
  `check-events`, `check-data`, `check-candidates`.
- Commit messages are prose, not tickets: what changed and why, in the
  imperative. See `git log`.
