use super::super::*;

/// Check whether a waste record with the given ID exists.
///
/// # Returns
/// `true` if the record is present in storage.
pub(crate) fn waste_exists(env: Env, waste_id: u64) -> bool {
    let key = ("waste", waste_id);
    env.storage().instance().has(&key)
}

/// Convert a [`WasteType`] variant to its human-readable string label.
///
/// # Returns
/// A Soroban `String` such as `"Plastic"` or `"Metal"`.
pub(crate) fn get_waste_type_string(env: Env, waste_type: WasteType) -> String {
    String::from_str(&env, waste_type.as_str())
}

/// Convert a [`ParticipantRole`] variant to its human-readable string label.
///
/// # Returns
/// A Soroban `String` such as `"Recycler"`, `"Collector"`, or `"Manufacturer"`.
pub(crate) fn get_participant_role_string(env: Env, role: ParticipantRole) -> String {
    String::from_str(&env, role.as_str())
}

/// Get waste by tracking code
///
/// # Parameters
/// - `code`: Tracking code to search for
///
/// # Returns
/// Waste item if found
pub(crate) fn get_waste_by_tracking_code(env: Env, code: soroban_sdk::String) -> Option<types::Waste> {
    // This is inefficient, but for demo purposes
    // In production, would need a map from tracking_code to waste_id
    let participant_index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));

    for addr in participant_index {
        if let Some(waste_list) = env
            .storage()
            .instance()
            .get::<_, Vec<u128>>(&("participant_wastes", addr))
        {
            for waste_id in waste_list {
                if let Some(waste) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", waste_id)) {
                    if waste.tracking_code == code {
                        return Some(waste);
                    }
                }
            }
        }
    }
    None
}

/// Bulk import historical waste data (admin only)
///
/// # Parameters
/// - `wastes`: Vector of waste data to import
///
/// # Errors
/// - Panics if not admin
/// - Panics if batch too large
pub(crate) fn bulk_import_wastes(env: Env, admin: Address, wastes: soroban_sdk::Vec<types::Waste>) {
    crate::ScavengerContract::require_admin(&env, &admin);

    if wastes.len() > 100 {
        panic!("Batch too large");
    }

    // Validate all data
    for waste in wastes.iter() {
        if waste.weight == 0 {
            panic!("Invalid waste data");
        }
        // Add more validations as needed
    }

    // Import
    for waste in wastes.iter() {
        env.storage().instance().set(&("waste_v2", waste.waste_id), &waste);
        // Update participant wastes list if needed
    }

    // Emit event
    events::emit_bulk_import_completed(&env, "waste", wastes.len() as u32);
}

/// Submit a single waste material for recycling (v1 API).
///
/// Creates a [`Material`] record, updates the submitter's recycling stats,
/// and increments the global weight counter.
///
/// # Parameters
/// - `waste_type`: Category of the material (e.g. `Plastic`, `Metal`).
/// - `weight`: Weight in grams (must be at least the minimum weight configured by admin).
/// - `submitter`: Registered participant submitting the material. Must sign.
/// - `description`: Free-text description of the material.
///
/// # Returns
/// The newly created [`Material`] record with a unique `id`.
///
/// # Errors
/// - Panics `"Caller is not a registered participant"` if `submitter` is not registered.
/// - Panics `"Waste weight below minimum allowed"` if weight is less than the minimum weight.
/// - Panics `"Waste weight exceeds maximum allowed"` if weight exceeds MAX_WASTE_WEIGHT.
pub(crate) fn submit_material(
    env: Env,
    waste_type: WasteType,
    weight: u64,
    submitter: Address,
    description: String,
) -> Material {
    // Validate submitter is registered
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_registered(&env, &submitter);

    validation::validate_weight(weight as u128, MAX_WASTE_WEIGHT);
    let min_weight = super::admin::get_min_weight(env.clone());
    if (weight as u128) < min_weight {
        panic!("Waste weight below minimum allowed");
    }
    if weight as u128 > MAX_WASTE_WEIGHT {
        panic!("Waste weight exceeds maximum allowed");
    }

    // Get next waste ID using the new storage system
    let waste_id = crate::ScavengerContract::next_waste_id(&env);

    // Create material
    let material = Material::new(
        waste_id,
        waste_type,
        weight,
        submitter.clone(),
        env.ledger().timestamp(),
        description,
    );

    // Store waste using the new storage systems
    crate::ScavengerContract::set_waste(&env, waste_id, &material);

    // Update stats
    let mut stats: RecyclingStats = env
        .storage()
        .instance()
        .get(&("stats", submitter.clone()))
        .unwrap_or_else(|| RecyclingStats::new(submitter.clone()));

    stats.record_submission(&material);
    env.storage().instance().set(&("stats", submitter.clone()), &stats);

    // Update participant stats
    crate::ScavengerContract::update_participant_stats(&env, &submitter, weight, 0);

    // Update global total weight
    crate::ScavengerContract::add_to_total_weight(&env, weight);

    material
}

