//! Jurisdiction-specific rules and validation.
//!
//! Handles jurisdiction parsing, validation, and rule application based on
//! ISO 3166-2 jurisdiction codes.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::ComplianceError;

/// ISO 3166-2 jurisdiction code (e.g., "US-CA" for California, USA).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct JurisdictionCode {
    /// ISO 3166-1 alpha-2 country code
    pub country: String,
    
    /// ISO 3166-2 subdivision code
    pub subdivision: String,
}

impl JurisdictionCode {
    /// Parse a jurisdiction code from string.
    pub fn parse(code: &str) -> Result<Self, ComplianceError> {
        let parts: Vec<&str> = code.split('-').collect();
        if parts.len() != 2 {
            return Err(ComplianceError::InvalidJurisdiction(format!(
                "Invalid jurisdiction format: '{}', expected format: 'XX-YY'",
                code
            )));
        }
        
        let country = parts[0].to_uppercase();
        let subdivision = parts[1].to_uppercase();
        
        // Basic validation
        if country.len() != 2 {
            return Err(ComplianceError::InvalidJurisdiction(format!(
                "Invalid country code: '{}', expected 2 letters",
                country
            )));
        }
        
        if subdivision.is_empty() {
            return Err(ComplianceError::InvalidJurisdiction(
                "Subdivision code cannot be empty".to_string(),
            ));
        }
        
        Ok(Self { country, subdivision })
    }
    
    /// Convert back to string representation.
    pub fn to_string(&self) -> String {
        format!("{}-{}", self.country, self.subdivision)
    }
    
    /// Check if this jurisdiction is within another (e.g., state within country).
    pub fn is_within(&self, parent: &JurisdictionCode) -> bool {
        if parent.subdivision == "*" {
            self.country == parent.country
        } else {
            self == parent
        }
    }
}

/// Jurisdiction-specific rules and restrictions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JurisdictionRules {
    /// Jurisdiction code
    pub jurisdiction: JurisdictionCode,
    
    /// Waste types permitted in this jurisdiction
    pub permitted_waste_types: Vec<String>,
    
    /// Waste types prohibited in this jurisdiction
    pub prohibited_waste_types: Vec<String>,
    
    /// Maximum quantity per transaction (kg)
    pub max_quantity_per_transaction_kg: Option<f64>,
    
    /// Maximum daily quantity (kg)
    pub max_daily_quantity_kg: Option<f64>,
    
    /// Required certifications for operations
    pub required_certifications: Vec<String>,
    
    /// Whether special permits are required
    pub special_permit_required: bool,
    
    /// Reporting frequency (e.g., "daily", "weekly", "monthly")
    pub reporting_frequency: String,
    
    /// Contact information for jurisdiction authority
    pub authority_contact: String,
    
    /// Additional jurisdiction-specific requirements
    pub additional_requirements: Vec<String>,
}

impl JurisdictionRules {
    /// Check if a waste type is permitted.
    pub fn is_waste_type_permitted(&self, waste_type: &str) -> bool {
        !self.prohibited_waste_types.contains(&waste_type.to_string()) &&
        (self.permitted_waste_types.contains(&waste_type.to_string()) ||
         self.permitted_waste_types.contains(&"all".to_string()))
    }
    
    /// Check quantity compliance.
    pub fn check_quantity_compliance(&self, quantity_kg: f64) -> Result<(), ComplianceError> {
        if let Some(max_per_transaction) = self.max_quantity_per_transaction_kg {
            if quantity_kg > max_per_transaction {
                return Err(ComplianceError::InternalError(format!(
                    "Quantity {} kg exceeds per-transaction limit of {} kg",
                    quantity_kg, max_per_transaction
                )));
            }
        }
        
        if quantity_kg <= 0.0 {
            return Err(ComplianceError::InternalError(
                "Quantity must be positive".to_string(),
            ));
        }
        
        Ok(())
    }
    
