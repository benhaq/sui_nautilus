import { useState, useCallback } from 'react';
import { blake2b } from 'blakejs';

const SUI_GRAPHQL_ENDPOINT = 'https://graphql.testnet.sui.io/graphql';
const ENTRY_TYPES = {
  0: 'visit_summary',
  1: 'procedure',
  2: 'refill',
  3: 'note',
  4: 'diagnosis',
  5: 'lab_result',
  6: 'immunization',
};

const SEAL_WHITELIST_QUERY = `
  query GetSealWhitelist($id: SuiAddress!) {
    object(address: $id) {
      address
      version
      digest
      asMoveObject {
        hasPublicTransfer
        contents {
          ... on MoveValue {
            json
          }
        }
      }
      dynamicFields {
        nodes {
          name {
            ... on MoveValue {
              type {
                repr
              }
              json
              bcs
            }
          }
          value {
            __typename
            ... on MoveValue {
              json
              bcs
            }
            ... on MoveObject {
              address
              hasPublicTransfer
              contents {
                ... on MoveValue {
                  json
                  bcs
                }
              }
            }
          }
        }
      }
    }
  }
`;

const TIMELINE_ENTRY_QUERY = `
  query GetTimelineEntry($id: SuiAddress!) {
    object(address: $id) {
      address
      version
      digest
      type {
        repr
      }
      asMoveObject {
        hasPublicTransfer
        contents {
          ... on MoveValue {
            json
            bcs
          }
        }
      }
    }
  }
`;

async function executeGraphQLQuery(query, variables = {}) {
  const response = await fetch(SUI_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }
  return result.data;
}

async function getPatientRefBytes(patientAddress) {
  const encoder = new TextEncoder();
  const addressBytes = encoder.encode(patientAddress);
  return blake2b(addressBytes, undefined, 32);
}

function patientRefMatches(bytes1, bytes2) {
  if (!bytes1 || !bytes2) return false;
  if (bytes1.length !== bytes2.length) return false;
  return bytes1.every((byte, i) => byte === bytes2[i]);
}

function parseDynamicField(field) {
  const nameJson = field.name?.json || {};
  const nameType = field.name?.type?.repr || '';
  const valueJson = field.value?.json || field.value?.contents?.[0]?.json || {};
  const valueContentsJson = field.value?.contents?.[0]?.json || {};
  
  if (nameType.includes('TimelineEntryKey')) {
    const patientRefBytes = nameJson.patient_ref_bytes || [];
    let timestampMs = 0;
    if (field.name?.bcs) {
      try {
        const bcsBytes = Uint8Array.from(atob(field.name.bcs), c => c.charCodeAt(0));
        if (bcsBytes.length >= 8) {
          for (let i = 0; i < 8; i++) {
            timestampMs |= BigInt(bcsBytes[bcsBytes.length - 8 + i]) << BigInt(i * 8);
          }
          timestampMs = Number(timestampMs);
        }
      } catch (e) {
        console.warn('Failed to decode timestamp:', e);
      }
    }
    
    const entryData = valueJson.entry_type !== undefined ? valueJson : valueContentsJson;
    
    return {
      type: 'timeline_entry',
      key: { patientRefBytes, timestampMs },
      value: {
        objectId: field.value?.address || null,
        patientRefBytes: entryData.patient_ref_bytes || [],
        entryType: entryData.entry_type ?? 0,
        visitDate: entryData.visit_date || '',
        providerSpecialty: entryData.provider_specialty || '',
        visitType: entryData.visit_type || '',
        status: entryData.status || '',
        contentHash: entryData.content_hash || '',
        walrusBlobId: entryData.walrus_blob_id || [],
        createdAt: timestampMs,
        revoked: entryData.revoked || false,
      },
      rawName: field.name,
      rawValue: field.value,
    };
  }
  
  if (nameType.includes('DepositPool')) {
    const poolData = valueJson.timeline_entry_id !== undefined ? valueJson : valueContentsJson;
    return {
      type: 'deposit_pool',
      key: field.name,
      value: {
        objectId: field.value?.address || null,
        timelineEntryId: poolData.timeline_entry_id || '',
        patientRefBytes: poolData.patient_ref_bytes || [],
        creator: poolData.creator || '',
        amount: poolData.balance || 0,
        active: poolData.active || false,
      },
      rawName: field.name,
      rawValue: field.value,
    };
  }
  
  return {
    type: 'generic',
    name: field.name,
    value: field.value,
    rawName: field.name,
    rawValue: field.value,
  };
}

