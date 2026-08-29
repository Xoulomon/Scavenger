// Query Optimization Engine
// Implements query analysis, optimization rules, plan caching, and cost estimation
//
// ## Resource-cost audit (issue #1098)
//
// This module has no call sites in `lib.rs` (verified via repo-wide search),
// so it currently has no effect on the deployed contract's resource costs —
// see the equivalent note in `storage_optimizer.rs` for the full context and
// the documented per-operation budget. `QueryPlan`/`QueryOptimizer` values
// here are in-memory only (no ledger storage I/O of their own); the
// optimization they model is about which *other* storage calls a caller
// should make (cache vs. index vs. full scan), not storage they perform
// themselves.
//
// Fixed here: `QueryPlan::new` used to construct a throwaway
// `Env::default()` purely to obtain an empty `Vec` for `execution_order`,
// which spins up an entire host environment for no reason on every call.
// It now takes the caller's existing `&Env` instead.

use soroban_sdk::{Env, Vec, Map, Symbol, symbol_short};

/// Query type for optimization
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum QueryType {
    GetParticipant,
    GetWaste,
    GetWastesByStatus,
    GetWastesByType,
    GetWastesByGrade,
    GetParticipantWastes,
    GetTransferHistory,
    GetIncentives,
    GetLeaderboard,
}

/// Query plan with optimization strategy
#[derive(Clone)]
pub struct QueryPlan {
    query_type: QueryType,
    use_cache: bool,
    use_index: bool,
    estimated_cost: u32,
    execution_order: Vec<Symbol>,
}

impl QueryPlan {
    pub fn new(env: &Env, query_type: QueryType) -> Self {
        Self {
            query_type,
            use_cache: false,
            use_index: false,
            estimated_cost: 0,
            execution_order: Vec::new(env),
        }
    }

    pub fn with_cache(mut self) -> Self {
        self.use_cache = true;
        self.estimated_cost = self.estimated_cost.saturating_sub(10);
        self
    }

    pub fn with_index(mut self) -> Self {
        self.use_index = true;
        self.estimated_cost = self.estimated_cost.saturating_sub(20);
        self
    }

    pub fn estimated_cost(&self) -> u32 {
        self.estimated_cost
    }
}

/// Query optimizer with rule-based optimization
pub struct QueryOptimizer {
    plan_cache: Map<QueryType, QueryPlan>,
}

impl QueryOptimizer {
    pub fn new(env: &Env) -> Self {
        Self {
            plan_cache: Map::new(env),
        }
    }

    /// Analyze and optimize a query
    pub fn optimize(&mut self, query_type: QueryType, env: &Env) -> QueryPlan {
        // Check plan cache first
        if let Some(cached_plan) = self.plan_cache.get(query_type.clone()) {
            return cached_plan;
        }

        // Build optimization plan based on query type
        let mut plan = QueryPlan::new(env, query_type.clone());
        
        match query_type {
            QueryType::GetParticipant => {
                plan.estimated_cost = 10;
                plan = plan.with_cache(); // Participants are frequently accessed
                plan.execution_order.push_back(symbol_short!("cache"));
                plan.execution_order.push_back(symbol_short!("storage"));
            }
            QueryType::GetWaste => {
                plan.estimated_cost = 10;
                plan = plan.with_cache();
                plan.execution_order.push_back(symbol_short!("cache"));
                plan.execution_order.push_back(symbol_short!("storage"));
            }
            QueryType::GetWastesByStatus => {
                plan.estimated_cost = 50;
                plan = plan.with_index(); // Use index for status lookups
                plan.execution_order.push_back(symbol_short!("index"));
                plan.execution_order.push_back(symbol_short!("filter"));
            }
            QueryType::GetWastesByType => {
                plan.estimated_cost = 50;
                plan = plan.with_index();
                plan.execution_order.push_back(symbol_short!("index"));
                plan.execution_order.push_back(symbol_short!("filter"));
            }
            QueryType::GetWastesByGrade => {
                plan.estimated_cost = 50;
                plan = plan.with_index();
                plan.execution_order.push_back(symbol_short!("index"));
                plan.execution_order.push_back(symbol_short!("filter"));
            }
            QueryType::GetParticipantWastes => {
                plan.estimated_cost = 30;
                plan = plan.with_index(); // Use participant waste index
                plan.execution_order.push_back(symbol_short!("index"));
            }
            QueryType::GetTransferHistory => {
                plan.estimated_cost = 20;
                plan = plan.with_cache(); // Cache recent transfer histories
                plan.execution_order.push_back(symbol_short!("cache"));
                plan.execution_order.push_back(symbol_short!("storage"));
            }
            QueryType::GetIncentives => {
                plan.estimated_cost = 30;
                plan = plan.with_cache(); // Incentives are frequently queried
                plan.execution_order.push_back(symbol_short!("cache"));
                plan.execution_order.push_back(symbol_short!("filter"));
            }
            QueryType::GetLeaderboard => {
                plan.estimated_cost = 100;
                plan = plan.with_cache(); // Leaderboards are expensive, cache aggressively
                plan.execution_order.push_back(symbol_short!("cache"));
                plan.execution_order.push_back(symbol_short!("scan"));
                plan.execution_order.push_back(symbol_short!("sort"));
            }
        }

        // Cache the optimized plan
        self.plan_cache.set(query_type, plan.clone());
        plan
    }

