use super::*;

#[cfg(test)]
mod recycling_stats_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_new_stats() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let stats = RecyclingStats::new(participant.clone());

        assert_eq!(stats.participant, participant);
        assert_eq!(stats.total_submissions, 0);
        assert_eq!(stats.verified_submissions, 0);
        assert_eq!(stats.total_weight, 0);
        assert_eq!(stats.total_points, 0);
    }

    #[test]
    fn test_record_submission() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut stats = RecyclingStats::new(participant.clone());
        let material = Material::new(1, WasteType::Paper, 5000, participant, 0, description);

        stats.record_submission(&material);

        assert_eq!(stats.total_submissions, 1);
        assert_eq!(stats.total_weight, 5000);
        assert_eq!(stats.paper_count, 1);
    }

    #[test]
    fn test_record_verification() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut stats = RecyclingStats::new(participant.clone());
        let mut material = Material::new(1, WasteType::Metal, 5000, participant, 0, description);

        material.verify();
        stats.record_verification(&material);

        assert_eq!(stats.verified_submissions, 1);
        assert_eq!(stats.total_points, 250); // 5kg * 5 * 10
    }

    #[test]
    fn test_verification_rate() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        stats.total_submissions = 10;
        stats.verified_submissions = 8;

        assert_eq!(stats.verification_rate(), 80);
    }

    #[test]
    fn test_most_submitted_type() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        stats.paper_count = 5;
        stats.plastic_count = 10;
        stats.metal_count = 3;

        assert_eq!(stats.most_submitted_type(), Some(WasteType::Plastic));
    }

    #[test]
    fn test_average_weight() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        stats.total_submissions = 5;
        stats.total_weight = 10000;

        assert_eq!(stats.average_weight(), 2000);
    }

    #[test]
    fn test_is_active_recycler() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        assert!(!stats.is_active_recycler());

        stats.total_submissions = 10;
        assert!(stats.is_active_recycler());
    }

    #[test]
    fn test_is_verified_contributor() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        stats.total_submissions = 10;
        stats.verified_submissions = 8;

        assert!(stats.is_verified_contributor());
    }

    #[test]
    fn test_stats_storage() {
        let env = soroban_sdk::Env::default();
        let _contract_id = env.register_contract(None, crate::ScavengerContract);
        let participant = Address::generate(&env);

        let stats = RecyclingStats::new(participant.clone());

        // RecyclingStats can be stored (validated through contract tests)
        assert_eq!(stats.total_submissions, 0);
    }

    #[test]
    #[should_panic(expected = "Overflow in total submissions")]
    fn test_record_submission_overflows_at_u64_max_total_submissions() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut stats = RecyclingStats::new(participant.clone());
        stats.total_submissions = u64::MAX;
        let material = Material::new(1, WasteType::Paper, 1, participant, 0, description);

        stats.record_submission(&material);
    }

    #[test]
    #[should_panic(expected = "Overflow in total weight")]
    fn test_record_submission_overflows_at_u64_max_total_weight() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut stats = RecyclingStats::new(participant.clone());
        stats.total_weight = u64::MAX;
        let material = Material::new(1, WasteType::Paper, 1, participant, 0, description);

        stats.record_submission(&material);
    }

    #[test]
    #[should_panic(expected = "Overflow in total points")]
    fn test_record_verification_overflows_at_u64_max_total_points() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut stats = RecyclingStats::new(participant.clone());
        stats.total_points = u64::MAX;
        let mut material = Material::new(1, WasteType::Metal, 1000, participant, 0, description);
        material.verify();

        stats.record_verification(&material);
    }

    #[test]
    #[should_panic(expected = "Overflow in verification rate")]
    fn test_verification_rate_overflows_at_extreme_verified_submissions() {
        let env = soroban_sdk::Env::default();
        let participant = Address::generate(&env);

        let mut stats = RecyclingStats::new(participant);
        stats.total_submissions = 1;
        stats.verified_submissions = u64::MAX;

        stats.verification_rate();
    }
}