    /// Get all requirements for display.
    pub fn get_all_requirements(&self) -> Vec<String> {
        let mut requirements = Vec::new();
        
        requirements.push(format!(
            "Permitted waste types: {}",
            if self.permitted_waste_types.contains(&"all".to_string()) {
                "all".to_string()
            } else {
                self.permitted_waste_types.join(", ")
            }
        ));
        
        if !self.prohibited_waste_types.is_empty() {
            requirements.push(format!(
                "Prohibited waste types: {}",
                self.prohibited_waste_types.join(", ")
            ));
        }
        
        if let Some(max_qty) = self.max_quantity_per_transaction_kg {
            requirements.push(format!(
                "Maximum per transaction: {} kg",
                max_qty
            ));
        }
        
        if let Some(daily_max) = self.max_daily_quantity_kg {
            requirements.push(format!(
                "Maximum daily quantity: {} kg",
                daily_max
            ));
        }
        
        if !self.required_certifications.is_empty() {
            requirements.push(format!(
                "Required certifications: {}",
                self.required_certifications.join(", ")
            ));
        }
        
        if self.special_permit_required {
            requirements.push("Special permit required".to_string());
        }
        
        requirements.push(format!(
            "Reporting frequency: {}",
            self.reporting_frequency
        ));
        
        requirements.extend(self.additional_requirements.clone());
        
        requirements
    }
}

/// Registry of jurisdiction rules.
#[derive(Debug, Clone)]
pub struct JurisdictionRegistry {
    rules: HashMap<String, JurisdictionRules>,
}

impl JurisdictionRegistry {
    /// Create a new jurisdiction registry with default rules.
    pub fn new() -> Self {
        let mut rules = HashMap::new();
        
        // California rules
        rules.insert("US-CA".to_string(), JurisdictionRules {
            jurisdiction: JurisdictionCode::parse("US-CA").unwrap(),
            permitted_waste_types: vec![
                "plastic".to_string(),
                "metal".to_string(),
                "paper".to_string(),
                "glass".to_string(),
                "cardboard".to_string(),
            ],
            prohibited_waste_types: vec![
                "hazardous".to_string(),
                "medical".to_string(),
                "nuclear".to_string(),
            ],
            max_quantity_per_transaction_kg: Some(1000.0),
            max_daily_quantity_kg: Some(5000.0),
            required_certifications: vec![
                "waste_handling".to_string(),
                "environmental_safety".to_string(),
            ],
            special_permit_required: false,
            reporting_frequency: "weekly".to_string(),
            authority_contact: "California Environmental Protection Agency".to_string(),
            additional_requirements: vec![
                "Proper sorting required".to_string(),
                "Recycling labels mandatory".to_string(),
            ],
        });
        
        // New York rules
        rules.insert("US-NY".to_string(), JurisdictionRules {
            jurisdiction: JurisdictionCode::parse("US-NY").unwrap(),
            permitted_waste_types: vec![
                "plastic".to_string(),
                "metal".to_string(),
                "paper".to_string(),
            ],
            prohibited_waste_types: vec![
                "hazardous".to_string(),
                "electronics".to_string(),
                "construction".to_string(),
            ],
            max_quantity_per_transaction_kg: Some(500.0),
            max_daily_quantity_kg: Some(2000.0),
            required_certifications: vec![
                "waste_management".to_string(),
            ],
            special_permit_required: true,
            reporting_frequency: "daily".to_string(),
            authority_contact: "New York Department of Environmental Conservation".to_string(),
            additional_requirements: vec![
                "Pre-approval required for large quantities".to_string(),
                "Electronic reporting mandatory".to_string(),
            ],
        });
        
        // London rules
        rules.insert("GB-LND".to_string(), JurisdictionRules {
            jurisdiction: JurisdictionCode::parse("GB-LND").unwrap(),
            permitted_waste_types: vec![
                "plastic".to_string(),
                "metal".to_string(),
                "paper".to_string(),
                "glass".to_string(),
            ],
            prohibited_waste_types: vec![
                "hazardous".to_string(),
            ],
            max_quantity_per_transaction_kg: None,
            max_daily_quantity_kg: Some(10000.0),
            required_certifications: vec![
                "uk_waste_carrier".to_string(),
            ],
            special_permit_required: false,
            reporting_frequency: "monthly".to_string(),
            authority_contact: "Environment Agency (UK)".to_string(),
            additional_requirements: vec![
                "Waste transfer notes required".to_string(),
                "Duty of care documentation".to_string(),
            ],
        });
        
        Self { rules }
    }
    
