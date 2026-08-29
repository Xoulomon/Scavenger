pub mod client;
pub mod facets;
pub mod filters;
pub mod index;
pub mod pipeline;
pub mod query_builder;
pub mod request;
pub mod response;

pub use client::{SearchClient, SearchClientConfig};
pub use facets::{Facet, FacetResult, FacetedSearch};
pub use filters::{FilterType, SearchFilter};
pub use index::{IndexConfig, IndexMapping, SearchIndex};
pub use pipeline::{IndexingError, IndexingPipeline};
pub use query_builder::{SearchQuery, SearchQueryBuilder};
pub use request::{build_search_query, parse_filter};
pub use response::{format_search_response, SearchResponse};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Common search result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult<T> {
    pub total: u64,
    pub hits: Vec<SearchHit<T>>,
    pub facets: Option<HashMap<String, Vec<FacetResult>>>,
    pub took_ms: u64,
}

/// Individual search hit with score and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit<T> {
    pub id: String,
    pub score: f64,
    pub source: T,
    pub highlights: Option<HashMap<String, Vec<String>>>,
}

/// Search request parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub filters: Vec<SearchFilter>,
    pub facets: Vec<String>,
    pub from: usize,
    pub size: usize,
    pub sort: Option<Vec<SortField>>,
}

/// Sort field configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortField {
    pub field: String,
    pub order: SortOrder,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    Desc,
}

impl Default for SearchRequest {
    fn default() -> Self {
        Self {
            query: String::new(),
            filters: Vec::new(),
            facets: Vec::new(),
            from: 0,
            size: 20,
            sort: None,
        }
    }
}
