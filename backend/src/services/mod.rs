pub mod api;
pub mod archival;
pub mod archival_storage;
pub mod audit;
pub mod email;
pub mod export;
pub mod geospatial;
pub mod logger;
pub mod ml_classification;
pub mod notification_delivery;
pub mod notifications;
pub mod queue_worker;
pub mod reporting;
pub mod storage;
pub mod verification;
pub mod webhook;

// Repository layer modules introduced by the controller/service/repository split (#1697).
// These are internal additions: they expose data-access abstractions used by the service
// layer and are not part of the previously public service API surface. Existing service
// exports below remain unchanged, so API behavior stays backwards compatible.
pub mod repositories;

#[cfg(test)]
mod ml_classification_tests;

pub use api::ApiBuilder;
pub use archival::{
    ArchivalNotification, ArchivalService, ArchiveJob, ArchiveQuery, ArchiveRecord, ArchiveStats, ArchiveStatus,
    RetentionPolicy, StorageTier,
};
pub use archival_storage::{FileSystemArchivalStorage, S3ArchivalStorage};
pub use audit::{AuditAction, AuditEntry, AuditEventType, AuditQuery, AuditService};
pub use email::{EmailService, SendGridEmailService};
pub use export::{ExportData, ExportFormat, ExportService};
pub use logger::{init_logger, Logger, LoggerConfig};
pub use notifications::{FirebaseNotificationService, NotificationService};
pub use queue_worker::{Job, QueueWorker};
pub use reporting::{ReportService, ReportingService};
pub use storage::{S3StorageService, StorageService};
pub use verification::{DefaultVerificationService, VerificationService};
pub use webhook::{Webhook, WebhookEvent, WebhookManager};
