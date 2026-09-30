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
