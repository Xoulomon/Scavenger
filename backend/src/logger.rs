//! Lightweight structured logger used by the DI container.
//!
//! Emits `tracing` events with a stable `(event, message)` shape so call
//! sites stay uniform across the container lifecycle.

/// Named logger handle shared through the DI container.
#[derive(Clone, Debug)]
pub struct Logger {
    name: String,
}

impl Logger {
    /// Create a logger under the given component name.
    pub fn new(name: &str) -> Self {
        Self { name: name.to_string() }
    }

    /// Create a logger for the given component name (level resolution is
    /// delegated to the `tracing` subscriber's env filter).
    pub fn from_env(name: &str) -> Self {
        Self::new(name)
    }

    /// Record an informational event.
    pub fn info(&self, event: &str, message: &str) {
        tracing::info!(logger = %self.name, event, message);
    }

    /// Record an error event.
    pub fn error(&self, event: &str, message: &str) {
        tracing::error!(logger = %self.name, event, message);
    }
}
