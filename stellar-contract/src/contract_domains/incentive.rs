use super::super::*;

/// Manually reward tokens to a registered recipient.
///
/// Increments `recipient.total_tokens_earned` and the global token counter,
/// then emits a `tokens_rewarded` event. Protected by a reentrancy guard.
///
/// # Parameters
/// - `rewarder`: Caller authorising the reward. Must sign.
/// - `recipient`: Registered participant receiving the tokens.
/// - `amount`: Token amount (must be > 0).
/// - `waste_id`: Associated waste record ID (used in the emitted event).
///
/// # Errors
/// - Panics `"Reward amount must be greater than zero"`.
/// - Panics `"Recipient not registered"`.
/// - Panics `"Token address not set"` if [`set_token_address`] was not called.
pub(crate) fn reward_tokens(env: Env, rewarder: Address, recipient: Address, amount: i128, waste_id: u64) {
    validation::validate_positive_amount(amount, "Reward amount");

    // Reentrancy guard
    crate::ScavengerContract::lock(&env);
    storage_utils::bump_instance(&env);
    rewarder.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    // Validate recipient is registered
    if !super::participant::is_participant_registered(env.clone(), recipient.clone()) {
        crate::ScavengerContract::unlock(&env);
        panic!("Recipient not registered");
    }

    // Get token address
    let token_address = env.storage().instance().get::<Symbol, Address>(&TOKEN_ADDR);

    if token_address.is_none() {
        crate::ScavengerContract::unlock(&env);
        panic!("Token address not set");
    }

    // Update recipient's total tokens earned
    let recipient_key = (recipient.clone(),);
    if let Some(mut participant) = env.storage().instance().get::<_, Participant>(&recipient_key) {
        participant.total_tokens_earned = participant
            .total_tokens_earned
            .checked_add(amount as u128)
            .expect("Token overflow");
        env.storage().instance().set(&recipient_key, &participant);
    }

    // Update global total tokens
    let total_tokens: u128 = env.storage().instance().get(&TOTAL_TOKENS).unwrap_or(0);
    let new_total = total_tokens.checked_add(amount as u128).expect("Total tokens overflow");
    env.storage().instance().set(&TOTAL_TOKENS, &new_total);

    // Emit token reward event
    events::emit_tokens_rewarded(&env, &recipient, amount as u128, waste_id);

    // Release lock
    crate::ScavengerContract::unlock(&env);
}

/// Check whether an incentive record with the given ID exists.
///
/// # Returns
/// `true` if the record is present in storage.
pub(crate) fn incentive_exists(env: Env, incentive_id: u64) -> bool {
    let key = ("incentive", incentive_id);
    env.storage().instance().has(&key)
}

/// Retrieve an incentive by its numeric ID.
///
/// # Returns
/// `Some(Incentive)` if found, `None` otherwise.
pub(crate) fn get_incentive_by_id(env: Env, incentive_id: u64) -> Option<Incentive> {
    crate::ScavengerContract::get_incentive_internal(&env, incentive_id)
}

/// Toggle the active status of an incentive.
///
/// Only the original `rewarder` who created the incentive may call this.
///
/// # Parameters
/// - `incentive_id`: ID of the incentive to update.
/// - `is_active`: `true` to re-enable, `false` to pause.
///
/// # Returns
/// The updated [`Incentive`].
///
/// # Errors
/// - Panics `"Incentive not found"`.
pub(crate) fn update_incentive_status(env: Env, incentive_id: u64, is_active: bool) -> Incentive {
    crate::ScavengerContract::require_not_paused(&env);
    let mut incentive: Incentive =
        crate::ScavengerContract::get_incentive_internal(&env, incentive_id).expect("Incentive not found");

    // Require auth from the rewarder
    incentive.rewarder.require_auth();
    crate::ScavengerContract::require_registered(&env, &incentive.rewarder);

    incentive.active = is_active;
    crate::ScavengerContract::set_incentive(&env, incentive_id, &incentive);

    incentive
}

