use super::super::*;

/// Initialise the contract administrator.
///
/// Must be called exactly once, immediately after deployment.
/// Subsequent calls panic with `"Admin already initialized"`.
///
/// # Parameters
/// - `admin`: Address that will hold admin privileges. Must sign the transaction.
///
/// # Errors
/// - Panics `"Admin already initialized"` if called more than once.
pub(crate) fn initialize_admin(env: Env, admin: Address) {
    storage_utils::bump_instance(&env);
    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    admin.require_auth();

    // Check if admin is already set
    if env.storage().instance().has(&ADMINS) {
        crate::ScavengerContract::unlock(&env);
        panic!("Admin already initialized");
    }

    let mut admins = Vec::new(&env);
    admins.push_back(admin.clone());
    env.storage().instance().set(&ADMINS, &admins);

    audit_log::AuditLogService::log_action(
        &env,
        String::from_str(&env, "initialize_admin"),
        admin,
        String::from_str(&env, "admin"),
        String::from_str(&env, "Admin initialized"),
    );

    crate::ScavengerContract::unlock(&env);
}

/// Get the current admin addresses.
///
/// # Returns
/// A vector of `Address`es that hold admin privileges.
///
/// # Errors
/// - Panics `"Admin not set"` if [`initialize_admin`] has not been called.
pub(crate) fn get_admins(env: Env) -> Vec<Address> {
    env.storage().instance().get(&ADMINS).expect("Admin not set")
}

/// Get the primary admin address (first in the list).
///
/// # Returns
/// The `Address` of the primary contract administrator.
///
/// # Errors
/// - Panics `"Admin not set"` if [`initialize_admin`] has not been called.
pub(crate) fn get_admin(env: Env) -> Address {
    super::admin::get_admins(env).first().expect("No admin found").clone()
}

/// Transfer admin rights to new addresses (current admin only)
/// Replaces the entire admin list with the new list.
pub(crate) fn transfer_admin(env: Env, current_admin: Address, new_admins: Vec<Address>) {
    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_admin(&env, &current_admin);
    // Validate new_admins is not empty
    if new_admins.is_empty() {
        crate::ScavengerContract::unlock(&env);
        panic!("Admin list cannot be empty");
    }
    env.storage().instance().set(&ADMINS, &new_admins);
    events::emit_admin_transferred(&env, &current_admin);
    audit_log::AuditLogService::log_action(
        &env,
        String::from_str(&env, "transfer_admin"),
        current_admin,
        String::from_str(&env, "admin"),
        String::from_str(&env, "Admin transferred"),
    );
    crate::ScavengerContract::unlock(&env);
}

/// Add a new admin address (current admin only)
pub(crate) fn add_admin(env: Env, current_admin: Address, new_admin: Address) {
    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_admin(&env, &current_admin);
    let mut admins: Vec<Address> = env.storage().instance().get(&ADMINS).expect("Admin not set");
    if !admins.contains(&new_admin) {
        admins.push_back(new_admin);
        env.storage().instance().set(&ADMINS, &admins);
    }
    crate::ScavengerContract::unlock(&env);
}

/// Remove an admin address (current admin only)
/// Cannot remove the last admin.
pub(crate) fn remove_admin(env: Env, current_admin: Address, admin_to_remove: Address) {
    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_admin(&env, &current_admin);
    let admins: Vec<Address> = env.storage().instance().get(&ADMINS).expect("Admin not set");
    if admins.len() <= 1 {
        crate::ScavengerContract::unlock(&env);
        panic!("Cannot remove the last admin");
    }
    // Find and remove the admin
    let mut new_admins = Vec::new(&env);
    for admin in admins.iter() {
        if admin != admin_to_remove {
            new_admins.push_back(admin);
        }
    }
    if new_admins.len() == admins.len() {
        crate::ScavengerContract::unlock(&env);
        panic!("Admin to remove not found");
    }
    env.storage().instance().set(&ADMINS, &new_admins);
    crate::ScavengerContract::unlock(&env);
}

