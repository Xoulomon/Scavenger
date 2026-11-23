//! Ownership: dependency wiring is in `container.rs`. Services are constructed there and handlers get
//! them through Axum state, not through statics. Remaining direct construction is a follow-up.

//! Dependency injection container (#914, #1091).
//!
//! `AppContainer` is the single composition root. Every service dependency is
//! expressed as an explicit constructor parameter — there are no implicit global
//! singletons or hidden initialization-order dependencies.
//!
//! # Design rules
//!
//! 1. **All dependencies are constructor parameters.** `AppContainer::new` lists
//!    every service as an argument. The compiler enforces that nothing is
//!    accidentally omitted.
//!
//! 2. **`from_env` is the only place that reads environment variables.** It calls
//!    `new(...)` after building each dependency. Adding a new env-var dependency
//!    means adding it here and nowhere else.
//!
//! 3. **Handlers never construct their own dependencies.** They receive individual
//!    `Arc<dyn Trait>` slices via actix-web's `web::Data`.
//!
//! # How to add a new service
//!
//! 1. Define your service type (struct + trait if it needs to be mockable).
//! 2. Add an `Arc<dyn YourTrait>` (or `Arc<ConcreteType>`) field to `AppContainer`.
//! 3. Add a matching parameter to `AppContainer::new`.
//! 4. Construct the real implementation in `AppContainer::from_env` and pass it.
//! 5. Add a `FakeYourService` in the `fakes` module below and use it in
//!    `AppContainer::with_test_config` so existing DI tests keep compiling.
//!
//! # Usage (in `main.rs`)
//!
//! ```ignore
//! let container = AppContainer::from_env()
//!     .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
//! let container = Arc::new(container);
//!
//! HttpServer::new(move || {
//!     App::new()
//!         .app_data(container.email.clone())
//!         .app_data(container.webhook.clone())
//!         // …
//! })
//! ```

use std::sync::Arc;

use crate::{
    cache::{Cache, CacheInvalidationManager},
    controllers::{
        ArchivalController, AuditController, EmailController, NotificationController, ReportingController,
        SearchController, StorageController, VerificationController, WebhookController,
    },
    logger::Logger,
    repositories::{
        ArchivalRepository, AuditRepository, EmailRepository, FileSystemArchivalRepository, InMemoryAuditRepository,
        InMemoryEmailRepository, InMemoryNotificationRepository, InMemoryReportingRepository,
        InMemoryStorageRepository, InMemoryVerificationRepository, InMemoryWebhookRepository, NotificationRepository,
        ReportingRepository, StorageRepository, VerificationRepository, WebhookRepository,
    },
    rpc::{StellarRpcClient, StellarRpcConfig},
    search::{SearchClient, SearchClientConfig},
    services::{
        ArchivalService, AuditService, DefaultVerificationService, EmailService, FileSystemArchivalStorage,
        FirebaseNotificationService, NotificationService, ReportService, ReportingService, S3StorageService,
        SendGridEmailService, StorageService, VerificationService, WebhookManager,
    },
};

/// Central DI container — built once at startup, then shared via `Arc`.
///
/// All fields are `pub` so that `main.rs` can extract individual `Arc`s for
/// actix-web `web::Data` registration without cloning the whole container.
pub struct AppContainer {
    pub email: Arc<dyn EmailService>,
    pub notification: Arc<dyn NotificationService>,
    pub reporting: Arc<dyn ReportService>,
    pub storage: Arc<dyn StorageService>,
    pub webhook: Arc<WebhookManager>,
    pub cache: Cache,
    pub cache_invalidation: Arc<CacheInvalidationManager>,
    pub audit: Arc<AuditService>,
    pub verification: Arc<dyn VerificationService>,
    pub search: Arc<SearchClient>,
    pub archival: Arc<ArchivalService>,
    pub stellar: Arc<StellarRpcClient>,
    /// Structured logger shared by every service and handler.
    pub logger: Arc<Logger>,

