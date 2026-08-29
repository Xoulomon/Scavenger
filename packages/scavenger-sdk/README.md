# @scavngr/sdk

Official TypeScript SDK for interacting with Scavngr Soroban smart contracts on the Stellar network.

## Installation

```bash
npm install @scavngr/sdk @stellar/stellar-sdk
# or
yarn add @scavngr/sdk @stellar/stellar-sdk
# or
pnpm add @scavngr/sdk @stellar/stellar-sdk
```

Optional peer dependency for browser wallet support:

```bash
npm install @stellar/freighter-api
```

---

## Getting Started

```ts
import { ScavengerClient, Network, resolveNetwork, Role, WasteType, FreighterSigningStrategy } from '@scavngr/sdk'

// 1. Initialize network configuration
const network = resolveNetwork(Network.Testnet)

// 2. Instantiate the client
const client = new ScavengerClient({
  rpcUrl: network.rpcUrl,
  networkPassphrase: network.networkPassphrase,
  contractId: 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZLKE...',
})

// 3. (Optional) Configure browser signing strategy for state-mutating calls
client.setSigningStrategy(new FreighterSigningStrategy())

// 4. Query public on-chain metrics (read-only call)
async function main() {
  const metrics = await client.getMetrics()
  console.log(`Total wastes submitted: ${metrics.total_wastes_count}`)
  console.log(`Total tokens earned: ${metrics.total_tokens_earned}`)
}

main().catch(console.error)
```

---

## Table of Contents

