use super::*;

impl ScavengerContract {
    pub(crate) const MAX_TAGS: u32 = 10;

    pub(crate) const MAX_TAG_LEN: u32 = 20;

    pub(crate) const MAX_DOCUMENT_HASHES: u32 = 5;

    pub(crate) fn lock(env: &Env) {
        if env.storage().instance().has(&REENTRANCY_GUARD) {
            panic!("Reentrant call detected");
        }
        env.storage().instance().set(&REENTRANCY_GUARD, &true);
    }

    pub(crate) fn unlock(env: &Env) {
        env.storage().instance().remove(&REENTRANCY_GUARD);
    }

    pub(crate) fn require_admin(env: &Env, caller: &Address) {
        let admins: Vec<Address> = env.storage().instance().get(&ADMINS).expect("Admin not set");

        if !admins.contains(caller) {
            panic!("Unauthorized: caller is not admin");
        }

        caller.require_auth();
    }

    pub(crate) fn only_registered(env: &Env, caller: &Address) {
        caller.require_auth();

        let key = (caller.clone(),);
        let participant: Option<Participant> = env.storage().instance().get(&key);

        match participant {
            Some(p) if p.is_registered => {}
            Some(_) => panic!("Caller is not a registered participant"),
            None => panic!("Caller is not a registered participant"),
        }
    }

    pub(crate) fn only_manufacturer(env: &Env, caller: &Address) {
        caller.require_auth();

        let key = (caller.clone(),);
        let participant: Participant = env
            .storage()
            .instance()
            .get(&key)
            .expect("Caller is not a registered participant");

        if !participant.is_registered {
            panic!("Caller is not a registered participant");
        }

        if !participant.role.can_manufacture() {
            panic!("Caller is not a manufacturer");
        }
    }

    pub(crate) fn require_registered(env: &Env, address: &Address) {
        let key = (address.clone(),);
        let participant: Option<Participant> = env.storage().instance().get(&key);

        match participant {
            Some(p) if p.is_registered => {}
            Some(_) => panic!("Participant is not registered"),
            None => panic!("Participant not found"),
        }
    }

    pub(crate) fn only_admin(env: &Env, caller: &Address) {
        caller.require_auth();

        let admins: Vec<Address> = env
            .storage()
            .instance()
            .get(&ADMINS)
            .expect("Contract admin has not been set");

        if !admins.contains(caller) {
            panic!("Caller is not the contract admin");
        }
    }

    pub(crate) fn only_waste_owner(env: &Env, caller: &Address, waste_id: u128) {
        caller.require_auth();

        let waste: Waste = env
            .storage()
            .instance()
            .get(&("waste_v2", waste_id))
            .expect("Waste item not found");

        if &waste.current_owner != caller {
            panic!("Caller is not the owner of this waste item");
        }
    }

    pub(crate) fn require_addresses_different(from: &Address, to: &Address) {
        validation::validate_addresses_different(from, to, "Self-transfer is not allowed");
    }

    pub(crate) fn apply_reputation(env: &Env, address: &Address, delta: i128) {
        let key = (address.clone(),);
        if let Some(mut p) = env.storage().instance().get::<_, Participant>(&key) {
            p.reputation_score = (p.reputation_score + delta).max(REP_MIN).min(REP_MAX);
            p.last_active_at = env.ledger().timestamp();
            env.storage().instance().set(&key, &p);
        }
    }

    pub(crate) fn get_reward_config(env: &Env) -> RewardConfig {
        env.storage().instance().get(&REWARD_CFG).unwrap_or(RewardConfig {
            collector_percentage: 5,
            owner_percentage: 50,
        })
    }

    pub(crate) fn set_participant(env: &Env, address: &Address, participant: &Participant) {
        let key = (address.clone(),);
        env.storage().instance().set(&key, participant);
    }

