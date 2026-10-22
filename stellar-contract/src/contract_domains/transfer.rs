use super::super::*;

/// Check whether a transfer from `from` to `to` is a permitted role transition.
///
/// Valid routes:
/// - `Recycler → Collector`
/// - `Recycler → Manufacturer`
/// - `Collector → Manufacturer`
///
/// # Returns
/// `true` if both participants are registered and the role transition is allowed.
pub(crate) fn is_valid_transfer(env: &Env, from: Address, to: Address) -> bool {
    let from_participant: Option<Participant> = env.storage().instance().get(&(from,));
    let to_participant: Option<Participant> = env.storage().instance().get(&(to,));

    let (Some(from_p), Some(to_p)) = (from_participant, to_participant) else {
        return false;
    };

    if !from_p.is_registered || !to_p.is_registered {
        return false;
    }

    // Invalid if transferring to the same role
    if from_p.role == to_p.role {
        return false;
    }

    matches!(
        (from_p.role, to_p.role),
        (ParticipantRole::Recycler, ParticipantRole::Collector)
            | (ParticipantRole::Recycler, ParticipantRole::Manufacturer)
            | (ParticipantRole::Collector, ParticipantRole::Manufacturer)
    )
}

/// Standalone public function to validate a transfer path for a specific waste item.
/// Checks:
/// 1. Both parties are registered
/// 2. The role transition is permitted
/// 3. The waste exists and is active
/// 4. The waste has not expired
/// 5. The waste is not already owned by the target (circular transfer prevention)
/// 6. The waste is not frozen
pub(crate) fn validate_transfer_path(env: Env, waste_id: u128, from: Address, to: Address) -> Result<(), Error> {
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::require_addresses_different(&from, &to);

    let waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    if waste.current_owner != from {
        return Err(Error::NotWasteOwner);
    }

    if !waste.is_active {
        return Err(Error::WasteDeactivated);
    }

    if waste.is_frozen {
        return Err(Error::WasteFrozen);
    }

    if waste.is_expired(env.ledger().timestamp()) {
        return Err(Error::WasteExpired);
    }

    if waste.current_owner == to {
        return Err(Error::InvalidTransferRoute);
    }

    crate::ScavengerContract::require_registered(&env, &from);
    crate::ScavengerContract::require_registered(&env, &to);

    if !super::transfer::is_valid_transfer(&env, from.clone(), to.clone()) {
        return Err(Error::InvalidTransferRoute);
    }

    Ok(())
}

/// Admin override to transfer waste even when the route would normally be invalid.
/// Only the contract admin may call this.
pub(crate) fn admin_override_transfer(
    env: Env,
    admin: Address,
    waste_id: u128,
    from: Address,
    to: Address,
    latitude: i128,
    longitude: i128,
) -> Result<WasteTransfer, Error> {
    crate::ScavengerContract::only_admin(&env, &admin);
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::require_addresses_different(&from, &to);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    if waste.current_owner != from {
        return Err(Error::NotWasteOwner);
    }

    if waste.is_frozen {
        return Err(Error::WasteFrozen);
    }

    waste.transfer_to(to.clone());
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    let timestamp = env.ledger().timestamp();
    let transfer = WasteTransfer::new(
        waste_id,
        from.clone(),
        to.clone(),
        timestamp,
        latitude,
        longitude,
        soroban_sdk::symbol_short!("admin_xfr"),
    );

    let mut history: Vec<WasteTransfer> = env
        .storage()
        .instance()
        .get(&("transfer_history", waste_id))
        .unwrap_or(Vec::new(&env));
    history.push_back(transfer.clone());
    env.storage().instance().set(&("transfer_history", waste_id), &history);

    events::emit_admin_override_transfer(&env, waste_id, &admin, &from, &to);

    Ok(transfer)
}

/// Get the full transfer history (path data) for a waste item.
pub(crate) fn get_transfer_path_data(env: Env, waste_id: u128) -> Vec<WasteTransfer> {
    env.storage()
        .instance()
        .get(&("transfer_history", waste_id))
        .unwrap_or(Vec::new(&env))
}

