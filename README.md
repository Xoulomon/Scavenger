# Scavngr - Stellar Recycling Platform

A decentralized recycling platform built on Stellar blockchain using Soroban smart contracts. Scavngr connects recyclers, collectors, and manufacturers in a transparent and efficient ecosystem.

## Architecture Diagram

![Scavngr System Architecture](docs/architecture-diagram.svg)

> Full-size diagram: [`docs/architecture-diagram.svg`](docs/architecture-diagram.svg)  
> Shows all components (Frontend, Backend, Contract, Indexer, Stellar Network), participant roles, and data-flow for key operations (recycle, transfer, reward distribution).

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture Diagram](docs/architecture-diagram.svg) | Visual overview of all system components and data flow |
| [Local Dev Setup Guide](docs/local-dev-setup.md) | Complete local development setup covering all four workspaces |
| [API Reference Guide](docs/API_REFERENCE_GUIDE.md) | Comprehensive contract function reference with examples and quick reference cards |
| [Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md) | Step-by-step testnet and mainnet deployment with rollback procedures |
| [Troubleshooting Guide](docs/TROUBLESHOOTING_GUIDE.md) | Common errors, debugging tips, and performance tuning |
| [User Guide](docs/USER_GUIDE.md) | End-user guide for the platform |
| [Security Audit](docs/SECURITY_AUDIT.md) | Security audit findings and mitigations |

## Project Structure

```
Scavenger/
├── stellar-contract/      # Soroban smart contract (Rust) - canonical implementation
│   ├── src/
│   │   ├── lib.rs        # Main contract implementation
│   │   ├── types.rs      # Types: ParticipantRole, Waste, Incentive, GlobalMetrics, etc.
│   │   ├── events.rs     # Contract event emitters
│   │   └── validation.rs # Input validation helpers
│   ├── tests/            # Integration and unit tests
│   └── Cargo.toml
├── frontend/             # React frontend (to be implemented)
├── Cargo.toml           # Workspace configuration
├── soroban.toml         # Soroban CLI configuration
└── README.md
```

## Features

- **Role-Based Participant System**: Recycler, Collector, and Manufacturer roles
- **Participant Registration**: On-chain participant management
- **Role Validation**: Permission checks for different actions
- **Soroban Storage**: Efficient on-chain data storage

## Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/Scavenger.git
cd Scavenger
cp frontend/.env.example .env
docker compose up -d
```

That brings up Stellar standalone, Postgres, Redis, the backend, the indexer, and the
frontend. You still need to deploy the contract and set `CONTRACT_ID` before contract
calls work.

➡️ **[Developer Onboarding Guide](docs/DEVELOPER_ONBOARDING.md#development-environment-setup)** — the canonical setup path

It covers prerequisites, both the Docker and run-it-directly paths, every environment
variable, per-component run commands, a verification checklist, and troubleshooting
for contracts, indexer, frontend, backend, and mobile.

Related: [Local Dev Setup](docs/local-dev-setup.md) · [Docker specifics](docs/DEV_ENVIRONMENT.md) · [Contributing](CONTRIBUTING.md) · [Architecture](docs/ARCHITECTURE.md) · [API Reference](docs/API_REFERENCE.md)

## Contract API

### ParticipantRole Enum

```rust
pub enum ParticipantRole {
    Recycler = 0,      // Can collect and process recyclables
    Collector = 1,     // Can collect materials
    Manufacturer = 2,  // Can manufacture products
}
```

### Functions

**Admin**
- `initialize_admin(admin)` - Initialize contract admin (once)
- `transfer_admin(current_admin, new_admin)` - Transfer admin rights
- `set_charity_contract(admin, charity_address)` - Set charity address
- `set_token_address(admin, token_address)` - Set reward token address
- `set_percentages(admin, collector_pct, owner_pct)` - Set reward split percentages

**Participants**
- `register_participant(address, role, name, lat, lon)` - Register participant
- `get_participant(address)` - Get participant info
- `get_participant_info(address)` - Get participant + stats
- `update_role(address, new_role)` - Update participant role
- `deregister_participant(address)` - Deregister participant
- `is_participant_registered(address)` - Check registration

**Waste / Materials**
- `submit_material(submitter, waste_type, weight, lat, lon)` - Submit waste
- `submit_materials_batch(submitter, materials)` - Batch submit
- `verify_material(material_id, verifier)` - Verify a material
- `transfer_waste(waste_id, from, to, lat, lon, note)` - Transfer waste
- `confirm_waste_details(waste_id, confirmer)` - Confirm waste
- `reset_waste_confirmation(waste_id, owner)` - Reset confirmation
- `deactivate_waste(admin, waste_id)` - Deactivate waste
- `get_waste(waste_id)` / `get_material(material_id)` - Get waste by ID
- `get_participant_wastes(participant)` - List participant's waste IDs
- `get_waste_transfer_history(waste_id)` - Get transfer history

**Incentives**
- `create_incentive(rewarder, waste_type, reward_points, budget)` - Create incentive
- `update_incentive(incentive_id, rewarder, reward_points, budget)` - Update incentive
- `deactivate_incentive(incentive_id, rewarder)` - Deactivate incentive
- `get_incentive_by_id(incentive_id)` - Get incentive
- `get_incentives(waste_type)` - Get active incentives by waste type
- `get_active_incentives()` - Get all active incentives
- `get_active_mfr_incentive(manufacturer, waste_type)` - Best incentive for manufacturer
- `distribute_rewards(waste_id, incentive_id, manufacturer)` - Distribute supply chain rewards

**Stats & Metrics**
- `get_metrics()` - Global metrics (total wastes, total tokens)
- `get_stats(participant)` - Participant recycling stats
- `get_supply_chain_stats()` - Global supply chain stats

## Environment Variables

There are separate env files for the root/compose stack, the frontend, the indexer,
and the mobile app. All of them are documented in one place:

➡️ **[Developer Onboarding — Environment Variables](docs/DEVELOPER_ONBOARDING.md#environment-variables)**

## Development

```bash
# Format code
cargo fmt

# Run linter
cargo clippy

# Watch for changes
cargo watch -x test
```

Per-component build, run, and test commands are in the
[Local Run Commands](docs/DEVELOPER_ONBOARDING.md#local-run-commands) table.

## CI/CD

GitHub Actions automatically runs quality checks on all pushes and pull requests:

### Rust Checks
- Code formatting (`cargo fmt`)
- Linting with Clippy (`cargo clippy`)
- Unit and integration tests
- WASM build verification
- Security audit with RustSec

### Frontend Checks
- Code formatting with Prettier
- ESLint linting (max 0 warnings)
- TypeScript type checking
- Production build verification
- npm security audit

### Branch Protection
Pull requests must pass all CI checks before merging. Configure branch protection rules:
1. Go to Settings > Branches
2. Add rule for `main` branch
3. Enable "Require status checks to pass before merging"
4. Select: `Rust Quality Checks`, `Frontend Quality Checks`, `Security Audit`
5. Enable "Require branches to be up to date before merging"

## License

MIT License - see LICENSE file for details

## Configuration

### TypeScript
- Base config: `tsconfig.base.json`
- Extended by each package
- See `backend/tsconfig.json`, `frontend/tsconfig.json`, `indexer/tsconfig.json`

### ESLint
- Base config: `eslint.config.base.js`
- Extended by each package
- See `backend/eslint.config.js`, `frontend/eslint.config.js`, `indexer/eslint.config.js`

### Adding a New Package
1. Copy the `tsconfig.json` and `eslint.config.js` from an existing package
2. Update the extends path if needed
3. Add package-specific overrides
