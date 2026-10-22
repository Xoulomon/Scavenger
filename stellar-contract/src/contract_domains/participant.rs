use super::super::*;

/// Check whether an address is a registered participant.
///
/// # Returns
/// `true` if the address exists in storage and `is_registered == true`.
pub(crate) fn is_participant_registered(env: Env, address: Address) -> bool {
    let key = (address,);
    if let Some(p) = env.storage().instance().get::<_, Participant>(&key) {
        p.is_registered
    } else {
        false
    }
}

/// Register a new supply-chain participant.
///
/// Stores the participant on-chain and emits a `participant_registered` event.
///
/// # Parameters
/// - `address`: Participant's Stellar address. Must sign.
/// - `role`: [`ParticipantRole`] — `Recycler`, `Collector`, or `Manufacturer`.
/// - `name`: Short display name (Soroban `Symbol`, max 32 chars).
/// - `latitude`: Location in microdegrees (e.g. `52_520_000` = 52.52°N).
/// - `longitude`: Location in microdegrees.
///
/// # Returns
/// The newly created [`Participant`] record.
///
/// # Errors
/// - Panics `"Participant already registered"` on duplicate registration.
/// - Panics on invalid coordinates (see [`validation::validate_coordinates`]).
///
/// # Example
/// ```text
/// register_participant(alice, ParticipantRole::Recycler, "alice", 52_520_000, 13_405_000)
/// ```
pub(crate) fn register_participant(
    env: Env,
    address: Address,
    role: ParticipantRole,
    name: soroban_sdk::Symbol,
    latitude: i128,
    longitude: i128,
) -> Participant {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    address.require_auth();

    // Validate coordinates
    validation::validate_coordinates(latitude, longitude);

    // Check if already registered
    if super::participant::is_participant_registered(env.clone(), address.clone()) {
        panic!("Participant already registered");
    }

    let participant = Participant {
        address: address.clone(),
        role,
        name: name.clone(),
        latitude,
        longitude,
        is_registered: true,
        total_waste_processed: 0,
        total_tokens_earned: 0,
        registered_at: env.ledger().timestamp(),
        reputation_score: 0,
        last_active_at: env.ledger().timestamp(),
        certification: CertificationLevel::Beginner,
        tier: ParticipantTier::Bronze,
    };

    // Store participant using helper function
    crate::ScavengerContract::set_participant(&env, &address, &participant);

    // Add to participant index
    let mut participant_index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));
    participant_index.push_back(address.clone());
    env.storage().instance().set(&PART_INDEX, &participant_index);

    // Emit event
    events::emit_participant_registered(&env, &address, role, name.clone(), latitude, longitude);

    audit_log::AuditLogService::log_action(
        &env,
        String::from_str(&env, "register_participant"),
        address,
        String::from_str(&env, "participant"),
        String::from_str(&env, "Participant registered"),
    );

    participant
}

/// Retrieve a participant record by address.
///
/// # Returns
/// `Some(Participant)` if the address is registered, `None` otherwise.
pub(crate) fn get_participant(env: Env, address: Address) -> Option<Participant> {
    let key = (address,);
    env.storage().instance().get(&key)
}

/// Get total tokens earned by a specific participant
/// Returns the total tokens earned, or 0 for unregistered participants
pub(crate) fn get_participant_earnings(env: Env, address: Address) -> i128 {
    let key = (address,);
    if let Some(participant) = env.storage().instance().get::<_, Participant>(&key) {
        participant.total_tokens_earned as i128
    } else {
        0
    }
}

/// Get participant information with current statistics
/// Returns participant details along with their recycling statistics
/// Returns None if participant is not registered
/// Retrieve a participant together with their recycling statistics.
///
/// # Returns
/// `Some(ParticipantInfo)` if registered, `None` if the address is unknown.
pub(crate) fn get_participant_info(env: Env, address: Address) -> Option<ParticipantInfo> {
    let participant = super::participant::get_participant(env.clone(), address.clone())?;
    let stats = super::analytics::get_stats(env, address.clone()).unwrap_or_else(|| RecyclingStats::new(address));

    Some(ParticipantInfo { participant, stats })
}

