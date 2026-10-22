# Scavenger SDK — API Reference

> Package: `@scavngr/sdk`  
> Source: [`packages/scavenger-sdk`](../packages/scavenger-sdk)  
> Intended audience: **third-party integrators**

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [ScavengerClient](#scavengerclient)
  - [Constructor](#constructor)
  - [setSigningStrategy](#setsigningstrategy)
- [Participants](#participants)
- [Materials & Waste](#materials--waste)
- [Incentives & Rewards](#incentives--rewards)
- [System Stats & Metrics](#system-stats--metrics)
- [Admin Methods](#admin-methods)
- [Network Utilities](#network-utilities)
- [Signing Strategies](#signing-strategies)
- [Error Types](#error-types)
- [TypeScript Types](#typescript-types)

---

## Installation

```bash
npm install @scavngr/sdk @stellar/stellar-sdk
# peer dependency for browser wallet support (optional)
npm install @stellar/freighter-api
```

---

## Quick Start

```ts
import { ScavengerClient, Network, resolveNetwork, WasteType } from '@scavngr/sdk'

const client = new ScavengerClient({
  ...resolveNetwork(Network.Testnet),
  contractId: 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZLKE...',
})

// Read-only query — no signing required
const metrics = await client.getMetrics()
console.log(`Total wastes submitted: ${metrics.total_wastes_count}`)
```

---

## ScavengerClient

The primary entry point for all contract interactions.

### Constructor

```ts
new ScavengerClient(options: ClientOptions)
```

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `rpcUrl` | `string` | ✅ | Soroban RPC endpoint URL |
| `networkPassphrase` | `string` | ✅ | Stellar network passphrase |
| `contractId` | `string` | ✅ | Deployed contract address (`C…`) |
| `pollTimeoutMs` | `number` | — | Transaction polling timeout in ms (default: `30000`) |
| `pollIntervalMs` | `number` | — | Polling interval in ms (default: `1500`) |

```ts
import { ScavengerClient } from '@scavngr/sdk'

const client = new ScavengerClient({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2025',
  contractId: 'CC...',
})
```

### setSigningStrategy

```ts
client.setSigningStrategy(strategy: SigningStrategy): void
```

Attach a signing strategy before making state-mutating calls. See [Signing Strategies](#signing-strategies).

---

## Participants

### `registerParticipant`

Registers a new participant in the recycling ecosystem.

```ts
registerParticipant(
  address: string,
  role: Role,
  name: string,
  lat: number,
  lon: number,
  signer: string
): Promise<Participant>
```

```ts
import { Role } from '@scavngr/sdk'

const participant = await client.registerParticipant(
  'GABC...1234',
  Role.Recycler,
  'Green Leaf Recycling',
  40712800,   // latitude × 10⁶
  -74006000,  // longitude × 10⁶
  'GABC...1234'
)
```

### `getParticipant`

Returns registered participant data, or `null` if not found.

```ts
getParticipant(address: string): Promise<Participant | null>
```

### `getParticipantInfo`

Returns participant details together with aggregate recycling stats.

```ts
getParticipantInfo(address: string): Promise<ParticipantInfo | null>
```

### `updateRole`

Updates a participant's role. Requires admin or self-update permission.

```ts
updateRole(address: string, newRole: Role, signer: string): Promise<void>
```

### `isParticipantRegistered`

Returns `true` if the address is registered.

```ts
isParticipantRegistered(address: string): Promise<boolean>
```

---

## Materials & Waste

### `submitMaterial`

Submits a single waste material record.

```ts
submitMaterial(
  submitter: string,
  wasteType: WasteType,
  weight: bigint,   // grams
  lat: bigint,
  lon: bigint,
  signer: string
): Promise<Material>
```

```ts
import { WasteType } from '@scavngr/sdk'

const material = await client.submitMaterial(
  'GABC...1234',
  WasteType.Plastic,
  5000n,
  40712800n,
  -74006000n,
  'GABC...1234'
)
```

### `submitMaterialsBatch`

Batch submission of multiple materials in a single transaction.

```ts
submitMaterialsBatch(
  submitter: string,
  materials: MaterialBatchItem[],
  signer: string
): Promise<Material[]>
```

### `verifyMaterial`

Verifies a submitted material batch item.

```ts
verifyMaterial(materialId: bigint, verifier: string, signer: string): Promise<void>
```

### `transferWaste`

Transfers waste custody to another participant.

```ts
transferWaste(
  wasteId: bigint,
  from: string,
  to: string,
  lat: bigint,
  lon: bigint,
  note: string,
  signer: string
): Promise<void>
```

### `getWaste`

Fetches details of a tracked waste asset.

```ts
getWaste(wasteId: bigint): Promise<Waste | null>
```

### `getWasteTransferHistory`

Returns the chronological transfer history for a waste asset.

```ts
getWasteTransferHistory(wasteId: bigint): Promise<WasteTransfer[]>
```

---

## Incentives & Rewards

### `createIncentive`

Creates a manufacturer incentive pool for a specific waste type.

```ts
createIncentive(
  rewarder: string,
  wasteType: WasteType,
  rewardPoints: bigint,
  budget: bigint,
  signer: string
): Promise<Incentive>
```

### `getActiveIncentives`

Returns all currently active incentive programs.

```ts
getActiveIncentives(): Promise<Incentive[]>
```

### `distributeRewards`

Distributes token rewards for a confirmed recycling batch.

```ts
distributeRewards(
  wasteId: bigint,
  incentiveId: bigint,
  manufacturer: string,
  signer: string
): Promise<bigint>  // amount distributed
```

---

## System Stats & Metrics

```ts
// Global ecosystem metrics
getMetrics(): Promise<GlobalMetrics>

// Per-participant stats
getStats(address: string): Promise<ParticipantStats>

// Supply chain aggregated stats
getSupplyChainStats(): Promise<SupplyChainStats>
```

**`GlobalMetrics`** fields: `total_wastes_count`, `total_tokens_earned`, `total_participants`.

**`ParticipantStats`** fields: `total_earned`, `materials_submitted`, `materials_verified`.

**`SupplyChainStats`** fields: `total_wastes`, `total_weight`, `total_tokens`.

---

## Admin Methods

```ts
// Initialize admin (first-time setup)
initializeAdmin(admin: string): Promise<void>

// Query current admin address
getAdmin(): Promise<string>

// Transfer admin ownership
transferAdmin(current: string, next: string): Promise<void>

// Update reward split percentages (must sum to 100)
setPercentages(admin: string, recyclerPct: number, collectorPct: number): Promise<void>
```

---

## Network Utilities

```ts
import {
  resolveNetwork,
  isValidStellarAddress,
  getAvailableNetworks,
  getNetworkLabel,
  Network,
} from '@scavngr/sdk'

// Resolve a preset into { rpcUrl, networkPassphrase }
const config = resolveNetwork(Network.Testnet)

// Validate a Stellar public key (G…, 56 chars)
isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN') // true

// List all preset names
getAvailableNetworks() // [Standalone, Testnet, Futurenet, Mainnet]

// Human-readable label
getNetworkLabel(Network.Testnet) // "Testnet"
```

### `Network` enum

| Value | Description |
| :--- | :--- |
| `Network.Standalone` | Local Stellar Quickstart node |
| `Network.Testnet` | Stellar public testnet |
| `Network.Futurenet` | Stellar preview network |
| `Network.Mainnet` | Stellar mainnet |

---

## Signing Strategies

Mutating calls (state-changing methods) require a signing strategy.

### FreighterSigningStrategy (browser)

```ts
import { FreighterSigningStrategy } from '@scavngr/sdk'

client.setSigningStrategy(new FreighterSigningStrategy())
```

Requires the [Freighter](https://www.freighter.app/) browser extension. Throws `SigningError` if unavailable or the user rejects.

### SecretKeySigningStrategy (server/Node.js)

```ts
import { SecretKeySigningStrategy } from '@scavngr/sdk'

client.setSigningStrategy(new SecretKeySigningStrategy('SDEMO...SECRETKEY'))
```

**Never expose secret keys in browser code.**

### Custom Strategy

Implement the `SigningStrategy` interface:

```ts
import type { SigningStrategy } from '@scavngr/sdk'

class MyWallet implements SigningStrategy {
  name = 'MyWallet'
  async sign(txXdr: string, networkPassphrase: string): Promise<string> {
    return await myWallet.signTransaction(txXdr)
  }
}

client.setSigningStrategy(new MyWallet())
```

---

## Error Types

| Class | When thrown |
| :--- | :--- |
| `ContractError` | Contract returned an error code during simulation or execution. Has numeric `code`. |
| `TransactionError` | Transaction failed on-chain. Has `txHash` and `resultXdr`. |
| `SigningError` | Wallet not available or user rejected signing. |
| `NetworkError` | Invalid RPC parameters or unreachable Soroban RPC server. |
| `TimeoutError` | Transaction confirmation polling exceeded `pollTimeoutMs`. |

```ts
import {
  ContractError,
  TransactionError,
  SigningError,
  NetworkError,
  TimeoutError,
} from '@scavngr/sdk'

try {
  await client.submitMaterial(/* … */)
} catch (err) {
  if (err instanceof ContractError) {
    console.error('Contract error #' + err.code, err.message)
  } else if (err instanceof SigningError) {
    console.warn('Signing rejected:', err.message)
  } else if (err instanceof TransactionError) {
    console.error('On-chain failure:', err.txHash)
  } else if (err instanceof TimeoutError) {
    console.error('Confirmation timed out')
  } else if (err instanceof NetworkError) {
    console.error('RPC error:', err.message)
  }
}
```

---

## TypeScript Types

All public types are exported from `@scavngr/sdk`:

| Type | Description |
| :--- | :--- |
| `ClientOptions` | Constructor options for `ScavengerClient` |
| `Participant` | Registered participant (address, role, name, coordinates) |
| `Incentive` | Active incentive program |
| `Material` | Submitted waste material before confirmation |
| `Waste` | Confirmed waste asset tracked through the supply chain |
| `WasteTransfer` | Record of waste custody transfer |
| `ParticipantStats` | Per-participant recycling statistics |
| `GlobalMetrics` | Ecosystem-wide metrics |
| `SupplyChainStats` | Aggregated supply chain statistics |
| `NetworkConfig` | Stellar network RPC configuration |
| `MaterialBatchItem` | Single item in a batch material submission |
| `SigningStrategy` | Interface for custom signing strategies |
| `SdkError` | Union of all SDK error types |

### Enums

```ts
enum Role { Recycler, Collector, Manufacturer }

enum WasteType { Paper, PetPlastic, Plastic, Glass, Metal, Organic, Electronic, Other }

enum CertificationLevel { Beginner, Intermediate, Advanced, Expert }

enum Network { Standalone, Testnet, Futurenet, Mainnet }
```

---

## Contract Entrypoints (Soroban)

<!-- BEGIN GENERATED: contract-entrypoints -->

Generated from `stellar-contract/src/lib.rs` and `stellar-contract/src/errors.rs`. 215 consumer-facing entrypoints. Entrypoints documented as internal are listed in [CONTRACT_DOCUMENTATION.md](./CONTRACT_DOCUMENTATION.md). Do not edit this table by hand; run `python3 scripts/generate-contract-reference.py`.

| Entrypoint | Arguments | Returns | Requires auth | Errors | Status |
|---|---|---|---|---|---|
| `initialize_admin` | `admin: Address` | `()` | `admin` | — | Stable |
| `get_admins` | — | `Vec<Address>` | none | — | Stable |
| `get_admin` | — | `Address` | none | — | Stable |
| `transfer_admin` | `current_admin: Address`, `new_admins: Vec<Address>` | `()` | `current_admin` | — | Stable |
| `add_admin` | `current_admin: Address`, `new_admin: Address` | `()` | `current_admin` | — | Stable |
| `remove_admin` | `current_admin: Address`, `admin_to_remove: Address` | `()` | `current_admin` | — | Stable |
| `set_charity_contract` | `admin: Address`, `charity_address: Address` | `()` | `admin` | — | Stable |
| `get_charity_contract` | — | `Option<Address>` | none | — | Stable |
| `donate_to_charity` | `donor: Address`, `amount: i128` | `()` | `donor` | — | Stable |
| `set_percentages` | `admin: Address`, `collector_percentage: u32`, `owner_percentage: u32` | `()` | `admin` | — | Stable |
| `get_collector_percentage` | — | `Option<u32>` | none | — | Stable |
| `get_owner_percentage` | — | `Option<u32>` | none | — | Stable |
| `set_collector_percentage` | `admin: Address`, `new_percentage: u32` | `()` | `admin` | — | Stable |
| `set_owner_percentage` | `admin: Address`, `new_percentage: u32` | `()` | `admin` | — | Stable |
| `set_min_weight` | `admin: Address`, `min_weight: u128` | `()` | `admin` | — | Stable |
| `get_min_weight` | — | `u128` | none | — | Stable |
| `set_token_address` | `admin: Address`, `token_address: Address` | `()` | `admin` | — | Stable |
| `get_token_address` | — | `Option<Address>` | none | — | Stable |
| `set_seasonal_multiplier` | `admin: Address`, `multiplier: u32`, `start: u64`, `end: u64` | `()` | `admin` | — | Stable |
| `get_current_multiplier` | — | `u32` | none | — | Stable |
| `reward_tokens` | `rewarder: Address`, `recipient: Address`, `amount: i128`, `waste_id: u64` | `()` | `rewarder` | — | Stable |
| `is_participant_registered` | `address: Address` | `bool` | none | — | Stable |
| `register_participant` | `address: Address`, `role: ParticipantRole`, `name: soroban_sdk::Symbol`, `latitude: i128`, `longitude: i128` | `Participant` | `address` | — | Stable |
| `waste_exists` | `waste_id: u64` | `bool` | none | — | Stable |
| `get_waste_type_string` | `waste_type: WasteType` | `String` | none | — | Stable |
| `get_participant_role_string` | `role: ParticipantRole` | `String` | none | — | Stable |
| `is_valid_transfer` | `from: Address`, `to: Address` | `bool` | none | — | Stable |
| `validate_transfer_path` | `waste_id: u128`, `from: Address`, `to: Address` | `Result<(), Error>` | none | `InvalidTransferRoute` (27)<br>`NotWasteOwner` (6)<br>`WasteDeactivated` (18)<br>`WasteExpired` (44)<br>`WasteFrozen` (50)<br>`WasteNotFound` (7) | Stable |
| `admin_override_transfer` | `admin: Address`, `waste_id: u128`, `from: Address`, `to: Address`, `latitude: i128`, `longitude: i128` | `Result<WasteTransfer, Error>` | `admin` | `NotWasteOwner` (6)<br>`WasteFrozen` (50)<br>`WasteNotFound` (7) | Stable |
| `get_transfer_path_data` | `waste_id: u128` | `Vec<WasteTransfer>` | none | — | Stable |
| `incentive_exists` | `incentive_id: u64` | `bool` | none | — | Stable |
| `get_incentive_by_id` | `incentive_id: u64` | `Option<Incentive>` | none | — | Stable |
| `update_incentive_status` | `incentive_id: u64`, `is_active: bool` | `Incentive` | none | — | Stable |
| `update_incentive` | `incentive_id: u64`, `new_reward_points: u64`, `new_total_budget: u64` | `Incentive` | none | — | Stable |
| `calculate_incentive_reward` | `incentive_id: u64`, `waste_amount: u64` | `u64` | none | — | Stable |
| `get_incentives_by_waste_type` | `waste_type: WasteType` | `soroban_sdk::Vec<Incentive>` | none | — | Stable |
| `get_incentives` | `waste_type: WasteType` | `soroban_sdk::Vec<Incentive>` | none | — | Stable |
| `get_active_incentives` | — | `soroban_sdk::Vec<Incentive>` | none | — | Stable |
| `get_participant` | `address: Address` | `Option<Participant>` | none | — | Stable |
| `get_participant_earnings` | `address: Address` | `i128` | none | — | Stable |
| `get_participant_info` | `address: Address` | `Option<ParticipantInfo>` | none | — | Stable |
| `get_all_participants` | `offset: u32`, `limit: u32` | `Vec<Address>` | none | — | Stable |
| `grant_certification` | `admin: Address`, `address: Address`, `level: CertificationLevel` | `()` | `admin` | — | Stable |
| `get_participants_by_cert` | `level: CertificationLevel` | `Vec<Address>` | none | — | Stable |
| `create_auction` | `creator: Address`, `waste_id: u128`, `start_price: u128`, `duration: u64` | `u64` | `creator` | — | Stable |
| `place_bid` | `bidder: Address`, `auction_id: u64`, `amount: u128` | `()` | `bidder` | — | Stable |
| `end_auction` | `auction_id: u64` | `()` | none | — | Stable |
| `cancel_auction` | `caller: Address`, `auction_id: u64` | `()` | `caller` | — | Stable |
| `get_waste_by_tracking_code` | `code: soroban_sdk::String` | `Option<types::Waste>` | none | — | Stable |
| `bulk_import_wastes` | `admin: Address`, `wastes: soroban_sdk::Vec<types::Waste>` | `()` | `admin` | — | Stable |
| `bulk_import_participants` | `admin: Address`, `participants: soroban_sdk::Vec<Participant>` | `()` | `admin` | — | Stable |
| `update_role` | `address: Address`, `new_role: ParticipantRole` | `Participant` | `address` | — | Stable |
| `deregister_participant` | `address: Address` | `Participant` | `address` | — | Stable |
| `update_participant_location` | `address: Address`, `latitude: i128`, `longitude: i128` | `Participant` | `address` | — | Stable |
| `update_location` | `address: Address`, `latitude: i128`, `longitude: i128` | `Participant` | `address` | — | Deprecated |
| `get_transfer_history` | `waste_id: u64` | `Vec<WasteTransfer>` | none | — | Stable |
| `get_waste_transfer_history` | `waste_id: u64` | `Vec<WasteTransfer>` | none | — | Stable |
| `get_waste_transfer_history_v2` | `waste_id: u128` | `Vec<WasteTransfer>` | none | — | Stable |
| `transfer_waste` | `waste_id: u64`, `from: Address`, `to: Address`, `note: String` | `Material` | `from` | — | Deprecated |
| `get_transfers_from` | `_address: Address` | `Vec<(u64, Vec<WasteTransfer>)>` | none | — | Stable |
| `get_transfers_to` | `_address: Address` | `Vec<(u64, Vec<WasteTransfer>)>` | none | — | Stable |
| `can_collect` | `address: Address` | `bool` | none | — | Stable |
| `can_manufacture` | `address: Address` | `bool` | none | — | Stable |
| `submit_material` | `waste_type: WasteType`, `weight: u64`, `submitter: Address`, `description: String` | `Material` | `submitter` | — | Stable |
| `recycle_waste` | `waste_type: WasteType`, `weight: u128`, `recycler: Address`, `latitude: i128`, `longitude: i128` | `u128` | `recycler` | — | Stable |
| `get_waste_v2` | `waste_id: u128` | `Option<types::Waste>` | none | — | Stable |
| `get_participant_wastes_v2` | `participant: Address` | `Vec<u128>` | none | — | Stable |
| `update_processing_status` | `waste_id: u128`, `caller: Address`, `new_status: ProcessingStatus` | `types::Waste` | `caller` | — | Stable |
| `get_wastes_by_status` | `status: ProcessingStatus` | `Vec<u128>` | none | — | Stable |
| `transfer_waste_v2` | `waste_id: u128`, `from: Address`, `to: Address`, `latitude: i128`, `longitude: i128` | `Result<WasteTransfer, Error>` | `from` | `InvalidTransferRoute` (27)<br>`WasteDeactivated` (18)<br>`WasteExpired` (44)<br>`WasteFrozen` (50)<br>`WasteNotFound` (7)<br>`WasteReservedByOther` (42) | Stable |
| `batch_transfer_waste` | `waste_ids: Vec<u128>`, `to: Address`, `latitude: i128`, `longitude: i128` | `Result<Vec<WasteTransfer>, Error>` | none | `InvalidTransferRoute` (27)<br>`WasteDeactivated` (18)<br>`WasteExpired` (44)<br>`WasteNotFound` (7) | Stable |
| `transfer_collected_waste` | `waste_type: WasteType`, `collector: Address`, `manufacturer: Address`, `latitude: i128`, `longitude: i128`, `notes: soroban_sdk::Symbol` | `u128` | `collector` | — | Stable |
| `confirm_waste_details` | `waste_id: u128`, `confirmer: Address` | `types::Waste` | `confirmer` | — | Stable |
| `reset_waste_confirmation` | `waste_id: u128`, `owner: Address` | `types::Waste` | `owner` | — | Stable |
| `deactivate_waste` | `waste_id: u128`, `admin: Address` | `types::Waste` | `admin` | — | Stable |
| `batch_deactivate_waste` | `waste_ids: Vec<u128>`, `admin: Address` | `u32` | `admin` | — | Stable |
| `set_waste_ttl` | `admin: Address`, `waste_type: WasteType`, `ttl_seconds: u64` | `()` | `admin` | — | Stable |
| `get_waste_ttl` | `waste_type: WasteType` | `u64` | none | — | Stable |
| `get_expired_wastes` | — | `Vec<u128>` | none | — | Stable |
| `cleanup_expired_wastes` | `admin: Address` | `u32` | `admin` | — | Stable |
| `check_waste_expiration` | `waste_id: u128` | `bool` | none | — | Stable |
| `get_wastes_approaching_expiry` | `within_seconds: u64` | `Vec<u128>` | none | — | Stable |
| `get_lifecycle_summary` | — | `(u64, u64)` | none | — | Stable |
| `submit_materials_batch` | `materials: soroban_sdk::Vec<(WasteType, u64, String)>`, `submitter: Address` | `soroban_sdk::Vec<Material>` | `submitter` | — | Stable |
| `get_material` | `material_id: u64` | `Option<Material>` | none | — | Stable |
| `get_waste_by_id` | `waste_id: u64` | `Option<Material>` | none | — | Deprecated |
| `get_waste` | `waste_id: u64` | `Option<Material>` | none | — | Stable |
| `get_participant_wastes` | `participant: Address` | `Vec<u64>` | none | — | Stable |
| `get_wastes_batch` | `waste_ids: soroban_sdk::Vec<u64>` | `soroban_sdk::Vec<Option<Material>>` | none | — | Stable |
| `verify_material` | `material_id: u64`, `verifier: Address` | `Material` | `verifier` | — | Stable |
| `verify_materials_batch` | `material_ids: soroban_sdk::Vec<u64>`, `verifier: Address` | `soroban_sdk::Vec<Material>` | `verifier` | — | Stable |
| `get_stats` | `participant: Address` | `Option<RecyclingStats>` | none | — | Stable |
| `calculate_carbon_credits` | `waste_type: WasteType`, `weight_grams: u128` | `u128` | none | — | Stable |
| `get_total_carbon_credits` | — | `u128` | none | — | Stable |
| `get_participant_carbon_credits` | `participant: Address` | `u128` | none | — | Stable |
| `redeem_carbon_credits` | `participant: Address`, `amount: u128` | `Result<u128, Error>` | `participant` | `InsufficientCarbonCredits` (45)<br>`InvalidAmount` (11)<br>`NotRegistered` (3) | Stable |
| `create_carbon_listing` | `seller: Address`, `amount: u128`, `price_per_credit: i128` | `Result<u64, Error>` | `seller` | `InsufficientCarbonCredits` (45)<br>`InvalidListing` (49)<br>`NotRegistered` (3) | Stable |
| `cancel_carbon_listing` | `listing_id: u64`, `seller: Address` | `Result<(), Error>` | `seller` | `CarbonListingInactive` (47)<br>`CarbonListingNotFound` (46)<br>`NotListingSeller` (48)<br>`Overflow` (29) | Stable |
| `purchase_carbon_listing` | `listing_id: u64`, `buyer: Address` | `Result<(), Error>` | `buyer` | `CarbonListingInactive` (47)<br>`CarbonListingNotFound` (46)<br>`InvalidListing` (49)<br>`Overflow` (29)<br>`TokenAddressNotSet` (17) | Stable |
| `get_carbon_listing` | `listing_id: u64` | `Option<CarbonListing>` | none | — | Stable |
| `get_active_carbon_listings` | — | `Vec<CarbonListing>` | none | — | Stable |
| `mark_contaminated` | `waste_id: u128`, `verifier: Address`, `level: u32`, `reason: String` | `types::Waste` | `verifier` | — | Stable |
| `get_contaminated_wastes` | — | `Vec<u128>` | none | — | Stable |
| `get_contamination_score` | `waste_id: u128` | `u32` | none | — | Stable |
| `report_contamination` | `waste_id: u128`, `reporter: Address`, `level: u32`, `reason: String` | `types::ContaminationReport` | `reporter` | — | Stable |
| `get_contamination_reports` | `waste_id: u128` | `Vec<types::ContaminationReport>` | none | — | Stable |
| `batch_submit_materials` | `materials: soroban_sdk::Vec<(WasteType, u64, String)>`, `submitter: Address` | `soroban_sdk::Vec<Material>` | `submitter` | — | Stable |
| `batch_verify_materials` | `material_ids: soroban_sdk::Vec<u64>`, `verifier: Address` | `soroban_sdk::Vec<Material>` | `verifier` | — | Stable |
| `get_supply_chain_stats` | — | `(u64, u64, u128)` | none | — | Stable |
| `get_incentives_by_rewarder` | `rewarder: Address` | `Vec<Incentive>` | none | — | Stable |
| `get_active_mfr_incentive` | `manufacturer: Address`, `waste_type: WasteType` | `Option<Incentive>` | none | — | Stable |
| `create_incentive` | `rewarder: Address`, `waste_type: WasteType`, `reward_points: u64`, `total_budget: u64` | `Incentive` | `rewarder` | — | Stable |
| `claim_incentive_reward` | `incentive_id: u64`, `material_id: u64`, `claimer: Address` | `Result<i128, Error>` | `claimer` | `InsufficientBudget` (31) | Stable |
| `deactivate_incentive` | `incentive_id: u64`, `rewarder: Address` | `Incentive` | `rewarder` | — | Stable |
| `set_waste_grade` | `waste_id: u128`, `grade: WasteGrade`, `grader: Address` | `types::Waste` | `grader` | — | Stable |
| `get_grade_history` | `waste_id: u128` | `Vec<types::GradeRecord>` | none | — | Stable |
| `get_wastes_by_grade` | `grade: WasteGrade` | `Vec<u128>` | none | — | Stable |
| `apply_grade_multiplier` | `base_reward: u64`, `grade: WasteGrade` | `u64` | none | — | Stable |
| `get_grading_analytics` | — | `(u64, u64, u64, u64)` | none | — | Stable |
| `set_waste_grade_ai_verified` | `waste_id: u128`, `grade: WasteGrade`, `grader: Address`, `ai_confidence: u32` | `Result<types::Waste, Error>` | `grader` | — | Stable |
| `get_ai_grade_confidence` | `waste_id: u128` | `Option<u32>` | none | — | Stable |
| `add_waste_tag` | `waste_id: u128`, `tag: String`, `caller: Address` | `types::Waste` | `caller` | — | Stable |
| `remove_waste_tag` | `waste_id: u128`, `tag: String`, `caller: Address` | `types::Waste` | `caller` | — | Stable |
| `get_wastes_by_tag` | `tag: String` | `Vec<u128>` | none | — | Stable |
| `set_waste_image` | `waste_id: u128`, `hash: String`, `caller: Address` | `types::Waste` | `caller` | — | Stable |
| `add_waste_document` | `waste_id: u128`, `hash: String`, `caller: Address` | `types::Waste` | `caller` | — | Stable |
| `set_multisig_threshold` | `admin: Address`, `threshold: u32` | `()` | `admin` | — | Stable |
| `get_multisig_threshold` | — | `u32` | none | — | Stable |
| `propose_admin_action` | `proposer: Address`, `action: AdminAction` | `AdminProposal` | `proposer` | — | Stable |
| `approve_admin_proposal` | `approver: Address`, `proposal_id: u64` | `AdminProposal` | `approver` | — | Stable |
| `execute_admin_proposal` | `executor: Address`, `proposal_id: u64` | `AdminProposal` | `executor` | — | Stable |
| `get_admin_proposal` | `proposal_id: u64` | `AdminProposal` | none | — | Stable |
| `get_metrics` | — | `types::GlobalMetrics` | none | — | Stable |
| `generate_compliance_report` | `admin: Address`, `period: ReportPeriod` | `ComplianceReport` | `admin` | — | Stable |
| `get_compliance_report` | `report_id: u64` | `ComplianceReport` | none | — | Stable |
| `finalize_compliance_report` | `admin: Address`, `report_id: u64` | `()` | `admin` | — | Stable |
| `set_transfer_threshold` | `admin: Address`, `threshold: u128` | `()` | `admin` | — | Stable |
| `set_required_approvals` | `admin: Address`, `count: u32` | `()` | `admin` | — | Stable |
| `approve_high_value_transfer` | `waste_id: u128`, `approver: Address` | `Result<(), Error>` | `approver` | `ApprovalExpired` (?)<br>`Unauthorized` (2)<br>`WasteNotFound` (7) | Stable |
| `substitute_waste` | `original_id: u128`, `substitute_id: u128`, `approver: Address`, `reason: String` | `Result<(), Error>` | `approver` | `InvalidWeight` (12)<br>`WasteNotFound` (7)<br>`WasteTypeMismatch` (25) | Stable |
| `get_transaction_stats` | — | `TransactionStats` | none | — | Stable |
| `take_performance_snapshot` | `admin: Address`, `active_users: u32`, `waste_per_hour: u128`, `latency_ms: u32` | `()` | `admin` | — | Stable |
| `analyze_performance_period` | `start: u64`, `end: u64` | `TransactionStats` | none | — | Stable |
| `pause` | `admin: Address` | `()` | `admin` | — | Stable |
| `unpause` | `admin: Address` | `()` | `admin` | — | Stable |
| `is_paused` | — | `bool` | none | — | Stable |
| `distribute_rewards` | `waste_id: u64`, `incentive_id: u64`, `manufacturer: Address` | `i128` | `manufacturer` | — | Stable |
| `split_waste` | `waste_id: u128`, `owner: Address`, `weights: Vec<u128>` | `Result<Vec<u128>, Error>` | `owner` | `NotWasteOwner` (6)<br>`Overflow` (29)<br>`TooFewSplits` (34)<br>`TooManySplits` (32)<br>`WasteDeactivated` (18)<br>`WasteNotFound` (7)<br>`WeightMismatch` (33) | Stable |
| `merge_wastes` | `waste_ids: Vec<u128>`, `owner: Address` | `Result<u128, Error>` | `owner` | `LocationMismatch` (38)<br>`NotWasteOwner` (6)<br>`Overflow` (29)<br>`TooFewWastes` (35)<br>`TooManyWastes` (36)<br>`WasteDeactivated` (18)<br>`WasteNotFound` (7)<br>`WasteTypeMismatchMerge` (37) | Stable |
| `reserve_waste` | `waste_id: u128`, `reserver: Address`, `duration: u64` | `Result<types::Waste, Error>` | `reserver` | `Overflow` (29)<br>`WasteAlreadyReserved` (39)<br>`WasteDeactivated` (18)<br>`WasteNotFound` (7) | Stable |
| `cancel_reservation` | `waste_id: u128`, `caller: Address` | `Result<types::Waste, Error>` | `caller` | `NotReserver` (41)<br>`WasteNotFound` (7)<br>`WasteNotReserved` (40) | Stable |
| `create_challenge` | `admin: Address`, `title: soroban_sdk::Symbol`, `target_weight: u128`, `waste_type: WasteType`, `start_time: u64`, `end_time: u64`, `reward: u128` | `Challenge` | `admin` | — | Stable |
| `join_challenge` | `challenge_id: u64`, `participant: Address` | `()` | `participant` | — | Stable |
| `get_challenge_progress` | `challenge_id: u64`, `participant: Address` | `ChallengeProgress` | none | — | Stable |
| `update_challenge_progress` | `challenge_id: u64`, `participant: Address`, `weight_grams: u128` | `()` | `participant` | — | Stable |
| `complete_challenge` | `challenge_id: u64`, `participant: Address` | `()` | `participant` | — | Stable |
| `get_active_challenges` | — | `Vec<Challenge>` | none | — | Stable |
| `get_challenge` | `challenge_id: u64` | `Option<Challenge>` | none | — | Stable |
| `initiate_transfer` | `waste_id: u128`, `from: Address`, `to: Address`, `latitude: i128`, `longitude: i128` | `PendingTransfer` | `from` | — | Stable |
| `approve_transfer` | `transfer_id: u64`, `recipient: Address` | `PendingTransfer` | `recipient` | — | Stable |
| `reject_transfer` | `transfer_id: u64`, `recipient: Address` | `PendingTransfer` | `recipient` | — | Stable |
| `get_pending_transfer` | `transfer_id: u64` | `Option<PendingTransfer>` | none | — | Stable |
| `expire_transfer` | `transfer_id: u64` | `PendingTransfer` | none | — | Stable |
| `get_milestones` | — | `Vec<Milestone>` | none | — | Stable |
| `get_participant_milestones` | `participant: Address` | `Vec<u32>` | none | — | Stable |
| `get_top_recyclers` | `limit: u32` | `Vec<LeaderboardEntry>` | none | — | Stable |
| `get_top_collectors` | `limit: u32` | `Vec<LeaderboardEntry>` | none | — | Stable |
| `get_top_verifiers` | `limit: u32` | `Vec<LeaderboardEntry>` | none | — | Stable |
| `get_top_earners` | `limit: u32` | `Vec<LeaderboardEntry>` | none | — | Stable |
| `get_participant_rank` | `participant: Address`, `metric: soroban_sdk::Symbol` | `u32` | none | — | Stable |
| `schedule_incentive` | `incentive_id: u64`, `rewarder: Address`, `starts_at: Option<u64>`, `ends_at: Option<u64>` | `Result<Incentive, Error>` | `rewarder` | `InvalidSchedule` (43)<br>`NotCreator` (30) | Stable |
| `set_processing_cost` | `waste_id: u128`, `owner: Address`, `cost: u128` | `Result<types::Waste, Error>` | `owner` | `NotWasteOwner` (6)<br>`WasteNotFound` (7) | Stable |
| `get_total_processing_costs` | — | `u128` | none | — | Stable |
| `get_participant_processing_costs` | `participant: Address` | `u128` | none | — | Stable |
| `set_waste_composition` | `waste_id: u128`, `verifier: Address`, `composition: Vec<types::MaterialComposition>` | `Result<types::Waste, Error>` | `verifier` | `InvalidAmount` (11)<br>`NotRegistered` (3)<br>`Unauthorized` (2)<br>`WasteNotFound` (7) | Stable |
| `get_wastes_by_composition` | `material_type: WasteType`, `min_percentage: u32` | `Vec<u128>` | none | — | Stable |
| `participant_composition_analysis` | `participant: Address` | `Vec<types::CompositionEntry>` | none | — | Stable |
| `get_composition_analytics` | — | `Vec<types::CompositionEntry>` | none | — | Stable |
| `verify_waste_composition` | `waste_id: u128` | `Result<bool, Error>` | none | `WasteNotFound` (7) | Stable |
| `set_recycling_goal` | `participant: Address`, `target_weight: u128`, `target_date: u64`, `waste_type: OptionalWasteType` | `Result<(), Error>` | `participant` | `InvalidAmount` (11)<br>`NotRegistered` (3) | Stable |
| `get_goal_progress` | `participant: Address` | `Vec<types::RecyclingGoal>` | none | — | Stable |
| `get_participants_meeting_goals` | — | `Vec<Address>` | none | — | Stable |
| `get_global_recycling_rate` | — | `u32` | none | — | Stable |
| `get_participant_recycling_rate` | `participant: Address` | `u32` | none | — | Stable |
| `create_dispute` | `disputer: Address`, `waste_id: u128`, `reason: String` | `Dispute` | `disputer` | — | Stable |
| `resolve_dispute` | `admin: Address`, `dispute_id: u64`, `accepted: bool`, `note: String` | `Dispute` | `admin` | — | Stable |
| `get_dispute` | `dispute_id: u64` | `Option<Dispute>` | none | — | Stable |
| `get_disputes` | `status: DisputeStatus` | `Vec<Dispute>` | none | — | Stable |
| `get_reputation_badge` | `address: Address` | `ReputationBadge` | none | — | Stable |
| `penalize_reputation` | `admin: Address`, `target: Address`, `delta: i128` | `()` | `admin` | — | Stable |
| `decay_reputation` | `address: Address` | `i128` | none | — | Stable |
| `get_participants_by_reputation` | `min_score: i128` | `Vec<Address>` | none | — | Stable |
| `create_collection_route` | `collector: Address`, `waste_ids: Vec<u128>` | `CollectionRoute` | `collector` | — | Stable |
| `complete_route` | `collector: Address`, `route_id: u64` | `CollectionRoute` | `collector` | — | Stable |
| `get_route` | `route_id: u64` | `Option<CollectionRoute>` | none | — | Stable |
| `get_wastes_in_radius` | `lat: i128`, `lon: i128`, `radius_km: u32` | `Vec<u128>` | none | — | Stable |
| `calculate_quality_score` | `waste_id: u128`, `scorer: Address` | `Result<QualityScore, Error>` | `scorer` | `WasteNotFound` (7) | Stable |
| `get_quality_score` | `waste_id: u128` | `Option<QualityScore>` | none | — | Stable |
| `get_wastes_by_quality` | `min_score: u32` | `Vec<u128>` | none | — | Stable |
| `update_waste_location` | `waste_id: u128`, `latitude: i128`, `longitude: i128`, `updater: Address` | `Result<(), Error>` | `updater` | `InvalidCoordinates` (13)<br>`WasteNotFound` (7) | Stable |
| `get_location_history` | `waste_id: u128` | `Vec<LocationRecord>` | none | — | Stable |
| `create_waste_batch` | `creator: Address` | `Result<u64, Error>` | `creator` | — | Stable |
| `add_waste_to_batch` | `batch_id: u64`, `waste_id: u128`, `adder: Address` | `Result<(), Error>` | `adder` | `InvalidAmount` (11)<br>`WasteNotFound` (7) | Stable |
| `get_batch` | `batch_id: u64` | `Option<WasteBatch>` | none | — | Stable |
| `mark_batch_ready` | `batch_id: u64`, `marker: Address` | `Result<(), Error>` | `marker` | `InvalidAmount` (11)<br>`Unauthorized` (2) | Stable |
| `process_batch` | `batch_id: u64`, `processor: Address`, `note: String` | `Result<(), Error>` | `processor` | `InvalidAmount` (11)<br>`WasteNotFound` (7) | Stable |
| `certify_waste` | `waste_id: u128`, `level: u32`, `certifier: Address`, `expires_at: u64`, `notes: String` | `Result<(), Error>` | `certifier` | `InvalidAmount` (11)<br>`WasteNotFound` (7) | Stable |
| `get_waste_certification` | `waste_id: u128` | `Option<WasteCertification>` | none | — | Stable |
| `is_waste_certified` | `waste_id: u128` | `bool` | none | — | Stable |
| `grant_permission` | `admin: Address`, `subject: Address`, `permission: u32` | `Result<(), Error>` | `admin` | `InvalidPermission` (52)<br>`Unauthorized` (2) | Stable |
| `revoke_permission` | `admin: Address`, `subject: Address`, `permission: u32` | `Result<(), Error>` | `admin` | `InvalidPermission` (52)<br>`Unauthorized` (2) | Stable |
| `has_permission` | `subject: Address`, `permission: u32` | `Result<bool, Error>` | none | `InvalidPermission` (52) | Stable |
| `get_permission_audit` | `subject: Address` | `Vec<PermissionAuditEntry>` | none | — | Stable |
| `reconcile_waste` | `waste_id: u128`, `verified_weight: u128`, `reconciler: Address`, `reason: String` | `Result<ReconciliationRecord, Error>` | `reconciler` | `NoDiscrepancy` (53)<br>`Overflow` (29)<br>`ReconciliationThresholdExceeded` (54)<br>`Unauthorized` (2)<br>`WasteDeactivated` (18)<br>`WasteNotFound` (7) | Stable |
| `get_reconciliation_log` | `waste_id: u128` | `Vec<ReconciliationRecord>` | none | — | Stable |

<!-- END GENERATED: contract-entrypoints -->
