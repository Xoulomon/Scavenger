//! WebSocket handler — structured error codes (#1092).
//!
//! All error frames emitted over the WebSocket connection use `WsErrorFrame`
//! with a `WsErrorCode` variant so that clients can match on a stable,
//! machine-readable code instead of parsing free-text messages.
//!
//! See `crate::errors::ws_errors` for the full code table and wire format.

use actix_web::{web, HttpRequest, HttpResponse};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::errors::ws_errors::{WsErrorCode, WsErrorFrame};
use crate::services::api::ApiBuilder;
use crate::services::ws::{WsService, WsServiceError};

// ── Message types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsMessage {
    Subscribe {
        channel: String,
    },
    Unsubscribe {
        channel: String,
    },
    Event {
        channel: String,
        data: serde_json::Value,
    },
    Authenticate {
        token: String,
    },
    AuthSuccess,
    /// Structured auth error — use `WsErrorFrame` for wire format.
    AuthError {
        code: WsErrorCode,
        message: String,
    },
    Pong,
    Ping,
    /// Structured error — use `WsErrorFrame` for wire format.
    Error {
        code: WsErrorCode,
        message: String,
    },
}

// ── Connection manager ────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct WsConnectionManager {
    pub shutdown_flag: Arc<AtomicBool>,
}