/// Set the charity contract address that receives donations.
///
/// # Parameters
/// - `admin`: Must be the current contract admin and sign the transaction.
/// - `charity_address`: Target charity contract. Must differ from `admin`.
///
/// # Errors
/// - Panics `"Charity address cannot be the same as admin"`.
/// - Panics `"Caller is not the contract admin"` if `admin` is not the admin.
pub(crate) fn set_charity_contract(env: Env, admin: Address, charity_address: Address) {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::only_admin(&env, &admin);

    // Validate address (basic check - address should not be the zero address)
    // In Soroban, we can't easily check for zero address, but we can ensure it's different from admin
    if charity_address == admin {
        panic!("Charity address cannot be the same as admin");
    }

    env.storage().instance().set(&CHARITY, &charity_address);
}

/// Get the configured charity contract address.
///
/// # Returns
/// `Some(Address)` if set, `None` otherwise.
pub(crate) fn get_charity_contract(env: Env) -> Option<Address> {
    env.storage().instance().get(&CHARITY)
}

/// Donate tokens from the caller's earned balance to the charity contract.
///
/// Deducts `amount` from `donor.total_tokens_earned` and emits a
/// `donation_made` event. Protected by a reentrancy guard.
///
/// # Parameters
/// - `donor`: Registered participant making the donation. Must sign.
/// - `amount`: Number of tokens to donate (must be > 0).
///
/// # Errors
/// - Panics `"Donation amount must be greater than zero"`.
/// - Panics `"Insufficient balance"` if donor has fewer tokens than `amount`.
/// - Panics `"Charity contract not set"` if no charity address is configured.
pub(crate) fn donate_to_charity(env: Env, donor: Address, amount: i128) {
    validation::validate_positive_amount(amount, "Donation amount");
    storage_utils::bump_instance(&env);
    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_registered(&env, &donor);

    // Validate donor has enough earned token balance.
    let donor_key = (donor.clone(),);
    let mut participant: Participant = env
        .storage()
        .instance()
        .get(&donor_key)
        .expect("Caller is not a registered participant");
    let donation_amount = amount as u128;
    if participant.total_tokens_earned < donation_amount {
        crate::ScavengerContract::unlock(&env);
        panic!("Insufficient balance");
    }
    participant.total_tokens_earned = participant
        .total_tokens_earned
        .checked_sub(donation_amount)
        .expect("Overflow in donor balance");
    env.storage().instance().set(&donor_key, &participant);

    // Get charity contract address
    let charity_contract = env
        .storage()
        .instance()
        .get::<Symbol, Address>(&CHARITY)
        .expect("Charity contract not set");

    // Emit donation event
    events::emit_donation_made(&env, &donor, amount, &charity_contract);

    // Release lock
    crate::ScavengerContract::unlock(&env);
}

/// Set both collector and owner reward percentages atomically.
///
/// Persists a single [`RewardConfig`] entry so that every subsequent
/// `_reward_tokens` call costs one storage lookup instead of two.
/// Defaults before first call: collector = 5 %, owner = 50 %.
///
/// # Parameters
/// - `admin`: Contract admin. Must sign.
/// - `collector_percentage`: Share (0–100) given to each collector in the chain.
/// - `owner_percentage`: Share (0–100) given to the current waste owner.
///
/// # Errors
/// - Panics `"Total percentages cannot exceed 100"` if the sum > 100.
///
/// # Example
/// ```text
/// set_percentages(admin, 10, 40)
/// // collectors get 10 %, owner gets 40 %, remainder goes to recycler
/// ```
pub(crate) fn set_percentages(env: Env, admin: Address, collector_percentage: u32, owner_percentage: u32) {
    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::only_admin(&env, &admin);

    validation::validate_percentage_sum(collector_percentage, owner_percentage);
    if collector_percentage + owner_percentage > 100 {
        crate::ScavengerContract::unlock(&env);
        panic!("Total percentages cannot exceed 100");
    }

    env.storage().instance().set(
        &REWARD_CFG,
        &RewardConfig {
            collector_percentage,
            owner_percentage,
        },
    );
    crate::ScavengerContract::unlock(&env);
}

