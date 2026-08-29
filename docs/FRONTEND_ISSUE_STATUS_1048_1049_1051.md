# Status: #1048, #1049, #1051 — target code not present on `main`

## Summary

All three issues describe refactor/cleanup work on frontend components that
do not exist in the current `main` branch:

| Issue | Target file(s) | Status on `main` |
|---|---|---|
| #1048 | `frontend/src/components/admin/{UsersTab,WastesTab,DisputesTab}.tsx` | Missing |
| #1049 | `frontend/src/components/OnboardingTutorial.tsx` | Missing |
| #1051 | `frontend/src/pages/ApiPlaygroundPage.tsx` + `components/ApiPlayground` | Missing |

None of these paths exist anywhere in the current tree
(`git log --all -- <path>` and a repo-wide grep for the component names both
turn up nothing reachable from `HEAD`).

## Why

The code did exist at some point, but on commits that are **not ancestors of
`main`**:

- `b0470c7` — "feat(docs,frontend): add interactive API playground" (adds
  `ApiPlaygroundPage.tsx`), later touched by `d6aa6fd` ("remove dead
  components and unused imports"). Neither is an ancestor of `HEAD`.
- `7508cc4` — "feat: Add interactive onboarding tutorial for new users" (adds
  `OnboardingTutorial.tsx`). Not an ancestor of `HEAD`.
- `694739e` — "refactor: split AdminDashboardPage into feature modules"
  (would be the origin of `UsersTab`/`WastesTab`/`DisputesTab`). Not an
  ancestor of `HEAD`.

These commits are reachable in the local repo's object graph (`git log
--all` finds them) but sit on history that diverged from `main` and was
never merged in — there's no revert or deletion commit removing them from
`main`, because they were never on `main` to begin with. Verified via:

```
git merge-base --is-ancestor <commit> HEAD   # false for all three
```

So the issues were filed against a repo state — likely a different branch,
fork, or a later/alternate snapshot — that doesn't match what's actually on
`main` right now.

## Recommendation

Before any of #1048 / #1049 / #1051 can be worked as *refactors*, someone
needs to decide how to reconcile this:

- If the orphaned commits represent real, wanted work: cherry-pick or
  restore the relevant files from `b0470c7`, `7508cc4`, and `694739e` onto
  `main` first, then the refactor tasks in these issues become meaningful.
- If that work was intentionally superseded/abandoned: these three issues
  are stale and should be closed or re-scoped as "build X from scratch"
  feature requests rather than "split/extract/audit existing X" refactors —
  they currently ask to refactor code that isn't there.

No code changes were made for #1048, #1049, or #1051 pending that decision.
#1050 was actionable as-is and is handled separately — see
[`FRONTEND_ERROR_BOUNDARY_STRATEGY.md`](./FRONTEND_ERROR_BOUNDARY_STRATEGY.md).
