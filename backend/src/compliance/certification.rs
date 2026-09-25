//! Certification validation logic.
//!
//! Handles validation of participant certifications including expiry checks,
//! scope validation, and jurisdiction alignment.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use super::ComplianceError;

/// Participant certification record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Certification {
    /// Unique certification identifier
    pub id: String,
    
    /// Participant identifier
    pub participant_id: String,
    
    /// Certification type (e.g., "waste_management", "hazardous_materials")
    pub certification_type: String,
    
    /// Issuing authority
    pub issuing_authority: String,
    
    /// Issue date
    pub issue_date: DateTime<Utc>,
    
    /// Expiry date
    pub expiry_date: DateTime<Utc>,
    
    /// Jurisdiction(s) where certification is valid
    pub valid_jurisdictions: Vec<String>,
    
    /// Waste types covered by certification
    pub covered_waste_types: Vec<String>,
    
    /// Maximum quantity covered (kg)
    pub max_quantity_kg: Option<f64>,
    
    /// Whether certification is currently active
    pub active: bool,
}

impl Certification {
    /// Check if certification is currently valid.
    pub fn is_valid(&self) -> bool {
        self.active && Utc::now() < self.expiry_date
    }
    
    /// Check if certification covers a specific waste type.
    pub fn covers_waste_type(&self, waste_type: &str) -> bool {
        self.covered_waste_types.contains(&waste_type.to_string()) ||
        self.covered_waste_types.contains(&"all".to_string())
    }
    
    /// Check if certification is valid for a jurisdiction.
    pub fn valid_for_jurisdiction(&self, jurisdiction: &str) -> bool {
        self.valid_jurisdictions.contains(&jurisdiction.to_string()) ||
        self.valid_jurisdictions.contains(&"global".to_string())
    }
    
    /// Check if certification covers a quantity.
    pub fn covers_quantity(&self, quantity_kg: f64) -> bool {
        match self.max_quantity_kg {
            Some(max) => quantity_kg <= max,
            None => true,
        }
    }
    
    /// Validate certification for an operation.
    pub fn validate_for_operation(
        &self,
        waste_type: &str,
        jurisdiction: &str,
        quantity_kg: f64,
    ) -> Result<(), ComplianceError> {
        if !self.is_valid() {
            return Err(ComplianceError::CertificationExpired(format!(
                "Certification {} expired on {}",
                self.id, self.expiry_date
            )));
        }
        
        if !self.covers_waste_type(waste_type) {
            return Err(ComplianceError::WasteTypeNotPermitted(format!(
                "Certification {} does not cover waste type '{}'",
                self.id, waste_type
            )));
        }
        
        if !self.valid_for_jurisdiction(jurisdiction) {
            return Err(ComplianceError::InvalidJurisdiction(format!(
                "Certification {} not valid for jurisdiction '{}'",
                self.id, jurisdiction
            )));
        }
        
        if !self.covers_quantity(quantity_kg) {
            return Err(ComplianceError::InternalError(format!(
                "Certification {} quantity limit exceeded (max {:?} kg, requested {} kg)",
                self.id, self.max_quantity_kg, quantity_kg
            )));
        }
        
        Ok(())
    }
}

/// Certification registry for managing participant certifications.
#[derive(Debug, Clone)]
pub struct CertificationRegistry {
    certifications: Vec<Certification>,
}

impl CertificationRegistry {
    /// Create a new empty certification registry.
    pub fn new() -> Self {
        Self {
            certifications: Vec::new(),
        }
    }
    
    /// Add a certification to the registry.
    pub fn add_certification(&mut self, certification: Certification) {
        self.certifications.push(certification);
    }
    
    /// Get all certifications for a participant.
    pub fn get_participant_certifications(&self, participant_id: &str) -> Vec<&Certification> {
        self.certifications.iter()
            .filter(|c| c.participant_id == participant_id && c.active)
            .collect()
    }
    
    /// Find a valid certification for an operation.
    pub fn find_valid_certification(
        &self,
        participant_id: &str,
        waste_type: &str,
        jurisdiction: &str,
        quantity_kg: f64,
    ) -> Result<&Certification, ComplianceError> {
        let certifications = self.get_participant_certifications(participant_id);
        
        for certification in certifications {
            if certification.covers_waste_type(waste_type) &&
               certification.valid_for_jurisdiction(jurisdiction) &&
               certification.covers_quantity(quantity_kg) &&
               certification.is_valid() {
                return Ok(certification);
            }
        }
        
        Err(ComplianceError::MissingCertification(format!(
            "No valid certification found for participant {}, waste type '{}', jurisdiction '{}'",
            participant_id, waste_type, jurisdiction
        )))
    }
    