    pub(crate) fn update_participant_stats(env: &Env, address: &Address, waste_weight: u64, tokens_earned: u64) {
        let key = (address.clone(),);
        if let Some(mut participant) = env.storage().instance().get::<_, Participant>(&key) {
            // Use checked arithmetic to prevent overflow
            participant.total_waste_processed = participant
                .total_waste_processed
                .checked_add(waste_weight as u128)
                .expect("Overflow in total_waste_processed");

            participant.total_tokens_earned = participant
                .total_tokens_earned
                .checked_add(tokens_earned as u128)
                .expect("Overflow in total_tokens_earned");

            // Update certification based on waste processed
            let old_certification = participant.certification;
            participant.certification = CertificationLevel::from_waste_count(participant.total_waste_processed);

            // Update tier based on total waste processed
            let old_tier = participant.tier;
            participant.tier = ParticipantTier::from_total_waste(participant.total_waste_processed);

            env.storage().instance().set(&key, &participant);

            // Emit certification granted event if level upgraded
            if participant.certification != old_certification {
                events::emit_certification_granted(env, address, participant.certification);
            }

            // Emit tier change event if tier changed
            if participant.tier != old_tier {
                events::emit_participant_tier_changed(env, address, old_tier, participant.tier);
            }

            // Update global total tokens if tokens were earned
            if tokens_earned > 0 {
                Self::add_to_total_tokens(env, tokens_earned as u128);
            }
        }
    }

    pub(crate) fn _reward_tokens(env: &Env, waste_id: u64, total_reward: u128) {
        if total_reward == 0 {
            return;
        }

        // One storage lookup fetches both percentages (was two separate gets)
        let cfg = Self::get_reward_config(env);
        let collector_pct = cfg.collector_percentage;
        let owner_pct = cfg.owner_percentage;

        let collector_share = total_reward
            .checked_mul(collector_pct as u128)
            .expect("Overflow in collector share")
            / 100;
        let owner_share = total_reward
            .checked_mul(owner_pct as u128)
            .expect("Overflow in owner share")
            / 100;

        // Read transfer history once
        let transfers = crate::contract_domains::transfer::get_transfer_history(env.clone(), waste_id);

        let mut total_distributed: u128 = 0;

        // Reward collectors — one storage read per unique transfer recipient.
        // Apply cert/tier multipliers once, emit a single event per collector.
        for transfer in transfers.iter() {
            let key = (transfer.to.clone(),);
            let participant: Option<Participant> = env.storage().instance().get(&key);
            if let Some(p) = participant {
                if matches!(p.role, ParticipantRole::Collector) {
                    // #923: apply multipliers here instead of double-distributing
                    let cert_multiplier = p.certification.reward_multiplier() as u128;
                    let tier_multiplier = p.tier.reward_multiplier() as u128;
                    let adjusted_share = (collector_share * cert_multiplier * tier_multiplier) / 10000;
                    total_distributed = total_distributed
                        .checked_add(adjusted_share)
                        .expect("Overflow in total distributed");
                    Self::update_participant_stats(env, &transfer.to, 0, adjusted_share as u64);
                    events::emit_tokens_rewarded(env, &transfer.to, adjusted_share, waste_id);
                }
            }
        }

        // Reward the current owner (submitter) — merge owner_share + remainder into one
        // read-modify-write instead of two separate calls.
        if let Some(material) = Self::get_waste_internal(env, waste_id) {
            let recycler_amount = total_reward.saturating_sub(
                total_distributed
                    .checked_add(owner_share)
                    .expect("Overflow in distributed total"),
            );
            let submitter_total = owner_share
                .checked_add(recycler_amount)
                .expect("Overflow in submitter total"); // = total_reward - total_distributed

            if submitter_total > 0 {
                let key = (material.submitter.clone(),);
                if let Some(participant) = env.storage().instance().get::<_, Participant>(&key) {
                    let cert_multiplier = participant.certification.reward_multiplier() as u128;
                    let tier_multiplier = participant.tier.reward_multiplier() as u128;
                    let adjusted_total = (submitter_total * cert_multiplier * tier_multiplier) / 10000;

                    let mut participant = participant; // make mutable
                    participant.total_tokens_earned = participant
                        .total_tokens_earned
                        .checked_add(adjusted_total)
                        .expect("Overflow in total_tokens_earned");
                    env.storage().instance().set(&key, &participant);

                    // Single global-tokens update for the submitter's combined share
                    Self::add_to_total_tokens(env, adjusted_total);

                    // Emit two events to preserve existing behaviour / test expectations
                    let adjusted_owner_share = (owner_share * cert_multiplier * tier_multiplier) / 10000;
                    let adjusted_recycler_amount = (recycler_amount * cert_multiplier * tier_multiplier) / 10000;
                    events::emit_tokens_rewarded(env, &material.submitter, adjusted_owner_share, waste_id);
                    if adjusted_recycler_amount > 0 {
                        events::emit_tokens_rewarded(env, &material.submitter, adjusted_recycler_amount, waste_id);
                    }
                }
            }
        }
    }