/// Register a new waste item with GPS location data (v2 API).
///
/// Stores the waste in the v2 storage layout and appends its ID to the
/// recycler's waste list. Emits a `waste_registered` event.
///
/// # Parameters
/// - `waste_type`: Category of the waste.
/// - `weight`: Weight in grams (must be at least the minimum weight configured by admin).
/// - `recycler`: Registered participant creating the record. Must sign.
/// - `latitude`: Collection latitude in microdegrees.
/// - `longitude`: Collection longitude in microdegrees.
///
/// # Returns
/// The new waste ID (`u128`).
///
/// # Errors
/// - Panics `"Waste weight below minimum allowed"` if weight is less than the minimum weight.
/// - Panics `"Waste weight exceeds maximum allowed"` if weight exceeds MAX_WASTE_WEIGHT.
/// - Panics `"Caller is not a registered participant"`.
pub(crate) fn recycle_waste(
    env: Env,
    waste_type: WasteType,
    weight: u128,
    recycler: Address,
    latitude: i128,
    longitude: i128,
) -> u128 {
    // Validate recycler is registered
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_registered(&env, &recycler);

    validation::validate_weight(weight, MAX_WASTE_WEIGHT);
    let min_weight = super::admin::get_min_weight(env.clone());
    if weight < min_weight {
        panic!("Waste weight below minimum allowed");
    }
    if weight > MAX_WASTE_WEIGHT {
        panic!("Waste weight exceeds maximum allowed");
    }
    let waste_id = crate::ScavengerContract::next_waste_id(&env) as u128;
    let timestamp = env.ledger().timestamp();

    // Look up per-type TTL; 0 means no expiry
    let ttl: u64 = env.storage().instance().get(&("waste_ttl", waste_type)).unwrap_or(0u64);
    let expires_at = if ttl > 0 { timestamp + ttl } else { 0u64 };

    let waste = types::Waste::new(
        &env,
        waste_id,
        waste_type,
        weight,
        recycler.clone(),
        latitude,
        longitude,
        timestamp,
        true,
        false,
        recycler.clone(),
        expires_at,
    );

    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    let mut waste_list: Vec<u128> = env
        .storage()
        .instance()
        .get(&("participant_wastes", recycler.clone()))
        .unwrap_or(Vec::new(&env));
    waste_list.push_back(waste_id);
    env.storage()
        .instance()
        .set(&("participant_wastes", recycler.clone()), &waste_list);

    // Track total weight in stats for recycling rate calculation
    let stats_key = ("stats", recycler.clone());
    let mut stats: RecyclingStats = env
        .storage()
        .instance()
        .get(&stats_key)
        .unwrap_or_else(|| RecyclingStats::new(recycler.clone()));
    stats.total_weight = stats.total_weight.saturating_add(weight as u64);
    stats.update_recycling_rate();
    env.storage().instance().set(&stats_key, &stats);

    // Emit waste registered event
    events::emit_waste_registered(&env, waste_id, &recycler, waste_type, weight, latitude, longitude);

    waste_id
}

/// Retrieve a v2 waste record by its `u128` ID.
///
/// # Returns
/// `Some(Waste)` if found, `None` otherwise.
pub(crate) fn get_waste_v2(env: Env, waste_id: u128) -> Option<types::Waste> {
    env.storage().instance().get(&("waste_v2", waste_id))
}

/// Update the processing status of a v2 waste item.
///
/// Only the current owner may call this. Status must advance forward
/// (Collected → Sorted → Processed → Recycled → Manufactured).
///
/// # Panics
/// - `"Waste not found"` if the waste ID does not exist.
/// - `"Only current owner can update processing status"` if caller is not the owner.
/// - `"Status must progress forward"` if new status is not strictly greater.
pub(crate) fn update_processing_status(
    env: Env,
    waste_id: u128,
    caller: Address,
    new_status: ProcessingStatus,
) -> types::Waste {
    caller.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    assert!(
        waste.current_owner == caller,
        "Only current owner can update processing status"
    );
    assert!(
        new_status.to_u32() > waste.processing_status.to_u32(),
        "Status must progress forward"
    );

    let timestamp = env.ledger().timestamp();
    waste.processing_status = new_status;
    waste.processing_history.push_back(ProcessingRecord {
        status: new_status,
        timestamp,
        updated_by: caller.clone(),
    });

    env.storage().instance().set(&("waste_v2", waste_id), &waste);
    events::emit_processing_status_changed(&env, waste_id, new_status.to_u32(), &caller, timestamp);

    // When waste reaches Recycled status, update stats and goals
    if new_status == ProcessingStatus::Recycled {
        let owner = waste.current_owner.clone();
        let stats_key = ("stats", owner.clone());
        let mut stats: RecyclingStats = env
            .storage()
            .instance()
            .get(&stats_key)
            .unwrap_or_else(|| RecyclingStats::new(owner.clone()));
        stats.recycled_weight = stats.recycled_weight.saturating_add(waste.weight);
        stats.update_recycling_rate();
        env.storage().instance().set(&stats_key, &stats);

        // Update goals progress
        let goals_key = ("goals", owner.clone());
        let mut goals: Vec<types::RecyclingGoal> = env.storage().instance().get(&goals_key).unwrap_or(Vec::new(&env));
        let mut goals_updated = false;
        for i in 0..goals.len() {
            let mut goal = goals.get(i).unwrap();
            if goal.achieved {
                continue;
            }
            let type_matches = goal.waste_type.matches(waste.waste_type);
            if type_matches {
                goal.current_weight = goal.current_weight.saturating_add(waste.weight);
                if goal.current_weight >= goal.target_weight {
                    goal.achieved = true;
                    events::emit_goal_achieved(&env, &owner, goal.target_weight);
                }
                goals.set(i, goal);
                goals_updated = true;
            }
        }
        if goals_updated {
            env.storage().instance().set(&goals_key, &goals);
        }
    }

    waste
}

/// Return all v2 waste IDs whose current processing status matches `status`.
///
/// Scans the global waste ID counter and checks each stored waste item.
pub(crate) fn get_wastes_by_status(env: Env, status: ProcessingStatus) -> Vec<u128> {
    let count: u64 = env.storage().instance().get(&("waste_count",)).unwrap_or(0);
    let mut result = Vec::new(&env);
    for id in 1u128..=(count as u128) {
        if let Some(w) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", id)) {
            if w.processing_status == status {
                result.push_back(id);
            }
        }
    }
    result
}