/// Create a new auction for waste material
///
/// # Parameters
/// - `waste_id`: ID of the waste to auction
/// - `start_price`: Starting price in tokens
/// - `duration`: Duration in seconds (1 hour to 7 days)
///
/// # Returns
/// The created auction ID
///
/// # Errors
/// - Panics if waste not found or not owned by caller
/// - Panics if duration invalid
pub(crate) fn create_auction(env: Env, creator: Address, waste_id: u128, start_price: u128, duration: u64) -> u64 {
    creator.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    // Validate duration
    if duration < MIN_AUCTION_DURATION || duration > MAX_AUCTION_DURATION {
        panic!("Invalid auction duration");
    }

    // Get v2 waste and check ownership
    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");
    if waste.current_owner != creator {
        panic!("Not waste owner");
    }

    // Transfer waste to contract for auction
    waste.current_owner = env.current_contract_address();
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    // Get next auction ID
    let auction_id = env.storage().instance().get(&AUCTION_COUNT).unwrap_or(0u64) + 1;
    env.storage().instance().set(&AUCTION_COUNT, &auction_id);

    // Create auction
    let auction = Auction::new(&env, auction_id, waste_id, creator.clone(), start_price, duration);
    let key = ("auction", auction_id);
    env.storage().instance().set(&key, &auction);

    // Emit event
    events::emit_auction_created(&env, auction_id, waste_id, &creator, start_price, auction.end_time);

    auction_id
}

/// Place a bid on an active auction
///
/// # Parameters
/// - `auction_id`: ID of the auction
/// - `amount`: Bid amount in tokens
///
/// # Errors
/// - Panics if auction not found or ended
/// - Panics if bid too low
pub(crate) fn place_bid(env: Env, bidder: Address, auction_id: u64, amount: u128) {
    bidder.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    let key = ("auction", auction_id);
    let mut auction: Auction = env.storage().instance().get(&key).expect("Auction not found");

    if !auction.is_active || auction.is_ended(env.ledger().timestamp()) {
        panic!("Auction not active");
    }

    if !auction.is_valid_bid(amount) {
        panic!("Bid too low");
    }

    auction.place_bid(bidder.clone(), amount);
    env.storage().instance().set(&key, &auction);

    // Emit event
    events::emit_bid_placed(&env, auction_id, &bidder, amount);
}

/// End an auction and transfer waste to winner
///
/// # Parameters
/// - `auction_id`: ID of the auction
///
/// # Errors
/// - Panics if auction not found or not ended
pub(crate) fn end_auction(env: Env, auction_id: u64) {
    crate::ScavengerContract::require_not_paused(&env);

    let key = ("auction", auction_id);
    let mut auction: Auction = env.storage().instance().get(&key).expect("Auction not found");

    if !auction.is_active || !auction.is_ended(env.ledger().timestamp()) {
        panic!("Auction not ended");
    }

    auction.end();
    env.storage().instance().set(&key, &auction);

    // Transfer waste to winner
    if let Some(winner) = &auction.bidder {
        let mut waste: types::Waste = env
            .storage()
            .instance()
            .get(&("waste_v2", auction.waste_id))
            .expect("Waste not found");
        waste.current_owner = winner.clone();
        env.storage().instance().set(&("waste_v2", auction.waste_id), &waste);
    }

    // Emit event
    events::emit_auction_ended(&env, auction_id, auction.bidder.as_ref(), auction.current_bid);
}

/// Cancel an auction (owner only)
///
/// # Parameters
/// - `auction_id`: ID of the auction
///
/// # Errors
/// - Panics if not owner or auction has bids
pub(crate) fn cancel_auction(env: Env, caller: Address, auction_id: u64) {
    caller.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    let key = ("auction", auction_id);
    let auction: Auction = env.storage().instance().get(&key).expect("Auction not found");

    if auction.creator != caller {
        panic!("Not auction creator");
    }

    if auction.bidder.is_some() {
        panic!("Cannot cancel auction with bids");
    }

    // Remove auction
    env.storage().instance().remove(&key);
}

