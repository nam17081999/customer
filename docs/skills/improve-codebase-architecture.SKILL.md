---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one the user picks.
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones for better testability and AI-navigability.

Uses a shared design vocabulary (see Reference section below).

## Reference: Design vocabulary

Use these terms exactly — don't substitute "component," "service," "API," or "boundary."

- **Module** — anything with an interface and an implementation. Scale-agnostic: a function, class, or package.
- **Interface** — everything a caller must know to use the module correctly: the type signature, invariants, ordering constraints, error modes.
- **Implementation** — what's inside a module.
- **Depth** — leverage at the interface: amount of behaviour per unit of interface. **Deep** = lots of behaviour behind a small interface. **Shallow** = interface nearly as complex as the implementation.
- **Seam** — a place where you can alter behaviour without editing in that place.
- **Adapter** — a concrete thing that satisfies an interface at a seam.
- **Leverage** — what callers get from depth: more capability per unit of interface they learn.
- **Locality** — what maintainers get from depth: change, bugs, and verification concentrate in one place.

### Principles

- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If it reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam.
- **One adapter = hypothetical seam. Two adapters = real seam.** Don't introduce a seam unless something actually varies.

## Process

### 1. Explore

Read the project's domain docs and ADRs first.

Then explore the codebase organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but real bugs hide in how they're called?
- Where do tightly-coupled modules leak across their seams?
- Which parts are hard to test through their current interface?

Apply the **deletion test** to anything suspect.

### 2. Present candidates as an HTML report

Write a self-contained HTML file to the OS temp directory (`$TMPDIR` or `/tmp` or `%TEMP%`). Name it `architecture-review-<timestamp>.html`. Open it for the user.

Use **Tailwind via CDN** for layout, **Mermaid via CDN** for graph-shaped diagrams (call graphs, dependencies, sequences). Mix with hand-built divs/SVG for editorial visuals (mass diagrams, cross-sections).

For each candidate, render a card with:

- **Files** — files/modules involved
- **Problem** — why the current architecture causes friction
- **Solution** — plain English description
- **Benefits** — in terms of locality and leverage, and how tests would improve
- **Before / After diagram** — side-by-side
- **Recommendation strength** — `Strong`, `Worth exploring`, or `Speculative` badge

End with a **Top recommendation** section.

### 3. Grilling loop

Once the user picks a candidate, run `$grilling` to walk the design tree — constraints, dependencies, the shape of the deepened module, what sits behind the seam.

Side effects as decisions crystallize:

- **Naming a deepened module after a new concept?** Add the term to the project's domain docs.
- **Sharpening a fuzzy term?** Update the docs.
- **User rejects the candidate with a load-bearing reason?** Offer to record it (ADR) so future reviews don't re-suggest it.
