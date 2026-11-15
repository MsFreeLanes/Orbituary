---
tags: [wiki, coding, plain-language]
updated: 2026-11-15
about: the coding things a non-coder cannot think to ask, and the prompt failures that cost the most
audience: a person who does not write code but directs people (or models) who do
---

# Coding heuristics for someone who does not write code

Everything here is something I learned the hard way on this museum, written so you
can use it without knowing the language. It is paired with `MMMM.md`, which is about
getting good work out of a model; this one is about what the work actually is.

The one-sentence version of each rule is at the bottom, if you want only that.

## A. What a codebase actually is

**It is text files, and they are all readable.** There is no hidden machine. When a
model says "the code assumes X", it means someone wrote a sentence in a file that
is false about the world. That sentence can be found, read, and changed.

**Source and artifact are different things.** This museum is about twenty small
files in `src/` that a build step welds into one 897 KB file you double-click. The
big file is a *result*. Editing it is like correcting a book by writing on the
printing press: the next print run erases your work and you have lost the original.
**Never let anyone edit a generated file.**

**A commit is memory that is not in your head.** Every commit is a dated note saying
"here is the whole project as it was, and here is why it changed". A bundle is the
same thing as a single file you can put on another disk. This is why I commit every
ten minutes: not for tidiness, but so that a wrong hour can be undone.

**A dependency is somebody else's code you now live inside.** The 3D engine here is
three.js. When it changes, our assumptions can become false without our code
changing at all. This is why versions get pinned.

## B. How bugs actually happen

**A bug is a wrong assumption, not a broken machine.** In the last audit pass, the
worst bugs were all sentences that were false: one file reads a field called `t`
while the data table calls it `n`, so every exhibit label in the museum is blank.
That is the whole bug. It is not complicated; it is just wrong in a place nobody
was looking.

**There are two shapes of wrong, and they behave differently.**
*Code disagrees with the world*: the Moon's biggest dark patch is painted on the
wrong half of the disc. Only a check against something outside the code catches it.
*Code disagrees with other code*: the walking rig computes "am I in a doorway" with
the maths turned the wrong way round compared to the file that describes the
building. Nothing inside either file is wrong on its own. **Most expensive bugs are
this second kind**, and the fix is almost always: make one number or one rule live
in one place, and make everything else read it.

**A bug can survive months if nothing is checking it.** Every exhibit label has been
blank for weeks because no test looks at a label. The lesson is not "test more" but
"**a thing you never look at is a thing you never know about**".

**A green check does not mean fine.** Several checks in this project *cannot fail*.
One reports "no corridor is blocked" by sampling only the exact centre line of a
corridor, so a pedestal standing a metre off centre is invisible to it. I quoted
that number to prove my own work was right, and it was wrong. The question to ask
of any check, always: **"what would have to be true for this to fail?"** If nobody
can answer, the check is decoration.

**Fixing the symptom is how you get a second bug.** The doorways in this museum are
drawn plated over with solid plaster, because an earlier fix needed a panel there
to stop two surfaces flickering. The flicker went away and the doors stopped
existing. A good fix explains *why* the first thing was wrong, not just what to
cover it with.

**A fix is only proven by a check that failed before it and passes after.** If a
change cannot be demonstrated, it is a claim, not a fix.

## C. What to ask for (the words that get the best out of a model)

- **"Show me the command you ran and what it printed."** Turns an opinion into a
  measurement. This is the highest-value sentence you can add to any request.
- **"Label each finding: what you saw, what you reasoned, what you suspect."** A
  model will invent less when it has to say how it knows. Two thirds of "reasoned"
  findings turn out correct; treat them as leads, not facts.
- **"What did you not look at?"** Every audit needs this line, because the honest
  answer tells you where the next bug is hiding.
- **"List the decisions you made on my behalf."** Models decide things silently — a
  colour, a threshold, a name. You cannot review what they do not mention.
- **"Tell me what you would change and why, before you change it."** For anything
  bigger than a sentence. It costs one reply and saves a wrong hour.
- **"Which files have to agree about which numbers?"** This is the shape of the
  building. Bugs live in the seams between agreeing files, not inside them.
- **"What is cheap to change now and expensive later?"** So you can spend the
  expensive questions while they are still questions.
- **"Change one thing, then run everything."** Three changes at once means a
  failure tells you nothing.
- **"What is deliberate?"** Say out loud what must not be "fixed". Otherwise a
  helpful reviewer will repair your design decisions, which is the most expensive
  class of damage available.

## D. What costs what (this is intuition, not a price list)

**Cheap:** any text. Colours, sizes, wording, a new check, a new rule, renaming a
thing, adding a piece of furniture.

**Medium:** moving something that has a position in two places at once — a room, a
door, a light fitting. The geometry and the walking rules must both be told.

**Expensive:** anything with a *state* (a door that opens, a lift that remembers
where it is), anything that must *move* (which cannot be welded together with the
static building, so it needs its own machinery), and anything that changes the
*shape* of a space rather than what is in it.