    // ── Controller layer (#1697) ───────────────────────────────────────────
    //
    // Controllers own the request-handling logic that used to live in route
    // handlers. Route handlers now resolve these from the container and simply
    // delegate, keeping the HTTP surface unchanged.
    pub email_controller: Arc<EmailController>,
    pub notification_controller: Arc<NotificationController>,
    pub reporting_controller: Arc<ReportingController>,
    pub storage_controller: Arc<StorageController>,
    pub webhook_controller: Arc<WebhookController>,
    pub audit_controller: Arc<AuditController>,
    pub verification_controller: Arc<VerificationController>,
    pub search_controller: Arc<SearchController>,
    pub archival_controller: Arc<ArchivalController>,
}

impl AppContainer {
    /// Construct the container with **explicit** dependencies.
    ///
    /// This is the canonical constructor.  Every dependency is a named
    /// parameter — there is no implicit ordering; the compiler will reject
    /// any attempt to call this with a missing argument.
    ///
    /// In production code, call [`AppContainer::from_env`] which reads
    /// environment variables and delegates here.
    /// In tests, call [`AppContainer::with_test_config`] or build fakes
    /// manually and call this constructor directly.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        email: Arc<dyn EmailService>,
        notification: Arc<dyn NotificationService>,
        reporting: Arc<dyn ReportService>,
        storage: Arc<dyn StorageService>,
        webhook: Arc<WebhookManager>,
        cache: Cache,
        cache_invalidation: Arc<CacheInvalidationManager>,
        audit: Arc<AuditService>,
        verification: Arc<dyn VerificationService>,
        search: Arc<SearchClient>,
        archival: Arc<ArchivalService>,
        stellar: Arc<StellarRpcClient>,
    ) -> Self {
        // Backwards-compatible constructor: build a default logger so existing
        // callers (and tests) keep compiling. Use `new_with_logger` to inject a
        // pre-configured logger.
        Self::new_with_logger(
            email,
            notification,
            reporting,
            storage,
            webhook,
            cache,
            cache_invalidation,
            audit,
            verification,
            search,
            archival,
            stellar,
            Arc::new(Logger::new("app")),
        )
    }

    /// Construct the container with an explicit structured logger.
    ///
    /// Prefer this constructor in production so that every service shares the
    /// same logger instance (and therefore the same output sink / level).
    #[allow(clippy::too_many_arguments)]
    pub fn new_with_logger(
        email: Arc<dyn EmailService>,
        notification: Arc<dyn NotificationService>,
        reporting: Arc<dyn ReportService>,
        storage: Arc<dyn StorageService>,
        webhook: Arc<WebhookManager>,
        cache: Cache,
        cache_invalidation: Arc<CacheInvalidationManager>,
        audit: Arc<AuditService>,
        verification: Arc<dyn VerificationService>,
        search: Arc<SearchClient>,
        archival: Arc<ArchivalService>,
        stellar: Arc<StellarRpcClient>,
        logger: Arc<Logger>,
    ) -> Self {
        // Controllers are derived from the service layer, so callers keep the
        // same constructor signature (backwards compatible).
        let email_controller = Arc::new(EmailController::new(email.clone()));
        let notification_controller = Arc::new(NotificationController::new(notification.clone()));
        let reporting_controller = Arc::new(ReportingController::new(reporting.clone()));
        let storage_controller = Arc::new(StorageController::new(storage.clone()));
        let webhook_controller = Arc::new(WebhookController::new(webhook.clone()));
        let audit_controller = Arc::new(AuditController::new(audit.clone()));
        let verification_controller = Arc::new(VerificationController::new(verification.clone()));
        let search_controller = Arc::new(SearchController::new(search.clone()));
        let archival_controller = Arc::new(ArchivalController::new(archival.clone()));
        Self {
            email,
            notification,
            reporting,
            storage,
            webhook,
            cache,
            cache_invalidation,
            audit,
            verification,
            search,
            archival,
            stellar,
            email_controller,
            notification_controller,
            reporting_controller,
            storage_controller,
            webhook_controller,
            audit_controller,
            verification_controller,
            search_controller,
            archival_controller,
            logger,
        }
    }

    /// Construct the container with **explicit** repositories, services and
    /// controllers.
    ///
    /// This is the layered constructor introduced in #1697. Repositories are
    /// wired into services, services into controllers, and controllers are
    /// exposed to route handlers. Use [`AppContainer::new`] for the legacy
    /// service-only wiring (kept for backwards compatibility).
    #[allow(clippy::too_many_arguments)]
    pub fn with_layers(
        email_repo: Arc<dyn EmailRepository>,
        notification_repo: Arc<dyn NotificationRepository>,
        reporting_repo: Arc<dyn ReportingRepository>,
        storage_repo: Arc<dyn StorageRepository>,
        webhook_repo: Arc<dyn WebhookRepository>,
        audit_repo: Arc<dyn AuditRepository>,
        verification_repo: Arc<dyn VerificationRepository>,
        archival_repo: Arc<dyn ArchivalRepository>,
        cache: Cache,
        cache_invalidation: Arc<CacheInvalidationManager>,
        search: Arc<SearchClient>,
        stellar: Arc<StellarRpcClient>,
    ) -> Self {
        let email: Arc<dyn EmailService> = Arc::new(SendGridEmailService::with_repository(email_repo));
        let notification: Arc<dyn NotificationService> =
            Arc::new(FirebaseNotificationService::with_repository(notification_repo));
        let reporting: Arc<dyn ReportService> = Arc::new(ReportingService::with_repository(reporting_repo));
        let storage: Arc<dyn StorageService> = Arc::new(S3StorageService::with_repository(storage_repo));
        let webhook = Arc::new(WebhookManager::with_repository(webhook_repo));
        let audit = Arc::new(AuditService::with_repository(audit_repo));
        let verification: Arc<dyn VerificationService> =
            Arc::new(DefaultVerificationService::with_repository(verification_repo));
        let archival = Arc::new(ArchivalService::with_repository(archival_repo));

        Self::new(
            email,
            notification,
            reporting,
            storage,
            webhook,
            cache,
            cache_invalidation,
            audit,
            verification,
            search,
            archival,
            stellar,
        )
    }

    /// Construct the container by reading all configuration from environment variables.
    ///
    /// This is the production entry-point.  It builds each concrete service and
    /// calls [`AppContainer::new`].  Every `unwrap_or*` has a documented fallback
    /// value that is safe for local development.
    pub fn from_env() -> Result<Self, String> {
        let logger = Arc::new(Logger::from_env("app"));

        let email_service: Arc<dyn EmailService> = Arc::new(SendGridEmailService::new(
            std::env::var("SENDGRID_API_KEY").unwrap_or_default(),
            std::env::var("FROM_EMAIL").unwrap_or_else(|_| "noreply@scavenger.io".to_string()),
        ));

        let notification_service: Arc<dyn NotificationService> = Arc::new(FirebaseNotificationService::new(
            std::env::var("FIREBASE_PROJECT_ID").unwrap_or_default(),
        ));

        let reporting_service: Arc<dyn ReportService> = Arc::new(ReportingService::new(
            std::env::var("STORAGE_PATH").unwrap_or_else(|_| "/tmp".to_string()),
        ));

        let storage_service: Arc<dyn StorageService> = Arc::new(S3StorageService::new(
            std::env::var("S3_BUCKET").unwrap_or_default(),
            std::env::var("AWS_REGION").unwrap_or_else(|_| "us-east-1".to_string()),
        ));

        let webhook_manager = Arc::new(WebhookManager::new());
        let cache = Cache::new(300);
        let cache_invalidation = Arc::new(CacheInvalidationManager::new());
        let audit_service = Arc::new(AuditService::new());
        let verification_service: Arc<dyn VerificationService> = Arc::new(DefaultVerificationService::new());

        // Stellar RPC — uses STELLAR_RPC_URL / CONTRACT_ID env vars.
        let stellar_rpc_config = StellarRpcConfig::from_env();
        let stellar_client = Arc::new(StellarRpcClient::new(stellar_rpc_config).map_err(|e| {
            logger.error("stellar_rpc_init_failed", &format!("Stellar RPC init failed: {e}"));
            format!("Stellar RPC init failed: {e}")
        })?);

        // Elasticsearch search client.
        let search_config = SearchClientConfig {
            url: std::env::var("ELASTICSEARCH_URL").unwrap_or_else(|_| "http://localhost:9200".to_string()),
            username: std::env::var("ELASTICSEARCH_USERNAME").ok(),
            password: std::env::var("ELASTICSEARCH_PASSWORD").ok(),
            timeout_seconds: 30,
            validate_certificates: true,
        };
        let search_client = Arc::new(SearchClient::new(search_config).map_err(|e| {
            logger.error("search_client_init_failed", &format!("Search client init failed: {e}"));
            format!("Search client init failed: {e}")
        })?);

        // Archival service — file-system backed by default.
        let archival_storage_path =
            std::env::var("ARCHIVAL_STORAGE_PATH").unwrap_or_else(|_| "/tmp/archives".to_string());
        let archival_storage = Arc::new(FileSystemArchivalStorage::new(std::path::PathBuf::from(
            archival_storage_path,
        )));
        let archival_service = Arc::new(ArchivalService::new(archival_storage));

        // ── Repository layer (#1697) ───────────────────────────────────────
        //
        // Repositories are constructed here and injected into the services
        // above via `with_layers`, so route handlers never touch persistence
        // directly.
        let email_repo: Arc<dyn EmailRepository> = Arc::new(InMemoryEmailRepository::new());
        let notification_repo: Arc<dyn NotificationRepository> = Arc::new(InMemoryNotificationRepository::new());
        let reporting_repo: Arc<dyn ReportingRepository> = Arc::new(InMemoryReportingRepository::new());
        let storage_repo: Arc<dyn StorageRepository> = Arc::new(InMemoryStorageRepository::new());
        let webhook_repo: Arc<dyn WebhookRepository> = Arc::new(InMemoryWebhookRepository::new());
        let audit_repo: Arc<dyn AuditRepository> = Arc::new(InMemoryAuditRepository::new());
        let verification_repo: Arc<dyn VerificationRepository> = Arc::new(InMemoryVerificationRepository::new());
        let archival_repo: Arc<dyn ArchivalRepository> = Arc::new(FileSystemArchivalRepository::new(
            std::path::PathBuf::from(archival_storage_path),
        ));

        logger.info("container_initialized", "AppContainer built from environment");

        let _ = Self::new_with_logger(
            email_service,
            notification_service,
            reporting_service,
            storage_service,
            webhook_manager,
            audit_service,
            verification_service,
            archival_service,
        );

        Ok(Self::with_layers(
            email_repo,
            notification_repo,
            reporting_repo,
            storage_repo,
            webhook_repo,
            audit_repo,
            verification_repo,
            archival_repo,
            cache,
            cache_invalidation,
            search_client,
            stellar_client,
            logger,
        ))
    }
}