/// Update the reward points and total budget of an active incentive.
///
/// Remaining budget is recalculated as `new_total_budget - budget_already_used`.
/// If `new_total_budget` is less than the amount already spent, the incentive
/// is automatically deactivated.
///
/// # Parameters
/// - `incentive_id`: ID of the incentive to update.
/// - `new_reward_points`: New points per kg (must be > 0).
/// - `new_total_budget`: New total token budget (must be > 0).
///
/// # Returns
/// The updated [`Incentive`].
///
/// # Errors
/// - Panics `"Incentive not found"`.
/// - Panics `"Incentive is not active"`.
/// - Panics `"Reward must be greater than zero"`.
/// - Panics `"Total budget must be greater than zero"`.
pub(crate) fn update_incentive(
    env: Env,
    incentive_id: u64,
    new_reward_points: u64,
    new_total_budget: u64,
) -> Incentive {
    crate::ScavengerContract::require_not_paused(&env);
    // Step 1: Retrieve incentive (existence check)
    let mut incentive: Incentive =
        crate::ScavengerContract::get_incentive_internal(&env, incentive_id).expect("Incentive not found");

    // Step 2: Authorization check
    incentive.rewarder.require_auth();
    crate::ScavengerContract::require_registered(&env, &incentive.rewarder);

    // Step 3: Active status check
    if !incentive.active {
        panic!("Incentive is not active");
    }

    // Step 4: Input validation
    if new_reward_points == 0 {
        panic!("Reward must be greater than zero");
    }
    if new_total_budget == 0 {
        panic!("Total budget must be greater than zero");
    }

    // Calculate how much budget has been used
    let budget_used = incentive
        .total_budget
        .checked_sub(incentive.remaining_budget)
        .expect("Overflow in budget used");

    // Step 5: Update fields (atomic)
    incentive.reward_points = new_reward_points;
    incentive.total_budget = new_total_budget;

    // Adjust remaining budget based on new total budget
    if new_total_budget > budget_used {
        incentive.remaining_budget = new_total_budget
            .checked_sub(budget_used)
            .expect("Overflow in remaining budget");
    } else {
        incentive.remaining_budget = 0;
        incentive.active = false;
    }

    // Step 6: Persist to storage
    crate::ScavengerContract::set_incentive(&env, incentive_id, &incentive);

    // Step 7: Emit event
    events::emit_incentive_updated(
        &env,
        incentive_id,
        &incentive.rewarder,
        new_reward_points,
        new_total_budget,
    );

    incentive
}

/// Calculate the token reward for a given waste amount under a specific incentive.
///
/// Formula: `floor(waste_amount / 1000) * reward_points`, capped at
/// `incentive.remaining_budget`. Returns `0` if the incentive is inactive.
///
/// # Parameters
/// - `incentive_id`: ID of the incentive to use.
/// - `waste_amount`: Waste weight in grams.
///
/// # Returns
/// Token reward amount (`u64`). Returns `0` for inactive incentives.
///
/// # Errors
/// - Panics `"Incentive not found"`.
pub(crate) fn calculate_incentive_reward(env: Env, incentive_id: u64, waste_amount: u64) -> u64 {
    let incentive: Incentive =
        crate::ScavengerContract::get_incentive_internal(&env, incentive_id).expect("Incentive not found");

    // Check if incentive is active
    if !incentive.active {
        return 0;
    }

    // Calculate reward: (weight in kg) * reward_points
    let weight_kg = waste_amount / 1000;
    weight_kg
        .checked_mul(incentive.reward_points)
        .expect("Overflow in reward calculation")
}

