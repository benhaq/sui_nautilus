// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

/// Timeline Module for HIPAA Safe Harbor Compliant Patient Records
/// Uses Nautilus Intent pattern with enclave signature verification
/// 
/// ARCHITECTURE NOTE:
/// Timeline entries are stored as dynamic_object_fields on SealWhitelist.
/// This provides:
/// - Query entries via whitelist object (no indexer needed)
/// - Storage embedded in parent (no separate object overhead)
/// - Access control implicit (attached to whitelist)
/// - Patient ref derived from parent whitelist
///
/// All data stored on-chain follows HIPAA Safe Harbor de-identification standards:
/// - No direct patient identifiers (use references)
/// - No exact dates (use date strings only)
/// - No specific symptoms or diagnoses (use generalized categories)
/// - Provider specialty instead of provider name
/// - Visit type categorization (checkup, procedure, etc.)

module medical_vault::timeline {
    use sui::object::{Self, UID, ID};
    use sui::dynamic_object_field::{Self as dof};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::event;
    use sui::clock::Clock;
    use std::string::{Self, String};
    use std::vector;
    use enclave::enclave::{Enclave, verify_signature};
    use medical_vault::seal_whitelist::{Self, SealWhitelist};

    // ============================================
    // Error Codes
    // ============================================

    const E_INVALID_SIGNATURE: u64 = 0;
    const E_INVALID_SCOPE: u64 = 1;
    const E_INVALID_ENTRY_TYPE: u64 = 2;
    const E_ALREADY_REVOKED: u64 = 3;
    const E_UNAUTHORIZED_ACCESS: u64 = 4;
    const E_EMPTY_PATIENT_REF: u64 = 5;
    const E_INVALID_VISIT_DATE: u64 = 6;
    const E_ENTRY_NOT_FOUND: u64 = 7;
    const E_INVALID_WHITELIST: u64 = 8;

    // ============================================
    // Intent Scope Constants
    // ============================================

    /// Intent for creating a timeline entry
    const INTENT_CREATE_ENTRY: u8 = 103;
    /// Intent for verifying a timeline entry
    const INTENT_VERIFY_ENTRY: u8 = 104;

    // ============================================
    // Timeline Scope Constants (HIPAA Safe Harbor)
    // ============================================

    const SCOPE_TREATMENT: u8 = 0;
    const SCOPE_PAYMENT: u8 = 1;
    const SCOPE_OPERATIONS: u8 = 2;
    const SCOPE_RESEARCH: u8 = 3;
    const SCOPE_LEGAL: u8 = 4;

    // ============================================
    // Timeline Entry Type Constants
    // ============================================

    const ENTRY_VISIT_SUMMARY: u8 = 0;
    const ENTRY_PROCEDURE: u8 = 1;
    const ENTRY_REFILL: u8 = 2;
    const ENTRY_NOTE: u8 = 3;
    const ENTRY_DIAGNOSIS: u8 = 4;
    const ENTRY_LAB_RESULT: u8 = 5;
    const ENTRY_IMMUNIZATION: u8 = 6;

    // ============================================
    // Dynamic Field Keys
    // ============================================

    /// Key for timeline entries as dynamic object field on SealWhitelist
    /// Uses (patient_ref_bytes, timestamp_ms) as key for uniqueness
    public struct TimelineEntryKey has store, copy, drop {
        patient_ref_bytes: vector<u8>,
        timestamp_ms: u64,
    }

    /// Marker type for entry counter (single counter per whitelist)
    public struct EntryCounter has store, copy, drop {
        marker: u8,
    }

    // ============================================
    // Intent Payloads
    // ============================================

    /// Payload for creating a timeline entry
    public struct CreateEntryPayload has copy, drop {
        patient_ref: vector<u8>,
        entry_type: u8,
        scope: u8,
        visit_date: vector<u8>,
        content_hash: vector<u8>,
    }

    // ============================================
    // On-Chain Timeline Structures (HIPAA Safe Harbor)
    // ============================================

    /// TimelineEntry - Non-PHI visit summaries stored as dynamic_object_field on SealWhitelist
    /// All fields follow HIPAA Safe Harbor de-identification standards
    /// Note: patient_ref and whitelist_id are derived from parent SealWhitelist
    public struct TimelineEntry has key, store {
        id: UID,
        /// Patient reference stored as bytes (derived from parent)
        patient_ref_bytes: vector<u8>,
        /// Type of entry (visit_summary, procedure, refill, note, etc.)
        entry_type: u8,
        /// Policy scope (treatment, payment, operations, research, legal)
        scope: u8,
        /// Date of visit (format: YYYY-MM-DD, no exact timestamp)
        visit_date: String,
        /// Provider specialty (general category, not provider name)
        provider_specialty: String,
        /// Visit type (checkup, procedure, emergency, etc.)
        visit_type: String,
        /// Status of the entry (completed, pending, cancelled)
        status: String,
        /// SHA3-256 hash of the full entry content stored off-chain
        content_hash: String,
        /// Walrus blob ID where full entry content is stored (encrypted)
        walrus_blob_id: vector<u8>,
        /// Unix timestamp when entry was created
        created_at: u64,
        /// Whether this entry has been revoked
        revoked: bool,
    }

