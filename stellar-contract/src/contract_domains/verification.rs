use super::super::*;

/// Verify a submitted material and distribute token rewards.
///
/// Marks the material as verified, calculates reward points based on weight
/// and waste type, then distributes shares to collectors, the current owner,
/// and the recycler remainder via `_reward_tokens`.
///
/// # Parameters
/// - `material_id`: ID of the v1 material to verify.
/// - `verifier`: Registered `Recycler`. Must sign.
///
/// # Returns
/// The updated [`Material`] with `verified = true`.
///
/// # Errors
/// - Panics `"Verifier not registered"` / `"Verifier is not registered"`.
/// - Panics `"Only recyclers can verify materials"`.
/// - Panics `"Material not found"`.
pub(crate) fn verify_material(env: Env, material_id: u64, verifier: Address) -> Material {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    verifier.require_auth();

    // Check if verifier is a recycler and is registered
    let verifier_key = (verifier.clone(),);
    let participant: Participant = env
        .storage()
        .instance()
        .get(&verifier_key)
        .expect("Verifier not registered");

    if !participant.is_registered {
        panic!("Verifier is not registered");
    }

    if !participant.role.can_process_recyclables() {
        panic!("Only recyclers can verify materials");
    }

    // Get and verify material using new storage system
    let mut material: Material =
        crate::ScavengerContract::get_waste_internal(&env, material_id).expect("Material not found");

    material.verify();
    crate::ScavengerContract::set_waste(&env, material_id, &material);

    // Calculate tokens earned, reduced by contamination if applicable
    let base_tokens = material.calculate_reward_points();
    let tokens_earned: u64 = {
        let v2: Option<types::Waste> = env.storage().instance().get(&("waste_v2", material_id as u128));
        match v2 {
            Some(w) if w.is_contaminated && w.contamination_level > 50 => 0,
            Some(w) if w.is_contaminated => base_tokens * (100 - w.contamination_level as u64) / 100,
            _ => base_tokens,
        }
    };

    // Update submitter stats
    let mut stats: RecyclingStats = env
        .storage()
        .instance()
        .get(&("stats", material.submitter.clone()))
        .unwrap_or_else(|| RecyclingStats::new(material.submitter.clone()));

    stats.record_verification(&material);
    env.storage()
        .instance()
        .set(&("stats", material.submitter.clone()), &stats);

    // Update global carbon credits counter
    let credits = types::calculate_carbon_credits(material.waste_type, material.weight as u128);
    let total_carbon: u128 = env.storage().instance().get(&TOTAL_CARBON).unwrap_or(0);
    env.storage().instance().set(&TOTAL_CARBON, &(total_carbon + credits));

    // Emit carbon credits earned event
    events::emit_carbon_credits_earned(
        &env,
        &material.submitter,
        material.waste_type,
        material.weight as u128,
        credits,
    );

    // Distribute token rewards using the helper which also emits TOKENS_REWARDED events
    crate::ScavengerContract::_reward_tokens(&env, material_id, tokens_earned as u128);

    // Reputation: reward submitter for verified waste, and verifier for vetting
    crate::ScavengerContract::apply_reputation(&env, &material.submitter, REP_VERIFY);
    crate::ScavengerContract::apply_reputation(&env, &verifier, REP_VERIFY);

    material
}

