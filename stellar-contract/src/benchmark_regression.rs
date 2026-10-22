//! Benchmark Regression Detection - Issue #937
//!
//! Establishes baseline performance metrics and provides regression detection
//! to track performance degradation over time. This module enables continuous
//! monitoring of contract performance against established thresholds.

use soroban_sdk::Env;

/// Performance metric type
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum MetricType {
    /// Gas consumption for an operation
    Gas,
    /// Storage read operations
    StorageReads,
    /// Storage write operations
    StorageWrites,
    /// Execution latency in milliseconds
    Latency,
}

/// Benchmark result for a single operation
#[derive(Clone, Copy, Debug)]
pub struct BenchmarkResult {
    /// Name of the benchmark
    pub name: &'static str,
    /// Metric type being measured
    pub metric_type: MetricType,
    /// Measured value
    pub measured: u64,
    /// Baseline value for comparison
    pub baseline: u64,
    /// Threshold for regression (percentage above baseline)
    pub threshold_percentage: u32,
}

impl BenchmarkResult {
    /// Calculates the percentage change from baseline
    pub fn percentage_change(&self) -> i64 {
        if self.baseline == 0 {
            0
        } else {
            let diff = self.measured as i64 - self.baseline as i64;
            (diff * 100) / self.baseline as i64
        }
    }

    /// Checks if this result is a regression
    pub fn is_regression(&self) -> bool {
        self.percentage_change() > self.threshold_percentage as i64
    }

    /// Checks if this result is an improvement
    pub fn is_improvement(&self) -> bool {
        self.percentage_change() < 0
    }
}

/// Baseline performance metrics
#[derive(Clone, Copy, Debug)]
pub struct PerformanceBaseline {
    /// Register participant operation
    pub register_participant_gas: u64,
    /// Submit waste operation
    pub submit_waste_gas: u64,
    /// Transfer waste operation
    pub transfer_waste_gas: u64,
    /// Query participant info operation
    pub query_participant_gas: u64,
    /// Batch participant update (10 items)
    pub batch_update_10_gas: u64,
    /// Batch waste transfer (20 items)
    pub batch_transfer_20_gas: u64,
}

impl Default for PerformanceBaseline {
    fn default() -> Self {
        Self {
            // Baseline values established from initial benchmarking
            // These represent the expected gas costs for standard operations
            register_participant_gas: 2_500,
            submit_waste_gas: 3_000,
            transfer_waste_gas: 4_500,
            query_participant_gas: 1_500,
            batch_update_10_gas: 15_000, // ~1,500 per item with consolidation
            batch_transfer_20_gas: 35_000, // ~1,750 per item with consolidation
        }
    }
}

/// Comprehensive benchmark suite
pub struct BenchmarkSuite {
    /// Collection of benchmark results
    results: Vec<(u32, BenchmarkResult)>,
}

impl BenchmarkSuite {
    /// Creates a new benchmark suite
    pub fn new() -> Self {
        Self {
            results: Vec::new(),
        }
    }

    /// Adds a benchmark result to the suite
    pub fn add_result(&mut self, result: BenchmarkResult) {
        let id = self.results.len() as u32;
        self.results.push((id, result));
    }

    /// Gets all results
    pub fn results(&self) -> &Vec<(u32, BenchmarkResult)> {
        &self.results
    }

    /// Counts regression results
    pub fn regression_count(&self) -> u32 {
        self.results
            .iter()
            .filter(|(_, r)| r.is_regression())
            .count() as u32
    }

    /// Counts improvement results
    pub fn improvement_count(&self) -> u32 {
        self.results
            .iter()
            .filter(|(_, r)| r.is_improvement())
            .count() as u32
    }

    /// Calculates average performance change percentage
    pub fn average_change_percentage(&self) -> i64 {
        if self.results.is_empty() {
            return 0;
        }

        let sum: i64 = self.results.iter().map(|(_, r)| r.percentage_change()).sum();
        sum / self.results.len() as i64
    }