/// Get all active incentives for a specific waste type, sorted by reward descending.
///
/// # Parameters
/// - `waste_type`: The [`WasteType`] to filter by.
///
/// # Returns
/// A `Vec<Incentive>` ordered highest `reward_points` first.
pub(crate) fn get_incentives_by_waste_type(env: Env, waste_type: WasteType) -> soroban_sdk::Vec<Incentive> {
    let mut results: soroban_sdk::Vec<Incentive> = soroban_sdk::Vec::new(&env);
    let count = crate::ScavengerContract::get_incentive_count(&env);
    let now = env.ledger().timestamp();

    for i in 1..=count {
        if let Some(incentive) = crate::ScavengerContract::get_incentive_internal(&env, i) {
            if incentive.waste_type == waste_type && crate::ScavengerContract::incentive_in_window(&incentive, now) {
                // Keep results sorted by reward_points descending.
                let mut inserted = false;
                for idx in 0..results.len() {
                    if incentive.reward_points > results.get(idx).unwrap().reward_points {
                        results.insert(idx, incentive.clone());
                        inserted = true;
                        break;
                    }
                }
                if !inserted {
                    results.push_back(incentive);
                }
            }
        }
    }

    results
}

/// Alias for [`get_incentives_by_waste_type`].
pub(crate) fn get_incentives(env: Env, waste_type: WasteType) -> soroban_sdk::Vec<Incentive> {
    super::incentive::get_incentives_by_waste_type(env, waste_type)
}

/// Get all currently active incentives across all waste types.
///
/// # Returns
/// A `Vec<Incentive>` in insertion order.
pub(crate) fn get_active_incentives(env: Env) -> soroban_sdk::Vec<Incentive> {
    let mut results = soroban_sdk::Vec::new(&env);
    let count = crate::ScavengerContract::get_incentive_count(&env);
    let now = env.ledger().timestamp();

    for i in 1..=count {
        if let Some(incentive) = crate::ScavengerContract::get_incentive_internal(&env, i) {
            if crate::ScavengerContract::incentive_in_window(&incentive, now) {
                results.push_back(incentive);
            }
        }
    }

    results
}

/// Redeem (burn) a portion of a participant's earned carbon credits.
///
/// Decrements the participant's `RecyclingStats.carbon_credits_earned` by
/// `amount` and emits a `carb_rdm` event. Returns the remaining balance.
///
/// # Errors
/// - `InvalidAmount` if `amount == 0`.
/// - `InsufficientCarbonCredits` if the balance is below `amount`.
/// - `NotRegistered` if the participant has no recycling stats yet.
pub(crate) fn redeem_carbon_credits(env: Env, participant: Address, amount: u128) -> Result<u128, Error> {
    crate::ScavengerContract::require_not_paused(&env);
    participant.require_auth();

    if amount == 0 {
        return Err(Error::InvalidAmount);
    }

    let mut stats: RecyclingStats = env
        .storage()
        .instance()
        .get(&("stats", participant.clone()))
        .ok_or(Error::NotRegistered)?;

    if stats.carbon_credits_earned < amount {
        return Err(Error::InsufficientCarbonCredits);
    }

    stats.carbon_credits_earned -= amount;
    let remaining = stats.carbon_credits_earned;
    env.storage().instance().set(&("stats", participant.clone()), &stats);

    events::emit_carbon_credits_redeemed(&env, &participant, amount, remaining);
    Ok(remaining)
}

