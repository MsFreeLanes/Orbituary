---
tags: [wiki, prompting, models]
updated: 2026-11-15
about: how to get good work out of AI models, gathered from the vendors and from this project
audience: the models themselves, and anyone writing a prompt for one
---

# MMMM — the Many Model Master Model

A short wiki of what actually works when you ask a model to do work. It is written
**for models to read** as much as for people: if you paste this file into a new
session, the model on the other end should behave better. It is not about this
museum's design rules — those live in `REVIEW-BRIEF.md` and `HANDOFF.md`.

Two sources: the vendors' own current guidance, fetched and dated below; and what
this project measured, which sometimes agrees and once flatly contradicted them.

## 1. Ten rules that hold across every vendor

Each one names the failure it prevents. These are ordered by how much damage they
stop, not by how obvious they sound.

1. **Say what done looks like, and how to prove it.** *"Fix the lift"* produces a
   patch. *"The visitor boards at the cabin door and ends up inside the shaft at
   level −0.51; done means `check-lift` still passes and a new probe shows the
   arrival point walkable"* produces a fix. Failure prevented: a confident change
   that does not address the symptom.
2. **Give the rules the code depends on, before the code.** This project's eight
   invariants — the walkable rect axes, "anything that moves is never batched",
   "every metre lives in `scale.js`" — turned six auditors into auditors who report
   violations instead of style opinions. Failure prevented: well-meaning "fixes"
   that quietly break a deliberate decision.
3. **Demand the evidence with the claim.** Ask for the command and its output, not
   the verdict. Two auditors independently found the same axis bug and both showed
   their arithmetic; the one that only asserted was wrong. Failure prevented:
   confident nonsense.
4. **Separate *seen* from *reasoned*.** Ask the model to label every finding by how
   it knows. This is the single cheapest quality lever available and no vendor
   document mentions it. Failure prevented: a guess being treated as a fact, then
   "fixed".
5. **Tell it what not to touch.** A list of deliberate decisions — the front door's
   name, the empty plinths, the zone colours — stopped a reviewer from "repairing"
   the design. Failure prevented: the most expensive class of regression, the one
   that looks like an improvement.
6. **Scope the job, then stop.** *"Read only, change nothing, at most twelve
   findings, under 1000 words"* produced more usable output than an open-ended
   audit that ran out of budget mid-file. Failure prevented: a huge, half-finished,
   unusable answer.
7. **Match the instruction style to the model type.** OpenAI's own guidance:
   reasoning models want a goal and trust ("a senior co-worker"); non-reasoning
   models want explicit steps ("a junior co-worker"). Same task, two prompts.
   Failure prevented: over-directing a strong model into a worse answer.
8. **Examples beat adjectives.** Three to five worked examples of the output you want
   outperform any amount of "be thorough, be careful". Make them diverse or the
   model copies the wrong pattern. Failure prevented: format drift.
9. **Put the long material above the question.** Anthropic measures up to 30 %
   quality gain from placing documents at the top and the query at the end of a
   long prompt. Failure prevented: the model skimming your 40 KB of context.
10. **Ask for the general solution, forbid the workaround.** Both Anthropic and
    OpenAI warn about models optimising for the test rather than the problem.
    *"Implement the actual logic, do not hard-code values that satisfy the test"*
    is a real instruction with a real effect. Failure prevented: green checks over
    a broken building — which is exactly what this project's test layer turned out
    to be (see `MASTER-BUGS.md` Tier 4).

## 2. What the vendors say, with dates

Fetched 2026-11-15. Vendor documentation moves: two of the six URLs I tried a week
ago now 404 or redirect to a different domain. **Link to a vendor's index page, not
a leaf page**, and quote the rule rather than the link.