    /// Get optimization statistics
    pub fn get_stats(&self) -> QueryOptimizerStats {
        QueryOptimizerStats {
            cached_plans: self.plan_cache.len(),
            total_queries_optimized: self.plan_cache.len(),
        }
    }
}

/// Query optimizer statistics
pub struct QueryOptimizerStats {
    pub cached_plans: u32,
    pub total_queries_optimized: u32,
}

/// Query execution metrics
pub struct QueryMetrics {
    pub query_type: QueryType,
    pub execution_time_ms: u64,
    pub cache_hits: u32,
    pub cache_misses: u32,
    pub storage_reads: u32,
}

impl QueryMetrics {
    pub fn new(query_type: QueryType) -> Self {
        Self {
            query_type,
            execution_time_ms: 0,
            cache_hits: 0,
            cache_misses: 0,
            storage_reads: 0,
        }
    }

    pub fn record_cache_hit(&mut self) {
        self.cache_hits += 1;
    }

    pub fn record_cache_miss(&mut self) {
        self.cache_misses += 1;
    }

    pub fn record_storage_read(&mut self) {
        self.storage_reads += 1;
    }

    pub fn cache_hit_rate(&self) -> f64 {
        if self.cache_hits + self.cache_misses == 0 {
            return 0.0;
        }
        (self.cache_hits as f64) / ((self.cache_hits + self.cache_misses) as f64)
    }
}

/// Cost estimation model for query planning
pub fn estimate_query_cost(query_type: &QueryType, result_size: u32) -> u32 {
    let base_cost = match query_type {
        QueryType::GetParticipant => 10,
        QueryType::GetWaste => 10,
        QueryType::GetWastesByStatus => 50,
        QueryType::GetWastesByType => 50,
        QueryType::GetWastesByGrade => 50,
        QueryType::GetParticipantWastes => 30,
        QueryType::GetTransferHistory => 20,
        QueryType::GetIncentives => 30,
        QueryType::GetLeaderboard => 100,
    };

    // Add cost for result size
    base_cost + (result_size / 10)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_plan_with_cache() {
        let env = Env::default();
        let plan = QueryPlan::new(&env, QueryType::GetParticipant).with_cache();
        assert!(plan.use_cache);
    }

    #[test]
    fn test_query_optimizer() {
        let env = Env::default();
        let mut optimizer = QueryOptimizer::new(&env);
        
        let plan = optimizer.optimize(QueryType::GetParticipant, &env);
        assert!(plan.use_cache);
        assert!(plan.estimated_cost() < 10);
    }

    #[test]
    fn test_query_metrics() {
        let mut metrics = QueryMetrics::new(QueryType::GetWaste);
        metrics.record_cache_hit();
        metrics.record_cache_hit();
        metrics.record_cache_miss();
        
        assert_eq!(metrics.cache_hits, 2);
        assert_eq!(metrics.cache_misses, 1);
        assert_eq!(metrics.cache_hit_rate(), 2.0 / 3.0);
    }

    #[test]
    fn test_cost_estimation() {
        let cost = estimate_query_cost(&QueryType::GetLeaderboard, 100);
        assert_eq!(cost, 110); // 100 base + 10 for size
    }
}