/// Verify multiple materials in a single transaction.
///
/// Skips any IDs that do not exist. For each verified material, reward
/// tokens are distributed and a `tokens_rewarded` event is emitted.
///
/// # Parameters
/// - `material_ids`: Vec of v1 material IDs to verify.
/// - `verifier`: Registered `Recycler`. Must sign.
///
/// # Returns
/// `Vec<Material>` containing only the materials that were found and verified.
///
/// # Errors
/// - Panics `"Verifier not registered"` / `"Only recyclers can verify materials"`.
pub(crate) fn verify_materials_batch(
    env: Env,
    material_ids: soroban_sdk::Vec<u64>,
    verifier: Address,
) -> soroban_sdk::Vec<Material> {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    verifier.require_auth();

    // Check if verifier is a recycler and is registered
    let verifier_key = (verifier.clone(),);
    let participant: Participant = env
        .storage()
        .instance()
        .get(&verifier_key)
        .expect("Verifier not registered");

    if !participant.is_registered {
        panic!("Verifier is not registered");
    }

    if !participant.role.can_process_recyclables() {
        panic!("Only recyclers can verify materials");
    }

    let mut results = soroban_sdk::Vec::new(&env);

    for material_id in material_ids.iter() {
        if let Some(mut material) = crate::ScavengerContract::get_waste_internal(&env, material_id) {
            material.verify();
            crate::ScavengerContract::set_waste(&env, material_id, &material);

            // Calculate tokens earned
            let tokens_earned = material.calculate_reward_points();

            // Update submitter stats
            let mut stats: RecyclingStats = env
                .storage()
                .instance()
                .get(&("stats", material.submitter.clone()))
                .unwrap_or_else(|| RecyclingStats::new(material.submitter.clone()));

            stats.record_verification(&material);
            env.storage()
                .instance()
                .set(&("stats", material.submitter.clone()), &stats);

            // Update global carbon credits counter
            let credits = types::calculate_carbon_credits(material.waste_type, material.weight as u128);
            let total_carbon: u128 = env.storage().instance().get(&TOTAL_CARBON).unwrap_or(0);
            env.storage().instance().set(&TOTAL_CARBON, &(total_carbon + credits));

            // Emit carbon credits earned event
            events::emit_carbon_credits_earned(
                &env,
                &material.submitter,
                material.waste_type,
                material.weight as u128,
                credits,
            );

            // Distribute token rewards using the helper which also emits TOKENS_REWARDED events
            crate::ScavengerContract::_reward_tokens(&env, material_id, tokens_earned as u128);

            results.push_back(material);
        }
    }

    results
}

/// Mark a v2 waste item as contaminated.
///
/// Only a registered Recycler (verifier) may call this.
/// Contamination level must be 0-100. Reason must not exceed 200 chars.
/// Emits a `WasteContaminated` event.
pub(crate) fn mark_contaminated(
    env: Env,
    waste_id: u128,
    verifier: Address,
    level: u32,
    reason: String,
) -> types::Waste {
    crate::ScavengerContract::require_not_paused(&env);
    verifier.require_auth();

    assert!(level <= 100, "Contamination level must be 0-100");
    assert!(reason.len() <= 200, "Reason exceeds 200 characters");

    let participant: Participant = env
        .storage()
        .instance()
        .get(&(verifier.clone(),))
        .expect("Verifier not registered");

    assert!(participant.is_registered, "Verifier is not registered");
    assert!(
        participant.role.can_process_recyclables(),
        "Only recyclers can mark contamination"
    );

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    waste.is_contaminated = true;
    waste.contamination_level = level;
    waste.contamination_reason = reason;

    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    // Append to contaminated list
    let mut list: Vec<u128> = env
        .storage()
        .instance()
        .get(&CONTAMINATED_LIST)
        .unwrap_or(Vec::new(&env));
    // Only add once
    if !list.contains(&waste_id) {
        list.push_back(waste_id);
        env.storage().instance().set(&CONTAMINATED_LIST, &list);
    }

    events::emit_waste_contaminated(&env, waste_id, &verifier, level);

    waste
}

/// Return all v2 waste IDs that have been marked as contaminated.
pub(crate) fn get_contaminated_wastes(env: Env) -> Vec<u128> {
    env.storage()
        .instance()
        .get(&CONTAMINATED_LIST)
        .unwrap_or(Vec::new(&env))
}