export function useSealWhitelistDynamicFields(objectId, patientRef, options = {}) {
  const { autoFetch = true, filterByPatientRef = true } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDynamicFields = useCallback(async () => {
    if (!objectId) {
      setError(new Error('Object ID is required'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let targetPatientRefBytes = null;
      if (patientRef && filterByPatientRef) {
        targetPatientRefBytes = await getPatientRefBytes(patientRef);
      }

      const result = await executeGraphQLQuery(SEAL_WHITELIST_QUERY, { id: objectId });
      const sealWhitelist = result.object;

      if (!sealWhitelist) {
        throw new Error('SealWhitelist object not found');
      }

      const dynamicFields = sealWhitelist.dynamicFields?.nodes || [];
      const parsedFields = dynamicFields.map(parseDynamicField);

      const allEntries = parsedFields
        .filter(f => f.type === 'timeline_entry')
        .map(f => ({
          id: `${objectId}-${f.key.timestampMs}`,
          objectId: f.value.objectId || objectId,
          dynamicObjectId: f.value.objectId || null,
          patientRefBytes: f.key.patientRefBytes,
          timestampMs: f.key.timestampMs,
          entryType: f.value.entryType,
          entryTypeName: ENTRY_TYPES[f.value.entryType] || `type_${f.value.entryType}`,
          visitDate: f.value.visitDate,
          providerSpecialty: f.value.providerSpecialty,
          visitType: f.value.visitType,
          status: f.value.status,
          contentHash: f.value.contentHash,
          walrusBlobId: f.value.walrusBlobId,
          createdAt: f.value.createdAt,
          revoked: f.value.revoked,
        }))
        .sort((a, b) => b.timestampMs - a.timestampMs);

      const timelineEntries = filterByPatientRef && targetPatientRefBytes
        ? allEntries.filter(e => patientRefMatches(e.patientRefBytes, targetPatientRefBytes))
        : allEntries;

      const depositPools = parsedFields
        .filter(f => f.type === 'deposit_pool')
        .map(f => ({
          id: JSON.stringify(f.key),
          objectId: f.value.objectId || objectId,
          dynamicObjectId: f.value.objectId || null,
          timelineEntryId: f.value.timelineEntryId,
          patientRefBytes: f.value.patientRefBytes,
          creator: f.value.creator,
          amount: f.value.amount,
          active: f.value.active,
        }));

      const otherFields = parsedFields.filter(f => f.type === 'generic');

      const resultData = {
        sealWhitelist: {
          address: sealWhitelist.address,
          version: sealWhitelist.version,
          digest: sealWhitelist.digest,
        },
        timelineEntries,
        allTimelineEntries: allEntries,
        depositPools,
        otherFields,
        patientRefBytes: targetPatientRefBytes,
        fetchedAt: Date.now(),
      };

      setData(resultData);
      return resultData;
    } catch (err) {
      console.error('Failed to fetch SealWhitelist dynamic fields:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [objectId, patientRef, filterByPatientRef]);

  useCallback(() => {
    if (autoFetch && objectId) {
      fetchDynamicFields();
    }
  }, [autoFetch, objectId, fetchDynamicFields]);

  return {
    data,
    sealWhitelist: data?.sealWhitelist,
    timelineEntries: data?.timelineEntries || [],
    allTimelineEntries: data?.allTimelineEntries || [],
    depositPools: data?.depositPools || [],
    otherFields: data?.otherFields || [],
    loading,
    error,
    refresh: fetchDynamicFields,
    patientRefBytes: data?.patientRefBytes,
    fetchedAt: data?.fetchedAt,
  };
}

export function useTimelineEntry(objectId, entryObjectId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEntry = useCallback(async () => {
    if (!entryObjectId) {
      setError(new Error('Entry Object ID is required'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await executeGraphQLQuery(TIMELINE_ENTRY_QUERY, { id: entryObjectId });
      const entry = result.object;

      if (!entry) {
        throw new Error('TimelineEntry object not found');
      }

      const entryJson = entry.asMoveObject?.contents?.[0]?.json || {};
      const entryType = entry.type?.repr || '';

      const entryData = {
        objectId: entry.address,
        version: entry.version,
        digest: entry.digest,
        type: entryType,
        patientRefBytes: entryJson.patient_ref_bytes || [],
        entryType: entryJson.entry_type ?? 0,
        entryTypeName: ENTRY_TYPES[entryJson.entry_type] || `type_${entryJson.entry_type}`,
        visitDate: entryJson.visit_date || '',
        providerSpecialty: entryJson.provider_specialty || '',
        visitType: entryJson.visit_type || '',
        status: entryJson.status || '',
        contentHash: entryJson.content_hash || '',
        walrusBlobId: entryJson.walrus_blob_id || [],
        createdAt: entryJson.created_at || 0,
        revoked: entryJson.revoked || false,
        rawData: entry,
      };

      setData(entryData);
      return entryData;
    } catch (err) {
      console.error('Failed to fetch TimelineEntry:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [entryObjectId]);

  return {
    data,
    loading,
    error,
    refresh: fetchEntry,
  };
}

export function useTimelineEntryFilter(objectId, patientRef) {
  const hook = useSealWhitelistDynamicFields(objectId, patientRef);

  const getEntriesByType = useCallback((entryType) => {
    return hook.timelineEntries.filter(entry => entry.entryType === entryType);
  }, [hook.timelineEntries]);

  const getEntriesByStatus = useCallback((status) => {
    return hook.timelineEntries.filter(entry => 
      entry.status.toLowerCase() === status.toLowerCase()
    );
  }, [hook.timelineEntries]);

  const getNonRevokedEntries = useCallback(() => {
    return hook.timelineEntries.filter(entry => !entry.revoked);
  }, [hook.timelineEntries]);

  return {
    ...hook,
    getEntriesByType,
    getEntriesByStatus,
    getNonRevokedEntries,
  };
}

export default {
  useSealWhitelistDynamicFields,
  useTimelineEntry,
  useTimelineEntryFilter,
};
