---
id: charter
title: Project Charter
sidebar_position: 1
---

# Scavngr Project Charter

**Version**: 1.0
**Effective Date**: 2026-06-27
**Status**: Active

---

## Mission

Scavngr's mission is to increase global recycling rates by making the recycling supply chain transparent, traceable, and fairly compensated through decentralized blockchain technology.

## Vision

A world where every recyclable material is tracked from source to end use, every participant in the supply chain is fairly rewarded, and the environmental impact of recycling is publicly verifiable.

## Scope

This charter governs the open-source Scavngr project, which includes:

- The Soroban smart contract (`stellar-contract/`)
- The React frontend (`frontend/`)
- The event indexer (`indexer/`)
- The backend API (`backend/`)
- All project documentation

---

## Guiding Principles

1. **Openness** — All code, governance decisions, and project metrics are publicly visible.
2. **Inclusivity** — Contributions are welcomed regardless of background, nationality, or experience level. We follow the Contributor Covenant Code of Conduct.
3. **Decentralization** — We build tools that reduce dependence on centralized intermediaries.
4. **Sustainability** — We prioritize long-term project health over short-term velocity. Dependencies are reviewed for longevity; security is non-negotiable.
5. **Accountability** — Maintainers and contributors are held to the same standards. Decisions are documented publicly.

---

## Leadership Structure

### Maintainers

Maintainers have write access to the repository and final say on merging pull requests. Responsibilities:

- Review and merge pull requests.
- Triage issues.
- Manage releases.
- Enforce the Code of Conduct.
- Vote on governance decisions.

Current maintainers are listed in [`.github/CODEOWNERS`](https://github.com/Xoulomon/Scavenger/blob/main/.github/CODEOWNERS).

### Contributors

Anyone who submits a merged pull request is a Contributor. Contributors may be nominated for maintainer status by an existing maintainer after demonstrating consistent, high-quality contributions over at least 3 months.

### Emeritus Maintainers

Maintainers who are no longer active may be moved to Emeritus status. Emeritus maintainers retain recognition in the project's `CONTRIBUTORS.md` but no longer have write access or voting rights.

---

## Governance Metrics

We track the following metrics quarterly to assess project health:

| Metric | Target |
|--------|--------|
| Time to first response on new issues | ≤ 72 hours |
| Time to merge a reviewed PR | ≤ 7 days |
| Test coverage (smart contract) | ≥ 80% |
| Test coverage (frontend) | ≥ 70% |
| Open issues older than 90 days | < 20 |
| Contributors per quarter | ≥ 5 |

Metrics are reported in the quarterly transparency report (see `docs/governance/transparency-report-template.md`).

---

## Amendments

This charter may be amended by a two-thirds supermajority vote of active maintainers. Proposed amendments must be posted for community comment for at least 14 days before a vote is held.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Violations may be reported to the maintainers via the contact listed in `SECURITY.md`.
