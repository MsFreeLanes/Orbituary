# Museum of Useful Links

192 hand-picked links, in a building that is being rebuilt from twelve rooms to
forty-seven, under a sky that is actually tonight's. The page you can open
today still shows the twelve; the collection is already cut for the forty-seven.

Double-click `index-v2.html`. That is the whole install — one file, three.js
bundled inside, no build step, no server, no CDN, no tracking. It works from a
USB stick on a plane.

`index.html` is the first version of the museum: one rotunda, orbit camera, a
jukebox. It still opens, and it is described at the bottom.

## The building

The museum is a domed rotunda with four ranges off it, and each range carries
two side rooms and a hall at its end — twelve rooms for the twelve categories,
plus the empty rotunda in the middle, which holds the acquisitions board and
six plinths that are still waiting for something.

It is drawn at human scale. The eye is 1.65 m off the floor, a doorway is 1.10 m
wide, a corridor is 2.60 m, the rotunda is 16 m across and its dome springs at
6.5 m. Every number lives in `src/scale.js`, and `node scratch/check-scale.mjs`
walks the plan with a 0.28 m body radius to prove you can actually get from the
centre of the building to the back of every room without walking through a wall.

Rooms are sized by what they hold. Gaming has sixteen exhibits and gets a
12 × 11 m hall with a tray ceiling; Linux has two and gets a 6 × 6 m alcove with
a single pendant. The floor changes underfoot, the ceiling changes overhead —
coffered, beamed, trayed, clerestoryed — and each room has its own colour of
lamp and its own fog and exposure, so walking from the Server Alcove into the
Arcade is a change of air, not just a change of wall colour.

Lighting is a fixed pool of ten point lights that get handed from anchor to
anchor as you walk, so the light count never changes and the shaders never
recompile mid-stride. Every room also gets two wall washers and a fixture by the
far wall, because a lamp in the middle of a room leaves the walls black, and a
black wall is what makes a 3D room look like a photograph of a hole.

## The sky

The sky is computed, not painted. A J2000 catalogue of real bright stars, plus a
procedural field, placed by right ascension and declination, rotated by the
local sidereal time for the hour you pick and the region you pick: USA East,
USA Central, USA West, Europe West, Europe East, Oceania, Asia. The moon shows
its real phase for that date. So do the five visible planets.

The oculus in the dome looks up into it, and every room has windows that look
out into the same sky. `G` opens the dial; the slider runs the hours; ALWAYS
NIGHT keeps it dark whatever the clock says.

The moon is the only shadow caster in the building, which is why every ceiling
casts a shadow: a roof that throws none is a roof that lets the whole sky pour
in.

## Walking

WASD walks, Shift striding, the mouse looks. There is no orbit camera any more —
you are the camera, 1.65 m up, and the walls stop you.

| key | what it does |
| --- | --- |
| `W A S D` | walk, back off, sidestep |
| `Shift` | stride |
| mouse | look; click a plinth to open its link |
| `Enter` | open what you are looking at |
| `T` | next stop on the guided walk — the museum walks you there |
| `R` | a random room |
| `G` | the sky dial |
| `M` | mute |
| `H` | help |
| `Esc` | stop walking |

The guided walk follows the same route graph the collision uses, eased so it
accelerates and settles like a camera move rather than a slide rule, and an
arrow hangs in front of you pointing the way.

## Sound

No music. The museum has footsteps that change with the floor under them, a room
tone that gets deeper in the big rooms, convolution reverb whose impulse
response is sized to the volume of the room you are standing in, and distant
sounds from the other rooms — a door, footsteps in a corridor, a chime — panned
to the bearing they come from.

Occasionally something happens in a room you are not in: a light comes up
through the doorway, footsteps pass, a door closes. The scheduler keeps at least
a minute between events, never picks the same room twice inside ninety seconds,
and never runs the same kind of event three times in a row, so it stays a
building that is alive rather than a building that is showing off.

Sound starts on your first click, and the level meter in the corner shows it is
there. `M` mutes.

## Working on it

```
node build.mjs                     # src/ + three -> index-v2.html (one file)
node build.mjs --debug             # same, unminified
node scratch/check-v2.mjs          # plan, walkability, sky, lights, NaN scan
node scratch/check-v2.mjs --shots  # and photograph all thirteen spaces
node scratch/check-scale.mjs       # the metric grid, and can a body fit through
node scratch/check-sky.mjs         # sixteen checks against real astronomy
node scratch/check-events.mjs      # 2000 ambient events, checked for clustering
node scratch/check-candidates.mjs  # dry run of the software-costs merge
node scratch/probe-exposure.mjs    # pixel readback: is the room actually lit
node scratch/probe-keys.mjs        # presses the keyboard and watches the rig
node scratch/probe-tier.mjs        # the quality ladder under load
```

The probes drive an installed Chrome over the DevTools protocol with no
dependencies. Once the page is open, `window.__museum` exposes the live thing:

```js
__museum.rig.teleportTo('gaming')   // stand in a room
__museum.rig.walkTo('privacy')      // walk there
__museum.sky.state                   // lat, lon, lst, sun altitude, moon phase
__museum.view.tier                   // which quality rung the watchdog picked
```

| part | what it is |
| --- | --- |
| `src/scale.js` | every dimension in metres, in one place |
| `src/data.js` | the 88 links and the category palette |
| `src/plan.js` | the building: rooms, corridors, doors, windows, walkable space |
| `src/building.js` | walls with real openings, ceilings, plinths, lamps |
| `src/props.js` | the furniture: easels, racks, vitrines, crates — written, not yet wired in |
| `src/materials.js` | canvas-painted PBR maps, glass, the environment probe |
| `src/signage.js` | plaques and door plates typeset into one atlas per room |
| `src/sky.js` | the planetarium |
| `src/lighting.js` | the anchor field and the ten-light pool |
| `src/rig.js` | the visitor: input, collision, the route graph, the walk |
| `src/audio.js` | footsteps, room tone, reverb, distant sounds |
| `src/events.js` | the ambient scheduler |
| `src/render.js` | renderer, bloom, grain, the quality watchdog |
| `src/hud.js` | the card, the sky dial, the floor plan, the plaques |
| `src/main.js` | assembly, moods, picking, keys |

## The first version

`index.html` is the museum before it was a building: twelve wings as wedges of a
circle around an open rotunda, an orbit camera, a nebula dome, and a jukebox with
twelve original synthesised tunes. `index-offline.html` is the same page with the
library already inside it. Its parts are in `scratch/src/`, built by
`scratch/build.mjs`; `node scratch/audit.mjs` checks the whole room.

## The collection

Curated by hand, 192 entries, no affiliate links. Two Steam app URLs were
corrected during the build (`Game Compressor`, `3D Controller Overlay`) and one
entry, the GDQ Donation Generator, is served over plain `http://` because that is
how its author publishes it.

A 112-row software cost table arrived on 2026-11-12 and is merged. It did not
arrive clean: nine rows described products that do not exist, thirteen pointed at
the wrong URL, and three duplicated things already on the walls. Every row was
checked against its vendor before it was allowed a plinth, and the corrections
are recorded in the entry itself. `node scratch/merge-costs.mjs` is the pass that
did it and it prints every move. `HANDOFF.md` carries the state of the build.

## What it is for

> The website is basically my go-to apps and links when working on a project or
> having fun. It could be considered an archival of humanity.

The repository is called **Orbituary**. *Museum of Useful Links* is what the
building itself is called once you are standing in it.