/// Compute an effective contamination score (0–100) for a v2 waste item.
///
/// The score equals the raw `contamination_level`, with a 10-point penalty
/// added for grade-D waste (poor quality), capped at 100.
/// Returns 0 when the waste has not been marked as contaminated.
///
/// # Errors
/// Panics if the waste ID does not exist.
pub(crate) fn get_contamination_score(env: Env, waste_id: u128) -> u32 {
    let waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    // ---- Checks ----
    let material = crate::ScavengerContract::get_waste_internal(&env, waste_id).expect("Material not found");
    assert!(material.verified, "Material must be confirmed");
    if !waste.is_contaminated {
        return 0;
    }

    let grade_penalty = if waste.grade == WasteGrade::D { 10u32 } else { 0u32 };
    waste.contamination_level.saturating_add(grade_penalty).min(100)
}

/// Submit a contamination report for a v2 waste item.
///
/// Any registered participant may report contamination. The report is stored
/// under the waste item's report list. When a waste accumulates 3 or more
/// reports, it is automatically marked as contaminated at the median reported
/// level and added to the global contaminated-waste list.
///
/// # Parameters
/// - `waste_id`: ID of the v2 waste to report.
/// - `reporter`: Address of the participant submitting the report. Must sign.
/// - `level`: Contamination level (0–100).
/// - `reason`: Human-readable reason (max 200 chars).
///
/// # Errors
/// - Panics if the waste does not exist.
/// - Panics if `level > 100`.
/// - Panics if `reporter` is not a registered participant.
pub(crate) fn report_contamination(
    env: Env,
    waste_id: u128,
    reporter: Address,
    level: u32,
    reason: String,
) -> types::ContaminationReport {
    reporter.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    let weight_kg = material.weight / 1000;
    let total_reward = (incentive.reward_points as i128)
        .checked_mul(weight_kg as i128)
        .expect("Overflow in total reward");
    assert!(
        total_reward <= (incentive.remaining_budget as i128),
        "Insufficient incentive budget"
    );

    let transfers = super::transfer::get_transfer_history(env.clone(), waste_id);
    let cfg = crate::ScavengerContract::get_reward_config(&env);
    let collector_pct = cfg.collector_percentage;
    let owner_pct = cfg.owner_percentage;
    assert!(level <= 100, "Contamination level must be 0-100");
    assert!(reason.len() <= 200, "Reason exceeds 200 characters");

    assert!(level <= 100, "Contamination level must be 0-100");
    assert!(reason.len() <= 200, "Reason exceeds 200 characters");

    // Reporter must be registered
    let _participant: Participant = env
        .storage()
        .instance()
        .get(&(reporter.clone(),))
        .expect("Reporter not registered");

    // Waste must exist
    let _waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    let report = types::ContaminationReport {
        waste_id,
        reporter: reporter.clone(),
        level,
        reason,
        reported_at: env.ledger().timestamp(),
    };

    // Append report to the list for this waste item
    let reports_key = ("contamination_reports", waste_id);
    let mut reports: Vec<types::ContaminationReport> =
        env.storage().instance().get(&reports_key).unwrap_or(Vec::new(&env));
    reports.push_back(report.clone());
    env.storage().instance().set(&reports_key, &reports);

    // Auto-mark contaminated when 3+ reports received (median level)
    if reports.len() >= 3 {
        let mut levels: Vec<u32> = Vec::new(&env);
        for r in reports.iter() {
            levels.push_back(r.level);
        }
        // Simple selection-sort (no std sort in no_std)
        let n = levels.len();
        for i in 0..n {
            let mut min_idx = i;
            for j in (i + 1)..n {
                if levels.get(j).unwrap() < levels.get(min_idx).unwrap() {
                    min_idx = j;
                }
            }
            if min_idx != i {
                let tmp = levels.get(i).unwrap();
                levels.set(i, levels.get(min_idx).unwrap());
                levels.set(min_idx, tmp);
            }
        }
        let median = levels.get(n / 2).unwrap();

        let mut waste: types::Waste = env.storage().instance().get(&("waste_v2", waste_id)).unwrap();
        if !waste.is_contaminated {
            waste.is_contaminated = true;
            waste.contamination_level = median;
            waste.contamination_reason = report.reason.clone();
            env.storage().instance().set(&("waste_v2", waste_id), &waste);

            let mut list: Vec<u128> = env
                .storage()
                .instance()
                .get(&CONTAMINATED_LIST)
                .unwrap_or(Vec::new(&env));
            if !list.contains(&waste_id) {
                list.push_back(waste_id);
                env.storage().instance().set(&CONTAMINATED_LIST, &list);
            }

            events::emit_waste_contaminated(&env, waste_id, &reporter, median);
        }
    }

    report
}

