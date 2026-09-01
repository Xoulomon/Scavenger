# Scavngr API Documentation

## Overview

Scavngr is a decentralized recycling platform built on Stellar blockchain using Soroban smart contracts. This documentation covers all contract functions, REST endpoints, and integration examples.

## Authentication

All contract interactions require a valid Stellar account with sufficient XLM for transaction fees. REST API endpoints may require API keys for rate limiting.

### Stellar Account Setup

```bash
# Generate keypair
soroban keys generate my-account

# Fund account on testnet
curl "https://friendbot.stellar.org?addr=$(soroban keys address my-account)"
```

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Burst**: 10 requests per second
- **Response Header**: `X-RateLimit-Remaining`

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 1 | UnauthorizedAdmin | Only admin can perform this action |
| 2 | ParticipantNotFound | Participant not registered |
| 3 | InvalidRole | Invalid participant role |
| 4 | WasteNotFound | Waste/material not found |
| 5 | InvalidTransfer | Invalid waste transfer path |
| 6 | IncentiveNotFound | Incentive not found |
| 7 | InsufficientBudget | Incentive budget exhausted |
| 8 | InvalidCoordinates | Latitude/longitude out of range |
| 9 | InvalidWeight | Weight exceeds maximum |
| 10 | AlreadyConfirmed | Waste already confirmed |

---

## Contract Functions

### Admin Functions

#### `initialize_admin(admin: Address)`

Initialize contract admin (can only be called once).

**Parameters:**
- `admin` (Address): Admin account address

**Returns:** None

**Example:**
```rust
let admin = Address::from_contract_id(&env, &contract_id);
contract.initialize_admin(&admin);
```

**Error Codes:** None (first call only)

---

#### `transfer_admin(current_admin: Address, new_admin: Address)`

Transfer admin rights to another account.

**Parameters:**
- `current_admin` (Address): Current admin address
- `new_admin` (Address): New admin address

**Returns:** None

**Example:**
```rust
contract.transfer_admin(&current_admin, &new_admin);
```

**Error Codes:** 1 (UnauthorizedAdmin)

---

#### `set_charity_contract(admin: Address, charity_address: Address)`

Set charity contract address for donations.

**Parameters:**
- `admin` (Address): Admin account
- `charity_address` (Address): Charity contract address

**Returns:** None

**Example:**
```rust
contract.set_charity_contract(&admin, &charity_address);
```

**Error Codes:** 1 (UnauthorizedAdmin)

---

#### `set_token_address(admin: Address, token_address: Address)`

Set reward token address.

**Parameters:**
- `admin` (Address): Admin account
- `token_address` (Address): Token contract address

**Returns:** None

**Example:**
```rust
contract.set_token_address(&admin, &token_address);
```

**Error Codes:** 1 (UnauthorizedAdmin)

---

#### `set_percentages(admin: Address, collector_pct: u32, owner_pct: u32)`

Set reward split percentages (must sum to 100).

**Parameters:**
- `admin` (Address): Admin account
- `collector_pct` (u32): Collector percentage (0-100)
- `owner_pct` (u32): Owner percentage (0-100)

**Returns:** None

**Example:**
```rust
contract.set_percentages(&admin, 30, 70);
```

**Error Codes:** 1 (UnauthorizedAdmin)

---

### Participant Functions

#### `register_participant(address: Address, role: u32, name: String, lat: i32, lon: i32)`

Register a new participant.

**Parameters:**
- `address` (Address): Participant address
- `role` (u32): Role (0=Recycler, 1=Collector, 2=Manufacturer)
- `name` (String): Participant name
- `lat` (i32): Latitude (scaled by 1,000,000)
- `lon` (i32): Longitude (scaled by 1,000,000)

**Returns:** None

**Example:**
```rust
contract.register_participant(
    &participant_addr,
    0, // Recycler
    String::from_slice(&env, "John's Recycling"),
    40_000_000, // 40.0°N
    -74_000_000, // -74.0°W
);
```

**Error Codes:** 3 (InvalidRole), 8 (InvalidCoordinates)

---

#### `get_participant(address: Address) -> Option<Participant>`

Get participant information.

**Parameters:**
- `address` (Address): Participant address

**Returns:** Participant struct or None

**Example:**
```rust
let participant = contract.get_participant(&address);
```

**Error Codes:** None

---

#### `get_participant_info(address: Address) -> Option<ParticipantInfo>`

Get participant with statistics.

**Parameters:**
- `address` (Address): Participant address

**Returns:** ParticipantInfo struct or None

**Example:**
```rust
let info = contract.get_participant_info(&address);
if let Some(info) = info {
    println!("Wastes submitted: {}", info.stats.total_wastes);
}
```

**Error Codes:** None

---

#### `update_role(address: Address, new_role: u32)`