/// Confirm receipt of a v2 waste item.
///
/// A participant other than the current owner calls this to acknowledge
/// the waste. Emits a `waste_confirmed` event.
///
/// # Parameters
/// - `waste_id`: ID of the v2 waste to confirm.
/// - `confirmer`: Registered participant confirming receipt. Must sign.
///   Must **not** be the current owner.
///
/// # Returns
/// The updated [`Waste`] with `is_confirmed = true`.
///
/// # Errors
/// - Panics `"Waste not found"`.
/// - Panics `"Cannot confirm deactivated waste"`.
/// - Panics `"Owner cannot confirm own waste"`.
/// - Panics `"Waste already confirmed"`.
pub(crate) fn confirm_waste_details(env: Env, waste_id: u128, confirmer: Address) -> types::Waste {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    confirmer.require_auth();
    crate::ScavengerContract::require_registered(&env, &confirmer);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    if !waste.is_active {
        panic!("Cannot confirm deactivated waste");
    }

    if waste.current_owner == confirmer {
        panic!("Owner cannot confirm own waste");
    }

    if waste.is_confirmed {
        panic!("Waste already confirmed");
    }

    waste.confirm(confirmer.clone());
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    events::emit_waste_confirmed(&env, waste_id, &confirmer);

    // Reputation: reward confirmer for timely confirmation
    crate::ScavengerContract::apply_reputation(&env, &confirmer, REP_CONFIRM);
    // Reputation: reward owner for having waste confirmed
    crate::ScavengerContract::apply_reputation(&env, &waste.current_owner, REP_CONFIRM);

    waste
}

/// Reset the confirmation status of a v2 waste item.
///
/// Only the current owner may reset confirmation, allowing the item to be
/// re-confirmed after a dispute or correction.
///
/// # Parameters
/// - `waste_id`: ID of the v2 waste.
/// - `owner`: Current owner. Must sign.
///
/// # Returns
/// The updated [`Waste`] with `is_confirmed = false`.
///
/// # Errors
/// - Panics `"Waste item not found"`.
/// - Panics `"Waste is not confirmed"`.
/// - Panics `"Caller is not the owner of this waste item"`.
pub(crate) fn reset_waste_confirmation(env: Env, waste_id: u128, owner: Address) -> types::Waste {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    // Access control check - verify caller owns the waste
    crate::ScavengerContract::only_waste_owner(&env, &owner, waste_id);
    crate::ScavengerContract::require_registered(&env, &owner);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste item not found");

    if !waste.is_confirmed {
        panic!("Waste is not confirmed");
    }

    waste.reset_confirmation();
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    events::emit_waste_confirmation_reset(&env, waste_id, &owner, env.ledger().timestamp());

    waste
}

/// Permanently deactivate a v2 waste record (admin only).
///
/// Deactivated waste cannot be transferred or confirmed. The operation is
/// irreversible.
///
/// # Parameters
/// - `waste_id`: ID of the v2 waste to deactivate.
/// - `admin`: Contract admin. Must sign.
///
/// # Returns
/// The updated [`Waste`] with `is_active = false`.
///
/// # Errors
/// - Panics `"Waste item not found"`.
/// - Panics `"Waste already deactivated"`.
pub(crate) fn deactivate_waste(env: Env, waste_id: u128, admin: Address) -> types::Waste {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::only_admin(&env, &admin);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste item not found");

    if !waste.is_active {
        panic!("Waste already deactivated");
    }

    waste.deactivate();
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    events::emit_waste_deactivated(&env, waste_id, &admin);

    audit_log::AuditLogService::log_action(
        &env,
        String::from_str(&env, "deactivate_waste"),
        admin,
        String::from_str(&env, "waste"),
        String::from_str(&env, "Waste deactivated"),
    );

    waste
}

/// Deactivate multiple v2 waste records in a single transaction (admin only).
///
/// Skips IDs that do not exist or are already deactivated, and continues
/// processing the remaining items. Emits a `WasteDeactivated` event for
/// each successfully deactivated item.
///
/// # Parameters
/// - `waste_ids`: Vec of v2 waste IDs to deactivate.
/// - `admin`: Contract admin. Must sign.
///
/// # Returns
/// Count of items that were successfully deactivated (`u32`).
pub(crate) fn batch_deactivate_waste(env: Env, waste_ids: Vec<u128>, admin: Address) -> u32 {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::only_admin(&env, &admin);

    let mut count: u32 = 0;
    for waste_id in waste_ids.iter() {
        let entry: Option<types::Waste> = env.storage().instance().get(&("waste_v2", waste_id));
        if let Some(mut waste) = entry {
            if waste.is_active {
                waste.deactivate();
                env.storage().instance().set(&("waste_v2", waste_id), &waste);
                events::emit_waste_deactivated(&env, waste_id, &admin);
                count += 1;
            }
        }
    }
    count
}

/// Set the TTL (seconds) for a waste type. 0 disables expiry for that type.
/// Admin only. Applied to newly registered waste; does not retroactively change existing items.
pub(crate) fn set_waste_ttl(env: Env, admin: Address, waste_type: WasteType, ttl_seconds: u64) {
    crate::ScavengerContract::only_admin(&env, &admin);
    env.storage().instance().set(&("waste_ttl", waste_type), &ttl_seconds);
}

/// Get the configured TTL for a waste type (0 = no expiry).
pub(crate) fn get_waste_ttl(env: Env, waste_type: WasteType) -> u64 {
    env.storage().instance().get(&("waste_ttl", waste_type)).unwrap_or(0)
}

/// Return IDs of all v2 waste items that have expired at the current ledger time.
pub(crate) fn get_expired_wastes(env: Env) -> Vec<u128> {
    let now = env.ledger().timestamp();
    let total = crate::ScavengerContract::get_waste_count(&env);
    let mut result = Vec::new(&env);
    for id in 1..=total {
        let waste_id = id as u128;
        if let Some(waste) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", waste_id)) {
            if waste.is_active && waste.is_expired(now) {
                result.push_back(waste_id);
            }
        }
    }
    result
}

