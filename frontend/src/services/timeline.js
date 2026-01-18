import { MEDICAL_VAULT_PACKAGE_ID } from '../utils/constants'

/**
 * Service for fetching timeline entries (insurance claims) from on-chain
 */

/**
 * Fetch timeline entries from on-chain events
 * @param {string} whitelistId - The SealWhitelist object ID
 * @param {string} patientAddress - Patient address (to hash for patient_ref)
 * @returns {Promise<Array>} Array of timeline entries
 */
export async function fetchTimelineEntries(whitelistId, patientAddress, suiClient) {
  try {
    if (!whitelistId || !patientAddress || !suiClient) {
      return []
    }

    // Hash patient address to get patient_ref_bytes (matching contract logic)
    const encoder = new TextEncoder()
    const addressBytes = encoder.encode(patientAddress)
    const hashBuffer = await crypto.subtle.digest('SHA-256', addressBytes)
    const patientRefBytes = Array.from(new Uint8Array(hashBuffer))

    // Query TimelineEntryCreated events for this whitelist
    // Event structure: TimelineEntryCreated { whitelist_id, patient_ref_bytes, timestamp_ms, visit_date, entry_type }
    const events = await suiClient.queryEvents({
      query: {
        MoveModule: {
          package: MEDICAL_VAULT_PACKAGE_ID,
          module: 'timeline',
        },
      },
      filter: {
        MoveEventType: `${MEDICAL_VAULT_PACKAGE_ID}::timeline::TimelineEntryCreated`,
      },
      order: 'descending',
      limit: 100, // Get up to 100 most recent entries
    })

    // Filter events by whitelist_id and patient_ref_bytes
    const relevantEvents = events.data.filter(event => {
      const eventData = event.parsedJson
      if (!eventData) return false

      // Check whitelist_id matches
      if (eventData.whitelist_id !== whitelistId) return false

      // Check patient_ref_bytes matches (compare arrays)
      const eventPatientRef = eventData.patient_ref_bytes
      if (!eventPatientRef || !Array.isArray(eventPatientRef)) return false
      
      // Compare byte arrays
      if (eventPatientRef.length !== patientRefBytes.length) return false
      return eventPatientRef.every((byte, i) => byte === patientRefBytes[i])
    })

    // Convert events to claim objects
    const claims = relevantEvents.map(event => {
      const eventData = event.parsedJson
      return {
        id: `${whitelistId}-${eventData.timestamp_ms}`,
        whitelistId: eventData.whitelist_id,
        timestampMs: eventData.timestamp_ms,
        visitDate: eventData.visit_date || '',
        entryType: eventData.entry_type || 0,
        patientRefBytes: eventData.patient_ref_bytes,
        // Additional fields will be fetched from the actual object if needed
        status: 'submitted', // Default, can be updated from object
        contentHash: '', // Will be fetched from object
        walrusBlobId: [], // Will be fetched from object
        providerSpecialty: '', // Will be fetched from object
        visitType: '', // Will be fetched from object
        createdAt: eventData.timestamp_ms,
        revoked: false, // Default, will be fetched from object
        // Event metadata
        eventId: event.id.eventId,
        transactionDigest: event.id.txDigest,
      }
    })

    // Try to fetch actual entry objects for more details
    // Note: This requires knowing the dynamic field key, which we have from events
    const enrichedClaims = await Promise.all(
      claims.map(async (claim) => {
        try {
          // Try to get the dynamic field value
          // The key is TimelineEntryKey { patient_ref_bytes, timestamp_ms }
          // We need to use getDynamicFieldObject or query the object directly
          // For now, return the event data - we can enhance this later
          return claim
        } catch (error) {
          console.error(`Failed to fetch details for claim ${claim.id}:`, error)
          return claim
        }
      })
    )

    return enrichedClaims
  } catch (error) {
    console.error('Failed to fetch timeline entries:', error)
    throw error
  }
}

/**
 * Fetch all timeline entries for a user across all their whitelists
 * @param {Array} whitelists - Array of whitelist objects
 * @param {string} patientAddress - Patient address
 * @param {Object} suiClient - Sui client instance
 * @returns {Promise<Array>} Array of all timeline entries
 */
export async function fetchAllTimelineEntries(whitelists, patientAddress, suiClient) {
  try {
    if (!whitelists || whitelists.length === 0 || !patientAddress || !suiClient) {
      return []
    }

    // Fetch entries for each whitelist in parallel
    const entriesPromises = whitelists.map(whitelist =>
      fetchTimelineEntries(whitelist.whitelistId, patientAddress, suiClient)
        .then(entries => entries.map(entry => ({
          ...entry,
          whitelistName: whitelist.name || whitelist.label,
        })))
        .catch(error => {
          console.error(`Failed to fetch entries for whitelist ${whitelist.whitelistId}:`, error)
          return []
        })
    )

    const allEntries = await Promise.all(entriesPromises)
    
    // Flatten and sort by timestamp (newest first)
    const flattened = allEntries.flat()
    return flattened.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0))
  } catch (error) {
    console.error('Failed to fetch all timeline entries:', error)
    throw error
  }
}

/**
 * Get entry type name from entry type number
 * @param {number} entryType - Entry type number
 * @returns {string} Entry type name
 */
export function getEntryTypeName(entryType) {
  const types = {
    0: 'Visit Summary',
    1: 'Procedure',
    2: 'Refill',
    3: 'Note',
    4: 'Diagnosis',
    5: 'Lab Result',
    6: 'Immunization',
  }
  return types[entryType] || 'Unknown'
}

export default {
  fetchTimelineEntries,
  fetchAllTimelineEntries,
  getEntryTypeName,
}