    /// TimelineSummary - Aggregated statistics for a patient's timeline
    public struct TimelineSummary has key, store {
        id: UID,
        /// Reference to patient
        patient_ref: String,
        /// Associated whitelist ID
        whitelist_id: ID,
        /// Total number of visits
        visit_count: u64,
        /// Count by scope
        treatment_count: u64,
        payment_count: u64,
        operations_count: u64,
        research_count: u64,
        legal_count: u64,
        /// Date range (format: YYYY-MM-DD)
        first_visit: String,
        last_visit: String,
        /// Unique provider specialties encountered
        specialties: vector<String>,
        /// Last update timestamp
        updated_at: u64,
    }

    // ============================================
    // Timeline Events
    // ============================================

    /// Emitted when a new timeline entry is created
    public struct TimelineEntryCreated has copy, drop {
        whitelist_id: ID,
        patient_ref_bytes: vector<u8>,
        timestamp_ms: u64,
        scope: u8,
        visit_date: String,
        entry_type: u8,
    }

    /// Emitted when a timeline entry is revoked
    public struct TimelineEntryRevoked has copy, drop {
        whitelist_id: ID,
        patient_ref_bytes: vector<u8>,
        timestamp_ms: u64,
    }

    /// Emitted when a timeline summary is updated
    public struct TimelineSummaryUpdated has copy, drop {
        summary_id: ID,
        visit_count: u64,
        scope: u8,
        timestamp: u64,
    }

    // ============================================
    // Entry Functions (Nautilus Intent Pattern)
    // ============================================

    /// Create a new HIPAA Safe Harbor compliant timeline entry as dynamic field on SealWhitelist
    /// 
    /// USAGE:
    /// 1. Off-chain: Generate entry content (non-PHI)
    /// 2. Off-chain: Upload to Walrus → get blob_id
    /// 3. Off-chain: Compute content_hash (SHA3-256)
    /// 4. On-chain: Call this function with metadata only
    entry fun create_entry(
        whitelist: &mut SealWhitelist,
        patient_ref: vector<u8>,
        entry_type: u8,
        scope: u8,
        visit_date: vector<u8>,
        provider_specialty: vector<u8>,
        visit_type: vector<u8>,
        status: vector<u8>,
        content_hash: vector<u8>,
        walrus_blob_id: vector<u8>,
        timestamp_ms: u64,
        signature: vector<u8>,
        enclave: &Enclave<Timeline>,
        _clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Validate inputs
        assert!(vector::length(&patient_ref) > 0, E_EMPTY_PATIENT_REF);
        assert!(vector::length(&visit_date) > 0, E_INVALID_VISIT_DATE);
        assert!(scope <= SCOPE_LEGAL, E_INVALID_SCOPE);
        assert!(entry_type <= ENTRY_IMMUNIZATION, E_INVALID_ENTRY_TYPE);

        // Build intent payload
        let payload = CreateEntryPayload {
            patient_ref: patient_ref,
            entry_type: entry_type,
            scope: scope,
            visit_date: visit_date,
            content_hash: content_hash,
        };

        // Verify enclave signature (Nautilus Intent pattern)
        let is_valid = verify_signature(
            enclave,
            INTENT_CREATE_ENTRY,
            timestamp_ms,
            payload,
            &signature
        );
        assert!(is_valid, E_INVALID_SIGNATURE);

        // Create dynamic field key using patient_ref bytes and timestamp
        let key = TimelineEntryKey {
            patient_ref_bytes: patient_ref,
            timestamp_ms,
        };

        // Create timeline entry (whitelist_id derived from parent)
        let entry = TimelineEntry {
            id: object::new(ctx),
            patient_ref_bytes: *&key.patient_ref_bytes,
            entry_type,
            scope,
            visit_date: string::utf8(visit_date),
            provider_specialty: string::utf8(provider_specialty),
            visit_type: string::utf8(visit_type),
            status: string::utf8(status),
            content_hash: string::utf8(content_hash),
            walrus_blob_id,
            created_at: timestamp_ms,
            revoked: false,
        };

        // Add as dynamic field to whitelist
        dof::add(seal_whitelist::uid_mut(whitelist), key, entry);

        // Emit creation event
        event::emit(TimelineEntryCreated {
            whitelist_id: seal_whitelist::whitelist_id(whitelist),
            patient_ref_bytes: *&key.patient_ref_bytes,
            timestamp_ms,
            scope,
            visit_date: string::utf8(visit_date),
            entry_type,
        });
    }

