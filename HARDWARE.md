---
tags: [museum, project, hardware]
updated: 2026-11-14
machine: AMD Ryzen 9 9900X3D · NVIDIA GeForce RTX 5090 · 62 GB
---

# What this machine can run

Written because the owner asked, twice, about hardware and frame rate, and
because every frame-rate number in `NIGHT-LOG.md` is a lie of the same shape:
the checks drive the museum through a headless browser that draws with a
software rasteriser, so they report 2 fps on a machine that will not break a
sweat. This file says what the machine actually is, and what that means for the
two questions on the table — will the museum run, and will a model run.

## The short version

**The museum is not the problem.** Orbituary is one file of 895 KB that asks for
477 pieces of geometry and 125,000 triangles per frame. A modern games machine
draws a city at four million triangles. On this machine the museum is nowhere
near its limit, and the work worth doing on it is correctness and what a visitor
sees, not speed. If the frame rate is ever wrong here, the cause will be a
mistake — a light pool that grew, a texture rebuilt every frame — and the checks
in `scratch/` are how that mistake gets found, not a frame counter.

**A local language model fits with room to spare, up to about 30 billion
parameters.** Above that it stops fitting on the graphics card and starts
running out of the ordinary memory, which is a different and much slower
machine. Details below.

## The evidence, in the order it matters

**The graphics card: NVIDIA GeForce RTX 5090, with 32 GB of its own memory.**
This is the part that decides almost everything. Graphics memory is where a
model or a scene has to sit to be worked on quickly; the card has 32 GB of it,
which is more than most workstations. For the museum it means the whole station —
every room, every material, every texture — sits there permanently with about
31 GB to spare; there is no reason to hide anything from the card for the card's
sake, and the culling that exists is there so the *eye* is not asked to notice a
wing switching on, which is a different problem with a different fix.

For a language model, 32 GB is the line between "fast" and "patient". A model
compressed to four bits per weight needs roughly half a gigabyte per billion
parameters: a 30-billion-parameter model is about 18 GB and lives entirely on the
card. A 70-billion model is about 40 GB, does not fit, and spills into ordinary
memory, where the card has to fetch it across a much narrower road. It will run.
It will run at a couple of sentences a minute rather than a paragraph a second.

**The ordinary memory: 62 GB.** Enough to hold a 70-billion model that has
overflowed the card, and enough to do it while the browser, the museum and the
rest of the day stay open. It is not enough to make that model fast: the road
between this memory and the card is the bottleneck, and no amount of it widens
the road. It is also enough that the museum's own appetite — a few hundred
megabytes for a page holding a building — is invisible.

**The processor: AMD Ryzen 9 9900X3D, 12 cores, 24 threads.** Comfortably enough
for a browser, a local model's bookkeeping, and a build. Its extra cache helps
games more than it helps anything here. It is not the thing that will ever be
waiting on the graphics card.

**The screen: 3440 × 1440 at 143 Hz.** Just under five million pixels, refreshed
143 times a second — a frame every 7 milliseconds. That is the demanding part of
this machine, and it is demanding in a way the museum suits: the museum's cost
per frame is small and mostly fixed, so the post-processing chain (the bloom on
the lamps, the tone mapping) is what will decide whether 143 Hz is reached, not
the geometry. If it ever misses, look at the post chain first.

**Disk: 262 GB free.** The whole museum plus its history of backups is a few
hundred megabytes. A 30-billion model is about 18 GB, a 70-billion one about 40
GB, so models are the only thing here that make a dent.

## What runs, what is tight, what does not fit

- **Comfortably, entirely on the card:** anything up to about 30 billion
  parameters at four-bit compression, and the mixture-of-experts models that
  keep only a few billion weights busy at a time — those run fast even when the
  whole model is larger than the card, because only the part in use needs to be
  near the card.
- **Tight:** a 70-billion model at four-bit compression. It needs about 40 GB,
  the card has 32, so part of it runs out of ordinary memory. It works, and it is
  slow, and the slowness is not something the museum or any code here can fix.
- **Does not fit:** the same 70-billion model at eight-bit compression, about 70
  GB, which is more than the ordinary memory and the card can hold together with
  everything else open. And the hundred-billion-and-up models, which are a
  different machine's business.

## What this changes about the work

Nothing about performance, and that is the point of writing it down. The
decisions left on the museum — the fade at the wing edges, the cellar's exhibits,
the door and window placement, the creatures out of sight, ships outside — are
all decisions about what a visitor notices. The machine is not asking a question.
