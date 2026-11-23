# Advanced Search Indexing Documentation

## Overview

This document describes the advanced search indexing system implemented for the Scavenger backend using Elasticsearch. The system provides full-text search, filtering, faceted search, and aggregation capabilities.

## Architecture

### Components

1. **Search Client** (`search/client.rs`)
   - Manages connection to Elasticsearch cluster
   - Handles authentication and configuration
   - Provides health check and cluster info endpoints

2. **Index Management** (`search/index.rs`)
   - Creates and manages search indices
   - Defines field mappings and analyzers
   - Handles index settings (shards, replicas, etc.)

3. **Query Builder** (`search/query_builder.rs`)
   - Fluent API for building Elasticsearch queries
   - Supports match, multi-match, term, range, bool queries
   - Handles sorting, pagination, and highlighting

4. **Filters** (`search/filters.rs`)
   - Provides filter types (term, range, exists, prefix)
   - Supports AND, OR, NOT operators
   - Enables complex search refinement

5. **Faceted Search** (`search/facets.rs`)
   - Implements faceted navigation
   - Supports terms, range, and date histogram aggregations
   - Returns counts for filtering options

6. **Indexing Pipeline** (`search/pipeline.rs`)
   - Bulk indexing operations
   - Handles document updates and deletions
   - Manages indexing errors and retries

## Configuration

### Environment Variables

```bash
# Elasticsearch connection
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic  # Optional
ELASTICSEARCH_PASSWORD=changeme # Optional

# Search settings
SEARCH_MAX_RESULTS=10000
SEARCH_DEFAULT_PAGE_SIZE=20
SEARCH_MAX_PAGE_SIZE=100
```

### Index Configuration

```rust
let config = IndexConfig {
    name: "wastes".to_string(),
    number_of_shards: 3,
    number_of_replicas: 2,
    refresh_interval: "1s".to_string(),
    max_result_window: 10000,
};
```

## API Endpoints

### 1. Search

**Endpoint:** `GET /api/v1/search`

**Query Parameters:**

- `q` (string, required): Search query
- `from` (int, default: 0): Pagination offset
- `size` (int, default: 20): Number of results per page
- `filters` (array): Filter conditions

**Example Request:**

```bash
curl "http://localhost:8080/api/v1/search?q=hazardous+waste&from=0&size=20"
```

**Response:**

```json
{
  "total": 150,
  "hits": [
    {
      "id": "waste-123",
      "score": 2.45,
      "source": {
        "title": "Hazardous Waste Disposal",
        "description": "Industrial hazardous waste...",
        "status": "active"
      },
      "highlights": {
        "title": ["<em>Hazardous</em> <em>Waste</em> Disposal"]
      }
    }
  ],
  "took_ms": 45,
  "facets": {
    "status": [
      { "value": "active", "count": 89 },
      { "value": "archived", "count": 61 }
    ]
  }
}
```

### 2. Autocomplete/Suggestions

**Endpoint:** `GET /api/v1/search/suggest`

**Query Parameters:**

- `q` (string, required): Partial search term

**Example Request:**

```bash
curl "http://localhost:8080/api/v1/search/suggest?q=haz"
```

**Response:**

```json
{
  "suggestions": ["hazardous waste", "hazmat disposal", "hazard classification"]
}
```

### 3. Search Configuration

**Endpoint:** `GET /api/v1/search/config`

**Response:**

```json
{
  "max_results": 10000,
  "default_page_size": 20,
  "max_page_size": 100,
  "available_filters": ["status", "type", "date_range", "participant"],
  "available_facets": ["status", "type", "created_date"],
  "searchable_fields": ["title", "description", "content", "tags"]
}
```

## Usage Examples

### Basic Text Search

```rust
use scavenger_backend::search::SearchQueryBuilder;

let query = SearchQueryBuilder::new()
    .match_query("title", "hazardous waste")
    .from(0)
    .size(20)
    .build();
```

### Multi-Field Search

```rust
let query = SearchQueryBuilder::new()
    .multi_match(
        vec!["title".to_string(), "description".to_string()],
        "search term"
    )
    .from(0)
    .size(20)
    .build();
```

### Advanced Boolean Query

