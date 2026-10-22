# ADR: Feature-folder layout for frontend domains

- **Status:** Accepted
- **Date:** see git history
- **Deciders:** Scavenger maintainers
- **Issue:** #1474

## Context

Frontend domain code is split across three places. Most of it lives in
`pages/`, `components/` and `hooks/`. Two domains, `features/gamification`
and `features/importWaste`, use a different structure. A contributor adding
new domain code cannot tell which layout to follow, and cross-domain imports
reach into arbitrary files.

## Decision

Each domain lives in `frontend/src/features/<domain>/` with this layout:

```
features/<domain>/
  components/   React components owned by the domain
  hooks/        React hooks owned by the domain
  api/          Network calls and query keys
  schemas/      Validation schemas and types for the domain's input
  __tests__/    Tests for the domain
  index.ts      The public surface. The only file other code may import.
```

Other parts of the app import a feature only through its `index.ts`. An ESLint
`no-restricted-imports` rule in `frontend/eslint.config.js` enforces this, so
`import { x } from '@/features/gamification/badges'` is an error and
`import { x } from '@/features/gamification'` is allowed.

Existing code in `pages/`, `components/` and `hooks/` stays where it is. New
domains use the feature layout. Existing domains move over one at a time, as
their files are next changed.

## Alternatives considered

- **Keep the mixed layout and document it.** This is cheap, but it leaves
  cross-domain imports unenforced and keeps the "where does this go" question open.
- **Move every domain in one change.** This is a large diff that is hard to
  review and does not add much over migrating domains as they are touched.

## Consequences

- New domain code has one obvious home.
- The lint rule makes domain boundaries visible in review. A feature's internal
  files can change without breaking callers that import from `index.ts`.
- Existing domains are still mixed until they are migrated. Reviewers should
  not ask for a full migration in unrelated PRs.