    /// Generates a regression report
    pub fn generate_report(&self) -> RegressionReport {
        let regressions: Vec<BenchmarkResult> = self
            .results
            .iter()
            .filter(|(_, r)| r.is_regression())
            .map(|(_, r)| *r)
            .collect();

        let improvements: Vec<BenchmarkResult> = self
            .results
            .iter()
            .filter(|(_, r)| r.is_improvement())
            .map(|(_, r)| *r)
            .collect();

        RegressionReport {
            total_benchmarks: self.results.len() as u32,
            regressions,
            improvements,
            average_change: self.average_change_percentage(),
        }
    }
}

/// Regression report summarizing benchmark results
#[derive(Clone)]
pub struct RegressionReport {
    /// Total number of benchmarks run
    pub total_benchmarks: u32,
    /// List of operations that regressed
    pub regressions: Vec<BenchmarkResult>,
    /// List of operations that improved
    pub improvements: Vec<BenchmarkResult>,
    /// Average percentage change
    pub average_change: i64,
}

impl RegressionReport {
    /// Checks if there are any regressions
    pub fn has_regressions(&self) -> bool {
        !self.regressions.is_empty()
    }

    /// Gets the worst regression
    pub fn worst_regression(&self) -> Option<BenchmarkResult> {
        self.regressions
            .iter()
            .max_by_key(|r| r.percentage_change())
            .copied()
    }

    /// Gets the best improvement
    pub fn best_improvement(&self) -> Option<BenchmarkResult> {
        self.improvements
            .iter()
            .min_by_key(|r| r.percentage_change())
            .copied()
    }

    /// Formats the report as a string
    pub fn format_summary(&self) -> String {
        format!(
            "Benchmark Report:\n  Total: {}\n  Regressions: {}\n  Improvements: {}\n  Average Change: {}%",
            self.total_benchmarks,
            self.regressions.len(),
            self.improvements.len(),
            self.average_change
        )
    }
}

/// Performance threshold definitions
pub struct PerformanceThresholds {
    /// Maximum allowed gas for register_participant (percentage above baseline)
    pub register_participant_threshold: u32,
    /// Maximum allowed gas for submit_waste (percentage above baseline)
    pub submit_waste_threshold: u32,
    /// Maximum allowed gas for transfer_waste (percentage above baseline)
    pub transfer_waste_threshold: u32,
    /// Maximum allowed gas for queries (percentage above baseline)
    pub query_threshold: u32,
    /// Default threshold for other operations
    pub default_threshold: u32,
}

impl Default for PerformanceThresholds {
    fn default() -> Self {
        Self {
            register_participant_threshold: 10, // Allow 10% increase
            submit_waste_threshold: 10,
            transfer_waste_threshold: 15, // Allow 15% increase for more complex ops
            query_threshold: 5, // Queries should be tight
            default_threshold: 10,
        }
    }
}

/// Regression detector
pub struct RegressionDetector {
    /// Baseline metrics
    baseline: PerformanceBaseline,
    /// Performance thresholds
    thresholds: PerformanceThresholds,
}

impl RegressionDetector {
    /// Creates a new regression detector with default baseline and thresholds
    pub fn new() -> Self {
        Self {
            baseline: PerformanceBaseline::default(),
            thresholds: PerformanceThresholds::default(),
        }
    }

    /// Creates a regression detector with custom baseline
    pub fn with_baseline(baseline: PerformanceBaseline) -> Self {
        Self {
            baseline,
            thresholds: PerformanceThresholds::default(),
        }
    }

    /// Checks register_participant operation for regression
    pub fn check_register_participant(&self, measured_gas: u64) -> BenchmarkResult {
        BenchmarkResult {
            name: "register_participant",
            metric_type: MetricType::Gas,
            measured: measured_gas,
            baseline: self.baseline.register_participant_gas,
            threshold_percentage: self.thresholds.register_participant_threshold,
        }
    }

    /// Checks submit_waste operation for regression
    pub fn check_submit_waste(&self, measured_gas: u64) -> BenchmarkResult {
        BenchmarkResult {
            name: "submit_waste",
            metric_type: MetricType::Gas,
            measured: measured_gas,
            baseline: self.baseline.submit_waste_gas,
            threshold_percentage: self.thresholds.submit_waste_threshold,
        }
    }

