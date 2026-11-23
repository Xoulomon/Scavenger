---
id: 01-overview
title: 'Platform Overview — What is Scavngr?'
series: Getting Started
episode: 1
duration: '5:00'
youtube_id: ''
sidebar_position: 1
---

# Platform Overview — What is Scavngr?

**Duration**: ~5 minutes | **Audience**: All roles | **Prerequisites**: None

<!-- Replace YOUTUBE_ID with the actual ID after upload -->
<!-- <iframe width="100%" style={{aspectRatio: '16/9'}} src="https://www.youtube.com/embed/YOUTUBE_ID" frameBorder="0" allowFullScreen /> -->

## Transcript

**[0:00]** Welcome to Scavngr — the decentralized recycling platform built on the Stellar blockchain. In the next five minutes, I'll give you a high-level overview of what Scavngr is, who it's for, and how it works.

**[0:20]** The recycling industry has a transparency problem. When you drop off a bag of plastic bottles, you have no way to verify it was actually recycled. Manufacturers who want to source recycled materials have no reliable way to track provenance. And recyclers often receive payments that are inconsistent or delayed.

**[0:45]** Scavngr solves this by recording every step of the recycling supply chain on the Stellar blockchain. Every waste submission, every transfer, every reward payment is a public, immutable on-chain transaction.

**[1:05]** The platform has three types of participants. First, the **Recycler** — this is anyone who collects recyclable materials and submits them to the platform. Second, the **Collector** — they aggregate materials from multiple recyclers and transport them. Third, the **Manufacturer** — companies that process recycled materials and create incentive programs to attract the waste types they need.

**[1:35]** Here's how a typical flow works. A manufacturer — let's say a plastic bottle producer — creates an incentive program: "I'll pay 10 tokens per kilogram of plastic." A recycler submits 5 kg of plastic. A collector picks it up and delivers it to the manufacturer. The smart contract automatically distributes the token rewards across the supply chain.

**[2:10]** All of this happens through Soroban smart contracts on the Stellar network. Soroban is Stellar's smart contract platform — it's fast, cheap, and designed for financial use cases.

**[2:25]** The frontend is a React app that connects to your Freighter wallet — the standard Stellar browser extension. You don't need a centralized account or password. Your Stellar keypair is your identity.

**[2:45]** The platform also includes a real-time event indexer that tracks all contract events and makes them queryable — so you can see analytics like total waste processed, top recyclers, and active incentive programs.

**[3:10]** Let me show you the main screens quickly. Here's the **Dashboard** — an overview of your activity and current incentives. Here's the **Waste List** — every waste submission you've made. The **Incentives Marketplace** shows all active manufacturer incentive programs. And **Rewards** shows your earned tokens and distribution history.

**[3:40]** The smart contract is open-source — you can read every line of code on GitHub. The contract is deployed on Stellar Testnet for development and on Mainnet for production use.

**[4:05]** To get started, you'll need a Freighter wallet, some XLM for transaction fees (Testnet XLM is free via Friendbot), and to register as a participant on-chain. The next video in this series will walk you through installing Freighter.

**[4:30]** If you're a developer looking to contribute, check out the contributing guide in the documentation. The contract is written in Rust using the Soroban SDK, and the frontend uses React and TypeScript.

**[4:50]** That's the overview! In the next video, we'll install the Freighter wallet and create a Stellar account. See you there.

## Key Concepts Covered

- Scavngr platform overview and mission
- Three participant roles: Recycler, Collector, Manufacturer
- How the recycling supply chain works on-chain
- Stellar blockchain and Soroban smart contracts
- Freighter wallet as the identity layer
- Token reward distribution

## Related Resources

- [Architecture Overview](/docs/architecture/overview)
- [Getting Started: Install Freighter](/docs/video-tutorials/getting-started/02-freighter)
- [GitHub Repository](https://github.com/Xoulomon/Scavenger)
