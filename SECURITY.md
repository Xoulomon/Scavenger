# Security Policy

## Supported Versions

| Version        | Supported |
| -------------- | --------- |
| latest (main)  | ✅        |
| older releases | ❌        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities via email to **security@scavngr.io** with:

- Description of the vulnerability and its impact
- Steps to reproduce
- Affected components (backend, frontend, smart contract, indexer)
- Any proof-of-concept code (if available)

You will receive an acknowledgment within **24 hours** and a triage decision within **7 business days**.

## Response Timeline

| Stage                        | SLA                                        |
| ---------------------------- | ------------------------------------------ |
| Acknowledgment               | 24 hours                                   |
| Triage & severity assessment | 7 business days                            |
| Fix for Critical/High        | 14 days                                    |
| Fix for Medium               | 30 days                                    |
| Fix for Low                  | 90 days                                    |
| Public disclosure            | 90 days after initial report (coordinated) |

## Scope

**In scope:**

- `backend/` — Rust/actix-web API server
- `indexer/` — TypeScript event indexer
- `frontend/` — React web application
- `stellar-contract/` — Soroban smart contract
- Infrastructure configuration in `terraform/` and `k8s/`

**Out of scope:**

- Third-party dependencies (report to their maintainers)
- Social engineering attacks
- Physical attacks
- Denial of service via resource exhaustion without a bypass

## Safe Harbor

We will not pursue legal action against researchers who:

- Report vulnerabilities in good faith following this policy
- Do not access, modify, or delete user data
- Do not disrupt production services

## CVE Process

For vulnerabilities that qualify for a CVE:

1. We will request a CVE ID from MITRE after confirming the issue
2. The CVE will be referenced in the security advisory and release notes
3. We credit the reporter unless anonymity is requested

## Acknowledgments

We thank security researchers who responsibly disclose vulnerabilities. With your permission, we will credit you in our release notes and security advisories.

## Security Advisories

Published security advisories are available under [GitHub Security Advisories](../../security/advisories).