#[cfg(test)]
mod material_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_material_creation() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Plastic bottles");

        let material = Material::new(
            1,
            WasteType::PetPlastic,
            5000,
            submitter.clone(),
            1234567890,
            description.clone(),
        );

        assert_eq!(material.id, 1);
        assert_eq!(material.waste_type, WasteType::PetPlastic);
        assert_eq!(material.weight, 5000);
        assert_eq!(material.submitter, submitter);
        assert_eq!(material.submitted_at, 1234567890);
        assert!(!material.verified);
        assert_eq!(material.description, description);
    }

    #[test]
    fn test_material_verify() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let mut material = Material::new(1, WasteType::Paper, 1000, submitter, 1234567890, description);

        assert!(!material.verified);
        material.verify();
        assert!(material.verified);
    }

    #[test]
    fn test_meets_minimum_weight() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        let material_below = Material::new(
            1,
            WasteType::Paper,
            50,
            submitter.clone(),
            1234567890,
            description.clone(),
        );
        assert!(!material_below.meets_minimum_weight());

        let material_exact = Material::new(
            2,
            WasteType::Paper,
            100,
            submitter.clone(),
            1234567890,
            description.clone(),
        );
        assert!(material_exact.meets_minimum_weight());

        let material_above = Material::new(3, WasteType::Paper, 500, submitter, 1234567890, description);
        assert!(material_above.meets_minimum_weight());
    }

    #[test]
    fn test_calculate_reward_points() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        // Paper: 5kg * 1 * 10 = 50 points
        let paper = Material::new(1, WasteType::Paper, 5000, submitter.clone(), 0, description.clone());
        assert_eq!(paper.calculate_reward_points(), 50);

        // PetPlastic: 5kg * 3 * 10 = 150 points
        let pet = Material::new(
            2,
            WasteType::PetPlastic,
            5000,
            submitter.clone(),
            0,
            description.clone(),
        );
        assert_eq!(pet.calculate_reward_points(), 150);

        // Plastic: 5kg * 2 * 10 = 100 points
        let plastic = Material::new(3, WasteType::Plastic, 5000, submitter.clone(), 0, description.clone());
        assert_eq!(plastic.calculate_reward_points(), 100);

        // Metal: 5kg * 5 * 10 = 250 points
        let metal = Material::new(4, WasteType::Metal, 5000, submitter.clone(), 0, description.clone());
        assert_eq!(metal.calculate_reward_points(), 250);

        // Glass: 5kg * 2 * 10 = 100 points
        let glass = Material::new(5, WasteType::Glass, 5000, submitter, 0, description);
        assert_eq!(glass.calculate_reward_points(), 100);
    }

    #[test]
    fn test_material_storage_compatibility() {
        let env = soroban_sdk::Env::default();
        let _contract_id = env.register_contract(None, crate::ScavengerContract);
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Storage test");

        let material = Material::new(1, WasteType::Metal, 3000, submitter, 1234567890, description);

        // Material can be stored in Soroban storage (validated through contract tests)
        assert_eq!(material.id, 1);
        assert_eq!(material.waste_type, WasteType::Metal);
        assert_eq!(material.weight, 3000);
    }

    #[test]
    fn test_calculate_reward_points_at_u64_max_weight_does_not_overflow() {
        let env = soroban_sdk::Env::default();
        let submitter = Address::generate(&env);
        let description = String::from_str(&env, "Test");

        // weight/1000 shrinks u64::MAX enough that * multiplier(<=5) * 10 cannot overflow u64.
        let material = Material::new(1, WasteType::Metal, u64::MAX, submitter, 0, description);
        assert_eq!(material.calculate_reward_points(), (u64::MAX / 1000) * 50);
    }
}

