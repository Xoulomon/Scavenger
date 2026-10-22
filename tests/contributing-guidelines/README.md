# Contributing Guidelines Compliance Tests

This directory contains Vitest tests that validate the `CONTRIBUTING.md` file contains all required sections, conventions, and guidance mandated by the project.

## Purpose

The `contributing.test.ts` file programmatically verifies that the project's contribution guidelines document:

1. **Code Style Tooling**: References to `cargo fmt`, `cargo clippy`, `prettier`, `eslint`
2. **Naming Conventions**: Requirements for `snake_case` (Rust), `PascalCase` (TypeScript)
3. **Function Length Guidelines**: The 50-line guideline for new functions
4. **PR Process**: Branch prefixes (`feature/`, `fix/`, `docs/`), maintainer approval, CI checks
5. **One Concern Per PR**: Single-purpose pull requests
6. **Testing Requirements**: Soroban test framework, `cargo test`, `npm test`, coverage requirements
7. **New Public API Testing**: Requirement to test every new public API

## Running Tests

```bash
# Install dependencies
npm install

# Run tests
npm test

# Watch mode (re-run on file changes)
npm test -- --watch
```

## Test Results

All tests must pass before PRs that modify `CONTRIBUTING.md` can be merged. This ensures that project contribution standards remain consistent and discoverable.

## Test Structure

| Test Suite | Validates |
|-----------|-----------|
| Property 1 | Code style tooling references are present |
| Property 2 | Naming conventions and function length guideline are documented |
| Property 3 | PR process sections and workflow elements |
| Property 4 | Testing requirements and best practices |

## When to Update

If you modify the `CONTRIBUTING.md` file, ensure all tests pass:
```bash
cd tests/contributing-guidelines/
npm test
```

If you need to update the guidelines and the tests fail, modify both `CONTRIBUTING.md` (to add the new requirement) and `contributing.test.ts` (to verify it).

## Integration with CI/CD

These tests run automatically on every pull request. See `.github/workflows/` for the test configuration.

## Files

- `src/contributing.test.ts` - Vitest test suite validating CONTRIBUTING.md
- `package.json` - Test dependencies (vitest, typescript, vite)
- `vite.config.ts` - Vitest configuration

## Related Documentation

- [Contributing Guide](../../CONTRIBUTING.md) - The source of truth for contribution guidelines
- [Developer Onboarding](../../docs/DEVELOPER_ONBOARDING.md) - Setup and development instructions
- [Code Quality Analysis](../../CODE_QUALITY_ANALYSIS_1158_1161.md) - Complexity and quality improvements (#1161)