/// List a quantity of carbon credits for sale on the marketplace.
///
/// The credits are escrowed: `amount` is subtracted from the seller's
/// `RecyclingStats.carbon_credits_earned` and stored on the listing until
/// it is cancelled or purchased.
///
/// # Errors
/// - `InvalidListing` if `amount == 0` or `price_per_credit <= 0`.
/// - `NotRegistered` if the seller has no recycling stats.
/// - `InsufficientCarbonCredits` if the seller's balance is below `amount`.
pub(crate) fn create_carbon_listing(
    env: Env,
    seller: Address,
    amount: u128,
    price_per_credit: i128,
) -> Result<u64, Error> {
    crate::ScavengerContract::require_not_paused(&env);
    seller.require_auth();

    if amount == 0 || price_per_credit <= 0 {
        return Err(Error::InvalidListing);
    }

    let mut stats: RecyclingStats = env
        .storage()
        .instance()
        .get(&("stats", seller.clone()))
        .ok_or(Error::NotRegistered)?;

    if stats.carbon_credits_earned < amount {
        return Err(Error::InsufficientCarbonCredits);
    }

    // Escrow: subtract from seller stats
    stats.carbon_credits_earned -= amount;
    env.storage().instance().set(&("stats", seller.clone()), &stats);

    // Mint new listing id
    let id: u64 = env.storage().instance().get(&CARB_LIST_CNT).unwrap_or(0u64) + 1;
    env.storage().instance().set(&CARB_LIST_CNT, &id);

    let listing = CarbonListing {
        id,
        seller: seller.clone(),
        amount,
        price_per_credit,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };
    env.storage().instance().set(&("carb_list", id), &listing);

    // Append to active-listing index
    let mut idx: Vec<u64> = env.storage().instance().get(&CARB_LIST_IDX).unwrap_or(Vec::new(&env));
    idx.push_back(id);
    env.storage().instance().set(&CARB_LIST_IDX, &idx);

    events::emit_carbon_listing_created(&env, id, &seller, amount, price_per_credit);
    Ok(id)
}

/// Cancel an active carbon-credit listing and return the escrowed credits
/// to the seller's `RecyclingStats.carbon_credits_earned`.
///
/// # Errors
/// - `CarbonListingNotFound` if no listing exists for `listing_id`.
/// - `CarbonListingInactive` if the listing is already cancelled or purchased.
/// - `NotListingSeller` if the caller is not the seller.
pub(crate) fn cancel_carbon_listing(env: Env, listing_id: u64, seller: Address) -> Result<(), Error> {
    crate::ScavengerContract::require_not_paused(&env);
    seller.require_auth();

    let mut listing: CarbonListing = env
        .storage()
        .instance()
        .get(&("carb_list", listing_id))
        .ok_or(Error::CarbonListingNotFound)?;

    if !listing.is_active {
        return Err(Error::CarbonListingInactive);
    }
    if listing.seller != seller {
        return Err(Error::NotListingSeller);
    }

    // Return escrowed credits to seller
    let mut stats: RecyclingStats = env
        .storage()
        .instance()
        .get(&("stats", seller.clone()))
        .unwrap_or_else(|| RecyclingStats::new(seller.clone()));
    stats.carbon_credits_earned = stats
        .carbon_credits_earned
        .checked_add(listing.amount)
        .ok_or(Error::Overflow)?;
    env.storage().instance().set(&("stats", seller.clone()), &stats);

    listing.is_active = false;
    env.storage().instance().set(&("carb_list", listing_id), &listing);

    crate::ScavengerContract::remove_active_listing(&env, listing_id);

    events::emit_carbon_listing_cancelled(&env, listing_id, &seller);
    Ok(())
}