/// Deactivate all expired v2 waste items. Admin only.
/// Emits WasteExpired for each item cleaned up.
/// Returns the count of items deactivated.
pub(crate) fn cleanup_expired_wastes(env: Env, admin: Address) -> u32 {
    crate::ScavengerContract::only_admin(&env, &admin);
    let now = env.ledger().timestamp();
    let total = crate::ScavengerContract::get_waste_count(&env);
    let mut count: u32 = 0;
    for id in 1..=total {
        let waste_id = id as u128;
        if let Some(mut waste) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", waste_id)) {
            if waste.is_active && waste.is_expired(now) {
                waste.deactivate();
                env.storage().instance().set(&("waste_v2", waste_id), &waste);
                events::emit_waste_expired(&env, waste_id);
                count += 1;
            }
        }
    }
    count
}

/// Check if a specific waste item has expired.
/// Returns `true` if the waste exists, is active, and has expired.
/// Returns `false` if the waste doesn't exist, is inactive, or not yet expired.
pub(crate) fn check_waste_expiration(env: Env, waste_id: u128) -> bool {
    let now = env.ledger().timestamp();
    if let Some(waste) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", waste_id)) {
        waste.is_active && waste.is_expired(now)
    } else {
        false
    }
}

/// Return IDs of active waste items approaching expiry within the given window (seconds).
/// e.g. `within_seconds = 90 * 24 * 60 * 60` for 90-day warning.
pub(crate) fn get_wastes_approaching_expiry(env: Env, within_seconds: u64) -> Vec<u128> {
    let now = env.ledger().timestamp();
    let total = crate::ScavengerContract::get_waste_count(&env);
    let mut result = Vec::new(&env);
    for id in 1..=total {
        let waste_id = id as u128;
        if let Some(waste) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", waste_id)) {
            if waste.is_active && waste.expires_at != 0 && waste.expires_at > now {
                let remaining = waste.expires_at - now;
                if remaining <= within_seconds {
                    result.push_back(waste_id);
                }
            }
        }
    }
    result
}

///
/// More gas-efficient than repeated [`submit_material`] calls because stats
/// and storage writes are batched. Emits no individual events per item.
///
/// # Parameters
/// - `materials`: Vec of `(WasteType, weight_grams, description)` tuples.
/// - `submitter`: Registered participant. Must sign.
///
/// # Returns
/// `Vec<Material>` in the same order as the input.
///
/// # Errors
/// - Panics `"Caller is not a registered participant"`.
/// - Panics `"Overflow in batch weight"` on u64 overflow.
pub(crate) fn submit_materials_batch(
    env: Env,
    materials: soroban_sdk::Vec<(WasteType, u64, String)>,
    submitter: Address,
) -> soroban_sdk::Vec<Material> {
    storage_utils::bump_instance(&env);
    // Validate submitter is registered
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_registered(&env, &submitter);

    let mut results = soroban_sdk::Vec::new(&env);
    let timestamp = env.ledger().timestamp();

    // Get or create stats once
    let mut stats: RecyclingStats = env
        .storage()
        .instance()
        .get(&("stats", submitter.clone()))
        .unwrap_or_else(|| RecyclingStats::new(submitter.clone()));

    let mut total_weight: u64 = 0;

    // Process each material
    for item in materials.iter() {
        let (waste_type, weight, description) = item;
        validation::validate_weight(weight as u128, MAX_WASTE_WEIGHT);
        let waste_id = crate::ScavengerContract::next_waste_id(&env);

        let material = Material::new(waste_id, waste_type, weight, submitter.clone(), timestamp, description);

        crate::ScavengerContract::set_waste(&env, waste_id, &material);
        stats.record_submission(&material);
        results.push_back(material);

        // Accumulate weight with overflow check
        total_weight = total_weight.checked_add(weight).expect("Overflow in batch weight");
    }

    // Update stats once at the end
    env.storage().instance().set(&("stats", submitter.clone()), &stats);

    // Update participant stats
    crate::ScavengerContract::update_participant_stats(&env, &submitter, total_weight, 0);

    results
}

/// Retrieve a v1 material record by ID. Alias for [`get_waste`].
pub(crate) fn get_material(env: Env, material_id: u64) -> Option<Material> {
    super::waste::get_waste(env, material_id)
}

/// Get waste by ID (alias for backward compatibility)
///
/// # Deprecated
/// Use [`get_waste`] instead. This function is an exact alias and will be
/// removed in a future release.
pub(crate) fn get_waste_by_id(env: Env, waste_id: u64) -> Option<Material> {
    super::waste::get_waste(env, waste_id)
}

/// Retrieve a v1 waste/material record by ID.
///
/// # Returns
/// `Some(Material)` if found, `None` otherwise.
pub(crate) fn get_waste(env: Env, waste_id: u64) -> Option<Material> {
    let key = ("waste", waste_id);
    env.storage().instance().get(&key)
}

/// Retrieve multiple v1 waste records in a single call.
///
/// # Parameters
/// - `waste_ids`: Vec of waste IDs to fetch.
///
/// # Returns
/// `Vec<Option<Material>>` in the same order as `waste_ids`.
/// Each element is `None` if the corresponding ID does not exist.
pub(crate) fn get_wastes_batch(env: Env, waste_ids: soroban_sdk::Vec<u64>) -> soroban_sdk::Vec<Option<Material>> {
    let mut results = soroban_sdk::Vec::new(&env);

    for waste_id in waste_ids.iter() {
        results.push_back(crate::ScavengerContract::get_waste_internal(&env, waste_id));
    }

    results
}

