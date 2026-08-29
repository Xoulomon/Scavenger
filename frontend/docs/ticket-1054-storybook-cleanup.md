# Ticket #1054 — Remove unused Storybook stories and orphaned snapshots

**Status: out of scope as written.** There is nothing to clean up:

- No `*.stories.tsx` files exist anywhere under `frontend/src` (including no
  `frontend/src/stories` directory).
- No `.storybook/` config directory exists.
- No `@storybook/*` packages are in `frontend/package.json`, and there is no
  `storybook`/`build-storybook` script to "run ... to confirm no broken
  stories."
- `frontend/e2e` does not exist, so there are no `__snapshots__` to audit
  either.
- There is no test runner configured at all (no `vitest`/`jest`, no `test`
  script in `package.json`).

## Recommendation

Close this ticket. Storybook was never set up in this repo, so there's no
drift to fix. If Storybook is wanted going forward, that's a separate
"introduce Storybook" ticket, not a cleanup one — this ticket as scoped
assumes tooling that doesn't exist yet.