/// Get the full transfer history for a waste item (v1 storage).
///
/// Checks v2 storage first (`transfer_history` key with `u128` waste ID),
/// then falls back to v1 (`transfers` key with `u64` waste ID).
///
/// # Returns
/// Chronologically ordered `Vec<WasteTransfer>`. Empty if no transfers recorded.
pub(crate) fn get_transfer_history(env: Env, waste_id: u64) -> Vec<WasteTransfer> {
    // Check v2 storage first (uses u128 waste_id)
    let v2_key = ("transfer_history", waste_id as u128);
    if let Some(history) = env.storage().instance().get::<_, Vec<WasteTransfer>>(&v2_key) {
        return history;
    }

    // Fall back to v1 storage
    let key = ("transfers", waste_id);
    env.storage().instance().get(&key).unwrap_or(Vec::new(&env))
}

/// Alias for [`get_transfer_history`] — returns the full transfer log for a waste item.
pub(crate) fn get_waste_transfer_history(env: Env, waste_id: u64) -> Vec<WasteTransfer> {
    super::transfer::get_transfer_history(env, waste_id)
}

/// Get the transfer history for a v2 waste item (uses `u128` waste ID).
///
/// # Returns
/// Chronologically ordered `Vec<WasteTransfer>`. Empty if no transfers recorded.
pub(crate) fn get_waste_transfer_history_v2(env: Env, waste_id: u128) -> Vec<WasteTransfer> {
    let key = ("transfer_history", waste_id);
    env.storage().instance().get(&key).unwrap_or(Vec::new(&env))
}

/// Transfer waste ownership from one participants to another
/// Transfer waste ownership (v1 — u64 waste IDs, String note).
///
/// # Deprecated
/// Use [`transfer_waste_v2`] instead. v2 uses u128 waste IDs, records
/// GPS coordinates, validates transfer routes, and maintains the
/// `participant_wastes` index. This function is kept for backward
/// compatibility and will be removed in a future release.
///
/// Migration: replace `transfer_waste(id, from, to, note)` with
/// `transfer_waste_v2(id as u128, from, to, latitude, longitude)`.
pub(crate) fn transfer_waste(env: Env, waste_id: u64, from: Address, to: Address, note: String) -> Material {
    from.require_auth();

    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::require_registered(&env, &from);
    crate::ScavengerContract::require_registered(&env, &to);

    let mut material: Material = crate::ScavengerContract::get_waste_internal(&env, waste_id).expect("Waste not found");

    if material.submitter != from {
        panic!("Only waste owner can transfer");
    }

    crate::ScavengerContract::require_addresses_different(&from, &to);

    // Align with v2: reject transfers on deactivated waste
    // Note: Material doesn't have is_active, assuming active for deprecated function
    // if !material.is_active {
    //     panic!("Cannot transfer deactivated waste");
    // }

    // Align with v2: enforce valid transfer routes
    if !super::transfer::is_valid_transfer(&env, from.clone(), to.clone()) {
        panic!("Invalid transfer: role combination not allowed");
    }

    material.submitter = to.clone();
    crate::ScavengerContract::set_waste(&env, waste_id, &material);

    events::emit_waste_transferred(&env, waste_id, &from, &to);
    crate::ScavengerContract::record_transfer(&env, waste_id, from, to, note);

    material
}

/// Get all outbound transfers for a participant.
///
/// > **Note:** Currently returns an empty list. A sender index is required
/// > for efficient lookup and is not yet implemented.
pub(crate) fn get_transfers_from(env: Env, _address: Address) -> Vec<(u64, Vec<WasteTransfer>)> {
    // Note: This is a simplified implementation
    // In production, you'd want to maintain an index for efficient queries
    // This would need to iterate through all wastes
    // For now, returning empty as this requires additional indexing
    Vec::new(&env)
}

/// Get all inbound transfers for a participant.
///
/// > **Note:** Currently returns an empty list. A receiver index is required
/// > for efficient lookup and is not yet implemented.
pub(crate) fn get_transfers_to(env: Env, _address: Address) -> Vec<(u64, Vec<WasteTransfer>)> {
    // Note: This is a simplified implementation
    // In production, you'd want to maintain an index for efficient queries
    // This would need to iterate through all wastes
    // For now, returning empty as this requires additional indexing
    Vec::new(&env)
}