    /// Checks transfer_waste operation for regression
    pub fn check_transfer_waste(&self, measured_gas: u64) -> BenchmarkResult {
        BenchmarkResult {
            name: "transfer_waste",
            metric_type: MetricType::Gas,
            measured: measured_gas,
            baseline: self.baseline.transfer_waste_gas,
            threshold_percentage: self.thresholds.transfer_waste_threshold,
        }
    }

    /// Checks query operation for regression
    pub fn check_query_participant(&self, measured_gas: u64) -> BenchmarkResult {
        BenchmarkResult {
            name: "query_participant",
            metric_type: MetricType::Gas,
            measured: measured_gas,
            baseline: self.baseline.query_participant_gas,
            threshold_percentage: self.thresholds.query_threshold,
        }
    }

    /// Checks batch update operation for regression
    pub fn check_batch_update(&self, item_count: u32, measured_gas: u64) -> BenchmarkResult {
        let name = if item_count == 10 {
            "batch_update_10"
        } else {
            "batch_update"
        };

        BenchmarkResult {
            name,
            metric_type: MetricType::Gas,
            measured: measured_gas,
            baseline: self.baseline.batch_update_10_gas,
            threshold_percentage: self.thresholds.default_threshold,
        }
    }

    /// Checks batch transfer operation for regression
    pub fn check_batch_transfer(&self, item_count: u32, measured_gas: u64) -> BenchmarkResult {
        let name = if item_count == 20 {
            "batch_transfer_20"
        } else {
            "batch_transfer"
        };

        BenchmarkResult {
            name,
            metric_type: MetricType::Gas,
            measured: measured_gas,
            baseline: self.baseline.batch_transfer_20_gas,
            threshold_percentage: self.thresholds.default_threshold,
        }
    }

    /// Runs a complete benchmark suite and returns regression report
    pub fn analyze_suite(&self, suite: &BenchmarkSuite) -> RegressionReport {
        suite.generate_report()
    }

    /// Asserts that no benchmark exceeds its regression threshold.
    ///
    /// # Panics
    /// Panics with a detailed message if any benchmark result exceeds
    /// its configured threshold, listing all regressions found.
    pub fn assert_no_regression(&self, suite: &BenchmarkSuite) {
        let report = suite.generate_report();
        if report.has_regressions() {
            let mut msg = format!("Regression detected!\n{}", report.format_summary());
            for r in &report.regressions {
                msg.push_str(&format!(
                    "\n  REGRESSION: {} measured={} baseline={} change={}% threshold={}%",
                    r.name, r.measured, r.baseline, r.percentage_change(), r.threshold_percentage
                ));
            }
            panic!("{}", msg);
        }
    }

    /// Returns an error message if any benchmark exceeds its threshold.
    ///
    /// Returns `Ok(())` if all benchmarks are within thresholds,
    /// or `Err(String)` with details about any regressions found.
    pub fn check_regression_enforcement(&self, suite: &BenchmarkSuite) -> Result<(), String> {
        let report = suite.generate_report();
        if report.has_regressions() {
            let mut details = String::new();
            details.push_str(&format!("Benchmark regression detected!\n"));
            details.push_str(&format!("Total benchmarks: {}\n", report.total_benchmarks));
            details.push_str(&format!("Regressions: {}\n", report.regressions.len()));
            for r in &report.regressions {
                details.push_str(&format!(
                    "  - {}: measured={} baseline={} change={}% exceeds threshold={}%\n",
                    r.name, r.measured, r.baseline, r.percentage_change(), r.threshold_percentage
                ));
            }
            Err(details)
        } else {
            Ok(())
        }
    }