    pub(crate) fn set_waste(env: &Env, waste_id: u64, material: &Material) {
        let key = ("waste", waste_id);
        env.storage().instance().set(&key, material);
    }

    pub(crate) fn get_waste_internal(env: &Env, waste_id: u64) -> Option<Material> {
        let key = ("waste", waste_id);
        env.storage().instance().get(&key)
    }

    pub(crate) fn get_waste_count(env: &Env) -> u64 {
        env.storage().instance().get(&("waste_count",)).unwrap_or(0)
    }

    pub(crate) fn next_waste_id(env: &Env) -> u64 {
        let count = Self::get_waste_count(env);
        let next_id = count.checked_add(1).expect("Overflow in waste count");
        env.storage().instance().set(&("waste_count",), &next_id);
        next_id
    }

    pub(crate) fn get_incentive_count(env: &Env) -> u64 {
        env.storage().instance().get(&("incentive_count",)).unwrap_or(0)
    }

    pub(crate) fn next_incentive_id(env: &Env) -> u64 {
        let count = Self::get_incentive_count(env);
        let next_id = count.checked_add(1).expect("Overflow in incentive count");
        env.storage().instance().set(&("incentive_count",), &next_id);
        next_id
    }

    pub(crate) fn set_incentive(env: &Env, incentive_id: u64, incentive: &Incentive) {
        let key = ("incentive", incentive_id);
        env.storage().instance().set(&key, incentive);
    }

    pub(crate) fn get_incentive_internal(env: &Env, incentive_id: u64) -> Option<Incentive> {
        let key = ("incentive", incentive_id);
        env.storage().instance().get(&key)
    }

    pub(crate) fn get_total_weight(env: &Env) -> u64 {
        env.storage().instance().get(&TOTAL_WEIGHT).unwrap_or(0)
    }

    pub(crate) fn add_to_total_weight(env: &Env, weight: u64) {
        let current = Self::get_total_weight(env);
        let new_total = current.checked_add(weight).expect("Overflow in total weight");
        env.storage().instance().set(&TOTAL_WEIGHT, &new_total);
    }

    pub(crate) fn get_total_tokens(env: &Env) -> u128 {
        env.storage().instance().get(&TOTAL_TOKENS).unwrap_or(0)
    }

    pub(crate) fn add_to_total_tokens(env: &Env, tokens: u128) {
        let current = Self::get_total_tokens(env);
        let new_total = current.checked_add(tokens).expect("Overflow in total tokens");
        env.storage().instance().set(&TOTAL_TOKENS, &new_total);
    }

    pub(crate) fn get_total_active_waste_weight(env: &Env) -> u64 {
        let mut total_weight: u64 = 0;
        let total_wastes = Self::get_waste_count(env);

        for waste_id in 1..=total_wastes {
            if let Some(waste) = env
                .storage()
                .instance()
                .get::<_, Waste>(&("waste_v2", waste_id as u128))
            {
                if waste.is_active {
                    let weight = u64::try_from(waste.weight).expect("Waste weight exceeds u64 range");
                    total_weight = total_weight
                        .checked_add(weight)
                        .expect("Overflow in active waste total weight");
                }
            }
        }

        total_weight
    }

