// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// Validator Module for FHIR R5 Medical Document Validation
/// Uses Nautilus Intent pattern with enclave signature verification
/// 
/// ARCHITECTURE NOTE:
/// Raw medical documents (up to 2MB) CANNOT be passed as function parameters.
/// Sui Move limits: 16KB per pure argument, 128KB per transaction.
/// 
/// CORRECT FLOW:
/// 1. OFF-CHAIN: Raw document → LLM → FHIR R5 bundle
/// 2. OFF-CHAIN: Upload FHIR bundle to Walrus → get blob_id
/// 3. OFF-CHAIN: Compute SHA3-256 semantic hash
/// 4. ON-CHAIN: Submit metadata only (walrus_blob_id, semantic_hash, etc.)
/// 
/// This module handles step 4 - validating and attesting FHIR bundle references.

module medical_vault::validator {
    use sui::event;
    use sui::clock::{Self, Clock};
    use enclave::enclave::{Enclave, verify_signature};

    // ============================================
    // Error Codes
    // ============================================

    const E_INVALID_SIGNATURE: u64 = 0;
    const E_INVALID_SEMANTIC_HASH: u64 = 1;
    const E_INVALID_RESOURCE_COUNT: u64 = 2;
    const E_EMPTY_RESOURCE_TYPES: u64 = 3;

    // ============================================
    // Intent Scope Constants
    // ============================================

    /// Intent for validating a FHIR bundle stored on Walrus
    const INTENT_VALIDATE_BUNDLE: u8 = 100;
    /// Intent for verifying an existing bundle reference
    const INTENT_VERIFY_BUNDLE: u8 = 101;
    /// Intent for validating insurance claim bundle
    const INTENT_VALIDATE_CLAIM: u8 = 102;

    // ============================================
    // FHIR R5 Resource Type Constants (u8 for compact storage)
    // ============================================

    const FHIR_RESOURCE_PATIENT: u8 = 0;
    const FHIR_RESOURCE_OBSERVATION: u8 = 1;
    const FHIR_RESOURCE_CONDITION: u8 = 2;
    const FHIR_RESOURCE_MEDICATION_REQUEST: u8 = 3;
    const FHIR_RESOURCE_ENCOUNTER: u8 = 4;
    const FHIR_RESOURCE_DIAGNOSTIC_REPORT: u8 = 5;
    const FHIR_RESOURCE_PROCEDURE: u8 = 6;
    const FHIR_RESOURCE_IMMUNIZATION: u8 = 7;
    const FHIR_RESOURCE_ALLERGY_INTOLERANCE: u8 = 8;
    const FHIR_RESOURCE_OTHER: u8 = 255;

    // ============================================
    // Intent Payloads (small, on-chain verifiable)
    // ============================================

    /// Payload for bundle validation - all fields are small references
    public struct ValidateBundlePayload has copy, drop {
        walrus_blob_id: u256,      // Walrus storage reference
        semantic_hash: vector<u8>,        // SHA3-256 = 32 bytes
        patient_id: vector<u8>,           // Patient reference
        resource_count: u64,              // Number of resources
    }

    /// Payload for claim validation
    public struct ValidateClaimPayload has copy, drop {
        walrus_blob_id: u256,
        semantic_hash: vector<u8>,
        patient_id: vector<u8>,
    }

    // ============================================
    // On-Chain FHIR Bundle Reference
    // ============================================

    /// On-chain reference to a FHIR R5 bundle stored on Walrus
    /// Stores ONLY metadata - the actual bundle JSON is stored off-chain on Walrus
    /// 
    /// Size analysis (well within limits):
    /// - walrus_blob_id: ~64 bytes
    /// - semantic_hash: 32 bytes
    /// - resource_count: 8 bytes
    /// - resource_types: ~10-50 bytes (encoded u8s)
    /// - patient_id: ~32-64 bytes
    /// - Total: < 300 bytes (<< 256KB object limit)
    public struct FhirBundleRef has key, store {
        id: UID,
        /// Walrus blob ID where the full FHIR bundle JSON is stored
        /// Used to retrieve the bundle off-chain
        walrus_blob_id: u256,
        /// SHA3-256 semantic hash of the canonicalized FHIR bundle
        /// Enables integrity verification without downloading the bundle
        semantic_hash: vector<u8>,
        /// Number of FHIR resources in the bundle
        resource_count: u64,
        /// Compact encoding of resource types present (u8 per type)
        /// Used for quick filtering/queries on-chain
        resource_types: vector<u8>,
        /// Patient identifier (can be local MRN or external ID)
        patient_id: vector<u8>,
        /// Whether the bundle contains PHI (Protected Health Information)
        /// Important for compliance and access control decisions
        include_phi: bool,
        /// Unix timestamp when the bundle was validated
        validated_at: u64,
        /// Validator's Sui address (enclave operator)
        validator: address,
    }

    // ============================================
    // Validation Events
    // ============================================

    /// Emitted when a FHIR bundle is validated and attested
    public struct BundleValidated has copy, drop {
        bundle_ref_id: ID,
        walrus_blob_id: u256,
        semantic_hash: vector<u8>,
        resource_count: u64,
        include_phi: bool,
        validated_at: u64,
        validator: address,
    }

