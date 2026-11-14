---
tags: [museum, project, review, handoff]
updated: 2026-11-14
build: v2
head: 9bf6698
remote: https://github.com/MsFreeLanes/Orbituary
audience: a reviewer whose job is to find and fix defects
---

# Review brief — how to debug this building without breaking it

This file is for whoever (human or machine) is handed Orbituary to **review,
debug and fix**. `HANDOFF.md` is for someone taking the project over and
continuing it; `MUSEUM-V2-PLAN.md` is the locked plan; `README.md` is what a
visitor sees; `NIGHT-LOG.md` is the diary of how the current state was reached,
step by step, including the mistakes. This one is about the mechanics of
changing code here safely: what to run, what the numbers are when nothing is
broken, what must stay true, what is deliberately the way it is, and what is
actually wrong.

## Getting the code and running it

```
git clone https://github.com/MsFreeLanes/Orbituary
cd Orbituary
node build.mjs                 # src/*.js -> index-v2.html (897 KB, one file)
node index-v2.html             # no: open it in a browser. It needs no server.
node scratch/check-v2.mjs      # boots it headless and reports the live scene
```

`index-v2.html` is **generated and tracked**. Never hand-edit it; `build.mjs`
owns it. It must still be included in every commit, because it is the artifact a
visitor uses and the only way to check that a source change survived bundling.

There is no test runner and no `npm test`. Every check is a script in `scratch/`
that drives a real headless Chrome over the Chrome DevTools Protocol through
`scratch/cdp.mjs` (which hands you `{ send, evaluate, sleep, consoleLines }`) and
prints a verdict. Run them from the repo root:

```
node scratch/check-v2.mjs        # boots clean, reports draw calls / tris / errors
node scratch/check-scale.mjs     # every dimension is in scale.js, none unused
node scratch/check-sky.mjs       # 16 astronomy assertions
node scratch/check-events.mjs    # 2000 ambient events, no clustering
node scratch/check-data.mjs      # the exhibit table is well-formed
node scratch/check-candidates.mjs
node scratch/check-props.mjs     # furniture clear of plinths, walls, doorways
node scratch/check-tube.mjs      # the failing fluorescent tubes
node scratch/check-placement.mjs # nothing stands in circulation; plinth repairs
node scratch/check-collision.mjs # 1433 solid circles, 8 tour routes walked
node scratch/check-lights.mjs    # lamps sit at their fittings
node scratch/check-keys.mjs      # H, Shift+H, Tab, E, pointer lock
node scratch/check-pop.mjs       # 223 m walk: appearance/disappearance events
node scratch/check-terminator.mjs# Earth's night side at every hour
node scratch/check-lift.mjs      # 20 assertions on the elevator
```

The probes (`probe-*.mjs`, `shot-*.mjs`) are the same harness aimed at one
question. `shot-*` writes a `.png` into `scratch/` — evidence, gitignored. The
`.mjs` files are **tracked on purpose**: they are how any claim in any document
here can be re-checked a week later. If you fix a bug, add the probe that
demonstrates it.

## The green baseline

These are the numbers when nothing is broken. A change that moves one of them is
a regression unless the commit says why.

| what | value |
|---|---|
| `index-v2.html` | 897 KB |
| boot | console clean, `errors: []` |
| Cupola view | 476 draw calls, 125229 triangles, 376 geometries, 53 textures, 66 programs |
| rooms | 51 (47 category + 4 about the museum), 8 zones, 12 ranges, 16 corridors |
| links / pick nodes | 192 exhibits, 204 pick nodes, **0 pick nodes without an exhibit** |
| collision | 1433 circles (218 plinth, 1187 prop, 28 lift shaft), 0 inert, 0 doors pinched, 0 blocked corridor centrelines |
| tours | 8 routes walked with no clipping |
| pop-in over 223 m | 78 appearance/disappearance events, 43 behind you, 34 ahead, **5 oscillating** |
| lift | 20/20 |
| terminator | correct at every hour |
| keys | `H` walks home, `Shift+H` → (0, 4.5), `Tab` opens the brochure |

**Do not read fps from these runs.** Headless Chrome renders through SwiftShader;
every fps figure in `NIGHT-LOG.md` is the harness, not the machine. The real
machine (Ryzen 9 9900X3D, RTX 5090 32 GB, 3440×1440 @ 143 Hz) is documented in
`HARDWARE.md`, and 476 draw calls is nothing to it. Effort here belongs on
correctness and on what a visitor sees, not on object counts.