/// Return all contamination reports for a v2 waste item.
pub(crate) fn get_contamination_reports(env: Env, waste_id: u128) -> Vec<types::ContaminationReport> {
    env.storage()
        .instance()
        .get(&("contamination_reports", waste_id))
        .unwrap_or(Vec::new(&env))
}

/// Batch-verify multiple materials in a single call.
/// Alias for [`verify_materials_batch`] with the name from issue #548.
pub(crate) fn batch_verify_materials(
    env: Env,
    material_ids: soroban_sdk::Vec<u64>,
    verifier: Address,
) -> soroban_sdk::Vec<Material> {
    super::verification::verify_materials_batch(env, material_ids, verifier)
}

/// Assign a quality grade to a v2 waste item.
/// Only registered `Collector` or `Manufacturer` participants may grade.
pub(crate) fn set_waste_grade(env: Env, waste_id: u128, grade: WasteGrade, grader: Address) -> types::Waste {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    grader.require_auth();
    crate::ScavengerContract::require_registered(&env, &grader);

    let grader_key = (grader.clone(),);
    let grader_participant: Participant = env
        .storage()
        .instance()
        .get(&grader_key)
        .expect("Caller is not a registered participant");

    if grader_participant.role == ParticipantRole::Recycler {
        panic!("Only collectors or manufacturers can grade waste");
    }

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    if !waste.is_active {
        panic!("Waste is deactivated");
    }

    waste.grade = grade;
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    let history_key = ("grade_history", waste_id);
    let mut history: Vec<types::GradeRecord> = env.storage().instance().get(&history_key).unwrap_or(Vec::new(&env));
    history.push_back(types::GradeRecord {
        waste_id,
        grade,
        grader: grader.clone(),
        graded_at: env.ledger().timestamp(),
    });
    env.storage().instance().set(&history_key, &history);

    let stats_key = ("stats", grader.clone());
    let mut stats: RecyclingStats = env
        .storage()
        .instance()
        .get(&stats_key)
        .unwrap_or_else(|| RecyclingStats::new(grader.clone()));
    stats.record_grade(grade);
    env.storage().instance().set(&stats_key, &stats);

    events::emit_waste_graded(&env, waste_id, grade, &grader);

    waste
}

/// Get the full grade history for a waste item.
pub(crate) fn get_grade_history(env: Env, waste_id: u128) -> Vec<types::GradeRecord> {
    env.storage()
        .instance()
        .get(&("grade_history", waste_id))
        .unwrap_or(Vec::new(&env))
}

/// Get all active v2 waste IDs with a specific grade.
pub(crate) fn get_wastes_by_grade(env: Env, grade: WasteGrade) -> Vec<u128> {
    let mut result = Vec::new(&env);
    let count = crate::ScavengerContract::get_waste_count(&env);
    for waste_id in 1..=count {
        if let Some(waste) = env
            .storage()
            .instance()
            .get::<_, types::Waste>(&("waste_v2", waste_id as u128))
        {
            if waste.is_active && waste.grade == grade {
                result.push_back(waste_id as u128);
            }
        }
    }
    result
}

/// Apply the grade multiplier to a base reward: `base * grade.multiplier_pct() / 100`.
pub(crate) fn apply_grade_multiplier(base_reward: u64, grade: WasteGrade) -> u64 {
    base_reward * grade.multiplier_pct() / 100
}

