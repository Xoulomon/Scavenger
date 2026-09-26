//! Analytics and reporting module.
use soroban_sdk::{contracttype, Address, String};

/// Analytics report types
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReportType {
    /// Participant activity report
    ParticipantActivity = 0,
    /// Waste processing report
    WasteProcessing = 1,
    /// Incentive performance report
    IncentivePerformance = 2,
    /// Supply chain report
    SupplyChain = 3,
    /// Financial report
    Financial = 4,
    /// Environmental impact report
    EnvironmentalImpact = 5,
}

impl ReportType {
    pub fn to_u32(self) -> u32 {
        self as u32
    }

    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(ReportType::ParticipantActivity),
            1 => Some(ReportType::WasteProcessing),
            2 => Some(ReportType::IncentivePerformance),
            3 => Some(ReportType::SupplyChain),
            4 => Some(ReportType::Financial),
            5 => Some(ReportType::EnvironmentalImpact),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            ReportType::ParticipantActivity => "PARTICIPANT_ACTIVITY",
            ReportType::WasteProcessing => "WASTE_PROCESSING",
            ReportType::IncentivePerformance => "INCENTIVE_PERFORMANCE",
            ReportType::SupplyChain => "SUPPLY_CHAIN",
            ReportType::Financial => "FINANCIAL",
            ReportType::EnvironmentalImpact => "ENVIRONMENTAL_IMPACT",
        }
    }
}

/// Analytics data point
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnalyticsDataPoint {
    /// Timestamp of the data point
    pub timestamp: u64,
    /// Metric name
    pub metric: String,
    /// Metric value
    pub value: u128,
    /// Optional label/category
    pub label: String,
}

impl AnalyticsDataPoint {
    /// Creates a new analytics data point
    pub fn new(env: &soroban_sdk::Env, metric: String, value: u128, label: String) -> Self {
        Self {
            timestamp: env.ledger().timestamp(),
            metric,
            value,
            label,
        }
    }
}

/// Analytics report
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnalyticsReport {
    /// Unique report ID
    pub report_id: u64,
    /// Report type
    pub report_type: ReportType,
    /// Report title
    pub title: String,
    /// Report description
    pub description: String,
    /// Report creator
    pub created_by: Address,
    /// Report creation timestamp
    pub created_at: u64,
    /// Report period start (Unix timestamp)
    pub period_start: u64,
    /// Report period end (Unix timestamp)
    pub period_end: u64,
    /// Total data points in report
    pub data_point_count: u64,
    /// Summary statistics
    pub summary: String,
}

impl AnalyticsReport {
    /// Creates a new analytics report
    pub fn new(
        env: &soroban_sdk::Env,
        report_id: u64,
        report_type: ReportType,
        title: String,
        description: String,
        created_by: Address,
        period_start: u64,
        period_end: u64,
    ) -> Self {
        Self {
            report_id,
            report_type,
            title,
            description,
            created_by,
            created_at: env.ledger().timestamp(),
            period_start,
            period_end,
            data_point_count: 0,
            summary: soroban_sdk::String::from_str(env, ""),
        }
    }

    /// Increments data point count
    pub fn add_data_point(&mut self) {
        self.data_point_count += 1;
    }

    /// Sets the summary
    pub fn set_summary(&mut self, summary: String) {
        self.summary = summary;
    }
}

/// Custom analytics query
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomQuery {
    /// Query ID
    pub query_id: u64,
    /// Query name
    pub name: String,
    /// Query description
    pub description: String,
    /// Query creator
    pub created_by: Address,
    /// Query creation timestamp
    pub created_at: u64,
    /// Query filters (JSON-like string)
    pub filters: String,
    /// Query aggregation type
    pub aggregation: AggregationType,
    /// Last execution timestamp
    pub last_executed: u64,
    /// Execution count
    pub execution_count: u64,
}

/// Aggregation types for analytics
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AggregationType {
    /// Sum aggregation
    Sum = 0,
    /// Average aggregation
    Average = 1,
    /// Count aggregation
    Count = 2,
    /// Min aggregation
    Min = 3,
    /// Max aggregation
    Max = 4,
    /// Percentile aggregation
    Percentile = 5,
}

impl AggregationType {
    pub fn to_u32(self) -> u32 {
        self as u32
    }

    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(AggregationType::Sum),
            1 => Some(AggregationType::Average),
            2 => Some(AggregationType::Count),
            3 => Some(AggregationType::Min),
            4 => Some(AggregationType::Max),
            5 => Some(AggregationType::Percentile),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            AggregationType::Sum => "SUM",
            AggregationType::Average => "AVERAGE",
            AggregationType::Count => "COUNT",
            AggregationType::Min => "MIN",
            AggregationType::Max => "MAX",
            AggregationType::Percentile => "PERCENTILE",
        }
    }
}

impl CustomQuery {
    /// Creates a new custom query
    pub fn new(
        env: &soroban_sdk::Env,
        query_id: u64,
        name: String,
        description: String,
        created_by: Address,
        filters: String,
        aggregation: AggregationType,
    ) -> Self {
        Self {
            query_id,
            name,
            description,
            created_by,
            created_at: env.ledger().timestamp(),
            filters,
            aggregation,
            last_executed: 0,
            execution_count: 0,
        }
    }

    /// Records query execution
    pub fn execute(&mut self, env: &soroban_sdk::Env) {
        self.last_executed = env.ledger().timestamp();
        self.execution_count += 1;
    }
}

/// Analytics engine for processing metrics
pub struct AnalyticsEngine;

impl AnalyticsEngine {
    /// Calculates average from values
    pub fn calculate_average(values: &[u128]) -> u128 {
        if values.is_empty() {
            return 0;
        }
        let sum: u128 = values.iter().sum();
        sum / values.len() as u128
    }

    /// Finds minimum value
    pub fn find_min(values: &[u128]) -> Option<u128> {
        values.iter().copied().min()
    }

    /// Finds maximum value
    pub fn find_max(values: &[u128]) -> Option<u128> {
        values.iter().copied().max()
    }

    /// Calculates sum
    pub fn calculate_sum(values: &[u128]) -> u128 {
        values.iter().sum()
    }

    /// Counts values
    pub fn count_values(values: &[u128]) -> u64 {
        values.len() as u64
    }

    /// Calculates percentile (simplified: returns value at percentile position)
    pub fn calculate_percentile(values: &[u128], percentile: u32) -> Option<u128> {
        if values.is_empty() || percentile > 100 {
            return None;
        }
        let mut sorted = values.to_vec();
        sorted.sort();
        let index = ((percentile as usize) * sorted.len()) / 100;
        sorted.get(index).copied()
    }
}
