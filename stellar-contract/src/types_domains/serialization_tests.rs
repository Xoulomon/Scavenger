use super::*;
use soroban_sdk::{
    testutils::Address as _,
    xdr::{FromXdr, ToXdr},
    Env,
};
use std::fmt::Debug;

fn assert_xdr_round_trip<T>(env: &Env, value: T, name: &str)
where
    T: Clone + Debug + PartialEq + ToXdr + FromXdr,
{
    let bytes = value.clone().to_xdr(env);
    let decoded = T::from_xdr(env, &bytes).unwrap_or_else(|_| panic!("XDR round-trip failed for {name}"));
    assert_eq!(decoded, value, "XDR round-trip changed {name}");
}

fn sample_TransferRecord(env: &Env) -> TransferRecord {
    TransferRecord {
        id: 0,
        from: Address::generate(env),
        to: Address::generate(env),
        item_type: TransferItemType::Material,
        item_id: 0,
        amount: 0,
        timestamp: 0,
        status: TransferStatus::Pending,
        note: String::from_str(env, "snapshot"),
    }
}

fn sample_TransferItemType(_env: &Env) -> TransferItemType {
    TransferItemType::Material
}

fn sample_TransferStatus(_env: &Env) -> TransferStatus {
    TransferStatus::Pending
}

fn sample_IncentiveTier(env: &Env) -> IncentiveTier {
    IncentiveTier {
        min_weight_kg: 0,
        max_weight_kg: 0,
        reward_points: 0,
    }
}

fn sample_Incentive(env: &Env) -> Incentive {
    Incentive {
        id: 0,
        rewarder: Address::generate(env),
        waste_type: WasteType::Paper,
        reward_points: 0,
        total_budget: 0,
        remaining_budget: 0,
        active: false,
        created_at: 0,
        starts_at: None,
        ends_at: None,
        tiers: soroban_sdk::Vec::new(env),
    }
}

fn sample_ParticipantRole(_env: &Env) -> ParticipantRole {
    ParticipantRole::Recycler
}

fn sample_CertificationLevel(_env: &Env) -> CertificationLevel {
    CertificationLevel::Beginner
}

fn sample_WasteType(_env: &Env) -> WasteType {
    WasteType::Paper
}

fn sample_Material(env: &Env) -> Material {
    Material {
        id: 0,
        waste_type: WasteType::Paper,
        weight: 0,
        submitter: Address::generate(env),
        submitted_at: 0,
        verified: false,
        description: String::from_str(env, "snapshot"),
    }
}

fn sample_ImpactScore(env: &Env) -> ImpactScore {
    ImpactScore {
        score: 0,
        calculated_at: 0,
    }
}

fn sample_ImpactHistoryEntry(env: &Env) -> ImpactHistoryEntry {
    ImpactHistoryEntry {
        waste_id: 0,
        score: 0,
        recorded_at: 0,
    }
}

fn sample_ProcessingStatus(_env: &Env) -> ProcessingStatus {
    ProcessingStatus::Collected
}

fn sample_ProcessingRecord(env: &Env) -> ProcessingRecord {
    ProcessingRecord {
        status: ProcessingStatus::Collected,
        timestamp: 0,
        updated_by: Address::generate(env),
    }
}

fn sample_MaterialComposition(env: &Env) -> MaterialComposition {
    MaterialComposition {
        material_type: WasteType::Paper,
        percentage: 0,
    }
}

fn sample_ContaminationReport(env: &Env) -> ContaminationReport {
    ContaminationReport {
        waste_id: 0,
        reporter: Address::generate(env),
        level: 0,
        reason: String::from_str(env, "snapshot"),
        reported_at: 0,
    }
}

fn sample_OptionalWasteType(_env: &Env) -> OptionalWasteType {
    OptionalWasteType::None
}

fn sample_RecyclingGoal(env: &Env) -> RecyclingGoal {
    RecyclingGoal {
        target_weight: 0,
        target_date: 0,
        waste_type: OptionalWasteType::None,
        current_weight: 0,
        achieved: false,
        created_at: 0,
    }
}