/// Simulate AI verification of a waste grade.
/// Returns the AI-suggested grade and a confidence score (0-100).
/// This stores the AI verification metadata alongside the grade.
pub(crate) fn set_waste_grade_ai_verified(
    env: Env,
    waste_id: u128,
    grade: WasteGrade,
    grader: Address,
    ai_confidence: u32,
) -> Result<types::Waste, Error> {
    let result = super::verification::set_waste_grade(env.clone(), waste_id, grade, grader);
    let confidence = ai_confidence.min(100);
    env.storage().instance().set(&("ai_grade_conf", waste_id), &confidence);
    Ok(result)
}

/// Get the AI verification confidence for a waste grade (0-100).
pub(crate) fn get_ai_grade_confidence(env: Env, waste_id: u128) -> Option<u32> {
    env.storage().instance().get(&("ai_grade_conf", waste_id))
}

/// Verify that a waste item has a valid material composition set.
/// Returns true if composition entries sum to 100.
pub(crate) fn verify_waste_composition(env: Env, waste_id: u128) -> Result<bool, Error> {
    let waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    if waste.composition.is_empty() {
        return Ok(false);
    }

    let mut total: u32 = 0;
    for entry in waste.composition.iter() {
        total = total.saturating_add(entry.percentage);
    }

    Ok(total == 100)
}

/// Open a dispute against a waste item.
///
/// The disputer must be a registered participant. The waste is frozen
/// (cannot be transferred) until an admin calls [`resolve_dispute`].
///
/// # Panics
/// - `"Waste not found"` if the waste does not exist.
/// - `"Reason exceeds 500 characters"` if the reason is too long.
/// - `"Waste already has an open dispute"` if the waste is already frozen.
pub(crate) fn create_dispute(env: Env, disputer: Address, waste_id: u128, reason: String) -> Dispute {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_registered(&env, &disputer);

    if reason.len() > 500 {
        panic!("Reason exceeds 500 characters");
    }

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .expect("Waste not found");

    if waste.is_frozen {
        panic!("Waste already has an open dispute");
    }

    let id: u64 = env.storage().instance().get(&DISPUTE_CNT).unwrap_or(0u64) + 1;
    env.storage().instance().set(&DISPUTE_CNT, &id);

    let dispute = Dispute {
        id,
        waste_id,
        disputer: disputer.clone(),
        reason,
        status: DisputeStatus::Pending,
        created_at: env.ledger().timestamp(),
        resolved_at: 0,
        resolution_note: String::from_str(&env, ""),
    };
    env.storage().instance().set(&("dispute", id), &dispute);

    // Freeze waste to block transfers until resolution
    waste.is_frozen = true;
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    env.events().publish(
        (symbol_short!("disp_new"), id),
        (waste_id, disputer, dispute.created_at),
    );

    dispute
}

/// Resolve a pending dispute (admin only).
///
/// `accepted = true` marks the dispute `Resolved`; `false` marks it `Rejected`.
/// In either case, the underlying waste is unfrozen so transfers can proceed.
///
/// # Panics
/// - `"Dispute not found"`.
/// - `"Dispute is not pending"` if the dispute was already resolved.
/// - Admin panic if caller is not an admin.
pub(crate) fn resolve_dispute(env: Env, admin: Address, dispute_id: u64, accepted: bool, note: String) -> Dispute {
    crate::ScavengerContract::require_admin(&env, &admin);

    let mut dispute: Dispute = env
        .storage()
        .instance()
        .get(&("dispute", dispute_id))
        .expect("Dispute not found");

    if dispute.status != DisputeStatus::Pending {
        panic!("Dispute is not pending");
    }

    dispute.status = if accepted {
        DisputeStatus::Resolved
    } else {
        DisputeStatus::Rejected
    };
    dispute.resolved_at = env.ledger().timestamp();
    dispute.resolution_note = note;
    env.storage().instance().set(&("dispute", dispute_id), &dispute);

    // Unfreeze the waste regardless of outcome
    if let Some(mut waste) = env
        .storage()
        .instance()
        .get::<_, types::Waste>(&("waste_v2", dispute.waste_id))
    {
        waste.is_frozen = false;
        env.storage().instance().set(&("waste_v2", dispute.waste_id), &waste);
    }

    env.events().publish(
        (symbol_short!("disp_res"), dispute_id),
        (admin, accepted, dispute.resolved_at),
    );

    dispute
}