/// Transfer a v2 waste item between participants with location tracking.
///
/// Validates the role-based transfer route, updates ownership, adjusts both
/// participants' waste lists, appends to transfer history, and emits a
/// `transfer` event.
///
/// # Parameters
/// - `waste_id`: ID of the v2 waste to transfer.
/// - `from`: Current owner. Must sign and own the waste.
/// - `to`: New owner. Must be registered.
/// - `latitude`: Transfer location latitude in microdegrees.
/// - `longitude`: Transfer location longitude in microdegrees.
///
/// # Returns
/// The [`WasteTransfer`] record that was appended to history.
///
/// # Errors
/// - [`Error::WasteNotFound`] if no waste record exists for `waste_id`.
/// - [`Error::WasteDeactivated`] if the waste item is deactivated.
/// - [`Error::InvalidTransferRoute`] if the role transition is not permitted.
/// - Panics `"Caller is not the owner of this waste item"`.
pub(crate) fn transfer_waste_v2(
    env: Env,
    waste_id: u128,
    from: Address,
    to: Address,
    latitude: i128,
    longitude: i128,
) -> Result<WasteTransfer, Error> {
    storage_utils::bump_instance(&env);
    from.require_auth();
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::require_addresses_different(&from, &to);

    // Fetch waste first so we can return a typed error if not found
    let mut waste: types::Waste = match env.storage().instance().get(&("waste_v2", waste_id)) {
        Some(w) => w,
        None => return Err(Error::WasteNotFound),
    };

    // Verify caller owns the waste
    if waste.current_owner != from {
        panic!("Caller is not the owner of this waste item");
    }

    crate::ScavengerContract::require_registered(&env, &from);
    crate::ScavengerContract::require_registered(&env, &to);

    if !waste.is_active {
        return Err(Error::WasteDeactivated);
    }

    if waste.is_frozen {
        return Err(Error::WasteFrozen);
    }

    if waste.is_expired(env.ledger().timestamp()) {
        return Err(Error::WasteExpired);
    }

    // Route check after registration checks, before any storage mutation
    if !super::transfer::is_valid_transfer(&env, from.clone(), to.clone()) {
        return Err(Error::InvalidTransferRoute);
    }

    // Reservation check: block transfer if waste is reserved by someone other than `to`
    let now = env.ledger().timestamp();
    if let (Some(reserver), Some(until)) = (waste.reserved_by.clone(), waste.reserved_until) {
        if until > now && reserver != to {
            return Err(Error::WasteReservedByOther);
        }
    }

    waste.transfer_to(to.clone());
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    let from_list: Vec<u128> = env
        .storage()
        .instance()
        .get(&("participant_wastes", from.clone()))
        .unwrap_or(Vec::new(&env));
    let mut new_from_list = Vec::new(&env);
    for id in from_list.iter() {
        if id != waste_id {
            new_from_list.push_back(id);
        }
    }
    env.storage()
        .instance()
        .set(&("participant_wastes", from.clone()), &new_from_list);

    let mut to_list: Vec<u128> = env
        .storage()
        .instance()
        .get(&("participant_wastes", to.clone()))
        .unwrap_or(Vec::new(&env));
    to_list.push_back(waste_id);
    env.storage()
        .instance()
        .set(&("participant_wastes", to.clone()), &to_list);

    let timestamp = env.ledger().timestamp();
    let transfer = WasteTransfer::new(
        waste_id,
        from.clone(),
        to.clone(),
        timestamp,
        latitude,
        longitude,
        soroban_sdk::symbol_short!("transfer"),
    );

    let mut history: Vec<WasteTransfer> = env
        .storage()
        .instance()
        .get(&("transfer_history", waste_id))
        .unwrap_or(Vec::new(&env));
    history.push_back(transfer.clone());
    env.storage().instance().set(&("transfer_history", waste_id), &history);

    events::emit_waste_transferred_v2(&env, waste_id, &from, &to, timestamp);
    env.events().publish(
        (soroban_sdk::symbol_short!("transfer"), waste_id),
        (from.clone(), to.clone(), timestamp),
    );

    // Reputation: reward both parties for a successful transfer
    crate::ScavengerContract::apply_reputation(&env, &from, REP_TRANSFER);
    crate::ScavengerContract::apply_reputation(&env, &to, REP_TRANSFER);

    Ok(transfer)
}

