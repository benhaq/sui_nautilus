// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

// FHIR R5 Profile Builder using LLM (OpenRouter + GPT-4.2)
// Converts raw medical data to FHIR R5 resources
// Reference: BTP FHIR R5 Profile V0

use crate::EnclaveError;
use fastcrypto::encoding::{Encoding, Hex};
use fastcrypto::hash::{HashFunction, Sha3_256};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::info;

// ============================================
// Configuration
// ============================================

#[derive(Debug, Clone)]
pub struct OpenRouterConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: String,
}

impl OpenRouterConfig {
    pub fn model(&self) -> &str {
        &self.model
    }

    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    pub fn new(api_key: String, model: String) -> Self {
        // For Nitro Enclave, outbound traffic routes through traffic_forwarder.py
        // which listens on 127.0.0.66 and forwards to VSOCK -> host vsock-proxy -> openrouter.ai
        // The /etc/hosts maps openrouter.ai -> 127.0.0.66
        let base_url = if cfg!(feature = "medical-vault-insurer") {
            "https://openrouter.ai/api/v1".to_string()
        } else {
            "https://openrouter.ai/api/v1".to_string()
        };
        Self {
            api_key,
            model,
            base_url,
        }
    }
}

// ============================================
// Request/Response Types
// ============================================