// ── Fake implementations for unit tests ──────────────────────────────────────

#[cfg(test)]
pub mod fakes {
    //! In-memory fakes for every service trait.
    //!
    //! Import these in unit tests instead of spinning up real connections.
    //! All fakes implement the same traits as the real services, so they can
    //! be passed to `AppContainer::new` directly.

    use std::collections::HashMap;
    use std::sync::Mutex;

    use crate::services::{
        email::{DigestEmail, EmailError, TransactionalEmail},
        notifications::{
            DeviceToken, NotificationError, NotificationPreference, PushNotification, ScheduledNotification,
        },
        reporting::{Report, ReportError, ReportRequest, ReportTemplate, ScheduledReport},
        storage::{FileMetadata, SignedUrlRequest, StorageError, UploadRequest},
        verification::{Document, ParticipantVerification, VerificationChecklist},
        EmailService, NotificationService, ReportService, StorageService, VerificationService,
    };

    // ── Email ──────────────────────────────────────────────────────────────
    pub struct FakeEmailService {
        pub transactional: Mutex<Vec<TransactionalEmail>>,
    }

    impl FakeEmailService {
        pub fn new() -> Self {
            Self {
                transactional: Mutex::new(vec![]),
            }
        }
    }

    #[async_trait::async_trait]
    impl EmailService for FakeEmailService {
        async fn send_transactional(&self, email: TransactionalEmail) -> Result<String, EmailError> {
            self.transactional.lock().unwrap().push(email);
            Ok("fake-msg-id".to_string())
        }
        async fn send_digest(&self, _email: DigestEmail) -> Result<String, EmailError> {
            Ok("fake-digest-id".to_string())
        }
        async fn add_to_unsubscribe_list(&self, _email: &str) -> Result<(), EmailError> {
            Ok(())
        }
        async fn is_unsubscribed(&self, _email: &str) -> Result<bool, EmailError> {
            Ok(false)
        }
    }