#[cfg(test)]
mod incentive_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    #[should_panic(expected = "Overflow in reward calculation")]
    fn test_calculate_reward_overflows_at_extreme_reward_points() {
        let env = soroban_sdk::Env::default();
        let rewarder = Address::generate(&env);

        let incentive = Incentive::new(1, rewarder, WasteType::Metal, u64::MAX, u64::MAX, 0);
        // 5000g -> 5kg, 5 * u64::MAX overflows u64
        incentive.calculate_reward(5000);
    }

    #[test]
    fn test_claim_reward_respects_remaining_budget() {
        let env = soroban_sdk::Env::default();
        let rewarder = Address::generate(&env);

        let mut incentive = Incentive::new(1, rewarder, WasteType::Metal, 10, 45, 0);
        // 5kg * 10 = 50 > 45 remaining budget -> rejected
        assert_eq!(incentive.claim_reward(5000), None);
        assert_eq!(incentive.remaining_budget, 45);

        // 4kg * 10 = 40 <= 45 remaining budget -> accepted, deactivates only when exhausted
        assert_eq!(incentive.claim_reward(4000), Some(40));
        assert_eq!(incentive.remaining_budget, 5);
        assert!(incentive.active);
    }

    #[test]
    fn test_claim_reward_deactivates_on_exact_budget_exhaustion() {
        let env = soroban_sdk::Env::default();
        let rewarder = Address::generate(&env);

        let mut incentive = Incentive::new(1, rewarder, WasteType::Metal, 10, 50, 0);
        assert_eq!(incentive.claim_reward(5000), Some(50));
        assert_eq!(incentive.remaining_budget, 0);
        assert!(!incentive.active);
    }
}

#[cfg(test)]
mod waste_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    fn make_waste(env: &Env, owner: Address, latitude: i128, longitude: i128) -> Waste {
        Waste::new(
            1,
            WasteType::Metal,
            5000,
            owner.clone(),
            latitude,
            longitude,
            0,
            true,
            false,
            owner,
        )
    }

    #[test]
    fn test_new_sets_all_fields() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let confirmer = Address::generate(&env);
        let waste = Waste::new(
            7,
            WasteType::Glass,
            250,
            owner.clone(),
            1,
            2,
            99,
            false,
            true,
            confirmer.clone(),
        );

        assert_eq!(waste.waste_id, 7);
        assert_eq!(waste.waste_type, WasteType::Glass);
        assert_eq!(waste.weight, 250);
        assert_eq!(waste.current_owner, owner);
        assert_eq!(waste.latitude, 1);
        assert_eq!(waste.longitude, 2);
        assert_eq!(waste.recycled_timestamp, 99);
        assert!(!waste.is_active);
        assert!(waste.is_confirmed);
        assert_eq!(waste.confirmer, confirmer);
    }

    #[test]
    fn test_has_valid_coordinates() {
        let env = Env::default();
        let owner = Address::generate(&env);

        assert!(make_waste(&env, owner.clone(), 0, 0).has_valid_coordinates());
        assert!(make_waste(&env, owner.clone(), 90_000_000, 180_000_000).has_valid_coordinates());
        assert!(make_waste(&env, owner.clone(), -90_000_000, -180_000_000).has_valid_coordinates());
        assert!(!make_waste(&env, owner.clone(), 90_000_001, 0).has_valid_coordinates());
        assert!(!make_waste(&env, owner, 0, 180_000_001).has_valid_coordinates());
    }

    #[test]
    fn test_is_recycled() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let mut waste = make_waste(&env, owner, 0, 0);

        assert!(!waste.is_recycled());
        waste.mark_recycled(12345);
        assert!(waste.is_recycled());
        assert_eq!(waste.recycled_timestamp, 12345);
    }

    #[test]
    fn test_waste_meets_minimum_weight() {
        let env = Env::default();
        let owner = Address::generate(&env);

        let mut light = make_waste(&env, owner.clone(), 0, 0);
        light.weight = 99;
        assert!(!light.meets_minimum_weight());

        let mut exact = make_waste(&env, owner, 0, 0);
        exact.weight = 100;
        assert!(exact.meets_minimum_weight());
    }

    #[test]
    fn test_update_location() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let mut waste = make_waste(&env, owner, 0, 0);

        waste.update_location(45_000_000, -93_000_000);
        assert_eq!(waste.latitude, 45_000_000);
        assert_eq!(waste.longitude, -93_000_000);
    }
}