fn sample_Waste(env: &Env) -> Waste {
    Waste {
        waste_id: 0,
        waste_type: WasteType::Paper,
        weight: 0,
        current_owner: Address::generate(env),
        latitude: 0,
        longitude: 0,
        recycled_timestamp: 0,
        is_active: false,
        is_frozen: false,
        is_confirmed: false,
        confirmer: Address::generate(env),
        grade: WasteGrade::A,
        tags: soroban_sdk::Vec::new(env),
        image_hash: None,
        document_hashes: soroban_sdk::Vec::new(env),
        expires_at: 0,
        reserved_by: None,
        reserved_until: None,
        is_contaminated: false,
        contamination_level: 0,
        contamination_reason: String::from_str(env, "snapshot"),
        processing_status: ProcessingStatus::Collected,
        processing_history: soroban_sdk::Vec::new(env),
        substitution_history: soroban_sdk::Vec::new(env),
        tracking_code: String::from_str(env, "snapshot"),
        processing_cost: 0,
        composition: soroban_sdk::Vec::new(env),
        impact_score: 0,
    }
}

fn sample_Auction(env: &Env) -> Auction {
    Auction {
        id: 0,
        waste_id: 0,
        creator: Address::generate(env),
        start_price: 0,
        current_bid: 0,
        bidder: None,
        end_time: 0,
        is_active: false,
        bidders: soroban_sdk::Vec::new(env),
    }
}

fn sample_CarbonListing(env: &Env) -> CarbonListing {
    CarbonListing {
        id: 0,
        seller: Address::generate(env),
        amount: 0,
        price_per_credit: 0,
        is_active: false,
        created_at: 0,
    }
}

fn sample_ReportPeriod(env: &Env) -> ReportPeriod {
    ReportPeriod {
        start_timestamp: 0,
        end_timestamp: 0,
    }
}

fn sample_ComplianceStatus(_env: &Env) -> ComplianceStatus {
    ComplianceStatus::Pending
}

fn sample_RegulatoryValidation(env: &Env) -> RegulatoryValidation {
    RegulatoryValidation {
        requirement_id: String::from_str(env, "snapshot"),
        status: ComplianceStatus::Pending,
        notes: String::from_str(env, "snapshot"),
    }
}

fn sample_ComplianceReport(env: &Env) -> ComplianceReport {
    ComplianceReport {
        id: 0,
        period: sample_ReportPeriod(env),
        total_waste_tracked: 0,
        waste_by_type: soroban_sdk::Vec::new(env),
        total_carbon_credits: 0,
        validations: soroban_sdk::Vec::new(env),
        generated_at: 0,
        version: 0,
        is_finalized: false,
    }
}

fn sample_TransferApprovalStatus(_env: &Env) -> TransferApprovalStatus {
    TransferApprovalStatus::Pending
}

fn sample_TransferApproval(env: &Env) -> TransferApproval {
    TransferApproval {
        waste_id: 0,
        from: Address::generate(env),
        to: Address::generate(env),
        amount: 0,
        approvers: soroban_sdk::Vec::new(env),
        required_approvals: 0,
        status: TransferApprovalStatus::Pending,
        created_at: 0,
        expires_at: 0,
    }
}

fn sample_SubstitutionRecord(env: &Env) -> SubstitutionRecord {
    SubstitutionRecord {
        original_id: 0,
        substitute_id: 0,
        approver: Address::generate(env),
        reason: String::from_str(env, "snapshot"),
        timestamp: 0,
    }
}

fn sample_TransactionStats(env: &Env) -> TransactionStats {
    TransactionStats {
        total_transactions: 0,
        successful_transactions: 0,
        failed_transactions: 0,
        average_gas_usage: 0,
        last_transaction_timestamp: 0,
    }
}

fn sample_PerformanceSnapshot(env: &Env) -> PerformanceSnapshot {
    PerformanceSnapshot {
        timestamp: 0,
        active_users: 0,
        waste_processed_per_hour: 0,
        average_latency_ms: 0,
    }
}

fn sample_WasteTransfer(env: &Env) -> WasteTransfer {
    WasteTransfer {
        waste_id: 0,
        from: Address::generate(env),
        to: Address::generate(env),
        transferred_at: 0,
        latitude: 0,
        longitude: 0,
        note: Symbol::new(env, "snapshot"),
    }
}

