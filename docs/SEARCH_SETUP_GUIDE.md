# Search Infrastructure Setup Guide

## Prerequisites

- Docker and Docker Compose installed
- Rust toolchain (1.70+)
- At least 2GB of available RAM for Elasticsearch

## Quick Start

### 1. Start Elasticsearch with Docker Compose

```bash
# From the project root
docker-compose -f docker-compose.elasticsearch.yml up -d
```

This will start:

- Elasticsearch on port 9200
- Kibana (optional UI) on port 5601

### 2. Verify Elasticsearch is Running

```bash
curl http://localhost:9200
```

Expected response:

```json
{
  "name" : "scavenger-node-1",
  "cluster_name" : "scavenger-cluster",
  "version" : { ... }
}
```

### 3. Configure Backend

Create or update your `.env` file:

```bash
# Elasticsearch configuration
ELASTICSEARCH_URL=http://localhost:9200
# Optional authentication
# ELASTICSEARCH_USERNAME=elastic
# ELASTICSEARCH_PASSWORD=changeme
```

### 4. Build and Run Backend

```bash
cd backend
cargo build --release
cargo run
```

### 5. Test Search Endpoints

```bash
# Health check
curl http://localhost:8080/health

# Search configuration
curl http://localhost:8080/api/v1/search/config

# Perform a search
curl "http://localhost:8080/api/v1/search?q=waste&from=0&size=20"

# Get suggestions
curl "http://localhost:8080/api/v1/search/suggest?q=haz"
```

## Manual Installation (Without Docker)

### Install Elasticsearch

#### Linux (Debian/Ubuntu)

```bash
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt-get update && sudo apt-get install elasticsearch
sudo systemctl start elasticsearch
sudo systemctl enable elasticsearch
```

#### macOS (Homebrew)

```bash
brew tap elastic/tap
brew install elastic/tap/elasticsearch-full
brew services start elastic/tap/elasticsearch-full
```

#### Windows

1. Download from https://www.elastic.co/downloads/elasticsearch
2. Extract the ZIP file
3. Run `bin\elasticsearch.bat`

## Index Creation

Create indices for different document types:

```rust
use scavenger_backend::search::{SearchClient, SearchIndex, IndexConfig, IndexMapping, field_builders};

// Connect to Elasticsearch
let config = SearchClientConfig {
    url: "http://localhost:9200".to_string(),
    username: None,
    password: None,
    timeout_seconds: 30,
    validate_certificates: true,
};
let client = SearchClient::new(config)?;

// Create wastes index
let wastes_config = IndexConfig {
    name: "wastes".to_string(),
    number_of_shards: 3,
    number_of_replicas: 1,
    refresh_interval: "1s".to_string(),
    max_result_window: 10000,
};

let mapping = IndexMapping::new()
    .add_field("title".to_string(), field_builders::text_with_keyword())
    .add_field("description".to_string(), field_builders::text_field())
    .add_field("status".to_string(), field_builders::keyword_field())
    .add_field("type".to_string(), field_builders::keyword_field())
    .add_field("quantity".to_string(), field_builders::integer_field())
    .add_field("created_at".to_string(), field_builders::date_field());

let index = SearchIndex::new(client.client(), wastes_config);
index.create(Some(mapping)).await?;
```

## Data Indexing

### Single Document

```rust
pipeline.index_document("waste-123", &waste_document).await?;
```

### Bulk Indexing

```rust
let documents = vec![
    ("waste-1".to_string(), doc1),
    ("waste-2".to_string(), doc2),
    // ...
];

let result = pipeline.bulk_index(documents).await?;
println!("Success: {}, Errors: {}", result.success_count, result.error_count);
```

## Monitoring

### Using Kibana

1. Access Kibana at http://localhost:5601
2. Navigate to "Stack Monitoring"
3. View cluster health, index stats, and queries

### Using Elasticsearch APIs

```bash
# Cluster health
curl http://localhost:9200/_cluster/health?pretty

# Index stats
curl http://localhost:9200/wastes/_stats?pretty

# Node info
curl http://localhost:9200/_nodes/stats?pretty
```

## Troubleshooting

### Elasticsearch Won't Start

- Check if port 9200 is already in use
- Verify sufficient memory (minimum 512MB heap)
- Check logs: `docker-compose logs elasticsearch`

### Connection Refused

- Ensure Elasticsearch is running
- Verify network connectivity
- Check firewall settings

### Out of Memory

```yaml
# In docker-compose.elasticsearch.yml
environment:
  - 'ES_JAVA_OPTS=-Xms1g -Xmx1g' # Increase heap size
```

### Slow Queries

- Check index stats for hot spots
- Review query patterns
- Consider adding more shards
- Optimize mappings

## Production Considerations

1. **Security**
   - Enable authentication
   - Use TLS/SSL
   - Configure firewall rules

2. **Performance**
   - Use multiple nodes for high availability
   - Adjust shard count based on data volume
   - Monitor resource usage

3. **Backup**
   - Configure snapshot repository
   - Schedule regular backups
   - Test restore procedures

4. **Monitoring**
   - Set up alerts for cluster health
   - Monitor disk usage
   - Track query performance

## Testing

Run the test suite:

```bash
cd backend
cargo test --test search_tests
```

## References

- [Elasticsearch Guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- Project documentation: `docs/SEARCH_DOCUMENTATION.md`
