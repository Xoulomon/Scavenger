# Contributing to Scavenger

Thank you for your interest in contributing to Scavenger — a Rust/Soroban smart contract system with a React/TypeScript frontend built on the Stellar blockchain. This document is the single authoritative reference for code style, the PR workflow, testing expectations, commit conventions, community standards, and environment setup.

---

## Table of Contents

1. [Getting Started / Setup](#getting-started--setup)
2. [Code Style Guidelines](#code-style-guidelines)
3. [Pull Request Process](#pull-request-process)
4. [Testing Requirements](#testing-requirements)
5. [Commit Message Conventions](#commit-message-conventions)
6. [Development Workflow](#development-workflow)
7. [Review Process](#review-process)
8. [Module Ownership Map](#module-ownership-map)
9. [Contributor Recognition](#contributor-recognition)
10. [Code of Conduct](#code-of-conduct)

---

## Getting Started / Setup

### Prerequisites

#### Smart Contract (Rust / Soroban)

- **Rust toolchain** — stable channel. Install via [rustup](https://rustup.rs/):
  ```bash
  rustup toolchain install stable
  rustup default stable
  rustup target add wasm32-unknown-unknown
  ```
- **Soroban CLI** — install the latest release:
  ```bash
  cargo install --locked soroban-cli --features opt
  ```

#### Frontend (React / TypeScript)

- **Node.js** — LTS version (18+) recommended. Download from [nodejs.org](https://nodejs.org/) or use a version manager such as `nvm`.
- **npm** — bundled with Node.js; no separate install required.

### Clone and Install

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/Scavenger.git
cd Scavenger

# 2. Install Smart Contract dependencies
cargo build

# 3. Install Frontend dependencies
cd frontend
npm install
cd ..
```

### Verify Setup

```bash
# Test Rust setup
cargo fmt --check
cargo clippy -- -D warnings
cargo test

# Test Frontend setup
cd frontend
npm run lint
npm run type-check
cd ..
```

### Further Reading

Before diving in, review the existing documentation:

- [`README.md`](./README.md) — project overview and architecture
- [`QUICKSTART.txt`](./QUICKSTART.txt) — fast-path setup
- [`PROJECT_SETUP.txt`](./PROJECT_SETUP.txt) — detailed configuration
- [`docs/`](./docs/) — technical documentation

---

## Code Style Guidelines

Consistent style keeps the codebase readable and review cycles short. Run all formatters and linters before pushing.

### Rust (Smart Contract)

#### Formatting

Run `cargo fmt` before every commit:
```bash
cargo fmt
```

**Style rules:**
- Max line length: 100 characters
- Use 4 spaces for indentation
- One blank line between functions
- Two blank lines between modules

#### Linting

Run `cargo clippy` and resolve all warnings:
```bash
cargo clippy -- -D warnings
```

**Common issues to avoid:**
- Unused imports
- Unnecessary clones
- Inefficient patterns
- Unwrap without justification

#### Naming Conventions

- Functions: `snake_case` — `register_participant`, `get_waste`
- Types/Structs: `PascalCase` — `ParticipantRole`, `WasteMetadata`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_WEIGHT`, `DEFAULT_TIMEOUT`
- Module names: `snake_case` — `participant_storage`, `waste_validation`

#### Function Design

- Keep functions focused on a single responsibility
- Avoid functions exceeding 50 lines; extract helpers when needed
- Use descriptive names that explain intent
- Document public functions with doc comments

**Example:**
```rust
/// Registers a new participant in the system.
///
/// # Arguments
/// * `address` - The participant's Stellar address
/// * `role` - The participant's role (Recycler, Collector, Manufacturer)
/// * `name` - Human-readable name
/// * `lat` - Latitude coordinate
/// * `lon` - Longitude coordinate
///
/// # Returns
/// Returns `Ok(())` on success or an error if validation fails.
pub fn register_participant(
    env: &Env,
    address: Address,
    role: ParticipantRole,
    name: String,
    lat: i32,
    lon: i32,
) -> Result<(), Error> {
    // Implementation
}
```

### TypeScript / React (Frontend)

#### Formatting

Prettier must pass with no diff:
```bash
npx prettier --check .
npx prettier --write .  # Auto-fix
```

**Style rules:**
- Max line length: 100 characters
- Use 2 spaces for indentation
- Trailing commas in multi-line objects/arrays
- Single quotes for strings

#### Linting

ESLint must pass with no errors or warnings:
```bash
npx eslint .
npx eslint . --fix  # Auto-fix
```

#### Type Safety Notes

- Prefer `unknown` for untrusted external data or JSON payloads that must be validated before use.
- Use `any` only at explicit integration boundaries where the runtime contract is intentionally dynamic and the value is immediately narrowed.
- Avoid `unknown` without narrowing; add a guard, schema parse, or typed helper before reading fields.

#### Naming Conventions

- React components: `PascalCase` — `ParticipantForm`, `WasteCard`
- Types/Interfaces: `PascalCase` — `Participant`, `WasteData`
- Variables/functions: `camelCase` — `participantId`, `fetchWaste`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_RETRIES`, `API_TIMEOUT`
- File names: `kebab-case` for components — `participant-form.tsx`

#### Component Design

- Keep components focused on a single concern
- Extract reusable logic into custom hooks
- Use TypeScript for type safety
- Avoid prop drilling; use context when appropriate

**Example:**
```typescript
interface ParticipantFormProps {
  onSubmit: (data: ParticipantData) => Promise<void>;
  isLoading?: boolean;
}

export const ParticipantForm: React.FC<ParticipantFormProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<ParticipantData>({
    name: '',
    role: 'Recycler',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

---

## Pull Request Process

### 1. Fork and Branch

Fork the repository and create a dedicated branch:

```bash
git checkout -b feature/my-new-feature
```

### 2. Branch Naming Convention

Use one of these prefixes with kebab-case description:

| Prefix | When to use | Example |
|--------|------------|---------|
| `feature/` | New functionality | `feature/add-token-transfer` |
| `fix/` | Bug fixes | `fix/null-pointer-crash` |
| `docs/` | Documentation | `docs/update-setup-guide` |
| `refactor/` | Code restructuring | `refactor/simplify-validation` |
| `test/` | Test additions | `test/add-integration-tests` |

### 3. PR Description Template

Every PR must include:

```markdown
## Description
Brief summary of changes.

## Motivation
Why this change is needed.

## Changes
- Bullet point 1
- Bullet point 2

## Testing
How to test these changes.

## Related Issues
Closes #123

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
```

### 4. Target the Correct Base Branch

Ensure your PR targets `main`. Check branch protection rules before opening.

### 5. Review and Approval

- Minimum **one maintainer approval** required
- All **CI checks must pass**
- Address all review comments before merge

### 6. Keep PRs Focused

Address **one concern per PR**. Split large changes into multiple PRs.

---

## Testing Requirements

### Smart Contract Tests

All Smart Contract changes must include tests:

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_register_participant

# Run with output
cargo test -- --nocapture
```

**Test structure:**
```rust
#[test]
fn test_register_participant_success() {
    let env = Env::default();
    // Setup
    // Execute
    // Assert
}

#[test]
#[should_panic(expected = "error message")]
fn test_register_participant_invalid_role() {
    // Test error case
}
```

### Frontend Tests

Frontend tests use Vitest:

```bash
# Run all tests
npm test

# Run specific test file
npm test participant-form

# Run with coverage
npm test -- --coverage
```

**Test structure:**
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParticipantForm } from './participant-form';

describe('ParticipantForm', () => {
  it('should render form fields', () => {
    render(<ParticipantForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it('should call onSubmit with form data', async () => {
    const onSubmit = vi.fn();
    render(<ParticipantForm onSubmit={onSubmit} />);
    // User interactions
    expect(onSubmit).toHaveBeenCalledWith(expectedData);
  });
});
```

### Coverage Requirements

- **Minimum coverage:** 80% for new code
- **No reduction** in overall coverage
- **Critical paths** must have 100% coverage

### Test Data and Fixtures

Create reusable test fixtures:

```rust
// tests/fixtures.rs
pub fn create_test_participant() -> Participant {
    Participant {
        address: Address::random(&env),
        role: ParticipantRole::Recycler,
        name: "Test User".to_string(),
        lat: 0,
        lon: 0,
    }
}
```

---

## Commit Message Conventions

This project follows [Conventional Commits v1.0.0](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <short summary>

<body>

Closes #<issue-number>
```

### Types

| Type | When to use |
|------|------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Build, tooling, dependencies |
| `refactor` | Code restructuring |
| `test` | Adding/updating tests |
| `style` | Formatting, whitespace |

### Scopes

| Scope | Area |
|-------|------|
| `contract` | Rust/Soroban smart contract |
| `frontend` | React/TypeScript frontend |
| `scripts` | Build scripts, CI, tooling |
| `docs` | Documentation files |

### Summary Rules

- Imperative mood: "add feature", not "added feature"
- Lowercase first letter
- 72 characters or fewer
- No period at end

### Body

- Separate from subject with blank line
- Explain **why**, not **what**
- Wrap at 72 characters
- Reference related issues

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

```
docs(contract): add participant registration examples

Added code examples showing how to register participants with different
roles and validate their information.
```

---

## Development Workflow

### Local Development

1. **Create feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and test:**
   ```bash
   # For Rust changes
   cargo fmt
   cargo clippy -- -D warnings
   cargo test

   # For Frontend changes
   cd frontend
   npm run lint
   npm run type-check
   npm test
   ```

3. **Commit with conventional messages:**
   ```bash
   git add .
   git commit -m "feat(contract): add new function"
   ```

4. **Push and create PR:**
   ```bash
   git push origin feature/my-feature
   # Create PR on GitHub
   ```

### Pre-commit Hooks

This repo uses the `pre-commit` framework as the shared gate for formatting checks before a commit. The hook runs `cargo fmt --check` and a repo-wide `prettier --check` pass across the JavaScript/TypeScript packages that use Prettier.

```bash
# Install pre-commit framework
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

If a formatting exception is genuinely required, bypass the hook explicitly and include a short explanation in the commit message or PR description:

```bash
SKIP=cargo-fmt-check,prettier-check git commit -m "chore: allow formatting exception for generated artifact"
```

This bypass should be rare and justified; the default workflow is to fix the formatting drift rather than skip the gate.

### CI/CD Pipeline

All PRs run through automated checks:

- **Rust checks:** formatting, linting, tests, WASM build
- **Frontend checks:** formatting, linting, type checking, tests
- **Security:** dependency audit, secret scanning

All checks must pass before merge.

---

## Review Process

### For Contributors

1. **Self-review** before requesting review
2. **Respond to feedback** promptly
3. **Request re-review** after making changes
4. **Be respectful** of reviewer time and expertise

### For Reviewers

1. **Review within 48 hours** when possible
2. **Be constructive** in feedback
3. **Approve when satisfied** with changes
4. **Merge when approved** and CI passes

### Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests are adequate
- [ ] Documentation is updated
- [ ] No breaking changes
- [ ] Performance impact acceptable
- [ ] Security concerns addressed

---

## Module Ownership Map

Use this map to route issues, questions, and review requests to the right area of the codebase. Each top-level directory has a designated owner (see [`.github/CODEOWNERS`](.github/CODEOWNERS)) who is automatically requested for review on PRs touching that area.

| Directory | Responsibility | Owner |
|---|---|---|
| `stellar-contract/`, `contracts/` | Soroban smart contracts (Rust): waste registration, transfers, rewards, incentives | @Xoulomon |
| `frontend/` | React/TypeScript web app: pages, components, hooks, client-side services | @Xoulomon |
| `backend/` | Rust backend services and APIs | @Xoulomon |
| `indexer/` | Blockchain event indexer (TypeScript) | @Xoulomon |
| `mobile/` | Mobile application | @Xoulomon |
| `packages/` | Shared packages, including `scavenger-sdk` | @Xoulomon |
| `website/` | Marketing/landing website | @Xoulomon |
| `docs/` | Project documentation | @Xoulomon |
| `scripts/` | Operational and build scripts (deploy, backup, cost, CDN, …) | @Xoulomon |
| `k8s/`, `terraform/`, `config/` | Infrastructure: Kubernetes manifests, Terraform, service configuration | @Xoulomon |
| `.github/`, `docker-compose*.yml` | CI/CD workflows, PR templates, local orchestration | @Xoulomon |
| `integration-tests/`, `performance/`, `security-tests/` | Cross-cutting test suites: integration, performance, security | @Xoulomon |
| `demo/` | Demo assets and example flows | @Xoulomon |

### Routing guidelines

- **Filing an issue:** prefix the title with the affected area (e.g. `[Frontend]`, `[Contract]`, `[Indexer]`) so it reaches the right owner.
- **Opening a PR:** keep changes scoped to one area where possible; CODEOWNERS will request the owner's review automatically.
- **Cross-cutting changes** (e.g. contract + frontend types): mention every affected owner in the PR description.
- **Unsure where something belongs?** Open an issue and the global owner (@Xoulomon) will triage it.

---

## Contributor Recognition

We recognize and appreciate all contributions! Contributors are acknowledged in:

1. **Commit history** — visible in `git log`
2. **GitHub contributors page** — automatic
3. **Release notes** — for significant contributions
4. **CONTRIBUTORS.md** — maintained list (coming soon)

### Contribution Levels

- **Documentation:** Typo fixes, guide improvements
- **Bug fixes:** Small fixes, edge cases
- **Features:** New functionality, enhancements
- **Maintenance:** Refactoring, optimization, tooling

All levels are valued and appreciated!

---

## Code of Conduct

### Our Pledge

This project is committed to providing a welcoming and inclusive environment for everyone. We welcome contributors regardless of experience level, background, or identity.

We follow the [Contributor Covenant](https://www.contributor-covenant.org/) as our Code of Conduct. All contributors and maintainers are expected to uphold these standards in all project spaces.

### Expected Behavior

- Be respectful and considerate
- Welcome newcomers and different perspectives
- Accept constructive feedback gracefully
- Focus on what's best for the community
- Use inclusive language

### Unacceptable Behavior

- Harassment or discrimination
- Offensive comments or language
- Unwelcome sexual attention
- Trolling or insulting comments
- Publishing private information

### Reporting Violations

If you experience or witness violations, please report to:

**[conduct@example.com]**

All reports are reviewed promptly and handled with discretion.

### Enforcement

Violations may result in temporary or permanent exclusion from the project.

For the full text, visit [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

---

## Additional Resources

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## Questions?

- Check existing [GitHub Issues](https://github.com/Xoulomon/Scavenger/issues)
- Review [Discussions](https://github.com/Xoulomon/Scavenger/discussions)
- Ask in pull request comments
- Contact maintainers

Thank you for contributing to Scavenger! 🚀