fn sample_RecyclingStats(env: &Env) -> RecyclingStats {
    RecyclingStats {
        participant: Address::generate(env),
        carbon_credits_earned: 0,
        total_impact_score: 0,
        total_processing_costs: 0,
        recycled_weight: 0,
        total_submissions: 0,
        verified_submissions: 0,
        total_weight: 0,
        total_points: 0,
        paper_count: 0,
        pet_plastic_count: 0,
        plastic_count: 0,
        metal_count: 0,
        glass_count: 0,
        organic_count: 0,
        electronic_count: 0,
        grade_a_count: 0,
        grade_b_count: 0,
        grade_c_count: 0,
        grade_d_count: 0,
        recycling_rate: 0,
    }
}

fn sample_WasteGrade(_env: &Env) -> WasteGrade {
    WasteGrade::A
}

fn sample_GradeRecord(env: &Env) -> GradeRecord {
    GradeRecord {
        waste_id: 0,
        grade: WasteGrade::A,
        grader: Address::generate(env),
        graded_at: 0,
    }
}

fn sample_GlobalMetrics(env: &Env) -> GlobalMetrics {
    GlobalMetrics {
        total_tokens_earned: 0,
        total_carbon_credits: 0,
        total_wastes_count: 0,
        active_waste_count: 0,
        expired_waste_count: 0,
        grade_a_count: 0,
        grade_b_count: 0,
        grade_c_count: 0,
        grade_d_count: 0,
    }
}

fn sample_CompositionEntry(env: &Env) -> CompositionEntry {
    CompositionEntry {
        material_type: WasteType::Paper,
        avg_percentage: 0,
    }
}

fn sample_ExpirationWarning(env: &Env) -> ExpirationWarning {
    ExpirationWarning {
        waste_id: 0,
        expires_at: 0,
        warning_type: Symbol::new(env, "snapshot"),
        warned_at: 0,
    }
}

fn sample_TransferValidationRecord(env: &Env) -> TransferValidationRecord {
    TransferValidationRecord {
        waste_id: 0,
        from: Address::generate(env),
        to: Address::generate(env),
        valid: false,
        reason: String::from_str(env, "snapshot"),
        validated_at: 0,
    }
}

fn sample_SeasonalMultiplier(env: &Env) -> SeasonalMultiplier {
    SeasonalMultiplier {
        multiplier: 0,
        start: 0,
        end: 0,
    }
}

fn sample_RouteStatus(_env: &Env) -> RouteStatus {
    RouteStatus::Pending
}

fn sample_CollectionRoute(env: &Env) -> CollectionRoute {
    CollectionRoute {
        id: 0,
        collector: Address::generate(env),
        waste_ids: soroban_sdk::Vec::new(env),
        status: RouteStatus::Pending,
        created_at: 0,
    }
}

fn sample_ChallengeStatus(_env: &Env) -> ChallengeStatus {
    ChallengeStatus::Active
}

fn sample_Challenge(env: &Env) -> Challenge {
    Challenge {
        id: 0,
        title: Symbol::new(env, "snapshot"),
        target_weight: 0,
        waste_type: WasteType::Paper,
        start_time: 0,
        end_time: 0,
        reward: 0,
        status: ChallengeStatus::Active,
        creator: Address::generate(env),
    }
}

fn sample_ChallengeProgress(env: &Env) -> ChallengeProgress {
    ChallengeProgress {
        challenge_id: 0,
        participant: Address::generate(env),
        weight_processed: 0,
        completed: false,
        joined_at: 0,
    }
}

fn sample_PendingTransferStatus(_env: &Env) -> PendingTransferStatus {
    PendingTransferStatus::Pending
}

fn sample_PendingTransfer(env: &Env) -> PendingTransfer {
    PendingTransfer {
        id: 0,
        waste_id: 0,
        from: Address::generate(env),
        to: Address::generate(env),
        initiated_at: 0,
        expires_at: 0,
        status: PendingTransferStatus::Pending,
        latitude: 0,
        longitude: 0,
    }
}

fn sample_Milestone(env: &Env) -> Milestone {
    Milestone {
        threshold: 0,
        title: Symbol::new(env, "snapshot"),
        bonus_pct: 0,
    }
}

fn sample_LeaderboardEntry(env: &Env) -> LeaderboardEntry {
    LeaderboardEntry {
        participant: Address::generate(env),
        score: 0,
        rank: 0,
    }
}