/// Get all registered participants with pagination
/// Returns a paginated list of participant addresses
///
/// # Arguments
/// * `offset` - Starting index (0-based)
/// * `limit` - Maximum number of results to return
///
/// # Returns
/// Vector of participant addresses, limited by the specified limit
/// Returns empty vector if offset is beyond the list size
pub(crate) fn get_all_participants(env: Env, offset: u32, limit: u32) -> Vec<Address> {
    let participant_index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));

    let total_count = participant_index.len();
    let mut result = Vec::new(&env);

    // Return empty if offset is beyond the list
    if offset >= total_count {
        return result;
    }

    // Calculate the end index
    let end = core::cmp::min(offset + limit, total_count);

    // Collect addresses from offset to end
    for i in offset..end {
        if let Some(addr) = participant_index.get(i) {
            result.push_back(addr);
        }
    }

    result
}

/// Grant certification to a participant (admin only)
///
/// # Parameters
/// - `address`: Participant's address
/// - `level`: Certification level to grant
///
/// # Errors
/// - Panics if caller is not admin
/// - Panics if participant not found
pub(crate) fn grant_certification(env: Env, admin: Address, address: Address, level: CertificationLevel) {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_admin(&env, &admin);

    let key = (address.clone(),);
    if let Some(mut participant) = env.storage().instance().get::<_, Participant>(&key) {
        let old_level = participant.certification;
        participant.certification = level;
        env.storage().instance().set(&key, &participant);

        // Emit event if level changed
        if level != old_level {
            events::emit_certification_granted(&env, &address, level);
        }
    } else {
        panic!("Participant not found");
    }
}

/// Get participants by certification level
///
/// # Parameters
/// - `level`: Certification level to filter by
///
/// # Returns
/// Vector of participant addresses with the specified certification level
pub(crate) fn get_participants_by_cert(env: Env, level: CertificationLevel) -> Vec<Address> {
    let participant_index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));

    let mut result = Vec::new(&env);

    for addr in participant_index {
        if let Some(participant) = super::participant::get_participant(env.clone(), addr.clone()) {
            if participant.certification == level {
                result.push_back(addr);
            }
        }
    }

    result
}

/// Bulk import historical participant data (admin only)
///
/// # Parameters
/// - `participants`: Vector of participant data to import
///
/// # Errors
/// - Panics if not admin
/// - Panics if batch too large
pub(crate) fn bulk_import_participants(env: Env, admin: Address, participants: soroban_sdk::Vec<Participant>) {
    crate::ScavengerContract::require_admin(&env, &admin);

    if participants.len() > 100 {
        panic!("Batch too large");
    }

    // Validate all data
    for participant in participants.iter() {
        if !participant.is_registered {
            panic!("Invalid participant data");
        }
        // Add more validations as needed
    }

    // Import
    for participant in participants.iter() {
        let key = (participant.address.clone(),);
        env.storage().instance().set(&key, &participant);
        // Add to index
        let mut participant_index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));
        if !participant_index.contains(&participant.address) {
            participant_index.push_back(participant.address.clone());
            env.storage().instance().set(&PART_INDEX, &participant_index);
        }
    }

    // Emit event
    events::emit_bulk_import_completed(&env, "participant", participants.len() as u32);
}

/// Update participant role
/// Preserves registration timestamp and other data
/// Change the role of a registered participant.
///
/// All other fields (name, location, stats, timestamps) are preserved.
///
/// # Parameters
/// - `address`: Participant's address. Must sign.
/// - `new_role`: The [`ParticipantRole`] to assign.
///
/// # Returns
/// The updated [`Participant`].
///
/// # Errors
/// - Panics `"Participant not found"`.
/// - Panics `"Participant is not registered"`.
pub(crate) fn update_role(env: Env, address: Address, new_role: ParticipantRole) -> Participant {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    address.require_auth();

    let mut participant: Participant =
        super::participant::get_participant(env.clone(), address.clone()).expect("Participant not found");

    // Validate participant is registered
    if !participant.is_registered {
        panic!("Participant is not registered");
    }

    participant.role = new_role;
    crate::ScavengerContract::set_participant(&env, &address, &participant);

    audit_log::AuditLogService::log_action(
        &env,
        String::from_str(&env, "update_role"),
        address,
        String::from_str(&env, "participant"),
        String::from_str(&env, "Role updated"),
    );

    participant
}