    /// Get expiring certifications (within days).
    pub fn get_expiring_certifications(&self, within_days: i64) -> Vec<&Certification> {
        let now = Utc::now();
        self.certifications.iter()
            .filter(|c| {
                c.active && {
                    let days_until_expiry = (c.expiry_date - now).num_days();
                    days_until_expiry >= 0 && days_until_expiry <= within_days
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};
    
    fn create_test_certification() -> Certification {
        Certification {
            id: "cert-123".to_string(),
            participant_id: "participant-123".to_string(),
            certification_type: "waste_management".to_string(),
            issuing_authority: "Environmental Agency".to_string(),
            issue_date: Utc::now() - Duration::days(365),
            expiry_date: Utc::now() + Duration::days(30),
            valid_jurisdictions: vec!["US-CA".to_string(), "US-NY".to_string()],
            covered_waste_types: vec!["plastic".to_string(), "metal".to_string()],
            max_quantity_kg: Some(1000.0),
            active: true,
        }
    }
    
    #[test]
    fn test_certification_validity() {
        let cert = create_test_certification();
        assert!(cert.is_valid());
    }
    
    #[test]
    fn test_certification_expired() {
        let mut cert = create_test_certification();
        cert.expiry_date = Utc::now() - Duration::days(1);
        assert!(!cert.is_valid());
    }
    
    #[test]
    fn test_certification_inactive() {
        let mut cert = create_test_certification();
        cert.active = false;
        assert!(!cert.is_valid());
    }
    
    #[test]
    fn test_certification_covers_waste_type() {
        let cert = create_test_certification();
        assert!(cert.covers_waste_type("plastic"));
        assert!(cert.covers_waste_type("metal"));
        assert!(!cert.covers_waste_type("glass"));
    }
    
    #[test]
    fn test_certification_covers_all_waste_types() {
        let mut cert = create_test_certification();
        cert.covered_waste_types = vec!["all".to_string()];
        assert!(cert.covers_waste_type("plastic"));
        assert!(cert.covers_waste_type("metal"));
        assert!(cert.covers_waste_type("glass"));
    }
    
    #[test]
    fn test_certification_valid_for_jurisdiction() {
        let cert = create_test_certification();
        assert!(cert.valid_for_jurisdiction("US-CA"));
        assert!(cert.valid_for_jurisdiction("US-NY"));
        assert!(!cert.valid_for_jurisdiction("US-TX"));
    }
    
    #[test]
    fn test_certification_global_jurisdiction() {
        let mut cert = create_test_certification();
        cert.valid_jurisdictions = vec!["global".to_string()];
        assert!(cert.valid_for_jurisdiction("US-CA"));
        assert!(cert.valid_for_jurisdiction("US-NY"));
        assert!(cert.valid_for_jurisdiction("US-TX"));
    }
    
    #[test]
    fn test_certification_covers_quantity() {
        let cert = create_test_certification();
        assert!(cert.covers_quantity(500.0));
        assert!(cert.covers_quantity(1000.0));
        assert!(!cert.covers_quantity(1001.0));
    }
    
    #[test]
    fn test_certification_no_quantity_limit() {
        let mut cert = create_test_certification();
        cert.max_quantity_kg = None;
        assert!(cert.covers_quantity(5000.0));
        assert!(cert.covers_quantity(10000.0));
    }
    
    #[test]
    fn test_validate_for_operation_success() {
        let cert = create_test_certification();
        let result = cert.validate_for_operation("plastic", "US-CA", 500.0);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_validate_for_operation_expired() {
        let mut cert = create_test_certification();
        cert.expiry_date = Utc::now() - Duration::days(1);
        let result = cert.validate_for_operation("plastic", "US-CA", 500.0);
        assert!(result.is_err());
        assert!(matches!(result, Err(ComplianceError::CertificationExpired(_))));
    }
    
    #[test]
    fn test_validate_for_operation_wrong_waste_type() {
        let cert = create_test_certification();
        let result = cert.validate_for_operation("glass", "US-CA", 500.0);
        assert!(result.is_err());
        assert!(matches!(result, Err(ComplianceError::WasteTypeNotPermitted(_))));
    }
    
    #[test]
    fn test_validate_for_operation_wrong_jurisdiction() {
        let cert = create_test_certification();
        let result = cert.validate_for_operation("plastic", "US-TX", 500.0);
        assert!(result.is_err());
        assert!(matches!(result, Err(ComplianceError::InvalidJurisdiction(_))));
    }
    
    #[test]
    fn test_certification_registry() {
        let mut registry = CertificationRegistry::new();
        let cert = create_test_certification();
        registry.add_certification(cert);
        
        let certs = registry.get_participant_certifications("participant-123");
        assert_eq!(certs.len(), 1);
        
        let found = registry.find_valid_certification("participant-123", "plastic", "US-CA", 500.0);
        assert!(found.is_ok());
    }
    
    #[test]
    fn test_certification_registry_not_found() {
        let registry = CertificationRegistry::new();
        let result = registry.find_valid_certification("participant-123", "plastic", "US-CA", 500.0);
        assert!(result.is_err());
        assert!(matches!(result, Err(ComplianceError::MissingCertification(_))));
    }
    
    #[test]
    fn test_expiring_certifications() {
        let mut registry = CertificationRegistry::new();
        
        // Add a certification expiring in 5 days
        let mut cert = create_test_certification();
        cert.expiry_date = Utc::now() + Duration::days(5);
        registry.add_certification(cert);
        
        // Add a certification expiring in 20 days
        let mut cert = create_test_certification();
        cert.id = "cert-456".to_string();
        cert.expiry_date = Utc::now() + Duration::days(20);
        registry.add_certification(cert);
        
        let expiring = registry.get_expiring_certifications(10);
        assert_eq!(expiring.len(), 1);
        assert_eq!(expiring[0].id, "cert-123");
    }
}