/// Batch transfer multiple waste items to a single recipient
/// All waste IDs are validated before any transfer is executed (atomic validation)
/// Emits individual transfer events for each waste item
pub(crate) fn batch_transfer_waste(
    env: Env,
    waste_ids: Vec<u128>,
    to: Address,
    latitude: i128,
    longitude: i128,
) -> Result<Vec<WasteTransfer>, Error> {
    // Validate recipient is registered
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::require_registered(&env, &to);

    // Handle empty batch
    if waste_ids.is_empty() {
        return Ok(Vec::new(&env));
    }

    // Phase 1: Validate all waste IDs before executing any transfer
    let mut wastes_to_transfer: soroban_sdk::Vec<(u128, types::Waste, Address)> = soroban_sdk::Vec::new(&env);

    for waste_id in waste_ids.iter() {
        let waste: types::Waste = env
            .storage()
            .instance()
            .get(&("waste_v2", waste_id))
            .ok_or(Error::WasteNotFound)?;

        // Verify waste is active
        if !waste.is_active {
            return Err(Error::WasteDeactivated);
        }

        if waste.is_expired(env.ledger().timestamp()) {
            return Err(Error::WasteExpired);
        }
        let from = waste.current_owner.clone();

        crate::ScavengerContract::require_addresses_different(&from, &to);
        // Verify caller owns the waste
        crate::ScavengerContract::only_waste_owner(&env, &from, waste_id);
        crate::ScavengerContract::require_registered(&env, &from);

        // Validate transfer route
        if !super::transfer::is_valid_transfer(&env, from.clone(), to.clone()) {
            return Err(Error::InvalidTransferRoute);
        }

        wastes_to_transfer.push_back((waste_id, waste, from));
    }

    // Phase 2: Execute all transfers (all validations passed)
    let mut transfers: Vec<WasteTransfer> = Vec::new(&env);
    let timestamp = env.ledger().timestamp();

    for item in wastes_to_transfer.iter() {
        let (waste_id, mut waste, from) = item;

        // Update waste ownership
        waste.transfer_to(to.clone());
        env.storage().instance().set(&("waste_v2", waste_id), &waste);

        // Update from participant's waste list
        let from_list: Vec<u128> = env
            .storage()
            .instance()
            .get(&("participant_wastes", from.clone()))
            .unwrap_or(Vec::new(&env));
        let mut new_from_list = Vec::new(&env);
        for id in from_list.iter() {
            if id != waste_id {
                new_from_list.push_back(id);
            }
        }
        env.storage()
            .instance()
            .set(&("participant_wastes", from.clone()), &new_from_list);

        // Update to participant's waste list
        let mut to_list: Vec<u128> = env
            .storage()
            .instance()
            .get(&("participant_wastes", to.clone()))
            .unwrap_or(Vec::new(&env));
        to_list.push_back(waste_id);
        env.storage()
            .instance()
            .set(&("participant_wastes", to.clone()), &to_list);

        // Create transfer record
        let transfer = WasteTransfer::new(
            waste_id,
            from.clone(),
            to.clone(),
            timestamp,
            latitude,
            longitude,
            soroban_sdk::symbol_short!("transfer"),
        );

        // Update transfer history
        let mut history: Vec<WasteTransfer> = env
            .storage()
            .instance()
            .get(&("transfer_history", waste_id))
            .unwrap_or(Vec::new(&env));
        history.push_back(transfer.clone());
        env.storage().instance().set(&("transfer_history", waste_id), &history);

        // Emit individual transfer event
        events::emit_waste_transferred_v2(&env, waste_id, &from, &to, timestamp);

        transfers.push_back(transfer);
    }

    Ok(transfers)
}