/// Mark a participant as deregistered (`is_registered = false`).
///
/// The record is retained in storage; the participant can no longer
/// perform role-gated actions.
///
/// # Parameters
/// - `address`: Participant's address. Must sign.
///
/// # Returns
/// The updated [`Participant`] with `is_registered = false`.
///
/// # Errors
/// - Panics `"Participant not found"`.
pub(crate) fn deregister_participant(env: Env, address: Address) -> Participant {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    address.require_auth();

    let key = (address.clone(),);
    let mut participant: Participant = env.storage().instance().get(&key).expect("Participant not found");

    participant.is_registered = false;
    env.storage().instance().set(&key, &participant);

    // Remove from participant index
    let participant_index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));

    let mut new_index = Vec::new(&env);
    for addr in participant_index.iter() {
        if addr != address {
            new_index.push_back(addr);
        }
    }
    env.storage().instance().set(&PART_INDEX, &new_index);

    audit_log::AuditLogService::log_action(
        &env,
        String::from_str(&env, "deregister_participant"),
        address,
        String::from_str(&env, "participant"),
        String::from_str(&env, "Participant deregistered"),
    );

    participant
}

/// Update participant location
/// Update the location of a registered participant.
/// Only the participant themselves can call this.
/// Coordinates are scaled by 1e6 (e.g. 40_000_000 = 40.000000°).
pub(crate) fn update_participant_location(env: Env, address: Address, latitude: i128, longitude: i128) -> Participant {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    address.require_auth();

    validation::validate_coordinates(latitude, longitude);

    let key = (address.clone(),);
    let mut participant: Participant = env.storage().instance().get(&key).expect("Participant not found");

    if !participant.is_registered {
        panic!("Participant is not registered");
    }

    participant.latitude = latitude;
    participant.longitude = longitude;
    env.storage().instance().set(&key, &participant);

    events::emit_participant_location_updated(&env, &address, latitude, longitude);

    participant
}

/// Update participant location.
///
/// # Deprecated
/// Use [`update_participant_location`] instead. That function also validates
/// coordinates and emits a `ParticipantLocationUpdated` event.
pub(crate) fn update_location(env: Env, address: Address, latitude: i128, longitude: i128) -> Participant {
    super::participant::update_participant_location(env, address, latitude, longitude)
}

/// Check whether a participant is permitted to collect waste materials.
///
/// # Returns
/// `true` if the participant is registered and their role allows collection
/// (`Recycler` or `Collector`).
pub(crate) fn can_collect(env: Env, address: Address) -> bool {
    let key = (address,);
    if let Some(participant) = env.storage().instance().get::<_, Participant>(&key) {
        participant.is_registered && participant.role.can_collect_materials()
    } else {
        false
    }
}

/// Check whether a participant is permitted to manufacture products.
///
/// # Returns
/// `true` if the participant is registered and their role is `Manufacturer`.
pub(crate) fn can_manufacture(env: Env, address: Address) -> bool {
    let key = (address,);
    if let Some(participant) = env.storage().instance().get::<_, Participant>(&key) {
        participant.is_registered && participant.role.can_manufacture()
    } else {
        false
    }
}

/// Get all v2 waste IDs currently owned by a participant.
///
/// # Returns
/// `Vec<u128>` of waste IDs. Empty if the participant owns none.
pub(crate) fn get_participant_wastes_v2(env: Env, participant: Address) -> Vec<u128> {
    env.storage()
        .instance()
        .get(&("participant_wastes", participant))
        .unwrap_or(Vec::new(&env))
}

/// Get all v1 waste IDs currently owned by a participant.
///
/// Performs a linear scan over all waste records. For large datasets,
/// prefer [`get_participant_wastes_v2`] which uses an indexed list.
///
/// # Returns
/// `Vec<u64>` of waste IDs where `material.submitter == participant`.
pub(crate) fn get_participant_wastes(env: Env, participant: Address) -> Vec<u64> {
    let mut waste_ids = Vec::new(&env);
    let waste_count = env.storage().instance().get::<_, u64>(&("waste_count",)).unwrap_or(0);

    // Iterate through all wastes and collect IDs owned by participant
    for waste_id in 1..=waste_count {
        let key = ("waste", waste_id);
        if let Some(material) = env.storage().instance().get::<_, Material>(&key) {
            if material.submitter == participant {
                waste_ids.push_back(waste_id);
            }
        }
    }

    waste_ids
}

