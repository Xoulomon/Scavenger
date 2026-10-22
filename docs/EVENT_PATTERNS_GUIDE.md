# Event Patterns Guide

**Schema Version:** 1  
**Last Updated:** 2026-10-21  
**Related Issues:** #1516 (standardization), #814 (event utilities), ADR-0002 (off-chain indexing)

## Overview

This document defines the canonical schema for all events emitted by the Scavenger Stellar contract. Off-chain indexers and consumers **must not** rely on positional data fields beyond what is documented here.

When payload shapes change, the `EVENT_SCHEMA_VERSION` constant (in `event_builder.rs`) is incremented, and a schema migration event should be emitted during contract upgrade.

---

## Event Catalog

All events follow the pattern: `env.events().publish((TOPIC_SYMBOL, indexed_key), payload)`

### Waste Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_waste_registered` | `recycled` | `(recycled, waste_id)` | waste_id: u128 | `(waste_type: WasteType, weight: u128, recycler: Address, latitude: i128, longitude: i128)` | v1 | Emitted when waste item is registered (v2 API) |
| `emit_waste_transferred` | `transfer` | `(transfer, waste_id)` | waste_id: u64 | `(from: Address, to: Address)` | v1 | V1 waste transfer (u64 ID) |
| `emit_waste_transferred_v2` | `transfer` | `(transfer, waste_id)` | waste_id: u128 | `(from: Address, to: Address, timestamp: u64)` | v1 | V2 waste transfer (u128 ID with timestamp) |
| `emit_waste_confirmed` | `confirmed` | `(confirmed, waste_id)` | waste_id: u128 | `confirmer: Address` | v1 | Waste receipt confirmed by third party |
| `emit_waste_confirmation_reset` | `reset` | `(reset, waste_id)` | waste_id: u128 | `(owner: Address, timestamp: u64)` | v1 | Confirmation reset by owner |
| `emit_waste_deactivated` | `deactive` | `(deactive, waste_id)` | waste_id: u128 | `(admin: Address, timestamp: u64)` | v1 | Waste item permanently deactivated |
| `emit_waste_expired` | `expired` | `(expired, waste_id)` | waste_id: u128 | `timestamp: u64` | v1 | Waste item expired and cleaned up |
| `emit_waste_graded` | `graded` | `(graded, waste_id)` | waste_id: u128 | `(grade: u32, grader: Address)` | v1 | Waste item graded (WasteGrade as u32) |
| `emit_waste_split` | `split` | `(split, waste_id)` | waste_id: u128 | `(owner: Address, child_count: u64)` | v1 | Waste item split into children |
| `emit_wastes_merged` | `merged` | `(merged, merged_id)` | merged_id: u128 | `(owner: Address, source_count: u64)` | v1 | Multiple waste items merged |
| `emit_waste_reserved` | `reserved` | `(reserved, waste_id)` | waste_id: u128 | `(reserver: Address, until: u64)` | v1 | Waste item reserved until timestamp |
| `emit_reservation_cancelled` | `res_canc` | `(res_canc, waste_id)` | waste_id: u128 | `caller: Address` | v1 | Waste reservation cancelled |
| `emit_waste_contaminated` | `contam` | `(contam, waste_id)` | waste_id: u128 | `(verifier: Address, level: u32)` | v1 | Waste marked contaminated |
| `emit_processing_status_changed` | `proc_upd` | `(proc_upd, waste_id)` | waste_id: u128 | `(caller: Address, status: u32, timestamp: u64)` | v1 | Waste processing status changed |
| `emit_bulk_transfer` | `bulk_xfr` | `(bulk_xfr, waste_id)` | waste_id: u128 | `(collector: Address, manufacturer: Address, waste_type: WasteType, timestamp: u64)` | v1 | Collector hands aggregated waste to manufacturer |
| `emit_admin_override_transfer` | `adm_xfr` | `(adm_xfr, waste_id)` | waste_id: u128 | `(admin: Address, from: Address, to: Address)` | v1 | Admin override transfer |
| `emit_composition_set` | `comp_set` | `(comp_set, waste_id)` | waste_id: u128 | `(verifier: Address, entry_count: u32)` | v1 | Waste composition set |
| `emit_waste_reconciled` | `reconcil` | `(reconcil, waste_id)` | waste_id: u128 | `(original_weight: u128, adjusted_weight: u128, reconciled_by: Address)` | v1 | Waste weight reconciled (#706) |

### Participant Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_participant_registered` | `reg` | `(reg, address)` | address: Address | `(role: u32, name: Symbol, latitude: i128, longitude: i128)` | v1 | Participant registration |
| `emit_participant_location_updated` | `loc_upd` | `(loc_upd, address)` | address: Address | `(latitude: i128, longitude: i128)` | v1 | Participant location updated |
| `emit_certification_granted` | `cert_gr` | `(cert_gr, participant)` | participant: Address | `level: u32` | v1 | Certification level granted (CertificationLevel as u32) |
| `emit_participant_tier_changed` | `tier_upd` | `(tier_upd, participant)` | participant: Address | `(old_tier: u32, new_tier: u32)` | v1 | Participant tier changed (ParticipantTier as u32) |
| `emit_goal_achieved` | `goal_ach` | `(goal_ach, participant)` | participant: Address | `target_weight: u128` | v1 | Participant achieved recycling goal |

### Token & Reward Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_tokens_rewarded` | `rewarded` | `(rewarded, recipient)` | recipient: Address | `(amount: u128, waste_id: u64)` | v1 | Tokens rewarded to participant |
| `emit_donation_made` | `donated` | `(donated, donor)` | donor: Address | `(amount: i128, charity_contract: Address)` | v1 | Donation made to charity |

### Admin Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_admin_transferred` | `adm_xfr` | `(adm_xfr,)` | (none) | `previous_admin: Address` | v1 | Admin rights transferred |
| `emit_contract_paused` | `paused` | `(paused,)` | (none) | `admin: Address` | v1 | Contract paused |
| `emit_contract_unpaused` | `unpaused` | `(unpaused,)` | (none) | `admin: Address` | v1 | Contract unpaused |
| `emit_proposal_created` | `prop_new` | `(prop_new, proposal_id)` | proposal_id: u64 | `proposer: Address` | v1 | Multi-sig proposal created |
| `emit_proposal_approved` | `prop_apr` | `(prop_apr, proposal_id)` | proposal_id: u64 | `approver: Address` | v1 | Multi-sig proposal approved |
| `emit_proposal_executed` | `prop_exe` | `(prop_exe, proposal_id)` | proposal_id: u64 | `executor: Address` | v1 | Multi-sig proposal executed |

### Incentive Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_incentive_updated` | `inc_upd` | `(inc_upd, incentive_id)` | incentive_id: u64 | `(rewarder: Address, new_reward_points: u64, new_total_budget: u64)` | v1 | Incentive reward/budget updated |
| `emit_incentive_scheduled` | `inc_sched` | `(inc_sched, incentive_id)` | incentive_id: u64 | `(rewarder: Address, starts_at: Option<u64>, ends_at: Option<u64>)` | v1 | Incentive schedule updated |

### Seasonal Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_seasonal_multiplier_set` | `seas_set` | `(seas_set,)` | (none) | `(multiplier: u32, start: u64, end: u64)` | v1 | Seasonal reward multiplier updated |

### Carbon Credit Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_carbon_credits_earned` | `carbon` | `(carbon, participant)` | participant: Address | `(waste_type: WasteType, weight: u128, credits: u128)` | v1 | Carbon credits earned through verification |
| `emit_carbon_credits_redeemed` | `carb_rdm` | `(carb_rdm, participant)` | participant: Address | `(amount: u128, remaining: u128)` | v1 | Carbon credits redeemed |
| `emit_carbon_listing_created` | `carb_lst` | `(carb_lst, listing_id)` | listing_id: u64 | `(seller: Address, amount: u128, price_per_credit: i128)` | v1 | Carbon credit listing created |
| `emit_carbon_listing_cancelled` | `carb_cnc` | `(carb_cnc, listing_id)` | listing_id: u64 | `seller: Address` | v1 | Carbon credit listing cancelled |
| `emit_carbon_listing_purchased` | `carb_buy` | `(carb_buy, listing_id)` | listing_id: u64 | `(seller: Address, buyer: Address, amount: u128, total_price: i128)` | v1 | Carbon credit listing purchased |

### Auction Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_auction_created` | `auc_cre` | `(auc_cre, auction_id)` | auction_id: u64 | `(waste_id: u128, creator: Address, start_price: u128, end_time: u64)` | v1 | Auction created |
| `emit_bid_placed` | `bid_plc` | `(bid_plc, auction_id)` | auction_id: u64 | `(bidder: Address, amount: u128)` | v1 | Bid placed in auction |
| `emit_auction_ended` | `auc_end` | `(auc_end, auction_id)` | auction_id: u64 | `(winner: Option<Address>, final_price: u128)` | v1 | Auction ended |

### Bulk Import Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_bulk_import_completed` | `bulk_imp` | `(bulk_imp,)` | (none) | `(item_type: &str, count: u32)` | v1 | Bulk import operation completed |

### RBAC Events (#704)

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_permission_granted` | `perm_gr` | `(perm_gr, subject)` | subject: Address | `(permission: u32, granted_by: Address)` | v1 | Permission granted to subject |
| `emit_permission_revoked` | `perm_rv` | `(perm_rv, subject)` | subject: Address | `(permission: u32, revoked_by: Address)` | v1 | Permission revoked from subject |

### Batch Processing Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `emit_batch_processed` | `batch_pr` | `(batch_pr, batch_id)` | batch_id: u64 | `(processor: Address, note: String)` | v1 | Waste batch processed |

### Audit Logging Events

| Function | Topic Symbol | Topic Tuple | Indexed Key | Payload | Since | Notes |
|----------|--------------|-------------|-------------|---------|-------|-------|
| `AuditLogService::log_action` (via audit_log.rs) | `AUDIT` | `(AUDIT, log)` | log (symbol) | `AuditLog { id, action, actor, target, timestamp, details }` | v1 | Audit log entry (gas-efficient, event-based) |

---

## Summary Statistics

- **Total Emission Functions:** 46
- **Unique Topic Symbols:** 39
- **Events with Indexed Key (topic[1]):** 42
- **Events without Indexed Key (1-tuple only):** 4 (admin_transferred, contract_paused, contract_unpaused, seasonal_multiplier_set, bulk_import_completed)
- **Schema Version:** 1

---

## Payload Type Reference

### Enums (as u32)

- **WasteGrade:** Serialized as u32 in `emit_waste_graded`
- **CertificationLevel:** Serialized as u32 in `emit_certification_granted`
- **ParticipantTier:** Serialized as u32 in `emit_participant_tier_changed`
- **ParticipantRole:** Serialized as u32 in `emit_participant_registered`
- **WasteType:** Serialized as WasteType (complex type) in multiple events

### Address Tracking

Most events include an `Address` field to track the actor or participant:
- **Indexed key:** Often the address of the primary entity (participant, waste owner)
- **Payload:** May include secondary addresses (from/to in transfers, granted_by/revoked_by in RBAC)

### Timestamps

Events include `u64` timestamps:
- `emit_waste_deactivated`: includes `env.ledger().timestamp()`
- `emit_waste_expired`: timestamp in payload
- `emit_processing_status_changed`: timestamp in payload
- `emit_waste_confirmation_reset`: timestamp in payload
- Audit logs: `timestamp: u64` in AuditLog struct

---

## Migration Notes

### v1 to v2 Waste Transfer

- **v1:** `emit_waste_transferred(waste_id: u64, from, to)` → payload `(from, to)`
- **v2:** `emit_waste_transferred_v2(waste_id: u128, from, to, timestamp)` → payload `(from, to, timestamp)`

Both functions emit to the same topic symbol `transfer`, but with different indexed key types (u64 vs u128) and payload shapes. Indexers should handle both via schema versioning logic.

---

## Testing & Validation

All events are validated in:
- `stellar-contract/tests/common/event_helpers.rs` — assertion helpers (all_events, last_event, assert_last_event_topics)
- `stellar-contract/src/event_builder.rs` — schema table and EventFormatter labels
- Unit tests in event_builder.rs verify symbol classification and filtering

---

## Consumer Contract Requirements

Off-chain indexers and consumers **must:**

1. Validate event topics and payload shapes against this schema
2. Handle both v1 and v2 waste transfer events (same topic, different payloads)
3. Detect schema version bumps (read `EVENT_SCHEMA_VERSION` from contract exports or listen for schema migration events)
4. Never assume positional data beyond what is documented here
5. Rebuild indexed data if schema version changes (post-upgrade)

Off-chain consumers **should not:**

1. Parse unknown symbols without defensive coding
2. Assume payload shape without schema validation
3. Skip replay validation when consuming archived raw events