## The invariants

Rules the building is built on. Most of the bugs I fixed were violations of one
of these that nothing was asserting.

1. **One frame per room, used by both the geometry and the walkable space.**
   `plan.js` decides where things are; `building.js` only draws it. A room's
   local frame has its **doorway at the origin and +Z running into the room**,
   with the group at `room.entry` and `rotation.y = room.angle`.
2. **The walkable rect axes.** For `{cx, cz, halfX, halfZ, angle}` with
   `st = sin(angle)`, `ct = cos(angle)`, `px = x - cx`, `pz = z - cz`:
   `lx = px*ct - pz*st` is compared against **halfX**, and
   `lz = px*st + pz*ct` against **halfZ** (`plan.js:998-999`). The long axis of a
   corridor is `(sin, cos)`; the short axis is `(cos, -sin)`. A corridor's
   `angle = atan2(dir.x, dir.z)`. The rig's forward vector is
   `(-sin yaw, -cos yaw)` — **not** the rect axis. Mixing these up is the single
   most expensive mistake available here: three probes were doing it and reported
   ten phantom blocked centrelines and nine pedestals standing in corridors that
   were all fine.
3. **Plinth spots are room-local `{u, v, face}`**, `face: Math.PI` meaning "the
   plaque faces the entry wall". World mapping lives in `rig.js:200`
   (`spotToWorld`): rotunda uses `(u, v)` directly, the cupola is mirrored
   `(entry.x - u, entry.z - v)`, everything else is
   `entry.x + u*cos + v*sin`, `entry.z - u*sin + v*cos`.
4. **Anything that moves is never batched.** `batch()` (`building.js:106`) welds
   every static shape into one mesh per material at `flush()`. The lift cabin,
   the tube flicker, dust, water and every animated mesh are separate objects.
5. **Every metre lives in `src/scale.js`** (about ninety named constants). No
   magic numbers in geometry; `check-scale` enforces it.
6. **`src/data.js` is the only source of exhibits, `src/identity.js` the only
   source of the museum's own words.**
7. **Materials come from a factory.** `M.mat(name)` accepts **only** the names in
   `materials.js SPECS` (marble, marbleDark, terrazzo, concrete, concreteDark,
   plaster, plasterDark, oak, oakParquet, woodPanel, brick, steel, hull, carpet,
   velvet, gravel). There is no `panel` spec — for that use
   `M.solid(PALETTE.panel, {...})`. `props.js` builders use their own palette
   through `K.mat(...)`.
8. **Collision is per storey.** Blockers are `{x, z, r, what, floor}` and the rig
   filters by floor. Two storeys sharing a plan position is normal — the cellar
   arms run under the galleries — and is not an invisible wall.

## Traps that cost real hours

- **`window.__museum.view` has no `.camera`.** Use `m.camera`. The full surface is
  `{ THREE, plan, rig, sky, lighting, hud, audio, view, camera, scene, inside,
  LINKS, S, scheduler, built }`, and `built = { group, pickables, cull, anim,
  wings, lift }`.
- **Probe bodies are JavaScript template literals inside a template literal.** No
  backticks inside them, and interpolate Node-side constants with
  `${JSON.stringify(x)}` rather than nesting quotes.
- **PowerShell and `node -e` do not mix.** Nested quotes come out as
  `SyntaxError` or a parser error. Write a `.mjs` file instead — that is why
  there are 118 of them.
- **`git bundle create <path>` needs a rev-list**: `git bundle create <p> --all`,
  or it refuses with "Refusing to create empty bundle".
- **The cull's dwell counts seconds handed in by the frame**, not wall-clock time
  (`building.js:1972` `DWELL`, `:1981` `hold`, and `render.js` passes `dt`). A
  probe that steps the building a hundred times in a heartbeat must pass its step
  time (`check-pop.mjs` passes 0.05) or the dwell will appear to do nothing.
- **`check-collision`'s storey test was deliberately replaced.** It used to ask
  "do two storeys overlap at the same plan position", which is normal here. It
  now asks "is a piece of furniture inert where it actually stands". Do not put
  the old question back.
- **A bad material name does not fail where you'd look.** `M.mat('panel')` gave a
  boot crash reading `Cannot read properties of undefined (reading 'hud')` —
  three files away from the cause.