/// Create a new time-limited challenge (admin only). Max 10 active challenges.
pub(crate) fn create_challenge(
    env: Env,
    admin: Address,
    title: soroban_sdk::Symbol,
    target_weight: u128,
    waste_type: WasteType,
    start_time: u64,
    end_time: u64,
    reward: u128,
) -> Challenge {
    crate::ScavengerContract::only_admin(&env, &admin);
    crate::ScavengerContract::require_not_paused(&env);

    if target_weight == 0 {
        panic!("Target weight must be > 0");
    }
    if start_time >= end_time {
        panic!("start_time must be before end_time");
    }
    if reward == 0 {
        panic!("Reward must be > 0");
    }

    // Enforce max 10 active challenges
    let active_count = crate::ScavengerContract::count_active_challenges(&env);
    if active_count >= MAX_ACTIVE_CHALLENGES {
        panic!("Max active challenges reached");
    }

    let id: u64 = env.storage().instance().get(&CHALLENGE_COUNT).unwrap_or(0u64) + 1;
    env.storage().instance().set(&CHALLENGE_COUNT, &id);

    let challenge = Challenge {
        id,
        title: title.clone(),
        target_weight,
        waste_type,
        start_time,
        end_time,
        reward,
        status: ChallengeStatus::Active,
        creator: admin.clone(),
    };

    env.storage().instance().set(&("challenge", id), &challenge);

    env.events().publish(
        (symbol_short!("chal_new"), id),
        (title, target_weight, waste_type, start_time, end_time, reward),
    );

    challenge
}

/// Join a challenge as a registered participant.
pub(crate) fn join_challenge(env: Env, challenge_id: u64, participant: Address) {
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_registered(&env, &participant);

    let challenge: Challenge = env
        .storage()
        .instance()
        .get(&("challenge", challenge_id))
        .expect("Challenge not found");

    let now = env.ledger().timestamp();
    if challenge.status != ChallengeStatus::Active || now >= challenge.end_time {
        panic!("Challenge is not active");
    }
    if now < challenge.start_time {
        panic!("Challenge has not started yet");
    }

    let prog_key = ("chal_prog", challenge_id, participant.clone());
    if env.storage().instance().has(&prog_key) {
        panic!("Already joined this challenge");
    }

    let progress = ChallengeProgress {
        challenge_id,
        participant: participant.clone(),
        weight_processed: 0,
        completed: false,
        joined_at: now,
    };
    env.storage().instance().set(&prog_key, &progress);

    env.events()
        .publish((symbol_short!("chal_join"), challenge_id), participant);
}

/// Get a participant's progress in a challenge.
pub(crate) fn get_challenge_progress(env: Env, challenge_id: u64, participant: Address) -> ChallengeProgress {
    env.storage()
        .instance()
        .get(&("chal_prog", challenge_id, participant))
        .expect("Not joined this challenge")
}

/// Record waste weight toward a challenge and auto-complete if target met.
/// Called internally after waste is processed; also callable directly.
pub(crate) fn update_challenge_progress(env: Env, challenge_id: u64, participant: Address, weight_grams: u128) {
    crate::ScavengerContract::require_not_paused(&env);
    participant.require_auth();

    let challenge: Challenge = env
        .storage()
        .instance()
        .get(&("challenge", challenge_id))
        .expect("Challenge not found");

    let now = env.ledger().timestamp();
    if challenge.status != ChallengeStatus::Active || now >= challenge.end_time {
        panic!("Challenge is not active");
    }

    let prog_key = ("chal_prog", challenge_id, participant.clone());
    let mut progress: ChallengeProgress = env
        .storage()
        .instance()
        .get(&prog_key)
        .expect("Not joined this challenge");

    if progress.completed {
        return;
    }

    progress.weight_processed = progress.weight_processed.checked_add(weight_grams).expect("Overflow");

    if progress.weight_processed >= challenge.target_weight {
        progress.completed = true;
        env.storage().instance().set(&prog_key, &progress);
        crate::ScavengerContract::complete_challenge_internal(&env, challenge_id, &participant, &challenge);
    } else {
        env.storage().instance().set(&prog_key, &progress);
    }
}

