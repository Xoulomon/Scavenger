# Code Review Guide

## Review Process

1. Open a PR against `main` using the PR template. Assign at least one reviewer from CODEOWNERS.
2. Link the related issue in the PR description (`Closes #<issue>`).
3. Mark the PR as **Draft** while work is in progress; move to **Ready for Review** when done.
4. Reviewers leave comments using GitHub's review tool — approve, request changes, or comment.
5. The author addresses comments, re-requests review, and merges once approved.

## SLAs

| Action | Target |
|---|---|
| First review after ready | 2 business days |
| Re-review after changes | 1 business day |

If a reviewer cannot meet the SLA, they should say so in a comment so another reviewer can step in.

## Approval Requirements

- **Non-breaking changes**: 1 approval required.
- **Breaking changes** (API changes, schema migrations, contract upgrades): 2 approvals required.
- All CI checks must be green before merge.

## Reviewer Checklist

### Functionality
- [ ] Change does what the PR description says
- [ ] Edge cases and error paths handled
- [ ] No unintended side effects on existing behaviour

### Code Quality
- [ ] Logic is clear and straightforward; complexity is justified
- [ ] No dead code, commented-out blocks, or debug statements
- [ ] Naming is consistent with the codebase conventions

### Tests
- [ ] New behaviour has test coverage
- [ ] Tests assert meaningful outcomes, not just "it ran"
- [ ] Existing tests still pass (CI confirms this)

### Security
- [ ] No secrets, keys, or credentials in code or comments
- [ ] User inputs validated before use
- [ ] Authorization checks present where needed (contract role checks, etc.)

### Performance
- [ ] No unnecessary on-chain storage reads/writes in the contract
- [ ] No N+1 patterns in loops

### Documentation
- [ ] Public functions and types have doc comments
- [ ] README / docs updated if behaviour changed

## Language-Specific Standards

### Rust / Soroban Contract
- No `unsafe` blocks without explicit justification in a comment.
- No `.unwrap()` or `.expect()` in production paths — use `?` or explicit error handling.
- Code must pass `cargo clippy -- -D warnings` with zero warnings.
- Follow existing module structure (`lib.rs`, `types.rs`, `events.rs`, `validation.rs`).

### TypeScript / Frontend
- No `any` types — use proper interfaces or generics.
- All new code must pass ESLint with zero warnings (`npm run lint`).
- React components should be typed with explicit prop interfaces.
- Environment variables accessed only through the validated config layer.

### Tests
- Unit tests for pure logic; integration tests for multi-function flows.
- Each test has a clear arrange / act / assert structure.
- Test names describe the scenario: `test_register_duplicate_participant_returns_error`.

## Example Review Comments

**Constructive (preferred)**
> This `unwrap()` on line 42 will panic if the storage key is missing on first call. Consider using `unwrap_or_default()` or returning an error with `?`.

> The `any` type here loses the type safety we get from the `Participant` interface. Can we use `Participant | null` instead?

> This loop calls `get_waste()` inside each iteration. Since we're on-chain, each call costs. Can we batch-fetch before the loop?

**Avoid**
> This is wrong. ❌
> Why did you do it this way? ❌
> Nit: style. ❌ (use GitHub's "nit:" prefix for optional style suggestions so authors can deprioritise them)

## Common Issues Reviewers Catch

- Missing `Closes #` link in PR description
- `unwrap()` / `expect()` left in contract error paths
- `console.log` / `dbg!` debug statements not removed
- Hardcoded addresses or test keys committed
- New public contract function not documented in `docs/API_REFERENCE_GUIDE.md`
- Role/permission check missing on a new contract entry point
- Test added but only tests the happy path
- Breaking change not flagged in PR type checkboxes