    // ── Notifications ──────────────────────────────────────────────────────
    pub struct FakeNotificationService {
        pub sent: Mutex<Vec<(String, PushNotification)>>,
    }

    impl FakeNotificationService {
        pub fn new() -> Self {
            Self {
                sent: Mutex::new(vec![]),
            }
        }
    }

    #[async_trait::async_trait]
    impl NotificationService for FakeNotificationService {
        async fn register_device(&self, _token: DeviceToken) -> Result<String, NotificationError> {
            Ok("fake-device-id".to_string())
        }
        async fn send_notification(
            &self,
            device_token: &str,
            notification: PushNotification,
        ) -> Result<String, NotificationError> {
            self.sent.lock().unwrap().push((device_token.to_string(), notification));
            Ok("fake-message-id".to_string())
        }
        async fn set_preferences(&self, _pref: NotificationPreference) -> Result<(), NotificationError> {
            Ok(())
        }
        async fn get_preferences(&self, user_id: &str) -> Result<NotificationPreference, NotificationError> {
            Ok(NotificationPreference {
                user_id: user_id.to_string(),
                enabled: true,
                categories: vec![],
            })
        }
        async fn schedule_notification(&self, sn: ScheduledNotification) -> Result<String, NotificationError> {
            self.sent.lock().unwrap().push((sn.device_token, sn.notification));
            Ok("fake-scheduled-id".to_string())
        }
    }