/// Batch-submit multiple materials in a single call.
/// Alias for [`submit_materials_batch`] with the name from issue #548.
pub(crate) fn batch_submit_materials(
    env: Env,
    materials: soroban_sdk::Vec<(WasteType, u64, String)>,
    submitter: Address,
) -> soroban_sdk::Vec<Material> {
    super::waste::submit_materials_batch(env, materials, submitter)
}

/// Add a tag to a v2 waste item. Tags are normalised to lowercase. Duplicates ignored.
/// Max 10 tags; max 20 chars each. Only the current owner may add tags.
pub(crate) fn add_waste_tag(env: Env, waste_id: u128, tag: String, caller: Address) -> types::Waste {
    crate::ScavengerContract::require_not_paused(&env);
    caller.require_auth();
    crate::ScavengerContract::require_registered(&env, &caller);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    if !waste.is_active {
        panic!("Waste is deactivated");
    }
    if waste.current_owner != caller {
        panic!("Only the waste owner can add tags");
    }
    if waste.tags.len() >= crate::ScavengerContract::MAX_TAGS {
        panic!("Tag limit reached");
    }

    let normalised = crate::ScavengerContract::normalise_tag(&env, &tag);
    for existing in waste.tags.iter() {
        if existing == normalised {
            return waste;
        }
    }

    waste.tags.push_back(normalised);
    env.storage().instance().set(&("waste_v2", waste_id), &waste);
    waste
}

/// Remove a tag from a v2 waste item. Case-insensitive. No-op if absent.
/// Only the current owner may remove tags.
pub(crate) fn remove_waste_tag(env: Env, waste_id: u128, tag: String, caller: Address) -> types::Waste {
    crate::ScavengerContract::require_not_paused(&env);
    caller.require_auth();
    crate::ScavengerContract::require_registered(&env, &caller);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    if waste.current_owner != caller {
        panic!("Only the waste owner can remove tags");
    }

    let normalised = crate::ScavengerContract::normalise_tag(&env, &tag);
    let mut new_tags: Vec<String> = Vec::new(&env);
    for existing in waste.tags.iter() {
        if existing != normalised {
            new_tags.push_back(existing);
        }
    }
    waste.tags = new_tags;
    env.storage().instance().set(&("waste_v2", waste_id), &waste);
    waste
}

/// Get all active v2 waste IDs that have a specific tag (case-insensitive).
pub(crate) fn get_wastes_by_tag(env: Env, tag: String) -> Vec<u128> {
    let normalised = crate::ScavengerContract::normalise_tag(&env, &tag);
    let mut result = Vec::new(&env);
    let count = crate::ScavengerContract::get_waste_count(&env);
    for waste_id in 1..=count {
        if let Some(waste) = env
            .storage()
            .instance()
            .get::<_, types::Waste>(&("waste_v2", waste_id as u128))
        {
            if waste.is_active {
                for t in waste.tags.iter() {
                    if t == normalised {
                        result.push_back(waste_id as u128);
                        break;
                    }
                }
            }
        }
    }
    result
}

/// Set (or replace) the primary image hash for a v2 waste item. Owner only.
pub(crate) fn set_waste_image(env: Env, waste_id: u128, hash: String, caller: Address) -> types::Waste {
    crate::ScavengerContract::require_not_paused(&env);
    caller.require_auth();
    crate::ScavengerContract::require_registered(&env, &caller);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    if !waste.is_active {
        panic!("Waste is deactivated");
    }
    if waste.current_owner != caller {
        panic!("Only the waste owner can set image hash");
    }

    crate::ScavengerContract::validate_ipfs_hash(&env, &hash);
    waste.image_hash = Some(hash);
    env.storage().instance().set(&("waste_v2", waste_id), &waste);
    waste
}

/// Add a document hash to a v2 waste item (max 5). Owner only.
pub(crate) fn add_waste_document(env: Env, waste_id: u128, hash: String, caller: Address) -> types::Waste {
    crate::ScavengerContract::require_not_paused(&env);
    caller.require_auth();
    crate::ScavengerContract::require_registered(&env, &caller);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    if !waste.is_active {
        panic!("Waste is deactivated");
    }
    if waste.current_owner != caller {
        panic!("Only the waste owner can add document hashes");
    }
    if waste.document_hashes.len() >= crate::ScavengerContract::MAX_DOCUMENT_HASHES {
        panic!("Document hash limit reached");
    }

    crate::ScavengerContract::validate_ipfs_hash(&env, &hash);
    waste.document_hashes.push_back(hash);
    env.storage().instance().set(&("waste_v2", waste_id), &waste);
    waste
}

/// Substitute one waste item for another equivalent material.
/// This is used when the original item is unavailable or damaged.
pub(crate) fn substitute_waste(
    env: Env,
    original_id: u128,
    substitute_id: u128,
    approver: Address,
    reason: String,
) -> Result<(), Error> {
    approver.require_auth();
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_registered(&env, &approver);

    // Fetch both waste items
    let mut original: Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", original_id))
        .ok_or(Error::WasteNotFound)?;

    let mut substitute: Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", substitute_id))
        .ok_or(Error::WasteNotFound)?;

    // Validate equivalence (same type and similar weight)
    if original.waste_type != substitute.waste_type {
        return Err(Error::WasteTypeMismatch);
    }

    // Weight should be within 10% tolerance
    let weight_diff = if original.weight > substitute.weight {
        original.weight - substitute.weight
    } else {
        substitute.weight - original.weight
    };

    if weight_diff > original.weight / 10 {
        return Err(Error::InvalidWeight);
    }

    // Create substitution record
    let record = SubstitutionRecord {
        original_id,
        substitute_id,
        approver: approver.clone(),
        reason: reason.clone(),
        timestamp: env.ledger().timestamp(),
    };

    // Update histories
    original.substitution_history.push_back(record.clone());
    substitute.substitution_history.push_back(record.clone());

    // Deactivate original, substitute takes its place (conceptually)
    original.is_active = false;

    // Store updated waste items
    env.storage().instance().set(&("waste_v2", original_id), &original);
    env.storage().instance().set(&("waste_v2", substitute_id), &substitute);

    // Log the action
    audit_log::AuditLogService::log_action(
        &env,
        String::from_str(&env, "SUBSTITUTE_WASTE"),
        approver.clone(),
        String::from_str(&env, "WASTE"),
        String::from_str(&env, "Waste item substituted"),
    );

    // Emit substitution event
    env.events()
        .publish((symbol_short!("subst"), original_id), (substitute_id, approver));

    Ok(())
}

