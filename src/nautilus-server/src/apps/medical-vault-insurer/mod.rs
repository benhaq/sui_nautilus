// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

pub mod types;
pub mod endpoints;
pub mod fhir;

pub use types::*;
pub use endpoints::{complete_seal_key_load, init_seal_key_load, provision_openrouter_api_key, create_ptb, spawn_host_init_server};
pub use fhir::{compute_semantic_hash, extract_resource_types, FhirBuildRequest, FhirLlmService, PatientContext};

use crate::app::endpoints::OPENROUTER_API_KEY;
use crate::AppState;
use crate::EnclaveError;
use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::info;

/// Request to convert raw medical data to FHIR R5 bundle
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FhirConversionRequest {
    /// Raw medical data to convert
    pub raw_data: String,
    /// Source format: "text", "json", "synthea"
    pub source_format: String,
    /// Optional patient context
    pub patient_context: Option<PatientContext>,
    /// Whether to include PHI (true) or use Safe Harbor de-identification (false)
    pub include_phi: bool,
}

/// Response for FHIR conversion
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FhirConversionResponse {
    pub bundle: serde_json::Value,
    pub semantic_hash: String,
    pub resources_created: Vec<String>,
    pub created_at: u64,
}

/// Error response
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FhirErrorResponse {
    pub error: String,
    pub message: String,
}

/// Process raw medical data to FHIR R5 bundle - returns raw JSON response
pub async fn process_data(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<FhirConversionRequest>,
) -> Result<Json<FhirConversionResponse>, EnclaveError> {
    // API key loaded from what was set during bootstrap.
    // let api_key_guard = OPENROUTER_API_KEY.read().await;
    // let api_key = api_key_guard.as_ref().ok_or_else(|| {
    //     EnclaveError::GenericError(
    //         "OpenRouter API key not initialized. Please complete key load first.".to_string(),
    //     )
    // })?;

    let current_timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| EnclaveError::GenericError(format!("Failed to get current timestamp: {e}")))?
        .as_millis() as u64;

    info!("Processing FHIR conversion request");

    // Create LLM service with the provisioned API key
    let llm_service = FhirLlmService::new(
        fhir::OpenRouterConfig::new("sk-or-v1-...".to_string(), "openai/gpt-5.2".to_string())
    );

    // Build FHIR request
    let fhir_request = FhirBuildRequest {
        raw_data: request.raw_data.clone(),
        source_format: request.source_format.clone(),
        patient_context: request.patient_context.clone(),
        include_phi: request.include_phi,
    };

    // Call LLM to convert to FHIR
    let start_time = std::time::Instant::now();
    let bundle = llm_service.convert_to_fhir(&fhir_request).await?;
    let _processing_time = start_time.elapsed().as_millis() as u64;

    // Compute semantic hash
    let semantic_hash = compute_semantic_hash(&bundle)
        .map_err(|e| EnclaveError::GenericError(format!("Failed to compute semantic hash: {e}")))?;

    // Extract resource types created
    let resources_created = extract_resource_types(&bundle);

    info!("FHIR conversion complete: {} resources created", resources_created.len());

    Ok(Json(FhirConversionResponse {
        bundle,
        semantic_hash,
        resources_created,
        created_at: current_timestamp,
    }))
}

#[cfg(test)]
mod test {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_semantic_hash() {
        let bundle = json!({
            "resourceType": "Bundle",
            "type": "collection",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Patient",
                        "id": "patient-001"
                    }
                }
            ]
        });

        let hash = compute_semantic_hash(&bundle).expect("Should compute hash");
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 64); // SHA3-256 produces 64 hex characters
    }

    #[test]
    fn test_extract_resource_types() {
        let bundle = json!({
            "bundle": {
                "resourceType": "Bundle",
                "type": "collection",
                "entry": [
                    { "resource": { "resourceType": "Patient" } },
                    { "resource": { "resourceType": "Observation" } },
                    { "resource": { "resourceType": "Condition" } },
                    { "resource": { "resourceType": "Observation" } }
                ]
            }
        });

        let types = extract_resource_types(&bundle);
        assert_eq!(types.len(), 3);
        assert!(types.contains(&"Patient".to_string()));
        assert!(types.contains(&"Observation".to_string()));
        assert!(types.contains(&"Condition".to_string()));
    }
}
