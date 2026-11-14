# Museum of Useful Links

192 hand-picked links, in a station with fifty-one rooms: thirty-two of them
have exhibits on the walls, fourteen are empty and in the basement, four are
about the museum itself, and one is a sub-room still waiting for its first
plinth. Double-click `index-v2.html`. That is the whole install — one file,
three.js bundled inside, no build step, no server, no CDN, no tracking. It
works from a USB stick on a plane.

`index.html` is the first version of the museum: one rotunda, orbit camera, a
jukebox. It still opens, and it is described at the bottom.

## The building

A domed rotunda sixteen metres across, with four ranges off it and each range
carrying the rooms of its zone; a cupola at the top whose floor is a hole you
look *down* through; one stair down to a cellar of fourteen rooms laid out
under the stair hall; and a pressure hull shrunk over the whole thing, its skin
lying 0.475 m outside the outermost walls. The cellar is where the empty
categories go — the rooms the museum has not filled yet.

Rooms are sized by what they hold. A 6 × 6 m cabinet with one pendant takes up
to six exhibits; an 8 × 6 m gallery takes up to ten; a 12 × 11 m hall with a
6 m tray ceiling takes up to twenty-one. Cellar rooms are 8 × 8 m under a 3.2 m
slab. The floor changes underfoot — terrazzo, oak, brick, marble, concrete —
the ceiling changes overhead, and each room has its own colour of lamp, its own
fog and its own exposure, so walking from the Customs House into the Engine is
a change of air, not just a change of wall colour.

It is drawn at human scale. The eye is 1.65 m off the floor, a cabinet doorway
is 1.10 m wide and a hall doorway 1.80 m, a corridor is 2.60 m, the dome
springs at 6.5 m and the cellar slab is 3.6 m down. Every number lives in
`src/scale.js`, and `node scratch/check-scale.mjs` walks the plan with a 0.28 m
body radius to prove you can get from the centre of the building to the back of
every room — including down the stair — without walking through a wall.

## Finding your way

Fifty-one rooms is more than a visitor can hold in their head, so the museum is
zoned. Eight zones — play, studio, development, systems, security, library,
market, hub — each with a colour, and every room carries a code: the Engine is
`SEC-03`, the Library is `LIB-01`, the Vault is `SEC-04`. The code is on the
plate beside the door, on the top strip of the room's own sign, on the
acquisitions board and on the floor plan, which is keyed by zone. The colour
belongs to the zone; the lamp in the room still belongs to the room.

The twelve ranges are independent of each other, so the renderer stops
submitting the eleven you cannot see from where you are standing.

## The door

There is no account and nothing to scan. The agreement is the door: you take a
ticket, the ticket tears, and the back of it is a brochure — the controls, what
the museum does, the donation ask, and where the owner is on the internet. `H`
opens the brochure again at any time; the rules are also printed at door size
in the Rules Room (`HUB-03`), which is one of four rooms about the museum
itself, along with the Box Office, the Acquisitions Hall and the Trophy Hall.
The trophy stands are empty: sponsor, then donor past a published line, then
the keeper's own work.

The words in those rooms come from one file, `src/identity.js`. Name, parent,
thesis, the six rules, the curation note, the socials, the donation link. It is
the only file the owner has to edit.

## The planet and the vault

The sky is computed, not painted. A J2000 catalogue of real bright stars plus a
procedural field weighted towards the galactic plane, placed by right
ascension and declination and turned by the local sidereal time for the hour
you pick. The moon shows its real phase for that date, and so do the five
visible planets. `node scratch/check-sky.mjs` runs sixteen checks against real
astronomy.

And because the museum is a station, the vault owes one more body: the planet.
The dial is the sky above one of seven regions — USA East, USA Central, USA
West, Europe West, Europe East, Oceania, Asia — and the building floats over
that region's ground track, so Earth hangs below the floor, painted here rather
than downloaded, its terminator swept by the same real sun that lights the
corridors. The Cupola looks down at it through the well; the stair hall looks
up at the same disc through the mouth of the shaft. `G` opens the dial, the
slider runs the hours, and ALWAYS NIGHT keeps it dark whatever the clock says.

## Walking

WASD walks, Shift striding, the mouse looks. You are the camera, 1.65 m up, and
the walls stop you.

| key | what it does |
| --- | --- |
| `W A S D` | walk, back off, sidestep |
| `Shift` | stride |
| mouse | look; click a plinth to open its link |
| `Enter` | open what you are looking at |
| `T` | next stop on the guided walk — the museum walks you there |
| `R` | a random room |
| `G` | the ground-track dial |
| `M` | mute |
| `H` | the brochure |
| `Esc` | stop walking |

