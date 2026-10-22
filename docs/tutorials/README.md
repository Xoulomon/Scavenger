# Smart Contract Tutorial Series

Step-by-step tutorials for building, testing, and deploying Soroban smart contracts on the Scavenger platform.

## Prerequisites

- Rust toolchain (`rustup` with `wasm32-unknown-unknown` target)
- Stellar CLI (`soroban`)
- A funded Stellar testnet account
- Basic understanding of Rust ownership and traits

```bash
# Install Stellar CLI
cargo install --locked stellar-cli --features opt

# Add wasm target
rustup target add wasm32-unknown-unknown

# Fund a testnet account
soroban keys generate dev-key
curl "https://friendbot.stellar.org?addr=$(soroban keys address dev-key)"
```

---

## Tutorial Path

| # | Tutorial | Level | Topics |
|---|----------|-------|--------|
| [01](./01-getting-started.md) | Getting Started | Beginner | Project setup, first contract, basic state |
| [02](./02-intermediate-contracts.md) | Intermediate Contracts | Intermediate | Events, access control, upgrades |
| [03](./03-advanced-patterns.md) | Advanced Patterns | Advanced | Multi-contract calls, optimisation, security |
| [04](./04-practice-exercises.md) | Practice Exercises | All levels | Hands-on challenges |
| [05](./05-solutions.md) | Solution Guide | Reference | Worked solutions with explanations |

---

## How the Tutorials Are Structured

Each tutorial follows a consistent format:

1. **Goal** — what you will build by the end
2. **Concepts** — theory behind the implementation
3. **Step-by-step code** — annotated Rust snippets
4. **Test coverage** — unit and integration tests
5. **Deploy** — CLI commands to deploy on testnet
6. **Checkpoint** — verify your implementation is correct

---

## Running Tutorial Tests

All tutorial code lives in `stellar-contract/src/`. Run the full test suite with:

```bash
cd stellar-contract
cargo test
```

Run a specific tutorial's tests:

```bash
cargo test tutorial_01
```

---

## Getting Help

- Open an issue labelled `tutorial` in the GitHub repository
- Check the [CONTRACT_API.md](../CONTRACT_API.md) for function signatures
- See [API_REFERENCE.md](../API_REFERENCE.md) for REST endpoints used in tutorials
