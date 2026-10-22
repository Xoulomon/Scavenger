use super::super::*;

/// Get all active waste items and return their lifecycle state summary.
/// Returns (total_active, total_expired_or_inactive).
pub(crate) fn get_lifecycle_summary(env: Env) -> (u64, u64) {
    let now = env.ledger().timestamp();
    let total = crate::ScavengerContract::get_waste_count(&env);
    let mut active: u64 = 0;
    let mut inactive: u64 = 0;
    for id in 1..=total {
        let waste_id = id as u128;
        if let Some(waste) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", waste_id)) {
            if waste.is_active && !waste.is_expired(now) {
                active += 1;
            } else {
                inactive += 1;
            }
        }
    }
    (active, inactive)
}

/// Get recycling statistics for a participant.
///
/// # Returns
/// `Some(RecyclingStats)` if the participant has submitted or verified
/// at least one material, `None` otherwise.
pub(crate) fn get_stats(env: Env, participant: Address) -> Option<RecyclingStats> {
    env.storage().instance().get(&("stats", participant))
}

/// Calculate carbon credits for a given waste type and weight in grams.
/// Returns grams of CO2 equivalent.
pub(crate) fn calculate_carbon_credits(waste_type: WasteType, weight_grams: u128) -> u128 {
    types::calculate_carbon_credits(waste_type, weight_grams)
}

/// Get total carbon credits earned across all participants.
pub(crate) fn get_total_carbon_credits(env: Env) -> u128 {
    env.storage().instance().get(&TOTAL_CARBON).unwrap_or(0)
}

/// Get carbon credits earned by a specific participant.
pub(crate) fn get_participant_carbon_credits(env: Env, participant: Address) -> u128 {
    let stats: Option<RecyclingStats> = env.storage().instance().get(&("stats", participant));
    stats.map(|s| s.carbon_credits_earned).unwrap_or(0)
}

/// Get global supply-chain statistics.
///
/// # Returns
/// A tuple `(total_waste_count, total_active_weight_grams, total_tokens_earned)`.
///
/// > **Note:** `total_active_weight_grams` iterates all v2 waste records and
/// > may be expensive for large datasets.
pub(crate) fn get_supply_chain_stats(env: Env) -> (u64, u64, u128) {
    let total_wastes = crate::ScavengerContract::get_waste_count(&env);
    let total_weight = crate::ScavengerContract::get_total_active_waste_weight(&env);
    let total_tokens = crate::ScavengerContract::get_total_tokens(&env);

    (total_wastes, total_weight, total_tokens)
}

/// Get aggregated grading analytics across all participants.
/// Returns (grade_a, grade_b, grade_c, grade_d) counts.
pub(crate) fn get_grading_analytics(env: Env) -> (u64, u64, u64, u64) {
    let mut a: u64 = 0;
    let mut b: u64 = 0;
    let mut c: u64 = 0;
    let mut d: u64 = 0;
    let total = crate::ScavengerContract::get_waste_count(&env);
    for id in 1..=total {
        let waste_id = id as u128;
        if let Some(w) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", waste_id)) {
            match w.grade {
                WasteGrade::A => a += 1,
                WasteGrade::B => b += 1,
                WasteGrade::C => c += 1,
                WasteGrade::D => d += 1,
            }
        }
    }
    (a, b, c, d)
}

/// Get global contract metrics (total waste count and total tokens earned)
pub(crate) fn get_metrics(env: Env) -> types::GlobalMetrics {
    let total_wastes_count: u64 = env.storage().instance().get(&symbol_short!("MAT_CNT")).unwrap_or(0);
    let total_tokens_earned: u128 = env.storage().instance().get(&TOTAL_TOKENS).unwrap_or(0);
    let total_carbon_credits: u128 = env.storage().instance().get(&TOTAL_CARBON).unwrap_or(0);
    let (active, expired) = super::analytics::get_lifecycle_summary(env.clone());
    let (a, b, c, d) = super::analytics::get_grading_analytics(env.clone());
    types::GlobalMetrics {
        total_wastes_count,
        total_tokens_earned,
        total_carbon_credits,
        grade_a_count: a,
        grade_b_count: b,
        grade_c_count: c,
        grade_d_count: d,
        expired_waste_count: expired,
        active_waste_count: active,
    }
}