    /// Get rules for a jurisdiction code.
    pub fn get_rules(&self, jurisdiction_code: &str) -> Option<&JurisdictionRules> {
        self.rules.get(jurisdiction_code)
    }
    
    /// Check if a jurisdiction has specific rules defined.
    pub fn has_rules(&self, jurisdiction_code: &str) -> bool {
        self.rules.contains_key(jurisdiction_code)
    }
    
    /// Validate a jurisdiction code and get its rules.
    pub fn validate_jurisdiction(
        &self,
        jurisdiction_code: &str,
    ) -> Result<&JurisdictionRules, ComplianceError> {
        let code = JurisdictionCode::parse(jurisdiction_code)?;
        
        // Check if we have rules for this exact jurisdiction
        if let Some(rules) = self.get_rules(&code.to_string()) {
            return Ok(rules);
        }
        
        // Check if we have country-level rules (using wildcard)
        let country_code = format!("{}-*", code.country);
        if let Some(rules) = self.get_rules(&country_code) {
            return Ok(rules);
        }
        
        Err(ComplianceError::InvalidJurisdiction(format!(
            "No rules defined for jurisdiction: {}",
            jurisdiction_code
        )))
    }
    
    /// Get all jurisdiction codes in the registry.
    pub fn get_all_jurisdiction_codes(&self) -> Vec<String> {
        self.rules.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_jurisdiction_code_parsing() {
        let code = JurisdictionCode::parse("US-CA").unwrap();
        assert_eq!(code.country, "US");
        assert_eq!(code.subdivision, "CA");
        assert_eq!(code.to_string(), "US-CA");
    }
    
    #[test]
    fn test_jurisdiction_code_case_insensitive() {
        let code = JurisdictionCode::parse("us-ca").unwrap();
        assert_eq!(code.country, "US");
        assert_eq!(code.subdivision, "CA");
    }
    
    #[test]
    fn test_jurisdiction_code_invalid_format() {
        let result = JurisdictionCode::parse("USCA");
        assert!(result.is_err());
        
        let result = JurisdictionCode::parse("US-CA-NY");
        assert!(result.is_err());
        
        let result = JurisdictionCode::parse("USA-CA");
        assert!(result.is_err());
    }
    
    #[test]
    fn test_jurisdiction_is_within() {
        let california = JurisdictionCode::parse("US-CA").unwrap();
        let usa = JurisdictionCode::parse("US-*").unwrap();
        let new_york = JurisdictionCode::parse("US-NY").unwrap();
        
        assert!(california.is_within(&usa));
        assert!(!california.is_within(&new_york));
        assert!(new_york.is_within(&usa));
    }
    
    #[test]
    fn test_jurisdiction_rules_waste_type_permitted() {
        let rules = JurisdictionRules {
            jurisdiction: JurisdictionCode::parse("US-CA").unwrap(),
            permitted_waste_types: vec!["plastic".to_string(), "metal".to_string()],
            prohibited_waste_types: vec!["hazardous".to_string()],
            max_quantity_per_transaction_kg: Some(1000.0),
            max_daily_quantity_kg: Some(5000.0),
            required_certifications: vec![],
            special_permit_required: false,
            reporting_frequency: "weekly".to_string(),
            authority_contact: "Test".to_string(),
            additional_requirements: vec![],
        };
        
        assert!(rules.is_waste_type_permitted("plastic"));
        assert!(rules.is_waste_type_permitted("metal"));
        assert!(!rules.is_waste_type_permitted("hazardous"));
        assert!(!rules.is_waste_type_permitted("glass"));
    }
    
    #[test]
    fn test_jurisdiction_rules_all_permitted() {
        let rules = JurisdictionRules {
            jurisdiction: JurisdictionCode::parse("US-CA").unwrap(),
            permitted_waste_types: vec!["all".to_string()],
            prohibited_waste_types: vec!["hazardous".to_string()],
            max_quantity_per_transaction_kg: Some(1000.0),
            max_daily_quantity_kg: Some(5000.0),
            required_certifications: vec![],
            special_permit_required: false,
            reporting_frequency: "weekly".to_string(),
            authority_contact: "Test".to_string(),
            additional_requirements: vec![],
        };
        
        assert!(rules.is_waste_type_permitted("plastic"));
        assert!(rules.is_waste_type_permitted("metal"));
        assert!(!rules.is_waste_type_permitted("hazardous"));
        assert!(rules.is_waste_type_permitted("glass"));
    }
    
    #[test]
    fn test_jurisdiction_rules_quantity_compliance() {
        let rules = JurisdictionRules {
            jurisdiction: JurisdictionCode::parse("US-CA").unwrap(),
            permitted_waste_types: vec!["plastic".to_string()],
            prohibited_waste_types: vec![],
            max_quantity_per_transaction_kg: Some(1000.0),
            max_daily_quantity_kg: Some(5000.0),
            required_certifications: vec![],
            special_permit_required: false,
            reporting_frequency: "weekly".to_string(),
            authority_contact: "Test".to_string(),
            additional_requirements: vec![],
        };
        
        assert!(rules.check_quantity_compliance(500.0).is_ok());
        assert!(rules.check_quantity_compliance(1000.0).is_ok());
        
        let result = rules.check_quantity_compliance(1001.0);
        assert!(result.is_err());
        assert!(matches!(result, Err(ComplianceError::InternalError(_))));
        
        let result = rules.check_quantity_compliance(-10.0);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_jurisdiction_registry_creation() {
        let registry = JurisdictionRegistry::new();
        assert!(registry.has_rules("US-CA"));
        assert!(registry.has_rules("US-NY"));
        assert!(registry.has_rules("GB-LND"));
        assert!(!registry.has_rules("US-TX"));
    }
    
    #[test]
    fn test_jurisdiction_registry_validation() {
        let registry = JurisdictionRegistry::new();
        
        let result = registry.validate_jurisdiction("US-CA");
        assert!(result.is_ok());
        
        let result = registry.validate_jurisdiction("US-TX");
        assert!(result.is_err());
        assert!(matches!(result, Err(ComplianceError::InvalidJurisdiction(_))));
    }
    
    #[test]
    fn test_jurisdiction_registry_get_all_codes() {
        let registry = JurisdictionRegistry::new();
        let codes = registry.get_all_jurisdiction_codes();
        assert!(codes.contains(&"US-CA".to_string()));
        assert!(codes.contains(&"US-NY".to_string()));
        assert!(codes.contains(&"GB-LND".to_string()));
    }
    
    #[test]
    fn test_get_all_requirements() {
        let rules = JurisdictionRules {
            jurisdiction: JurisdictionCode::parse("US-CA").unwrap(),
            permitted_waste_types: vec!["plastic".to_string(), "metal".to_string()],
            prohibited_waste_types: vec!["hazardous".to_string()],
            max_quantity_per_transaction_kg: Some(1000.0),
            max_daily_quantity_kg: Some(5000.0),
            required_certifications: vec!["cert1".to_string(), "cert2".to_string()],
            special_permit_required: true,
            reporting_frequency: "weekly".to_string(),
            authority_contact: "Test Agency".to_string(),
            additional_requirements: vec!["Requirement 1".to_string(), "Requirement 2".to_string()],
        };
        
        let requirements = rules.get_all_requirements();
        assert!(!requirements.is_empty());
        assert!(requirements.iter().any(|r| r.contains("Permitted waste types")));
        assert!(requirements.iter().any(|r| r.contains("Prohibited waste types")));
        assert!(requirements.iter().any(|r| r.contains("Maximum per transaction")));
        assert!(requirements.iter().any(|r| r.contains("Special permit required")));
        assert!(requirements.iter().any(|r| r.contains("Reporting frequency")));
    }
}