/// Manually complete a challenge for a participant (checks target met).
pub(crate) fn complete_challenge(env: Env, challenge_id: u64, participant: Address) {
    crate::ScavengerContract::require_not_paused(&env);
    participant.require_auth();

    let challenge: Challenge = env
        .storage()
        .instance()
        .get(&("challenge", challenge_id))
        .expect("Challenge not found");

    let prog_key = ("chal_prog", challenge_id, participant.clone());
    let mut progress: ChallengeProgress = env
        .storage()
        .instance()
        .get(&prog_key)
        .expect("Not joined this challenge");

    if progress.completed {
        panic!("Challenge already completed");
    }
    if progress.weight_processed < challenge.target_weight {
        panic!("Target not yet reached");
    }

    progress.completed = true;
    env.storage().instance().set(&prog_key, &progress);
    crate::ScavengerContract::complete_challenge_internal(&env, challenge_id, &participant, &challenge);
}

/// Get all currently active challenges.
pub(crate) fn get_active_challenges(env: Env) -> Vec<Challenge> {
    let total: u64 = env.storage().instance().get(&CHALLENGE_COUNT).unwrap_or(0);
    let now = env.ledger().timestamp();
    let mut result = Vec::new(&env);
    for id in 1..=total {
        if let Some(c) = env.storage().instance().get::<_, Challenge>(&("challenge", id)) {
            if c.status == ChallengeStatus::Active && now < c.end_time && now >= c.start_time {
                result.push_back(c);
            }
        }
    }
    result
}

/// Get a challenge by ID.
pub(crate) fn get_challenge(env: Env, challenge_id: u64) -> Option<Challenge> {
    env.storage().instance().get(&("challenge", challenge_id))
}

/// Get the predefined milestones list.
pub(crate) fn get_milestones(env: Env) -> Vec<Milestone> {
    let titles = [
        symbol_short!("100kg"),
        symbol_short!("500kg"),
        symbol_short!("1000kg"),
        symbol_short!("5000kg"),
        symbol_short!("10000kg"),
        symbol_short!("50000kg"),
        symbol_short!("100000kg"),
    ];
    let mut result = Vec::new(&env);
    for (i, &threshold) in MILESTONE_THRESHOLDS.iter().enumerate() {
        result.push_back(Milestone {
            threshold,
            title: titles[i].clone(),
            bonus_pct: 10,
        });
    }
    result
}

/// Get the milestone indices already achieved by a participant.
pub(crate) fn get_participant_milestones(env: Env, participant: Address) -> Vec<u32> {
    env.storage()
        .instance()
        .get(&("milestones", participant))
        .unwrap_or(Vec::new(&env))
}

/// Get top N participants by total waste processed (recyclers).
pub(crate) fn get_top_recyclers(env: Env, limit: u32) -> Vec<LeaderboardEntry> {
    let limit = limit.min(100) as usize;
    let index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));

    let mut entries: Vec<(u128, Address)> = Vec::new(&env);
    for addr in index.iter() {
        let key = (addr.clone(),);
        if let Some(p) = env.storage().instance().get::<_, Participant>(&key) {
            if p.is_registered && p.role == ParticipantRole::Recycler {
                entries.push_back((p.total_waste_processed, addr));
            }
        }
    }

    crate::ScavengerContract::sort_and_rank(&env, entries, limit)
}

/// Get top N participants by number of waste items collected (collectors).
pub(crate) fn get_top_collectors(env: Env, limit: u32) -> Vec<LeaderboardEntry> {
    let limit = limit.min(100) as usize;
    let index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));

    let mut entries: Vec<(u128, Address)> = Vec::new(&env);
    for addr in index.iter() {
        let key = (addr.clone(),);
        if let Some(p) = env.storage().instance().get::<_, Participant>(&key) {
            if p.is_registered && p.role == ParticipantRole::Collector {
                entries.push_back((p.total_waste_processed, addr));
            }
        }
    }

    crate::ScavengerContract::sort_and_rank(&env, entries, limit)
}