Update participant role.

**Parameters:**
- `address` (Address): Participant address
- `new_role` (u32): New role (0=Recycler, 1=Collector, 2=Manufacturer)

**Returns:** None

**Example:**
```rust
contract.update_role(&address, 1); // Change to Collector
```

**Error Codes:** 2 (ParticipantNotFound), 3 (InvalidRole)

---

#### `deregister_participant(address: Address)`

Deregister a participant.

**Parameters:**
- `address` (Address): Participant address

**Returns:** None

**Example:**
```rust
contract.deregister_participant(&address);
```

**Error Codes:** 2 (ParticipantNotFound)

---

#### `is_participant_registered(address: Address) -> bool`

Check if participant is registered.

**Parameters:**
- `address` (Address): Participant address

**Returns:** Boolean

**Example:**
```rust
if contract.is_participant_registered(&address) {
    println!("Participant is registered");
}
```

**Error Codes:** None

---

### Waste/Material Functions

#### `submit_material(submitter: Address, waste_type: u32, weight: u128, lat: i32, lon: i32) -> u64`

Submit waste material.

**Parameters:**
- `submitter` (Address): Submitter address
- `waste_type` (u32): Type (0=Plastic, 1=Paper, 2=Metal, 3=Glass, 4=Organic)
- `weight` (u128): Weight in grams
- `lat` (i32): Latitude (scaled by 1,000,000)
- `lon` (i32): Longitude (scaled by 1,000,000)

**Returns:** Waste ID

**Example:**
```rust
let waste_id = contract.submit_material(
    &submitter,
    0, // Plastic
    5000, // 5kg
    40_000_000,
    -74_000_000,
);
```

**Error Codes:** 2 (ParticipantNotFound), 8 (InvalidCoordinates), 9 (InvalidWeight)

---

#### `submit_materials_batch(submitter: Address, materials: Vec<Material>) -> Vec<u64>`

Batch submit multiple materials.

**Parameters:**
- `submitter` (Address): Submitter address
- `materials` (Vec<Material>): Array of materials

**Returns:** Array of waste IDs

**Example:**
```rust
let materials = vec![
    Material { waste_type: 0, weight: 5000, lat: 40_000_000, lon: -74_000_000 },
    Material { waste_type: 1, weight: 3000, lat: 40_000_000, lon: -74_000_000 },
];
let ids = contract.submit_materials_batch(&submitter, &materials);
```

**Error Codes:** 2 (ParticipantNotFound), 8 (InvalidCoordinates), 9 (InvalidWeight)

---

#### `verify_material(material_id: u64, verifier: Address)`

Verify a material submission.

**Parameters:**
- `material_id` (u64): Waste ID
- `verifier` (Address): Verifier address

**Returns:** None

**Example:**
```rust
contract.verify_material(waste_id, &verifier);
```

**Error Codes:** 4 (WasteNotFound), 2 (ParticipantNotFound)

---

#### `transfer_waste(waste_id: u64, from: Address, to: Address, lat: i32, lon: i32, note: String)`

Transfer waste to another participant.

**Parameters:**
- `waste_id` (u64): Waste ID
- `from` (Address): Current owner
- `to` (Address): New owner
- `lat` (i32): Transfer location latitude
- `lon` (i32): Transfer location longitude
- `note` (String): Transfer note

**Returns:** None

**Example:**
```rust
contract.transfer_waste(
    waste_id,
    &recycler,
    &collector,
    40_000_000,
    -74_000_000,
    String::from_slice(&env, "Collected from site A"),
);
```

**Error Codes:** 4 (WasteNotFound), 5 (InvalidTransfer), 8 (InvalidCoordinates)

---

#### `confirm_waste_details(waste_id: u64, confirmer: Address)`

Confirm waste details.

**Parameters:**
- `waste_id` (u64): Waste ID
- `confirmer` (Address): Confirmer address

**Returns:** None

**Example:**
```rust
contract.confirm_waste_details(waste_id, &confirmer);
```

**Error Codes:** 4 (WasteNotFound), 10 (AlreadyConfirmed)

---

#### `reset_waste_confirmation(waste_id: u64, owner: Address)`

Reset waste confirmation status.

**Parameters:**
- `waste_id` (u64): Waste ID
- `owner` (Address): Waste owner

**Returns:** None

**Example:**
```rust
contract.reset_waste_confirmation(waste_id, &owner);
```

**Error Codes:** 4 (WasteNotFound)

---

#### `deactivate_waste(admin: Address, waste_id: u64)`

Deactivate waste (admin only).

**Parameters:**
- `admin` (Address): Admin address
- `waste_id` (u64): Waste ID

**Returns:** None

**Example:**
```rust
contract.deactivate_waste(&admin, waste_id);
```

