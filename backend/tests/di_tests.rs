//! Unit tests for services using fake dependencies (#914).
//!
//! All tests in this module wire services together exclusively via the
//! `container::fakes` module — no real network, database, or file-system
//! access happens during these tests.

use std::collections::HashMap;
use std::sync::Arc;

use crate::{
    container::fakes::{
        FakeEmailService, FakeNotificationService, FakeReportService, FakeStorageService, FakeVerificationService,
    },
    services::{
        email::TransactionalEmail, notifications::PushNotification, reporting::ReportRequest, storage::UploadRequest,
        EmailService, NotificationService, ReportService, StorageService, VerificationService,
    },
};

// ── EmailService (fake) ───────────────────────────────────────────────────────

#[tokio::test]
async fn fake_email_sends_transactional() {
    let svc = FakeEmailService::new();
    let email = TransactionalEmail {
        recipient: "test@example.com".to_string(),
        template: "welcome".to_string(),
        context: HashMap::new(),
    };
    let id = svc.send_transactional(email).await.expect("send should succeed");
    assert_eq!(id, "fake-msg-id");
    assert_eq!(svc.transactional.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn fake_email_unsubscribe_list_is_always_empty() {
    let svc = FakeEmailService::new();
    let result = svc.is_unsubscribed("any@example.com").await.unwrap();
    assert!(!result, "fake always returns false");
}

// ── NotificationService (fake) ────────────────────────────────────────────────

#[tokio::test]
async fn fake_notification_records_sent_messages() {
    let svc = FakeNotificationService::new();
    let notif = PushNotification {
        title: "Hello".to_string(),
        body: "World".to_string(),
        data: HashMap::new(),
    };
    let msg_id = svc.send_notification("device-token-abc", notif).await.unwrap();
    assert_eq!(msg_id, "fake-message-id");
    let sent = svc.sent.lock().unwrap();
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0].0, "device-token-abc");
    assert_eq!(sent[0].1.title, "Hello");
}

// ── StorageService (fake) ─────────────────────────────────────────────────────

#[tokio::test]
async fn fake_storage_upload_and_delete() {
    let svc = FakeStorageService::new();
    let req = UploadRequest {
        filename: "report.pdf".to_string(),
        content_type: "application/pdf".to_string(),
        data: vec![1, 2, 3],
    };

    let meta = svc.upload_file(req).await.unwrap();
    assert_eq!(meta.size, 3);
    assert!(meta.url.contains("fake-storage"));

    {
        let uploads = svc.uploads.lock().unwrap();
        assert_eq!(uploads.len(), 1);
        assert_eq!(uploads[0], "report.pdf");
    }

    svc.delete_file("report.pdf").await.unwrap();
    assert!(svc.uploads.lock().unwrap().is_empty());
}

// ── ReportService (fake) ──────────────────────────────────────────────────────

#[tokio::test]
async fn fake_report_generation_is_recorded() {
    let svc = FakeReportService::new();
    let req = ReportRequest {
        report_type: "waste".to_string(),
        format: "pdf".to_string(),
        filters: HashMap::new(),
    };
    let report = svc.generate_report(req).await.unwrap();
    assert_eq!(report.status, "completed");
    assert_eq!(report.report_type, "waste");
    let generated = svc.generated.lock().unwrap();
    assert_eq!(generated.len(), 1);
    assert_eq!(generated[0], "waste");
}

// ── VerificationService (fake) ────────────────────────────────────────────────

#[tokio::test]
async fn fake_verification_approve_records_participant() {
    let svc = FakeVerificationService::new();

    let result = svc
        .approve_participant("participant-123".to_string(), "reviewer-1".to_string())
        .await
        .unwrap();

    let approvals = svc.approvals.lock().unwrap();
    assert_eq!(approvals.len(), 1);
    assert_eq!(approvals[0], "participant-123");
}

#[tokio::test]
async fn fake_verification_reject_records_participant() {
    let svc = FakeVerificationService::new();

    svc.reject_participant(
        "participant-456".to_string(),
        "Insufficient documents".to_string(),
        "reviewer-2".to_string(),
    )
    .await
    .unwrap();

    let rejections = svc.rejections.lock().unwrap();
    assert_eq!(rejections.len(), 1);
    assert_eq!(rejections[0], "participant-456");
}

#[tokio::test]
async fn fake_verification_start_returns_pending() {
    let svc = FakeVerificationService::new();
    let v = svc.start_verification("participant-789".to_string()).await.unwrap();
    assert_eq!(v.participant_id, "participant-789");
    assert!(matches!(
        v.status,
        crate::services::verification::VerificationStatus::Pending
    ));
}

#[tokio::test]
async fn fake_verification_pending_reviews_is_empty() {
    let svc = FakeVerificationService::new();
    let reviews = svc.get_pending_reviews().await.unwrap();
    assert!(reviews.is_empty());
}

// ── AppContainer wiring smoke test ────────────────────────────────────────────
//
// Verifies that constructing an AppContainer with only the services we can
// actually build at test time doesn't panic.  We use Arc<dyn Trait> to confirm
// the trait objects are wired correctly.

#[test]
fn fake_services_are_dyn_compatible() {
    let _email: Arc<dyn crate::services::EmailService> = Arc::new(FakeEmailService::new());
    let _notif: Arc<dyn crate::services::NotificationService> = Arc::new(FakeNotificationService::new());
    let _store: Arc<dyn crate::services::StorageService> = Arc::new(FakeStorageService::new());
    let _report: Arc<dyn crate::services::ReportService> = Arc::new(FakeReportService::new());
    let _verify: Arc<dyn crate::services::VerificationService> = Arc::new(FakeVerificationService::new());
}
