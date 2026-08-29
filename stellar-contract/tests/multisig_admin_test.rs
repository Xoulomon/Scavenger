use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Symbol, Vec,
};
use stellar_scavngr_contract::{AdminAction, ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ── Helpers ──────────────────────────────────────────────────────────────────

fn setup_single() -> (Env, ScavengerContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    (env, client, admin)
}

/// Returns (env, client, admin1, admin2, admin3) with threshold=2.
fn setup_multisig() -> (Env, ScavengerContractClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &id);

    let a1 = Address::generate(&env);
    let a2 = Address::generate(&env);
    let a3 = Address::generate(&env);

    client.initialize_admin(&a1);

    // Add a2 and a3 as admins
    client.add_admin(&a1, &a2);
    client.add_admin(&a1, &a3);

    // Set threshold to 2-of-3
    client.set_multisig_threshold(&a1, &2);

    (env, client, a1, a2, a3)
}

fn new_admin_list(env: &Env, addrs: &[&Address]) -> Vec<Address> {
    let mut v = Vec::new(env);
    for a in addrs {
        v.push_back((*a).clone());
    }
    v
}

// ── 1. Default threshold is 1 ────────────────────────────────────────────────

#[test]
fn test_default_threshold_is_one() {
    let (_, client, _) = setup_single();
    assert_eq!(client.get_multisig_threshold(), 1);
}

// ── 2. Set threshold ─────────────────────────────────────────────────────────

#[test]
fn test_set_threshold() {
    let (env, client, a1) = setup_single();
    let a2 = Address::generate(&env);
    client.add_admin(&a1, &a2);
    client.set_multisig_threshold(&a1, &2);
    assert_eq!(client.get_multisig_threshold(), 2);
}

// ── 3. Threshold 0 rejected ───────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Threshold must be between 1 and the number of admins")]
fn test_threshold_zero_rejected() {
    let (_, client, admin) = setup_single();
    client.set_multisig_threshold(&admin, &0);
}

// ── 4. Threshold > admin count rejected ──────────────────────────────────────

#[test]
#[should_panic(expected = "Threshold must be between 1 and the number of admins")]
fn test_threshold_exceeds_admin_count() {
    let (_, client, admin) = setup_single();
    client.set_multisig_threshold(&admin, &2); // only 1 admin
}

// ── 5. Propose action — proposer auto-approved ───────────────────────────────

#[test]
fn test_propose_auto_approves_proposer() {
    let (env, client, a1, a2, _) = setup_multisig();
    let new_admins = new_admin_list(&env, &[&a1, &a2]);
    let proposal = client.propose_admin_action(&a1, &AdminAction::TransferAdmin(new_admins));
    assert_eq!(proposal.approvers.len(), 1);
    assert_eq!(proposal.approvers.get(0).unwrap(), a1);
    assert!(!proposal.executed);
}

// ── 6. Second admin approves ──────────────────────────────────────────────────

#[test]
fn test_approve_increments_approvers() {
    let (env, client, a1, a2, _) = setup_multisig();
    let new_admins = new_admin_list(&env, &[&a1, &a2]);
    let proposal = client.propose_admin_action(&a1, &AdminAction::TransferAdmin(new_admins));
    let updated = client.approve_admin_proposal(&a2, &proposal.id);
    assert_eq!(updated.approvers.len(), 2);
}

// ── 7. Duplicate approval rejected ───────────────────────────────────────────

#[test]
#[should_panic(expected = "Already approved")]
fn test_duplicate_approval_rejected() {
    let (env, client, a1, a2, _) = setup_multisig();
    let new_admins = new_admin_list(&env, &[&a1, &a2]);
    let proposal = client.propose_admin_action(&a1, &AdminAction::TransferAdmin(new_admins));
    client.approve_admin_proposal(&a1, &proposal.id); // a1 already approved at propose time
}

// ── 8. Execute before threshold rejected ─────────────────────────────────────

#[test]
#[should_panic(expected = "Insufficient approvals")]
fn test_execute_before_threshold_rejected() {
    let (env, client, a1, a2, _) = setup_multisig();
    let new_admins = new_admin_list(&env, &[&a1, &a2]);
    let proposal = client.propose_admin_action(&a1, &AdminAction::TransferAdmin(new_admins));
    // Only 1 approval (proposer), threshold is 2
    client.execute_admin_proposal(&a1, &proposal.id);
}

// ── 9. Execute TransferAdmin after threshold ──────────────────────────────────

#[test]
fn test_execute_transfer_admin() {
    let (env, client, a1, a2, a3) = setup_multisig();
    let new_admins = new_admin_list(&env, &[&a2, &a3]);
    let proposal = client.propose_admin_action(&a1, &AdminAction::TransferAdmin(new_admins));
    client.approve_admin_proposal(&a2, &proposal.id);
    let executed = client.execute_admin_proposal(&a2, &proposal.id);
    assert!(executed.executed);
    // a2 and a3 are now admins
    let admins = client.get_admins();
    assert!(admins.contains(&a2));
    assert!(admins.contains(&a3));
    assert!(!admins.contains(&a1));
}

// ── 10. Execute SetPercentages ────────────────────────────────────────────────

#[test]
fn test_execute_set_percentages() {
    let (_, client, a1, a2, _) = setup_multisig();
    let proposal = client.propose_admin_action(&a1, &AdminAction::SetPercentages(10, 40));
    client.approve_admin_proposal(&a2, &proposal.id);
    client.execute_admin_proposal(&a1, &proposal.id);
    assert_eq!(client.get_collector_percentage(), Some(10));
    assert_eq!(client.get_owner_percentage(), Some(40));
}

