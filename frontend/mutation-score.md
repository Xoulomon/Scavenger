# Mutation Score History

Tracks mutation testing scores for the critical frontend modules:

- `src/lib/wallet.ts` — Freighter wallet integration
- `src/api/client.ts` — Soroban contract client

Scores are appended automatically by `npm run mutation:score` after each
Stryker run.  The minimum accepted score is **70 %**.

Tool: [Stryker Mutator](https://stryker-mutator.io) via `@stryker-mutator/vitest-runner`
Config: [`stryker.config.cjs`](./stryker.config.cjs)
HTML report: `reports/mutation/index.html` (generated locally, not committed)

| Date (UTC)          | Score | Killed | Survived | Timeout | Total |
|---------------------|-------|--------|----------|---------|-------|
<!-- scores appended here by scripts/record-mutation-score.mjs -->
