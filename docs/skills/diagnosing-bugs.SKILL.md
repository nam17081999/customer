---
name: diagnosing-bugs
description: Diagnosis loop for hard bugs and performance regressions. Use when the user reports something broken/throwing/failing/slow.
---

# Diagnosing Bugs

A discipline for hard bugs. Skip phases only when explicitly justified.

## Phase 1 — Build a feedback loop

**This is the skill.** If you have a **tight** pass/fail signal for the bug — one that goes red on _this_ bug — you will find the cause. If you don't have one, no amount of staring at code will save you.

Spend disproportionate effort here. **Be aggressive. Be creative.**

### Ways to construct one

1. **Failing test** at whatever seam reaches the bug.
2. **Curl / HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright) — drives the UI, asserts on DOM/console/network.
5. **Replay a captured trace.** Save a real network request / payload to disk; replay it through the code path.
6. **Throwaway harness.** Spin up a minimal subset of the system that exercises the bug code path.
7. **Property / fuzz loop.** Run 1000 random inputs and look for the failure mode.
8. **Bisection harness.** Automate "boot at state X, check, repeat" so you can `git bisect run`.
9. **Differential loop.** Run the same input through old vs new version and diff outputs.

### Tighten the loop

Once you have _a_ loop, **tighten** it:

- Can I make it faster?
- Can I make the signal sharper?
- Can I make it more deterministic?

A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is a debugging superpower.

### When you genuinely cannot build a loop

Stop and say so explicitly. List what you tried. Ask the user for access, artifact, or permission to add temporary instrumentation.

### Completion criterion

Phase 1 is done when the loop is **tight** and **red-capable**: you can name **one command** that you have **already run at least once**, and that is:

- [ ] **Red-capable** — it drives the actual bug code path and asserts the **user's exact symptom**.
- [ ] **Deterministic** — same verdict every run.
- [ ] **Fast** — seconds, not minutes.
- [ ] **Agent-runnable** — you can run it unattended.

If you catch yourself reading code to build a theory before this command exists, **stop**.

## Phase 2 — Reproduce + minimise

Run the loop. Watch it go red. Confirm:

- [ ] The loop produces the failure mode the **user** described.
- [ ] The failure is reproducible across multiple runs.
- [ ] You have captured the exact symptom.

### Minimise

Shrink the repro to the **smallest scenario that still goes red**. Cut inputs, config, data, and steps **one at a time**, re-running after each cut.

Done when **every remaining element is load-bearing** — removing any one makes the loop go green.

## Phase 3 — Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them.

Each hypothesis must be **falsifiable**: state the prediction it makes.

> Format: "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

**Show the ranked list to the user before testing.**

## Phase 4 — Instrument

Each probe must map to a specific prediction from Phase 3. **Change one variable at a time.**

Tool preference:

1. **Debugger / REPL inspection** if the env supports it.
2. **Targeted logs** at the boundaries that distinguish hypotheses.
3. **Tag every debug log** with a unique prefix, e.g. `[DEBUG-a4f2]`. Cleanup becomes a single grep.

**Perf branch.** For performance regressions: establish a baseline measurement, then bisect.

## Phase 5 — Fix + regression test

If a correct seam exists for a regression test:

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 feedback loop against the original scenario.

## Phase 6 — Cleanup + post-mortem

Required before declaring done:

- [ ] Original repro no longer reproduces
- [ ] Regression test passes (or absence of seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed
- [ ] Throwaway prototypes deleted
- [ ] The correct hypothesis is stated in the commit message

**Then ask: what would have prevented this bug?** If the answer involves architectural change, hand off to `$improve-codebase-architecture`.