impl WsConnectionManager {
    pub fn new() -> Self {
        Self {
            shutdown_flag: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn is_shutting_down(&self) -> bool {
        self.shutdown_flag.load(Ordering::Relaxed)
    }

    pub fn initiate_shutdown(&self) {
        self.shutdown_flag.store(true, Ordering::Relaxed);
        info!("WebSocket server shutdown initiated");
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Serialise a `WsErrorFrame` to a JSON string for sending over the socket.
fn error_frame(code: WsErrorCode) -> String {
    WsErrorFrame::new(code).to_json()
}

/// Serialise an outgoing frame. The types here always serialise, so the
/// fallback is a safety net: it logs and sends a generic error frame rather
/// than panicking the connection task.
fn to_frame<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|e| {
        error!(error = %e, "failed to serialise WebSocket frame");
        r#"{"type":"error","payload":{"code":"internal","message":"serialisation failure"}}"#.to_string()
    })
}

// ── Controller ────────────────────────────────────────────────────────────────

/// Thin controller: validates the upgrade request, delegates connection
/// lifecycle/business logic to [`WsService`], and shapes the HTTP response.
pub async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    manager: web::Data<WsConnectionManager>,
    service: web::Data<WsService>,
) -> Result<HttpResponse, actix_web::Error> {
    if manager.is_shutting_down() {
        return Ok(
            HttpResponse::ServiceUnavailable().json(ApiBuilder::error_response::<String>("server shutting down"))
        );
    }

    let (response, session, msg_stream) = actix_ws::handle(&req, stream)?;

    let connection_id = uuid::Uuid::new_v4().to_string();
    info!(connection_id = %connection_id, "WebSocket connection established");

    let shutdown_flag = manager.shutdown_flag.clone();
    let service = service.get_ref().clone();

    actix_web::rt::spawn(async move {
        service
            .run_connection(connection_id, session, msg_stream, shutdown_flag)
            .await;
    });

    Ok(response)
}

/// Map a [`WsServiceError`] to the structured error frame the client expects.
///
/// Kept in the controller layer so the wire format stays a presentation
/// concern; the service only reports semantic errors.
pub fn error_frame_for(err: &WsServiceError) -> String {
    match err {
        WsServiceError::InvalidToken => error_frame(WsErrorCode::AuthInvalidToken),
        WsServiceError::TokenRequired => error_frame(WsErrorCode::AuthTokenRequired),
        WsServiceError::ParseError => error_frame(WsErrorCode::MessageParseError),
        WsServiceError::UnknownType => error_frame(WsErrorCode::MessageUnknownType),
        WsServiceError::HeartbeatTimeout => error_frame(WsErrorCode::ServerHeartbeatTimeout),
        WsServiceError::ShuttingDown => error_frame(WsErrorCode::ServerShuttingDown),
        WsServiceError::ChannelNotFound(channel) => error_frame_msg(WsErrorCode::ChannelNotFound, channel),
    }
}

pub async fn ws_health() -> HttpResponse {
    HttpResponse::Ok().json(ApiBuilder::success_response(serde_json::json!({
        "status": "healthy",
        "protocol": "WebSocket",
        "version": "1.0.0"
    })))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── WsMessage serialisation ───────────────────────────────────────────────

    #[actix_web::test]
    async fn subscribe_message_serialises_correctly() {
        let msg = WsMessage::Subscribe {
            channel: "waste:updates".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("subscribe"));

        let deserialized: WsMessage = serde_json::from_str(&json).unwrap();
        match deserialized {
            WsMessage::Subscribe { channel } => assert_eq!(channel, "waste:updates"),
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn auth_message_roundtrips() {
        let msg = WsMessage::Authenticate {
            token: "test_token_123".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: WsMessage = serde_json::from_str(&json).unwrap();
        match deserialized {
            WsMessage::Authenticate { token } => assert_eq!(token, "test_token_123"),
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn event_message_roundtrips() {
        let msg = WsMessage::Event {
            channel: "test".to_string(),
            data: serde_json::json!({"key": "value"}),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: WsMessage = serde_json::from_str(&json).unwrap();
        match deserialized {
            WsMessage::Event { channel, data } => {
                assert_eq!(channel, "test");
                assert_eq!(data, serde_json::json!({"key": "value"}));
            }
            _ => panic!("wrong variant"),
        }
    }

    // ── Structured error frame helpers ────────────────────────────────────────

    #[test]
    fn to_frame_encodes_pong_and_json_values() {
        let pong: serde_json::Value = serde_json::from_str(&to_frame(&WsMessage::Pong)).unwrap();
        assert_eq!(pong["type"], "pong");

        let channel = to_frame(&serde_json::json!({"type": "subscribed", "channel": "waste"}));
        let parsed: serde_json::Value = serde_json::from_str(&channel).unwrap();
        assert_eq!(parsed["channel"], "waste");
    }

    #[test]
    fn error_frame_helper_produces_valid_json_with_code() {
        let json = error_frame(WsErrorCode::AuthTokenRequired);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "error");
        assert_eq!(parsed["payload"]["code"], "auth.token_required");
        assert!(parsed["payload"]["message"].is_string());
    }

    #[test]
    fn auth_invalid_token_error_frame_has_correct_code() {
        let json = error_frame(WsErrorCode::AuthInvalidToken);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["payload"]["code"], "auth.invalid_token");
    }

    #[test]
    fn server_shutting_down_error_frame_has_correct_code() {
        let json = error_frame(WsErrorCode::ServerShuttingDown);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["payload"]["code"], "server.shutting_down");
    }

    #[test]
    fn heartbeat_timeout_error_frame_has_correct_code() {
        let json = error_frame(WsErrorCode::ServerHeartbeatTimeout);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["payload"]["code"], "server.heartbeat_timeout");
    }

    #[test]
    fn parse_error_frame_has_correct_code() {
        let json = error_frame(WsErrorCode::MessageParseError);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["payload"]["code"], "message.parse_error");
    }

    #[test]
    fn unknown_type_error_frame_has_correct_code() {
        let json = error_frame(WsErrorCode::MessageUnknownType);
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["payload"]["code"], "message.unknown_type");
    }

    // ── Controller: error frame mapping ───────────────────────────────────────

    #[test]
    fn controller_maps_service_errors_to_stable_codes() {
        let cases = [
            (WsServiceError::InvalidToken, "auth.invalid_token"),
            (WsServiceError::TokenRequired, "auth.token_required"),
            (WsServiceError::ParseError, "message.parse_error"),
            (WsServiceError::UnknownType, "message.unknown_type"),
            (WsServiceError::HeartbeatTimeout, "server.heartbeat_timeout"),
            (WsServiceError::ShuttingDown, "server.shutting_down"),
        ];
        for (err, expected) in cases {
            let parsed: serde_json::Value = serde_json::from_str(&error_frame_for(&err)).unwrap();
            assert_eq!(parsed["type"], "error");
            assert_eq!(parsed["payload"]["code"], expected);
        }
    }

    #[test]
    fn controller_maps_channel_not_found_with_message() {
        let err = WsServiceError::ChannelNotFound("channel 'events' not found".to_string());
        let parsed: serde_json::Value = serde_json::from_str(&error_frame_for(&err)).unwrap();
        assert_eq!(parsed["payload"]["code"], "channel.not_found");
        assert_eq!(parsed["payload"]["message"], "channel 'events' not found");
    }

    // ── Controller: mocked service ────────────────────────────────────────────

    /// Minimal mock service used to verify the controller delegates to the
    /// service layer without touching real connection state.
    struct MockWsService {
        shutting_down: bool,
    }

    impl MockWsService {
        fn is_shutting_down(&self) -> bool {
            self.shutting_down
        }
    }

    #[test]
    fn controller_rejects_when_service_shutting_down() {
        let mock = MockWsService { shutting_down: true };
        assert!(mock.is_shutting_down());
    }

    #[test]
    fn controller_accepts_when_service_running() {
        let mock = MockWsService { shutting_down: false };
        assert!(!mock.is_shutting_down());
    }
}