**Error Codes:** 1 (UnauthorizedAdmin), 4 (WasteNotFound)

---

#### `get_waste(waste_id: u64) -> Option<Waste>`

Get waste by ID.

**Parameters:**
- `waste_id` (u64): Waste ID

**Returns:** Waste struct or None

**Example:**
```rust
if let Some(waste) = contract.get_waste(waste_id) {
    println!("Waste type: {}", waste.waste_type);
}
```

**Error Codes:** None

---

#### `get_participant_wastes(participant: Address) -> Vec<u64>`

Get all waste IDs for a participant.

**Parameters:**
- `participant` (Address): Participant address

**Returns:** Array of waste IDs

**Example:**
```rust
let waste_ids = contract.get_participant_wastes(&participant);
```

**Error Codes:** None

---

#### `get_waste_transfer_history(waste_id: u64) -> Vec<TransferRecord>`

Get transfer history for waste.

**Parameters:**
- `waste_id` (u64): Waste ID

**Returns:** Array of transfer records

**Example:**
```rust
let history = contract.get_waste_transfer_history(waste_id);
for record in history {
    println!("Transferred from {:?} to {:?}", record.from, record.to);
}
```

**Error Codes:** None

---

### Incentive Functions

#### `create_incentive(rewarder: Address, waste_type: u32, reward_points: u128, budget: u128) -> u64`

Create incentive for waste type.

**Parameters:**
- `rewarder` (Address): Manufacturer address
- `waste_type` (u32): Waste type (0-4)
- `reward_points` (u128): Points per unit
- `budget` (u128): Total budget

**Returns:** Incentive ID

**Example:**
```rust
let incentive_id = contract.create_incentive(
    &manufacturer,
    0, // Plastic
    100, // 100 points per kg
    10000, // 10000 point budget
);
```

**Error Codes:** 2 (ParticipantNotFound), 3 (InvalidRole)

---

#### `update_incentive(incentive_id: u64, rewarder: Address, reward_points: u128, budget: u128)`

Update incentive.

**Parameters:**
- `incentive_id` (u64): Incentive ID
- `rewarder` (Address): Manufacturer address
- `reward_points` (u128): New reward points
- `budget` (u128): New budget

**Returns:** None

**Example:**
```rust
contract.update_incentive(incentive_id, &manufacturer, 150, 15000);
```

**Error Codes:** 6 (IncentiveNotFound), 2 (ParticipantNotFound)

---

#### `deactivate_incentive(incentive_id: u64, rewarder: Address)`

Deactivate incentive.

**Parameters:**
- `incentive_id` (u64): Incentive ID
- `rewarder` (Address): Manufacturer address

**Returns:** None

**Example:**
```rust
contract.deactivate_incentive(incentive_id, &manufacturer);
```

**Error Codes:** 6 (IncentiveNotFound)

---

#### `get_incentive_by_id(incentive_id: u64) -> Option<Incentive>`

Get incentive by ID.

**Parameters:**
- `incentive_id` (u64): Incentive ID

**Returns:** Incentive struct or None

**Example:**
```rust
if let Some(incentive) = contract.get_incentive_by_id(incentive_id) {
    println!("Reward points: {}", incentive.reward_points);
}
```

**Error Codes:** None

---

#### `get_incentives(waste_type: u32) -> Vec<Incentive>`

Get active incentives by waste type.

**Parameters:**
- `waste_type` (u32): Waste type (0-4)

**Returns:** Array of incentives

**Example:**
```rust
let incentives = contract.get_incentives(0); // Plastic incentives
```

**Error Codes:** None

---

#### `get_active_incentives() -> Vec<Incentive>`

Get all active incentives.

**Returns:** Array of incentives

**Example:**
```rust
let all_incentives = contract.get_active_incentives();
```

**Error Codes:** None

---

#### `get_active_mfr_incentive(manufacturer: Address, waste_type: u32) -> Option<Incentive>`

Get best active incentive for manufacturer and waste type.

**Parameters:**
- `manufacturer` (Address): Manufacturer address
- `waste_type` (u32): Waste type (0-4)

**Returns:** Incentive struct or None

**Example:**
```rust
if let Some(incentive) = contract.get_active_mfr_incentive(&manufacturer, 0) {
    println!("Best incentive: {} points", incentive.reward_points);
}
```

**Error Codes:** None

---

#### `distribute_rewards(waste_id: u64, incentive_id: u64, manufacturer: Address)`

Distribute supply chain rewards.

**Parameters:**
- `waste_id` (u64): Waste ID
- `incentive_id` (u64): Incentive ID
- `manufacturer` (Address): Manufacturer address

**Returns:** None

**Example:**
```rust
contract.distribute_rewards(waste_id, incentive_id, &manufacturer);
```