/// Get current transaction statistics for the contract.
pub(crate) fn get_transaction_stats(env: Env) -> TransactionStats {
    env.storage()
        .instance()
        .get(&TRANSACTION_STATS)
        .unwrap_or(TransactionStats {
            total_transactions: 0,
            successful_transactions: 0,
            failed_transactions: 0,
            average_gas_usage: 0,
            last_transaction_timestamp: 0,
        })
}

/// Record a performance metric (internal helper or admin-only).
pub(crate) fn record_performance_metric(env: Env, admin: Address, gas_used: u64, is_success: bool) {
    crate::ScavengerContract::only_admin(&env, &admin);

    let mut stats = super::analytics::get_transaction_stats(env.clone());
    stats.total_transactions += 1;
    if is_success {
        stats.successful_transactions += 1;
    } else {
        stats.failed_transactions += 1;
    }

    // Rolling average for gas usage
    if stats.successful_transactions > 0 {
        stats.average_gas_usage =
            (stats.average_gas_usage * (stats.successful_transactions - 1) + gas_used) / stats.successful_transactions;
    }

    stats.last_transaction_timestamp = env.ledger().timestamp();
    env.storage().instance().set(&TRANSACTION_STATS, &stats);
}

/// Take a performance snapshot.
pub(crate) fn take_performance_snapshot(
    env: Env,
    admin: Address,
    active_users: u32,
    waste_per_hour: u128,
    latency_ms: u32,
) {
    crate::ScavengerContract::only_admin(&env, &admin);

    let snapshot = PerformanceSnapshot {
        timestamp: env.ledger().timestamp(),
        active_users,
        waste_processed_per_hour: waste_per_hour,
        average_latency_ms: latency_ms,
    };

    let mut snapshots: Vec<PerformanceSnapshot> = env
        .storage()
        .persistent()
        .get(&PERF_SNAPSHOTS)
        .unwrap_or(Vec::new(&env));

    snapshots.push_back(snapshot);

    // Keep only last 100 snapshots
    if snapshots.len() > 100 {
        let mut new_snapshots = Vec::new(&env);
        for i in (snapshots.len() - 100)..snapshots.len() {
            new_snapshots.push_back(snapshots.get(i).unwrap());
        }
        env.storage().persistent().set(&PERF_SNAPSHOTS, &new_snapshots);
        storage_utils::bump_persistent(&env, &PERF_SNAPSHOTS);
    } else {
        env.storage().persistent().set(&PERF_SNAPSHOTS, &snapshots);
        storage_utils::bump_persistent(&env, &PERF_SNAPSHOTS);
    }
}

/// Analyze performance over a given period.
pub(crate) fn analyze_performance_period(env: Env, start: u64, end: u64) -> TransactionStats {
    // In a real implementation, we would filter historical snapshots.
    // For now, return the overall stats as a placeholder.
    super::analytics::get_transaction_stats(env)
}

/// Set the processing cost for a v2 waste item.
///
/// Only the current owner may call this.
///
/// # Errors
/// - [`Error::WasteNotFound`] if the waste does not exist.
/// - [`Error::NotWasteOwner`] if caller is not the current owner.
pub(crate) fn set_processing_cost(env: Env, waste_id: u128, owner: Address, cost: u128) -> Result<types::Waste, Error> {
    owner.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    if waste.current_owner != owner {
        return Err(Error::NotWasteOwner);
    }

    waste.processing_cost = cost;
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    // Update participant stats
    let stats_key = ("stats", owner.clone());
    let mut stats: RecyclingStats = env
        .storage()
        .instance()
        .get(&stats_key)
        .unwrap_or_else(|| RecyclingStats::new(owner.clone()));
    stats.total_processing_costs = stats.total_processing_costs.saturating_add(cost);
    env.storage().instance().set(&stats_key, &stats);

    Ok(waste)
}

/// Get the total processing costs across all v2 waste items.
pub(crate) fn get_total_processing_costs(env: Env) -> u128 {
    let count: u64 = env.storage().instance().get(&("waste_count",)).unwrap_or(0);
    let mut total: u128 = 0;
    for id in 1u128..=(count as u128) {
        if let Some(w) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", id)) {
            total = total.saturating_add(w.processing_cost);
        }
    }
    total
}