    /// Checks a single benchmark result and returns whether it's within thresholds.
    ///
    /// Returns `Ok(())` if within threshold, `Err(String)` with details if not.
    pub fn check_within_threshold(&self, result: &BenchmarkResult) -> Result<(), String> {
        if result.is_regression() {
            Err(format!(
                "Benchmark '{}' regressed: measured={} baseline={} change={}% exceeds threshold={}%",
                result.name, result.measured, result.baseline, result.percentage_change(), result.threshold_percentage
            ))
        } else {
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_benchmark_result_percentage_change() {
        let result = BenchmarkResult {
            name: "test",
            metric_type: MetricType::Gas,
            measured: 1100,
            baseline: 1000,
            threshold_percentage: 10,
        };

        assert_eq!(result.percentage_change(), 10);
    }

    #[test]
    fn test_benchmark_result_is_regression() {
        let result = BenchmarkResult {
            name: "test",
            metric_type: MetricType::Gas,
            measured: 1150, // 15% above baseline
            baseline: 1000,
            threshold_percentage: 10,
        };

        assert!(result.is_regression());
    }

    #[test]
    fn test_benchmark_result_is_improvement() {
        let result = BenchmarkResult {
            name: "test",
            metric_type: MetricType::Gas,
            measured: 900, // 10% below baseline
            baseline: 1000,
            threshold_percentage: 10,
        };

        assert!(result.is_improvement());
    }

    #[test]
    fn test_performance_baseline_defaults() {
        let baseline = PerformanceBaseline::default();
        assert_eq!(baseline.register_participant_gas, 2_500);
        assert_eq!(baseline.submit_waste_gas, 3_000);
    }

    #[test]
    fn test_performance_thresholds_defaults() {
        let thresholds = PerformanceThresholds::default();
        assert_eq!(thresholds.register_participant_threshold, 10);
        assert_eq!(thresholds.query_threshold, 5);
    }

    #[test]
    fn test_regression_detector_creation() {
        let detector = RegressionDetector::new();
        let result = detector.check_register_participant(2_500);
        assert_eq!(result.percentage_change(), 0);
    }

    #[test]
    fn test_benchmark_suite_creation() {
        let suite = BenchmarkSuite::new();
        assert_eq!(suite.results().len(), 0);
    }

    // ── Regression Enforcement Tests ───────────────────────────────

    #[test]
    fn test_assert_no_regression_passes_when_no_regression() {
        let detector = RegressionDetector::new();
        let mut suite = BenchmarkSuite::new();
        suite.add_result(BenchmarkResult {
            name: "normal",
            metric_type: MetricType::Gas,
            measured: 1050,
            baseline: 1000,
            threshold_percentage: 10,
        });
        detector.assert_no_regression(&suite);
    }

    #[test]
    #[should_panic(expected = "Regression detected")]
    fn test_assert_no_regression_panics_on_regression() {
        let detector = RegressionDetector::new();
        let mut suite = BenchmarkSuite::new();
        suite.add_result(BenchmarkResult {
            name: "regressed",
            metric_type: MetricType::Gas,
            measured: 1150,
            baseline: 1000,
            threshold_percentage: 10,
        });
        detector.assert_no_regression(&suite);
    }

    #[test]
    fn test_check_regression_enforcement_ok() {
        let detector = RegressionDetector::new();
        let mut suite = BenchmarkSuite::new();
        suite.add_result(BenchmarkResult {
            name: "normal",
            metric_type: MetricType::Gas,
            measured: 1050,
            baseline: 1000,
            threshold_percentage: 10,
        });
        assert!(detector.check_regression_enforcement(&suite).is_ok());
    }

    #[test]
    fn test_check_regression_enforcement_err() {
        let detector = RegressionDetector::new();
        let mut suite = BenchmarkSuite::new();
        suite.add_result(BenchmarkResult {
            name: "regressed",
            metric_type: MetricType::Gas,
            measured: 1150,
            baseline: 1000,
            threshold_percentage: 10,
        });
        let result = detector.check_regression_enforcement(&suite);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Regression detected"));
    }

    #[test]
    fn test_check_within_threshold_passes() {
        let detector = RegressionDetector::new();
        let result = BenchmarkResult {
            name: "normal",
            metric_type: MetricType::Gas,
            measured: 1050,
            baseline: 1000,
            threshold_percentage: 10,
        };
        assert!(detector.check_within_threshold(&result).is_ok());
    }

    #[test]
    fn test_check_within_threshold_fails() {
        let detector = RegressionDetector::new();
        let result = BenchmarkResult {
            name: "regressed",
            metric_type: MetricType::Gas,
            measured: 1150,
            baseline: 1000,
            threshold_percentage: 10,
        };
        assert!(detector.check_within_threshold(&result).is_err());
    }
}
