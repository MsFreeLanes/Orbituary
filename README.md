# Museum of Useful Links

88 hand-picked links, standing around a rotunda under its own sky.

Double-click `index.html`. That is the whole install — one file, no build step,
no server, no tracking, nothing leaves your machine. If WebGL is unavailable the
museum opens as a plain 2D catalogue instead, so it never shows a blank page.

## The room

Twelve wings — Gaming, Creative, Media, Privacy, Tools, Dev, Android, Shopping,
AI, Reading, Linux, Fun — arranged as wedges of a circle, sized by how many
exhibits each wing holds. Plaques are packed inward in rows and rise with radius,
so the back rows read over the front ones the way stadium seating does.

Each wing is a room of its own: a tinted backdrop that fades up behind its
plaques, a name plate set into the dado at eye height, partitions and piers with
a line of light running down them, and a lit path out from the centre. The wedge
is wide where the collection is deep — the Gaming hall is three times the arc of
the Linux one — so the museum reads as a sequence of rooms rather than one ring
of signs.

Overhead there is no ceiling. A nebula dome carries about four thousand stars in
two layers that twinkle out of step, a faint meridian grid, and a handful of
shooting streaks that fire at random. Below it: an oculus shaft of light, a stone
heart turning on a wire armature, drifting dust, and a compass rose inlaid in the
floor.

Every plaque, frame, plinth and floor light is one instanced mesh, and every
piece of text in the room — 88 plaques, 12 banners, 12 hall signs — is typeset
once into a canvas atlas and drawn from a single texture. The whole museum costs
about fifty draw calls.

## The jukebox

`J` flies an eighties deck out of the left wall: a bulleted housing with a chrome
title, a spinning disc, a needle, a row of level-meter bars, and a request column
of twelve titles across two sides.

All twelve are original tunes written as step patterns in the page — scale, chord
ladder, bass line, arpeggio, drum kit — and synthesised live by WebAudio
oscillators. Nothing is downloaded, nothing is a cover, and no audio file ships
with the page. `Space` plays and pauses, the deck remembers the last request and
the volume, and the machine runs on its own audio clock, so it keeps playing
whether the room is rendering or asleep.

## Visiting

| key | what it does |
| --- | --- |
| drag / scroll | orbit the centrepiece, dolly in and out |
| click | open an exhibit and walk the camera to it |
| ← → | previous / next exhibit in the current selection |
| ↑ ↓ | step the camera closer or further away |
| `A` `D` | orbit left / right, hands off the mouse |
| `/` | search the collection |
| `T` | guided tour — the camera walks the wings for you |
| `S` | surprise me with a random exhibit |
| `C` | catalogue view (the same collection as cards) |
| `F` | favourite this exhibit |
| `M` | show only the favourites |
| `J` / `Space` | the jukebox / play and pause |
| `R` | return to the centre of the rotunda |
| `V` | performance readout |
| `?` | visiting notes |

Favourites live in `localStorage` under `museum.favorites`, the deck's last
request and its volume under `museum.jukebox`. Room tone stays off until you
press the speaker in the chrome.

## How the source is arranged

`index.html` is generated — edit the parts and rebuild, or read `index.html`
straight through, since the parts are concatenated in order with section banners.

| part | section |
| --- | --- |
| `00-shell.html` | head, design tokens, all markup |
| `10-open.js` | config, state, DOM handles |
| `15-utils.js` | small helpers, storage, toast |
| `20-data.js` | the 88 links and the wing palette |
| `30-layout.js` | wedge solver: who stands where |
| `40-stage.js` | renderer, lights, architecture, atmosphere |
| `42-sky.js` | the planetarium: nebula, two star layers, shooting stars |
| `50-atlas.js` | plaque and banner typesetting into atlases |
| `55-rooms.js` | the twelve halls: backdrops, partitions, signs, paths |
| `60-exhibits.js` | instanced plinths, frames, plaques, banners |
| `70-camera.js` | rig, flights, orbit input |
| `80-interaction.js` | picking, selection, the info panel |
| `85-motion.js` | fades, visibility, assembly |
| `90-ui.js` | chips, search, favourites, keys, sound |
| `91-jukebox.js` | the deck: twelve step-sequenced tunes, built live |
| `92-catalogue.js` | the 2D fallback view |
| `94-plan.js` | the clickable floor plan |
| `96-tour.js` | the guided tour |
| `98-loop.js` | render-on-demand frame loop |
| `99-boot.js` | staged boot, resize, console handle |

The renderer sleeps when the room is still and wakes on input, so an idle museum
costs nothing. The jukebox is the one thing that carries on: it owns its own
scheduler, and a still room is a quiet room, not a stopped one.

## Working on it

```
node scratch/build.mjs      # parts -> index.html, syntax-checked
node scratch/check-data.mjs # link counts, duplicate URLs, malformed links
node scratch/check-refs.mjs # every identifier used is defined somewhere
node scratch/audit.mjs      # the whole room, checked: 23 checks + the fallback
node scratch/juke.mjs       # drives the deck with real clicks, listens to it
node scratch/shot.mjs <url> <out.png> [waitMs] [expression]
```

Those last three drive an installed Chrome over the DevTools protocol with no
dependencies, so the room can be photographed, probed and photographed again
headless. Once the page is open, `window.museum` exposes the live state:

```js
museum.go(20)                 // fly to exhibit 20
museum.find('video')          // run a search
museum.wing('Gaming')         // solo and fly to a wing
museum.jukebox(3)             // bring the deck out and play request 3
museum.tour(); museum.catalogue();
```

## The collection

Curated by hand, 88 entries, no affiliate links. Two Steam app URLs were
corrected during the build (`Game Compressor`, `3D Controller Overlay`) and one
entry, the GDQ Donation Generator, is served over plain `http://` because that is
how its author publishes it.