#[cfg(test)]
mod transfer_record_tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_transfer_item_type_round_trip() {
        for (variant, value) in [
            (TransferItemType::Material, 0u32),
            (TransferItemType::Token, 1),
            (TransferItemType::Incentive, 2),
            (TransferItemType::Ownership, 3),
        ] {
            assert!(TransferItemType::is_valid(value));
            assert_eq!(TransferItemType::from_u32(value), Some(variant));
            assert_eq!(variant.to_u32(), value);
        }
        assert!(!TransferItemType::is_valid(4));
        assert_eq!(TransferItemType::from_u32(4), None);
    }

    #[test]
    fn test_transfer_status_round_trip_and_state() {
        for (variant, value, is_final, is_active) in [
            (TransferStatus::Pending, 0u32, false, true),
            (TransferStatus::InProgress, 1, false, true),
            (TransferStatus::Completed, 2, true, false),
            (TransferStatus::Failed, 3, true, false),
            (TransferStatus::Cancelled, 4, true, false),
        ] {
            assert!(TransferStatus::is_valid(value));
            assert_eq!(TransferStatus::from_u32(value), Some(variant));
            assert_eq!(variant.to_u32(), value);
            assert_eq!(variant.is_final(), is_final);
            assert_eq!(variant.is_active(), is_active);
        }
        assert!(!TransferStatus::is_valid(5));
        assert_eq!(TransferStatus::from_u32(5), None);
    }

    fn make_record(env: &Env, from: Address, to: Address) -> TransferRecord {
        TransferRecord::new(
            1,
            from,
            to,
            TransferItemType::Material,
            42,
            5000,
            0,
            String::from_str(env, "note"),
        )
    }

    #[test]
    fn test_new_starts_pending() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let record = make_record(&env, from, to);

        assert_eq!(record.status, TransferStatus::Pending);
        assert!(!record.is_complete());
        assert!(record.is_modifiable());
    }

    #[test]
    fn test_update_status_succeeds_while_not_final() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let mut record = make_record(&env, from, to);

        assert!(record.update_status(TransferStatus::InProgress));
        assert_eq!(record.status, TransferStatus::InProgress);

        assert!(record.update_status(TransferStatus::Completed));
        assert_eq!(record.status, TransferStatus::Completed);
        assert!(record.is_complete());
        assert!(!record.is_modifiable());
    }

    #[test]
    fn test_update_status_rejected_once_final() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let mut record = make_record(&env, from, to);

        assert!(record.update_status(TransferStatus::Cancelled));
        // Status is final; further updates must be rejected and leave state unchanged.
        assert!(!record.update_status(TransferStatus::Pending));
        assert_eq!(record.status, TransferStatus::Cancelled);
    }

    #[test]
    fn test_validate_rejects_zero_amount() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let mut record = make_record(&env, from, to);
        record.amount = 0;

        assert_eq!(record.validate(), Err("Amount must be greater than zero"));
    }

    #[test]
    fn test_validate_rejects_same_sender_and_recipient() {
        let env = Env::default();
        let addr = Address::generate(&env);
        let record = make_record(&env, addr.clone(), addr);

        assert_eq!(record.validate(), Err("Sender and recipient cannot be the same"));
    }

    #[test]
    fn test_validate_accepts_well_formed_record() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let record = make_record(&env, from, to);

        assert_eq!(record.validate(), Ok(()));
    }
}

#[cfg(test)]
mod waste_type_tests {
    use super::*;

    #[test]
    fn test_waste_type_values() {
        assert_eq!(WasteType::Paper as u32, 0);
        assert_eq!(WasteType::PetPlastic as u32, 1);
        assert_eq!(WasteType::Plastic as u32, 2);
        assert_eq!(WasteType::Metal as u32, 3);
        assert_eq!(WasteType::Glass as u32, 4);
        assert_eq!(WasteType::Organic as u32, 5);
        assert_eq!(WasteType::Electronic as u32, 6);
    }

