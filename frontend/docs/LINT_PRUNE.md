# Unused export check (`lint:prune`)

`pnpm --filter scavngr-frontend lint:prune` runs `ts-prune` (pinned to `0.10.3` in `devDependencies`).

## Known false positives (ignored by the script)

- `*.stories.tsx` / `*.stories.ts`: Storybook loads these by file, so their named exports are never imported.
- `index.ts` / `index.tsx`: barrel files re-export components for consumers outside the module.
- `src/test-utils/**`: shared test setup and MSW handlers are imported by Vitest config, not by app code.
- `*.d.ts`: ambient type declarations.

## Current status

The check is report-only for now (no `--error`). It lists about 265 genuine unused exports
that have not been removed yet. Clean these up, then add `--error` back to the script so the
check fails the build.