/// Transfer aggregated waste from collector to manufacturer
/// Transfer aggregated waste from a collector directly to a manufacturer.
///
/// Creates a new v2 waste record owned by `manufacturer`, records the
/// transfer, and emits a `bulk_xfr` event. Useful for bulk handoffs where
/// individual waste IDs are not tracked.
///
/// # Parameters
/// - `waste_type`: Type of the aggregated waste.
/// - `collector`: Registered `Collector`. Must sign.
/// - `manufacturer`: Registered `Manufacturer` receiving the waste.
/// - `latitude` / `longitude`: Handoff location in microdegrees.
/// - `notes`: Short symbol note attached to the transfer record.
///
/// # Returns
/// The new waste ID (`u128`).
///
/// # Errors
/// - Panics `"Only collectors can use this"`.
/// - Panics `"Recipient must be manufacturer"`.
pub(crate) fn transfer_collected_waste(
    env: Env,
    waste_type: WasteType,
    collector: Address,
    manufacturer: Address,
    latitude: i128,
    longitude: i128,
    notes: soroban_sdk::Symbol,
) -> u128 {
    collector.require_auth();
    crate::ScavengerContract::require_addresses_different(&collector, &manufacturer);
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::require_registered(&env, &collector);
    crate::ScavengerContract::require_registered(&env, &manufacturer);

    let collector_key = (collector.clone(),);
    let collector_participant: Participant = env
        .storage()
        .instance()
        .get(&collector_key)
        .expect("Collector not registered");

    if collector_participant.role != ParticipantRole::Collector {
        panic!("Only collectors can use this");
    }

    let manufacturer_key = (manufacturer.clone(),);
    let manufacturer_participant: Participant = env
        .storage()
        .instance()
        .get(&manufacturer_key)
        .expect("Manufacturer not registered");

    if manufacturer_participant.role != ParticipantRole::Manufacturer {
        panic!("Recipient must be manufacturer");
    }

    let waste_id = crate::ScavengerContract::next_waste_id(&env) as u128;
    let timestamp = env.ledger().timestamp();

    let waste = types::Waste::new(
        &env,
        waste_id,
        waste_type,
        0,
        manufacturer.clone(),
        latitude,
        longitude,
        timestamp,
        true,
        false,
        manufacturer.clone(),
        0,
    );

    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    let mut manufacturer_list: Vec<u128> = env
        .storage()
        .instance()
        .get(&("participant_wastes", manufacturer.clone()))
        .unwrap_or(Vec::new(&env));
    manufacturer_list.push_back(waste_id);
    env.storage()
        .instance()
        .set(&("participant_wastes", manufacturer.clone()), &manufacturer_list);

    let transfer = WasteTransfer::new(
        waste_id,
        collector.clone(),
        manufacturer.clone(),
        timestamp,
        latitude,
        longitude,
        notes,
    );

    let mut history: Vec<WasteTransfer> = env
        .storage()
        .instance()
        .get(&("transfer_history", waste_id))
        .unwrap_or(Vec::new(&env));
    history.push_back(transfer);
    env.storage().instance().set(&("transfer_history", waste_id), &history);

    events::emit_bulk_transfer(&env, waste_id, &collector, &manufacturer, waste_type, timestamp);

    waste_id
}

/// Initiate a transfer that requires recipient approval.
pub(crate) fn initiate_transfer(
    env: Env,
    waste_id: u128,
    from: Address,
    to: Address,
    latitude: i128,
    longitude: i128,
) -> PendingTransfer {
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_registered(&env, &from);
    crate::ScavengerContract::require_registered(&env, &to);
    crate::ScavengerContract::require_addresses_different(&from, &to);

    let waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    if waste.current_owner != from {
        panic!("Caller is not the owner of this waste item");
    }
    if !waste.is_active {
        panic!("Waste is deactivated");
    }

    let id: u64 = env.storage().instance().get(&PENDING_XFR_CNT).unwrap_or(0u64) + 1;
    env.storage().instance().set(&PENDING_XFR_CNT, &id);

    let now = env.ledger().timestamp();
    let pending = PendingTransfer {
        id,
        waste_id,
        from: from.clone(),
        to: to.clone(),
        initiated_at: now,
        expires_at: now + TRANSFER_EXPIRY_SECS,
        status: PendingTransferStatus::Pending,
        latitude,
        longitude,
    };

    env.storage().instance().set(&("pending_xfr", id), &pending);

    env.events()
        .publish((symbol_short!("xfr_init"), id), (waste_id, from, to));

    pending
}