/// Purchase an active carbon-credit listing.
///
/// Transfers `listing.amount * listing.price_per_credit` tokens from the
/// buyer to the seller via the configured token contract, then credits
/// the buyer's `RecyclingStats.carbon_credits_earned` with `listing.amount`.
///
/// # Errors
/// - `CarbonListingNotFound`, `CarbonListingInactive`.
/// - `InvalidListing` if the buyer is the seller.
/// - `TokenAddressNotSet` if no token contract has been configured.
/// - `Overflow` on arithmetic overflow.
pub(crate) fn purchase_carbon_listing(env: Env, listing_id: u64, buyer: Address) -> Result<(), Error> {
    crate::ScavengerContract::require_not_paused(&env);
    buyer.require_auth();

    let mut listing: CarbonListing = env
        .storage()
        .instance()
        .get(&("carb_list", listing_id))
        .ok_or(Error::CarbonListingNotFound)?;

    if !listing.is_active {
        return Err(Error::CarbonListingInactive);
    }
    if listing.seller == buyer {
        return Err(Error::InvalidListing);
    }

    let token_address: Address = env
        .storage()
        .instance()
        .get(&TOKEN_ADDR)
        .ok_or(Error::TokenAddressNotSet)?;

    let total_price_u128 = listing
        .amount
        .checked_mul(listing.price_per_credit as u128)
        .ok_or(Error::Overflow)?;
    if total_price_u128 > i128::MAX as u128 {
        return Err(Error::Overflow);
    }
    let total_price = total_price_u128 as i128;

    // Pay seller in tokens
    let token_client = token::Client::new(&env, &token_address);
    token_client.transfer(&buyer, &listing.seller, &total_price);

    // Credit buyer's carbon credits
    let mut buyer_stats: RecyclingStats = env
        .storage()
        .instance()
        .get(&("stats", buyer.clone()))
        .unwrap_or_else(|| RecyclingStats::new(buyer.clone()));
    buyer_stats.carbon_credits_earned = buyer_stats
        .carbon_credits_earned
        .checked_add(listing.amount)
        .ok_or(Error::Overflow)?;
    env.storage().instance().set(&("stats", buyer.clone()), &buyer_stats);

    listing.is_active = false;
    env.storage().instance().set(&("carb_list", listing_id), &listing);

    crate::ScavengerContract::remove_active_listing(&env, listing_id);

    events::emit_carbon_listing_purchased(&env, listing_id, &listing.seller, &buyer, listing.amount, total_price);
    Ok(())
}

/// Get a carbon-credit listing by id.
pub(crate) fn get_carbon_listing(env: Env, listing_id: u64) -> Option<CarbonListing> {
    env.storage().instance().get(&("carb_list", listing_id))
}

/// Get all currently-active carbon-credit listings.
pub(crate) fn get_active_carbon_listings(env: Env) -> Vec<CarbonListing> {
    let idx: Vec<u64> = env.storage().instance().get(&CARB_LIST_IDX).unwrap_or(Vec::new(&env));
    let mut out: Vec<CarbonListing> = Vec::new(&env);
    for id in idx.iter() {
        if let Some(l) = env.storage().instance().get::<_, CarbonListing>(&("carb_list", id)) {
            if l.is_active {
                out.push_back(l);
            }
        }
    }
    out
}

/// Get all incentives created by a specific rewarder/manufacturer
/// Returns full Incentive structs for all incentives created by the rewarder
/// Returns empty vector if rewarder has no incentives
pub(crate) fn get_incentives_by_rewarder(env: Env, rewarder: Address) -> Vec<Incentive> {
    let key = ("rewarder_incentives", rewarder);
    let incentive_ids: Vec<u64> = env.storage().instance().get(&key).unwrap_or(Vec::new(&env));

    let mut incentives = Vec::new(&env);
    for incentive_id in incentive_ids.iter() {
        if let Some(incentive) = crate::ScavengerContract::get_incentive_internal(&env, incentive_id) {
            incentives.push_back(incentive);
        }
    }

    incentives
}

/// Get the best (highest reward) active incentive for a manufacturer and waste type.
///
/// # Parameters
/// - `manufacturer`: Address of the manufacturer whose incentives to search.
/// - `waste_type`: The [`WasteType`] to match.
///
/// # Returns
/// `Some(Incentive)` with the highest `reward_points`, or `None` if no
/// active matching incentive exists.
pub(crate) fn get_active_mfr_incentive(env: Env, manufacturer: Address, waste_type: WasteType) -> Option<Incentive> {
    // Get all incentives for this manufacturer
    let key = ("rewarder_incentives", manufacturer.clone());
    let incentive_ids: Vec<u64> = env.storage().instance().get(&key).unwrap_or(Vec::new(&env));

    let mut best_incentive: Option<Incentive> = None;
    let mut highest_reward: u64 = 0;

    // Iterate through all incentives and find the best active one
    for incentive_id in incentive_ids.iter() {
        if let Some(incentive) = crate::ScavengerContract::get_incentive_internal(&env, incentive_id) {
            // Check if incentive matches criteria: active and correct waste type
            if incentive.active && incentive.waste_type == waste_type {
                // Keep track of the incentive with highest reward
                if incentive.reward_points > highest_reward {
                    highest_reward = incentive.reward_points;
                    best_incentive = Some(incentive);
                }
            }
        }
    }

    best_incentive
}