/// Get the total processing costs for a specific participant.
pub(crate) fn get_participant_processing_costs(env: Env, participant: Address) -> u128 {
    let stats: Option<RecyclingStats> = env.storage().instance().get(&("stats", participant));
    stats.map(|s| s.total_processing_costs).unwrap_or(0)
}

/// Set the material composition for a v2 waste item.
///
/// Only a registered Collector or Manufacturer (verifier) may call this.
/// Percentages must sum to exactly 100. Maximum 10 composition entries.
///
/// # Errors
/// - [`Error::WasteNotFound`] if the waste does not exist.
/// - [`Error::NotRegistered`] if caller is not registered.
/// - [`Error::InvalidAmount`] if percentages don't sum to 100 or > 10 entries.
pub(crate) fn set_waste_composition(
    env: Env,
    waste_id: u128,
    verifier: Address,
    composition: Vec<types::MaterialComposition>,
) -> Result<types::Waste, Error> {
    verifier.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    // Verifier must be a registered Collector or Manufacturer
    let participant = super::participant::get_participant(env.clone(), verifier.clone()).ok_or(Error::NotRegistered)?;
    if participant.role == ParticipantRole::Recycler {
        return Err(Error::Unauthorized);
    }

    if composition.len() > 10 {
        return Err(Error::InvalidAmount);
    }

    let mut total: u32 = 0;
    for entry in composition.iter() {
        total = total.saturating_add(entry.percentage);
    }
    if total != 100 {
        return Err(Error::InvalidAmount);
    }

    let mut waste: types::Waste = env
        .storage()
        .instance()
        .get(&("waste_v2", waste_id))
        .ok_or(Error::WasteNotFound)?;

    let entry_count = composition.len();
    waste.composition = composition;
    env.storage().instance().set(&("waste_v2", waste_id), &waste);

    events::emit_composition_set(&env, waste_id, &verifier, entry_count);

    Ok(waste)
}

/// Get all v2 waste IDs that contain at least `min_percentage` of `material_type`.
pub(crate) fn get_wastes_by_composition(env: Env, material_type: WasteType, min_percentage: u32) -> Vec<u128> {
    let count: u64 = env.storage().instance().get(&("waste_count",)).unwrap_or(0);
    let mut result = Vec::new(&env);
    for id in 1u128..=(count as u128) {
        if let Some(w) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", id)) {
            for entry in w.composition.iter() {
                if entry.material_type == material_type && entry.percentage >= min_percentage {
                    result.push_back(id);
                    break;
                }
            }
        }
    }
    result
}

/// Get composition analysis for a specific participant's waste items.
/// Returns a map of WasteType to total percentage across all their active wastes.
pub(crate) fn participant_composition_analysis(env: Env, participant: Address) -> Vec<types::CompositionEntry> {
    crate::ScavengerContract::require_registered(&env, &participant);
    let waste_ids: Vec<u128> = env
        .storage()
        .instance()
        .get(&("participant_wastes", participant))
        .unwrap_or(Vec::new(&env));

    let mut paper: u32 = 0;
    let mut pet: u32 = 0;
    let mut plastic: u32 = 0;
    let mut metal: u32 = 0;
    let mut glass: u32 = 0;
    let mut organic: u32 = 0;
    let mut electronic: u32 = 0;
    let mut count: u32 = 0;

    for wid in waste_ids.iter() {
        if let Some(w) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", wid)) {
            if w.is_active && !w.composition.is_empty() {
                for entry in w.composition.iter() {
                    match entry.material_type {
                        WasteType::Paper => paper = paper.saturating_add(entry.percentage),
                        WasteType::PetPlastic => pet = pet.saturating_add(entry.percentage),
                        WasteType::Plastic => plastic = plastic.saturating_add(entry.percentage),
                        WasteType::Metal => metal = metal.saturating_add(entry.percentage),
                        WasteType::Glass => glass = glass.saturating_add(entry.percentage),
                        WasteType::Organic => organic = organic.saturating_add(entry.percentage),
                        WasteType::Electronic => electronic = electronic.saturating_add(entry.percentage),
                    }
                }
                count = count.saturating_add(1);
            }
        }
    }

    let mut result = Vec::new(&env);
    if count > 0 {
        if paper > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Paper,
                avg_percentage: paper / count,
            });
        }
        if pet > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::PetPlastic,
                avg_percentage: pet / count,
            });
        }
        if plastic > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Plastic,
                avg_percentage: plastic / count,
            });
        }
        if metal > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Metal,
                avg_percentage: metal / count,
            });
        }
        if glass > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Glass,
                avg_percentage: glass / count,
            });
        }
        if organic > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Organic,
                avg_percentage: organic / count,
            });
        }
        if electronic > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Electronic,
                avg_percentage: electronic / count,
            });
        }
    }
    result
}