    /// Emitted when a bundle reference is verified
    public struct BundleVerified has copy, drop {
        bundle_ref_id: ID,
        semantic_hash: vector<u8>,
        verified: bool,
        timestamp_ms: u64,
    }

    /// Emitted when a claim bundle is validated
    public struct ClaimBundleValidated has copy, drop {
        bundle_ref_id: ID,
        walrus_blob_id: u256,
        semantic_hash: vector<u8>,
        patient_id: vector<u8>,
        validated_at: u64,
        validator: address,
    }

    // ============================================
    // Entry Functions (Nautilus Intent Pattern)
    // ============================================

    /// Validate a FHIR R5 bundle and create an on-chain reference
    /// 
    /// USAGE:
    /// 1. Off-chain: Process raw medical document with LLM → FHIR R5 JSON
    /// 2. Off-chain: Upload JSON to Walrus → get blob_id
    /// 3. Off-chain: Compute semantic_hash (SHA3-256 of canonicalized JSON)
    /// 4. On-chain: Call this function with metadata only
    /// 
    /// The enclave signature verifies that:
    /// - The bundle was processed by the trusted LLM
    /// - The Walrus blob ID and semantic hash are authentic
    public fun validate_bundle(
        walrus_blob_id: u256,
        semantic_hash: vector<u8>,
        patient_id: vector<u8>,
        resource_count: u64,
        resource_types: vector<u8>,
        include_phi: bool,
        timestamp_ms: u64,
        signature: vector<u8>,
        enclave: &Enclave<Validator>,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        // Build intent payload (small, verifiable)
        let payload = ValidateBundlePayload {
            walrus_blob_id: walrus_blob_id,
            semantic_hash: semantic_hash,
            patient_id: patient_id,
            resource_count: resource_count,
        };

        // Verify enclave signature (Nautilus Intent pattern)
        let is_valid = verify_signature(
            enclave,
            INTENT_VALIDATE_BUNDLE,
            timestamp_ms,
            payload,
            &signature
        );
        assert!(is_valid, E_INVALID_SIGNATURE);

        // Validate semantic hash (SHA3-256 = 32 bytes)
        assert!(vector::length(&semantic_hash) == 32, E_INVALID_SEMANTIC_HASH);
        assert!(resource_count > 0, E_INVALID_RESOURCE_COUNT);
        assert!(vector::length(&resource_types) > 0, E_EMPTY_RESOURCE_TYPES);

        // Create on-chain bundle reference
        let bundle_ref = FhirBundleRef {
            id: object::new(ctx),
            walrus_blob_id,
            semantic_hash,
            resource_count,
            resource_types,
            patient_id,
            include_phi,
            validated_at: clock::timestamp_ms(_clock),
            validator: sender,
        };
        let bundle_ref_id = object::uid_to_inner(&bundle_ref.id);

        // Emit validation event for indexing
        event::emit(BundleValidated {
            bundle_ref_id,
            walrus_blob_id,
            semantic_hash,
            resource_count,
            include_phi,
            validated_at: clock::timestamp_ms(_clock),
            validator: sender,
        });

        transfer::share_object(bundle_ref);
    }

    /// Verify an existing FHIR bundle reference (for bundles created externally)
    /// 
    /// Use this when you have a pre-existing FHIR bundle and want to
    /// create an attested on-chain reference to it.
    public fun verify_bundle(
        walrus_blob_id: u256,
        semantic_hash: vector<u8>,
        patient_id: vector<u8>,
        resource_count: u64,
        resource_types: vector<u8>,
        timestamp_ms: u64,
        signature: vector<u8>,
        enclave: &Enclave<Validator>,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        let payload = ValidateBundlePayload {
            walrus_blob_id,
            semantic_hash,
            patient_id,
            resource_count,
        };

        let is_valid = verify_signature(
            enclave,
            INTENT_VERIFY_BUNDLE,
            timestamp_ms,
            payload,
            &signature
        );
        assert!(is_valid, E_INVALID_SIGNATURE);

        assert!(vector::length(&semantic_hash) == 32, E_INVALID_SEMANTIC_HASH);
        assert!(resource_count > 0, E_INVALID_RESOURCE_COUNT);

        let bundle_ref = FhirBundleRef {
            id: object::new(ctx),
            walrus_blob_id,
            semantic_hash,
            resource_count,
            resource_types,
            patient_id,
            include_phi: false,  // Default to no PHI for verified bundles
            validated_at: clock::timestamp_ms(_clock),
            validator: sender,
        };
        let bundle_ref_id = object::uid_to_inner(&bundle_ref.id);

        event::emit(BundleVerified {
            bundle_ref_id,
            semantic_hash,
            verified: true,
            timestamp_ms: clock::timestamp_ms(_clock),
        });

        transfer::share_object(bundle_ref);
    }