- [Client Setup & Configuration](#client-setup--configuration)
- [Signing Strategies](#signing-strategies)
- [API Reference](#api-reference)
  - [Participants](#participants)
  - [Materials & Waste](#materials--waste)
  - [Incentives & Rewards](#incentives--rewards)
  - [System Stats & Metrics](#system-stats--metrics)
  - [Admin Methods](#admin-methods)
- [Network Utilities](#network-utilities)
- [Error Handling & Error Types](#error-handling--error-types)

---

## Client Setup & Configuration

### `ScavengerClient`

The primary class for contract interaction.

```ts
import { ScavengerClient, type ClientOptions } from '@scavngr/sdk'

const options: ClientOptions = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2025',
  contractId: 'C...',
  pollTimeoutMs: 30000,   // Optional: transaction polling timeout in ms (default: 30000)
  pollIntervalMs: 1500,   // Optional: polling interval in ms (default: 1500)
}

const client = new ScavengerClient(options)
```

---

## Signing Strategies

Mutating transactions (state-changing methods) require a signing strategy or private key.

### Browser (Freighter)

```ts
import { ScavengerClient, FreighterSigningStrategy } from '@scavngr/sdk'

const client = new ScavengerClient({ ... })
client.setSigningStrategy(new FreighterSigningStrategy())
```

### Server / Node.js (Secret Key)

```ts
import { ScavengerClient, SecretKeySigningStrategy } from '@scavngr/sdk'

const client = new ScavengerClient({ ... })
client.setSigningStrategy(new SecretKeySigningStrategy('SDEMO...SECRETKEY'))
```

### Custom Signing Strategy

Implement the `SigningStrategy` interface for custom hardware or MPC wallets:

```ts
import type { SigningStrategy } from '@scavngr/sdk'

class MyCustomSigner implements SigningStrategy {
  name = 'CustomSigner'
  async sign(txXdr: string, networkPassphrase: string): Promise<string> {
    // Custom signing logic...
    return signedTxXdr
  }
}

client.setSigningStrategy(new MyCustomSigner())
```

---

## API Reference

### Participants

#### `registerParticipant(address, role, name, lat, lon, signer)`
Registers a participant in the recycling ecosystem.

```ts
import { Role } from '@scavngr/sdk'

const participant = await client.registerParticipant(
  'GABC...1234',
  Role.Recycler,
  'Green Leaf Recycling',
  40712800,   // Latitude * 10^6
  -74006000,  // Longitude * 10^6
  'GABC...1234'
)
```

#### `getParticipant(address)`
Retrieves registered participant data or returns `null`.

```ts
const participant = await client.getParticipant('GABC...1234')
if (participant) {
  console.log(participant.name, participant.role)
}
```

#### `getParticipantInfo(address)`
Returns participant details along with their aggregate recycling stats.

```ts
const info = await client.getParticipantInfo('GABC...1234')
if (info) {
  console.log(`Earned: ${info.stats.total_earned} tokens`)
  console.log(`Submissions: ${info.stats.materials_submitted}`)
}
```

#### `updateRole(address, newRole, signer)`
Updates a participant's role.

```ts
await client.updateRole('GABC...1234', Role.Collector, 'GADMIN...9999')
```

#### `isParticipantRegistered(address)`
Checks registration status.

```ts
const isRegistered = await client.isParticipantRegistered('GABC...1234')
```

---

### Materials & Waste

#### `submitMaterial(submitter, wasteType, weight, lat, lon, signer)`
Submits a single waste material record.

```ts
import { WasteType } from '@scavngr/sdk'

const material = await client.submitMaterial(
  'GABC...1234',
  WasteType.Plastic,
  5000n,       // weight in grams
  40712800n,   // lat (scaled)
  -74006000n,  // lon (scaled)
  'GABC...1234'
)
```

#### `submitMaterialsBatch(submitter, materials, signer)`
Batch submission of multiple materials.

```ts
const materials = await client.submitMaterialsBatch(
  'GABC...1234',
  [
    { wasteType: WasteType.Paper, weight: 2500n },
    { wasteType: WasteType.Glass, weight: 1200n },
  ],
  'GABC...1234'
)
```

#### `verifyMaterial(materialId, verifier, signer)`
Verifies a submitted material batch item.

```ts
await client.verifyMaterial(1n, 'GVERIFIER...', 'GVERIFIER...')
```

#### `transferWaste(wasteId, from, to, lat, lon, note, signer)`
Transfers waste custody across participants in the supply chain.

```ts
await client.transferWaste(
  42n,
  'GCOLLECTOR...',
  'GRECYCLER...',
  40712800n,
  -74006000n,
  'Delivered to facility warehouse B',
  'GCOLLECTOR...'
)
```

#### `getWaste(wasteId)`
Fetches details of a registered waste asset.

```ts
const waste = await client.getWaste(42n)
```

#### `getWasteTransferHistory(wasteId)`
Fetches chronological transfer history for a waste asset.

```ts
const history = await client.getWasteTransferHistory(42n)
history.forEach((tx) => {
  console.log(`Transferred from ${tx.from} to ${tx.to} at timestamp ${tx.transferred_at}`)
})
```

---

### Incentives & Rewards

#### `createIncentive(rewarder, wasteType, rewardPoints, budget, signer)`
Creates a manufacturer incentive pool.

```ts
const incentive = await client.createIncentive(
  'GMFG...5678',
  WasteType.PetPlastic,
  100n,   // points per kg
  50000n, // total points budget
  'GMFG...5678'
)
```

#### `getActiveIncentives()`
Returns all active incentive programs.

```ts
const activeIncentives = await client.getActiveIncentives()
```

#### `distributeRewards(wasteId, incentiveId, manufacturer, signer)`
Distributes token rewards for a confirmed waste recycling batch.

```ts
const amount = await client.distributeRewards(42n, 1n, 'GMFG...5678', 'GMFG...5678')
console.log(`Distributed ${amount} reward points`)
```

---

### System Stats & Metrics

```ts
// Global metrics
const metrics = await client.getMetrics()
console.log(metrics.total_wastes_count, metrics.total_tokens_earned)

// Participant stats
const stats = await client.getStats('GABC...1234')
console.log(stats.total_earned, stats.materials_submitted)

// Supply chain aggregated stats
const supplyStats = await client.getSupplyChainStats()
console.log(supplyStats.total_wastes, supplyStats.total_weight, supplyStats.total_tokens)
```

---

### Admin Methods

```ts
// Initialize admin
await client.initializeAdmin('GADMIN...')

// Query admin
const adminAddress = await client.getAdmin()

// Transfer admin ownership
await client.transferAdmin('GCURRENT...', 'GNEWADMIN...')

// Update reward percentage splits (must sum to 100)
await client.setPercentages('GADMIN...', 60, 40)
```

---

## Network Utilities

```ts
import {
  resolveNetwork,
  isValidStellarAddress,
  getAvailableNetworks,
  getNetworkLabel,
  Network
} from '@scavngr/sdk'

// 1. Resolve network presets
const testnetConfig = resolveNetwork(Network.Testnet)
const mainnetConfig = resolveNetwork(Network.Mainnet)

// 2. Validate Stellar addresses (public key)
const valid = isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN') // true

// 3. List available network presets
const networks = getAvailableNetworks() // [Standalone, Testnet, Futurenet, Mainnet]

// 4. Get display labels
console.log(getNetworkLabel(Network.Standalone)) // "Standalone (Local)"
```

---

## Error Handling & Error Types

The SDK provides specific typed error classes derived from `Error`:

| Error Class | Origin | Description |
| :--- | :--- | :--- |
| `ContractError` | Contract Simulation / Execution | Soroban contract execution failed or rejected the invocation (includes numeric `code`). |
| `TransactionError` | Stellar RPC / On-Chain | Transaction failed during submission or failed on-chain (includes `txHash` and `resultXdr`). |
| `SigningError` | Wallet / Keypair | Wallet extension unavailable or signing rejected by user. |
| `NetworkError` | RPC / Connection | Invalid network parameters or unreachable Soroban RPC server. |
| `TimeoutError` | Polling | Polling for on-chain transaction confirmation timed out. |

### Recommended Error Handling Pattern

```ts
import {
  ScavengerClient,
  ContractError,
  TransactionError,
  SigningError,
  NetworkError,
  TimeoutError,
  type SdkError
} from '@scavngr/sdk'

try {
  await client.submitMaterial(submitter, WasteType.Plastic, 500n, 0n, 0n, submitter)
} catch (error) {
  if (error instanceof ContractError) {
    // Handle contract logic errors (e.g. invalid permissions, inactive entity)
    console.error(`Contract execution error #${error.code ?? 'unknown'}:`, error.message)
  } else if (error instanceof SigningError) {
    // Handle user rejecting signing in wallet
    console.warn('Wallet signing was declined or wallet is locked:', error.message)
  } else if (error instanceof TransactionError) {
    // Handle on-chain transaction failures
    console.error(`Transaction failed on-chain: ${error.txHash}`, error.resultXdr)
  } else if (error instanceof TimeoutError) {
    // Handle long-pending or dropped transactions
    console.error('Transaction status check timed out. Verify status on Stellar expert.')
  } else if (error instanceof NetworkError) {
    // Handle RPC node issues
    console.error(`Network RPC error at ${error.rpcUrl}:`, error.message)
  } else {
    console.error('Unexpected error:', error)
  }
}
```

---

## License

MIT