/// Get the current collector reward percentage.
///
/// Always returns `Some`; defaults to `5` if never explicitly set.
pub(crate) fn get_collector_percentage(env: Env) -> Option<u32> {
    Some(crate::ScavengerContract::get_reward_config(&env).collector_percentage)
}

/// Get the current owner reward percentage.
///
/// Always returns `Some`; defaults to `50` if never explicitly set.
pub(crate) fn get_owner_percentage(env: Env) -> Option<u32> {
    Some(crate::ScavengerContract::get_reward_config(&env).owner_percentage)
}

/// Update only the collector percentage, preserving the owner percentage.
///
/// # Parameters
/// - `admin`: Contract admin. Must sign.
/// - `new_percentage`: New collector share (0–100).
///
/// # Errors
/// - Panics `"Total percentages cannot exceed 100"` if `new_percentage + owner_pct > 100`.
pub(crate) fn set_collector_percentage(env: Env, admin: Address, new_percentage: u32) {
    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::only_admin(&env, &admin);

    let mut cfg = crate::ScavengerContract::get_reward_config(&env);
    validation::validate_percentage_sum(new_percentage, cfg.owner_percentage);
    if new_percentage + cfg.owner_percentage > 100 {
        crate::ScavengerContract::unlock(&env);
        panic!("Total percentages cannot exceed 100");
    }
    cfg.collector_percentage = new_percentage;
    env.storage().instance().set(&REWARD_CFG, &cfg);
    crate::ScavengerContract::unlock(&env);
}

/// Update only the owner percentage, preserving the collector percentage.
///
/// # Parameters
/// - `admin`: Contract admin. Must sign.
/// - `new_percentage`: New owner share (0–100).
///
/// # Errors
/// - Panics `"Total percentages cannot exceed 100"` if `collector_pct + new_percentage > 100`.
pub(crate) fn set_owner_percentage(env: Env, admin: Address, new_percentage: u32) {
    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::only_admin(&env, &admin);

    let mut cfg = crate::ScavengerContract::get_reward_config(&env);
    validation::validate_percentage_sum(cfg.collector_percentage, new_percentage);
    if cfg.collector_percentage + new_percentage > 100 {
        crate::ScavengerContract::unlock(&env);
        panic!("Total percentages cannot exceed 100");
    }
    cfg.owner_percentage = new_percentage;
    env.storage().instance().set(&REWARD_CFG, &cfg);
    crate::ScavengerContract::unlock(&env);
}

/// Set the minimum weight for waste submissions (in grams).
///
/// # Parameters
/// - `admin`: Contract admin. Must sign.
/// - `min_weight`: Minimum weight in grams (must be <= MAX_WASTE_WEIGHT).
///
/// # Errors
/// - Panics if `min_weight` is greater than MAX_WASTE_WEIGHT.
pub(crate) fn set_min_weight(env: Env, admin: Address, min_weight: u128) {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::only_admin(&env, &admin);
    if min_weight > MAX_WASTE_WEIGHT {
        panic!("Minimum weight cannot exceed maximum allowed weight");
    }
    env.storage().instance().set(&MIN_WEIGHT, &min_weight);
}

/// Get the configured minimum weight for waste submissions (in grams).
///
/// # Returns
/// The minimum weight in grams, defaults to 1 if not set.
pub(crate) fn get_min_weight(env: Env) -> u128 {
    env.storage().instance().get(&MIN_WEIGHT).unwrap_or(1)
}

/// Set the SEP-41 token contract address used for reward transfers.
///
/// # Parameters
/// - `admin`: Contract admin. Must sign.
/// - `token_address`: Address of the token contract.
pub(crate) fn set_token_address(env: Env, admin: Address, token_address: Address) {
    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_admin(&env, &admin);
    env.storage().instance().set(&TOKEN_ADDR, &token_address);
    crate::ScavengerContract::unlock(&env);
}

