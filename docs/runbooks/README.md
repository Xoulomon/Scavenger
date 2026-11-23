# Operations Runbook Library

Comprehensive library of operational procedures for the Scavenger platform.

## Structure

```
docs/runbooks/
├── README.md               ← this index
├── common-procedures.md    ← routine operational tasks
├── troubleshooting.md      ← symptom-based diagnostics
├── incident-response.md    ← SEV-1/SEV-2 incident lifecycle
└── deployment.md           ← deployment and rollback procedures
```

---

## Quick Reference

| Situation                   | Runbook                                     | Section            |
| --------------------------- | ------------------------------------------- | ------------------ |
| Service is down             | [Incident Response](./incident-response.md) | Declare incident   |
| High error rate             | [Troubleshooting](./troubleshooting.md)     | Error spike        |
| Deploy a new release        | [Deployment](./deployment.md)               | Standard deploy    |
| Roll back a bad deploy      | [Deployment](./deployment.md)               | Rollback           |
| Rotate secrets              | [Common Procedures](./common-procedures.md) | Secret rotation    |
| Scale up backend pods       | [Common Procedures](./common-procedures.md) | Horizontal scaling |
| Database backup             | [Common Procedures](./common-procedures.md) | Backup and restore |
| Contract upgrade            | [Common Procedures](./common-procedures.md) | Contract upgrade   |
| High latency                | [Troubleshooting](./troubleshooting.md)     | Latency spike      |
| Stuck WebSocket connections | [Troubleshooting](./troubleshooting.md)     | WebSocket issues   |

---

## Runbook Standards

Every procedure in this library follows the same format:

1. **Trigger** — when to use this runbook
2. **Prerequisites** — access and tools required
3. **Steps** — numbered, copy-pasteable commands
4. **Verification** — how to confirm success
5. **Rollback** — how to undo the procedure if it goes wrong

---

## Runbook Versioning

Each runbook file carries a version header:

```
Version: 1.x
Last updated: YYYY-MM-DD
Owner: @on-call-team
```

Update the version and `Last updated` date when procedures change. Increment the minor version for non-breaking additions, the major version for procedure rewrites or breaking process changes.

---

## Runbook Search

Use `grep` to find the procedure you need:

```bash
# Find all procedures related to rate limiting
grep -r "rate.limit" docs/runbooks/

# Find all rollback procedures
grep -rn "Rollback" docs/runbooks/

# Find all procedures requiring database access
grep -rn "psql\|postgres" docs/runbooks/
```

---

## Runbook Automation

Procedures marked with `[AUTOMATED]` have a corresponding script in `scripts/runbooks/`. Run them directly:

```bash
# List available automated procedures
ls scripts/runbooks/

# Run the secret rotation procedure
bash scripts/runbooks/rotate-secrets.sh
```

Manual steps within an automated procedure are printed with a `[MANUAL]` prefix.

---

## Contributing

To add or update a runbook:

1. Follow the format defined in [Runbook Standards](#runbook-standards) above
2. Test the procedure in staging before committing
3. Update the quick reference table in this README
4. Request review from the on-call team lead

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the pull request process.