/// Get a dispute by ID.
pub(crate) fn get_dispute(env: Env, dispute_id: u64) -> Option<Dispute> {
    env.storage().instance().get(&("dispute", dispute_id))
}

/// List all disputes with the given status.
pub(crate) fn get_disputes(env: Env, status: DisputeStatus) -> Vec<Dispute> {
    let count: u64 = env.storage().instance().get(&DISPUTE_CNT).unwrap_or(0);
    let mut result = Vec::new(&env);
    for id in 1..=count {
        if let Some(d) = env.storage().instance().get::<_, Dispute>(&("dispute", id)) {
            if d.status == status {
                result.push_back(d);
            }
        }
    }
    result
}

/// Calculate and store quality score for a waste item
pub(crate) fn calculate_quality_score(env: Env, waste_id: u128, scorer: Address) -> Result<QualityScore, Error> {
    scorer.require_auth();

    // Get waste item
    let waste: Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    // Calculate score based on waste properties (0-100)
    let mut score: u32 = 50; // Base score

    // Add points for grade
    score += match waste.grade {
        WasteGrade::A => 40,
        WasteGrade::B => 25,
        WasteGrade::C => 10,
        WasteGrade::D => 0,
    };

    // Subtract points for contamination
    if waste.is_contaminated {
        score = score.saturating_sub(waste.contamination_level as u32);
    }

    // Cap at 100
    score = score.min(100);

    let quality_score = QualityScore::new(score, env.ledger().timestamp(), scorer);

    // Store quality score
    env.storage()
        .instance()
        .set(&(QUALITY_SCORES, waste_id), &quality_score);

    Ok(quality_score)
}

/// Get quality score for a waste item
pub(crate) fn get_quality_score(env: Env, waste_id: u128) -> Option<QualityScore> {
    env.storage().instance().get(&(QUALITY_SCORES, waste_id))
}

/// Get quality-based waste filtering (returns waste IDs with score >= min_score)
pub(crate) fn get_wastes_by_quality(env: Env, min_score: u32) -> Vec<u128> {
    let count: u64 = env.storage().instance().get(&("waste_count",)).unwrap_or(0);

    let mut result = Vec::new(&env);
    for id in 1u128..=(count as u128) {
        if let Some(score) = env.storage().instance().get::<_, QualityScore>(&(QUALITY_SCORES, id)) {
            if score.score >= min_score {
                result.push_back(id);
            }
        }
    }
    result
}

/// Certify a waste item
pub(crate) fn certify_waste(
    env: Env,
    waste_id: u128,
    level: u32,
    certifier: Address,
    expires_at: u64,
    notes: String,
) -> Result<(), Error> {
    certifier.require_auth();

    // Validate waste exists
    let _waste: Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    // Validate certification level
    let cert_level = CertificationLevel::from_u32(level).ok_or(Error::InvalidAmount)?;

    let certification = WasteCertification::new(
        waste_id,
        cert_level,
        certifier,
        env.ledger().timestamp(),
        expires_at,
        notes,
    );

    env.storage()
        .instance()
        .set(&(CERTIFICATIONS, waste_id), &certification);

    Ok(())
}

/// Get waste certification
pub(crate) fn get_waste_certification(env: Env, waste_id: u128) -> Option<WasteCertification> {
    env.storage().instance().get(&(CERTIFICATIONS, waste_id))
}