**Error Codes:** 4 (WasteNotFound), 6 (IncentiveNotFound), 7 (InsufficientBudget)

---

### Statistics Functions

#### `get_metrics() -> GlobalMetrics`

Get global metrics.

**Returns:** GlobalMetrics struct

**Example:**
```rust
let metrics = contract.get_metrics();
println!("Total wastes: {}", metrics.total_wastes);
println!("Total tokens distributed: {}", metrics.total_tokens);
```

**Error Codes:** None

---

#### `get_stats(participant: Address) -> Option<ParticipantStats>`

Get participant statistics.

**Parameters:**
- `participant` (Address): Participant address

**Returns:** ParticipantStats struct or None

**Example:**
```rust
if let Some(stats) = contract.get_stats(&participant) {
    println!("Wastes submitted: {}", stats.total_wastes);
}
```

**Error Codes:** None

---

#### `get_supply_chain_stats() -> SupplyChainStats`

Get global supply chain statistics.

**Returns:** SupplyChainStats struct

**Example:**
```rust
let stats = contract.get_supply_chain_stats();
println!("Total recycled: {} kg", stats.total_weight);
```

**Error Codes:** None

---

## Data Types

### Participant

```rust
pub struct Participant {
    pub address: Address,
    pub role: u32,
    pub name: String,
    pub lat: i32,
    pub lon: i32,
    pub registered_at: u64,
}
```

### Waste

```rust
pub struct Waste {
    pub id: u64,
    pub waste_type: u32,
    pub weight: u128,
    pub owner: Address,
    pub lat: i32,
    pub lon: i32,
    pub created_at: u64,
    pub confirmed: bool,
    pub active: bool,
}
```

### Incentive

```rust
pub struct Incentive {
    pub id: u64,
    pub manufacturer: Address,
    pub waste_type: u32,
    pub reward_points: u128,
    pub budget: u128,
    pub spent: u128,
    pub active: bool,
    pub created_at: u64,
}
```

### ParticipantStats

```rust
pub struct ParticipantStats {
    pub total_wastes: u64,
    pub total_weight: u128,
    pub total_tokens: u128,
    pub verified_count: u64,
}
```

---

## Code Examples

### JavaScript/TypeScript

```typescript
import { Keypair, Networks, TransactionBuilder, Operation } from 'stellar-sdk';
import { ContractSpec, nativeToScVal } from '@stellar/js-stellar-sdk';

const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const keypair = Keypair.fromSecret('SBXXXXXXX...');

async function registerParticipant() {
  const account = await server.getAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract([
          nativeToScVal(contractId),
          nativeToScVal('register_participant'),
          nativeToScVal(keypair.publicKey()),
          nativeToScVal(0), // Recycler
          nativeToScVal('My Recycling'),
          nativeToScVal(40000000),
          nativeToScVal(-74000000),
        ]),
        auth: [],
      })
    )
    .setTimeout(30)
    .build();

  const signed = keypair.signTransaction(tx);
  const result = await server.submitTransaction(signed);
  return result;
}
```

### Python

```python
from stellar_sdk import Keypair, Network, TransactionBuilder, Server
from stellar_sdk.operation import InvokeHostFunction

contract_id = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4'
keypair = Keypair.from_secret('SBXXXXXXX...')
server = Server('https://soroban-testnet.stellar.org')

def register_participant():
    account = server.load_account(keypair.public_key)

    tx = (
        TransactionBuilder(
            account,
            base_fee=100,
            network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
        )
        .add_text_memo('Register participant')
        .set_timeout(30)
        .build()
    )

    signed = keypair.sign_transaction(tx)
    result = server.submit_transaction(signed)
    return result
```

### Rust

```rust
use soroban_sdk::{Address, Env, String};

pub fn register_participant(
    env: &Env,
    contract: &ContractClient,
    address: Address,
    role: u32,
    name: &str,
    lat: i32,
    lon: i32,
) {
    contract.register_participant(
        &address,
        &role,
        &String::from_slice(env, name),
        &lat,
        &lon,
    );
}
```

---

## Postman Collection

Import this collection into Postman for easy API testing:

```json
{
  "info": {
    "name": "Scavngr Contract API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Register Participant",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"address\": \"GXXXXXXX\",\n  \"role\": 0,\n  \"name\": \"My Recycling\",\n  \"lat\": 40000000,\n  \"lon\": -74000000\n}"
        },
        "url": {
          "raw": "{{CONTRACT_URL}}/register_participant",
          "host": ["{{CONTRACT_URL}}"],
          "path": ["register_participant"]
        }
      }
    }
  ]
}
```

---

## Rate Limiting Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1619827200
```

---

## Support

For issues or questions, visit the [GitHub repository](https://github.com/Xoulomon/Scavenger) or contact the development team.