- **Comparing against `NaN` silently disables a check.** `Math.abs(x - NaN) > 0.01`
  is always false, which is why the Earth was painted once at boot and never
  again. Use `!(Math.abs(a - b) <= 0.01)`.
- **Byte-exact comparison of a built file:** `cmd /c "git show HEAD:index-v2.html > scratch\prev.html"`.
  Redirection inside PowerShell re-encodes and the diff lies.

## The defect queue

Ordered by what I would take first. Each has the evidence that it exists.

**D1 — pedestals on the Observatory deck are hand-tuned numbers.**
`plan.js:700`: `cupola.plinths = [53.3, 86.4, 116.4, 243.6, 273.6, 306.7]`. Those
bearings exist because the twelve 2.6 m spoke strips overlap at the deck radius,
so pedestals can only sit between spokes, and the ring is centred on the well at
`(0, S.CUPOLA_WELL_Z = 0.8)`, 0.8 m off the deck's middle. They are correct today
and land in a spoke the moment the ring radius or the well offset moves. *Fixed*
means computed from the geometry, with the current bearings asserted as the
expected output. Probe: `scratch/probe-deck-ring.mjs`.

**D2 — furniture collision circles come from the drawn bounding box.**
`props.js:180` writes footprints into `plan.obstacles`; `rig.js:192`
(`addBlocker`) turns them into circles, and `rig.js:189` (`inDoorway`)
**silently drops** any circle that lands in a door. Consequences a reviewer can
act on: a prop that moves in a builder needs a hand-written circle; a prop whose
drawn box is much larger than its footprint (the leaning ladder, the pulled-out
flat-file drawer, the toppled box) blocks more than it occupies; and a piece of
furniture placed in a doorway is solid nowhere at all. `check-collision` prints
`furniture inert where it stands: 0`, which proves the circle is where the prop
is — not that it matches the prop. *Fixed* means a probe comparing circle area to
drawn footprint, and an assertion that the doorway exemption never swallows a
whole item.

**D3 — nothing asserts how doors and windows are placed.** Only one case was
fixed: a lone window off-centre in its wall. There is no check that a window
clears a door, that an opening misses a room corner, or that a window's sill and
head respect the lintel. `check-placement.mjs` covers pedestals and furniture,
not openings. *Fixed* means a probe over all 51 rooms' openings with the rules
written down first.

**D4 — the plinth-repair pass has never had to do anything.** `plan.js:926` and
`:952` populate `plan.plinthRepairs`, and every run prints *nothing — every
pedestal clears the circulation*. So the code that nudges a pedestal out of a
corridor is untested in anger. *Fixed* means a synthetic case that forces an
overlap and asserts the repair and the report.

**D5 — wing edges still appear and disappear.** Hysteresis, a look-ahead point
and a 0.35 s dwell are in; over a 223 m walk that is 78 events, 43 going out
behind you, 34 appearing ahead, 5 oscillating. A true alpha fade is **not**
implemented. Look at `building.js:1972-2010` (`DWELL`, `hold`, `spokeCull`) and
`render.js`'s `dt`. Note the trade-off before "fixing" it: a fade needs
transparent geometry in a building whose whole material set is opaque, and 5
oscillations in 223 m is already quiet. Probe: `check-pop.mjs`.

**D6 — sound and effects are not gated to what is visible.** Every room's tube
flicker and every atmosphere mesh animates whether or not the cull has that wing
shown (`built.anim`, and atmosphere meshes carry `userData.atmo`). Not a
performance problem on this machine; it is an attention problem — a drip two
ranges away. *Fixed* means the cull's visible set drives which animators run,
with a probe counting active animators from a few standing positions.

**D7 — the lift shaft is a 3.6 m hole with no doors.** `building.js:1348`
(`buildLift`) builds a glazed shaft, a cabin, and 28 collision circles around the
partition on both storeys. Nothing physical stops a visitor walking into the
well; the circles do. This is **an owner decision** (see below), not an oversight
— but if doors are added they must not be batched if they open.

**D8 — `PLY-08 Recompiles and Decompiles` is the only room with nothing in it
at all**: a sub-room, no links, no plinths, and not a cellar room, so it does not
get the wanted plinth that the fourteen basement rooms get (`plan.js:421`).
Content decision.