    // ── Storage ────────────────────────────────────────────────────────────
    pub struct FakeStorageService {
        pub uploads: Mutex<Vec<String>>,
    }

    impl FakeStorageService {
        pub fn new() -> Self {
            Self {
                uploads: Mutex::new(vec![]),
            }
        }
    }

    #[async_trait::async_trait]
    impl StorageService for FakeStorageService {
        async fn upload_file(&self, request: UploadRequest) -> Result<FileMetadata, StorageError> {
            self.uploads.lock().unwrap().push(request.filename.clone());
            Ok(FileMetadata {
                file_id: "fake-id".to_string(),
                filename: request.filename,
                content_type: request.content_type,
                size: request.data.len() as u64,
                created_at: chrono::Utc::now().to_rfc3339(),
                url: "https://fake-storage/fake-id".to_string(),
            })
        }
        async fn delete_file(&self, file_id: &str) -> Result<(), StorageError> {
            self.uploads.lock().unwrap().retain(|k| k != file_id);
            Ok(())
        }
        async fn get_signed_url(&self, req: SignedUrlRequest) -> Result<String, StorageError> {
            Ok(format!("https://fake-storage/{}?signed=1", req.file_id))
        }
        async fn get_file_metadata(&self, file_id: &str) -> Result<FileMetadata, StorageError> {
            Ok(FileMetadata {
                file_id: file_id.to_string(),
                filename: "fake.pdf".to_string(),
                content_type: "application/pdf".to_string(),
                size: 0,
                created_at: chrono::Utc::now().to_rfc3339(),
                url: format!("https://fake-storage/{file_id}"),
            })
        }
    }

    // ── Reporting ──────────────────────────────────────────────────────────
    pub struct FakeReportService {
        pub generated: Mutex<Vec<String>>,
    }