fn sample_DisputeStatus(_env: &Env) -> DisputeStatus {
    DisputeStatus::Pending
}

fn sample_Dispute(env: &Env) -> Dispute {
    Dispute {
        id: 0,
        waste_id: 0,
        disputer: Address::generate(env),
        reason: String::from_str(env, "snapshot"),
        status: DisputeStatus::Pending,
        created_at: 0,
        resolved_at: 0,
        resolution_note: String::from_str(env, "snapshot"),
    }
}

fn sample_ParticipantTier(_env: &Env) -> ParticipantTier {
    ParticipantTier::Bronze
}

fn sample_ReputationBadge(_env: &Env) -> ReputationBadge {
    ReputationBadge::None
}

fn sample_QualityScore(env: &Env) -> QualityScore {
    QualityScore {
        score: 0,
        calculated_at: 0,
        scorer: Address::generate(env),
    }
}

fn sample_LocationRecord(env: &Env) -> LocationRecord {
    LocationRecord {
        latitude: 0,
        longitude: 0,
        timestamp: 0,
        updated_by: Address::generate(env),
    }
}

fn sample_WasteBatch(env: &Env) -> WasteBatch {
    WasteBatch {
        batch_id: 0,
        waste_ids: soroban_sdk::Vec::new(env),
        total_weight: 0,
        created_by: Address::generate(env),
        created_at: 0,
        status: BatchStatus::Pending,
    }
}

fn sample_BatchStatus(_env: &Env) -> BatchStatus {
    BatchStatus::Pending
}

fn sample_WasteCertification(env: &Env) -> WasteCertification {
    WasteCertification {
        waste_id: 0,
        level: CertificationLevel::Beginner,
        certifier: Address::generate(env),
        certified_at: 0,
        expires_at: 0,
        notes: String::from_str(env, "snapshot"),
    }
}

fn sample_PermissionType(_env: &Env) -> PermissionType {
    PermissionType::Verifier
}

fn sample_PermissionAuditEntry(env: &Env) -> PermissionAuditEntry {
    PermissionAuditEntry {
        subject: Address::generate(env),
        permission: PermissionType::Verifier,
        granted: false,
        changed_by: Address::generate(env),
        timestamp: 0,
    }
}

fn sample_ReconciliationRecord(env: &Env) -> ReconciliationRecord {
    ReconciliationRecord {
        waste_id: 0,
        original_weight: 0,
        reported_weight: 0,
        adjusted_weight: 0,
        reconciled_by: Address::generate(env),
        timestamp: 0,
        reason: String::from_str(env, "snapshot"),
    }
}

