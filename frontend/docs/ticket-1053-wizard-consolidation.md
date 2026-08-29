# Ticket #1053 — Consolidate wizard step components in `components/wizard`

**Status: out of scope as written.** `frontend/src/components/wizard` does not
exist in this repo, and there is no multi-step wizard pattern anywhere in the
codebase to consolidate. Verified via `find frontend/src -iname "*wizard*"`
(no results) and a repo-wide search (no other branch has it either).

The closest thing today is `frontend/src/pages/LoginPage.tsx`, which has a
two-phase flow (connect wallet → registration form), but it's driven by plain
`useState`/`useEffect` inline in the page, not a reusable step abstraction.

## Recommendation

Close or re-scope this ticket until a real multi-step wizard exists in the
product (e.g. a multi-step waste-submission or onboarding flow). Re-file it
against the PR that introduces the first wizard, once there are at least two
step components to actually deduplicate against each other.

## Guidance for whoever builds the first wizard

To avoid needing this refactor later, build the first wizard against a shared
`useWizardSteps` hook from day one rather than writing step-navigation logic
per-component:

- `useWizardSteps(steps: Step[])` should own: current step index, a
  `canAdvance` gate driven by per-step validation, and `next()`/`back()` that
  refuse to move forward when the current step is invalid.
- Individual step components should only render fields and report validity
  upward (e.g. via a schema or a `isValid` callback) — they should not own
  navigation state themselves.
- Put the hook in `frontend/src/hooks/useWizardSteps.ts` and the step
  components under `frontend/src/components/wizard/`, following the
  `context/README.md` convention: transient wizard-in-progress state is
  component-local/hook-owned, not global Context or React Query state.