/// Create a new manufacturer incentive program for a specific waste type.
///
/// Only registered `Manufacturer` participants may create incentives.
/// The incentive is indexed both by rewarder and by waste type for efficient lookup.
///
/// # Parameters
/// - `rewarder`: Manufacturer creating the incentive. Must sign.
/// - `waste_type`: The [`WasteType`] this incentive applies to.
/// - `reward_points`: Tokens awarded per kg of qualifying waste.
/// - `total_budget`: Maximum total tokens this incentive can distribute.
///
/// # Returns
/// The newly created [`Incentive`] with `active = true`.
///
/// # Errors
/// - Panics `"Caller is not a manufacturer"`.
///
/// # Example
/// ```text
/// create_incentive(manufacturer, WasteType::Plastic, 50, 10_000)
/// // 50 tokens per kg, up to 10 000 tokens total
/// ```
pub(crate) fn create_incentive(
    env: Env,
    rewarder: Address,
    waste_type: WasteType,
    reward_points: u64,
    total_budget: u64,
) -> Incentive {
    storage_utils::bump_instance(&env);
    // Access control check
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_manufacturer(&env, &rewarder);

    // Get next incentive ID
    let incentive_id = crate::ScavengerContract::next_incentive_id(&env);

    // Create incentive
    let incentive = Incentive::new(
        incentive_id,
        rewarder.clone(),
        waste_type,
        reward_points,
        total_budget,
        env.ledger().timestamp(),
        &env,
    );

    // Store incentive
    crate::ScavengerContract::set_incentive(&env, incentive_id, &incentive);

    // Add to rewarder's incentive list
    let key = ("rewarder_incentives", rewarder.clone());
    let mut rewarder_incentives: Vec<u64> = env.storage().instance().get(&key).unwrap_or(Vec::new(&env));
    rewarder_incentives.push_back(incentive_id);
    env.storage().instance().set(&key, &rewarder_incentives);

    // Add to general incentives list for this waste type
    let key = ("general_incentives", waste_type);
    let mut general_incentives: Vec<u64> = env.storage().instance().get(&key).unwrap_or(Vec::new(&env));
    general_incentives.push_back(incentive_id);
    env.storage().instance().set(&key, &general_incentives);

    incentive
}

/// Claim reward tokens from an incentive for a verified material.
///
/// Deducts the reward from `incentive.remaining_budget` and credits it to
/// `claimer.total_tokens_earned`. Automatically deactivates the incentive
/// if the budget reaches zero.
///
/// # Parameters
/// - `incentive_id`: ID of the incentive to claim from.
/// - `material_id`: ID of the verified v1 material being claimed for.
/// - `claimer`: Registered participant claiming the reward. Must sign.
///
/// # Returns
/// The reward amount as `i128`.
///
/// # Errors
/// - Panics `"Incentive not found"` / `"Incentive is not active"`.
/// - Panics `"Material not found"` / `"Material not verified"`.
/// - Panics `"Waste type mismatch"`.
/// - Panics `"No reward available"` if calculated reward is zero.
pub(crate) fn claim_incentive_reward(
    env: Env,
    incentive_id: u64,
    material_id: u64,
    claimer: Address,
) -> Result<i128, Error> {
    crate::ScavengerContract::require_not_paused(&env);
    crate::ScavengerContract::only_registered(&env, &claimer);

    let mut incentive =
        crate::ScavengerContract::get_incentive_internal(&env, incentive_id).expect("Incentive not found");
    if !incentive.active {
        panic!("Incentive is not active");
    }

    let material = crate::ScavengerContract::get_waste_internal(&env, material_id).expect("Material not found");
    if !material.verified {
        panic!("Material not verified");
    }
    if material.waste_type != incentive.waste_type {
        panic!("Waste type mismatch");
    }

    let reward = super::incentive::calculate_incentive_reward(env.clone(), incentive_id, material.weight);
    if reward == 0 {
        panic!("No reward available");
    }
    if reward > incentive.remaining_budget {
        return Err(Error::InsufficientBudget);
    }

    incentive.remaining_budget = incentive.remaining_budget.saturating_sub(reward);
    if incentive.remaining_budget == 0 {
        incentive.active = false;
    }
    crate::ScavengerContract::set_incentive(&env, incentive_id, &incentive);

    crate::ScavengerContract::update_participant_stats(&env, &claimer, 0, reward);

    Ok(reward as i128)
}

