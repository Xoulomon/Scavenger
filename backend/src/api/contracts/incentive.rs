/// Incentive-contract API handlers.
///
/// Covers reward distribution, balance queries, claiming, and incentive
/// programme configuration.  Extracted from the monolithic `contracts.rs`
/// module as part of issue #1075 to keep each submodule under ~300 lines
/// and to reduce merge-conflict surface.
use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use crate::api::errors::ApiError;

// ── Request / response shapes ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DistributeRewardsRequest {
    pub participant_id: String,
    pub waste_id: String,
    pub reward_amount: f64,
    pub currency: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RewardResponse {
    pub reward_id: String,
    pub participant_id: String,
    pub waste_id: String,
    pub amount: f64,
    pub currency: String,
    pub status: String,
    pub distributed_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IncentiveBalance {
    pub participant_id: String,
    pub total_earned: f64,
    pub total_claimed: f64,
    pub available: f64,
    pub currency: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaimRewardRequest {
    pub participant_id: String,
    pub amount: f64,
    pub wallet_address: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IncentiveProgramme {
    pub name: String,
    pub reward_per_kg: f64,
    pub currency: String,
    pub active: bool,
    pub waste_types: Vec<String>,
}

// ── Handlers ──────────────────────────────────────────────────────────────

/// POST /api/contracts/incentive/distribute
///
/// Distributes reward tokens to a participant for a confirmed waste record.
pub async fn distribute_rewards(
    body: web::Json<DistributeRewardsRequest>,
) -> Result<HttpResponse, ApiError> {
    if body.participant_id.is_empty() {
        return Err(ApiError::validation("participant_id is required"));
    }
    if body.waste_id.is_empty() {
        return Err(ApiError::validation("waste_id is required"));
    }
    if body.reward_amount <= 0.0 {
        return Err(ApiError::validation("reward_amount must be positive"));
    }
    if body.currency.is_empty() {
        return Err(ApiError::validation("currency is required"));
    }

    let response = RewardResponse {
        reward_id: uuid::Uuid::new_v4().to_string(),
        participant_id: body.participant_id.clone(),
        waste_id: body.waste_id.clone(),
        amount: body.reward_amount,
        currency: body.currency.clone(),
        status: "distributed".to_string(),
        distributed_at: chrono::Utc::now().to_rfc3339(),
    };

    Ok(HttpResponse::Created().json(response))
}

/// GET /api/contracts/incentive/balance/{participant_id}
///
/// Returns the current reward balance for a participant.
pub async fn get_balance(path: web::Path<String>) -> Result<HttpResponse, ApiError> {
    let participant_id = path.into_inner();
    if participant_id.is_empty() {
        return Err(ApiError::validation("participant_id is required"));
    }

    let balance = IncentiveBalance {
        participant_id,
        total_earned: 150.0,
        total_claimed: 50.0,
        available: 100.0,
        currency: "SCVG".to_string(),
    };

    Ok(HttpResponse::Ok().json(balance))
}

/// POST /api/contracts/incentive/claim
///
/// Triggers a withdrawal of earned rewards to the participant's wallet.
pub async fn claim_reward(
    body: web::Json<ClaimRewardRequest>,
) -> Result<HttpResponse, ApiError> {
    if body.participant_id.is_empty() {
        return Err(ApiError::validation("participant_id is required"));
    }
    if body.wallet_address.is_empty() {
        return Err(ApiError::validation("wallet_address is required"));
    }
    if body.amount <= 0.0 {
        return Err(ApiError::validation("amount must be positive"));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "claim_id": uuid::Uuid::new_v4().to_string(),
        "participant_id": body.participant_id,
        "amount": body.amount,
        "wallet_address": body.wallet_address,
        "status": "processing",
        "claimed_at": chrono::Utc::now().to_rfc3339()
    })))
}

/// GET /api/contracts/incentive/programmes
///
/// Returns all active incentive programmes and their reward rates.
pub async fn list_programmes() -> Result<HttpResponse, ApiError> {
    let programmes = vec![
        IncentiveProgramme {
            name: "Plastic Recycling".to_string(),
            reward_per_kg: 0.50,
            currency: "SCVG".to_string(),
            active: true,
            waste_types: vec!["plastic".to_string(), "pet".to_string()],
        },
        IncentiveProgramme {
            name: "Metal Collection".to_string(),
            reward_per_kg: 1.20,
            currency: "SCVG".to_string(),
            active: true,
            waste_types: vec!["metal".to_string(), "aluminium".to_string()],
        },
        IncentiveProgramme {
            name: "E-Waste".to_string(),
            reward_per_kg: 2.50,
            currency: "SCVG".to_string(),
            active: false,
            waste_types: vec!["electronics".to_string()],
        },
    ];

    Ok(HttpResponse::Ok().json(programmes))
}

// ── Route registration ─────────────────────────────────────────────────────

/// Registers all incentive-contract routes under `/api/contracts/incentive`.
pub fn configure_incentive_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/incentive")
            .route("/distribute", web::post().to(distribute_rewards))
            .route("/claim", web::post().to(claim_reward))
            .route("/programmes", web::get().to(list_programmes))
            .route("/balance/{participant_id}", web::get().to(get_balance)),
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, web, App};

    #[actix_web::test]
    async fn test_distribute_rewards_success() {
        let app = test::init_service(
            App::new().route("/incentive/distribute", web::post().to(distribute_rewards)),
        )
        .await;

        let body = DistributeRewardsRequest {
            participant_id: "p-1".to_string(),
            waste_id: "w-1".to_string(),
            reward_amount: 10.0,
            currency: "SCVG".to_string(),
        };

        let req = test::TestRequest::post()
            .uri("/incentive/distribute")
            .set_json(&body)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);
    }

    #[actix_web::test]
    async fn test_distribute_rewards_zero_amount() {
        let app = test::init_service(
            App::new().route("/incentive/distribute", web::post().to(distribute_rewards)),
        )
        .await;

        let body = DistributeRewardsRequest {
            participant_id: "p-1".to_string(),
            waste_id: "w-1".to_string(),
            reward_amount: 0.0,
            currency: "SCVG".to_string(),
        };

        let req = test::TestRequest::post()
            .uri("/incentive/distribute")
            .set_json(&body)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 400);
    }

    #[actix_web::test]
    async fn test_get_balance() {
        let app = test::init_service(
            App::new()
                .route("/incentive/balance/{participant_id}", web::get().to(get_balance)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/incentive/balance/participant-1")
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    #[actix_web::test]
    async fn test_claim_reward_missing_wallet() {
        let app = test::init_service(
            App::new().route("/incentive/claim", web::post().to(claim_reward)),
        )
        .await;

        let body = ClaimRewardRequest {
            participant_id: "p-1".to_string(),
            amount: 50.0,
            wallet_address: String::new(),
        };

        let req = test::TestRequest::post()
            .uri("/incentive/claim")
            .set_json(&body)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 400);
    }

    #[actix_web::test]
    async fn test_list_programmes() {
        let app = test::init_service(
            App::new().route("/incentive/programmes", web::get().to(list_programmes)),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/incentive/programmes")
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }
}