#[test]
fn every_contracttype_round_trips_through_xdr() {
    let env = Env::default();
    assert_xdr_round_trip(&env, sample_TransferRecord(&env), "TransferRecord");
    assert_xdr_round_trip(&env, sample_TransferItemType(&env), "TransferItemType");
    assert_xdr_round_trip(&env, sample_TransferStatus(&env), "TransferStatus");
    assert_xdr_round_trip(&env, sample_IncentiveTier(&env), "IncentiveTier");
    assert_xdr_round_trip(&env, sample_Incentive(&env), "Incentive");
    assert_xdr_round_trip(&env, sample_ParticipantRole(&env), "ParticipantRole");
    assert_xdr_round_trip(&env, sample_CertificationLevel(&env), "CertificationLevel");
    assert_xdr_round_trip(&env, sample_WasteType(&env), "WasteType");
    assert_xdr_round_trip(&env, sample_Material(&env), "Material");
    assert_xdr_round_trip(&env, sample_ImpactScore(&env), "ImpactScore");
    assert_xdr_round_trip(&env, sample_ImpactHistoryEntry(&env), "ImpactHistoryEntry");
    assert_xdr_round_trip(&env, sample_ProcessingStatus(&env), "ProcessingStatus");
    assert_xdr_round_trip(&env, sample_ProcessingRecord(&env), "ProcessingRecord");
    assert_xdr_round_trip(&env, sample_MaterialComposition(&env), "MaterialComposition");
    assert_xdr_round_trip(&env, sample_ContaminationReport(&env), "ContaminationReport");
    assert_xdr_round_trip(&env, sample_OptionalWasteType(&env), "OptionalWasteType");
    assert_xdr_round_trip(&env, sample_RecyclingGoal(&env), "RecyclingGoal");
    assert_xdr_round_trip(&env, sample_Waste(&env), "Waste");
    assert_xdr_round_trip(&env, sample_Auction(&env), "Auction");
    assert_xdr_round_trip(&env, sample_CarbonListing(&env), "CarbonListing");
    assert_xdr_round_trip(&env, sample_ReportPeriod(&env), "ReportPeriod");
    assert_xdr_round_trip(&env, sample_ComplianceStatus(&env), "ComplianceStatus");
    assert_xdr_round_trip(&env, sample_RegulatoryValidation(&env), "RegulatoryValidation");
    assert_xdr_round_trip(&env, sample_ComplianceReport(&env), "ComplianceReport");
    assert_xdr_round_trip(&env, sample_TransferApprovalStatus(&env), "TransferApprovalStatus");
    assert_xdr_round_trip(&env, sample_TransferApproval(&env), "TransferApproval");
    assert_xdr_round_trip(&env, sample_SubstitutionRecord(&env), "SubstitutionRecord");
    assert_xdr_round_trip(&env, sample_TransactionStats(&env), "TransactionStats");
    assert_xdr_round_trip(&env, sample_PerformanceSnapshot(&env), "PerformanceSnapshot");
    assert_xdr_round_trip(&env, sample_WasteTransfer(&env), "WasteTransfer");
    assert_xdr_round_trip(&env, sample_RecyclingStats(&env), "RecyclingStats");
    assert_xdr_round_trip(&env, sample_WasteGrade(&env), "WasteGrade");
    assert_xdr_round_trip(&env, sample_GradeRecord(&env), "GradeRecord");
    assert_xdr_round_trip(&env, sample_GlobalMetrics(&env), "GlobalMetrics");
    assert_xdr_round_trip(&env, sample_CompositionEntry(&env), "CompositionEntry");
    assert_xdr_round_trip(&env, sample_ExpirationWarning(&env), "ExpirationWarning");
    assert_xdr_round_trip(&env, sample_TransferValidationRecord(&env), "TransferValidationRecord");
    assert_xdr_round_trip(&env, sample_SeasonalMultiplier(&env), "SeasonalMultiplier");
    assert_xdr_round_trip(&env, sample_RouteStatus(&env), "RouteStatus");
    assert_xdr_round_trip(&env, sample_CollectionRoute(&env), "CollectionRoute");
    assert_xdr_round_trip(&env, sample_ChallengeStatus(&env), "ChallengeStatus");
    assert_xdr_round_trip(&env, sample_Challenge(&env), "Challenge");
    assert_xdr_round_trip(&env, sample_ChallengeProgress(&env), "ChallengeProgress");
    assert_xdr_round_trip(&env, sample_PendingTransferStatus(&env), "PendingTransferStatus");
    assert_xdr_round_trip(&env, sample_PendingTransfer(&env), "PendingTransfer");
    assert_xdr_round_trip(&env, sample_Milestone(&env), "Milestone");
    assert_xdr_round_trip(&env, sample_LeaderboardEntry(&env), "LeaderboardEntry");
    assert_xdr_round_trip(&env, sample_DisputeStatus(&env), "DisputeStatus");
    assert_xdr_round_trip(&env, sample_Dispute(&env), "Dispute");
    assert_xdr_round_trip(&env, sample_ParticipantTier(&env), "ParticipantTier");
    assert_xdr_round_trip(&env, sample_ReputationBadge(&env), "ReputationBadge");
    assert_xdr_round_trip(&env, sample_QualityScore(&env), "QualityScore");
    assert_xdr_round_trip(&env, sample_LocationRecord(&env), "LocationRecord");
    assert_xdr_round_trip(&env, sample_WasteBatch(&env), "WasteBatch");
    assert_xdr_round_trip(&env, sample_BatchStatus(&env), "BatchStatus");
    assert_xdr_round_trip(&env, sample_WasteCertification(&env), "WasteCertification");
    assert_xdr_round_trip(&env, sample_PermissionType(&env), "PermissionType");
    assert_xdr_round_trip(&env, sample_PermissionAuditEntry(&env), "PermissionAuditEntry");
    assert_xdr_round_trip(&env, sample_ReconciliationRecord(&env), "ReconciliationRecord");
}
