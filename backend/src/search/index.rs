use elasticsearch::{
    Elasticsearch,
    indices::{IndicesCreateParts, IndicesDeleteParts, IndicesExistsParts, IndicesPutMappingParts},
    http::request::JsonBody,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use anyhow::{Result, Context, anyhow};
use std::collections::HashMap;

/// Configuration for a search index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexConfig {
    pub name: String,
    pub number_of_shards: u32,
    pub number_of_replicas: u32,
    pub refresh_interval: String,
    pub max_result_window: u32,
}

impl Default for IndexConfig {
    fn default() -> Self {
        Self {
            name: "default".to_string(),
            number_of_shards: 1,
            number_of_replicas: 1,
            refresh_interval: "1s".to_string(),
            max_result_window: 10000,
        }
    }
}

/// Field types for index mapping
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    Text,
    Keyword,
    Long,
    Integer,
    Short,
    Byte,
    Double,
    Float,
    Date,
    Boolean,
    Binary,
    Object,
    Nested,
    #[serde(rename = "geo_point")]
    GeoPoint,
}

/// Field mapping configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMapping {
    #[serde(rename = "type")]
    pub field_type: FieldType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub analyzer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub store: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fields: Option<HashMap<String, FieldMapping>>,
}

/// Index mapping definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexMapping {
    pub properties: HashMap<String, FieldMapping>,
}

impl IndexMapping {
    pub fn new() -> Self {
        Self {
            properties: HashMap::new(),
        }
    }

    pub fn add_field(mut self, name: String, mapping: FieldMapping) -> Self {
        self.properties.insert(name, mapping);
        self
    }
}

/// Search index manager
pub struct SearchIndex<'a> {
    client: &'a Elasticsearch,
    config: IndexConfig,
}

impl<'a> SearchIndex<'a> {
    pub fn new(client: &'a Elasticsearch, config: IndexConfig) -> Self {
        Self { client, config }
    }

    /// Check if index exists
    pub async fn exists(&self) -> Result<bool> {
        let response = self.client
            .indices()
            .exists(IndicesExistsParts::Index(&[&self.config.name]))
            .send()
            .await
            .context("Failed to check index existence")?;

        Ok(response.status_code().is_success())
    }

    /// Create index with settings and optional mapping
    pub async fn create(&self, mapping: Option<IndexMapping>) -> Result<()> {
        let mut body = json!({
            "settings": {
                "number_of_shards": self.config.number_of_shards,
                "number_of_replicas": self.config.number_of_replicas,
                "refresh_interval": self.config.refresh_interval,
                "max_result_window": self.config.max_result_window,
                "analysis": {
                    "analyzer": {
                        "default": {
                            "type": "standard"
                        },
                        "autocomplete": {
                            "tokenizer": "autocomplete_tokenizer",
                            "filter": ["lowercase"]
                        }
                    },
                    "tokenizer": {
                        "autocomplete_tokenizer": {
                            "type": "edge_ngram",
                            "min_gram": 2,
                            "max_gram": 10,
                            "token_chars": ["letter", "digit"]
                        }
                    }
                }
            }
        });

        if let Some(m) = mapping {
            body["mappings"] = json!(m);
        }

        let response = self.client
            .indices()
            .create(IndicesCreateParts::Index(&self.config.name))
            .body(body)
            .send()
            .await
            .context("Failed to create index")?;

        if !response.status_code().is_success() {
            let error_body = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow!("Failed to create index: {}", error_body));
        }

        Ok(())
    }

    /// Update index mapping
    pub async fn update_mapping(&self, mapping: IndexMapping) -> Result<()> {
        let response = self.client
            .indices()
            .put_mapping(IndicesPutMappingParts::Index(&[&self.config.name]))
            .body(json!(mapping))
            .send()
            .await
            .context("Failed to update mapping")?;

        if !response.status_code().is_success() {
            let error_body = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow!("Failed to update mapping: {}", error_body));
        }

        Ok(())
    }

    /// Delete the index
    pub async fn delete(&self) -> Result<()> {
        let response = self.client
            .indices()
            .delete(IndicesDeleteParts::Index(&[&self.config.name]))
            .send()
            .await
            .context("Failed to delete index")?;

        if !response.status_code().is_success() {
            let error_body = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow!("Failed to delete index: {}", error_body));
        }

        Ok(())
    }

    /// Get index statistics
    pub async fn stats(&self) -> Result<Value> {
        let response = self.client
            .indices()
            .stats(elasticsearch::indices::IndicesStatsParts::Index(&[&self.config.name]))
            .send()
            .await
            .context("Failed to get index stats")?;

        let body = response.json::<Value>().await
            .context("Failed to parse index stats")?;

        Ok(body)
    }
}

/// Helper to create common field mappings
pub mod field_builders {
    use super::*;

    pub fn text_field() -> FieldMapping {
        FieldMapping {
            field_type: FieldType::Text,
            analyzer: Some("standard".to_string()),
            index: Some(true),
            store: None,
            fields: None,
        }
    }

    pub fn keyword_field() -> FieldMapping {
        FieldMapping {
            field_type: FieldType::Keyword,
            analyzer: None,
            index: Some(true),
            store: None,
            fields: None,
        }
    }

    pub fn text_with_keyword() -> FieldMapping {
        let mut fields = HashMap::new();
        fields.insert("keyword".to_string(), keyword_field());

        FieldMapping {
            field_type: FieldType::Text,
            analyzer: Some("standard".to_string()),
            index: Some(true),
            store: None,
            fields: Some(fields),
        }
    }

    pub fn date_field() -> FieldMapping {
        FieldMapping {
            field_type: FieldType::Date,
            analyzer: None,
            index: Some(true),
            store: None,
            fields: None,
        }
    }

    pub fn integer_field() -> FieldMapping {
        FieldMapping {
            field_type: FieldType::Integer,
            analyzer: None,
            index: Some(true),
            store: None,
            fields: None,
        }
    }

    pub fn boolean_field() -> FieldMapping {
        FieldMapping {
            field_type: FieldType::Boolean,
            analyzer: None,
            index: Some(true),
            store: None,
            fields: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = IndexConfig::default();
        assert_eq!(config.name, "default");
        assert_eq!(config.number_of_shards, 1);
        assert_eq!(config.number_of_replicas, 1);
    }

    #[test]
    fn test_mapping_builder() {
        let mapping = IndexMapping::new()
            .add_field("title".to_string(), field_builders::text_field())
            .add_field("status".to_string(), field_builders::keyword_field())
            .add_field("created_at".to_string(), field_builders::date_field());

        assert_eq!(mapping.properties.len(), 3);
        assert!(mapping.properties.contains_key("title"));
    }
}