/// Get the configured token contract address.
///
/// # Returns
/// `Some(Address)` if set via [`set_token_address`], `None` otherwise.
pub(crate) fn get_token_address(env: Env) -> Option<Address> {
    env.storage().instance().get(&TOKEN_ADDR)
}

/// Set a seasonal reward multiplier (admin only).
///
/// The multiplier is expressed in basis points: 100 = 1x, 150 = 1.5x, 500 = 5x (max).
/// It is active for rewards distributed between `start` and `end` (inclusive, Unix timestamps).
///
/// # Errors
/// - Panics if `multiplier` is 0, < 100, or > 500.
/// - Panics if `start >= end`.
pub(crate) fn set_seasonal_multiplier(env: Env, admin: Address, multiplier: u32, start: u64, end: u64) {
    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_admin(&env, &admin);
    assert!(
        multiplier >= 100 && multiplier <= 500,
        "Multiplier must be between 100 and 500 basis points"
    );
    assert!(start < end, "start must be before end");
    let seasonal = SeasonalMultiplier { multiplier, start, end };
    env.storage().instance().set(&SEASONAL_MUL, &seasonal);
    events::emit_seasonal_multiplier_set(&env, multiplier, start, end);
    crate::ScavengerContract::unlock(&env);
}

/// Return the active seasonal multiplier in basis points, or 100 (1x) if none is active.
pub(crate) fn get_current_multiplier(env: Env) -> u32 {
    let now = env.ledger().timestamp();
    if let Some(s) = env.storage().instance().get::<_, SeasonalMultiplier>(&SEASONAL_MUL) {
        if now >= s.start && now <= s.end {
            return s.multiplier;
        }
    }
    100
}

/// Set the number of admin approvals required to execute a proposal (1 ≤ threshold ≤ admin count).
pub(crate) fn set_multisig_threshold(env: Env, admin: Address, threshold: u32) {
    crate::ScavengerContract::require_admin(&env, &admin);
    let admins: Vec<Address> = env.storage().instance().get(&ADMINS).expect("Admin not set");
    if threshold == 0 || threshold > admins.len() {
        panic!("Threshold must be between 1 and the number of admins");
    }
    env.storage().instance().set(&MULTISIG_THRESHOLD, &threshold);
}

/// Get the current multi-sig threshold (defaults to 1).
pub(crate) fn get_multisig_threshold(env: Env) -> u32 {
    env.storage().instance().get(&MULTISIG_THRESHOLD).unwrap_or(1)
}

/// Propose a new admin action. The proposer's approval is counted automatically.
pub(crate) fn propose_admin_action(env: Env, proposer: Address, action: AdminAction) -> AdminProposal {
    crate::ScavengerContract::require_admin(&env, &proposer);
    crate::ScavengerContract::require_not_paused(&env);

    let id = crate::ScavengerContract::next_proposal_id(&env);
    let mut approvers = Vec::new(&env);
    approvers.push_back(proposer.clone());

    let proposal = AdminProposal {
        id,
        action,
        proposer: proposer.clone(),
        approvers,
        executed: false,
        created_at: env.ledger().timestamp(),
    };

    crate::ScavengerContract::save_proposal(&env, &proposal);
    events::emit_proposal_created(&env, id, &proposer);
    proposal
}

/// Approve an existing proposal. Each admin may approve at most once.
pub(crate) fn approve_admin_proposal(env: Env, approver: Address, proposal_id: u64) -> AdminProposal {
    crate::ScavengerContract::require_admin(&env, &approver);
    crate::ScavengerContract::require_not_paused(&env);

    let mut proposal = crate::ScavengerContract::get_proposal(&env, proposal_id);

    if proposal.executed {
        panic!("Proposal already executed");
    }
    if env.ledger().timestamp() > proposal.created_at + PROPOSAL_TTL_SECS {
        panic!("Proposal expired");
    }
    if proposal.approvers.contains(&approver) {
        panic!("Already approved");
    }

    proposal.approvers.push_back(approver.clone());
    crate::ScavengerContract::save_proposal(&env, &proposal);
    events::emit_proposal_approved(&env, proposal_id, &approver);
    proposal
}

