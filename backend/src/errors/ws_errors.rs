//! Structured WebSocket error codes (#1092).
//!
//! All error frames sent over the WebSocket connection use a `WsErrorCode`
//! variant so that clients can match on a stable machine-readable value
//! instead of parsing free-text messages.
//!
//! # Wire format
//!
//! Every error frame is a JSON object with this shape:
//!
//! ```json
//! {
//!   "type": "error",
//!   "payload": {
//!     "code": "auth.token_required",
//!     "message": "Authentication required before subscribing to channels"
//!   }
//! }
//! ```
//!
//! The `code` field is the stable value clients should `switch` on.
//! The `message` is a human-readable hint that may change between releases.
//!
//! # Code table
//!
//! | Code | When emitted |
//! |---|---|
//! | `auth.token_required` | Client sent a non-auth message before authenticating |
//! | `auth.invalid_token` | Authenticate payload carried a token that failed validation |
//! | `channel.not_found` | Subscribe/unsubscribe targeting an unknown channel name |
//! | `message.unknown_type` | Incoming JSON message had an unrecognised `type` field |
//! | `message.parse_error` | Incoming text frame was not valid JSON |
//! | `server.shutting_down` | Server is draining connections |
//! | `server.heartbeat_timeout` | Client missed heartbeats for too long |

use serde::{Deserialize, Serialize};

/// Stable, machine-readable WebSocket error codes.
///
/// All variants serialize to snake_case dot-separated strings so that
/// TypeScript / JavaScript consumers can use a `switch` statement on the
/// `code` field without importing the Rust enum.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WsErrorCode {
    /// Client sent a non-authentication message before authenticating.
    #[serde(rename = "auth.token_required")]
    AuthTokenRequired,
    /// The supplied authentication token is invalid or too short.
    #[serde(rename = "auth.invalid_token")]
    AuthInvalidToken,
    /// Subscribe/unsubscribe referenced an unknown channel.
    #[serde(rename = "channel.not_found")]
    ChannelNotFound,
    /// Message `type` field did not match any known variant.
    #[serde(rename = "message.unknown_type")]
    MessageUnknownType,
    /// Incoming text frame was not valid JSON.
    #[serde(rename = "message.parse_error")]
    MessageParseError,
    /// Server is shutting down and draining connections.
    #[serde(rename = "server.shutting_down")]
    ServerShuttingDown,
    /// Client has not sent a heartbeat within the timeout window.
    #[serde(rename = "server.heartbeat_timeout")]
    ServerHeartbeatTimeout,
}

impl WsErrorCode {
    /// Returns a default human-readable description for this code.
    ///
    /// This string is included as `message` in the error frame.  It is
    /// informational only — clients must not key logic on it.
    pub fn default_message(&self) -> &'static str {
        match self {
            Self::AuthTokenRequired => "Authentication required before subscribing to channels",
            Self::AuthInvalidToken => "Invalid or malformed authentication token",
            Self::ChannelNotFound => "The requested channel does not exist",
            Self::MessageUnknownType => "Unrecognised message type",
            Self::MessageParseError => "Message could not be parsed as JSON",
            Self::ServerShuttingDown => "Server is shutting down",
            Self::ServerHeartbeatTimeout => "Heartbeat timeout: connection closed",
        }
    }
}

/// A structured WebSocket error frame, ready to be serialised and sent.
///
/// ```rust
/// # use backend::errors::ws_errors::{WsErrorCode, WsErrorFrame};
/// let frame = WsErrorFrame::new(WsErrorCode::AuthTokenRequired);
/// let json = serde_json::to_string(&frame).unwrap();
/// // {"type":"error","payload":{"code":"auth.token_required","message":"..."}}
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsErrorFrame {
    #[serde(rename = "type")]
    pub frame_type: String,
    pub payload: WsErrorPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsErrorPayload {
    pub code: WsErrorCode,
    pub message: String,
}

impl WsErrorFrame {
    /// Build a frame using the code's default message.
    pub fn new(code: WsErrorCode) -> Self {
        let message = code.default_message().to_string();
        Self {
            frame_type: "error".to_string(),
            payload: WsErrorPayload { code, message },
        }
    }

    /// Build a frame with a custom message.
    pub fn with_message(code: WsErrorCode, message: impl Into<String>) -> Self {
        Self {
            frame_type: "error".to_string(),
            payload: WsErrorPayload {
                code,
                message: message.into(),
            },
        }
    }

    /// Serialise the frame to a JSON string, falling back to a plain-text
    /// sentinel on serialisation failure (should never happen in practice).
    pub fn to_json(&self) -> String {
        serde_json::to_string(self)
            .unwrap_or_else(|_| r#"{"type":"error","payload":{"code":"internal","message":"serialisation failure"}}"#.to_string())
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_codes_serialise_to_dot_notation() {
        let code = WsErrorCode::AuthTokenRequired;
        let json = serde_json::to_value(&code).unwrap();
        assert_eq!(json, serde_json::json!("auth.token_required"));

        let code = WsErrorCode::MessageParseError;
        let json = serde_json::to_value(&code).unwrap();
        assert_eq!(json, serde_json::json!("message.parse_error"));

        let code = WsErrorCode::ServerShuttingDown;
        let json = serde_json::to_value(&code).unwrap();
        assert_eq!(json, serde_json::json!("server.shutting_down"));
    }

    #[test]
    fn error_codes_roundtrip_deserialise() {
        let original = WsErrorCode::AuthInvalidToken;
        let json = serde_json::to_string(&original).unwrap();
        let deserialized: WsErrorCode = serde_json::from_str(&json).unwrap();
        assert_eq!(original, deserialized);
    }

    #[test]
    fn ws_error_frame_new_has_type_error() {
        let frame = WsErrorFrame::new(WsErrorCode::AuthTokenRequired);
        assert_eq!(frame.frame_type, "error");
        assert_eq!(frame.payload.code, WsErrorCode::AuthTokenRequired);
        assert!(!frame.payload.message.is_empty());
    }

    #[test]
    fn ws_error_frame_with_message_overrides_default() {
        let frame = WsErrorFrame::with_message(WsErrorCode::ChannelNotFound, "channel 'foo' not found");
        assert_eq!(frame.payload.message, "channel 'foo' not found");
    }

    #[test]
    fn ws_error_frame_to_json_produces_valid_json() {
        let frame = WsErrorFrame::new(WsErrorCode::MessageUnknownType);
        let json = frame.to_json();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["type"], "error");
        assert_eq!(parsed["payload"]["code"], "message.unknown_type");
        assert!(parsed["payload"]["message"].is_string());
    }

    #[test]
    fn all_codes_have_non_empty_default_messages() {
        let codes = [
            WsErrorCode::AuthTokenRequired,
            WsErrorCode::AuthInvalidToken,
            WsErrorCode::ChannelNotFound,
            WsErrorCode::MessageUnknownType,
            WsErrorCode::MessageParseError,
            WsErrorCode::ServerShuttingDown,
            WsErrorCode::ServerHeartbeatTimeout,
        ];
        for code in &codes {
            assert!(
                !code.default_message().is_empty(),
                "code {:?} has empty default message",
                code
            );
        }
    }
}