/// Split a v2 waste item into multiple smaller items.
///
/// The owner provides a list of weights that must sum to the original weight.
/// The original waste is deactivated and new child waste items are created,
/// inheriting the type, location, and owner. Transfer history is preserved
/// by copying the parent's history to each child. A `WasteSplit` event is emitted.
///
/// # Parameters
/// - `waste_id`: ID of the v2 waste to split.
/// - `owner`: Current owner. Must sign and own the waste.
/// - `weights`: Vec of weights (in grams) for each child. Must sum to original weight.
///
/// # Returns
/// `Vec<u128>` of the newly created child waste IDs.
///
/// # Errors
/// - [`Error::WasteNotFound`] if no waste record exists for `waste_id`.
/// - [`Error::NotWasteOwner`] if `owner` does not own the waste.
/// - [`Error::WasteDeactivated`] if the waste is already deactivated.
/// - [`Error::TooFewSplits`] if fewer than 2 weights are provided.
/// - [`Error::TooManySplits`] if more than 10 weights are provided.
/// - [`Error::WeightMismatch`] if the weights do not sum to the original weight.
pub(crate) fn split_waste(env: Env, waste_id: u128, owner: Address, weights: Vec<u128>) -> Result<Vec<u128>, Error> {
    owner.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    // Load and validate the parent waste
    let mut parent: types::Waste = match env.storage().instance().get(&("waste_v2", waste_id)) {
        Some(w) => w,
        None => return Err(Error::WasteNotFound),
    };

    if parent.current_owner != owner {
        return Err(Error::NotWasteOwner);
    }

    if !parent.is_active {
        return Err(Error::WasteDeactivated);
    }

    let n = weights.len();
    if n < 2 {
        return Err(Error::TooFewSplits);
    }
    if n > 10 {
        return Err(Error::TooManySplits);
    }

    // Validate weights sum equals parent weight
    let mut total: u128 = 0;
    for w in weights.iter() {
        total = total.checked_add(w).ok_or(Error::Overflow)?;
    }
    if total != parent.weight {
        return Err(Error::WeightMismatch);
    }

    // Load parent transfer history once
    let parent_history: Vec<WasteTransfer> = env
        .storage()
        .instance()
        .get(&("transfer_history", waste_id))
        .unwrap_or(Vec::new(&env));

    let timestamp = env.ledger().timestamp();
    let mut child_ids: Vec<u128> = Vec::new(&env);

    for w in weights.iter() {
        let child_id = crate::ScavengerContract::next_waste_id(&env) as u128;

        let child = types::Waste::new(
            &env,
            child_id,
            parent.waste_type,
            w,
            owner.clone(),
            parent.latitude,
            parent.longitude,
            timestamp,
            true,
            false,
            owner.clone(),
            0,
        );

        env.storage().instance().set(&("waste_v2", child_id), &child);

        // Copy parent transfer history to child
        env.storage()
            .instance()
            .set(&("transfer_history", child_id), &parent_history);

        // Add child to owner's waste list
        let mut owner_list: Vec<u128> = env
            .storage()
            .instance()
            .get(&("participant_wastes", owner.clone()))
            .unwrap_or(Vec::new(&env));
        owner_list.push_back(child_id);
        env.storage()
            .instance()
            .set(&("participant_wastes", owner.clone()), &owner_list);

        child_ids.push_back(child_id);
    }

    // Deactivate parent
    parent.deactivate();
    env.storage().instance().set(&("waste_v2", waste_id), &parent);

    // Remove parent from owner's waste list
    let owner_list: Vec<u128> = env
        .storage()
        .instance()
        .get(&("participant_wastes", owner.clone()))
        .unwrap_or(Vec::new(&env));
    let mut new_owner_list = Vec::new(&env);
    for id in owner_list.iter() {
        if id != waste_id {
            new_owner_list.push_back(id);
        }
    }
    env.storage()
        .instance()
        .set(&("participant_wastes", owner.clone()), &new_owner_list);

    events::emit_waste_split(&env, waste_id, &owner, &child_ids);

    Ok(child_ids)
}