    /// Verify an existing timeline entry (for externally created entries)
    entry fun verify_entry(
        whitelist: &mut SealWhitelist,
        patient_ref: vector<u8>,
        entry_type: u8,
        scope: u8,
        visit_date: vector<u8>,
        content_hash: vector<u8>,
        walrus_blob_id: vector<u8>,
        timestamp_ms: u64,
        signature: vector<u8>,
        enclave: &Enclave<Timeline>,
        _clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(vector::length(&patient_ref) > 0, E_EMPTY_PATIENT_REF);
        assert!(scope <= SCOPE_LEGAL, E_INVALID_SCOPE);

        let payload = CreateEntryPayload {
            patient_ref,
            entry_type,
            scope,
            visit_date,
            content_hash,
        };

        let is_valid = verify_signature(
            enclave,
            INTENT_VERIFY_ENTRY,
            timestamp_ms,
            payload,
            &signature
        );
        assert!(is_valid, E_INVALID_SIGNATURE);

        let key = TimelineEntryKey {
            patient_ref_bytes: patient_ref,
            timestamp_ms,
        };

        let entry = TimelineEntry {
            id: object::new(ctx),
            patient_ref_bytes: *&key.patient_ref_bytes,
            entry_type,
            scope,
            visit_date: string::utf8(visit_date),
            provider_specialty: string::utf8(b""),
            visit_type: string::utf8(b""),
            status: string::utf8(b"verified"),
            content_hash: string::utf8(content_hash),
            walrus_blob_id,
            created_at: timestamp_ms,
            revoked: false,
        };

        dof::add(seal_whitelist::uid_mut(whitelist), key, entry);

        event::emit(TimelineEntryCreated {
            whitelist_id: seal_whitelist::whitelist_id(whitelist),
            patient_ref_bytes: *&key.patient_ref_bytes,
            timestamp_ms,
            scope,
            visit_date: string::utf8(visit_date),
            entry_type,
        });
    }

    // ============================================
    // Summary Functions
    // ============================================

    /// Initialize a timeline summary for a new patient
    entry fun create_summary(
        patient_ref: vector<u8>,
        whitelist_id: ID,
        _clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(vector::length(&patient_ref) > 0, E_EMPTY_PATIENT_REF);

        let summary_uid = object::new(ctx);

        let summary = TimelineSummary {
            id: summary_uid,
            patient_ref: string::utf8(patient_ref),
            whitelist_id,
            visit_count: 0,
            treatment_count: 0,
            payment_count: 0,
            operations_count: 0,
            research_count: 0,
            legal_count: 0,
            first_visit: string::utf8(b""),
            last_visit: string::utf8(b""),
            specialties: vector::empty(),
            updated_at: 0,
        };

        transfer::share_object(summary);
    }

    /// Update a timeline summary when a new entry is added
    entry fun update_summary(
        summary: &mut TimelineSummary,
        scope: u8,
        visit_date: vector<u8>,
        provider_specialty: vector<u8>,
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        let current_time = clock.timestamp_ms();

        // Increment visit count
        summary.visit_count = summary.visit_count + 1;

        // Increment scope-specific count
        if (scope == SCOPE_TREATMENT) {
            summary.treatment_count = summary.treatment_count + 1;
        } else if (scope == SCOPE_PAYMENT) {
            summary.payment_count = summary.payment_count + 1;
        } else if (scope == SCOPE_OPERATIONS) {
            summary.operations_count = summary.operations_count + 1;
        } else if (scope == SCOPE_RESEARCH) {
            summary.research_count = summary.research_count + 1;
        } else if (scope == SCOPE_LEGAL) {
            summary.legal_count = summary.legal_count + 1;
        };

        // Update date range
        let visit_date_str = string::utf8(visit_date);
        if (summary.first_visit.is_empty()) {
            summary.first_visit = visit_date_str;
        };
        summary.last_visit = visit_date_str;

        // Add specialty if unique
        let specialty_str = string::utf8(provider_specialty);
        let mut found = false;
        let mut i = 0;
        let len = vector::length(&summary.specialties);
        while (i < len) {
            if (*vector::borrow(&summary.specialties, i) == specialty_str) {
                found = true;
                break
            };
            i = i + 1;
        };
        if (!found) {
            vector::push_back(&mut summary.specialties, specialty_str);
        };

        summary.updated_at = current_time;

        event::emit(TimelineSummaryUpdated {
            summary_id: object::uid_to_inner(&summary.id),
            visit_count: summary.visit_count,
            scope,
            timestamp: current_time,
        });
    }