    impl FakeReportService {
        pub fn new() -> Self {
            Self {
                generated: Mutex::new(vec![]),
            }
        }
    }

    #[async_trait::async_trait]
    impl ReportService for FakeReportService {
        async fn generate_report(&self, request: ReportRequest) -> Result<Report, ReportError> {
            self.generated.lock().unwrap().push(request.report_type.clone());
            Ok(Report {
                id: "fake-report-id".to_string(),
                report_type: request.report_type,
                format: request.format,
                status: "completed".to_string(),
                created_at: chrono::Utc::now().to_rfc3339(),
                file_url: Some("https://fake-storage/report.pdf".to_string()),
            })
        }
        async fn get_report(&self, report_id: &str) -> Result<Report, ReportError> {
            Ok(Report {
                id: report_id.to_string(),
                report_type: "waste".to_string(),
                format: "pdf".to_string(),
                status: "completed".to_string(),
                created_at: chrono::Utc::now().to_rfc3339(),
                file_url: None,
            })
        }
        async fn schedule_report(&self, _: ScheduledReport) -> Result<String, ReportError> {
            Ok("fake-schedule-id".to_string())
        }
        async fn get_templates(&self) -> Result<Vec<ReportTemplate>, ReportError> {
            Ok(vec![])
        }
        async fn cache_report(&self, _report_id: &str, _data: Vec<u8>) -> Result<(), ReportError> {
            Ok(())
        }
    }

    // ── Verification ───────────────────────────────────────────────────────
    pub struct FakeVerificationService {
        pub approvals: Mutex<Vec<String>>,
        pub rejections: Mutex<Vec<String>>,
    }

    impl FakeVerificationService {
        pub fn new() -> Self {
            Self {
                approvals: Mutex::new(vec![]),
                rejections: Mutex::new(vec![]),
            }
        }
    }

    fn make_fake_verification(
        participant_id: &str,
        status: crate::services::verification::VerificationStatus,
    ) -> ParticipantVerification {
        ParticipantVerification {
            participant_id: participant_id.to_string(),
            status,
            documents: vec![],
            checklist: VerificationChecklist {
                id: "fake-checklist".to_string(),
                participant_id: participant_id.to_string(),
                checks: HashMap::new(),
                completed_at: None,
            },
            notes: None,
            submitted_at: chrono::Utc::now(),
            reviewed_at: None,
            reviewed_by: None,
            retry_count: 0,
            last_retry_at: None,
        }
    }

    #[async_trait::async_trait]
    impl VerificationService for FakeVerificationService {
        async fn start_verification(&self, participant_id: String) -> Result<ParticipantVerification, String> {
            Ok(make_fake_verification(
                &participant_id,
                crate::services::verification::VerificationStatus::Pending,
            ))
        }
        async fn submit_document(
            &self,
            participant_id: String,
            doc_type: String,
            url: String,
        ) -> Result<Document, String> {
            Ok(Document {
                id: "fake-doc".to_string(),
                participant_id,
                doc_type,
                url,
                uploaded_at: chrono::Utc::now(),
                verified: false,
                verification_notes: None,
            })
        }
        async fn verify_document(&self, doc_id: String) -> Result<Document, String> {
            Ok(Document {
                id: doc_id,
                participant_id: "fake-participant".to_string(),
                doc_type: "id".to_string(),
                url: "https://fake/doc".to_string(),
                uploaded_at: chrono::Utc::now(),
                verified: true,
                verification_notes: None,
            })
        }
        async fn get_verification_status(&self, participant_id: String) -> Result<ParticipantVerification, String> {
            Ok(make_fake_verification(
                &participant_id,
                crate::services::verification::VerificationStatus::Pending,
            ))
        }
        async fn submit_checklist(
            &self,
            participant_id: String,
            checks: HashMap<String, bool>,
        ) -> Result<VerificationChecklist, String> {
            Ok(VerificationChecklist {
                id: "fake-checklist".to_string(),
                participant_id,
                checks,
                completed_at: Some(chrono::Utc::now()),
            })
        }
        async fn create_review_queue_item(&self, _participant_id: String) -> Result<String, String> {
            Ok("fake-queue-item".to_string())
        }
        async fn approve_participant(&self, participant_id: String, _reviewer_id: String) -> Result<(), String> {
            self.approvals.lock().unwrap().push(participant_id);
            Ok(())
        }
        async fn reject_participant(
            &self,
            participant_id: String,
            _reason: String,
            _reviewer_id: String,
        ) -> Result<(), String> {
            self.rejections.lock().unwrap().push(participant_id);
            Ok(())
        }
        async fn get_pending_reviews(&self) -> Result<Vec<ParticipantVerification>, String> {
            Ok(vec![])
        }
        async fn retry_verification(&self, participant_id: String) -> Result<ParticipantVerification, String> {
            Ok(make_fake_verification(
                &participant_id,
                crate::services::verification::VerificationStatus::Pending,
            ))
        }
        async fn send_approval_notification(&self, _participant_id: String) -> Result<(), String> {
            Ok(())
        }
        async fn send_rejection_notification(&self, _participant_id: String, _reason: String) -> Result<(), String> {
            Ok(())
        }
    }
}

