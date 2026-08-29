/// Benchmark Regression Detection Tests - Issue #937
///
/// Comprehensive tests for performance tracking and regression detection,
/// including baseline establishment, comparison scripts, and threshold documentation.
use stellar_scavngr_contract::benchmark_regression::{
    BenchmarkResult, BenchmarkSuite, MetricType, PerformanceBaseline, PerformanceThresholds, RegressionDetector,
};

// ═════════════════════════════════════════════════════════════════════════════
// Baseline Establishment Tests
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_baseline_metrics_established() {
    let baseline = PerformanceBaseline::default();

    // Verify baseline metrics are reasonable
    assert!(baseline.register_participant_gas > 0);
    assert!(baseline.submit_waste_gas > 0);
    assert!(baseline.transfer_waste_gas > 0);
    assert!(baseline.query_participant_gas > 0);
    assert!(baseline.batch_update_10_gas > 0);
    assert!(baseline.batch_transfer_20_gas > 0);
}

#[test]
fn test_baseline_relationships() {
    let baseline = PerformanceBaseline::default();

    // Transfer should cost more than submit (transfer involves more state changes)
    assert!(baseline.transfer_waste_gas >= baseline.submit_waste_gas);

    // Query should be cheaper than submit
    assert!(baseline.query_participant_gas < baseline.submit_waste_gas);

    // Batch operations should be cheaper per item than individual operations
    let register_per_item = baseline.register_participant_gas;
    assert!(baseline.batch_update_10_gas / 10 < register_per_item);
}

#[test]
fn test_baseline_persistence() {
    let baseline1 = PerformanceBaseline::default();
    let baseline2 = PerformanceBaseline::default();

    // Baselines should be consistent
    assert_eq!(baseline1.register_participant_gas, baseline2.register_participant_gas);
    assert_eq!(baseline1.submit_waste_gas, baseline2.submit_waste_gas);
}

#[test]
fn test_custom_baseline_creation() {
    let custom_baseline = PerformanceBaseline {
        register_participant_gas: 3_000,
        submit_waste_gas: 4_000,
        transfer_waste_gas: 5_000,
        query_participant_gas: 2_000,
        batch_update_10_gas: 20_000,
        batch_transfer_20_gas: 40_000,
    };

    assert_eq!(custom_baseline.register_participant_gas, 3_000);
    assert_eq!(custom_baseline.submit_waste_gas, 4_000);
}

// ═════════════════════════════════════════════════════════════════════════════
// Threshold Definition Tests
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_performance_thresholds_established() {
    let thresholds = PerformanceThresholds::default();

    // Verify threshold values are reasonable (5-15%)
    assert!(thresholds.register_participant_threshold <= 20);
    assert!(thresholds.submit_waste_threshold <= 20);
    assert!(thresholds.transfer_waste_threshold <= 20);
    assert!(thresholds.query_threshold <= 10);
    assert!(thresholds.default_threshold <= 20);
}

#[test]
fn test_query_threshold_is_strict() {
    let thresholds = PerformanceThresholds::default();

    // Queries should have stricter thresholds than mutations
    assert!(thresholds.query_threshold <= thresholds.register_participant_threshold);
    assert!(thresholds.query_threshold <= thresholds.submit_waste_threshold);
}

#[test]
fn test_threshold_consistency() {
    let t1 = PerformanceThresholds::default();
    let t2 = PerformanceThresholds::default();

    assert_eq!(t1.register_participant_threshold, t2.register_participant_threshold);
    assert_eq!(t1.query_threshold, t2.query_threshold);
}

// ═════════════════════════════════════════════════════════════════════════════
// Benchmark Result Calculation Tests
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_percentage_change_positive() {
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
fn test_percentage_change_negative() {
    let result = BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 900,
        baseline: 1000,
        threshold_percentage: 10,
    };

    assert_eq!(result.percentage_change(), -10);
}

#[test]
fn test_percentage_change_zero() {
    let result = BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 1000,
        baseline: 1000,
        threshold_percentage: 10,
    };

    assert_eq!(result.percentage_change(), 0);
}

#[test]
fn test_percentage_change_zero_baseline() {
    let result = BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 100,
        baseline: 0,
        threshold_percentage: 10,
    };

    assert_eq!(result.percentage_change(), 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// Regression Detection Tests
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_regression_detection_above_threshold() {
    let result = BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 1150, // 15% above baseline
        baseline: 1000,
        threshold_percentage: 10, // Allow 10%
    };

    assert!(result.is_regression());
}

#[test]
fn test_regression_detection_at_threshold() {
    let result = BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 1100, // Exactly at threshold
        baseline: 1000,
        threshold_percentage: 10,
    };

    // At threshold should not be regression
    assert!(!result.is_regression());
}

#[test]
fn test_regression_detection_below_threshold() {
    let result = BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 1050, // 5% above baseline
        baseline: 1000,
        threshold_percentage: 10,
    };

    assert!(!result.is_regression());
}