    pub(crate) fn record_transfer(env: &Env, waste_id: u64, from: Address, to: Address, _note: String) {
        let key = ("transfers", waste_id);
        let mut history: Vec<WasteTransfer> = env.storage().instance().get(&key).unwrap_or(Vec::new(env));

        let transfer = WasteTransfer::new(
            waste_id as u128,
            from,
            to,
            env.ledger().timestamp(),
            0,
            0,
            soroban_sdk::symbol_short!("note"),
        );

        history.push_back(transfer);
        env.storage().instance().set(&key, &history);
    }

    pub(crate) fn remove_active_listing(env: &Env, listing_id: u64) {
        let idx: Vec<u64> = env.storage().instance().get(&CARB_LIST_IDX).unwrap_or(Vec::new(env));
        let mut new_idx: Vec<u64> = Vec::new(env);
        for id in idx.iter() {
            if id != listing_id {
                new_idx.push_back(id);
            }
        }
        env.storage().instance().set(&CARB_LIST_IDX, &new_idx);
    }

    pub(crate) fn normalise_tag(env: &Env, tag: &String) -> String {
        let len = tag.len();
        if len == 0 {
            panic!("Tag cannot be empty");
        }
        if len > Self::MAX_TAG_LEN {
            panic!("Tag exceeds maximum length of 20 characters");
        }
        let mut buf = [0u8; 20];
        tag.copy_into_slice(&mut buf[..len as usize]);
        for b in buf[..len as usize].iter_mut() {
            if *b >= b'A' && *b <= b'Z' {
                *b += 32;
            }
        }
        String::from_bytes(env, &buf[..len as usize])
    }

    pub(crate) fn validate_ipfs_hash(env: &Env, hash: &String) {
        let len = hash.len() as usize;
        if !(4..=128).contains(&len) {
            panic!("Invalid IPFS hash");
        }
        let mut buf = [0u8; 128];
        hash.copy_into_slice(&mut buf[..len]);
        let starts_qm = buf[0] == b'Q' && buf[1] == b'm';
        let starts_bafy = buf[0] == b'b' && buf[1] == b'a' && buf[2] == b'f' && buf[3] == b'y';
        if !starts_qm && !starts_bafy {
            panic!("Invalid IPFS hash");
        }
        let _ = env;
    }

    pub(crate) fn next_proposal_id(env: &Env) -> u64 {
        let id: u64 = env.storage().instance().get(&PROPOSAL_COUNT).unwrap_or(0) + 1;
        env.storage().instance().set(&PROPOSAL_COUNT, &id);
        id
    }

    pub(crate) fn get_proposal(env: &Env, proposal_id: u64) -> AdminProposal {
        env.storage()
            .instance()
            .get(&("proposal", proposal_id))
            .expect("Proposal not found")
    }

    pub(crate) fn save_proposal(env: &Env, proposal: &AdminProposal) {
        env.storage().instance().set(&("proposal", proposal.id), proposal);
    }

    pub(crate) fn request_transfer_approval(env: &Env, waste_id: u128, from: Address, to: Address, weight: u128) {
        let required_approvals: u32 = env.storage().instance().get(&REQUIRED_APPROVERS).unwrap_or(2);
        let expiry = env.ledger().timestamp() + TRANSFER_EXPIRY_SECS;

        let approval = TransferApproval {
            waste_id,
            from,
            to,
            amount: weight,
            approvers: Vec::new(env),
            required_approvals,
            status: TransferApprovalStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at: expiry,
        };

        env.storage()
            .persistent()
            .set(&(TRANSFER_APPROVALS, waste_id), &approval);

        // Emit approval requested event
        env.events()
            .publish((symbol_short!("req_app"), waste_id), (weight, required_approvals));
    }

    pub(crate) fn require_not_paused(env: &Env) {
        assert!(
            !env.storage().instance().get::<_, bool>(&PAUSED).unwrap_or(false),
            "Contract is paused"
        );
    }

    pub(crate) fn count_active_challenges(env: &Env) -> u32 {
        let total: u64 = env.storage().instance().get(&CHALLENGE_COUNT).unwrap_or(0);
        let now = env.ledger().timestamp();
        let mut count = 0u32;
        for id in 1..=total {
            if let Some(c) = env.storage().instance().get::<_, Challenge>(&("challenge", id)) {
                if c.status == ChallengeStatus::Active && now < c.end_time {
                    count += 1;
                }
            }
        }
        count
    }