/// Get top N participants by verified submissions (verifiers = recyclers with most verifications).
pub(crate) fn get_top_verifiers(env: Env, limit: u32) -> Vec<LeaderboardEntry> {
    let limit = limit.min(100) as usize;
    let index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));

    let mut entries: Vec<(u128, Address)> = Vec::new(&env);
    for addr in index.iter() {
        let stats_key = ("stats", addr.clone());
        if let Some(stats) = env.storage().instance().get::<_, RecyclingStats>(&stats_key) {
            entries.push_back((stats.verified_submissions as u128, addr));
        }
    }

    crate::ScavengerContract::sort_and_rank(&env, entries, limit)
}

/// Get top N participants by total tokens earned.
pub(crate) fn get_top_earners(env: Env, limit: u32) -> Vec<LeaderboardEntry> {
    let limit = limit.min(100) as usize;
    let index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));

    let mut entries: Vec<(u128, Address)> = Vec::new(&env);
    for addr in index.iter() {
        let key = (addr.clone(),);
        if let Some(p) = env.storage().instance().get::<_, Participant>(&key) {
            if p.is_registered {
                entries.push_back((p.total_tokens_earned, addr));
            }
        }
    }

    crate::ScavengerContract::sort_and_rank(&env, entries, limit)
}

/// Get a participant's rank by a given metric: "weight", "tokens", "verified".
pub(crate) fn get_participant_rank(env: Env, participant: Address, metric: soroban_sdk::Symbol) -> u32 {
    let index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));

    let weight_sym = symbol_short!("weight");
    let tokens_sym = symbol_short!("tokens");
    let verified_sym = symbol_short!("verified");

    let get_score = |addr: &Address| -> u128 {
        if metric == weight_sym {
            let key = (addr.clone(),);
            env.storage()
                .instance()
                .get::<_, Participant>(&key)
                .map(|p| p.total_waste_processed)
                .unwrap_or(0)
        } else if metric == tokens_sym {
            let key = (addr.clone(),);
            env.storage()
                .instance()
                .get::<_, Participant>(&key)
                .map(|p| p.total_tokens_earned)
                .unwrap_or(0)
        } else if metric == verified_sym {
            let stats_key = ("stats", addr.clone());
            env.storage()
                .instance()
                .get::<_, RecyclingStats>(&stats_key)
                .map(|s| s.verified_submissions as u128)
                .unwrap_or(0)
        } else {
            0
        }
    };

    let my_score = get_score(&participant);
    let mut rank = 1u32;
    for addr in index.iter() {
        if addr == participant {
            continue;
        }
        if get_score(&addr) > my_score {
            rank += 1;
        }
    }
    rank
}

/// Set a recycling goal for the caller.
///
/// Maximum 5 active goals per participant.
/// Goal duration must be between 1 and 12 months from now (approx 30–365 days).
///
/// # Errors
/// - [`Error::NotRegistered`] if caller is not registered.
/// - [`Error::InvalidAmount`] if target_weight is 0, too many goals, or invalid duration.
pub(crate) fn set_recycling_goal(
    env: Env,
    participant: Address,
    target_weight: u128,
    target_date: u64,
    waste_type: OptionalWasteType,
) -> Result<(), Error> {
    participant.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    if super::participant::get_participant(env.clone(), participant.clone()).is_none() {
        return Err(Error::NotRegistered);
    }

    if target_weight == 0 {
        return Err(Error::InvalidAmount);
    }

    let now = env.ledger().timestamp();
    let one_month_secs: u64 = 30 * 24 * 60 * 60;
    let twelve_months_secs: u64 = 365 * 24 * 60 * 60;

    if target_date < now + one_month_secs || target_date > now + twelve_months_secs {
        return Err(Error::InvalidAmount);
    }

    let goals_key = ("goals", participant.clone());
    let mut goals: Vec<types::RecyclingGoal> = env.storage().instance().get(&goals_key).unwrap_or(Vec::new(&env));

    // Count active (non-achieved) goals
    let mut active_count: u32 = 0;
    for goal in goals.iter() {
        if !goal.achieved {
            active_count += 1;
        }
    }
    if active_count >= 5 {
        return Err(Error::InvalidAmount);
    }

    let goal = types::RecyclingGoal {
        target_weight,
        target_date,
        waste_type,
        current_weight: 0,
        achieved: false,
        created_at: now,
    };

    goals.push_back(goal);
    env.storage().instance().set(&goals_key, &goals);

    env.events().publish(
        (symbol_short!("goal_set"), participant.clone()),
        (target_weight, target_date),
    );

    Ok(())
}