/// Merge multiple v2 waste items of the same type into a single new item.
///
/// All source wastes must be owned by `owner`, active, share the same
/// [`WasteType`], and be at the same location. They are deactivated and a
/// new waste with the combined weight is created. Transfer histories are
/// aggregated (deduplicated by `waste_id`) into the merged item. A
/// `WastesMerged` event is emitted.
///
/// # Parameters
/// - `waste_ids`: IDs of the v2 wastes to merge (2–20).
/// - `owner`: Current owner of all wastes. Must sign.
///
/// # Returns
/// The new merged waste ID (`u128`).
///
/// # Errors
/// - [`Error::TooFewWastes`] if fewer than 2 IDs are provided.
/// - [`Error::TooManyWastes`] if more than 20 IDs are provided.
/// - [`Error::WasteNotFound`] if any ID does not exist.
/// - [`Error::NotWasteOwner`] if `owner` does not own every waste.
/// - [`Error::WasteDeactivated`] if any waste is already deactivated.
/// - [`Error::WasteTypeMismatchMerge`] if wastes have different types.
/// - [`Error::LocationMismatch`] if wastes are at different locations.
pub(crate) fn merge_wastes(env: Env, waste_ids: Vec<u128>, owner: Address) -> Result<u128, Error> {
    owner.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    let n = waste_ids.len();
    if n < 2 {
        return Err(Error::TooFewWastes);
    }
    if n > 20 {
        return Err(Error::TooManyWastes);
    }

    // Validate all wastes and accumulate combined weight
    let mut combined_weight: u128 = 0;
    let mut ref_type: Option<types::WasteType> = None;
    let mut ref_lat: Option<i128> = None;
    let mut ref_lon: Option<i128> = None;

    for waste_id in waste_ids.iter() {
        let waste: types::Waste = env
            .storage()
            .instance()
            .get(&("waste_v2", waste_id))
            .ok_or(Error::WasteNotFound)?;

        if waste.current_owner != owner {
            return Err(Error::NotWasteOwner);
        }
        if !waste.is_active {
            return Err(Error::WasteDeactivated);
        }

        match ref_type {
            None => ref_type = Some(waste.waste_type),
            Some(t) if t != waste.waste_type => return Err(Error::WasteTypeMismatchMerge),
            _ => {}
        }

        match (ref_lat, ref_lon) {
            (None, None) => {
                ref_lat = Some(waste.latitude);
                ref_lon = Some(waste.longitude);
            }
            (Some(lat), Some(lon)) if lat != waste.latitude || lon != waste.longitude => {
                return Err(Error::LocationMismatch);
            }
            _ => {}
        }

        combined_weight = combined_weight.checked_add(waste.weight).ok_or(Error::Overflow)?;
    }

    let waste_type = ref_type.unwrap();
    let latitude = ref_lat.unwrap();
    let longitude = ref_lon.unwrap();
    let timestamp = env.ledger().timestamp();

    // Create merged waste
    let merged_id = crate::ScavengerContract::next_waste_id(&env) as u128;
    let merged = types::Waste::new(
        &env,
        merged_id,
        waste_type,
        combined_weight,
        owner.clone(),
        latitude,
        longitude,
        timestamp,
        true,
        false,
        owner.clone(),
        0,
    );
    env.storage().instance().set(&("waste_v2", merged_id), &merged);

    // Aggregate transfer histories (append all source histories)
    let mut merged_history: Vec<WasteTransfer> = Vec::new(&env);
    for waste_id in waste_ids.iter() {
        let history: Vec<WasteTransfer> = env
            .storage()
            .instance()
            .get(&("transfer_history", waste_id))
            .unwrap_or(Vec::new(&env));
        for record in history.iter() {
            merged_history.push_back(record);
        }
    }
    env.storage()
        .instance()
        .set(&("transfer_history", merged_id), &merged_history);

    // Update owner waste list: remove sources, add merged
    let owner_list: Vec<u128> = env
        .storage()
        .instance()
        .get(&("participant_wastes", owner.clone()))
        .unwrap_or(Vec::new(&env));
    let mut new_owner_list = Vec::new(&env);
    for id in owner_list.iter() {
        if !waste_ids.contains(&id) {
            new_owner_list.push_back(id);
        }
    }
    new_owner_list.push_back(merged_id);
    env.storage()
        .instance()
        .set(&("participant_wastes", owner.clone()), &new_owner_list);

    // Deactivate all source wastes
    for waste_id in waste_ids.iter() {
        let mut waste: types::Waste = env.storage().instance().get(&("waste_v2", waste_id)).unwrap();
        waste.deactivate();
        env.storage().instance().set(&("waste_v2", waste_id), &waste);
    }

    events::emit_wastes_merged(&env, merged_id, &owner, &waste_ids);

    Ok(merged_id)
}

/// Reserve a v2 waste item for a limited time.
///
/// Only registered participants may reserve. The waste must be active and
/// not already reserved (or the previous reservation must have expired).
/// Emits a `WasteReserved` event.
///
/// # Parameters
/// - `waste_id`: ID of the v2 waste to reserve.
/// - `reserver`: Registered participant making the reservation. Must sign.
/// - `duration`: Reservation duration in seconds.
///
/// # Errors
/// - [`Error::WasteNotFound`] if the waste does not exist.
/// - [`Error::WasteDeactivated`] if the waste is inactive.
/// - [`Error::WasteAlreadyReserved`] if an active reservation exists.
pub(crate) fn reserve_waste(env: Env, waste_id: u128, reserver: Address, duration: u64) -> Result<types::Waste, Error> {
    reserver.require_auth();
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::require_registered(&env, &reserver);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    if !waste.is_active {
        return Err(Error::WasteDeactivated);
    }

    let now = env.ledger().timestamp();

    // Block if an active (non-expired) reservation exists
    if let (Some(_), Some(until)) = (waste.reserved_by.clone(), waste.reserved_until) {
        if until > now {
            return Err(Error::WasteAlreadyReserved);
        }
    }

    let reserved_until = now.checked_add(duration).ok_or(Error::Overflow)?;
    waste.reserved_by = Some(reserver.clone());
    waste.reserved_until = Some(reserved_until);

    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    events::emit_waste_reserved(&env, waste_id, &reserver, reserved_until);

    Ok(waste)
}