/// Get aggregated composition analytics across the entire system.
/// Returns the average composition percentages across all active wastes with composition data.
pub(crate) fn get_composition_analytics(env: Env) -> Vec<types::CompositionEntry> {
    let total = crate::ScavengerContract::get_waste_count(&env);
    let mut paper: u64 = 0;
    let mut pet: u64 = 0;
    let mut plastic: u64 = 0;
    let mut metal: u64 = 0;
    let mut glass: u64 = 0;
    let mut organic: u64 = 0;
    let mut electronic: u64 = 0;
    let mut count: u64 = 0;

    for id in 1..=total {
        let waste_id = id as u128;
        if let Some(w) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", waste_id)) {
            if w.is_active && !w.composition.is_empty() {
                for entry in w.composition.iter() {
                    let pct = entry.percentage as u64;
                    match entry.material_type {
                        WasteType::Paper => paper = paper.saturating_add(pct),
                        WasteType::PetPlastic => pet = pet.saturating_add(pct),
                        WasteType::Plastic => plastic = plastic.saturating_add(pct),
                        WasteType::Metal => metal = metal.saturating_add(pct),
                        WasteType::Glass => glass = glass.saturating_add(pct),
                        WasteType::Organic => organic = organic.saturating_add(pct),
                        WasteType::Electronic => electronic = electronic.saturating_add(pct),
                    }
                }
                count = count.saturating_add(1);
            }
        }
    }

    let mut result = Vec::new(&env);
    if count > 0 {
        if paper > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Paper,
                avg_percentage: (paper / count) as u32,
            });
        }
        if pet > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::PetPlastic,
                avg_percentage: (pet / count) as u32,
            });
        }
        if plastic > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Plastic,
                avg_percentage: (plastic / count) as u32,
            });
        }
        if metal > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Metal,
                avg_percentage: (metal / count) as u32,
            });
        }
        if glass > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Glass,
                avg_percentage: (glass / count) as u32,
            });
        }
        if organic > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Organic,
                avg_percentage: (organic / count) as u32,
            });
        }
        if electronic > 0 {
            result.push_back(types::CompositionEntry {
                material_type: WasteType::Electronic,
                avg_percentage: (electronic / count) as u32,
            });
        }
    }
    result
}

/// Get the global recycling rate in basis points (e.g. 9500 = 95.00%).
/// Calculated as (total recycled weight / total weight) * 10000.
pub(crate) fn get_global_recycling_rate(env: Env) -> u32 {
    let count: u64 = env.storage().instance().get(&("waste_count",)).unwrap_or(0);
    let mut total_weight: u128 = 0;
    let mut recycled_weight: u128 = 0;
    for id in 1u128..=(count as u128) {
        if let Some(w) = env.storage().instance().get::<_, types::Waste>(&("waste_v2", id)) {
            total_weight = total_weight.saturating_add(w.weight);
            if w.recycled_timestamp > 0 {
                recycled_weight = recycled_weight.saturating_add(w.weight);
            }
        }
    }
    if total_weight == 0 {
        return 0;
    }
    ((recycled_weight * 10_000) / total_weight) as u32
}

/// Get the recycling rate for a specific participant in basis points.
pub(crate) fn get_participant_recycling_rate(env: Env, participant: Address) -> u32 {
    let stats: Option<RecyclingStats> = env.storage().instance().get(&("stats", participant));
    stats.map(|s| s.recycling_rate).unwrap_or(0)
}