**The rule behind all three: cost follows how many places have to agree, not how
big the change looks.** "Add a railing" can be three lines. "Make the doors open"
can be a week, because now the building has to remember things.

## E. Habits that look like ritual and are not

**Commit small, commit often.** So the distance between "fine" and "broken" is
minutes, not days.

**Write down the dead ends too.** The log is not for you; it is for the next model,
which will otherwise try the same dead end. A log that only records successes is a
map with the swamps removed.

**Numbers live in one file.** Every metre in this museum is a named constant in one
place. When someone writes a bare `0.32` inside a shape, two files can drift apart
forever and nothing will complain. This is the single most common cause of the
"code disagrees with code" bugs above.

**A rule that can never fire is worse than no rule.** There is a safety net in this
project that nudges a pedestal out of a corridor. Its trigger can never be true, so
it has never run, and the report it prints — "everything is clear" — is the sound of
an unreachable piece of code. Dead safety equipment is the worst kind.

**Delete what you do not use.** Unused code looks like a decision, so the next
person is afraid to remove it, and eventually someone builds on it.

**Name things after what they mean.** `CUPOLA_WELL_R` tells you what it is in ten
years. `r2` does not.

## F. Prompt failures, typed — what people type, what happens, what to type instead

1. **"Make it better."** → the model picks its own goal, usually the one that looks
   impressive. → *"The cellar feels dead compared to the galleries. Make it feel
   like a place the museum has not decided about yet, without changing the
   lighting colours."*
2. **"Fix the bug."** → it fixes a plausible bug. → *"When I ride the lift to the
   cellar and walk out, I end up back in the round room. Here is what I did, step by
   step."*
3. **Pasting the whole file instead of the symptom.** → it optimises the file, not
   the problem. → Describe the symptom, then ask it to find the file.
4. **"Why is this broken?"** with no demand for evidence. → a confident story. →
   *"Why is this broken, and what did you run to find out?"*
5. **"Just do X quickly."** → the check that would have caught it gets skipped.
   → Drop "quickly". Ask for the check afterwards if you must.
6. **Accepting "done".** → nothing was run. → *"Run it and show me."*
7. **Asking for a rewrite of something that works.** → you lose the invisible
   knowledge inside it. → Ask for the smallest change that achieves the goal, and
   ask what would be lost in a rewrite.
8. **One giant prompt doing five jobs.** → the last job gets the leftovers. → One
   job per request, and say what the other requests are so it can plan.
9. **Not saying who the thing is for.** → it builds for itself. → *"This is read by
   a visitor standing two metres away, not by me at a desk."*
10. **Not saying what must not change.** → your design decisions get "improved". →
    List them. Every time.
11. **Asking a model to judge something it cannot experience.** It cannot feel
    whether a walk is too slow, and a headless test browser's frame rate says
    nothing about your machine. → Ask it to measure things instead: distance
    travelled, seconds elapsed, pixels on screen — then you judge.
12. **Letting the model choose the priority order.** → you get the interesting work
    and not the important work. → Give the order, or ask for the order with costs
    and approve it.

## G. Reading a report about code when you do not read code

- **A number beats an adjective.** "0.53 m off the centre line" is checkable;
  "slightly misaligned" is not.
- **A file and a line number is a promise you can hold them to.** Any claim about
  code without one is a guess.
- **"I ran" beats "I changed".** If a report says what was changed but never what
  was run, nothing is known yet.
- **"Should" is a red flag.** Ask it to turn every "should work" into "did run,
  printed this".
- **Watch for the missing section.** A report with no "what I did not check" line
  either did not check much or is not telling you.

## H. Words you will keep meeting

**repo** — the project's files plus all its history. **commit** — one saved
snapshot with a reason. **HEAD** — where you are in that history right now.
**bundle** — the whole history as one file, for a backup drive. **branch** — a
parallel history you can try without touching the real one. **merge conflict** —
two people changed the same line and a human must choose. **build** — turning the
source files into the thing you run. **dependency** — someone else's code you
depend on. **regression** — something that used to work and now does not.
**test / check / probe** — a program that asks the project a question and prints a
verdict. **assertion** — one such question. **headless** — running a browser with
no screen, so a machine can drive it. **token** — a chunk of text a model is
charged for; documents and code both cost tokens to read. **context window** — how
much the model can hold in mind at once. **hallucination** — a confident statement
the model made up.

## I. The one-sentence version

1. Code is text, and a bug is a sentence that is false about the world.
2. Never edit a generated file.
3. Commit every ten minutes, and log the dead ends.
4. Most expensive bugs live in the seam between two files that must agree.
5. Every number belongs in one place.
6. Ask what would have to be true for a check to fail; if nobody knows, the check is
   decoration.
7. Ask for the command and its output with every claim.
8. Make the model label what it saw against what it reasoned.
9. Say what must not change, every time.
10. A fix without a check that failed before it is a claim, not a fix.
11. Cost follows how many places must agree, not how big the change looks.
12. Anything with a state or a motion is expensive; anything with text is cheap.
13. A rule that can never fire is worse than no rule.
14. Ask what was not looked at.
15. Give the priority order, or ask for one with costs and approve it.