/// Check if waste is certified and valid
pub(crate) fn is_waste_certified(env: Env, waste_id: u128) -> bool {
    if let Some(cert) = env
        .storage()
        .instance()
        .get::<_, WasteCertification>(&(CERTIFICATIONS, waste_id))
    {
        cert.is_valid(env.ledger().timestamp())
    } else {
        false
    }
}

/// Reconcile discrepancies between a waste item's recorded weight and its
/// actual/verified weight.
///
/// Reconciliation rules:
/// - The waste must exist, be active, and have a non-zero `verified_weight`.
/// - If `verified_weight == weight`, there is nothing to reconcile
///   ([`Error::NoDiscrepancy`]).
/// - The absolute discrepancy must be ≤ 10 % of the original weight;
///   larger deviations are rejected ([`Error::ReconciliationThresholdExceeded`]).
/// - The weight is adjusted to `verified_weight` and an audit record is stored.
/// - A `reconcil` event is emitted.
///
/// Caller must be the contract admin or hold the `Auditor` permission.
///
/// # Errors
/// - [`Error::WasteNotFound`] if no waste exists for `waste_id`.
/// - [`Error::WasteDeactivated`] if the waste is already deactivated.
/// - [`Error::Unauthorized`] if caller lacks admin or Auditor permission.
/// - [`Error::NoDiscrepancy`] if recorded weight equals verified weight.
/// - [`Error::ReconciliationThresholdExceeded`] if discrepancy > 10 %.
pub(crate) fn reconcile_waste(
    env: Env,
    waste_id: u128,
    verified_weight: u128,
    reconciler: Address,
    reason: String,
) -> Result<ReconciliationRecord, Error> {
    storage_utils::bump_instance(&env);
    reconciler.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    // Caller must be admin OR have Auditor permission
    let is_admin = env
        .storage()
        .instance()
        .get::<_, Vec<Address>>(&ADMINS)
        .map(|admins| admins.contains(&reconciler))
        .unwrap_or(false);

    let has_auditor: bool = env
        .storage()
        .instance()
        .get(&(PERMISSIONS, reconciler.clone(), 1u32))
        .unwrap_or(false);

    if !is_admin && !has_auditor {
        return Err(Error::Unauthorized);
    }

    // Load waste
    let mut waste: Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    if !waste.is_active {
        return Err(Error::WasteDeactivated);
    }

    let original_weight = waste.weight;

    // Nothing to reconcile
    if original_weight == verified_weight {
        return Err(Error::NoDiscrepancy);
    }

    // Threshold check: discrepancy must be ≤ 10 % of original
    let diff = if verified_weight > original_weight {
        verified_weight - original_weight
    } else {
        original_weight - verified_weight
    };

    // diff / original_weight > 0.10  ⟺  diff * 10 > original_weight
    if diff.checked_mul(10).ok_or(Error::Overflow)? > original_weight {
        return Err(Error::ReconciliationThresholdExceeded);
    }

    // Apply adjustment
    waste.weight = verified_weight;
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    let record = ReconciliationRecord {
        waste_id,
        original_weight,
        reported_weight: verified_weight,
        adjusted_weight: verified_weight,
        reconciled_by: reconciler.clone(),
        timestamp: env.ledger().timestamp(),
        reason,
    };

    // Append to audit log
    let mut log: Vec<ReconciliationRecord> = env
        .storage()
        .instance()
        .get(&(RECONCIL_LOG, waste_id))
        .unwrap_or(Vec::new(&env));
    log.push_back(record.clone());
    env.storage().instance().set(&(RECONCIL_LOG, waste_id), &log);

    events::emit_waste_reconciled(&env, waste_id, original_weight, verified_weight, &reconciler);

    Ok(record)
}

/// Retrieve the reconciliation audit log for a waste item.
pub(crate) fn get_reconciliation_log(env: Env, waste_id: u128) -> Vec<ReconciliationRecord> {
    env.storage()
        .instance()
        .get(&(RECONCIL_LOG, waste_id))
        .unwrap_or(Vec::new(&env))
}
