use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::sync::Mutex;
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
}
