---
tags: [museum, project, decisions]
updated: 2026-11-15
head: 96ce00e
about: the questions whose answers change what a paid reviewer should do
---

# Questions for the owner — answer these and a reviewer stops guessing

Every question below either **blocks a fix** or **changes which fix is right**.
Each one has the default I would proceed on, so a reviewer working on limited
usage never has to wait: if an answer is not here by the time they reach it, they
take the default, note that they took it, and move on. Nothing here needs a
decision before the museum boots.

The cheap wins are Q1, Q2 and Q6 — one word each, and they unblock the two
biggest fixes and the whole content question.

## Q1 — Is the front door still *The Observatory*?

The door at (0, 4.5) stands on the Observatory's deck ring, so its plate reads
*The Observatory* and the hub annulus from r 4.6 to r 8 reads *The Rotunda*.
Geometrically true; possibly not what a visitor expects from a front door.

- **Blocks:** the door-plate work in `MASTER-BUGS.md` B22 (plates clipped by the
  corridor ceiling). A fix touches the plate text at the same time.
- **Default:** keep it. It is honest, and "you enter the museum through the
  telescope room" is a good idea for a station museum.
- **If you want a different name:** say the name. One string in `plan.js`, and the
  plate, the brochure and the ticket all follow from `identity.js`.

## Q2 — Do the fourteen cellar rooms get first exhibits, and does anything go
downstairs?

Fourteen storerooms are furnished, lit, damp, and hold an empty WANTED plinth
each. There are no links in any of them, so there is nothing to read and nothing
to click. This is the largest empty space in the museum and it is a content
decision, not a code one.

- **Blocks:** whether the cellar needs a pick-node path at all (it currently has
  none, by design), and whether `PLY-08 Recompiles and Decompiles` — the only room
  with nothing in it at all — should be a cellar room instead.
- **Default:** leave them empty. The museum is a hand-picked archive; inventing
  fourteen links to fill a room would be worse than the empty plinth.
- **What I need from you if the answer is yes:** the links themselves, or the
  categories you want fed first. I will not choose what the museum is about.

## Q3 — Should the lift shaft get doors, a gate, or nothing?

The question changed shape during the audit. It used to be "should an open shaft
look honest". Now it is "what stops a visitor walking into a 3.6 m hole", because
the shaft's east and south edges have no collision at all and the stair well
beside it is walkable air (`MASTER-BUGS.md` B03, B04).

- **Blocks:** B03 and B04, which are Tier 1. Blocking is not optional; the *look*
  is.
- **Default:** block the openings with the geometry that is already there — the
  glazed shaft wall continued, and a parapet or railing at the well — and add no
  doors. Doors that open must not be batched, which is extra machinery.
- **If you want doors:** they need a state, a sound, and to live outside `batch()`.
  Say so before a reviewer builds the wrong thing.

## Q4 — What is the donor threshold on the trophy ladder?

Trophy Hall has three empty stands and a ladder with no rung heights. `identity.js`
has no number, so the brochure prints nothing rather than inventing one.

- **Blocks:** only the Trophy Hall text. Nothing else.
- **Default:** leave it blank. It is your money and your name, not a design
  decision.

## Q5 — The eight zone hexes, and the iris transition

Both are my picks, flagged in `REVIEW-BRIEF.md` under *Deliberate*. The hexes are
the wayfinding spine — every door plate, board and floor plan carries a zone code —
and the iris is the wipe between the ticket and the museum.

- **Blocks:** nothing. A reviewer has been told not to touch them.
- **Default:** keep. If a hex or a colour is wrong for a zone, name it and it is a
  five-minute change in one table.

## Q6 — Which of the 68 findings should a paid reviewer actually fix?

I would spend the budget in this order and stop when it runs out:

1. **B01** the blank plaque title — one field name, 192 exhibits, the single most
   visible defect.
2. **B02** the plated-over doorways — you currently walk through a wall into every
   room.
3. **B03 + B04** the two holes in the rotunda floor.
4. **B05 + B06** the lift failing to deliver, and slamming 3.6 m in one frame.
5. **B08** the doorway exemption box rotated by twice the bearing on the diagonal
   spokes — 16 of 51 doors.
6. **T01–T04** the checks that cannot fail, because every later fix depends on
   being able to trust them.

- **Default:** that list, in that order, one commit each with numbers.
- **What I would not spend paid-model time on:** Tier 3 (fragile code, dead
  branches, unused constants) and the sky's astronomy refinements (B46–B49). Those
  are right for a free or local model with a precise instruction.

## Q7 — Do you want the museum played before it is fixed?

An agent can drive the rig headlessly — walk, look, open plaques, ride the lift —
and report what it experienced, and there are tools that let a model do it with
screenshots. It costs time and it will not find the bugs already in
`MASTER-BUGS.md`; it finds *feel* problems: the walk too slow, the lift ride too
long, the cellar too oppressive, a room you pass without noticing.

- **Default:** no, not until Tier 1 is fixed. Playing a museum with holes in the
  floor wastes the run.
- **If yes:** say what you want judged — wayfinding, atmosphere, pacing — because a
  playthrough without a question produces a list of things already in the bug file.

## Q8 — Where should the reviewer's fixes land?

- **Default:** straight onto `main`, one commit per defect, each with the probe
  that demonstrates it and the numbers before and after, pushed and bundled as
  usual. No branch, no pull request: this project has one owner and one reviewer at
  a time, and a branch would only cost you a merge you have to reason about.
- **If you want a branch:** say `fix/tier1` and I will keep `main` at `96ce00e`.

## Q9 — `src/identity.js` is still mostly empty

`socials` is empty and `donation` is null, so the brochure prints *not posted yet*.
That is intended behaviour, not a bug — but it is the one file where only you can
write the content.

- **Needed whenever you have it:** the handles, the donation link, the donor
  threshold, and any sentence about the museum you want in the Rules Room or the
  Acquisitions Hall. `identity.js` is the only source for the museum's own words;
  nothing else has to change.

## Q10 — Do you want the astronomy made honest?

The sidereal clock, the terminator and the star catalogue are correct — checked
against textbook values. What is not honest is the solar system: planets are placed
from a heliocentric mean longitude used as a geocentric one, so Venus can stand
opposite the sun; the Moon's largest mare is painted on the wrong half of the disc;
the Milky Way's bulge is 32.6° off; the crescent never tilts (B18, B19, B46, B49).

- **Blocks:** nothing. They are Tier 2 and Tier 3.
- **Default:** fix the two that are visible from the Cupola (B18, B19) with a free
  model, and leave the planet positions unless you care about them. A visitor
  cannot tell a wrong elongation from a right one; they can tell Mare Imbrium
  being on the wrong side of the Moon.
