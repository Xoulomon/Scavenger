// Analytics controller module.
//
// This module previously contained legacy analytics endpoints
// (/analytics/participant/{id}, /analytics/global, /analytics/metrics/{name})
// that were never registered in main.rs and had no active consumers.
//
// Removed as part of #906 — unused/deprecated endpoint cleanup.
//
// Analytics data is available via the existing contract stats endpoint:
//   GET /api/v1/contracts/stats
//
// As part of #1697, route handlers are split into controller/service/repository
// layers. This module provides the analytics controller, which is responsible
// for request parsing, validation, and response shaping. Business logic is
// delegated to the analytics service, and data access to the analytics
// repository. Route paths and response schemas remain unchanged.

use serde::{Deserialize, Serialize};

/// Query parameters accepted by analytics endpoints.
///
/// Kept backward compatible with the previously exposed contract stats
/// endpoint shape.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct AnalyticsQuery {
    /// Optional contract identifier to scope analytics to a single contract.
    pub contract_id: Option<String>,
    /// Optional time window (in seconds) to restrict the analytics range.
    pub window_seconds: Option<u64>,
}

/// Response payload for analytics endpoints.
///
/// The schema is unchanged from the existing contract stats endpoint.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct AnalyticsResponse {
    /// Total number of contracts tracked.
    pub total_contracts: u64,
    /// Number of currently active contracts.
    pub active_contracts: u64,
    /// Total number of participants.
    pub total_participants: u64,
}

/// Errors that can occur while handling analytics requests.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AnalyticsError {
    /// The request failed validation.
    InvalidRequest(String),
    /// The underlying service or repository failed.
    Internal(String),
}

impl std::fmt::Display for AnalyticsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AnalyticsError::InvalidRequest(msg) => write!(f, "invalid request: {}", msg),
            AnalyticsError::Internal(msg) => write!(f, "internal error: {}", msg),
        }
    }
}

impl std::error::Error for AnalyticsError {}

/// Abstraction over the analytics service layer.
///
/// The controller depends on this trait so that business logic can be
/// implemented (and mocked in tests) independently of request handling.
pub trait AnalyticsService {
    /// Compute analytics for the given query.
    fn get_analytics(&self, query: &AnalyticsQuery) -> Result<AnalyticsResponse, AnalyticsError>;
}

/// Controller responsible for parsing, validating, and shaping analytics
/// requests and responses.
pub struct AnalyticsController<S: AnalyticsService> {
    service: S,
}

impl<S: AnalyticsService> AnalyticsController<S> {
    /// Create a new controller backed by the given service.
    pub fn new(service: S) -> Self {
        Self { service }
    }

    /// Validate the incoming query parameters.
    fn validate(query: &AnalyticsQuery) -> Result<(), AnalyticsError> {
        if let Some(contract_id) = &query.contract_id {
            if contract_id.trim().is_empty() {
                return Err(AnalyticsError::InvalidRequest(
                    "contract_id must not be empty".to_string(),
                ));
            }
        }
        if let Some(window) = query.window_seconds {
            if window == 0 {
                return Err(AnalyticsError::InvalidRequest(
                    "window_seconds must be greater than zero".to_string(),
                ));
            }
        }
        Ok(())
    }

    /// Handle an analytics request.
    ///
    /// Parses and validates the query, delegates computation to the service,
    /// and returns the response payload unchanged.
    pub fn handle(&self, query: AnalyticsQuery) -> Result<AnalyticsResponse, AnalyticsError> {
        Self::validate(&query)?;
        self.service.get_analytics(&query)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    /// Mock service that records the last query it received and returns a
    /// configurable result.
    struct MockAnalyticsService {
        response: Result<AnalyticsResponse, AnalyticsError>,
        last_query: RefCell<Option<AnalyticsQuery>>,
    }

    impl MockAnalyticsService {
        fn new(response: Result<AnalyticsResponse, AnalyticsError>) -> Self {
            Self {
                response,
                last_query: RefCell::new(None),
            }
        }
    }

    impl AnalyticsService for MockAnalyticsService {
        fn get_analytics(&self, query: &AnalyticsQuery) -> Result<AnalyticsResponse, AnalyticsError> {
            *self.last_query.borrow_mut() = Some(query.clone());
            self.response.clone()
        }
    }

    fn sample_response() -> AnalyticsResponse {
        AnalyticsResponse {
            total_contracts: 10,
            active_contracts: 7,
            total_participants: 42,
        }
    }

    #[test]
    fn handle_returns_service_response() {
        let service = MockAnalyticsService::new(Ok(sample_response()));
        let controller = AnalyticsController::new(service);

        let result = controller.handle(AnalyticsQuery::default()).unwrap();
        assert_eq!(result, sample_response());
    }

    #[test]
    fn handle_delegates_query_to_service() {
        let service = MockAnalyticsService::new(Ok(sample_response()));
        let controller = AnalyticsController::new(service);

        let query = AnalyticsQuery {
            contract_id: Some("contract-1".to_string()),
            window_seconds: Some(3600),
        };
        controller.handle(query.clone()).unwrap();

        let recorded = controller.service.last_query.borrow().clone();
        assert_eq!(recorded, Some(query));
    }

    #[test]
    fn handle_propagates_service_error() {
        let service = MockAnalyticsService::new(Err(AnalyticsError::Internal("boom".to_string())));
        let controller = AnalyticsController::new(service);

        let result = controller.handle(AnalyticsQuery::default());
        assert_eq!(result, Err(AnalyticsError::Internal("boom".to_string())));
    }

    #[test]
    fn handle_rejects_empty_contract_id() {
        let service = MockAnalyticsService::new(Ok(sample_response()));
        let controller = AnalyticsController::new(service);

        let query = AnalyticsQuery {
            contract_id: Some("   ".to_string()),
            window_seconds: None,
        };
        let result = controller.handle(query);
        assert!(matches!(result, Err(AnalyticsError::InvalidRequest(_))));
        // Validation failure must not reach the service.
        assert!(controller.service.last_query.borrow().is_none());
    }

    #[test]
    fn handle_rejects_zero_window() {
        let service = MockAnalyticsService::new(Ok(sample_response()));
        let controller = AnalyticsController::new(service);

        let query = AnalyticsQuery {
            contract_id: None,
            window_seconds: Some(0),
        };
        let result = controller.handle(query);
        assert!(matches!(result, Err(AnalyticsError::InvalidRequest(_))));
        assert!(controller.service.last_query.borrow().is_none());
    }

    #[test]
    fn handle_accepts_valid_query() {
        let service = MockAnalyticsService::new(Ok(sample_response()));
        let controller = AnalyticsController::new(service);

        let query = AnalyticsQuery {
            contract_id: Some("contract-1".to_string()),
            window_seconds: Some(60),
        };
        assert!(controller.handle(query).is_ok());
    }
}
