---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up. Use when switching context, ending a session, or passing work to another agent.
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the OS temporary directory — not the workspace.

Include a "suggested skills" section listing which skills the next agent should invoke.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information (API keys, passwords, PII).

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the document accordingly.