/// Get the recycling goals and progress for a participant.
pub(crate) fn get_goal_progress(env: Env, participant: Address) -> Vec<types::RecyclingGoal> {
    env.storage()
        .instance()
        .get(&("goals", participant))
        .unwrap_or(Vec::new(&env))
}

/// Get all participants who have at least one achieved goal.
pub(crate) fn get_participants_meeting_goals(env: Env) -> Vec<Address> {
    let index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));
    let mut result = Vec::new(&env);
    for addr in index.iter() {
        let goals: Vec<types::RecyclingGoal> = env
            .storage()
            .instance()
            .get(&("goals", addr.clone()))
            .unwrap_or(Vec::new(&env));
        let mut has_achieved = false;
        for goal in goals.iter() {
            if goal.achieved {
                has_achieved = true;
                break;
            }
        }
        if has_achieved {
            result.push_back(addr);
        }
    }
    result
}

/// Get the reputation badge tier for a participant based on their score.
pub(crate) fn get_reputation_badge(env: Env, address: Address) -> ReputationBadge {
    let key = (address,);
    let score = env
        .storage()
        .instance()
        .get::<_, Participant>(&key)
        .map(|p| p.reputation_score)
        .unwrap_or(0);
    ReputationBadge::from_score(score)
}

/// Penalize a participant's reputation by a negative delta (admin only).
///
/// `delta` must be strictly negative. The resulting score is clamped to
/// `[REP_MIN, REP_MAX]`.
///
/// # Panics
/// - `"Delta must be negative for a penalty"` if `delta >= 0`.
/// - Admin panic if caller is not an admin.
/// - `"Participant not found"` if the participant does not exist.
pub(crate) fn penalize_reputation(env: Env, admin: Address, target: Address, delta: i128) {
    crate::ScavengerContract::require_admin(&env, &admin);
    if delta >= 0 {
        panic!("Delta must be negative for a penalty");
    }
    let key = (target.clone(),);
    let mut p: Participant = env.storage().instance().get(&key).expect("Participant not found");
    p.reputation_score = (p.reputation_score + delta).max(REP_MIN).min(REP_MAX);
    env.storage().instance().set(&key, &p);

    env.events()
        .publish((symbol_short!("rep_pen"), target), (admin, delta, p.reputation_score));
}

/// Apply reputation decay for a participant if they have been inactive
/// beyond [`DECAY_WINDOW_SECS`]. Only decays positive scores; never drives
/// the score below 0 via decay.
pub(crate) fn decay_reputation(env: Env, address: Address) -> i128 {
    let key = (address.clone(),);
    let mut p: Participant = match env.storage().instance().get(&key) {
        Some(p) => p,
        None => return 0,
    };

    let now = env.ledger().timestamp();
    let elapsed = now.saturating_sub(p.last_active_at);
    if elapsed <= DECAY_WINDOW_SECS || p.reputation_score <= 0 {
        return p.reputation_score;
    }

    let days_inactive = ((elapsed - DECAY_WINDOW_SECS) / 86_400) as i128;
    if days_inactive == 0 {
        return p.reputation_score;
    }

    let decay = days_inactive * DECAY_PER_DAY;
    let new_score = (p.reputation_score - decay).max(0);
    p.reputation_score = new_score;
    p.last_active_at = now;
    env.storage().instance().set(&key, &p);

    env.events()
        .publish((symbol_short!("rep_dcy"), address), (decay, new_score));

    new_score
}

/// Return all participants whose reputation score is at least `min_score`.
pub(crate) fn get_participants_by_reputation(env: Env, min_score: i128) -> Vec<Address> {
    let index: Vec<Address> = env.storage().instance().get(&PART_INDEX).unwrap_or(Vec::new(&env));
    let mut result = Vec::new(&env);
    for addr in index.iter() {
        if let Some(p) = env.storage().instance().get::<_, Participant>(&(addr.clone(),)) {
            if p.reputation_score >= min_score {
                result.push_back(addr);
            }
        }
    }
    result
}