/// Approve a pending transfer (recipient only).
pub(crate) fn approve_transfer(env: Env, transfer_id: u64, recipient: Address) -> PendingTransfer {
    crate::ScavengerContract::require_not_paused(&env);
    recipient.require_auth();

    let mut pending: PendingTransfer = env
        .storage()
        .instance()
        .get(&("pending_xfr", transfer_id))
        .expect("Pending transfer not found");

    if pending.to != recipient {
        panic!("Only the recipient can approve");
    }
    if pending.status != PendingTransferStatus::Pending {
        panic!("Transfer is not pending");
    }

    let now = env.ledger().timestamp();
    if now >= pending.expires_at {
        pending.status = PendingTransferStatus::Expired;
        env.storage().instance().set(&("pending_xfr", transfer_id), &pending);
        panic!("Transfer has expired");
    }

    // Execute the actual waste transfer
    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", pending.waste_id))
        .expect("Waste not found");

    if !waste.is_active {
        panic!("Waste is deactivated");
    }

    // Update waste lists
    let from_list: Vec<u128> = env
        .storage()
        .instance()
        .get(&("participant_wastes", pending.from.clone()))
        .unwrap_or(Vec::new(&env));
    let mut new_from_list = Vec::new(&env);
    for id in from_list.iter() {
        if id != pending.waste_id {
            new_from_list.push_back(id);
        }
    }
    env.storage()
        .instance()
        .set(&("participant_wastes", pending.from.clone()), &new_from_list);

    let mut to_list: Vec<u128> = env
        .storage()
        .instance()
        .get(&("participant_wastes", pending.to.clone()))
        .unwrap_or(Vec::new(&env));
    to_list.push_back(pending.waste_id);
    env.storage()
        .instance()
        .set(&("participant_wastes", pending.to.clone()), &to_list);

    waste.transfer_to(pending.to.clone());
    env.storage().instance().set(&("waste_v2", pending.waste_id), &waste);

    // Record transfer history
    let transfer_record = WasteTransfer::new(
        pending.waste_id,
        pending.from.clone(),
        pending.to.clone(),
        now,
        pending.latitude,
        pending.longitude,
        symbol_short!("approved"),
    );
    let mut history: Vec<WasteTransfer> = env
        .storage()
        .instance()
        .get(&("transfer_history", pending.waste_id))
        .unwrap_or(Vec::new(&env));
    history.push_back(transfer_record);
    env.storage()
        .instance()
        .set(&("transfer_history", pending.waste_id), &history);

    pending.status = PendingTransferStatus::Approved;
    env.storage().instance().set(&("pending_xfr", transfer_id), &pending);

    env.events().publish(
        (symbol_short!("xfr_appr"), transfer_id),
        (pending.waste_id, pending.from.clone(), pending.to.clone()),
    );

    pending
}

/// Reject a pending transfer (recipient only).
pub(crate) fn reject_transfer(env: Env, transfer_id: u64, recipient: Address) -> PendingTransfer {
    crate::ScavengerContract::require_not_paused(&env);
    recipient.require_auth();

    let mut pending: PendingTransfer = env
        .storage()
        .instance()
        .get(&("pending_xfr", transfer_id))
        .expect("Pending transfer not found");

    if pending.to != recipient {
        panic!("Only the recipient can reject");
    }
    if pending.status != PendingTransferStatus::Pending {
        panic!("Transfer is not pending");
    }

    let now = env.ledger().timestamp();
    if now >= pending.expires_at {
        pending.status = PendingTransferStatus::Expired;
    } else {
        pending.status = PendingTransferStatus::Rejected;
    }

    env.storage().instance().set(&("pending_xfr", transfer_id), &pending);

    env.events().publish(
        (symbol_short!("xfr_rej"), transfer_id),
        (pending.waste_id, pending.from.clone(), pending.to.clone()),
    );

    pending
}

/// Get a pending transfer by ID.
pub(crate) fn get_pending_transfer(env: Env, transfer_id: u64) -> Option<PendingTransfer> {
    env.storage().instance().get(&("pending_xfr", transfer_id))
}

/// Expire a pending transfer if past its deadline (callable by anyone).
pub(crate) fn expire_transfer(env: Env, transfer_id: u64) -> PendingTransfer {
    let mut pending: PendingTransfer = env
        .storage()
        .instance()
        .get(&("pending_xfr", transfer_id))
        .expect("Pending transfer not found");

    if pending.status != PendingTransferStatus::Pending {
        panic!("Transfer is not pending");
    }

    let now = env.ledger().timestamp();
    if now < pending.expires_at {
        panic!("Transfer has not expired yet");
    }

    pending.status = PendingTransferStatus::Expired;
    env.storage().instance().set(&("pending_xfr", transfer_id), &pending);

    env.events()
        .publish((symbol_short!("xfr_exp"), transfer_id), pending.waste_id);

    pending
}