/// Execute a proposal once the approval threshold is met.
pub(crate) fn execute_admin_proposal(env: Env, executor: Address, proposal_id: u64) -> AdminProposal {
    crate::ScavengerContract::require_admin(&env, &executor);
    crate::ScavengerContract::require_not_paused(&env);

    let mut proposal = crate::ScavengerContract::get_proposal(&env, proposal_id);

    if proposal.executed {
        panic!("Proposal already executed");
    }
    if env.ledger().timestamp() > proposal.created_at + PROPOSAL_TTL_SECS {
        panic!("Proposal expired");
    }

    let threshold = super::admin::get_multisig_threshold(env.clone());
    if proposal.approvers.len() < threshold {
        panic!("Insufficient approvals");
    }

    match proposal.action.clone() {
        AdminAction::TransferAdmin(new_admins) => {
            if new_admins.is_empty() {
                panic!("Admin list cannot be empty");
            }
            env.storage().instance().set(&ADMINS, &new_admins);
        }
        AdminAction::SetPercentages(collector_pct, owner_pct) => {
            if collector_pct + owner_pct > 100 {
                panic!("Total percentages cannot exceed 100");
            }
            env.storage().instance().set(
                &REWARD_CFG,
                &RewardConfig {
                    collector_percentage: collector_pct,
                    owner_percentage: owner_pct,
                },
            );
        }
        AdminAction::DeactivateWaste(waste_id) => {
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
        }
    }

    proposal.executed = true;
    crate::ScavengerContract::save_proposal(&env, &proposal);
    events::emit_proposal_executed(&env, proposal_id, &executor);
    proposal
}

/// Get a proposal by ID.
pub(crate) fn get_admin_proposal(env: Env, proposal_id: u64) -> AdminProposal {
    crate::ScavengerContract::get_proposal(&env, proposal_id)
}

/// Generate a compliance report for a given period.
/// This function collects waste tracking and carbon credit data for the specified timeframe.
pub(crate) fn generate_compliance_report(env: Env, admin: Address, period: ReportPeriod) -> ComplianceReport {
    crate::ScavengerContract::only_admin(&env, &admin);

    let report_id_key = REPORT_COUNT;
    let current_id: u64 = env.storage().instance().get(&report_id_key).unwrap_or(0);
    let new_id = current_id + 1;
    env.storage().instance().set(&report_id_key, &new_id);

    // In a real scenario, we would filter waste items by timestamp.
    // For this implementation, we use current global metrics as a snapshot.
    let metrics = super::analytics::get_metrics(env.clone());

    // Create regulatory validations (example requirements)
    let mut validations = Vec::new(&env);

    validations.push_back(RegulatoryValidation {
        requirement_id: String::from_str(&env, "ENV-001"),
        status: ComplianceStatus::Compliant,
        notes: String::from_str(&env, "Total waste tracked exceeds minimum threshold."),
    });

    validations.push_back(RegulatoryValidation {
        requirement_id: String::from_str(&env, "CARB-002"),
        status: ComplianceStatus::Compliant,
        notes: String::from_str(&env, "Carbon credits correctly calculated and attributed."),
    });

    let mut waste_by_type = Vec::new(&env);
    // Simplified: using a fixed list of types for the report
    for i in 0..7 {
        if let Some(wt) = WasteType::from_u32(i) {
            // In a real implementation, we'd have a counter per waste type
            waste_by_type.push_back((wt, 0u128));
        }
    }

    let report = ComplianceReport {
        id: new_id,
        period,
        total_waste_tracked: metrics.total_wastes_count as u128,
        waste_by_type,
        total_carbon_credits: metrics.total_carbon_credits,
        validations,
        generated_at: env.ledger().timestamp(),
        version: 1,
        is_finalized: false,
    };

    // Store report (bump TTL so it survives beyond instance expiry)
    env.storage().persistent().set(&(REPORTS, new_id), &report);
    storage_utils::bump_persistent(&env, &(REPORTS, new_id));

    // Log the action
    audit_log::AuditLogService::log_action(
        &env,
        String::from_str(&env, "GENERATE_REPORT"),
        admin,
        String::from_str(&env, "COMPLIANCE"),
        String::from_str(&env, "Compliance report generated"),
    );

    report
}