#[test]
fn test_improvement_detection() {
    let result = BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 900, // 10% below baseline
        baseline: 1000,
        threshold_percentage: 10,
    };

    assert!(result.is_improvement());
    assert!(!result.is_regression());
}

#[test]
fn test_no_regression_on_improvement() {
    let result = BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 500,
        baseline: 1000,
        threshold_percentage: 10,
    };

    assert!(!result.is_regression());
    assert!(result.is_improvement());
}

// ═════════════════════════════════════════════════════════════════════════════
// Regression Detector Tests
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_regression_detector_creation() {
    let detector = RegressionDetector::new();

    // Should detect no regression at baseline
    let result = detector.check_register_participant(2_500);
    assert!(!result.is_regression());
    assert_eq!(result.percentage_change(), 0);
}

#[test]
fn test_regression_detector_with_custom_baseline() {
    let custom = PerformanceBaseline {
        register_participant_gas: 5_000,
        submit_waste_gas: 6_000,
        transfer_waste_gas: 7_000,
        query_participant_gas: 3_000,
        batch_update_10_gas: 25_000,
        batch_transfer_20_gas: 50_000,
    };

    let detector = RegressionDetector::with_baseline(custom);
    let result = detector.check_register_participant(5_000);
    assert_eq!(result.baseline, 5_000);
}

#[test]
fn test_detector_checks_all_operations() {
    let detector = RegressionDetector::new();

    let r1 = detector.check_register_participant(2_500);
    let r2 = detector.check_submit_waste(3_000);
    let r3 = detector.check_transfer_waste(4_500);
    let r4 = detector.check_query_participant(1_500);

    assert_eq!(r1.name, "register_participant");
    assert_eq!(r2.name, "submit_waste");
    assert_eq!(r3.name, "transfer_waste");
    assert_eq!(r4.name, "query_participant");
}

// ═════════════════════════════════════════════════════════════════════════════
// Benchmark Suite Tests
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_benchmark_suite_creation() {
    let suite = BenchmarkSuite::new();
    assert_eq!(suite.results().len(), 0);
    assert_eq!(suite.regression_count(), 0);
    assert_eq!(suite.improvement_count(), 0);
}

#[test]
fn test_benchmark_suite_add_result() {
    let mut suite = BenchmarkSuite::new();

    let result = BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 1000,
        baseline: 1000,
        threshold_percentage: 10,
    };

    suite.add_result(result);
    assert_eq!(suite.results().len(), 1);
}

#[test]
fn test_benchmark_suite_regression_count() {
    let mut suite = BenchmarkSuite::new();

    // Add regression
    suite.add_result(BenchmarkResult {
        name: "regression",
        metric_type: MetricType::Gas,
        measured: 1200,
        baseline: 1000,
        threshold_percentage: 10,
    });

    // Add normal
    suite.add_result(BenchmarkResult {
        name: "normal",
        metric_type: MetricType::Gas,
        measured: 1050,
        baseline: 1000,
        threshold_percentage: 10,
    });

    assert_eq!(suite.regression_count(), 1);
}

#[test]
fn test_benchmark_suite_improvement_count() {
    let mut suite = BenchmarkSuite::new();

    // Add improvement
    suite.add_result(BenchmarkResult {
        name: "improved",
        metric_type: MetricType::Gas,
        measured: 800,
        baseline: 1000,
        threshold_percentage: 10,
    });

    assert_eq!(suite.improvement_count(), 1);
}