    /// Validate a FHIR bundle for insurance claim processing
    /// Simplified entry for claim-specific workflows
    public fun validate_claim_bundle(
        walrus_blob_id: u256,
        semantic_hash: vector<u8>,
        patient_id: vector<u8>,
        timestamp_ms: u64,
        signature: vector<u8>,
        enclave: &Enclave<Validator>,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        let payload = ValidateClaimPayload {
            walrus_blob_id,
            semantic_hash,
            patient_id,
        };

        let is_valid = verify_signature(
            enclave,
            INTENT_VALIDATE_CLAIM,
            timestamp_ms,
            payload,
            &signature
        );
        assert!(is_valid, E_INVALID_SIGNATURE);

        assert!(vector::length(&semantic_hash) == 32, E_INVALID_SEMANTIC_HASH);

        let bundle_ref = FhirBundleRef {
            id: object::new(ctx),
            walrus_blob_id,
            semantic_hash,
            resource_count: 0,  // Claims may not need full resource count
            resource_types: vector::empty(),
            patient_id,
            include_phi: false,
            validated_at: clock::timestamp_ms(_clock),
            validator: sender,
        };

        event::emit(ClaimBundleValidated {
            bundle_ref_id: object::uid_to_inner(&bundle_ref.id),
            walrus_blob_id,
            semantic_hash,
            patient_id,
            validated_at: clock::timestamp_ms(_clock),
            validator: sender,
        });

        transfer::share_object(bundle_ref);
    }

    // ============================================
    // Helper Functions
    // ============================================

    /// Parse a FHIR resource type string to compact u8 code
    public fun parse_resource_type(type_name: &vector<u8>): u8 {
        if (type_name == b"Patient") {
            return FHIR_RESOURCE_PATIENT
        };
        if (type_name == b"Observation") {
            return FHIR_RESOURCE_OBSERVATION
        };
        if (type_name == b"Condition") {
            return FHIR_RESOURCE_CONDITION
        };
        if (type_name == b"MedicationRequest") {
            return FHIR_RESOURCE_MEDICATION_REQUEST
        };
        if (type_name == b"Encounter") {
            return FHIR_RESOURCE_ENCOUNTER
        };
        if (type_name == b"DiagnosticReport") {
            return FHIR_RESOURCE_DIAGNOSTIC_REPORT
        };
        if (type_name == b"Procedure") {
            return FHIR_RESOURCE_PROCEDURE
        };
        if (type_name == b"Immunization") {
            return FHIR_RESOURCE_IMMUNIZATION
        };
        if (type_name == b"AllergyIntolerance") {
            return FHIR_RESOURCE_ALLERGY_INTOLERANCE
        };
        FHIR_RESOURCE_OTHER
    }

    /// Verify semantic hash matches
    public fun verify_semantic_hash(bundle_ref: &FhirBundleRef, expected: &vector<u8>): bool {
        &bundle_ref.semantic_hash == expected
    }

    /// Check if bundle contains a specific resource type
    public fun has_resource_type(bundle_ref: &FhirBundleRef, resource_type: u8): bool {
        let mut i = 0;
        let len = vector::length(&bundle_ref.resource_types);
        while (i < len) {
            if (*vector::borrow(&bundle_ref.resource_types, i) == resource_type) {
                return true
            };
            i = i + 1;
        };
        false
    }

    /// Check if bundle contains patient resource
    public fun has_patient(bundle_ref: &FhirBundleRef): bool {
        has_resource_type(bundle_ref, FHIR_RESOURCE_PATIENT)
    }

    /// Check if bundle contains observations (vital signs, lab results, etc.)
    public fun has_observations(bundle_ref: &FhirBundleRef): bool {
        has_resource_type(bundle_ref, FHIR_RESOURCE_OBSERVATION)
    }

    /// Check if bundle contains conditions/diagnoses
    public fun has_conditions(bundle_ref: &FhirBundleRef): bool {
        has_resource_type(bundle_ref, FHIR_RESOURCE_CONDITION)
    }

    /// Check if bundle contains medications
    public fun has_medications(bundle_ref: &FhirBundleRef): bool {
        has_resource_type(bundle_ref, FHIR_RESOURCE_MEDICATION_REQUEST)
    }

    // ============================================
    // Getter Functions
    // ============================================

    public fun walrus_blob_id(ref: &FhirBundleRef): &u256 {
        &ref.walrus_blob_id
    }

    public fun semantic_hash(ref: &FhirBundleRef): &vector<u8> {
        &ref.semantic_hash
    }

    public fun resource_count(ref: &FhirBundleRef): u64 {
        ref.resource_count
    }

    public fun resource_types(ref: &FhirBundleRef): &vector<u8> {
        &ref.resource_types
    }

    public fun patient_id(ref: &FhirBundleRef): &vector<u8> {
        &ref.patient_id
    }

    public fun include_phi(ref: &FhirBundleRef): bool {
        ref.include_phi
    }

    public fun validated_at(ref: &FhirBundleRef): u64 {
        ref.validated_at
    }

    public fun validator(ref: &FhirBundleRef): address {
        ref.validator
    }

    // ============================================
    // Type Witness
    // ============================================

    public struct Validator has drop {}
}
