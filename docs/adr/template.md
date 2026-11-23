# ADR-NNNN: Short present-tense title

- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNNN (link it)
- **Date:** YYYY-MM-DD
- **Deciders:** Names or roles
- **Related:** Issues, PRs, or other ADRs

## Context

What is the situation that forces a decision? State the constraints, the pressures,
and what was true at the time. This section should be readable by someone who joins
the project a year from now and has no memory of the discussion.

Avoid describing the solution here. If a reader cannot tell from this section _why_
a decision was needed, the ADR has not done its job.

## Decision

State the decision in the active voice: "We will …".

Be specific enough that someone can tell whether a future change contradicts it. A
decision that cannot be violated is not a decision worth recording.

## Alternatives Considered

| Alternative | Why it was rejected |
| ----------- | ------------------- |
| …           | …                   |

Record the options that were genuinely on the table, and why each lost. This is the
part that saves the most time later, because it stops the project from relitigating
settled ground.

## Consequences

### Positive

- What this buys us.

### Negative

- What it costs us. Be honest — an ADR with no negative consequences is either
  trivial or dishonest.

### Neutral

- Follow-on work, changed constraints, or things that are now true and simply need to
  be known.

## Compliance

How would someone reviewing a PR know whether it honours or violates this decision?
Point at the code, the tests, or the docs that encode it.

---

## Notes on using this template

- **Numbering** is sequential and permanent. Copy this file to `NNNN-slug.md` using
  the next unused number and never renumber.
- **ADRs are immutable once accepted.** If a decision changes, write a new ADR that
  supersedes the old one and update the old one's status to
  `Superseded by [ADR-NNNN]`. Do not edit the original's Decision section — the value
  of the log is that it records what was believed at the time.
- **Correcting the record** is fine: fixing a typo, a broken link, or a factually wrong
  statement about the code is an edit, not a supersession.
- **Scope.** Write an ADR for decisions that are expensive to reverse or that a future
  contributor could plausibly undo by accident: storage layout, schema shape, trust
  boundaries, protocol choices, dependency commitments. Do not write one for routine
  implementation choices.
- Delete this "Notes" section from real ADRs.