    pub(crate) fn complete_challenge_internal(
        env: &Env,
        challenge_id: u64,
        participant: &Address,
        challenge: &Challenge,
    ) {
        // Award bonus tokens to participant
        let key = (participant.clone(),);
        if let Some(mut p) = env.storage().instance().get::<_, Participant>(&key) {
            p.total_tokens_earned = p.total_tokens_earned.checked_add(challenge.reward).expect("Overflow");
            env.storage().instance().set(&key, &p);
        }

        env.events().publish(
            (symbol_short!("chal_done"), challenge_id),
            (participant, challenge.reward),
        );
    }

    pub(crate) fn check_and_award_milestones(env: &Env, participant: &Address) {
        let key = (participant.clone(),);
        let p: Participant = match env.storage().instance().get::<_, Participant>(&key) {
            Some(p) => p,
            None => return,
        };

        let achieved_key = ("milestones", participant.clone());
        let mut achieved: Vec<u32> = env.storage().instance().get(&achieved_key).unwrap_or(Vec::new(env));

        let titles = [
            symbol_short!("100kg"),
            symbol_short!("500kg"),
            symbol_short!("1000kg"),
            symbol_short!("5000kg"),
            symbol_short!("10000kg"),
            symbol_short!("50000kg"),
            symbol_short!("100000kg"),
        ];

        let mut updated = false;
        for (i, &threshold) in MILESTONE_THRESHOLDS.iter().enumerate() {
            let idx = i as u32;
            if achieved.contains(&idx) {
                continue;
            }
            if p.total_waste_processed >= threshold {
                achieved.push_back(idx);
                updated = true;

                // Award 10% bonus of total_tokens_earned
                let bonus = p.total_tokens_earned / 10;
                if bonus > 0 {
                    let mut p2: Participant = env.storage().instance().get::<_, Participant>(&key).unwrap();
                    p2.total_tokens_earned = p2.total_tokens_earned.checked_add(bonus).expect("Overflow");
                    env.storage().instance().set(&key, &p2);

                    let total: u128 = env.storage().instance().get(&TOTAL_TOKENS).unwrap_or(0);
                    env.storage().instance().set(&TOTAL_TOKENS, &(total + bonus));
                }

                env.events().publish(
                    (symbol_short!("milestone"), idx),
                    (participant, threshold, titles[i].clone()),
                );
            }
        }

        if updated {
            env.storage().instance().set(&achieved_key, &achieved);
        }
    }

    pub(crate) fn sort_and_rank(env: &Env, mut entries: Vec<(u128, Address)>, limit: usize) -> Vec<LeaderboardEntry> {
        // Simple insertion sort (descending by score)
        let n = entries.len() as usize;
        for i in 1..n {
            let mut j = i;
            while j > 0 {
                let a = entries.get(j as u32).unwrap();
                let b = entries.get((j - 1) as u32).unwrap();
                if a.0 > b.0 {
                    entries.set(j as u32, b);
                    entries.set((j - 1) as u32, a);
                    j -= 1;
                } else {
                    break;
                }
            }
        }

        let mut result = Vec::new(env);
        let take = n.min(limit);
        for i in 0..take {
            let (score, addr) = entries.get(i as u32).unwrap();
            result.push_back(LeaderboardEntry {
                participant: addr,
                score,
                rank: (i + 1) as u32,
            });
        }
        result
    }

    pub(crate) fn incentive_in_window(incentive: &Incentive, now: u64) -> bool {
        if !incentive.active {
            return false;
        }
        if let Some(starts) = incentive.starts_at {
            if now < starts {
                return false;
            }
        }
        if let Some(ends) = incentive.ends_at {
            if now >= ends {
                return false;
            }
        }
        true
    }

    pub(crate) fn check_admin(env: &Env, caller: &Address) -> Result<(), Error> {
        let admins: Vec<Address> = env.storage().instance().get(&ADMINS).expect("Admin not set");
        if !admins.contains(caller) {
            return Err(Error::Unauthorized);
        }
        Ok(())
    }
}