The guided walk follows the same route graph the collision uses, eased so it
accelerates and settles like a camera move rather than a slide rule, and an
arrow hangs in front of you pointing the way.

## Sound

No music. The museum has footsteps that change with the floor under them, a
room tone that gets deeper in the big rooms, convolution reverb whose impulse
response is sized to the volume of the room you are standing in, and distant
sounds from the other rooms — a door, footsteps in a corridor, a chime — panned
to the bearing they come from. In the cellar the concrete is laid over damp
earth and says so: a different footfall, a longer reverb, and a drip at random
intervals.

Occasionally something happens in a room you are not in: a light comes up
through the doorway, footsteps pass, a door closes. The scheduler keeps at
least a minute between events, never picks the same room twice inside ninety
seconds, and never runs the same kind of event three times in a row, so it
stays a building that is alive rather than a building that is showing off.

Sound starts on your first click, and the level meter in the corner shows it is
there. `M` mutes.

## Working on it

```
node build.mjs                     # src/ + three -> index-v2.html (one file)
node build.mjs --debug             # same, unminified
node scratch/check-v2.mjs          # plan, walkability, sky, lights, NaN scan
node scratch/check-v2.mjs --shots  # and photograph the spaces
node scratch/check-scale.mjs       # the metric grid, and can a body fit through
node scratch/check-sky.mjs         # sixteen checks against real astronomy
node scratch/check-events.mjs      # 2000 ambient events, checked for clustering
node scratch/check-data.mjs        # every link, its room, its board row
node scratch/check-candidates.mjs  # dry run of the software-costs merge
node scratch/check-props.mjs       # no prop stands on a plinth or blocks a door
node scratch/check-tube.mjs        # the cellar tubes: shape, and glow matching light
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
__museum.scene                       // the whole building, for a probe to walk
```

| part | what it is |
| --- | --- |
| `src/identity.js` | the museum's own words — the one file the owner edits |
| `src/scale.js` | every dimension in metres, in one place |
| `src/data.js` | the 192 links and the category table |
| `src/plan.js` | the building: rooms, corridors, doors, windows, zones, codes, walkable space |
| `src/building.js` | walls with real openings, ceilings, plinths, lamps, the hull |
| `src/props.js` | the furniture: workbenches, easels, presses, vitrines, crates |
| `src/atmosphere.js` | cellar damp, corner webs, drifting dust |
| `src/tube.js` | the shape of a fluorescent that is trying to start |
| `src/materials.js` | canvas-painted PBR maps, glass, the environment probe |
| `src/signage.js` | plaques, door plates, the board — typeset into one atlas per room |
| `src/sky.js` | the planetarium, and the planet |
| `src/lighting.js` | the anchor field and the ten-light pool |
| `src/rig.js` | the visitor: input, collision, the route graph, the walk |
| `src/audio.js` | footsteps, room tone, reverb, distant sounds |
| `src/events.js` | the ambient scheduler |
| `src/render.js` | renderer, bloom, grain, the quality watchdog |
| `src/hud.js` | the ticket, the brochure, the card, the dial, the plan, the plaques |
| `src/main.js` | assembly, moods, picking, keys |

## The first version

`index.html` is the museum before it was a building: twelve wings as wedges of a
circle around an open rotunda, an orbit camera, a nebula dome, and a jukebox
with twelve original synthesised tunes. `index-offline.html` is the same page
with the library already inside it. Its parts are in `scratch/src/`, built by
`scratch/build.mjs`; `node scratch/audit.mjs` checks the whole room.

## The collection

Curated by hand, 192 entries across forty-seven rooms, no affiliate links. Two
Steam app URLs were corrected during the build (`Game Compressor`, `3D
Controller Overlay`) and one entry, the GDQ Donation Generator, is served over
plain `http://` because that is how its author publishes it.

A 112-row software cost table arrived on 2026-11-12 and is merged. It did not
arrive clean: nine rows described products that do not exist, thirteen pointed
at the wrong URL, and three duplicated things already on the walls. Every row
was checked against its vendor before it was allowed a plinth, and the
corrections are recorded in the entry itself. `node scratch/merge-costs.mjs` is
the pass that did it and it prints every move. `HANDOFF.md` carries the state
of the build; `NIGHT-LOG.md` carries the session that finished it.

## What it is for

> The website is basically my go-to apps and links when working on a project or
> having fun. It could be considered an archival of humanity.

The repository is called **Orbituary**. *The Museum of Useful Links* is what the
building itself is called once you are standing in it.