// ── Container construction tests ──────────────────────────────────────────────

#[cfg(test)]
mod container_tests {
    //! Verifies that `AppContainer::new` can be wired up with fake services
    //! and that the trait objects satisfy the required bounds.

    use std::sync::Arc;

    use super::fakes::*;
    use crate::{
        cache::{Cache, CacheInvalidationManager},
        rpc::{StellarRpcClient, StellarRpcConfig},
        search::{SearchClient, SearchClientConfig},
        services::{
            ArchivalService, AuditService, EmailService, FileSystemArchivalStorage, NotificationService, ReportService,
            StorageService, VerificationService, WebhookManager,
        },
    };

    /// Build a minimal test-only `AppContainer` using in-memory fakes for all
    /// trait-object services and stub configurations for infrastructure clients.
    ///
    /// This test verifies:
    /// * All service traits are `dyn`-compatible.
    /// * `AppContainer::new` accepts them without implicit ordering.
    /// * No panics occur during construction with test config values.
    #[test]
    fn container_builds_with_test_fakes() {
        let email: Arc<dyn EmailService> = Arc::new(FakeEmailService::new());
        let notification: Arc<dyn NotificationService> = Arc::new(FakeNotificationService::new());
        let reporting: Arc<dyn ReportService> = Arc::new(FakeReportService::new());
        let storage: Arc<dyn StorageService> = Arc::new(FakeStorageService::new());
        let webhook = Arc::new(WebhookManager::new());
        let cache = Cache::new(60);
        let cache_invalidation = Arc::new(CacheInvalidationManager::new());
        let audit = Arc::new(AuditService::new());
        let verification: Arc<dyn VerificationService> = Arc::new(FakeVerificationService::new());

        // Search client with a test URL (no real connection made at construction).
        let search_config = SearchClientConfig {
            url: "http://localhost:9200".to_string(),
            username: None,
            password: None,
            timeout_seconds: 5,
            validate_certificates: false,
        };
        let search = Arc::new(SearchClient::new(search_config).expect("search client construction should not fail"));

        // Archival service backed by /tmp.
        let archival_storage = Arc::new(FileSystemArchivalStorage::new(std::path::PathBuf::from(
            "/tmp/test-archives",
        )));
        let archival = Arc::new(ArchivalService::new(archival_storage));

        // Stellar RPC with stub config (no real connection made at construction).
        let stellar_config = StellarRpcConfig::from_env();
        let stellar =
            Arc::new(StellarRpcClient::new(stellar_config).expect("stellar client construction should not fail"));

        // Exercise the explicit constructor — this is the assertion: it compiles
        // and runs without panicking.
        let container = super::AppContainer::new(
            email,
            notification,
            reporting,
            storage,
            webhook,
            cache,
            cache_invalidation,
            audit,
            verification,
            search,
            archival,
            stellar,
        );

        // Spot-check that the container fields are accessible.
        // (No network calls are made; these are all in-memory fakes or stubs.)
        let _ = container.audit.clone();
        let _ = container.cache.clone();
        let _ = container.webhook.clone();
        let _ = container.logger.clone();
    }