    #[test]
    fn test_waste_type_is_valid() {
        assert!(WasteType::is_valid(0));
        assert!(WasteType::is_valid(1));
        assert!(WasteType::is_valid(2));
        assert!(WasteType::is_valid(3));
        assert!(WasteType::is_valid(4));
        assert!(WasteType::is_valid(5));
        assert!(WasteType::is_valid(6));
        assert!(!WasteType::is_valid(7));
        assert!(!WasteType::is_valid(999));
    }

    #[test]
    fn test_waste_type_from_u32() {
        assert_eq!(WasteType::from_u32(0), Some(WasteType::Paper));
        assert_eq!(WasteType::from_u32(1), Some(WasteType::PetPlastic));
        assert_eq!(WasteType::from_u32(2), Some(WasteType::Plastic));
        assert_eq!(WasteType::from_u32(3), Some(WasteType::Metal));
        assert_eq!(WasteType::from_u32(4), Some(WasteType::Glass));
        assert_eq!(WasteType::from_u32(5), Some(WasteType::Organic));
        assert_eq!(WasteType::from_u32(6), Some(WasteType::Electronic));
        assert_eq!(WasteType::from_u32(7), None);
        assert_eq!(WasteType::from_u32(999), None);
    }

    #[test]
    fn test_waste_type_to_u32() {
        assert_eq!(WasteType::Paper.to_u32(), 0);
        assert_eq!(WasteType::PetPlastic.to_u32(), 1);
        assert_eq!(WasteType::Plastic.to_u32(), 2);
        assert_eq!(WasteType::Metal.to_u32(), 3);
        assert_eq!(WasteType::Glass.to_u32(), 4);
        assert_eq!(WasteType::Organic.to_u32(), 5);
        assert_eq!(WasteType::Electronic.to_u32(), 6);
    }

    #[test]
    fn test_waste_type_as_str() {
        assert_eq!(WasteType::Paper.as_str(), "PAPER");
        assert_eq!(WasteType::PetPlastic.as_str(), "PETPLASTIC");
        assert_eq!(WasteType::Plastic.as_str(), "PLASTIC");
        assert_eq!(WasteType::Metal.as_str(), "METAL");
        assert_eq!(WasteType::Glass.as_str(), "GLASS");
        assert_eq!(WasteType::Organic.as_str(), "ORGANIC");
        assert_eq!(WasteType::Electronic.as_str(), "ELECTRONIC");
    }

    #[test]
    fn test_waste_type_display() {
        assert_eq!(WasteType::Paper.as_str(), "PAPER");
        assert_eq!(WasteType::PetPlastic.as_str(), "PETPLASTIC");
        assert_eq!(WasteType::Plastic.as_str(), "PLASTIC");
        assert_eq!(WasteType::Metal.as_str(), "METAL");
        assert_eq!(WasteType::Glass.as_str(), "GLASS");
        assert_eq!(WasteType::Organic.as_str(), "ORGANIC");
        assert_eq!(WasteType::Electronic.as_str(), "ELECTRONIC");
    }

    #[test]
    fn test_waste_type_is_plastic() {
        assert!(!WasteType::Paper.is_plastic());
        assert!(WasteType::PetPlastic.is_plastic());
        assert!(WasteType::Plastic.is_plastic());
        assert!(!WasteType::Metal.is_plastic());
        assert!(!WasteType::Glass.is_plastic());
    }

    #[test]
    fn test_waste_type_is_biodegradable() {
        assert!(WasteType::Paper.is_biodegradable());
        assert!(!WasteType::PetPlastic.is_biodegradable());
        assert!(!WasteType::Plastic.is_biodegradable());
        assert!(!WasteType::Metal.is_biodegradable());
        assert!(!WasteType::Glass.is_biodegradable());
        assert!(WasteType::Organic.is_biodegradable());
        assert!(!WasteType::Electronic.is_biodegradable());
    }

    #[test]
    fn test_waste_type_is_infinitely_recyclable() {
        assert!(!WasteType::Paper.is_infinitely_recyclable());
        assert!(!WasteType::PetPlastic.is_infinitely_recyclable());
        assert!(!WasteType::Plastic.is_infinitely_recyclable());
        assert!(WasteType::Metal.is_infinitely_recyclable());
        assert!(WasteType::Glass.is_infinitely_recyclable());
    }

