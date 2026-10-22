# Scavngr Demo

This directory contains everything needed to run an interactive, end-to-end walkthrough of the Scavngr platform on Stellar testnet. It is intended for developers onboarding to the project, technical evaluators, and anyone presenting the platform to an audience.

## Files

| File | Description |
|------|-------------|
| `demo-script.md` | Complete step-by-step demo walkthrough (~25-30 min) covering all seven demo stages: account setup, participant registration, incentive creation, waste submission, supply chain transfers, reward distribution, and statistics |
| `demo-accounts.json.example` | Template for recording demo account keypairs and addresses — copy to `demo-accounts.json` (git-ignored) before starting |

## Prerequisites

Before running the demo you need:

- **Stellar CLI** (`stellar`) — the Soroban CLI was renamed to the Stellar CLI in 2024. Install via `cargo install --locked stellar-cli` or follow the [official docs](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli).
- **Freighter wallet** browser extension — connected to Testnet.
- **Three testnet accounts** funded via Friendbot (the demo script walks you through creating them).
- **Contract deployed to testnet** — see [docs/DEVELOPER_ONBOARDING.md](../docs/DEVELOPER_ONBOARDING.md) for deployment steps.
- **Frontend running** — locally (`npm run dev`) or on a deployed testnet URL.

## Quick Start

```bash
# 1. Copy the accounts template
cp demo/demo-accounts.json.example demo/demo-accounts.json

# 2. Generate and fund the three demo accounts
stellar keys generate alice
curl "https://friendbot.stellar.org?addr=$(stellar keys address alice)"

stellar keys generate bob
curl "https://friendbot.stellar.org?addr=$(stellar keys address bob)"

stellar keys generate carol
curl "https://friendbot.stellar.org?addr=$(stellar keys address carol)"

# 3. Follow demo-script.md for the full walkthrough
```

## Demo Duration

**~25-30 minutes** for the full flow. Each section includes expected outputs so you can verify every step is working before moving on.

## Current Status

Valid as of **2026-09-01**. All CLI commands use the current `stellar` CLI (formerly `soroban`).

---

For full developer setup (environment variables, Docker, contract deployment), see the **[Developer Onboarding Guide](../docs/DEVELOPER_ONBOARDING.md)**.
