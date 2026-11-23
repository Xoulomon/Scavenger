## What changed

<!-- Clear summary of the modifications made. -->

## Why it changed

<!-- The motivation or problem being solved. -->

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `chore` — build process, tooling, or dependency updates
- [ ] `refactor` — code restructuring without behaviour change
- [ ] `test` — adding or updating tests
- [ ] `style` — formatting or whitespace only

## Scope

- [ ] `contract` — Rust / Soroban smart contract
- [ ] `frontend` — React / TypeScript frontend
- [ ] `scripts` — build scripts, CI configuration, tooling
- [ ] `docs` — documentation files

## Testing

- [ ] `cargo test` passes (Smart Contract)
- [ ] `pnpm test` passes (Frontend)
- [ ] Coverage not reduced for modified modules
- [ ] New public functions / components have at least one test

## Review checklist

- [ ] `cargo clippy --all-targets --all-features -- -D warnings` clean
- [ ] `pnpm exec eslint .` clean
- [ ] No debug logs or `console.log` statements left in
- [ ] Docs updated if behaviour changed
- [ ] Security implications considered
- [ ] PR targets `main` (or the correct base branch)

## Related issues

<!-- Reference issue numbers. Use "Closes #N" to auto-close on merge. -->

Closes #
