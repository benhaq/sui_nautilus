# useSealWhitelistGraphQL Hook

React hook for fetching SealWhitelist dynamic object fields using Sui GraphQL RPC.

## Features

- 🚀 **Real-time data** from Sui blockchain via GraphQL RPC
- 📊 **Timeline entries** - Fetches HIPAA-compliant medical timeline entries
- 💰 **Deposit pools** - Manages patient incentive pools
- 🔍 **Smart filtering** - Built-in methods to filter entries by type, status, and date
- 🎯 **Type-safe** - Comprehensive TypeScript support

## Usage

### Basic Usage

```javascript
import { useSealWhitelistDynamicFields } from './hooks';

function TimelineComponent({ whitelistId, patientAddress }) {
  const {
    timelineEntries,
    depositPools,
    loading,
    error,
    refresh,
    sealWhitelist,
  } = useSealWhitelistDynamicFields(whitelistId, patientAddress, {
    autoFetch: true,
    network: 'testnet',
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Medical Timeline</h2>
      {timelineEntries.map(entry => (
        <TimelineEntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
```

### Filtering Entries

```javascript
import { useTimelineEntryFilter } from './hooks';

function FilteredTimeline({ whitelistId, patientAddress }) {
  const {
    timelineEntries,
    getEntriesByType,
    getEntriesByStatus,
    getNonRevokedEntries,
  } = useTimelineEntryFilter(whitelistId, patientAddress);

  // Get only lab results
  const labResults = getEntriesByType(5); // 5 = lab_result

  // Get verified entries
  const verifiedEntries = getEntriesByStatus('verified');

  // Get active (non-revoked) entries
  const activeEntries = getNonRevokedEntries();

  return (
    <div>
      {/* Render entries */}
    </div>
  );
}
```

### Fetching Specific Entry

```javascript
import { useTimelineEntry } from './hooks';

function EntryDetail({ whitelistId, patientAddress, timestampMs }) {
  const { data: entry, loading, error } = useTimelineEntry(
    whitelistId,
    patientAddress,
    timestampMs
  );

  if (loading) return <div>Loading entry...</div>;
  if (error) return <div>Entry not found</div>;

  return (
    <div>
      <h3>{entry.visitDate} - {entry.entryTypeName}</h3>
      <p>Provider: {entry.providerSpecialty}</p>
      <p>Status: {entry.status}</p>
    </div>
  );
}
```

## API Reference

### `useSealWhitelistDynamicFields(objectId, patientRef, options)`

Fetches all dynamic fields from a SealWhitelist object.

**Parameters:**
- `objectId` (string): SealWhitelist object ID
- `patientRef` (string): Patient reference (address or custom ref)
- `options` (Object, optional):
  - `autoFetch` (boolean): Auto-fetch on mount (default: true)
  - `network` (string): 'mainnet' or 'testnet' (default: 'testnet')
  - `includeRawData` (boolean): Include raw GraphQL response (default: false)

**Returns:**
```javascript
{
  // Data
  data: Object,
  sealWhitelist: Object,
  timelineEntries: Array<TimelineEntry>,
  depositPools: Array<DepositPool>,
  otherFields: Array,

  // State
  loading: boolean,
  error: Error | null,

  // Methods
  refresh: Function,

  // Metadata
  patientRefBytes: string,
  fetchedAt: number,
}
```

### `useTimelineEntry(objectId, patientRef, timestampMs, options)`

Fetches a specific timeline entry.

**Parameters:**
- `objectId` (string): SealWhitelist object ID
- `patientRef` (string): Patient reference
- `timestampMs` (number): Entry timestamp in milliseconds
- `options` (Object, optional): Same as above

**Returns:**
```javascript
{
  data: TimelineEntry | null,
  loading: boolean,
  error: Error | null,
  refresh: Function,
}
```

### `useTimelineEntryFilter(objectId, patientRef)`

Factory hook that provides filtering methods.

**Returns:**
All properties from `useSealWhitelistDynamicFields` plus:
```javascript
{
  getEntriesByType: Function,
  getEntriesByStatus: Function,
  getEntriesInDateRange: Function,
  getNonRevokedEntries: Function,
}
```

## Data Structures

### TimelineEntry

```javascript
{
  id: string,                    // `${objectId}-${timestampMs}`
  objectId: string,              // SealWhitelist object ID
  patientRef: string,            // Patient reference
  timestampMs: number,           // Entry timestamp
  entryType: number,             // 0-6 (see ENTRY_TYPES)
  entryTypeName: string,         // Human-readable type name
  visitDate: string,             // YYYY-MM-DD format
  providerSpecialty: string,     // Provider category
  visitType: string,             // Visit category
  status: string,                // Entry status
  contentHash: string,           // SHA3-256 hash
  walrusBlobId: Array,           // Walrus storage ID
  createdAt: number,             // Creation timestamp
  revoked: boolean,              // Revocation status
}
```

### Entry Types

| Value | Name | Description |
|-------|------|-------------|
| 0 | visit_summary | General visit summary |
| 1 | procedure | Medical procedure |
| 2 | refill | Prescription refill |
| 3 | note | Medical note |
| 4 | diagnosis | Diagnosis information |
| 5 | lab_result | Lab test results |
| 6 | immunization | Immunization record |

## Configuration

### Environment Variables

Set in your `.env` file:

```env
VITE_MEDICAL_VAULT_PACKAGE_ID=0x123...
VITE_SUI_NETWORK=testnet
```

### GraphQL Endpoints

- **Testnet**: `https://graphql.testnet.sui.io/graphql`
- **Mainnet**: `https://graphql.mainnet.sui.io/graphql`

## Error Handling

```javascript
const { loading, error, refresh } = useSealWhitelistDynamicFields(id, ref);

if (error) {
  if (error.message.includes('not found')) {
    // Handle object not found
  } else if (error.message.includes('GraphQL')) {
    // Handle GraphQL errors
  }
}
```

## Performance Tips

1. **Use `autoFetch: false`** if you don't need immediate data
2. **Filter on client** using `useTimelineEntryFilter` instead of multiple API calls
3. **Cache results** using React Query or similar for complex apps
4. **Debounce refresh** calls to avoid excessive queries

## Related

- [Sui GraphQL Documentation](https://docs.sui.io/guides/developer/accessing-data/query-with-graphql)
- [Medical Vault Move Contracts](../move/medical-vault/sources/)
- [Timeline Service](../services/timeline.js)