// ── 11. Execute DeactivateWaste ───────────────────────────────────────────────

#[test]
fn test_execute_deactivate_waste() {
    let (env, client, a1, a2, _) = setup_multisig();

    // Register a recycler and create waste
    let recycler = Address::generate(&env);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &Symbol::new(&env, "r"), &0, &0);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);

    let proposal = client.propose_admin_action(&a1, &AdminAction::DeactivateWaste(waste_id));
    client.approve_admin_proposal(&a2, &proposal.id);
    client.execute_admin_proposal(&a1, &proposal.id);

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert!(!waste.is_active);
}

// ── 12. Execute already-executed proposal rejected ───────────────────────────

#[test]
#[should_panic(expected = "Proposal already executed")]
fn test_double_execute_rejected() {
    let (_, client, a1, a2, _) = setup_multisig();
    let proposal = client.propose_admin_action(&a1, &AdminAction::SetPercentages(5, 50));
    client.approve_admin_proposal(&a2, &proposal.id);
    client.execute_admin_proposal(&a1, &proposal.id);
    client.execute_admin_proposal(&a1, &proposal.id); // second execute
}

// ── 13. Expired proposal cannot be approved ───────────────────────────────────

#[test]
#[should_panic(expected = "Proposal expired")]
fn test_expired_proposal_approve_rejected() {
    let (env, client, a1, a2, _) = setup_multisig();
    let proposal = client.propose_admin_action(&a1, &AdminAction::SetPercentages(5, 50));

    // Advance ledger time past 7 days
    env.ledger().with_mut(|l| {
        l.timestamp = proposal.created_at + 7 * 24 * 60 * 60 + 1;
    });

    client.approve_admin_proposal(&a2, &proposal.id);
}

// ── 14. Expired proposal cannot be executed ───────────────────────────────────

#[test]
#[should_panic(expected = "Proposal expired")]
fn test_expired_proposal_execute_rejected() {
    let (env, client, a1, a2, _) = setup_multisig();
    let proposal = client.propose_admin_action(&a1, &AdminAction::SetPercentages(5, 50));
    client.approve_admin_proposal(&a2, &proposal.id);

    env.ledger().with_mut(|l| {
        l.timestamp = proposal.created_at + 7 * 24 * 60 * 60 + 1;
    });

    client.execute_admin_proposal(&a1, &proposal.id);
}

// ── 15. Non-admin cannot propose ─────────────────────────────────────────────

#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn test_non_admin_cannot_propose() {
    let (env, client, _, _, _) = setup_multisig();
    let stranger = Address::generate(&env);
    client.propose_admin_action(&stranger, &AdminAction::SetPercentages(5, 50));
}

// ── 16. Non-admin cannot approve ─────────────────────────────────────────────

#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn test_non_admin_cannot_approve() {
    let (env, client, a1, _, _) = setup_multisig();
    let stranger = Address::generate(&env);
    let proposal = client.propose_admin_action(&a1, &AdminAction::SetPercentages(5, 50));
    client.approve_admin_proposal(&stranger, &proposal.id);
}

// ── 17. get_admin_proposal returns correct data ───────────────────────────────

#[test]
fn test_get_admin_proposal() {
    let (_, client, a1, _, _) = setup_multisig();
    let proposal = client.propose_admin_action(&a1, &AdminAction::SetPercentages(10, 30));
    let fetched = client.get_admin_proposal(&proposal.id);
    assert_eq!(fetched.id, proposal.id);
    assert_eq!(fetched.proposer, a1);
    assert!(!fetched.executed);
}

// ── 18. SetPercentages > 100 rejected at execution ───────────────────────────

#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn test_execute_invalid_percentages_rejected() {
    let (_, client, a1, a2, _) = setup_multisig();
    let proposal = client.propose_admin_action(&a1, &AdminAction::SetPercentages(60, 60));
    client.approve_admin_proposal(&a2, &proposal.id);
    client.execute_admin_proposal(&a1, &proposal.id);
}

// ── 19. Threshold=1 allows single-admin execution ────────────────────────────

#[test]
fn test_threshold_one_single_admin_executes() {
    let (_, client, admin) = setup_single();
    // threshold defaults to 1
    let proposal = client.propose_admin_action(&admin, &AdminAction::SetPercentages(8, 42));
    // proposer auto-approves → threshold met immediately
    let executed = client.execute_admin_proposal(&admin, &proposal.id);
    assert!(executed.executed);
    assert_eq!(client.get_collector_percentage(), Some(8));
}

// ── 20. Multiple proposals are independent ───────────────────────────────────

#[test]
fn test_multiple_proposals_independent() {
    let (_, client, a1, a2, _) = setup_multisig();
    let p1 = client.propose_admin_action(&a1, &AdminAction::SetPercentages(5, 45));
    let p2 = client.propose_admin_action(&a2, &AdminAction::SetPercentages(10, 40));

    // Approve and execute p2 first
    client.approve_admin_proposal(&a1, &p2.id);
    client.execute_admin_proposal(&a1, &p2.id);
    assert_eq!(client.get_collector_percentage(), Some(10));

    // p1 still pending
    let p1_state = client.get_admin_proposal(&p1.id);
    assert!(!p1_state.executed);
}