/// Retrieve a previously generated compliance report.
pub(crate) fn get_compliance_report(env: Env, report_id: u64) -> ComplianceReport {
    env.storage()
        .persistent()
        .get(&(REPORTS, report_id))
        .expect("Compliance report not found")
}

/// Finalize a compliance report, marking it as official and unchangeable.
pub(crate) fn finalize_compliance_report(env: Env, admin: Address, report_id: u64) {
    crate::ScavengerContract::only_admin(&env, &admin);
    let mut report: ComplianceReport = env
        .storage()
        .persistent()
        .get(&(REPORTS, report_id))
        .expect("Compliance report not found");

    report.is_finalized = true;
    env.storage().persistent().set(&(REPORTS, report_id), &report);
    storage_utils::bump_persistent(&env, &(REPORTS, report_id));

    audit_log::AuditLogService::log_action(
        &env,
        String::from_str(&env, "FINALIZE_REPORT"),
        admin,
        String::from_str(&env, "COMPLIANCE"),
        String::from_str(&env, "Compliance report finalized"),
    );
}

/// Set the threshold for high-value transfers that require multi-signature approval.
pub(crate) fn set_transfer_threshold(env: Env, admin: Address, threshold: u128) {
    crate::ScavengerContract::only_admin(&env, &admin);
    env.storage().instance().set(&TRANSFER_THRESHOLD, &threshold);
}

/// Set the required number of approvals for high-value transfers.
pub(crate) fn set_required_approvals(env: Env, admin: Address, count: u32) {
    crate::ScavengerContract::only_admin(&env, &admin);
    env.storage().instance().set(&REQUIRED_APPROVERS, &count);
}

/// Approve a pending high-value transfer.
pub(crate) fn approve_high_value_transfer(env: Env, waste_id: u128, approver: Address) -> Result<(), Error> {
    approver.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    let mut approval: TransferApproval = env
        .storage()
        .persistent()
        .get(&(TRANSFER_APPROVALS, waste_id))
        .ok_or(Error::WasteNotFound)?;

    if approval.status != TransferApprovalStatus::Pending {
        return Err(Error::Unauthorized);
    }

    if env.ledger().timestamp() > approval.expires_at {
        approval.status = TransferApprovalStatus::Expired;
        env.storage()
            .persistent()
            .set(&(TRANSFER_APPROVALS, waste_id), &approval);
        return Err(Error::ApprovalExpired);
    }

    // Check if already approved by this address
    if !approval.approvers.contains(&approver) {
        approval.approvers.push_back(approver.clone());

        if approval.approvers.len() >= approval.required_approvals {
            approval.status = TransferApprovalStatus::Approved;
        }

        env.storage()
            .persistent()
            .set(&(TRANSFER_APPROVALS, waste_id), &approval);

        // Emit approval event
        env.events().publish(
            (symbol_short!("approve"), waste_id),
            (approver, approval.approvers.len()),
        );
    }

    Ok(())
}

/// Pause the contract (admin only) — blocks all state-changing functions
pub(crate) fn pause(env: Env, admin: Address) {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_admin(&env, &admin);
    assert!(
        !env.storage().instance().get::<_, bool>(&PAUSED).unwrap_or(false),
        "Contract is already paused"
    );
    env.storage().instance().set(&PAUSED, &true);
    events::emit_contract_paused(&env, &admin);
}

/// Unpause the contract (admin only)
pub(crate) fn unpause(env: Env, admin: Address) {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_admin(&env, &admin);
    assert!(
        env.storage().instance().get::<_, bool>(&PAUSED).unwrap_or(false),
        "Contract is not paused"
    );
    env.storage().instance().set(&PAUSED, &false);
    events::emit_contract_unpaused(&env, &admin);
}

/// Get current pause state
pub(crate) fn is_paused(env: Env) -> bool {
    env.storage().instance().get::<_, bool>(&PAUSED).unwrap_or(false)
}