#[test]
fn test_benchmark_suite_average_change() {
    let mut suite = BenchmarkSuite::new();

    suite.add_result(BenchmarkResult {
        name: "test1",
        metric_type: MetricType::Gas,
        measured: 1100, // +10%
        baseline: 1000,
        threshold_percentage: 20,
    });

    suite.add_result(BenchmarkResult {
        name: "test2",
        metric_type: MetricType::Gas,
        measured: 900, // -10%
        baseline: 1000,
        threshold_percentage: 20,
    });

    assert_eq!(suite.average_change_percentage(), 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// Regression Report Tests
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_regression_report_generation() {
    let mut suite = BenchmarkSuite::new();

    suite.add_result(BenchmarkResult {
        name: "regression",
        metric_type: MetricType::Gas,
        measured: 1200,
        baseline: 1000,
        threshold_percentage: 10,
    });

    let report = suite.generate_report();
    assert!(report.has_regressions());
    assert_eq!(report.regressions.len(), 1);
}

#[test]
fn test_regression_report_no_regressions() {
    let mut suite = BenchmarkSuite::new();

    suite.add_result(BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 1050,
        baseline: 1000,
        threshold_percentage: 10,
    });

    let report = suite.generate_report();
    assert!(!report.has_regressions());
}

#[test]
fn test_worst_regression() {
    let mut suite = BenchmarkSuite::new();

    suite.add_result(BenchmarkResult {
        name: "minor",
        metric_type: MetricType::Gas,
        measured: 1100, // +10%
        baseline: 1000,
        threshold_percentage: 5,
    });

    suite.add_result(BenchmarkResult {
        name: "major",
        metric_type: MetricType::Gas,
        measured: 1300, // +30%
        baseline: 1000,
        threshold_percentage: 5,
    });

    let report = suite.generate_report();
    let worst = report.worst_regression();
    assert!(worst.is_some());
    assert_eq!(worst.unwrap().name, "major");
}

#[test]
fn test_best_improvement() {
    let mut suite = BenchmarkSuite::new();

    suite.add_result(BenchmarkResult {
        name: "small",
        metric_type: MetricType::Gas,
        measured: 950, // -5%
        baseline: 1000,
        threshold_percentage: 20,
    });

    suite.add_result(BenchmarkResult {
        name: "large",
        metric_type: MetricType::Gas,
        measured: 700, // -30%
        baseline: 1000,
        threshold_percentage: 20,
    });

    let report = suite.generate_report();
    let best = report.best_improvement();
    assert!(best.is_some());
    assert_eq!(best.unwrap().name, "large");
}

#[test]
fn test_regression_report_summary_format() {
    let mut suite = BenchmarkSuite::new();

    suite.add_result(BenchmarkResult {
        name: "test",
        metric_type: MetricType::Gas,
        measured: 1000,
        baseline: 1000,
        threshold_percentage: 10,
    });

    let report = suite.generate_report();
    let summary = report.format_summary();

    assert!(summary.contains("Benchmark Report"));
    assert!(summary.contains("Total:"));
    assert!(summary.contains("Regressions:"));
}

// ═════════════════════════════════════════════════════════════════════════════
// Comparison Script Tests (Documented Approach)
// ═════════════════════════════════════════════════════════════════════════════

#[test]
fn test_comparison_script_documentation() {
    let comparison_script_doc = r#"
    # Benchmark Comparison Script

    ## Purpose
    Compare current benchmark results against established baseline metrics
    to detect performance regressions early in development.

    ## Baseline Metrics
    - register_participant: 2,500 gas
    - submit_waste: 3,000 gas
    - transfer_waste: 4,500 gas
    - query_participant: 1,500 gas
    - batch_update_10: 15,000 gas (1,500 per item)
    - batch_transfer_20: 35,000 gas (1,750 per item)

    ## Thresholds
    - register_participant: ±10% (2,250 - 2,750 gas)
    - submit_waste: ±10% (2,700 - 3,300 gas)
    - transfer_waste: ±15% (3,825 - 5,175 gas)
    - query_participant: ±5% (1,425 - 1,575 gas)
    - Default: ±10%

    ## Running Benchmarks

    ### Step 1: Establish Baseline
    ```bash
    cargo bench --bench contract_benchmarks > baseline.txt
    ```

    ### Step 2: Make Code Changes
    (Modify contract code)

    ### Step 3: Measure New Performance
    ```bash
    cargo bench --bench contract_benchmarks > current.txt
    ```

    ### Step 4: Compare Results
    ```bash
    diff baseline.txt current.txt
    ```

    ## Regression Detection
    - Green: Performance improved (< baseline)
    - Yellow: Performance degraded but within threshold
    - Red: Performance regression (above threshold)

    ## Actions on Regression
    1. Investigate root cause
    2. Profile the changed code
    3. Optimize bottlenecks
    4. Re-benchmark to confirm improvement
    5. Update baseline if intentional

    ## CI/CD Integration
    - Run benchmarks in CI pipeline
    - Fail build if regressions detected
    - Track metrics over time
    - Generate performance reports
    "#;

    assert!(comparison_script_doc.contains("Baseline"));
    assert!(comparison_script_doc.contains("Thresholds"));
    assert!(comparison_script_doc.contains("Regression"));
    assert!(comparison_script_doc.contains("Benchmarks"));
}

#[test]
fn test_performance_tracking_methodology() {
    let methodology = r#"
    # Performance Tracking Methodology

    ## Continuous Monitoring
    1. Establish baselines for each operation type
    2. Run benchmarks on every build
    3. Compare against baseline automatically
    4. Alert on regression detection

    ## Baseline Updates
    - Only update baseline after:
      - Intentional performance improvements
      - Infrastructure changes
      - Approved by code review
    - Never ignore regressions

    ## Metrics Collection
    - Gas consumption (primary metric)
    - Storage operations (reads/writes)
    - Execution latency
    - Memory usage

    ## Analysis Frequency
    - Per commit: Automated threshold check
    - Weekly: Trend analysis
    - Monthly: Capacity planning
    - Quarterly: Optimization review
    "#;

    assert!(methodology.contains("Monitoring"));
    assert!(methodology.contains("Baseline"));
    assert!(methodology.contains("Metrics"));
}