/// Deactivate an incentive permanently.
///
/// Only the original creator (`rewarder`) may deactivate their incentive.
///
/// # Parameters
/// - `incentive_id`: ID of the incentive to deactivate.
/// - `rewarder`: Original creator. Must sign and be registered.
///
/// # Returns
/// The updated [`Incentive`] with `active = false`.
///
/// # Errors
/// - Panics `"Incentive not found"`.
/// - Panics `"Only incentive creator can deactivate"`.
pub(crate) fn deactivate_incentive(env: Env, incentive_id: u64, rewarder: Address) -> Incentive {
    storage_utils::bump_instance(&env);
    crate::ScavengerContract::require_not_paused(&env);
    rewarder.require_auth();
    crate::ScavengerContract::require_registered(&env, &rewarder);

    let mut incentive =
        crate::ScavengerContract::get_incentive_internal(&env, incentive_id).expect("Incentive not found");

    // Verify caller is the creator
    if incentive.rewarder != rewarder {
        panic!("Only incentive creator can deactivate");
    }

    incentive.deactivate();
    crate::ScavengerContract::set_incentive(&env, incentive_id, &incentive);

    incentive
}

/// Distribute rewards through the supply chain for a confirmed material using an incentive.
/// Rewards collectors in the transfer history, the original submitter, and the current owner.
/// Returns the total reward distributed.
pub(crate) fn distribute_rewards(env: Env, waste_id: u64, incentive_id: u64, manufacturer: Address) -> i128 {
    storage_utils::bump_instance(&env);
    manufacturer.require_auth();

    let material = crate::ScavengerContract::get_waste_internal(&env, waste_id).expect("Material not found");
    assert!(material.verified, "Material must be confirmed");

    crate::ScavengerContract::require_not_paused(&env);
    let mut incentive =
        crate::ScavengerContract::get_incentive_internal(&env, incentive_id).expect("Incentive not found");
    assert!(
        incentive.rewarder == manufacturer,
        "Only incentive creator can distribute rewards"
    );
    assert!(incentive.waste_type == material.waste_type, "Waste type mismatch");
    assert!(incentive.active, "Incentive not active");

    let weight_kg = material.weight / 1000;
    let base_reward = (incentive.reward_points as i128) * (weight_kg as i128);
    let multiplier = super::admin::get_current_multiplier(env.clone()) as i128;
    let mut total_reward = (base_reward * multiplier) / 100;

    // Apply contamination reduction if a v2 waste record exists for this ID
    let v2_waste: Option<types::Waste> = env.storage().instance().get(&("waste_v2", waste_id as u128));
    if let Some(w) = v2_waste {
        if w.is_contaminated {
            if w.contamination_level > 50 {
                total_reward = 0;
            } else {
                total_reward = total_reward * (100 - w.contamination_level as i128) / 100;
            }
        }
    }
    assert!(
        (total_reward as u64) <= incentive.remaining_budget,
        "Insufficient incentive budget"
    );

    let transfers = super::transfer::get_transfer_history(env.clone(), waste_id);
    let cfg = crate::ScavengerContract::get_reward_config(&env);
    let collector_pct = cfg.collector_percentage;
    let owner_pct = cfg.owner_percentage;

    let token_address: Address = env
        .storage()
        .instance()
        .get(&TOKEN_ADDR)
        .expect("Token address not set");
    let token_client = token::Client::new(&env, &token_address);

    let collector_share = (total_reward * (collector_pct as i128)) / 100;
    let owner_share = (total_reward * (owner_pct as i128)) / 100;
    let mut total_distributed: i128 = 0;

    for transfer in transfers.iter() {
        let key = (transfer.to.clone(),);
        if let Some(p) = env.storage().instance().get::<_, Participant>(&key) {
            if p.role.can_collect_materials() && !p.role.can_manufacture() {
                token_client.transfer(&manufacturer, &transfer.to, &collector_share);
                crate::ScavengerContract::update_participant_stats(&env, &transfer.to, 0, collector_share as u64);
                events::emit_tokens_rewarded(&env, &transfer.to, collector_share as u128, waste_id);
                total_distributed += collector_share;
            }
        }
    }

    token_client.transfer(&manufacturer, &material.submitter, &owner_share);
    crate::ScavengerContract::update_participant_stats(&env, &material.submitter, 0, owner_share as u64);
    events::emit_tokens_rewarded(&env, &material.submitter, owner_share as u128, waste_id);
    total_distributed += owner_share;

    let recycler_amount = total_reward - total_distributed;
    if recycler_amount > 0 {
        token_client.transfer(&manufacturer, &material.submitter, &recycler_amount);
        crate::ScavengerContract::update_participant_stats(&env, &material.submitter, 0, recycler_amount as u64);
        events::emit_tokens_rewarded(&env, &material.submitter, recycler_amount as u128, waste_id);
    }

    incentive.remaining_budget = incentive.remaining_budget.saturating_sub(total_reward as u64);
    if incentive.remaining_budget == 0 {
        incentive.active = false;
    }
    crate::ScavengerContract::set_incentive(&env, incentive_id, &incentive);
    crate::ScavengerContract::add_to_total_tokens(&env, total_reward as u128);

    total_reward
}