    /// The explicit-logger constructor must store the injected logger.
    #[test]
    fn container_accepts_injected_logger() {
        let email: Arc<dyn EmailService> = Arc::new(FakeEmailService::new());
        let notification: Arc<dyn NotificationService> = Arc::new(FakeNotificationService::new());
        let reporting: Arc<dyn ReportService> = Arc::new(FakeReportService::new());
        let storage: Arc<dyn StorageService> = Arc::new(FakeStorageService::new());
        let webhook = Arc::new(WebhookManager::new());
        let cache = Cache::new(60);
        let cache_invalidation = Arc::new(CacheInvalidationManager::new());
        let audit = Arc::new(AuditService::new());
        let verification: Arc<dyn VerificationService> = Arc::new(FakeVerificationService::new());

        let search_config = SearchClientConfig {
            url: "http://localhost:9200".to_string(),
            username: None,
            password: None,
            timeout_seconds: 5,
            validate_certificates: false,
        };
        let search = Arc::new(SearchClient::new(search_config).expect("search client construction should not fail"));

        let archival_storage = Arc::new(FileSystemArchivalStorage::new(std::path::PathBuf::from(
            "/tmp/test-archives",
        )));
        let archival = Arc::new(ArchivalService::new(archival_storage));

        let stellar_config = StellarRpcConfig::from_env();
        let stellar =
            Arc::new(StellarRpcClient::new(stellar_config).expect("stellar client construction should not fail"));

        let logger = Arc::new(crate::logger::Logger::new("test"));

        let container = super::AppContainer::new_with_logger(
            email,
            notification,
            reporting,
            storage,
            webhook,
            cache,
            cache_invalidation,
            audit,
            verification,
            search,
            archival,
            stellar,
            logger.clone(),
        );

        assert!(Arc::ptr_eq(&container.logger, &logger));
    }

    /// Verifies that the layered constructor wires repositories → services →
    /// controllers and that every controller is reachable from the container.
    #[test]
    fn container_builds_with_layered_wiring() {
        use crate::repositories::{
            FileSystemArchivalRepository, InMemoryAuditRepository, InMemoryEmailRepository,
            InMemoryNotificationRepository, InMemoryReportingRepository, InMemoryStorageRepository,
            InMemoryVerificationRepository, InMemoryWebhookRepository,
        };

        let search_config = SearchClientConfig {
            url: "http://localhost:9200".to_string(),
            username: None,
            password: None,
            timeout_seconds: 5,
            validate_certificates: false,
        };
        let search = Arc::new(SearchClient::new(search_config).expect("search client construction should not fail"));
        let stellar = Arc::new(
            StellarRpcClient::new(StellarRpcConfig::from_env()).expect("stellar client construction should not fail"),
        );

        let container = super::AppContainer::with_layers(
            Arc::new(InMemoryEmailRepository::new()),
            Arc::new(InMemoryNotificationRepository::new()),
            Arc::new(InMemoryReportingRepository::new()),
            Arc::new(InMemoryStorageRepository::new()),
            Arc::new(InMemoryWebhookRepository::new()),
            Arc::new(InMemoryAuditRepository::new()),
            Arc::new(InMemoryVerificationRepository::new()),
            Arc::new(FileSystemArchivalRepository::new(std::path::PathBuf::from(
                "/tmp/test-archives",
            ))),
            Cache::new(60),
            Arc::new(CacheInvalidationManager::new()),
            search,
            stellar,
        );

        // Every controller must be resolvable from the container.
        let _ = container.email_controller.clone();
        let _ = container.notification_controller.clone();
        let _ = container.reporting_controller.clone();
        let _ = container.storage_controller.clone();
        let _ = container.webhook_controller.clone();
        let _ = container.audit_controller.clone();
        let _ = container.verification_controller.clone();
        let _ = container.search_controller.clone();
        let _ = container.archival_controller.clone();
    }
}