#[derive(Debug, Serialize, Deserialize)]
pub struct FhirBuildRequest {
    /// Raw medical data to convert
    pub raw_data: String,
    /// Source format: "text", "json", "synthea"
    pub source_format: String,
    /// Optional patient context
    pub patient_context: Option<PatientContext>,
    /// Whether to include PHI (true) or use Safe Harbor de-identification (false)
    pub include_phi: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatientContext {
    pub patient_id: String,
    pub name: Option<String>,
    pub birth_date: Option<String>,
    pub gender: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FhirBuildResponse {
    /// FHIR R5 Bundle containing converted resources
    pub bundle: serde_json::Value,
    /// SHA3-256 hash of canonicalized FHIR bundle (RFC 8785 JCS)
    pub semantic_hash: String,
    /// List of resource types created
    pub resources_created: Vec<String>,
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
    /// Model used for LLM conversion
    pub model_used: String,
}

// ============================================
// System Prompt (Based on Successful AI Tool Patterns)
// ============================================

const FHIR_SYSTEM_PROMPT: &str = r#"
You are BTP FHIR Builder, a specialized AI that converts raw medical data into **FHIR R5** resources following the **BTP Medical Vault Profile V0**.

## Your Role

Convert unstructured or semi-structured medical data into valid FHIR R5 JSON bundles that can be stored on-chain and queried for treatment purposes.

## CRITICAL: Input Validation

**Before processing ANY input, you MUST validate that the data is MEDICAL/HEALTHCARE related.**

### Medical Data Indicators (MUST have at least one):
- Patient information (name, DOB, gender, ID)
- Clinical observations (vital signs, lab results, symptoms)
- Diagnoses, conditions, or problems
- Medications, prescriptions, or treatments
- Healthcare encounters (visits, admissions, procedures)
- Allergies or adverse reactions
- Immunizations or vaccinations
- Medical codes (ICD, SNOMED, LOINC, RxNorm, CPT)
- Healthcare provider or facility information
- Medical dates (visit dates, admission dates, service dates)

### NON-MEDICAL Data (Reject these):
- Financial records, invoices, billing statements
- Weather reports or forecasts
- Sports scores or game results
- Stock market or financial market data
- Recipe or food information
- Travel or transportation schedules
- Social media posts without medical content
- General news articles
- Legal documents without medical relevance
- Shopping lists or product catalogs

### Validation Rules:
1. If input contains ONLY non-medical content, output an ERROR bundle (see below)
2. If input has MIXED content, process only the medical portions
3. If input has MINIMAL medical content (< 3 relevant data points), output an ERROR bundle
4. Always prefer to process valid medical data over rejecting

## Error Output Format

When input is NOT medical/healthcare related:

```json
{
  "error": {
    "type": "INVALID_INPUT",
    "message": "Input data is not medical or healthcare related",
    "details": "The provided data does not contain recognizable medical information such as patient data, diagnoses, medications, observations, or clinical content."
  }
}
```

## Core Resources (MVP - Minimum Lovable Product)

For every conversion, include these resources when data is available:

1. **Patient** - Required. Links all other resources.
2. **Observation** - Vital signs (blood pressure, heart rate, temperature, etc.)
3. **Condition** - Diagnoses and problems
4. **MedicationRequest** - Prescriptions and medications
5. **Encounter** - Healthcare encounters (optional but recommended)

## FHIR R5 Profile Constraints

### Patient Resource
- MUST have `resourceType: "Patient"`
- MUST have `identifier` with system (e.g., "urn:oid:2.16.840.1.113883.4.1" for SSN, or local MRN)
- MUST have `name` with family and given names
- SHOULD have `birthDate` in ISO 8601 format (YYYY-MM-DD)
- SHOULD have `gender` (male | female | other | unknown)
- MAY have `address`

### Observation Resource (Vital Signs)
- MUST have `resourceType: "Observation"`
- MUST have `status: "final"`
- MUST have `code` with LOINC coding
- SHOULD have `category` with code "vital-signs"
- SHOULD have `effectiveDateTime`
- MUST have `valueQuantity` with value, unit, and system

**LOINC Codes for Vital Signs:**
- Blood Pressure Systolic: 8480-6
- Blood Pressure Diastolic: 8462-4
- Heart Rate: 8867-4
- Body Temperature: 8310-5
- Respiratory Rate: 9279-1
- Oxygen Saturation: 2708-6
- Body Weight: 29463-7
- Body Height: 8302-2
- BMI: 39156-5

### Condition Resource
- MUST have `resourceType: "Condition"`
- MUST have `clinicalStatus` with code "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved"
- SHOULD have `verificationStatus` with code "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted"
- MUST have `code` with SNOMED CT coding
- SHOULD have `subject` reference to Patient
- SHOULD have `onsetDateTime` or `onsetAge`/`onsetPeriod`
- SHOULD have `recordedDate`

### MedicationRequest Resource
- MUST have `resourceType: "MedicationRequest"`
- MUST have `status` (active | on-hold | cancelled | completed | entered-in-error | stopped | draft | unknown)
- MUST have `intent` (proposal | plan | order | original-order | reflex-order | filler-order | instance-order | option)
- MUST have `medicationCodeableConcept` with RxNorm or ATC coding
- SHOULD have `subject` reference to Patient
- SHOULD have `authoredOn` date
- MAY have `dosageInstruction` with text

## Code System References

Use these coding systems:
- **LOINC**: http://loinc.org (observations)
- **SNOMED CT**: http://snomed.info/sct (conditions, procedures)
- **RxNorm**: http://www.nlm.nih.gov/research/umls/rxnorm (medications)
- **ATC**: http://www.whocc.no/atc (medications)

## PHI Handling Rules

**If include_phi = false (DEFAULT - HIPAA Safe Harbor):**
- Anonymize all names (use "***" or "Patient")
- Mask birth dates (only year, or 1900-01-01)
- Mask addresses (only state, or "US")
- Remove SSN, phone, email
- Use local identifiers only

**If include_phi = true (for treatment):**
- Include real names
- Include full birth dates
- Include full addresses
- Include real identifiers

## Output Format

**For VALID medical data:**

Return ONLY valid JSON in this structure:

```json
{
  "bundle": {
    "resourceType": "Bundle",
    "type": "collection",
    "timestamp": "ISO8601 timestamp",
    "entry": [
      {
        "fullUrl": "urn:uuid:...",
        "resource": { ... FHIR Resource ... }
      }
    ]
  }
}
```

**For INVALID/non-medical data:**

Return ONLY this JSON (no markdown, no explanations):

```json
{
  "error": {
    "type": "INVALID_INPUT",
    "message": "Input data is not medical or healthcare related",
    "details": "The provided data does not contain recognizable medical information such as patient data, diagnoses, medications, observations, or clinical content."
  }
}
```

## Critical Rules

1. **Validate FIRST, then process** - Check if input is medical before attempting conversion
2. **Output ONLY JSON** - No markdown, no explanations
3. **Validate all codes** - Use valid LOINC/SNOMED/RxNorm codes
4. **Link references** - Use correct patient references
5. **One patient per bundle** - Split if multiple patients
6. **Use ISO 8601 dates** - YYYY-MM-DD or YYYY-MM-DDThh:mm:ssZ
7. **Include meta.profile** - Add profile URLs when applicable:
   - Patient: http://hl7.org/fhir/StructureDefinition/Patient
   - Observation: http://hl7.org/fhir/StructureDefinition/vitalsigns
   - Condition: http://hl7.org/fhir/StructureDefinition/Condition
   - MedicationRequest: http://hl7.org/fhir/StructureDefinition/MedicationRequest

## Common Mistakes to AVOID

- DON'T use FHIR R4 structures (different field names)
- DON'T mix up Condition.clinicalStatus with verificationStatus
- DON'T forget units on valueQuantity
- DON'T use narrative text in place of coded values
- DON'T create resources without proper coding
- DON'T process non-medical data - return error instead
"#;

// ============================================
// LLM Service
// ============================================

pub struct FhirLlmService {
    pub client: reqwest::Client,
    pub config: OpenRouterConfig,
}

impl FhirLlmService {
    pub fn new(config: OpenRouterConfig) -> Self {
        Self {
            client: reqwest::Client::new(),
            config,
        }
    }

    /// Call LLM to convert raw medical data to FHIR R5 JSON
    pub async fn convert_to_fhir(&self, request: &FhirBuildRequest) -> Result<serde_json::Value, EnclaveError> {
        let patient_id = request.patient_context.as_ref()
            .map(|p| p.patient_id.clone())
            .unwrap_or_else(|| "unknown".to_string());

        let phi_instruction = if request.include_phi {
            "INCLUDE all PHI in the output (real names, dates, addresses)."
        } else {
            "MASK all PHI using HIPAA Safe Harbor de-identification rules (names -> ***, dates -> year only, etc.)."
        };

        let prompt = format!(
            r#"## INPUT DATA

**Source Format:** {source_format}
**Patient ID:** {patient_id}
**PHI Mode:** {phi_instruction}

**Raw Medical Data:**
```
{raw_data}
```

## TASK

Convert the above medical data to FHIR R5 JSON following the BTP Medical Vault Profile V0.

{phi_instruction}

Return ONLY the JSON bundle, no markdown formatting."#,
            source_format = request.source_format,
            patient_id = patient_id,
            raw_data = request.raw_data,
            phi_instruction = phi_instruction
        );

        info!("Calling LLM for FHIR conversion with model: {}", self.config.model);

        let request_body = json!({
            "model": self.config.model,
            "messages": [
                {
                    "role": "system",
                    "content": FHIR_SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 8000,
            "temperature": 0.1
        });

        let response = self
            .client
            .post(format!("{}/chat/completions", self.config.base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .header("HTTP-Referer", "https://medagent.io")
            .header("X-Title", "BTP FHIR Builder")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| EnclaveError::GenericError(format!("OpenRouter request failed: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(EnclaveError::GenericError(format!("OpenRouter error: {}", error_text)));
        }

        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| EnclaveError::GenericError(format!("Failed to parse response: {}", e)))?;

        let content = response_json["choices"]
            .get(0)
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .ok_or_else(|| EnclaveError::GenericError("No content in response".to_string()))?;

        // Clean up markdown code blocks if present
        let cleaned = content
            .trim()
            .strip_prefix("```json")
            .map(|s| s.strip_prefix("\n").unwrap_or(s))
            .unwrap_or(content)
            .strip_suffix("```")
            .map(|s| s.strip_suffix("\n").unwrap_or(s))
            .unwrap_or(content)
            .trim();

        // Try to parse the JSON, with recovery for truncated responses
        let parsed: Result<serde_json::Value, _> = serde_json::from_str(cleaned);
        match parsed {
            Ok(bundle) => {
                // Check if this is an error response
                if let Some(error_obj) = bundle.get("error") {
                    let error_type = error_obj.get("type")
                        .and_then(|t| t.as_str())
                        .unwrap_or("UNKNOWN");
                    let error_message = error_obj.get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("Unknown error");
                    
                    tracing::warn!("LLM returned validation error: {} - {}", error_type, error_message);
                    return Err(EnclaveError::GenericError(format!("LLM validation error: {} - {}", error_type, error_message)));
                }
                
                Ok(bundle)
            }
            Err(e) => {
                // Try to recover from truncated JSON by adding closing braces
                let recoverable = recover_truncated_json(cleaned);
                match serde_json::from_str(&recoverable) {
                    Ok(bundle) => {
                        tracing::warn!("Recovered from truncated JSON");
                        Ok(bundle)
                    }
                    Err(_) => Err(EnclaveError::GenericError(
                        format!("Failed to parse FHIR JSON: {}. Content (first 500 chars): {}", e, &content[..content.len().min(500)])))
                }
            }
        }
    }
}

/// Try to recover from truncated JSON by adding missing closing braces/brackets
fn recover_truncated_json(s: &str) -> String {
    let mut result = s.to_string();
    
    // Count open brackets
    let curly_open = s.matches('{').count();
    let curly_close = s.matches('}').count();
    let square_open = s.matches('[').count();
    let square_close = s.matches(']').count();
    
    // Add missing closing brackets
    while square_close < square_open {
        result.push(']');
    }
    while curly_close < curly_open {
        result.push('}');
    }
    
    result
}

// ============================================
// Semantic Hash (RFC 8785 JCS)
// ============================================

pub fn compute_semantic_hash(bundle: &serde_json::Value) -> Result<String, String> {
    // Canonicalize using JCS-style sorted, indented JSON
    let canonical = serde_json::to_string_pretty(bundle)
        .map_err(|e| format!("Canonicalization failed: {}", e))?;

    // Compute SHA3-256 hash
    let mut hasher = Sha3_256::default();
    hasher.update(canonical.as_bytes());
    let result = hasher.finalize();
    Ok(Hex::encode(result))
}

/// Extract resource types created from a FHIR bundle
pub fn extract_resource_types(bundle: &serde_json::Value) -> Vec<String> {
    let mut types = Vec::new();
    
    if let Some(entries) = bundle.get("bundle").and_then(|b| b.get("entry")) {
        if let Some(entries_arr) = entries.as_array() {
            for entry in entries_arr {
                if let Some(resource) = entry.get("resource") {
                    if let Some(resource_type) = resource.get("resourceType").and_then(|rt| rt.as_str()) {
                        if !types.contains(&resource_type.to_string()) {
                            types.push(resource_type.to_string());
                        }
                    }
                }
            }
        }
    }
    
    types
}
