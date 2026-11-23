# Scavenger Mobile App

> ⚠️ **Status: Archived**
>
> This directory is an archived shell of an earlier mobile initiative.
> All source files (`src/`) were removed in issue #1785 as unmaintained
> dead code that was never built or tested in CI and was not part of any
> release.
>
> **Do not add new code here without first opening a revival proposal.**
> See the Revival Process section below.

---

## Why it was archived

The mobile app scaffolding accumulated over time but was never:

- built or tested in any CI workflow
- deployed to any release channel
- kept in sync with the backend API or smart contract

Leaving dead code in the repository increases review noise and misleads
contributors into thinking there is an active mobile surface to maintain.

## Revival process

If you want to revive the mobile app:

1. Open an issue titled `[Proposal] Revive mobile app` describing:
   - Scope and target platforms (iOS / Android / both)
   - Chosen tech stack and version constraints
   - CI/CD plan (what checks will run on every PR)
   - Maintenance commitment and owner
2. Wait for maintainer approval before writing any code.
3. Once approved, build the app from scratch in this directory following
   the same quality standards as the rest of the repo (CI enforced,
   tests ≥ 85 % coverage, `eslint` clean).

## Configuration files retained

The following files are kept as a starting point for a future revival:

| File              | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| `package.json`    | Dependency manifest (versions will need updating) |
| `tsconfig.json`   | TypeScript compiler config                        |
| `jest.config.js`  | Jest test runner config                           |
| `babel.config.js` | Babel transpiler config                           |