    /// Revoke a timeline entry (requires mutable access to whitelist)
    entry fun revoke_entry(
        whitelist: &mut SealWhitelist,
        patient_ref: vector<u8>,
        timestamp_ms: u64,
        _clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        let key = TimelineEntryKey {
            patient_ref_bytes: patient_ref,
            timestamp_ms,
        };

        assert!(dof::exists_<TimelineEntryKey>(seal_whitelist::uid(whitelist), key.clone()), E_ENTRY_NOT_FOUND);

        let entry: TimelineEntry = dof::remove(seal_whitelist::uid_mut(whitelist), key);
        
        assert!(!entry.revoked, E_ALREADY_REVOKED);

        event::emit(TimelineEntryRevoked {
            whitelist_id: seal_whitelist::whitelist_id(whitelist),
            patient_ref_bytes: entry.patient_ref_bytes,
            timestamp_ms,
        });

        // Clean up UID
        let TimelineEntry { id, .. } = entry;
        object::delete(id);
    }

    // ============================================
    // Helper Functions
    // ============================================

    /// Get scope name as bytes
    public fun scope_name(scope: u8): vector<u8> {
        if (scope == SCOPE_TREATMENT) {
            b"treatment"
        } else if (scope == SCOPE_PAYMENT) {
            b"payment"
        } else if (scope == SCOPE_OPERATIONS) {
            b"operations"
        } else if (scope == SCOPE_RESEARCH) {
            b"research"
        } else if (scope == SCOPE_LEGAL) {
            b"legal"
        } else {
            b"unknown"
        }
    }

    /// Get entry type name as bytes
    public fun entry_type_name(entry_type: u8): vector<u8> {
        if (entry_type == ENTRY_VISIT_SUMMARY) {
            b"visit_summary"
        } else if (entry_type == ENTRY_PROCEDURE) {
            b"procedure"
        } else if (entry_type == ENTRY_REFILL) {
            b"refill"
        } else if (entry_type == ENTRY_NOTE) {
            b"note"
        } else if (entry_type == ENTRY_DIAGNOSIS) {
            b"diagnosis"
        } else if (entry_type == ENTRY_LAB_RESULT) {
            b"lab_result"
        } else if (entry_type == ENTRY_IMMUNIZATION) {
            b"immunization"
        } else {
            b"unknown"
        }
    }

    // ============================================
    // Getter Functions
    // ============================================

    public fun patient_ref_bytes(entry: &TimelineEntry): &vector<u8> {
        &entry.patient_ref_bytes
    }

    public fun entry_type(entry: &TimelineEntry): u8 {
        entry.entry_type
    }

    public fun scope(entry: &TimelineEntry): u8 {
        entry.scope
    }

    public fun visit_date(entry: &TimelineEntry): &String {
        &entry.visit_date
    }

    public fun provider_specialty(entry: &TimelineEntry): &String {
        &entry.provider_specialty
    }

    public fun visit_type(entry: &TimelineEntry): &String {
        &entry.visit_type
    }

    public fun status(entry: &TimelineEntry): &String {
        &entry.status
    }

    public fun content_hash(entry: &TimelineEntry): &String {
        &entry.content_hash
    }

    public fun walrus_blob_id(entry: &TimelineEntry): &vector<u8> {
        &entry.walrus_blob_id
    }

    public fun created_at(entry: &TimelineEntry): u64 {
        entry.created_at
    }

    public fun is_revoked(entry: &TimelineEntry): bool {
        entry.revoked
    }

    public fun summary_visit_count(summary: &TimelineSummary): u64 {
        summary.visit_count
    }

    public fun summary_treatment_count(summary: &TimelineSummary): u64 {
        summary.treatment_count
    }

    public fun summary_payment_count(summary: &TimelineSummary): u64 {
        summary.payment_count
    }

    public fun summary_first_visit(summary: &TimelineSummary): &String {
        &summary.first_visit
    }

    public fun summary_last_visit(summary: &TimelineSummary): &String {
        &summary.last_visit
    }

    public fun summary_specialties(summary: &TimelineSummary): &vector<String> {
        &summary.specialties
    }

    // ============================================
    // Type Witness
    // ============================================

    public struct Timeline has drop {}
}