**Anthropic — Claude Platform docs, "Prompt engineering overview" and "Prompting
best practices"** ([overview](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview),
[best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)).
Their framing is that prompting is not the first move: you need a success criterion
and a way to test against it *before* you tune words. Then: be clear and direct —
"think of the model as a brilliant new employee who lacks context on your norms";
the test they give is *show your prompt to a colleague with no context — if they'd
be confused, the model will be too*. Add the **why** behind a rule, because the
model generalises from motivation ("never use ellipses, a speech engine will read
them aloud" beats "never use ellipses"). Use XML tags to separate instructions,
context, examples and input. 3–5 diverse examples. Long documents at the top, query
at the end. Quote relevant passages before acting on them. Tell it what **to** do
rather than what not to do. For agentic coding: read before claiming
("never speculate about code you have not opened"), do not over-engineer ("a bug
fix doesn't need surrounding code cleaned up"), do not optimise for the tests, clean
up temporary files. They also document **subagent overuse** as a current failure
mode and give a damping prompt — relevant here, because this project runs six to
seven auditors at a time.

**OpenAI — "Prompt engineering"** ([guide](https://developers.openai.com/api/docs/guides/prompt-engineering)).
Their framing is structural: roles as levels of authority (developer instructions
outrank user input; think of developer as the function and user as its arguments);
a prompt shaped as Identity → Instructions → Examples → Context; Markdown for
hierarchy and XML for boundaries; pin production to a named model snapshot and build
evaluations, because "even different snapshots within the same family produce
different results". The reasoning-versus-GPT distinction is theirs and it is the
most useful line in either document: **reasoning models do better with high-level
guidance, GPT-style models do better with precise instructions.** For coding
agents: define the role, require tests, give tool-call examples, and make the agent
plan and then check that every sub-request was resolved before it stops.

**Google — Gemini and Vertex.** Both prompting pages moved; `ai.google.dev` now
redirects to AI Studio and the Vertex prompt-design guide 404s. What has been stable
across their material is the vocabulary: **prompt = instruction + context +
input/output example**, zero/one/few-shot as explicit choices, and a strong
recommendation to be specific about tone, audience, format and length. Treat their
current index ([ai.google.dev](https://ai.google.dev/)) as the citation rather than
any deep link.

**Meta and Mistral.** Both have restructured their docs; the prompt-engineering
pages I used are gone. Their durable advice, which matches the others: chat models
want a system turn that sets behaviour and a user turn that sets the task, and
instruction-following degrades sharply with nested, conditional wording.

**Where the vendors agree:** clarity beats cleverness; examples beat adjectives;
structure beats length; test before you tune; and the model will do something
unrequested if you leave the boundary undefined.

**Where they disagree:** structure. Anthropic pushes XML tags and motivation;
OpenAI pushes roles, Markdown and schema-shaped output. Neither claim generalises —
which is itself the lesson: **prompting is per-vendor and per-generation, so keep
the prompt next to the model name it was written for.**

## 3. What changes between generations (read this before reusing an old prompt)

From the vendors' own migration notes, fetched above. Every one of these was once a
trick that worked and is now a trick that hurts:

- **Prefilled answers are going away.** Anthropic now rejects a partial assistant
  message on the last turn for current models. The old trick of starting the reply
  to force a format is dead; use a schema instead.
- **Thinking budgets became an effort dial.** Manual token budgets for thinking are
  rejected on current models; you set effort, not a budget.
- **Anti-laziness prompting now backfires.** Prompts written to push older models to
  try harder over-trigger newer ones. Anthropic explicitly says to *reduce* that
  guidance when migrating.
- **Verbosity is model-specific and not controllable by effort.** One generation
  gets longer no matter the dial; the next writes fewer progress updates. Ask
  explicitly, in words, for the length you want.
- **Subagent delegation is now automatic, and often excessive.** Say when
  delegation is warranted, or it will spawn a helper to run one search.
- **Model names in a prompt are a dependency.** Pin the snapshot; a prompt is a
  piece of code with a version attached.

## 4. Three habits this project measured that no vendor document states

1. **Ask for confidence labels and you get fewer inventions.** Every auditor here
   had to mark a finding *seen*, *reasoned* or *suspected*. Findings marked *seen*
   came with a command and an output; the *reasoned* ones were right about two
   thirds of the time, which is exactly the reliability you should pay for.
2. **A model that is told to run the checks will find bugs in the checks.** The most
   valuable findings in `MASTER-BUGS.md` — assertions that can never fail — came
   from auditors instructed to distrust the measuring instruments, not the code.
3. **Two independent passes over the same file agree on the bugs that matter and
   disagree on the rest.** The axis-transposition bug and the open shaft were each
   found twice from different starting files. Single-pass findings are worth about
   half as much.

## 5. A prompt skeleton that works on any of them

```
<role>who you are and what you are not</role>
<invariants>the rules that must stay true; what is deliberate and must not be
"fixed"</invariants>
<task>one job, its boundary, and what done means including the command that
proves it</task>
<evidence>every claim carries file:line, how you know, and a label: seen / reasoned
/ suspected</evidence>
<limits>how many findings, how long, what you may run, what you must not change,
one at a time if a shared resource is involved</limits>
<output>the exact shape, in the order you will read it</output>
```

Paste the invariants even if the model has seen them before. Context is not memory,
and a paid model charged by the token is cheaper than a wrong fix.
