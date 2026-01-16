// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

pub mod types;
pub mod endpoints;

pub use types::*;
pub use endpoints::{complete_seal_key_load, init_seal_key_load, spawn_host_init_server, provision_openrouter_api_key};
pub use endpoints::create_ptb;

use crate::app::endpoints::OPENROUTER_API_KEY;
use crate::common::IntentMessage;
use crate::common::{to_signed_response, ProcessDataRequest, ProcessedDataResponse};
use crate::AppState;
use crate::EnclaveError;
use axum::extract::State;
use axum::Json;
use fastcrypto::traits::KeyPair;
use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};
use std::sync::Arc;

/// Intent scope enum for medical vault insurer application.
/// Each intent message signed by the enclave ephemeral key should have its own intent scope.
#[derive(Serialize_repr, Deserialize_repr, Debug)]
#[repr(u8)]
pub enum IntentScope {
    /// Intent for creating a timeline entry
    CreateTimelineEntry = 103,
    /// Intent for wallet public key registration (Seal)
    WalletPK = 1,
}

/// Timeline entry types (HIPAA Safe Harbor compliant)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum EntryType {
    VisitSummary = 0,
    Procedure = 1,
    Refill = 2,
    Note = 3,
    Diagnosis = 4,
    LabResult = 5,
    Immunization = 6,
}

/// Timeline scopes (HIPAA Safe Harbor compliant)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum TimelineScope {
    Treatment = 0,
    Payment = 1,
    Operations = 2,
    Research = 3,
    Legal = 4,
}

/// Request to create a timeline entry
#[derive(Debug, Serialize, Deserialize)]
pub struct TimelineEntryRequest {
    pub patient_ref: String,
    pub entry_type: u8,
    pub scope: u8,
    pub visit_date: String,
    pub provider_specialty: String,
    pub visit_type: String,
    pub status: String,
    pub content_hash: String,
    pub walrus_blob_id: String,
}

/// Response for timeline entry creation
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineEntryResponse {
    pub patient_ref: String,
    pub entry_type: String,
    pub scope: String,
    pub visit_date: String,
    pub provider_specialty: String,
    pub status: String,
    pub content_hash: String,
    pub created_at: u64,
    pub validator: String,
}

/// Process timeline entry creation request
pub async fn process_data(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ProcessDataRequest<TimelineEntryRequest>>,
) -> Result<Json<ProcessedDataResponse<IntentMessage<TimelineEntryResponse>>>, EnclaveError> {
    // API key loaded from what was set during bootstrap.
    let api_key_guard = OPENROUTER_API_KEY.read().await;
    let _api_key = api_key_guard.as_ref().ok_or_else(|| {
        EnclaveError::GenericError(
            "OpenRouter API key not initialized. Please complete key load first.".to_string(),
        )
    })?;

    let current_timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| EnclaveError::GenericError(format!("Failed to get current timestamp: {e}")))?
        .as_millis() as u64;

    // Convert entry_type to string name
    let entry_type_name = match request.payload.entry_type {
        0 => "visit_summary",
        1 => "procedure",
        2 => "refill",
        3 => "note",
        4 => "diagnosis",
        5 => "lab_result",
        6 => "immunization",
        _ => "unknown",
    }.to_string();

    // Convert scope to string name
    let scope_name = match request.payload.scope {
        0 => "treatment",
        1 => "payment",
        2 => "operations",
        3 => "research",
        4 => "legal",
        _ => "unknown",
    }.to_string();

    Ok(Json(to_signed_response(
        &state.eph_kp,
        TimelineEntryResponse {
            patient_ref: request.payload.patient_ref,
            entry_type: entry_type_name,
            scope: scope_name,
            visit_date: request.payload.visit_date,
            provider_specialty: request.payload.provider_specialty,
            status: request.payload.status,
            content_hash: request.payload.content_hash,
            created_at: current_timestamp,
            validator: format!("{:?}", state.eph_kp.public().0.as_bytes()),
        },
        current_timestamp,
        IntentScope::CreateTimelineEntry as u8,
    )))
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::common::IntentMessage;

    #[test]
    fn test_serde() {
        use bcs;
        let payload = TimelineEntryResponse {
            patient_ref: "patient-ref-123".to_string(),
            entry_type: "visit_summary".to_string(),
            scope: "treatment".to_string(),
            visit_date: "2024-03-15".to_string(),
            provider_specialty: "cardiology".to_string(),
            status: "completed".to_string(),
            content_hash: "abc123def456".to_string(),
            created_at: 1744038900000,
            validator: "0x123".to_string(),
        };
        let timestamp = 1744038900000;
        let intent_msg = IntentMessage::new(payload, timestamp, IntentScope::CreateTimelineEntry as u8);
        let signing_payload = bcs::to_bytes(&intent_msg).expect("should not fail");
        assert!(!signing_payload.is_empty());
    }
}