```rust
use scavenger_backend::search::query_builder::QueryType;
use serde_json::json;

let must_queries = vec![
    QueryType::Term {
        field: "status".to_string(),
        value: json!("active"),
    },
];

let should_queries = vec![
    QueryType::Match {
        field: "title".to_string(),
        query: "important".to_string(),
    },
];

let query = SearchQueryBuilder::new()
    .bool_query(must_queries, should_queries, vec![])
    .sort("created_at", "desc")
    .highlight(vec!["title".to_string(), "description".to_string()])
    .build();
```

### Filtering and Faceting

```rust
use scavenger_backend::search::{SearchFilter, Facet, FacetType};

// Create filters
let filters = vec![
    SearchFilter::term("status", json!("active")),
    SearchFilter::range("price", Some(json!(10)), Some(json!(100))),
];

// Define facets
let facets = vec![
    Facet {
        field: "status".to_string(),
        size: 10,
        facet_type: FacetType::Terms,
    },
    Facet {
        field: "created_at".to_string(),
        size: 10,
        facet_type: FacetType::DateHistogram {
            interval: "month".to_string(),
        },
    },
];
```

### Bulk Indexing

```rust
use scavenger_backend::search::IndexingPipeline;
use std::sync::Arc;

let pipeline = IndexingPipeline::new(
    Arc::new(client),
    "wastes".to_string(),
    100,  // batch size
    4,    // max concurrent batches
);

let documents = vec![
    ("waste-1".to_string(), waste_doc_1),
    ("waste-2".to_string(), waste_doc_2),
    // ...
];

let result = pipeline.bulk_index(documents).await?;
println!("Indexed {} documents, {} errors", result.success_count, result.error_count);
```

## Index Mappings

### Waste Documents

```rust
use scavenger_backend::search::{IndexMapping, field_builders};

let mapping = IndexMapping::new()
    .add_field("title".to_string(), field_builders::text_with_keyword())
    .add_field("description".to_string(), field_builders::text_field())
    .add_field("status".to_string(), field_builders::keyword_field())
    .add_field("type".to_string(), field_builders::keyword_field())
    .add_field("quantity".to_string(), field_builders::integer_field())
    .add_field("created_at".to_string(), field_builders::date_field())
    .add_field("verified".to_string(), field_builders::boolean_field());
```

## Performance Considerations

1. **Index Settings**
   - Use appropriate number of shards based on data volume
   - Set replicas for high availability
   - Adjust refresh interval for write-heavy workloads

2. **Query Optimization**
   - Use filters instead of queries when exact matching
   - Limit result window size
   - Use source filtering to return only needed fields

3. **Bulk Operations**
   - Batch indexing operations (recommended: 100-1000 docs)
   - Use async processing for large datasets
   - Handle partial failures gracefully

4. **Caching**
   - Enable query result caching
   - Cache aggregation results when appropriate
   - Use filters for cacheable conditions

## Error Handling

The search system provides comprehensive error handling:

```rust
use scavenger_backend::search::IndexingError;

match pipeline.index_document("doc-1", &document).await {
    Ok(_) => println!("Document indexed successfully"),
    Err(IndexingError::ElasticsearchError(e)) => {
        eprintln!("Elasticsearch error: {}", e);
    }
    Err(IndexingError::SerializationError(e)) => {
        eprintln!("Serialization error: {}", e);
    }
    Err(e) => eprintln!("Unknown error: {}", e),
}
```

## Testing

Run the search tests:

```bash
cd backend
cargo test --test search_tests
```

## Monitoring

Monitor search performance and health:

```rust
// Health check
let healthy = search_client.health_check().await?;

// Cluster info
let info = search_client.cluster_info().await?;

// Index statistics
let stats = search_index.stats().await?;
```

## Future Enhancements

1. **Machine Learning Integration**
   - Relevance tuning with ML models
   - Personalized search results
   - Anomaly detection in search patterns

2. **Advanced Features**
   - Geospatial search
   - Vector similarity search
   - Real-time analytics

3. **Performance**
   - Query result caching layer
   - Pre-computed aggregations
   - Adaptive shard allocation

## References

- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Elasticsearch Rust Client](https://docs.rs/elasticsearch/)
- Backend source: `backend/src/search/`