/// Cancel a reservation on a v2 waste item.
///
/// The reserver themselves or the waste owner may cancel. Emits a
/// `ReservationCancelled` event.
///
/// # Parameters
/// - `waste_id`: ID of the v2 waste.
/// - `caller`: Reserver or current owner. Must sign.
///
/// # Errors
/// - [`Error::WasteNotFound`] if the waste does not exist.
/// - [`Error::WasteNotReserved`] if no reservation exists.
/// - [`Error::NotReserver`] if caller is neither the reserver nor the owner.
pub(crate) fn cancel_reservation(env: Env, waste_id: u128, caller: Address) -> Result<types::Waste, Error> {
    caller.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    if waste.reserved_by.is_none() {
        return Err(Error::WasteNotReserved);
    }

    let reserver = waste.reserved_by.clone().unwrap();
    if caller != reserver && caller != waste.current_owner {
        return Err(Error::NotReserver);
    }

    waste.reserved_by = None;
    waste.reserved_until = None;

    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    events::emit_reservation_cancelled(&env, waste_id, &caller);

    Ok(waste)
}

/// Update waste location and track history
pub(crate) fn update_waste_location(
    env: Env,
    waste_id: u128,
    latitude: i128,
    longitude: i128,
    updater: Address,
) -> Result<(), Error> {
    updater.require_auth();

    // Validate coordinates
    if latitude < -90_000_000 || latitude > 90_000_000 {
        return Err(Error::InvalidCoordinates);
    }
    if longitude < -180_000_000 || longitude > 180_000_000 {
        return Err(Error::InvalidCoordinates);
    }

    // Get and update waste
    let mut waste: Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    waste.latitude = latitude;
    waste.longitude = longitude;

    // Store updated waste
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    // Record location history
    let location = LocationRecord::new(latitude, longitude, env.ledger().timestamp(), updater);

    let mut history: Vec<LocationRecord> = env
        .storage()
        .instance()
        .get(&(LOCATION_HISTORY, waste_id))
        .unwrap_or_else(|| Vec::new(&env));

    history.push_back(location);
    env.storage().instance().set(&(LOCATION_HISTORY, waste_id), &history);

    Ok(())
}

/// Get location history for a waste item
pub(crate) fn get_location_history(env: Env, waste_id: u128) -> Vec<LocationRecord> {
    env.storage()
        .instance()
        .get(&(LOCATION_HISTORY, waste_id))
        .unwrap_or_else(|| Vec::new(&env))
}

/// Create a new waste batch
pub(crate) fn create_waste_batch(env: Env, creator: Address) -> Result<u64, Error> {
    creator.require_auth();

    let batch_count: u64 = env.storage().instance().get(&BATCH_COUNT).unwrap_or(0);

    let batch_id = batch_count + 1;
    let batch = WasteBatch::new(batch_id, creator, env.ledger().timestamp(), &env);

    env.storage().instance().set(&(BATCH_INDEX, batch_id), &batch);
    env.storage().instance().set(&BATCH_COUNT, &batch_id);

    Ok(batch_id)
}

/// Add waste to a batch
pub(crate) fn add_waste_to_batch(env: Env, batch_id: u64, waste_id: u128, adder: Address) -> Result<(), Error> {
    adder.require_auth();

    let mut batch: WasteBatch = env
        .storage()
        .instance()
        .get(&(BATCH_INDEX, batch_id))
        .ok_or(Error::InvalidAmount)?;

    // Only allow adding to pending batches
    if batch.status != BatchStatus::Pending {
        return Err(Error::InvalidAmount);
    }

    // Get waste to verify it exists and get weight
    let waste: Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    batch.add_waste(waste_id, waste.weight);

    env.storage().instance().set(&(BATCH_INDEX, batch_id), &batch);

    Ok(())
}

/// Get batch details
pub(crate) fn get_batch(env: Env, batch_id: u64) -> Option<WasteBatch> {
    env.storage().instance().get(&(BATCH_INDEX, batch_id))
}

/// Mark batch as ready
pub(crate) fn mark_batch_ready(env: Env, batch_id: u64, marker: Address) -> Result<(), Error> {
    marker.require_auth();

    let mut batch: WasteBatch = env
        .storage()
        .instance()
        .get(&(BATCH_INDEX, batch_id))
        .ok_or(Error::InvalidAmount)?;

    if batch.created_by != marker {
        return Err(Error::Unauthorized);
    }

    batch.mark_ready();
    env.storage().instance().set(&(BATCH_INDEX, batch_id), &batch);

    Ok(())
}

/// Process a waste batch
pub(crate) fn process_batch(env: Env, batch_id: u64, processor: Address, note: String) -> Result<(), Error> {
    processor.require_auth();
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_manufacturer(&env, &processor);

    let mut batch: WasteBatch = env
        .storage()
        .instance()
        .get(&(BATCH_INDEX, batch_id))
        .ok_or(Error::InvalidAmount)?;

    // Only allow processing ready batches
    if batch.status != BatchStatus::Ready {
        return Err(Error::InvalidAmount);
    }

    // Mark batch as processing
    batch.mark_processing();
    env.storage().instance().set(&(BATCH_INDEX, batch_id), &batch);

    // Process each waste item in the batch
    for waste_id in batch.waste_ids.iter() {
        // Update processing status of each waste item
        let mut waste: Waste = env
            .storage()
            .instance()
            .get(&("waste_v2", waste_id))
            .ok_or(Error::WasteNotFound)?;

        // Mark as processed (update processing status)
        let processing_record = ProcessingRecord {
            status: ProcessingStatus::Processed,
            timestamp: env.ledger().timestamp(),
            updated_by: processor.clone(),
        };
        waste.processing_history.push_back(processing_record);
        waste.processing_status = ProcessingStatus::Processed;

        env.storage().instance().set(&("waste_v2", waste_id), &waste);

        // Update participant stats for the current owner
        crate::ScavengerContract::update_participant_stats(&env, &waste.current_owner, waste.weight as u64, 0);
    }

    // Mark batch as completed
    batch.mark_completed();
    env.storage().instance().set(&(BATCH_INDEX, batch_id), &batch);

    // Emit batch processed event
    events::emit_batch_processed(&env, batch_id, &processor, &note);

    Ok(())
}