**D9 — the built file's line endings churn.** Git warns
`in the working copy of 'index-v2.html', LF will be replaced by CRLF the next
time Git touches it`, and there is no `.gitattributes`. A reviewer who lets git
normalise `index-v2.html` will produce a huge, meaningless diff in a generated
artifact. *Fixed* means declaring the text policy once.

**D10 — creature ambience out of sight, ships and comets outside: not started.**
The cellar has damp, webs and drifting dust, and the sky has the catalogue, the
planets and the moon. Nothing lives out of sight, and nothing passes outside the
windows.

## Deliberate. Do not "fix" these without the owner.

- **Wanted plinths are not pick nodes.** The pointer aims at exhibits; there is
  no plaque behind an empty plinth. `probe-wanted.mjs` asserts
  `pick nodes 204, without an exhibit 0` so this cannot rot.
- **The front door's plate reads *The Observatory*.** The door at (0, 4.5)
  stands on the Observatory's deck ring, which is geometrically true. The hub
  annulus from r 4.6 to r 8 correctly reads *The Rotunda*.
- **SYS has two rooms** against PLY's eight, and **Astronomy is pinned to the
  Cupola** rather than placed by the emptiness rule. Both are the categories as
  they actually are.
- **Empty categories live in the cellar** until something arrives, and the
  fourteen cellar rooms are furnished as storerooms with a WANTED plinth each.
- **Room lamps keep their own colours** even though zones have colours: lighting
  is atmosphere, signage is wayfinding, they are allowed to disagree.
- **The eight zone hexes, the iris transition, and the trophy ladder's missing
  donor threshold** are the previous implementer's picks, flagged for the owner.
- **`src/identity.js` has empty `socials` and a null `donation`** because
  nothing was supplied. The brochure prints *not posted yet* rather than
  inventing a handle. That is the intended behaviour, not a bug.

## Where to read, in order of risk

| file | lines | what to look at |
|---|---|---|
| `src/plan.js` | 1003 | highest risk: geometry and walkable space from one frame. `makeRoom:358`, `layoutPlinths:327`, `PURPOSE_CATS:288`, the wanted plinth `:421`, the deck ring `:700`, `plinthRepairs:926`, `inside:988` with the axis math at `:998` |
| `src/building.js` | 2145 | the biggest file. `batch:106`, `addPlinths:434` (the label position at `:459` is where the 4.72 m bug lived), `buildLift:1348`, `DWELL:1972`, `hold:1981`, `spokeCull:1999`, obstacles `:2067` |
| `src/rig.js` | 641 | walking, collision, routes, tours, the lift ride. `inDoorway:189`, `addBlocker:192`, `spotToWorld:200`, `settle:234`, `blocked:351`, `teleportTo:445` |
| `src/props.js` | 1033 | furniture builders and their footprints. `plan.obstacles:180`, `storage:846`, `BUILDERS:949` |
| `src/sky.js` | 868 | catalogue, sidereal time, planets, moon, terminator |
| `src/lighting.js` | 481 | a pool of 10 point lights handed between anchors, plus one static light the pool does not know about |
| `src/scale.js` | 230 | every dimension in the building |
| `src/hud.js` | 521 | the card, the ticket, the brochure (`subOf:476`) |
| `src/signage.js` | 514 | every painted texture: door plates (`plaqueSheets:74`), plinth labels, the wanted card |
| `src/materials.js`, `src/atmosphere.js`, `src/audio.js`, `src/main.js`, `src/render.js`, `src/data.js`, `src/tube.js`, `src/events.js`, `src/identity.js` | 44–457 | the rest |

## The routine, if you are working unattended

After every step: commit, push, `git bundle create ..\Backups\orbituary-<sha>.bundle --all`,
`git bundle verify` the same path. Commit messages are prose in the imperative —
what changed and why, with the measured numbers, not a ticket reference. A
session that runs without the owner present keeps a `NIGHT-LOG.md` entry per
step, including the attempts that did nothing and why.

## A prompt that works

> Read `REVIEW-BRIEF.md`, then `HANDOFF.md`. Run `node build.mjs` and all fifteen
> `scratch/check-*.mjs` scripts, and confirm the green baseline before changing
> anything. Pick one defect from the queue in `REVIEW-BRIEF.md`, write the probe
> that demonstrates it, fix it, re-run the whole check set, and commit with
> numbers. Do not hand-edit `index-v2.html`. Do not change anything listed under
> *Deliberate* without asking me.