/// Create a new collection route for a collector with the given waste IDs.
///
/// # Panics
/// - `"Only collectors can create routes"` if `collector`'s role is not Collector.
/// - `"Route must contain at least one waste item"` if `waste_ids` is empty.
/// - `"Route cannot exceed 50 waste items"` if length > 50.
/// - `"Waste not found or inactive"` for any unknown / inactive ID.
pub(crate) fn create_collection_route(env: Env, collector: Address, waste_ids: Vec<u128>) -> CollectionRoute {
    crate::ScavengerContract::require_not_paused(&env);
    collector.require_auth();

    let p: Participant = env
        .storage()
        .instance()
        .get(&(collector.clone(),))
        .expect("Collector not registered");
    if p.role != ParticipantRole::Collector {
        panic!("Only collectors can create routes");
    }

    if waste_ids.is_empty() {
        panic!("Route must contain at least one waste item");
    }
    if waste_ids.len() > 50 {
        panic!("Route cannot exceed 50 waste items");
    }

    // Validate each waste exists and is active
    for id in waste_ids.iter() {
        let w: types::Waste = match env.storage().instance().get(&("waste_v2", id)) {
            Some(w) => w,
            None => panic!("Waste not found or inactive"),
        };
        if !w.is_active {
            panic!("Waste not found or inactive");
        }
    }

    let id: u64 = env.storage().instance().get(&ROUTE_CNT).unwrap_or(0u64) + 1;
    env.storage().instance().set(&ROUTE_CNT, &id);

    let route = CollectionRoute {
        id,
        collector: collector.clone(),
        waste_ids,
        status: RouteStatus::Pending,
        created_at: env.ledger().timestamp(),
    };
    env.storage().instance().set(&("route", id), &route);

    env.events()
        .publish((symbol_short!("rt_new"), id), (collector, route.created_at));

    route
}

/// Mark a route as completed. Only the assigned collector can complete.
///
/// # Panics
/// - `"Route not found"`.
/// - `"Only the assigned collector can complete this route"`.
/// - `"Route is not pending"`.
pub(crate) fn complete_route(env: Env, collector: Address, route_id: u64) -> CollectionRoute {
    crate::ScavengerContract::require_not_paused(&env);
    collector.require_auth();

    let mut route: CollectionRoute = env
        .storage()
        .instance()
        .get(&("route", route_id))
        .expect("Route not found");

    if route.collector != collector {
        panic!("Only the assigned collector can complete this route");
    }
    if route.status != RouteStatus::Pending {
        panic!("Route is not pending");
    }

    route.status = RouteStatus::Completed;
    env.storage().instance().set(&("route", route_id), &route);

    env.events().publish(
        (symbol_short!("rt_done"), route_id),
        (collector, env.ledger().timestamp()),
    );

    route.clone()
}

/// Retrieve a route by ID.
pub(crate) fn get_route(env: Env, route_id: u64) -> Option<CollectionRoute> {
    env.storage().instance().get(&("route", route_id))
}

/// Return v2 waste IDs whose recorded coordinates are within `radius_km`
/// of the given (`lat`, `lon`) point. Coordinates are in microdegrees.
///
/// Distance is approximated using a flat-earth model with ~111 km per
/// degree (≈ 8983 microdegrees per km). Good enough for short ranges and
/// route-planning queries.
pub(crate) fn get_wastes_in_radius(env: Env, lat: i128, lon: i128, radius_km: u32) -> Vec<u128> {
    let count: u64 = env.storage().instance().get(&("waste_count",)).unwrap_or(0);

    // ~8983 microdegrees per km. Square the threshold to compare in microdegrees².
    let threshold_microdeg: i128 = (radius_km as i128) * 8983;
    let threshold_sq: i128 = threshold_microdeg * threshold_microdeg;

    let mut result = Vec::new(&env);
    for id in 1u128..=(count as u128) {
        if let Some(w) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", id)) {
            if !w.is_active {
                continue;
            }
            let dlat = w.latitude - lat;
            let dlon = w.longitude - lon;
            let dist_sq = dlat.saturating_mul(dlat).saturating_add(dlon.saturating_mul(dlon));
            if dist_sq <= threshold_sq {
                result.push_back(id);
            }
        }
    }
    result
}
