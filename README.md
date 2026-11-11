# Museum of Useful Links

88 hand-picked links, standing around a rotunda you can walk.

Double-click `index.html`. That is the whole install — one file, no build step,
no server, no tracking, nothing leaves your machine. If WebGL is unavailable the
museum opens as a plain 2D catalogue instead, so it never shows a blank page.

## The room

Twelve wings — Gaming, Creative, Media, Privacy, Tools, Dev, Android, Shopping,
AI, Reading, Linux, Fun — arranged as wedges of a circle, sized by how many
exhibits each wing holds. Plaques are packed inward in rows and rise with radius,
so the back rows read over the front ones the way stadium seating does.

Each exhibit is a plinth, a frame, a printed plaque, and a floor light. The
plaque text is drawn once into a single 10×9 canvas atlas and every plaque in the
room is one instanced draw call with a custom shader; the same is true of the
plinths, frames, lights, columns, and wing banners. The whole room draws in about
a dozen calls.

Overhead: an oculus shaft of light, a stone heart on a wire armature, drifting
dust, a colonnade, and a compass rose inlaid in the floor.

## Visiting

| key | what it does |
| --- | --- |
| drag / scroll | orbit the centrepiece, dolly in and out |
| click | open an exhibit and walk the camera to it |
| ← → | previous / next exhibit in the current selection |
| ↑ ↓ or A D | zoom, orbit |
| `/` | search the collection |
| `T` | guided tour — the camera walks the wings for you |
| `S` | surprise me with a random exhibit |
| `C` | catalogue view (the same collection as cards) |
| `F` / `M` | favourite this exhibit / favourites only |
| `R` | return to the centre of the rotunda |
| `V` | performance readout |
| `?` | visiting notes |

Favourites are kept in `localStorage` under `museum.favorites`. The room is
silent until you press `M`.

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
| `50-atlas.js` | plaque and banner typesetting into atlases |
| `60-exhibits.js` | instanced plinths, frames, plaques, banners |
| `70-camera.js` | rig, flights, orbit input |
| `80-interaction.js` | picking, selection, the info panel |
| `85-motion.js` | fades, visibility, assembly |
| `90-ui.js` | chips, search, favourites, keys, sound |
| `92-catalogue.js` | the 2D fallback view |
| `94-plan.js` | the clickable floor plan |
| `96-tour.js` | the guided tour |
| `98-loop.js` | render-on-demand frame loop |
| `99-boot.js` | staged boot, resize, console handle |

The renderer sleeps when the room is still and wakes on input, so an idle museum
costs nothing.

## Working on it

```
node scratch/build.mjs      # parts -> index.html, syntax-checked
node scratch/check-data.mjs # link counts, duplicate URLs, malformed links
node scratch/check-refs.mjs # every identifier used is defined somewhere
node scratch/shot.mjs <url> <out.png> [waitMs] [expression]
```

`shot.mjs` drives an installed Chrome over the DevTools protocol with no
dependencies, so the room can be photographed and inspected headless. Once the
page is open, `window.museum` exposes the live state for poking at it:

```js
museum.go(20)                 // fly to exhibit 20
museum.find('video')          // run a search
museum.wing('Gaming')         // solo and fly to a wing
museum.tour(); museum.catalogue();
```

## The collection

Curated by hand, 88 entries, no affiliate links. Two Steam app URLs were
corrected during the build (`Game Compressor`, `3D Controller Overlay`) and one
entry, the GDQ Donation Generator, is served over plain `http://` because that is
how its author publishes it.
