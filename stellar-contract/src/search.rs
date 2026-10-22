//! Search utilities for participant and waste lookup.
use soroban_sdk::{contracttype, Env, String, Vec};

#[contracttype]
#[derive(Clone)]
pub struct SearchResult {
    pub id: u64,
    pub entity_type: String,
    pub title: String,
    pub relevance_score: u32,
}

#[contracttype]
pub struct SearchQuery {
    pub term: String,
    pub entity_type: Option<String>,
    pub limit: u32,
}

pub struct SearchService;

impl SearchService {
    pub fn index_entity(env: &Env, entity_type: String, id: u64, content: String) {
        let index_key = soroban_sdk::symbol_short!("idx");
        let mut index: Vec<(String, u64, String)> = env
            .storage()
            .persistent()
            .get(&index_key)
            .unwrap_or(Ok(Vec::new(env)))
            .unwrap_or_else(|_| Vec::new(env));

        index.push_back((entity_type, id, content));

        env.storage().persistent().set(&index_key, &index);
    }

    pub fn search(env: &Env, query: SearchQuery) -> Vec<SearchResult> {
        let index_key = soroban_sdk::symbol_short!("idx");
        let index: Vec<(String, u64, String)> = env
            .storage()
            .persistent()
            .get(&index_key)
            .unwrap_or(Ok(Vec::new(env)))
            .unwrap_or_else(|_| Vec::new(env));

        let mut results = Vec::new(env);
        let mut scored_results: Vec<(SearchResult, u32)> = Vec::new(env);

        for i in 0..index.len() {
            if let Ok((entity_type, id, content)) = index.get(i) {
                if let Some(ref filter_type) = query.entity_type {
                    if entity_type != *filter_type {
                        continue;
                    }
                }

                let score = Self::calculate_relevance(&content, &query.term);
                if score > 0 {
                    let result = SearchResult {
                        id,
                        entity_type: entity_type.clone(),
                        title: content.clone(),
                        relevance_score: score,
                    };
                    scored_results.push_back((result, score));
                }
            }
        }

        // Sort by relevance (simple bubble sort)
        for i in 0..scored_results.len() {
            for j in 0..(scored_results.len() - i - 1) {
                if let (Ok((_, score1)), Ok((_, score2))) =
                    (scored_results.get(j), scored_results.get(j + 1))
                {
                    if score1 < score2 {
                        // Swap
                        if let (Ok(item1), Ok(item2)) =
                            (scored_results.get(j), scored_results.get(j + 1))
                        {
                            scored_results.set(j, item2);
                            scored_results.set(j + 1, item1);
                        }
                    }
                }
            }
        }

        let limit = query.limit.min(scored_results.len() as u32) as usize;
        for i in 0..limit {
            if let Ok((result, _)) = scored_results.get(i as u32) {
                results.push_back(result);
            }
        }

        results
    }

    pub fn autocomplete(env: &Env, prefix: String, limit: u32) -> Vec<String> {
        let index_key = soroban_sdk::symbol_short!("idx");
        let index: Vec<(String, u64, String)> = env
            .storage()
            .persistent()
            .get(&index_key)
            .unwrap_or(Ok(Vec::new(env)))
            .unwrap_or_else(|_| Vec::new(env));

        let mut suggestions = Vec::new(env);
        let mut count = 0;

        for i in 0..index.len() {
            if count >= limit {
                break;
            }
            if let Ok((_, _, content)) = index.get(i) {
                if Self::starts_with(&content, &prefix) {
                    suggestions.push_back(content);
                    count += 1;
                }
            }
        }

        suggestions
    }

    pub fn faceted_search(env: &Env, query: SearchQuery) -> Vec<(String, u32)> {
        let index_key = soroban_sdk::symbol_short!("idx");
        let index: Vec<(String, u64, String)> = env
            .storage()
            .persistent()
            .get(&index_key)
            .unwrap_or(Ok(Vec::new(env)))
            .unwrap_or_else(|_| Vec::new(env));

        let mut facets: Vec<(String, u32)> = Vec::new(env);

        for i in 0..index.len() {
            if let Ok((entity_type, _, content)) = index.get(i) {
                let score = Self::calculate_relevance(&content, &query.term);
                if score > 0 {
                    let mut found = false;
                    for j in 0..facets.len() {
                        if let Ok((ftype, count)) = facets.get(j) {
                            if ftype == entity_type {
                                facets.set(j, (entity_type.clone(), count + 1));
                                found = true;
                                break;
                            }
                        }
                    }
                    if !found {
                        facets.push_back((entity_type, 1));
                    }
                }
            }
        }

        facets
    }

    fn calculate_relevance(content: &String, term: &String) -> u32 {
        let content_bytes = content.as_bytes();
        let term_bytes = term.as_bytes();

        if content_bytes.len() < term_bytes.len() {
            return 0;
        }

        let mut score = 0;
        for i in 0..=(content_bytes.len() - term_bytes.len()) {
            let mut matches = true;
            for j in 0..term_bytes.len() {
                if content_bytes[i + j] != term_bytes[j] {
                    matches = false;
                    break;
                }
            }
            if matches {
                score += 1;
            }
        }

        score.min(100)
    }

    fn starts_with(content: &String, prefix: &String) -> bool {
        let content_bytes = content.as_bytes();
        let prefix_bytes = prefix.as_bytes();

        if content_bytes.len() < prefix_bytes.len() {
            return false;
        }

        for i in 0..prefix_bytes.len() {
            if content_bytes[i] != prefix_bytes[i] {
                return false;
            }
        }

        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_result_creation() {
        let result = SearchResult {
            id: 1,
            entity_type: String::from_slice(&soroban_sdk::Env::default(), "waste"),
            title: String::from_slice(&soroban_sdk::Env::default(), "plastic"),
            relevance_score: 85,
        };
        assert_eq!(result.id, 1);
        assert_eq!(result.relevance_score, 85);
    }

    #[test]
    fn test_search_query_creation() {
        let query = SearchQuery {
            term: String::from_slice(&soroban_sdk::Env::default(), "plastic"),
            entity_type: None,
            limit: 10,
        };
        assert_eq!(query.limit, 10);
    }

    #[test]
    fn test_relevance_calculation() {
        let env = soroban_sdk::Env::default();
        let content = String::from_slice(&env, "plastic waste");
        let term = String::from_slice(&env, "plastic");
        let score = SearchService::calculate_relevance(&content, &term);
        assert!(score > 0);
    }
}