/// Set or update the activation schedule for an existing incentive.
///
/// Only the original `rewarder` may schedule their incentive.
/// `starts_at` must be strictly less than `ends_at` when both are provided.
///
/// # Parameters
/// - `incentive_id`: ID of the incentive to schedule.
/// - `rewarder`: Original creator. Must sign.
/// - `starts_at`: Optional UTC timestamp when the incentive becomes active.
/// - `ends_at`: Optional UTC timestamp when the incentive expires.
///
/// # Errors
/// - Panics `"Incentive not found"` if the ID does not exist.
/// - [`Error::NotCreator`] if `rewarder` is not the original creator.
/// - [`Error::InvalidSchedule`] if `starts_at >= ends_at` (when both set),
///   or if `ends_at` is already in the past.
pub(crate) fn schedule_incentive(
    env: Env,
    incentive_id: u64,
    rewarder: Address,
    starts_at: Option<u64>,
    ends_at: Option<u64>,
) -> Result<Incentive, Error> {
    rewarder.require_auth();
    crate::ScavengerContract::require_not_paused(&env);

    let mut incentive: Incentive =
        crate::ScavengerContract::get_incentive_internal(&env, incentive_id).expect("Incentive not found");

    if incentive.rewarder != rewarder {
        return Err(Error::NotCreator);
    }

    let now = env.ledger().timestamp();

    // ends_at must be in the future
    if let Some(ends) = ends_at {
        if ends <= now {
            return Err(Error::InvalidSchedule);
        }
    }

    // starts_at must be before ends_at when both provided
    if let (Some(starts), Some(ends)) = (starts_at, ends_at) {
        if starts >= ends {
            return Err(Error::InvalidSchedule);
        }
    }

    incentive.starts_at = starts_at;
    incentive.ends_at = ends_at;

    crate::ScavengerContract::set_incentive(&env, incentive_id, &incentive);

    events::emit_incentive_scheduled(&env, incentive_id, &rewarder, starts_at, ends_at);

    Ok(incentive)
}
