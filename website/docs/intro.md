---
id: intro
title: Introduction
sidebar_position: 1
---

# Scavngr Documentation

**Scavngr** is a decentralized recycling platform built on the [Stellar](https://stellar.org) blockchain using [Soroban](https://soroban.stellar.org) smart contracts. It connects recyclers, collectors, and manufacturers in a transparent and efficient ecosystem.

## What You'll Find Here

- **Getting Started** — Installation, quick-start guide, and local environment setup.
- **Architecture** — System design, smart contract internals, frontend structure, and the event indexer.
- **Guides** — Step-by-step walkthroughs for all major platform features.
- **Deployment** — Testnet and mainnet deployment instructions, CI/CD pipeline documentation.
- **API Reference** — Complete documentation of every Soroban contract function with examples.
- **Contributing** — How to contribute code, translations, and documentation.
- **Governance** — Project charter, decision-making process, and conflict resolution policy.

## Quick Links

| Resource             | Link                                                        |
| -------------------- | ----------------------------------------------------------- |
| GitHub Repository    | [Xoulomon/Scavenger](https://github.com/Xoulomon/Scavenger) |
| Architecture Diagram | [Architecture Overview](/docs/architecture/overview)        |
| API Reference        | [API Overview](/docs/api/overview)                          |
| Contributing Guide   | [Contributing](/docs/contributing/index)                    |

## Platform Roles

Scavngr uses three participant roles:

- **Recycler** — Submits waste materials to the platform.
- **Collector** — Collects and transports waste materials.
- **Manufacturer** — Creates incentives and receives waste materials for processing.

## Technology Stack

| Layer          | Technology                |
| -------------- | ------------------------- |
| Smart Contract | Rust + Soroban (Stellar)  |
| Frontend       | React + TypeScript + Vite |
| Indexer        | TypeScript + Node.js      |
| Backend        | Rust + Axum               |
| Database       | PostgreSQL                |
