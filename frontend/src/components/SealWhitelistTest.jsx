import { useState, useEffect } from 'react';
import { useSealWhitelistDynamicFields, useTimelineEntry, useTimelineEntryFilter } from '../hooks';

export function SealWhitelistTest({ 
  objectId: initialObjectId = '0x1a54378f8b050138b3b4868f0074a78cc9d4e739417c5f2e4aee442a7f29a5de', 
  patientRef: initialPatientRef = '0xb5a4b0fbbd3b57d06c4c040a23a70182eb0cd7770dee6d327cbfae56fb4bcafa' 
}) {
  const [objectId, setObjectId] = useState(initialObjectId);
  const [patientRef, setPatientRef] = useState(initialPatientRef);
  const [network, setNetwork] = useState('testnet');
  const [showDebug, setShowDebug] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);

  const {
    allTimelineEntries,
    timelineEntries,
    depositPools,
    sealWhitelist,
    loading,
    error,
    refresh,
    patientRefBytes,
    fetchedAt,
  } = useSealWhitelistDynamicFields(objectId, patientRef, {
    autoFetch: false,
    filterByPatientRef: false,
  });

  const { data: fullEntryData, loading: entryLoading } = useTimelineEntry(
    objectId, 
    selectedEntry?.dynamicObjectId
  );

  const {
    getEntriesByType,
    getNonRevokedEntries,
  } = useTimelineEntryFilter(objectId, patientRef);

  const handleFetch = () => {
    setSelectedEntry(null);
    if (objectId) {
      refresh();
    }
  };

  const handleViewEntry = (entry) => {
    setSelectedEntry(entry);
  };

  useEffect(() => {
    if (selectedEntry?.dynamicObjectId) {
      refresh();
    }
  }, [selectedEntry]);

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>SealWhitelist GraphQL Test</h1>

      <div style={styles.controls}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Object ID:</label>
          <input
            type="text"
            value={objectId}
            onChange={(e) => setObjectId(e.target.value)}
            placeholder="0x..."
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Patient Ref:</label>
          <input
            type="text"
            value={patientRef}
            onChange={(e) => setPatientRef(e.target.value)}
            placeholder="0x..."
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Network:</label>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            style={styles.select}
          >
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
        </div>

        <button
          onClick={handleFetch}
          disabled={!objectId || loading}
          style={{
            ...styles.button,
            opacity: (!objectId || loading) ? 0.5 : 1,
          }}
        >
          {loading ? 'Loading...' : 'Fetch Data'}
        </button>

        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={showDebug}
            onChange={(e) => setShowDebug(e.target.checked)}
          />
          Show Debug
        </label>
      </div>

      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {/* Debug Info */}
      {showDebug && allTimelineEntries.length > 0 && (
        <div style={styles.card}>
          <h3>Debug Info</h3>
          <div style={styles.debugGrid}>
            <div style={styles.debugItem}>
              <strong>SealWhitelist:</strong> {sealWhitelist ? 'Found' : 'Not found'}
            </div>
            <div style={styles.debugItem}>
              <strong>All Entries:</strong> {allTimelineEntries.length}
            </div>
            <div style={styles.debugItem}>
              <strong>Filtered:</strong> {timelineEntries.length}
            </div>
            <div style={styles.debugItem}>
              <strong>Deposit Pools:</strong> {depositPools.length}
            </div>
            {patientRefBytes && (
              <div style={styles.debugItem}>
                <strong>Your Hash:</strong>
                <pre style={styles.pre}>{Array.from(patientRefBytes).slice(0, 8).join(', ') + '...'}</pre>
              </div>
            )}
          </div>

          <div style={styles.debugSection}>
            <h4>Sample Entry Raw Data:</h4>
            {allTimelineEntries.slice(0, 1).map((entry, i) => (
              <pre key={i} style={styles.pre}>
                {JSON.stringify({
                  id: entry.id,
                  dynamicObjectId: entry.dynamicObjectId,
                  patientRefBytes: entry.patientRefBytes,
                  allFields: entry,
                }, null, 2)}
              </pre>
            ))}
          </div>
        </div>
      )}

      {/* SealWhitelist Info */}
      {sealWhitelist && (
        <div style={styles.card}>
          <h3>SealWhitelist Info</h3>
          <p><strong>Address:</strong> {sealWhitelist.address}</p>
          <p><strong>Version:</strong> {sealWhitelist.version}</p>
          {fetchedAt && <p><strong>Fetched:</strong> {new Date(fetchedAt).toLocaleString()}</p>}
        </div>
      )}

      {/* Main Content Area */}
      <div style={styles.contentGrid}>
        {/* Timeline Entries List */}
        <div style={styles.card}>
          <h3>All Timeline Entries ({allTimelineEntries.length})</h3>
          {allTimelineEntries.length === 0 ? (
            <p>No entries found.</p>
          ) : (
            <div style={styles.entryList}>
              {allTimelineEntries.map((entry) => (
                <div 
                  key={entry.id} 
                  style={{
                    ...styles.entryCard,
                    ...(selectedEntry?.id === entry.id ? styles.selectedEntry : {}),
                  }}
                >
                  <div style={styles.entryHeader}>
                    <span style={styles.entryType}>
                      {entry.entryTypeName || `Type ${entry.entryType}`}
                    </span>
                    {entry.revoked && (
                      <span style={styles.revokedBadge}>REVOKED</span>
                    )}
                  </div>

                  <div style={styles.entryDetails}>
                    <p><strong>Date:</strong> {entry.visitDate || 'N/A'}</p>
                    <p><strong>Provider:</strong> {entry.providerSpecialty || 'N/A'}</p>
                    <p><strong>Status:</strong> {entry.status || 'N/A'}</p>
                    <p><strong>Timestamp:</strong> {entry.timestampMs} ({entry.timestampMs > 0 ? new Date(entry.timestampMs).toLocaleString() : 'Invalid'})</p>
                  </div>

                  {entry.dynamicObjectId && (
                    <div style={styles.entryActions}>
                      <button
                        onClick={() => handleViewEntry(entry)}
                        style={styles.viewButton}
                      >
                        View Full Content
                      </button>
                      <span style={styles.objectId}>
                        ID: {entry.dynamicObjectId.slice(0, 10)}...
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Full Entry Content Panel */}
        <div style={styles.card}>
          <h3>Entry Full Content</h3>
          {selectedEntry ? (
            entryLoading ? (
              <p>Loading...</p>
            ) : fullEntryData ? (
              <div>
                <div style={styles.fullContentHeader}>
                  <span style={styles.entryType}>
                    {fullEntryData.entryTypeName}
                  </span>
                  {fullEntryData.revoked && (
                    <span style={styles.revokedBadge}>REVOKED</span>
                  )}
                </div>
                
                <div style={styles.fullContentSection}>
                  <h4>Basic Info</h4>
                  <table style={styles.dataTable}>
                    <tbody>
                      <tr><td><strong>Object ID:</strong></td><td>{fullEntryData.objectId}</td></tr>
                      <tr><td><strong>Version:</strong></td><td>{fullEntryData.version}</td></tr>
                      <tr><td><strong>Type:</strong></td><td>{fullEntryData.type}</td></tr>
                      <tr><td><strong>Entry Type:</strong></td><td>{fullEntryData.entryType} ({fullEntryData.entryTypeName})</td></tr>
                      <tr><td><strong>Visit Date:</strong></td><td>{fullEntryData.visitDate}</td></tr>
                      <tr><td><strong>Provider Specialty:</strong></td><td>{fullEntryData.providerSpecialty}</td></tr>
                      <tr><td><strong>Visit Type:</strong></td><td>{fullEntryData.visitType}</td></tr>
                      <tr><td><strong>Status:</strong></td><td>{fullEntryData.status}</td></tr>
                      <tr><td><strong>Created At:</strong></td><td>{new Date(fullEntryData.createdAt).toLocaleString()}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div style={styles.fullContentSection}>
                  <h4>Content Hash</h4>
                  <code style={styles.codeBlock}>{fullEntryData.contentHash}</code>
                </div>

                <div style={styles.fullContentSection}>
                  <h4>Walrus Blob ID</h4>
                  <code style={styles.codeBlock}>
                    {fullEntryData.walrusBlobId?.length > 0 
                      ? JSON.stringify(fullEntryData.walrusBlobId)
                      : 'N/A'}
                  </code>
                </div>

                <div style={styles.fullContentSection}>
                  <h4>Patient Ref Bytes</h4>
                  <code style={styles.codeBlock}>
                    [{fullEntryData.patientRefBytes?.slice(0, 8).join(', ')}...]
                  </code>
                </div>

                <div style={styles.fullContentSection}>
                  <h4>Raw Data</h4>
                  <pre style={styles.rawPre}>
                    {JSON.stringify(fullEntryData.rawData, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p>Entry not found.</p>
            )
          ) : (
            <p style={styles.placeholder}>
              Select an entry and click "View Full Content" to see details.
            </p>
          )}
        </div>
      </div>

      {/* Deposit Pools */}
      {depositPools.length > 0 && (
        <div style={styles.card}>
          <h3>Deposit Pools ({depositPools.length})</h3>
          <ul style={styles.poolList}>
            {depositPools.map((pool, i) => (
              <li key={i} style={styles.poolItem}>
                <p><strong>Entry ID:</strong> {pool.timelineEntryId?.slice(0, 20)}...</p>
                <p><strong>Creator:</strong> {pool.creator?.slice(0, 10)}...</p>
                <p><strong>Amount:</strong> {pool.amount} MIST</p>
                <p><strong>Active:</strong> {pool.active ? 'Yes' : 'No'}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const styles = {
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '15px',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#666',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    minWidth: '300px',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    minWidth: '150px',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    alignSelf: 'flex-end',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    alignSelf: 'flex-end',
    fontSize: '14px',
  },
  error: {
    padding: '15px',
    backgroundColor: '#ffebee',
    border: '1px solid #ef5350',
    borderRadius: '4px',
    marginBottom: '20px',
    color: '#c62828',
  },
  card: {
    padding: '20px',
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  debugGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
  },
  debugItem: {
    padding: '10px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    fontSize: '14px',
  },
  debugSection: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#fff3e0',
    borderRadius: '4px',
  },
  debugEntry: {
    padding: '5px 0',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  pre: {
    margin: '5px 0',
    padding: '5px',
    backgroundColor: '#e0e0e0',
    borderRadius: '3px',
    fontSize: '11px',
    overflow: 'auto',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  selectedEntry: {
    border: '2px solid #0066cc',
    backgroundColor: '#e3f2fd',
  },
  viewButton: {
    padding: '6px 12px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  objectId: {
    fontSize: '11px',
    color: '#666',
    fontFamily: 'monospace',
  },
  fullContentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: '1px solid #e0e0e0',
  },
  fullContentSection: {
    marginBottom: '15px',
  },
  dataTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  codeBlock: {
    display: 'block',
    padding: '10px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    overflow: 'auto',
    wordBreak: 'break-all',
  },
  rawPre: {
    padding: '10px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    fontSize: '11px',
    overflow: 'auto',
    maxHeight: '300px',
  },
  placeholder: {
    padding: '40px',
    textAlign: 'center',
    color: '#666',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '15px',
    alignItems: 'center',
  },
  entryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  entryCard: {
    padding: '15px',
    backgroundColor: '#fafafa',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
  },
  entryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  entryType: {
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#0066cc',
  },
  revokedBadge: {
    padding: '2px 8px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: '12px',
    color: '#666',
  },
  entryDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '8px',
  },
  entryMeta: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid #e0e0e0',
    color: '#999',
  },
  poolList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  poolItem: {
    padding: '15px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    marginBottom: '10px',
  },
  statsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '10px',
  },
};

export default SealWhitelistTest;
