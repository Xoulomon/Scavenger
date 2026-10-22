# Contributing to Scavenger

Thank you for your interest in contributing to Scavenger — a Rust/Soroban smart contract system with a React/TypeScript frontend built on the Stellar blockchain. This document is the single authoritative reference for code style, the PR workflow, testing expectations, commit conventions, community standards, and environment setup.

---

## Table of Contents

1. [Getting Started / Setup](#getting-started--setup)
2. [Pre-commit Hooks](#pre-commit-hooks)
3. [Code Style Guidelines](#code-style-guidelines)
4. [Pull Request Process](#pull-request-process)
5. [Testing Requirements](#testing-requirements)
6. [Commit Message Conventions](#commit-message-conventions)
7. [Code of Conduct](#code-of-conduct)

---

## Getting Started / Setup

### Prerequisites

#### Smart Contract (Rust / Soroban)

- **Rust toolchain** — stable channel. Install via [rustup](https://rustup.rs/):
  ```bash
  rustup toolchain install stable
  rustup default stable
  ```
  > No pinned version is currently specified in `rust-toolchain.toml`; the stable channel is the expected toolchain.
- **Soroban CLI** — install the latest release:
  ```bash
  cargo install --locked soroban-cli
  ```

#### Frontend (React / TypeScript)

- **Node.js** — LTS version recommended. Download from [nodejs.org](https://nodejs.org/) or use a version manager such as `nvm`.
- **pnpm** — install via `npm install -g pnpm`.

### Clone and Install

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/Scavenger.git
cd Scavenger

# 2. Install Smart Contract dependencies
cargo build

# 3. Install Node.js dependencies (all workspaces)
pnpm install
```

---

## Pre-commit Hooks

This repository uses [pre-commit](https://pre-commit.com/) to enforce formatting and linting
automatically before every commit. The hooks cover all three languages used in the project:
Rust, TypeScript/JavaScript, and Python notebooks.

### Setup

```bash
# 1. Install pre-commit itself
pip install pre-commit

# 2. Install nbstripout (Jupyter notebook output stripping)
pip install nbstripout

# 3. Install the hooks into your local clone
pre-commit install
```

`rustfmt` must be available for the `cargo-fmt` hook:

```bash
rustup component add rustfmt
```

`prettier` and `eslint` are resolved via `pnpm exec` — ensure you have run `pnpm install` first.

### What gets checked

| Hook | Languages | What it does |
|------|-----------|--------------|
| `cargo-fmt` | Rust (`.rs`) | Runs `cargo fmt --all` and blocks commits that aren't formatted |
| `prettier` | TS, JS, JSON, CSS, MD | Reformats files to the project's Prettier config |
| `eslint` | TS, JS | Runs ESLint with `--fix`; blocks commits with unfixable lint errors |
| `nbstripout` | Jupyter (`.ipynb`) | Strips cell outputs from `commit_push.ipynb` before committing |
| `terraform_fmt` / `terraform_validate` | Terraform | Formats and validates Terraform configs |
| `trailing-whitespace` / `end-of-file-fixer` | All | Generic file hygiene |

### Running manually

```bash
# Run all hooks against all files
pre-commit run --all-files

# Run a specific hook
pre-commit run cargo-fmt --all-files
pre-commit run prettier --all-files
pre-commit run nbstripout --all-files
```

---

## Code Style Guidelines

Consistent style keeps the codebase readable and review cycles short. Run all formatters and linters before pushing.

### Rust (Smart Contract)

- **Formatting** — run `cargo fmt` before every commit:
  ```bash
  cargo fmt
  ```
- **Linting** — run `cargo clippy` and resolve all warnings before submitting:
  ```bash
  cargo clippy -- -D warnings
  ```
  PRs with outstanding Clippy warnings will not be merged.
- **Naming conventions** — use `snake_case` for functions, variables, structs, and module names.
- **Function length** — keep functions focused on a single responsibility. Avoid functions exceeding 50 lines where practical; extract helpers when a function grows beyond that threshold.

### TypeScript / React (Frontend)

- **Formatting** — `prettier` must pass with no diff:
  ```bash
  pnpm exec prettier --check .
  ```
- **Linting** — `eslint` must pass with no errors or warnings:
  ```bash
  pnpm exec eslint .
  ```
- **Naming conventions** — use `PascalCase` for React components and TypeScript types/interfaces; use `camelCase` for variables and functions.
- **Function design** — keep functions focused on a single responsibility. Avoid large multi-purpose functions; prefer small, composable units.

---

## Pull Request Process

### 1. Fork and Branch

Fork the repository on GitHub and create a dedicated branch for your change before opening a PR. Never commit directly to `main`.

```bash
git checkout -b feature/my-new-feature
```

### 2. Branch Naming Convention

Use one of the following prefixes followed by a short kebab-case description:

| Prefix                        | When to use                |
| ----------------------------- | -------------------------- |
| `feature/<short-description>` | New functionality          |
| `fix/<short-description>`     | Bug fixes                  |
| `docs/<short-description>`    | Documentation-only changes |

Examples: `feature/add-token-transfer`, `fix/null-pointer-crash`, `docs/update-setup-guide`

### 3. PR Description

Every PR must include a description that covers:

- **What changed** — a clear summary of the modifications made.
- **Why it changed** — the motivation or problem being solved.
- **Related issues** — reference any relevant GitHub issue numbers (e.g., `Closes #42`).

### 4. Target the Correct Base Branch

Ensure your PR targets the correct base branch (typically `main`). Check the repository's branch strategy before opening your PR and update the base if needed.

### 5. Review and Approval

- At least **one maintainer approval** is required before a PR can be merged.
- All **CI checks must pass** — do not merge a PR with failing checks.

### 6. Keep PRs Focused

Address **one concern per PR**. Large, multi-purpose PRs are harder to review and more likely to introduce regressions. If your change spans multiple concerns, split it into separate PRs.

---

## Testing Requirements

### Smart Contract Tests

- All Smart Contract changes must include or update unit tests using the **Soroban test framework**.
- Run the full Smart Contract test suite with:
  ```bash
  cargo test
  ```

### Frontend Tests

- All Frontend changes must include or update unit tests.
- Run the frontend test suite with:
  ```bash
  pnpm test
  ```

### Coverage and New Public API

- PRs **must not reduce overall test coverage** for the modified modules.
- If a PR introduces a **new public function or component**, at least one test covering the primary behavior must be included.

---

## Commit Message Conventions

This project follows the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.

### Format

```
<type>(<scope>): <short summary>

<body>

Closes #<issue-number>
```

### Types

| Type       | When to use                                   |
| ---------- | --------------------------------------------- |
| `feat`     | A new feature                                 |
| `fix`      | A bug fix                                     |
| `docs`     | Documentation changes only                    |
| `chore`    | Build process, tooling, or dependency updates |
| `refactor` | Code restructuring without behavior change    |
| `test`     | Adding or updating tests                      |
| `style`    | Formatting, whitespace, or style-only changes |

### Scopes

| Scope      | Area of the codebase                     |
| ---------- | ---------------------------------------- |
| `contract` | Rust / Soroban smart contract code       |
| `frontend` | React / TypeScript frontend              |
| `scripts`  | Build scripts, CI configuration, tooling |
| `docs`     | Documentation files                      |

### Summary Rules

- Written in the **imperative mood** (e.g., "add feature", not "added feature" or "adds feature").
- **Lowercase** — do not capitalize the first letter.
- **72 characters or fewer** — keep it concise.

### Body

- Separate the body from the subject line with a **blank line**.
- Use the body to explain the **motivation** for the change and any context a reviewer needs.

### Closing Issues

If a commit or PR closes a GitHub issue, include the following in the commit body or PR description:

```
Closes #<issue-number>
```

### Examples

```
feat(contract): add token transfer function

Implements the transfer entrypoint as specified in the token interface.
Validates sender balance before executing the transfer.

Closes #17
```

```
fix(frontend): resolve null pointer on wallet disconnect

The wallet context was not guarded against undefined on disconnect,
causing a crash in the header component.

Closes #23
```

---

## Code of Conduct

### Our Pledge

This project is committed to providing a welcoming and inclusive environment for everyone. We welcome contributors regardless of experience level, background, or identity.

We follow the [Contributor Covenant](https://www.contributor-covenant.org/) as our Code of Conduct. All contributors and maintainers are expected to uphold these standards in all project spaces — including GitHub issues, pull requests, discussions, and any other communication channels.

### Reporting Violations

If you experience or witness behavior that violates the Code of Conduct, please report it by emailing:

**[conduct@example.com]**

> Replace this placeholder with the actual contact email before publishing.

All reports will be reviewed promptly and handled with discretion.

### Enforcement

Violations of the Code of Conduct may result in **temporary or permanent exclusion** from the project, at the discretion of the maintainers.

### Summary of Expected Behavior

- Be respectful and considerate in all interactions.
- Welcome newcomers and those with different levels of experience.
- Accept constructive feedback gracefully.
- Focus on what is best for the community and the project.

For the full text of the Contributor Covenant, visit [https://www.contributor-covenant.org/version/2/1/code_of_conduct/](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
