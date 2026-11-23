---
id: contribution-process
title: Contribution Process
sidebar_position: 3
---

# Contribution Process

This document describes the end-to-end process for contributing to Scavngr, from identifying something to work on through to having your code merged.

---

## Before You Start

1. **Read the [Contributing Guide](https://github.com/Xoulomon/Scavenger/blob/main/CONTRIBUTING.md)** — covers code style, testing requirements, and commit conventions.
2. **Check open issues** — look for issues labelled `good first issue` or `help wanted` if you're new.
3. **Discuss before building** — for significant features, open an issue to discuss the approach before investing time in implementation. A maintainer can confirm whether the feature fits the project direction.

---

## Contribution Workflow

```
1. Fork the repository
2. Create a feature branch (git checkout -b my-feature)
3. Implement your changes
4. Write/update tests
5. Run CI checks locally (cargo fmt, cargo clippy, npm test)
6. Open a pull request
7. Respond to review feedback
8. Maintainer merges after approval
```

---

## Pull Request Requirements

All PRs must:

- [ ] Pass all CI checks (Rust format/lint/test, frontend lint/type-check/test).
- [ ] Include tests for new functionality or bug fixes.
- [ ] Reference the issue being closed (`Closes #NNN`).
- [ ] Follow the commit message conventions in `CONTRIBUTING.md`.
- [ ] Have a clear description of what was changed and why.

PRs that modify the smart contract additionally require:

- [ ] A snapshot test update (if applicable).
- [ ] No reduction in test coverage.

---

## Review Process

1. A maintainer will be assigned automatically via `CODEOWNERS`.
2. The maintainer aims to review within 5 business days.
3. The reviewer may request changes. Address each comment and re-request review.
4. Once approved by ≥ 1 maintainer and all CI checks pass, the maintainer merges the PR.

---

## After Merge

- Your contribution will be listed in the next release's changelog.
- After your first merged PR, you are officially a Contributor.
- After consistent contributions over 3+ months, you may be nominated for maintainer status.

---

## Types of Contributions We Welcome

| Type                     | How to Contribute                                                  |
| ------------------------ | ------------------------------------------------------------------ |
| Bug fixes                | Open an issue, then a PR                                           |
| Features                 | Discuss in an issue first, then a PR                               |
| Documentation            | Direct PR is fine for small fixes; issue first for large additions |
| Translations             | See [I18N Guide](/docs/I18N_GUIDE)                                 |
| Test coverage            | PRs that add tests are always welcome                              |
| Performance improvements | Include benchmarks                                                 |
| Security reports         | See `SECURITY.md` — do not open public issues                      |

---

## Contributor Recognition

Contributors are recognised in:

- The `CONTRIBUTORS.md` file (updated at each release).
- GitHub's contributors graph.
- Quarterly transparency reports (by contribution count, not name, unless opted in).

If you'd like your name, GitHub handle, or organisation mentioned in release notes, add yourself to `CONTRIBUTORS.md` in your PR.
