use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::sync::{Arc, Mutex};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ExportError {
    #[error("CSV export error: {0}")]
    CsvError(String),
    #[error("JSON export error: {0}")]
    JsonError(String),
    #[error("PDF export error: {0}")]
    PdfError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Invalid format: {0}")]
    InvalidFormat(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    CSV,
    JSON,
    PDF,
}

impl std::fmt::Display for ExportFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExportFormat::CSV => write!(f, "csv"),
            ExportFormat::JSON => write!(f, "json"),
            ExportFormat::PDF => write!(f, "pdf"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub id: String,
    pub waste_type: String,
    pub weight: u128,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportHistoryEntry {
    pub id: String,
    pub format: String,
    pub data_type: String,
    pub status: String,
    pub requested_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub file_size: Option<u64>,
    pub record_count: Option<u64>,
    pub anonymized: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledExport {
    pub id: String,
    pub format: String,
    pub data_type: String,
    pub schedule: String,
    pub recipients: Vec<String>,
    pub anonymize: bool,
    pub enabled: bool,
    pub last_run: Option<DateTime<Utc>>,
    pub next_run: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnonymizationConfig {
    pub anonymize_ids: bool,
    pub anonymize_names: bool,
    pub anonymize_locations: bool,
    pub anonymize_dates: bool,
}

impl Default for AnonymizationConfig {
    fn default() -> Self {
        Self {
            anonymize_ids: true,
            anonymize_names: true,
            anonymize_locations: true,
            anonymize_dates: false,
        }
    }
}

pub struct ExportService;

impl ExportService {
    pub fn export_to_csv(data: Vec<ExportData>) -> Result<String, Box<dyn Error>> {
        let mut csv_content = String::from("ID,Waste Type,Weight,Status,Created At\n");

        for item in data {
            csv_content.push_str(&format!(
                "{},{},{},{},{}\n",
                item.id, item.waste_type, item.weight, item.status, item.created_at
            ));
        }

        Ok(csv_content)
    }

    pub fn export_to_json(data: Vec<ExportData>) -> Result<String, Box<dyn Error>> {
        let json = serde_json::to_string_pretty(&data)?;
        Ok(json)
    }

    pub fn export_to_pdf(data: Vec<ExportData>) -> Result<Vec<u8>, Box<dyn Error>> {
        use printpdf::*;
        use std::io::BufWriter;

        let (document, page1, layer1) = PdfDocument::new("Scavenger Export", Mm(210.0), Mm(297.0), "Layer 1");
        let font = document.add_builtin_font(BuiltinFont::Helvetica)?;
        let current_layer = document.get_page(page1).get_layer(layer1);

        let mut y_pos = 280.0;
        current_layer.use_text("Scavenger Data Export", 24.0, Mm(10.0), Mm(y_pos), &font);
        y_pos -= 10.0;

        for item in data {
            let text = format!(
                "ID: {} | Type: {} | Weight: {} | Status: {}",
                item.id, item.waste_type, item.weight, item.status
            );
            current_layer.use_text(&text, 10.0, Mm(10.0), Mm(y_pos), &font);
            y_pos -= 5.0;

            if y_pos < 10.0 {
                break;
            }
        }

        let mut buffer = Vec::new();
        document.save(&mut BufWriter::new(&mut buffer))?;
        Ok(buffer)
    }

    pub fn export(format: ExportFormat, data: Vec<ExportData>) -> Result<Vec<u8>, Box<dyn Error>> {
        match format {
            ExportFormat::CSV => {
                let csv = Self::export_to_csv(data)?;
                Ok(csv.into_bytes())
            }
            ExportFormat::JSON => {
                let json = Self::export_to_json(data)?;
                Ok(json.into_bytes())
            }
            ExportFormat::PDF => Self::export_to_pdf(data),
        }
    }

    pub fn anonymize_data(data: Vec<ExportData>) -> Vec<ExportData> {
        data.into_iter()
            .map(|item| {
                let hash_id = |s: &str| -> String {
                    let hash = sha256_hash(s);
                    hash[..12].to_string()
                };
                ExportData {
                    id: hash_id(&item.id),
                    waste_type: item.waste_type,
                    weight: item.weight,
                    status: item.status,
                    created_at: item.created_at,
                }
            })
            .collect()
    }

    pub fn export_with_anonymization(
        format: ExportFormat,
        data: Vec<ExportData>,
        anonymize: bool,
    ) -> Result<Vec<u8>, Box<dyn Error>> {
        let processed = if anonymize { Self::anonymize_data(data) } else { data };
        Self::export(format, processed)
    }
}

fn sha256_hash(input: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    input.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

pub struct ExportTracker {
    history: Mutex<Vec<ExportHistoryEntry>>,
    scheduled: Mutex<Vec<ScheduledExport>>,
}

impl ExportTracker {
    pub fn new() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
            scheduled: Mutex::new(Vec::new()),
        }
    }

    pub fn record_export(
        &self,
        format: &str,
        data_type: &str,
        requested_by: Option<String>,
        file_size: Option<u64>,
        record_count: Option<u64>,
        anonymized: bool,
    ) -> String {
        let entry = ExportHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            format: format.to_string(),
            data_type: data_type.to_string(),
            status: "completed".to_string(),
            requested_by,
            created_at: Utc::now(),
            completed_at: Some(Utc::now()),
            file_size,
            record_count,
            anonymized,
            error: None,
        };
        let id = entry.id.clone();
        if let Ok(mut history) = self.history.lock() {
            history.push(entry);
        }
        id
    }

    pub fn get_history(&self) -> Vec<ExportHistoryEntry> {
        self.history.lock().unwrap().clone()
    }

    pub fn add_scheduled_export(&self, config: ScheduledExport) {
        if let Ok(mut scheduled) = self.scheduled.lock() {
            scheduled.push(config);
        }
    }

    pub fn get_scheduled_exports(&self) -> Vec<ScheduledExport> {
        self.scheduled.lock().unwrap().clone()
    }

    pub fn remove_scheduled_export(&self, id: &str) -> bool {
        if let Ok(mut scheduled) = self.scheduled.lock() {
            let before = scheduled.len();
            scheduled.retain(|s| s.id != id);
            scheduled.len() < before
        } else {
            false
        }
    }
}

impl Default for ExportTracker {
    fn default() -> Self {
        Self::new()
    }
}

/// Repository abstraction for export-related data access.
///
/// Route handlers should depend on this trait (via `ExportController`) rather
/// than reaching into storage directly, keeping the HTTP layer thin.
pub trait ExportRepository: Send + Sync {
    /// Persist a completed export history entry.
    fn save_history(&self, entry: ExportHistoryEntry) -> Result<(), ExportError>;

    /// Return all recorded export history entries.
    fn list_history(&self) -> Result<Vec<ExportHistoryEntry>, ExportError>;

    /// Persist a scheduled export configuration.
    fn save_scheduled(&self, scheduled: ScheduledExport) -> Result<(), ExportError>;

    /// Return all scheduled export configurations.
    fn list_scheduled(&self) -> Result<Vec<ScheduledExport>, ExportError>;

    /// Remove a scheduled export by id, returning whether it existed.
    fn delete_scheduled(&self, id: &str) -> Result<bool, ExportError>;
}

/// In-memory repository backed by `ExportTracker`.
///
/// This preserves the previous behavior of `ExportTracker` while exposing it
/// through the `ExportRepository` trait so controllers can be tested with mocks.
pub struct InMemoryExportRepository {
    tracker: ExportTracker,
}

impl InMemoryExportRepository {
    pub fn new() -> Self {
        Self {
            tracker: ExportTracker::new(),
        }
    }
}

impl Default for InMemoryExportRepository {
    fn default() -> Self {
        Self::new()
    }
}

impl ExportRepository for InMemoryExportRepository {
    fn save_history(&self, entry: ExportHistoryEntry) -> Result<(), ExportError> {
        if let Ok(mut history) = self.tracker.history.lock() {
            history.push(entry);
            Ok(())
        } else {
            Err(ExportError::SerializationError(
                "failed to lock export history".to_string(),
            ))
        }
    }

    fn list_history(&self) -> Result<Vec<ExportHistoryEntry>, ExportError> {
        Ok(self.tracker.get_history())
    }

    fn save_scheduled(&self, scheduled: ScheduledExport) -> Result<(), ExportError> {
        self.tracker.add_scheduled_export(scheduled);
        Ok(())
    }

    fn list_scheduled(&self) -> Result<Vec<ScheduledExport>, ExportError> {
        Ok(self.tracker.get_scheduled_exports())
    }

    fn delete_scheduled(&self, id: &str) -> Result<bool, ExportError> {
        Ok(self.tracker.remove_scheduled_export(id))
    }
}

/// Business logic for export operations, extracted from the route handlers.
///
/// The controller owns no storage of its own; all persistence goes through the
/// injected `ExportRepository`, which makes it straightforward to unit test.
pub struct ExportController {
    repository: Arc<dyn ExportRepository>,
}

impl ExportController {
    pub fn new(repository: Arc<dyn ExportRepository>) -> Self {
        Self { repository }
    }

    /// Export the given data in the requested format, optionally anonymizing it.
    pub fn export_data(
        &self,
        format: ExportFormat,
        data: Vec<ExportData>,
        anonymize: bool,
    ) -> Result<Vec<u8>, ExportError> {
        ExportService::export_with_anonymization(format, data, anonymize)
            .map_err(|e| ExportError::SerializationError(e.to_string()))
    }

    /// Export data and record the result in the export history.
    pub fn export_and_record(
        &self,
        format: ExportFormat,
        data_type: &str,
        data: Vec<ExportData>,
        anonymize: bool,
        requested_by: Option<String>,
    ) -> Result<ExportHistoryEntry, ExportError> {
        let record_count = data.len() as u64;
        let bytes = self.export_data(format.clone(), data, anonymize)?;
        let now = Utc::now();
        let entry = ExportHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            format: format.to_string(),
            data_type: data_type.to_string(),
            status: "completed".to_string(),
            requested_by,
            created_at: now,
            completed_at: Some(now),
            file_size: Some(bytes.len() as u64),
            record_count: Some(record_count),
            anonymized: anonymize,
            error: None,
        };
        self.repository.save_history(entry.clone())?;
        Ok(entry)
    }

    /// Return the export history.
    pub fn get_history(&self) -> Result<Vec<ExportHistoryEntry>, ExportError> {
        self.repository.list_history()
    }

    /// Register a new scheduled export.
    pub fn schedule_export(&self, scheduled: ScheduledExport) -> Result<(), ExportError> {
        self.repository.save_scheduled(scheduled)
    }

    /// List all scheduled exports.
    pub fn get_scheduled_exports(&self) -> Result<Vec<ScheduledExport>, ExportError> {
        self.repository.list_scheduled()
    }

    /// Remove a scheduled export by id.
    pub fn cancel_scheduled_export(&self, id: &str) -> Result<bool, ExportError> {
        self.repository.delete_scheduled(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_data() -> Vec<ExportData> {
        vec![
            ExportData {
                id: "waste-001".to_string(),
                waste_type: "plastic".to_string(),
                weight: 100,
                status: "pending".to_string(),
                created_at: "2024-01-01T00:00:00Z".to_string(),
            },
            ExportData {
                id: "waste-002".to_string(),
                waste_type: "metal".to_string(),
                weight: 250,
                status: "approved".to_string(),
                created_at: "2024-01-02T00:00:00Z".to_string(),
            },
        ]
    }

    #[test]
    fn test_export_csv() {
        let result = ExportService::export_to_csv(sample_data()).unwrap();
        assert!(result.contains("ID,Waste Type,Weight,Status,Created At"));
        assert!(result.contains("waste-001,plastic,100,pending"));
    }

    #[test]
    fn test_export_json() {
        let result = ExportService::export_to_json(sample_data()).unwrap();
        assert!(result.contains("waste-001"));
        assert!(result.contains("plastic"));
    }

    #[test]
    fn test_export_pdf() {
        let result = ExportService::export_to_pdf(sample_data()).unwrap();
        assert!(!result.is_empty());
    }

    #[test]
    fn test_export_format_csv() {
        let result = ExportService::export(ExportFormat::CSV, sample_data()).unwrap();
        let content = String::from_utf8(result).unwrap();
        assert!(content.contains("waste-001"));
    }

    #[test]
    fn test_export_format_json() {
        let result = ExportService::export(ExportFormat::JSON, sample_data()).unwrap();
        let content = String::from_utf8(result).unwrap();
        assert!(content.contains("waste-001"));
    }

    #[test]
    fn test_anonymize_data() {
        let anonymized = ExportService::anonymize_data(sample_data());
        assert_ne!(anonymized[0].id, "waste-001");
        assert_eq!(anonymized[0].waste_type, "plastic");
        assert_eq!(anonymized[0].weight, 100);
    }

    #[test]
    fn test_export_with_anonymization() {
        let result = ExportService::export_with_anonymization(ExportFormat::JSON, sample_data(), true).unwrap();
        let content = String::from_utf8(result).unwrap();
        assert!(!content.contains("waste-001"));
    }

    #[test]
    fn test_export_tracker() {
        let tracker = ExportTracker::new();
        let id = tracker.record_export(
            "csv",
            "waste",
            Some("user-001".to_string()),
            Some(1024),
            Some(10),
            false,
        );
        assert_eq!(tracker.get_history().len(), 1);
        assert_eq!(tracker.get_history()[0].format, "csv");
    }

    #[test]
    fn test_scheduled_exports() {
        let tracker = ExportTracker::new();
        let export = ScheduledExport {
            id: "sched-001".to_string(),
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            schedule: "0 0 * * *".to_string(),
            recipients: vec!["admin@test.com".to_string()],
            anonymize: true,
            enabled: true,
            last_run: None,
            next_run: None,
            created_at: Utc::now(),
        };
        tracker.add_scheduled_export(export);
        assert_eq!(tracker.get_scheduled_exports().len(), 1);
        assert!(tracker.remove_scheduled_export("sched-001"));
        assert_eq!(tracker.get_scheduled_exports().len(), 0);
    }

    #[test]
    fn test_export_format_display() {
        assert_eq!(ExportFormat::CSV.to_string(), "csv");
        assert_eq!(ExportFormat::JSON.to_string(), "json");
        assert_eq!(ExportFormat::PDF.to_string(), "pdf");
    }

    /// Mock repository recording calls for controller tests.
    #[derive(Default)]
    struct MockExportRepository {
        history: Mutex<Vec<ExportHistoryEntry>>,
        scheduled: Mutex<Vec<ScheduledExport>>,
        fail: bool,
    }

    impl MockExportRepository {
        fn failing() -> Self {
            Self {
                fail: true,
                ..Default::default()
            }
        }
    }

    impl ExportRepository for MockExportRepository {
        fn save_history(&self, entry: ExportHistoryEntry) -> Result<(), ExportError> {
            if self.fail {
                return Err(ExportError::SerializationError("mock failure".to_string()));
            }
            self.history.lock().unwrap().push(entry);
            Ok(())
        }

        fn list_history(&self) -> Result<Vec<ExportHistoryEntry>, ExportError> {
            Ok(self.history.lock().unwrap().clone())
        }

        fn save_scheduled(&self, scheduled: ScheduledExport) -> Result<(), ExportError> {
            self.scheduled.lock().unwrap().push(scheduled);
            Ok(())
        }

        fn list_scheduled(&self) -> Result<Vec<ScheduledExport>, ExportError> {
            Ok(self.scheduled.lock().unwrap().clone())
        }

        fn delete_scheduled(&self, id: &str) -> Result<bool, ExportError> {
            let mut scheduled = self.scheduled.lock().unwrap();
            let before = scheduled.len();
            scheduled.retain(|s| s.id != id);
            Ok(scheduled.len() < before)
        }
    }

    fn sample_scheduled(id: &str) -> ScheduledExport {
        ScheduledExport {
            id: id.to_string(),
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            schedule: "0 0 * * *".to_string(),
            recipients: vec!["admin@test.com".to_string()],
            anonymize: true,
            enabled: true,
            last_run: None,
            next_run: None,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn test_controller_export_data_csv() {
        let controller = ExportController::new(Arc::new(MockExportRepository::default()));
        let bytes = controller.export_data(ExportFormat::CSV, sample_data(), false).unwrap();
        let content = String::from_utf8(bytes).unwrap();
        assert!(content.contains("waste-001"));
    }

    #[test]
    fn test_controller_export_data_anonymized() {
        let controller = ExportController::new(Arc::new(MockExportRepository::default()));
        let bytes = controller.export_data(ExportFormat::JSON, sample_data(), true).unwrap();
        let content = String::from_utf8(bytes).unwrap();
        assert!(!content.contains("waste-001"));
    }

    #[test]
    fn test_controller_export_and_record() {
        let repo = Arc::new(MockExportRepository::default());
        let controller = ExportController::new(repo.clone());
        let entry = controller
            .export_and_record(
                ExportFormat::CSV,
                "waste",
                sample_data(),
                false,
                Some("user-001".to_string()),
            )
            .unwrap();
        assert_eq!(entry.format, "csv");
        assert_eq!(entry.data_type, "waste");
        assert_eq!(entry.record_count, Some(2));
        assert!(entry.file_size.unwrap() > 0);
        assert_eq!(repo.list_history().unwrap().len(), 1);
        assert_eq!(controller.get_history().unwrap().len(), 1);
    }

    #[test]
    fn test_controller_export_and_record_repository_failure() {
        let controller = ExportController::new(Arc::new(MockExportRepository::failing()));
        let result = controller.export_and_record(ExportFormat::JSON, "waste", sample_data(), false, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_controller_scheduled_exports() {
        let controller = ExportController::new(Arc::new(MockExportRepository::default()));
        controller.schedule_export(sample_scheduled("sched-001")).unwrap();
        assert_eq!(controller.get_scheduled_exports().unwrap().len(), 1);
        assert!(controller.cancel_scheduled_export("sched-001").unwrap());
        assert_eq!(controller.get_scheduled_exports().unwrap().len(), 0);
        assert!(!controller.cancel_scheduled_export("missing").unwrap());
    }

    #[test]
    fn test_in_memory_repository_roundtrip() {
        let repo = InMemoryExportRepository::new();
        let entry = ExportHistoryEntry {
            id: "hist-001".to_string(),
            format: "csv".to_string(),
            data_type: "waste".to_string(),
            status: "completed".to_string(),
            requested_by: None,
            created_at: Utc::now(),
            completed_at: Some(Utc::now()),
            file_size: Some(10),
            record_count: Some(1),
            anonymized: false,
            error: None,
        };
        repo.save_history(entry).unwrap();
        assert_eq!(repo.list_history().unwrap().len(), 1);

        repo.save_scheduled(sample_scheduled("sched-002")).unwrap();
        assert_eq!(repo.list_scheduled().unwrap().len(), 1);
        assert!(repo.delete_scheduled("sched-002").unwrap());
        assert_eq!(repo.list_scheduled().unwrap().len(), 0);
    }
}