/// Grant a granular permission to a participant (admin only).
///
/// Stores an entry under `(PERMISSIONS, subject, permission_u32)` and appends
/// to the per-subject audit trail. Emits a `perm_gr` event.
///
/// # Errors
/// - [`Error::Unauthorized`] if `admin` is not the contract admin.
/// - [`Error::InvalidPermission`] if `permission` is not a valid [`PermissionType`] value.
pub(crate) fn grant_permission(env: Env, admin: Address, subject: Address, permission: u32) -> Result<(), Error> {
    storage_utils::bump_instance(&env);
    admin.require_auth();
    crate::ScavengerContract::check_admin(&env, &admin)?;

    // Validate permission value
    if PermissionType::from_u32(permission).is_none() {
        return Err(Error::InvalidPermission);
    }

    // Store the grant flag
    env.storage()
        .instance()
        .set(&(PERMISSIONS, subject.clone(), permission), &true);

    // Append to audit trail
    let mut trail: Vec<PermissionAuditEntry> = env
        .storage()
        .instance()
        .get(&(PERMISSIONS, subject.clone()))
        .unwrap_or(Vec::new(&env));

    trail.push_back(PermissionAuditEntry {
        subject: subject.clone(),
        permission: PermissionType::from_u32(permission).unwrap(),
        granted: true,
        changed_by: admin.clone(),
        timestamp: env.ledger().timestamp(),
    });
    env.storage().instance().set(&(PERMISSIONS, subject.clone()), &trail);

    events::emit_permission_granted(&env, &subject, permission, &admin);
    Ok(())
}

/// Revoke a granular permission from a participant (admin only).
///
/// Removes the grant flag and appends a revocation entry to the audit trail.
/// Emits a `perm_rv` event.
///
/// # Errors
/// - [`Error::Unauthorized`] if `admin` is not the contract admin.
/// - [`Error::InvalidPermission`] if `permission` is not a valid [`PermissionType`] value.
pub(crate) fn revoke_permission(env: Env, admin: Address, subject: Address, permission: u32) -> Result<(), Error> {
    storage_utils::bump_instance(&env);
    admin.require_auth();
    crate::ScavengerContract::check_admin(&env, &admin)?;

    if PermissionType::from_u32(permission).is_none() {
        return Err(Error::InvalidPermission);
    }

    // Remove the grant flag
    env.storage()
        .instance()
        .remove(&(PERMISSIONS, subject.clone(), permission));

    // Append revocation to audit trail
    let mut trail: Vec<PermissionAuditEntry> = env
        .storage()
        .instance()
        .get(&(PERMISSIONS, subject.clone()))
        .unwrap_or(Vec::new(&env));

    trail.push_back(PermissionAuditEntry {
        subject: subject.clone(),
        permission: PermissionType::from_u32(permission).unwrap(),
        granted: false,
        changed_by: admin.clone(),
        timestamp: env.ledger().timestamp(),
    });
    env.storage().instance().set(&(PERMISSIONS, subject.clone()), &trail);

    events::emit_permission_revoked(&env, &subject, permission, &admin);
    Ok(())
}

/// Check whether `subject` currently holds the given `permission`.
///
/// Returns `true` if granted, `false` otherwise.
///
/// # Errors
/// - [`Error::InvalidPermission`] if `permission` is not a valid [`PermissionType`] value.
pub(crate) fn has_permission(env: Env, subject: Address, permission: u32) -> Result<bool, Error> {
    if PermissionType::from_u32(permission).is_none() {
        return Err(Error::InvalidPermission);
    }

    let granted: bool = env
        .storage()
        .instance()
        .get(&(PERMISSIONS, subject, permission))
        .unwrap_or(false);
    Ok(granted)
}

/// Get the full permission audit trail for a subject.
pub(crate) fn get_permission_audit(env: Env, subject: Address) -> Vec<PermissionAuditEntry> {
    env.storage()
        .instance()
        .get(&(PERMISSIONS, subject))
        .unwrap_or(Vec::new(&env))
}