    #[test]
    fn test_waste_type_clone_and_copy() {
        let waste1 = WasteType::Paper;
        let waste2 = waste1;
        assert_eq!(waste1, waste2);
    }

    #[test]
    fn test_waste_type_equality() {
        assert_eq!(WasteType::Paper, WasteType::Paper);
        assert_ne!(WasteType::Paper, WasteType::Plastic);
        assert_ne!(WasteType::Metal, WasteType::Glass);
    }

    #[test]
    fn test_all_waste_types() {
        let types = [
            WasteType::Paper,
            WasteType::PetPlastic,
            WasteType::Plastic,
            WasteType::Metal,
            WasteType::Glass,
            WasteType::Organic,
            WasteType::Electronic,
        ];

        for (i, waste_type) in types.iter().enumerate() {
            assert_eq!(waste_type.to_u32(), i as u32);
            assert_eq!(WasteType::from_u32(i as u32), Some(*waste_type));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_role_values() {
        assert_eq!(ParticipantRole::Recycler as u32, 0);
        assert_eq!(ParticipantRole::Collector as u32, 1);
        assert_eq!(ParticipantRole::Manufacturer as u32, 2);
    }

    #[test]
    fn test_is_valid() {
        assert!(ParticipantRole::is_valid(0));
        assert!(ParticipantRole::is_valid(1));
        assert!(ParticipantRole::is_valid(2));
        assert!(!ParticipantRole::is_valid(3));
        assert!(!ParticipantRole::is_valid(999));
    }

    #[test]
    fn test_from_u32() {
        assert_eq!(ParticipantRole::from_u32(0), Some(ParticipantRole::Recycler));
        assert_eq!(ParticipantRole::from_u32(1), Some(ParticipantRole::Collector));
        assert_eq!(ParticipantRole::from_u32(2), Some(ParticipantRole::Manufacturer));
        assert_eq!(ParticipantRole::from_u32(3), None);
        assert_eq!(ParticipantRole::from_u32(999), None);
    }

    #[test]
    fn test_to_u32() {
        assert_eq!(ParticipantRole::Recycler.to_u32(), 0);
        assert_eq!(ParticipantRole::Collector.to_u32(), 1);
        assert_eq!(ParticipantRole::Manufacturer.to_u32(), 2);
    }

    #[test]
    fn test_as_str() {
        assert_eq!(ParticipantRole::Recycler.as_str(), "RECYCLER");
        assert_eq!(ParticipantRole::Collector.as_str(), "COLLECTOR");
        assert_eq!(ParticipantRole::Manufacturer.as_str(), "MANUFACTURER");
    }

    #[test]
    fn test_can_collect_materials() {
        assert!(ParticipantRole::Recycler.can_collect_materials());
        assert!(ParticipantRole::Collector.can_collect_materials());
        assert!(!ParticipantRole::Manufacturer.can_collect_materials());
    }

    #[test]
    fn test_can_manufacture() {
        assert!(!ParticipantRole::Recycler.can_manufacture());
        assert!(!ParticipantRole::Collector.can_manufacture());
        assert!(ParticipantRole::Manufacturer.can_manufacture());
    }

    #[test]
    fn test_can_process_recyclables() {
        assert!(ParticipantRole::Recycler.can_process_recyclables());
        assert!(!ParticipantRole::Collector.can_process_recyclables());
        assert!(!ParticipantRole::Manufacturer.can_process_recyclables());
    }

    #[test]
    fn test_clone_and_copy() {
        let role1 = ParticipantRole::Recycler;
        let role2 = role1;
        assert_eq!(role1, role2);
    }

    #[test]
    fn test_equality() {
        assert_eq!(ParticipantRole::Recycler, ParticipantRole::Recycler);
        assert_ne!(ParticipantRole::Recycler, ParticipantRole::Collector);
        assert_ne!(ParticipantRole::Collector, ParticipantRole::Manufacturer);
    }
}
