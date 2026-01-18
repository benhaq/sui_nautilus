# Medical Vault - Frontend API Integration Guide

## Tổng Quan Hệ Thống

Medical Vault là hệ thống quản lý hồ sơ y tế phi tập trung sử dụng:
- **Sui Blockchain**: Quản lý quyền truy cập và metadata
- **Walrus Storage**: Lưu trữ file mã hóa
- **Seal SDK**: Mã hóa/giải mã file với access control on-chain

---

## Backend API Endpoints

Base URL: `http://localhost:3000` (development)

### 1. Whitelists Management (`/whitelists`)

#### 1.1 Tạo Whitelist Mới
```typescript
POST /whitelists
Content-Type: application/json

Request Body:
{
  "owner": "0x...",           // Địa chỉ chủ sở hữu (bệnh nhân)
  "creator": "0x...",         // Người tạo (doctor/hospital) - optional
  "label": "Personal Records", // Tên whitelist
  "privateKey": "suiprivkey..." // Private key để sign transaction
}

Response:
{
  "success": true,
  "message": "Whitelist created",
  "whitelistId": "0x...",     // ID của whitelist
  "adminCapId": "0x...",      // Admin capability object
  "digest": "...",            // Transaction digest
  "explorerUrl": "https://suiscan.xyz/testnet/tx/..."
}
```

**Chức năng**: Tạo whitelist mới để quản lý hồ sơ y tế với access control 2 cấp (doctors: read/write, members: read-only)

---

#### 1.2 Thêm Doctor (Write Access)
```typescript
POST /whitelists/:id/doctors
Content-Type: application/json

Request Body:
{
  "doctor": "0x...",          // Địa chỉ doctor cần thêm
  "ownerAddress": "0x...",    // Địa chỉ chủ sở hữu whitelist
  "whitelistCapId": "0x...",  // Admin Cap ID
  "privateKey": "suiprivkey..." // Optional: Auto-execute nếu có
}

Response:
{
  "success": true,
  "message": "Doctor added successfully",
  "digest": "...",
  "explorerUrl": "..."
}
```

**Chức năng**: Thêm bác sĩ vào whitelist, cho phép upload và xem hồ sơ

---

#### 1.3 Thêm Member (Read-only Access)
```typescript
POST /whitelists/:id/members
Content-Type: application/json

Request Body:
{
  "member": "0x...",          // Địa chỉ member cần thêm
  "ownerAddress": "0x...",    // Địa chỉ chủ sở hữu
  "whitelistCapId": "0x...",  // Admin Cap ID
  "privateKey": "suiprivkey..." // Optional
}

Response:
{
  "success": true,
  "message": "Member added successfully",
  "digest": "..."
}
```

**Chức năng**: Thêm member (gia đình, người thân) chỉ có quyền xem hồ sơ

---

#### 1.4 Xóa Doctor
```typescript
DELETE /whitelists/:id/doctors
Content-Type: application/json

Request Body:
{
  "doctor": "0x...",
  "ownerAddress": "0x...",
  "whitelistCapId": "0x...",
  "privateKey": "suiprivkey..."
}
```

---

#### 1.5 Xóa Member
```typescript
DELETE /whitelists/:id/members
Content-Type: application/json

Request Body:
{
  "member": "0x...",
  "ownerAddress": "0x...",
  "whitelistCapId": "0x...",
  "privateKey": "suiprivkey..."
}
```

---

#### 1.6 Lấy Whitelists Từ On-chain (Query Real-time)
```typescript
GET /whitelists/user/:address/chain

Response:
{
  "success": true,
  "count": 2,
  "whitelists": [
    {
      "whitelistId": "0x...",
      "name": "Personal Records",
      "owner": "0x...",
      "role": 0,              // 0=owner, 1=doctor, 2=member, 255=no access
      "roleName": "owner",
      "hasRead": true,
      "hasWrite": true,
      "permissions": {
        "canRead": true,
        "canWrite": true,
        "canManage": true
      },
      "doctors": ["0x..."],
      "members": ["0x..."],
      "recordCount": 5,
      "createdAt": "1705190400000"
    }
  ]
}
```

**Chức năng**: 
- Query trực tiếp từ `WhitelistRegistry` on-chain
- Trả về danh sách whitelist IDs từ registry
- Fetch chi tiết từng whitelist và access info
- Real-time data, không cache

**Cách hoạt động với Nested Table Structure**:
1. Backend query `DynamicFields` của registry (outer Table)
2. Tìm user's nested table từ outer Table
3. Query `DynamicFields` của nested table để lấy whitelist IDs
4. Batch fetch details từng whitelist object
5. Tính toán role và permissions cho user
6. Trả về merged data với full access info

**Nested Table Structure**:
```move
Table<address, Table<ID, bool>>
// Outer Table: user address -> inner Table
// Inner Table: whitelist ID -> access flag (bool)
```

**Performance**:
- **O(1) access check** qua nested Table
- Efficient lookup không cần iteration
- Query DynamicFields để list whitelists
- Batch requests giảm latency

---

#### 1.7 Kiểm Tra Access Của User (Chi Tiết)
```typescript
GET /whitelists/:id/access/:address

Response:
{
  "success": true,
  "whitelistId": "0x...",
  "address": "0x...",
  "role": 1,
  "roleName": "doctor",
  "hasRead": true,
  "hasWrite": true,
  "permissions": {
    "canRead": true,
    "canWrite": true,
    "canManage": false
  },
  "hasAccess": true
}
```

**Chức năng**: Fetch full whitelist object và calculate role/permissions

---

#### 1.8 Check Access Nhanh (O(1) Lookup)
```typescript
GET /whitelists/:id/check-access/:address

Response:
{
  "success": true,
  "whitelistId": "0x...",
  "address": "0x...",
  "hasAccess": true
}
```

**Chức năng**: 
- **Fast access check** sử dụng nested Table
- **O(1) lookup** không cần fetch full whitelist
- Ideal cho access control guards
- Gọi contract function `user_has_whitelist_access()`

**So sánh với 1.7**:
- `1.7`: Full details (role, permissions) - fetch whitelist object
- `1.8`: Quick boolean check - chỉ query registry Table
- Use `1.8` cho guards/middleware
- Use `1.7` khi cần role info

**Chức năng**: 
- Query on-chain whitelist object
- Check user role (owner/doctor/member)
- Calculate read/write/manage permissions
- Verify access trước khi perform actions

**Use cases**:
- Check quyền trước khi upload record
- Validate access trước khi download
- Display UI based on permissions
- Authorization checks

---

### 2. Records Management (`/records`)

#### 2.1 Upload Medical Record

**Option 1: With Private Key (Server-side execution)**
```typescript
POST /records/upload
Content-Type: multipart/form-data

Request Body (FormData):
{
  "whitelistId": "0x...",     // Whitelist ID
  "adminCapId": "0x...",      // Admin Cap ID
  "uploader": "0x...",        // Địa chỉ người upload
  "docTypes": "2,3",          // Document types (comma-separated)
                              // 0=Lab Result, 1=Imaging, 2=Doctor Notes, 
                              // 3=Prescription, 4=Other
  "privateKey": "suiprivkey...",  // Private key - backend tự execute
  "files": [File, File, ...]  // Files to upload (max 10 files, 100MB each)
}

Response:
{
  "success": true,
  "message": "Record uploaded successfully",
  "recordId": "0x...",        // On-chain record ID
  "walrusCids": ["blob_id_1", "blob_id_2"],
  "sealedKeyRefs": ["key_ref_1", "key_ref_2"],
  "digest": "...",
  "explorerUrl": "https://suiscan.xyz/testnet/tx/..."
}
```

**Option 2: Wallet Signing (Recommended for production)**
```typescript
POST /records/upload
Content-Type: multipart/form-data

Request Body (FormData):
{
  "whitelistId": "0x...",
  "adminCapId": "0x...",
  "uploader": "0x...",
  "docTypes": "2,3",
  // KHÔNG gửi privateKey
  "files": [File, File, ...]
}

Response:
{
  "success": true,
  "message": "Files encrypted and uploaded. Please sign transaction.",
  "pendingRecordId": "record-uuid-...",
  "filesUploaded": 2,
  "walrusCids": ["blob_id_1", "blob_id_2"],
  "sealedKeyRefs": ["key_ref_1", "key_ref_2"],
  "transactionBlockBytes": "...",  // Base64 encoded transaction
  "uploadData": {                   // Dữ liệu để confirm sau
    "recordId": "record-uuid-...",
    "whitelistId": "0x...",
    "adminCapId": "0x...",
    "uploader": "0x...",
    "walrusCids": [...],
    "sealedKeyRefs": [...],
    "docTypes": [2, 3],
    "originalFileNames": ["file1.pdf", "file2.jpg"],
    "filesCount": 2
  }
}
```

**Chức năng**: 
1. Mã hóa files với Seal SDK (backend)
2. Upload encrypted files lên Walrus
3. Nếu có privateKey: Execute transaction và lưu vào DB
4. Nếu không có privateKey: Return transaction bytes để wallet sign

---

#### 2.2 Confirm Upload (After Wallet Signing)
```typescript
POST /records/confirm
Content-Type: application/json

Request Body:
{
  "recordId": "record-uuid-...",
  "digest": "transaction_digest",
  "uploadData": {
    "whitelistId": "0x...",
    "adminCapId": "0x...",
    "uploader": "0x...",
    "walrusCids": ["blob_id_1", "blob_id_2"],
    "sealedKeyRefs": ["key_ref_1", "key_ref_2"],
    "docTypes": [2, 3],
    "originalFileNames": ["file1.pdf", "file2.jpg"],
    "filesCount": 2
  }
}

Response:
{
  "success": true,
  "message": "Record confirmed and saved to database",
  "recordId": "0x...",  // On-chain record ID
  "digest": "...",
  "explorerUrl": "https://suiscan.xyz/testnet/tx/..."
}
```

**Chức năng**: 
- Gọi sau khi wallet sign và execute transaction
- Verify record tồn tại on-chain
- Lưu metadata vào database
- Log action

---

#### 2.3 Lấy Chi Tiết Record
```typescript
GET /records/:id

Response:
{
  "success": true,
  "record": {
    "recordId": "0x...",
    "whitelistId": "0x...",
    "uploader": "0x...",
    "walrusCids": ["blob_id_1"],
    "sealedKeyRefs": ["key_ref_1"],
    "docTypes": [2, 3],
    "timestamp": "2024-01-13T...",
    "revoked": false
  }
}
```

---

#### 2.4 Lấy Tất Cả Records Trong Whitelist
```typescript
GET /records/whitelist/:whitelistId

Response:
{
  "success": true,
  "count": 5,
  "records": [
    {
      "recordId": "0x...",
      "whitelistId": "0x...",
      "uploader": "0x...",
      "filesCount": 2,
      "docTypes": [2],
      "timestamp": "...",
      "revoked": false
    }
  ]
}
```

---

#### 2.5 Download và Decrypt File
```typescript
POST /records/:id/download
Content-Type: application/json

Request Body:
{
  "requesterAddress": "0x...", // Địa chỉ người yêu cầu
  "fileIndex": 0,              // Index của file trong record (0-based)
  "privateKey": "suiprivkey..." // Private key để tạo SessionKey
}

Response: Binary file data (decrypted)
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="medical_record_0.bin"
```

**Chức năng**:
1. Kiểm tra quyền truy cập on-chain
2. Download encrypted file từ Walrus
3. Tạo Seal SessionKey với signature
4. Decrypt file với Seal SDK
5. Trả về file đã decrypt

---

### 3. Logs & History (`/log`)

#### 3.1 Lấy Actions Theo Address
```typescript
GET /log/address/:address

Response:
{
  "success": true,
  "address": "0x...",
  "count": 10,
  "actions": [
    {
      "address": "0x...",
      "actionType": "CREATE_WHITELIST",
      "whitelistId": "0x...",
      "digest": "...",
      "success": true,
      "createdAt": "..."
    }
  ]
}
```

**Action Types**: 
- `CREATE_WHITELIST`
- `ADD_DOCTOR`
- `ADD_MEMBER`
- `REMOVE_DOCTOR`
- `REMOVE_MEMBER`
- `UPLOAD_RECORD`
- `DOWNLOAD_RECORD`

---

#### 3.2 Lấy Actions Theo Whitelist
```typescript
GET /log/whitelist/:whitelistId
```

---

#### 3.3 Lấy Actions Theo Type
```typescript
GET /log/type/:actionType
```

---

#### 3.4 Lấy Tất Cả Actions
```typescript
GET /log?page=1&limit=50
```

---

#### 3.5 Lấy Actions Giữa 2 Users
```typescript
GET /log/relationship/:address/:targetAddress

Response: Actions liên quan đến 2 users (add/remove permissions, etc.)
```

---

#### 3.6 Lấy Whitelists Theo Owner (Từ Database)
```typescript
GET /log/whitelists/owner/:owner
```

**Note**: API này query từ database để lấy audit logs. Để lấy data real-time, sử dụng `GET /whitelists/user/:address/chain`

---

#### 3.7 Lấy Whitelists Theo Doctor (Từ Database)
```typescript
GET /log/whitelists/doctor/:doctorAddress
```

**Note**: API này query từ database để lấy audit logs. Để lấy data real-time, sử dụng `GET /whitelists/user/:address/chain`

---

#### 3.8 Lấy Whitelists Theo Member (Từ Database)
```typescript
GET /log/whitelists/member/:memberAddress
```

**Note**: API này query từ database để lấy audit logs. Để lấy data real-time, sử dụng `GET /whitelists/user/:address/chain`

---

#### 3.9 Lấy Chi Tiết Whitelist Từ Database (Audit Log)
```typescript
GET /log/whitelists/:whitelistId
```

**Note**: API này query từ database để lấy audit logs. Để lấy data on-chain real-time, sử dụng Sui client trực tiếp.

---

#### 3.10 Lấy Chi Tiết Record Từ Database (Audit Log)
```typescript
GET /log/records/:recordId
```

**Note**: API này query từ database để lấy audit logs. Để lấy data on-chain real-time, sử dụng `GET /records/:id`

---

#### 3.11 Lấy Records Theo Whitelist Từ Database (Audit Log)
```typescript
GET /log/records/whitelist/:whitelistId
```

**Note**: API này query từ database để lấy audit logs. Để lấy data on-chain real-time, sử dụng `GET /records/whitelist/:whitelistId`

---

#### 3.12 Lấy Records Theo Uploader
```typescript
GET /log/records/uploader/:uploader
```

---

## Smart Contract Functions (On-chain)

### Module: `medical_vault::seal_whitelist`

#### WhitelistRegistry Structure (Nested Table):
```move
public struct WhitelistRegistry has key {
    id: UID,
    /// Nested Table for O(1) access checks
    /// Outer Table: address -> inner Table
    /// Inner Table: ID -> bool (acts as Set)
    user_whitelists: Table<address, Table<ID, bool>>,
}
```

**Cách hoạt động**:
- Shared object, accessible globally
- **Nested Table** structure: `Table<address, Table<ID, bool>>`
- **O(1) access check** via `user_has_whitelist_access()`
- **DynamicFields**: Query via `getDynamicFields()` API
- Tự động update khi create/add/remove access
- Registry ID: `WHITELIST_REGISTRY_ID` in .env

**Migration Notes**:
- Old: `Table<address, vector<ID>>` - needed iteration
- New: `Table<address, Table<ID, bool>>` - O(1) lookup
- Use `getDynamicFields()` to list whitelists
- Use `user_has_whitelist_access()` to check access

#### Public Entry Functions:

```move
// Tạo whitelist mới - tự động add owner vào registry
public entry fun create_whitelist(
    registry: &mut WhitelistRegistry,
    name: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext
)

// Thêm doctor - tự động add vào registry
public entry fun add_doctor(
    registry: &mut WhitelistRegistry,
    whitelist: &mut SealWhitelist,
    cap: &WhitelistAdminCap,
    doctor: address,
    clock: &Clock,
    ctx: &mut TxContext
)

// Thêm member - tự động add vào registry
public entry fun add_member(
    registry: &mut WhitelistRegistry,
    whitelist: &mut SealWhitelist,
    cap: &WhitelistAdminCap,
    member: address,
    clock: &Clock,
    ctx: &mut TxContext
)

// Xóa doctor - tự động remove khỏi registry nếu không còn role khác
public entry fun remove_doctor(
    registry: &mut WhitelistRegistry,
    whitelist: &mut SealWhitelist,
    cap: &WhitelistAdminCap,
    doctor: address,
    clock: &Clock,
    _ctx: &mut TxContext
)

// Xóa member - tự động remove khỏi registry nếu không còn role khác
public entry fun remove_member(
    registry: &mut WhitelistRegistry,
    whitelist: &mut SealWhitelist,
    cap: &WhitelistAdminCap,
    member: address,
    clock: &Clock,
    _ctx: &mut TxContext
)
```

#### Public View Functions (Query từ Registry):

```move
// Lấy tất cả whitelist IDs user có access
public fun get_user_accessible_whitelists(
    registry: &WhitelistRegistry,
    user: address
): vector<ID>

// Check xem user có access vào whitelist không
public fun user_has_whitelist_access(
    registry: &WhitelistRegistry,
    user: address,
    whitelist_id: ID
): bool

// Đếm số whitelists user có access
public fun get_user_whitelist_count(
    registry: &WhitelistRegistry,
    user: address
): u64
```

#### Public View Functions (Query từ Whitelist):

```move
// Kiểm tra quyền write (doctor)
public fun can_write(
    whitelist: &SealWhitelist,
    user: address,
    clock: &Clock
): bool

// Kiểm tra quyền read (member)
public fun can_read(
    whitelist: &SealWhitelist,
    user: address,
    clock: &Clock
): bool

// Lấy role của user
public fun get_user_role(
    whitelist: &SealWhitelist,
    user: address
): u8  // 0=owner, 1=doctor, 2=member, 255=no access

// Lấy detailed access info (role, hasRead, hasWrite)
public fun get_user_whitelist_access_info(
    whitelist: &SealWhitelist,
    user: address
): (u8, bool, bool)

// Lấy full info (id, name, owner, role, read, write, record_count)
public fun get_whitelist_full_access_info(
    whitelist: &SealWhitelist,
    user: address
): (ID, String, address, u8, bool, bool, u64)

// Lấy danh sách records trong whitelist
public fun records(
    whitelist: &SealWhitelist
): &vector<ID>

// Check whitelist có record không
public fun has_record(
    whitelist: &SealWhitelist, 
    record_id: ID
): bool
```

**Query Flow trong Backend với Nested Table**:

1. **Get User Whitelists** (Updated for Table<address, Table<ID, bool>>):
```typescript
// Step 1: Query DynamicFields of outer Table
const outerFields = await client.getDynamicFields({
  parentId: REGISTRY_ID
});

// Step 2: Find user's nested table
const userTableField = outerFields.data.find(
  field => field.name?.value === userAddress
);

if (!userTableField) {
  return []; // No access
}

// Step 3: Query DynamicFields of nested Table
const nestedFields = await client.getDynamicFields({
  parentId: userTableField.objectId
});

// Step 4: Extract whitelist IDs from keys
const userWhitelistIds = nestedFields.data
  .map(field => field.name?.value)
  .filter(Boolean);

// Step 5: Batch fetch whitelist details
const whitelists = await Promise.all(
  userWhitelistIds.map(id => client.getObject(id))
);

// Step 6: Calculate access for each
const withAccess = whitelists.map(wl => ({
  ...wl,
  role: calculateRole(wl, userAddress),
  permissions: calculatePermissions(wl, userAddress)
}));
```

2. **Check Access (O(1) with DevInspect)**:
```typescript
// Use contract function for O(1) check
const tx = new TransactionBlock();
tx.moveCall({
  target: `${PACKAGE_ID}::seal_whitelist::user_has_whitelist_access`,
  arguments: [
    tx.object(REGISTRY_ID),
    tx.pure(userAddress, 'address'),
    tx.pure(whitelistId, 'address')
  ]
});

const result = await client.devInspectTransactionBlock({
  transactionBlock: tx,
  sender: userAddress
});

// Parse boolean return value
const hasAccess = result.results[0].returnValues[0][0][0] === 1;
```

3. **Get Full Details** (when access confirmed):
```typescript
// Direct query whitelist object
const whitelist = await client.getObject(whitelistId);
const role = getRoleFromFields(whitelist.fields, userAddress);
const permissions = {
  canRead: canRead(whitelist, userAddress),
  canWrite: canWrite(whitelist, userAddress),
  canManage: role === 0
};
```

---

### Module: `medical_vault::medical_record`

#### Public Entry Functions:

```move
// Tạo medical record mới
public entry fun create_record(
    whitelist: &mut SealWhitelist,
    cap: &WhitelistAdminCap,
    record_id_bytes: vector<u8>,
    walrus_cid: vector<vector<u8>>,        // Walrus blob IDs
    sealed_key_ref: vector<vector<u8>>,    // Seal key references
    doc_type: vector<u8>,                  // Document types
    clock: &Clock,
    ctx: &mut TxContext
)

// Update record (thêm files)
public entry fun update_record(
    record: &mut Record,
    whitelist: &SealWhitelist,
    cap: &WhitelistAdminCap,
    walrus_cid: vector<vector<u8>>,
    sealed_key_ref: vector<vector<u8>>,
    doc_type: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext
)

// Thu hồi record
public entry fun revoke_record(
    record: &mut Record,
    cap: &WhitelistAdminCap,
    clock: &Clock,
    ctx: &mut TxContext
)

// Log truy cập (cho analytics)
public entry fun log_access(
    record: &Record,
    whitelist: &SealWhitelist,
    clock: &Clock,
    ctx: &mut TxContext
)
```

#### Public View Functions:

```move
// Lấy thông tin record
public fun get_record_info(
    record: &Record
): (String, ID, address, u64, bool)  
// Returns: (record_id, whitelist_id, uploader, timestamp, revoked)

// Lấy Walrus CIDs
public fun get_walrus_cids(
    record: &Record
): &vector<vector<u8>>

// Lấy Seal key references
public fun get_sealed_key_refs(
    record: &Record
): &vector<vector<u8>>

// Kiểm tra có thể truy cập record
public fun can_access_record(
    record: &Record,
    whitelist: &SealWhitelist,
    user: address,
    clock: &Clock
): bool
```

---

## Flow Tích Hợp Frontend

### 1. Đăng Nhập và Khởi Tạo
```typescript
// Connect wallet (Sui Wallet)
import { SuiClient } from '@mysten/sui.js/client';
import { useWalletKit } from '@mysten/wallet-kit';

const { currentAccount } = useWalletKit();
const address = currentAccount?.address;

// Khởi tạo Sui client
const client = new SuiClient({ 
  url: 'https://fullnode.testnet.sui.io:443' 
});
```

---

### 1.5 Query User Whitelists (On-chain)
```typescript
// Option 1: Từ Backend API (Recommended)
const getUserWhitelists = async (userAddress: string) => {
  const response = await fetch(
    `${API_URL}/whitelists/user/${userAddress}/chain`
  );
  const data = await response.json();
  
  return {
    whitelists: data.whitelists,
    count: data.count
  };
};

// Option 2: Direct Query với Sui Client (Nested Table Structure)
import { SuiClient } from '@mysten/sui.js/client';

const queryUserWhitelistsDirect = async (
  userAddress: string,
  registryId: string
) => {
  const client = new SuiClient({ 
    url: 'https://fullnode.testnet.sui.io:443' 
  });
  
  // Step 1: Query DynamicFields of outer Table<address, Table<ID, bool>>
  const outerTableFields = await client.getDynamicFields({
    parentId: registryId
  });
  
  // Step 2: Find user's nested table
  const userTableField = outerTableFields.data.find(
    field => field.name?.value === userAddress
  );
  
  if (!userTableField?.objectId) {
    return []; // User has no whitelists
  }
  
  // Step 3: Query DynamicFields of nested Table<ID, bool>
  const nestedTableFields = await client.getDynamicFields({
    parentId: userTableField.objectId
  });
  
  // Step 4: Extract whitelist IDs from nested table keys
  const userWhitelistIds = nestedTableFields.data
    .map(field => field.name?.value as string)
    .filter(id => id);
  
  // Step 5: Batch fetch whitelist details
  const whitelists = await Promise.all(
    userWhitelistIds.map(async (id) => {
      const wl = await client.getObject({
        id,
        options: { showContent: true }
      });
      
      const wlFields = (wl.data.content as any).fields;
      
      // Calculate role and permissions
      const role = calculateUserRole(wlFields, userAddress);
      
      return {
        whitelistId: id,
        name: wlFields.name,
        owner: wlFields.owner,
        role,
        roleName: getRoleName(role),
        hasRead: role !== 255,
        hasWrite: role === 0 || role === 1,
        doctors: wlFields.doctors || [],
        members: wlFields.members || [],
        recordCount: wlFields.records?.length || 0,
        createdAt: wlFields.created_at
      };
    })
  );
  
  return {
    whitelists,
    count: whitelists.length
  };
};

// Helper functions
const calculateUserRole = (whitelistFields: any, userAddress: string): number => {
  if (whitelistFields.owner === userAddress) return 0;
  if (whitelistFields.doctors?.includes(userAddress)) return 1;
  if (whitelistFields.members?.includes(userAddress)) return 2;
  return 255;
};

const getRoleName = (role: number): string => {
  switch (role) {
    case 0: return 'owner';
    case 1: return 'doctor';
    case 2: return 'member';
    default: return 'none';
  }
};

// Usage in component
const WhitelistList = () => {
  const { currentAccount } = useWalletKit();
  const [whitelists, setWhitelists] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchWhitelists = async () => {
      if (!currentAccount?.address) return;
      
      setLoading(true);
      try {
        const data = await getUserWhitelists(currentAccount.address);
        setWhitelists(data.whitelists);
      } catch (error) {
        console.error('Failed to fetch whitelists:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWhitelists();
  }, [currentAccount?.address]);
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div>
      <h2>My Whitelists ({whitelists.length})</h2>
      {whitelists.map(wl => (
        <WhitelistCard 
          key={wl.whitelistId} 
          whitelist={wl}
          canManage={wl.role === 0}
          canWrite={wl.hasWrite}
        />
      ))}
    </div>
  );
};
```

---

### 2. Tạo Whitelist Mới (Bệnh Nhân)
```typescript
const createWhitelist = async (label: string) => {
  const response = await fetch(`${API_URL}/whitelists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner: address,
      label: label,
      privateKey: privateKey // Hoặc sign transaction ở frontend
    })
  });
  
  const data = await response.json();
  // Lưu whitelistId và adminCapId
  return data;
};
```

---

### 3. Thêm Bác Sĩ Vào Whitelist
```typescript
const addDoctor = async (whitelistId: string, doctorAddress: string) => {
  const response = await fetch(`${API_URL}/whitelists/${whitelistId}/doctors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctor: doctorAddress,
      ownerAddress: address,
      whitelistCapId: adminCapId,
      privateKey: privateKey
    })
  });
  
  return await response.json();
};
```

---

### 4. Upload Hồ Sơ Y Tế (Bác Sĩ)

**Option A: Với Wallet Signing (Recommended)**
```typescript
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { useWalletKit } from '@mysten/wallet-kit';

const uploadMedicalRecordWithWallet = async (
  whitelistId: string,
  files: File[],
  docTypes: number[]
) => {
  const { currentAccount, signAndExecuteTransactionBlock } = useWalletKit();
  
  // Step 1: Upload files (backend encrypts and uploads to Walrus)
  const formData = new FormData();
  formData.append('whitelistId', whitelistId);
  formData.append('adminCapId', adminCapId);
  formData.append('uploader', currentAccount.address);
  formData.append('docTypes', docTypes.join(','));
  // KHÔNG gửi privateKey
  
  files.forEach(file => formData.append('files', file));
  
  const uploadResponse = await fetch(`${API_URL}/records/upload`, {
    method: 'POST',
    body: formData
  });
  
  const uploadData = await uploadResponse.json();
  
  if (!uploadData.success) {
    throw new Error(uploadData.error);
  }
  
  // Step 2: Sign and execute transaction with wallet
  const txBlock = TransactionBlock.from(uploadData.transactionBlockBytes);
  const result = await signAndExecuteTransactionBlock({
    transactionBlock: txBlock,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });
  
  // Step 3: Confirm upload to save in database
  const confirmResponse = await fetch(`${API_URL}/records/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recordId: uploadData.pendingRecordId,
      digest: result.digest,
      uploadData: uploadData.uploadData
    })
  });
  
  const confirmData = await confirmResponse.json();
  
  return {
    success: true,
    recordId: confirmData.recordId,
    digest: result.digest,
    explorerUrl: confirmData.explorerUrl
  };
};
```

**Option B: Với Private Key (Development only)**
```typescript
const uploadMedicalRecord = async (
  whitelistId: string, 
  files: File[], 
  docTypes: number[]
) => {
  const formData = new FormData();
  formData.append('whitelistId', whitelistId);
  formData.append('adminCapId', adminCapId);
  formData.append('uploader', address);
  formData.append('docTypes', docTypes.join(','));
  formData.append('privateKey', privateKey);  // Backend tự execute
  
  files.forEach(file => {
    formData.append('files', file);
  });
  
  const response = await fetch(`${API_URL}/records/upload`, {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
};
```

---

### 5. Xem Danh Sách Hồ Sơ
```typescript
const getRecords = async (whitelistId: string) => {
  const response = await fetch(`${API_URL}/records/whitelist/${whitelistId}`);
  const data = await response.json();
  return data.records;
};
```

---

### 6. Download và Xem File
```typescript
const downloadRecord = async (
  recordId: string, 
  fileIndex: number
) => {
  const response = await fetch(`${API_URL}/records/${recordId}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requesterAddress: address,
      fileIndex: fileIndex,
      privateKey: privateKey
    })
  });
  
  if (response.ok) {
    const blob = await response.blob();
    // Download hoặc preview file
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical_record_${fileIndex}.bin`;
    a.click();
  }
};
```

---

### 7. Kiểm Tra Quyền Truy Cập
```typescript
// Option 1: Via Backend API
const checkAccess = async (whitelistId: string) => {
  const response = await fetch(
    `${API_URL}/whitelists/${whitelistId}/access/${address}`
  );
  const data = await response.json();
  
  return {
    canRead: data.hasRead,
    canWrite: data.hasWrite,
    canManage: data.permissions.canManage,
    role: data.roleName
  };
};

// Option 2: Direct query whitelist object
const checkAccessDirect = async (
  whitelistId: string, 
  userAddress: string
) => {
  const client = new SuiClient({ 
    url: 'https://fullnode.testnet.sui.io:443' 
  });
  
  const whitelist = await client.getObject({
    id: whitelistId,
    options: { showContent: true }
  });
  
  const fields = (whitelist.data.content as any).fields;
  const role = calculateUserRole(fields, userAddress);
  
  return {
    canRead: role !== 255,
    canWrite: role === 0 || role === 1,
    canManage: role === 0,
    role: getRoleName(role)
  };
};

// Usage: Guard upload button
const UploadButton = ({ whitelistId }) => {
  const { currentAccount } = useWalletKit();
  const [access, setAccess] = useState(null);
  
  useEffect(() => {
    const loadAccess = async () => {
      const result = await checkAccess(whitelistId);
      setAccess(result);
    };
    loadAccess();
  }, [whitelistId, currentAccount]);
  
  if (!access?.canWrite) {
    return <p>You don't have permission to upload</p>;
  }
  
  return <button onClick={handleUpload}>Upload Record</button>;
};
```

---

### 8. Lấy Lịch Sử Actions
```typescript
const getUserHistory = async () => {
  const response = await fetch(`${API_URL}/log/address/${address}`);
  const data = await response.json();
  return data.actions;
};
```

---

### 9. Lấy Tất Cả Records Mà User Có Thể Truy Cập

#### Query Từ On-chain Whitelists
```typescript
const getAllAccessibleRecords = async (userAddress: string) => {
  // Bước 1: Lấy tất cả whitelists user có quyền truy cập (from on-chain)
  const whitelistsResponse = await fetch(
    `${API_URL}/whitelists/user/${userAddress}/chain`
  );
  const { whitelists } = await whitelistsResponse.json();
  
  // Bước 2: Lấy records từ mỗi whitelist
  const allRecords = await Promise.all(
    whitelists.map(async (whitelist) => {
      const recordsResponse = await fetch(
        `${API_URL}/records/whitelist/${whitelist.whitelistId}`
      );
      const recordsData = await recordsResponse.json();
      
      return {
        whitelist: {
          id: whitelist.whitelistId,
          name: whitelist.name,
          role: whitelist.roleName,
          permissions: whitelist.permissions
        },
        records: recordsData.records || []
      };
    })
  );
  
  // Bước 3: Flatten và format data
  const flatRecords = allRecords.flatMap(item => 
    item.records.map(record => ({
      ...record,
      whitelistName: item.whitelist.name,
      userRole: item.whitelist.role,
      permissions: item.whitelist.permissions
    }))
  );
  
  return {
    totalWhitelists: whitelists.length,
    totalRecords: flatRecords.length,
    recordsByFolder: allRecords,
    allRecords: flatRecords
  };
};

// Sử dụng:
const data = await getAllAccessibleRecords(address);
console.log(`User có thể truy cập ${data.totalRecords} records`);
```

#### Optimize với Batch Request
```typescript
const getAllRecordsOptimized = async (userAddress: string) => {
  // Step 1: Lấy whitelists từ on-chain
  const whitelistsRes = await fetch(
    `${API_URL}/whitelists/user/${userAddress}/chain`
  );
  const { whitelists } = await whitelistsRes.json();
  
  if (whitelists.length === 0) {
    return { records: [], whitelists: [] };
  }
  
  // Step 2: Batch fetch tất cả records
  const recordsPromises = whitelists.map(w =>
    fetch(`${API_URL}/records/whitelist/${w.whitelistId}`).then(r => r.json())
  );
  const allRecordsData = await Promise.all(recordsPromises);
  
  // Step 3: Combine data
  const combined = whitelists.map((whitelist, index) => ({
    whitelist,
    records: allRecordsData[index].records || []
  }));
  
  // Step 4: Flatten và add metadata
  const allRecords = combined.flatMap(item => 
    item.records.map(record => ({
      ...record,
      whitelistId: item.whitelist.whitelistId,
      whitelistName: item.whitelist.name,
      userRole: item.whitelist.roleName,
      canWrite: item.whitelist.hasWrite,
      canRead: item.whitelist.hasRead
    }))
  );
  
  return {
    whitelists: combined,
    allRecords,
    summary: {
      totalWhitelists: whitelists.length,
      totalRecords: allRecords.length,
      byRole: {
        owner: whitelists.filter(w => w.role === 0).length,
        doctor: whitelists.filter(w => w.role === 1).length,
        member: whitelists.filter(w => w.role === 2).length
      }
    }
  };
};
```

#### React Hook Example
```typescript
import { useState, useEffect } from 'react';

const useAccessibleRecords = (userAddress: string) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const refresh = async () => {
    if (!userAddress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getAllRecordsOptimized(userAddress);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    refresh();
  }, [userAddress]);
  
  return { 
    records: data?.allRecords || [], 
    whitelists: data?.whitelists || [],
    summary: data?.summary,
    loading, 
    error,
    refresh 
  };
};

// Usage in component
const RecordsList = () => {
  const { currentAccount } = useWalletKit();
  const { records, summary, loading, refresh } = useAccessibleRecords(
    currentAccount?.address
  );
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div>
      <h2>My Medical Records</h2>
      <div>
        <p>Total: {summary?.totalRecords} records</p>
        <p>Whitelists: {summary?.totalWhitelists}</p>
        <button onClick={refresh}>Refresh</button>
      </div>
      
      {records.map(record => (
        <RecordCard 
          key={record.recordId} 
          record={record}
          canEdit={record.canWrite}
        />
      ))}
    </div>
  );
};
```

#### Filter và Search
```typescript
const filterRecords = (records: any[], filters: {
  docType?: number[];
  dateFrom?: Date;
  dateTo?: Date;
  whitelistId?: string;
  searchTerm?: string;
}) => {
  return records.filter(record => {
    if (filters.docType && !filters.docType.some(t => record.docTypes.includes(t))) {
      return false;
    }
    
    if (filters.dateFrom && new Date(record.timestamp) < filters.dateFrom) {
      return false;
    }
    
    if (filters.dateTo && new Date(record.timestamp) > filters.dateTo) {
      return false;
    }
    
    if (filters.whitelistId && record.whitelistId !== filters.whitelistId) {
      return false;
    }
    
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      return (
        record.recordId.toLowerCase().includes(term) ||
        record.whitelistLabel?.toLowerCase().includes(term)
      );
    }
    
    return true;
  });
};
```

#### Response Format
```typescript
{
  whitelists: [
    {
      whitelist: {
        whitelistId: "0x...",
        name: "Personal Records",
        role: 0,
        roleName: "owner",
        hasRead: true,
        hasWrite: true
      },
      records: [...]
    }
  ],
  allRecords: [
    {
      recordId: "0x...",
      whitelistId: "0x...",
      whitelistName: "Personal Records",
      userRole: "owner",
      canWrite: true,
      canRead: true,
      uploader: "0x...",
      filesCount: 2,
      docTypes: [2, 3],
      timestamp: "2024-01-13T...",
      revoked: false
    }
  ],
  summary: {
    totalWhitelists: 3,
    totalRecords: 15,
    byRole: {
      owner: 1,
      doctor: 1,
      member: 1
    }
  }
}
```

**Note**: Tất cả data được query trực tiếp từ blockchain, đảm bảo real-time và không bị stale.

---

## Environment Variables

### Frontend (.env)
```bash
VITE_SUI_NETWORK=testnet
VITE_PACKAGE_ID=0x...
VITE_WHITELIST_REGISTRY=0x...
VITE_API_URL=http://localhost:3000
```

### Backend (.env)
```bash
SUI_NETWORK=testnet
SUI_PACKAGE_ID=0x...
SUI_WHITELIST_REGISTRY=0x...
SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Walrus
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space

# Seal
SEAL_PACKAGE_ID=0x...

# Database
MONGODB_URI=mongodb://localhost:27017/medical_vault
```

---

## Error Handling

### Common Error Codes:
- `400`: Bad Request - Thiếu parameters hoặc invalid input
- `401`: Unauthorized - Không có quyền truy cập
- `404`: Not Found - Resource không tồn tại
- `500`: Internal Server Error - Lỗi server

### Error Response Format:
```typescript
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

---

## Best Practices

### Query Optimization
1. **Cache Registry ID**: Lưu `WHITELIST_REGISTRY_ID` trong constants
2. **Batch Queries**: Fetch multiple whitelists cùng lúc thay vì tuần tự
3. **Parallel Requests**: Combine whitelist list + details queries
4. **Debounce Refresh**: Tránh query quá nhiều khi user navigation

### Access Control
1. **Always Check Permissions**: Query access trước khi show UI actions
2. **Client-side Validation**: Disable buttons based on permissions
3. **Server-side Enforcement**: Backend cũng phải validate access
4. **Role-based Rendering**: Show different UI for owner/doctor/member

### State Management
1. **Cache whitelistId và adminCapId** sau khi tạo
2. **Refresh after mutations**: Re-fetch sau add/remove operations
3. **Optimistic updates**: Update UI trước, rollback nếu fail
4. **Polling strategy**: Auto-refresh every 30s cho critical data

### Error Handling
1. **Handle Registry Errors**: Registry có thể chưa được init
2. **Empty States**: User có thể chưa có whitelist nào
3. **Access Denied**: Clear messaging khi user không có quyền
4. **Network Failures**: Retry với exponential backoff

### Performance Tips
1. **Lazy Load Details**: Chỉ fetch full details khi cần
2. **Pagination**: Limit whitelists hiển thị (10-20 per page)
3. **Virtual Scrolling**: Cho lists dài
4. **Memoization**: Cache computed values (permissions, etc.)

### Code Examples

#### Custom Hook với Caching
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';

const useUserWhitelists = (userAddress: string) => {
  return useQuery({
    queryKey: ['whitelists', userAddress],
    queryFn: () => getUserWhitelists(userAddress),
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
    enabled: !!userAddress,
    refetchOnWindowFocus: true,
  });
};

// Usage
const MyComponent = () => {
  const { currentAccount } = useWalletKit();
  const { data, isLoading, error, refetch } = useUserWhitelists(
    currentAccount?.address
  );
  
  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;
  
  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>
      {data?.whitelists.map(wl => (
        <WhitelistCard key={wl.whitelistId} whitelist={wl} />
      ))}
    </div>
  );
};
```

#### Permission Guard Component
```typescript
const PermissionGuard = ({ 
  whitelistId, 
  requiredPermission,
  children 
}) => {
  const { currentAccount } = useWalletKit();
  const { data: access } = useQuery({
    queryKey: ['access', whitelistId, currentAccount?.address],
    queryFn: () => checkAccess(whitelistId),
    enabled: !!whitelistId && !!currentAccount?.address,
  });
  
  if (!access) return <Loading />;
  
  const hasPermission = 
    requiredPermission === 'read' ? access.canRead :
    requiredPermission === 'write' ? access.canWrite :
    requiredPermission === 'manage' ? access.canManage :
    false;
  
  if (!hasPermission) {
    return <AccessDenied permission={requiredPermission} />;
  }
  
  return <>{children}</>;
};

// Usage
<PermissionGuard whitelistId={id} requiredPermission="write">
  <UploadRecordButton />
</PermissionGuard>
```

### Architecture Recommendations

**Frontend Structure**:
```
src/
  hooks/
    useUserWhitelists.ts       // Query user whitelists
    useWhitelistAccess.ts      // Check access permissions
    useWhitelistDetails.ts     // Get single whitelist
  services/
    whitelistService.ts        // API calls
    suiQueryService.ts         // Direct Sui queries
  components/
    WhitelistList.tsx          // List with loading/error
    WhitelistCard.tsx          // Single whitelist card
    PermissionGuard.tsx        // Access control wrapper
  utils/
    roleCalculator.ts          // Calculate role/permissions
    constants.ts               // REGISTRY_ID, etc.
```

**Recommended Libraries**:
- `@tanstack/react-query` - Data fetching & caching
- `@mysten/sui.js` - Sui client
- `@mysten/dapp-kit` - Wallet integration
- `zustand` or `jotai` - Global state (optional)

---

## Environment Variables

### Frontend (.env)
```bash
VITE_SUI_NETWORK=testnet
VITE_PACKAGE_ID=0xc4f956117f2ea91392c8a5af2a2ba53d00afdac00801e2df7f77a0f16705dd62
VITE_WHITELIST_REGISTRY=0x5a8347fa5f2d9065c0e28326b73db549d4e190bcf60f01fbd3e2026f87ddf168
VITE_API_URL=http://localhost:3000
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
```

### Backend (.env)
```bash
SUI_NETWORK=testnet
MEDICAL_VAULT_PACKAGE_ID=0xc4f956117f2ea91392c8a5af2a2ba53d00afdac00801e2df7f77a0f16705dd62
WHITELIST_REGISTRY_ID=0x5a8347fa5f2d9065c0e28326b73db549d4e190bcf60f01fbd3e2026f87ddf168
SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Walrus
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space

# Seal
SEAL_PACKAGE_ID=0x...

# Database
MONGODB_URI=mongodb://localhost:27017/medical_vault

# Optional: Hospital private key (for server-side signing)
HOSPITAL_PRIVATE_KEY=suiprivkey...
```

**Important**: 
- `WHITELIST_REGISTRY_ID` được tạo khi deploy contract (init function)
- `MEDICAL_VAULT_PACKAGE_ID` là PackageID sau khi publish contract
- Registry là shared object, accessible globally
- Cần restart backend sau khi update .env

### 1. Danh Sách API Endpoints Cần Private Key

Các endpoints này có thể hoạt động theo 2 mode:
- **Server-side execution**: Gửi `privateKey` để backend tự động execute
- **Client-side signing**: Không gửi `privateKey`, nhận transaction bytes về để wallet ký

#### Whitelist Management:

| Endpoint | Method | Cần Private Key | Alternative |
|----------|--------|-----------------|-------------|
| `POST /whitelists` | Tạo whitelist | ✅ Optional | Return txBytes |
| `POST /whitelists/:id/doctors` | Thêm doctor | ✅ Optional | Return txBytes |
| `POST /whitelists/:id/members` | Thêm member | ✅ Optional | Return txBytes |
| `DELETE /whitelists/:id/doctors` | Xóa doctor | ✅ Optional | Return txBytes |
| `DELETE /whitelists/:id/members` | Xóa member | ✅ Optional | Return txBytes |

#### Records Management:

| Endpoint | Method | Cần Private Key | Alternative |
|----------|--------|-----------------|-------------|
| `POST /records/upload` | Upload record | ✅ Optional | Return txBytes + uploadData |
| `POST /records/confirm` | Confirm upload | ❌ No | Called after wallet signing |
| `POST /records/:id/download` | Download file | ✅ Required | N/A (cần Seal SessionKey) |

---

### 2. Frontend Integration Với Sui Wallet

#### Option 1: Sign Transaction Ở Frontend (Recommended)

```typescript
import { useWalletKit } from '@mysten/wallet-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';

const WhitelistManager = () => {
  const { currentAccount, signAndExecuteTransactionBlock } = useWalletKit();

  // Tạo whitelist với wallet signing
  const createWhitelistWithWallet = async (label: string) => {
    // Step 1: Gọi API KHÔNG gửi privateKey
    const response = await fetch(`${API_URL}/whitelists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: currentAccount.address,
        label: label,
        // KHÔNG gửi privateKey
      })
    });
    
    const data = await response.json();
    
    // Step 2: Nhận transaction bytes từ backend
    if (data.transactionBlockBytes) {
      // Step 3: Wallet ký và execute
      const result = await signAndExecuteTransactionBlock({
        transactionBlock: TransactionBlock.from(data.transactionBlockBytes),
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });
      
      return {
        success: true,
        digest: result.digest,
        whitelistId: extractWhitelistId(result.objectChanges),
      };
    }
    
    // Nếu backend đã execute (có privateKey), return kết quả
    return data;
  };

  // Thêm doctor với wallet signing
  const addDoctorWithWallet = async (
    whitelistId: string,
    doctorAddress: string,
    adminCapId: string
  ) => {
    const response = await fetch(`${API_URL}/whitelists/${whitelistId}/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctor: doctorAddress,
        ownerAddress: currentAccount.address,
        whitelistCapId: adminCapId,
        // KHÔNG gửi privateKey
      })
    });
    
    const data = await response.json();
    
    if (data.transactionBlockBytes) {
      const result = await signAndExecuteTransactionBlock({
        transactionBlock: TransactionBlock.from(data.transactionBlockBytes),
      });
      
      return {
        success: true,
        digest: result.digest,
      };
    }
    
    return data;
  };

  return (
    <div>
      <button onClick={() => createWhitelistWithWallet('My Records')}>
        Create Whitelist (Wallet Sign)
      </button>
    </div>
  );
};
```

#### Helper Function: Extract Object IDs
```typescript
const extractWhitelistId = (objectChanges: any[]) => {
  const created = objectChanges.find(
    change => change.type === 'created' && 
    change.objectType.includes('SealWhitelist')
  );
  return created?.objectId;
};

const extractAdminCapId = (objectChanges: any[]) => {
  const created = objectChanges.find(
    change => change.type === 'created' && 
    change.objectType.includes('WhitelistAdminCap')
  );
  return created?.objectId;
};
```

---

#### Option 2: Server-Side Execution (Backend có Private Key)

⚠️ **Chỉ dùng cho testing/development**

```typescript
// Development only - KHÔNG dùng trong production
const createWhitelistServerSide = async (
  label: string,
  privateKey: string
) => {
  const response = await fetch(`${API_URL}/whitelists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner: currentAccount.address,
      label: label,
      privateKey: privateKey, // Backend sẽ tự execute
    })
  });
  
  return await response.json();
};
```

---

### 3. Special Cases: Seal Operations

Một số operations cần private key vì phải tương tác với Seal SDK:

#### Upload Record (Cần Private Key)

```typescript
// Upload cần private key để:
// 1. Sign Seal encryption key
// 2. Execute on-chain transaction

const uploadRecordSecure = async (
  whitelistId: string,
  files: File[],
  docTypes: number[]
) => {
  // Option A: Sử dụng stored encrypted key (recommended)
  const encryptedKey = localStorage.getItem('encrypted_key');
  const privateKey = await decryptPrivateKey(encryptedKey, userPassword);
  
  const formData = new FormData();
  formData.append('whitelistId', whitelistId);
  formData.append('adminCapId', adminCapId);
  formData.append('uploader', currentAccount.address);
  formData.append('docTypes', docTypes.join(','));
  formData.append('privateKey', privateKey);
  
  files.forEach(file => formData.append('files', file));
  
  const response = await fetch(`${API_URL}/records/upload`, {
    method: 'POST',
    body: formData
  });
  
  // Clear private key from memory
  privateKey = null;
  
  return await response.json();
};

// Option B: Split operations (future enhancement)
const uploadRecordSplit = async (
  whitelistId: string,
  files: File[]
) => {
  // 1. Frontend encrypts files với Seal (cần wallet signature)
  const encryptedFiles = await encryptWithSealFrontend(files);
  
  // 2. Upload encrypted files
  const formData = new FormData();
  formData.append('whitelistId', whitelistId);
  formData.append('adminCapId', adminCapId);
  encryptedFiles.forEach(f => formData.append('encryptedFiles', f));
  
  // 3. Backend chỉ upload lên Walrus và create record
  const response = await fetch(`${API_URL}/records/upload-encrypted`, {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
};
```

#### Download và Decrypt (Cần Private Key)

```typescript
// Download cần private key để tạo Seal SessionKey
const downloadRecordSecure = async (
  recordId: string,
  fileIndex: number
) => {
  // Get private key securely
  const encryptedKey = localStorage.getItem('encrypted_key');
  const privateKey = await decryptPrivateKey(encryptedKey, userPassword);
  
  const response = await fetch(`${API_URL}/records/${recordId}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requesterAddress: currentAccount.address,
      fileIndex: fileIndex,
      privateKey: privateKey
    })
  });
  
  // Clear from memory
  privateKey = null;
  
  if (response.ok) {
    const blob = await response.blob();
    return blob;
  }
  
  throw new Error('Download failed');
};
```

---

### 4. Secure Private Key Management

#### Recommended Approach: Password-Protected Storage

```typescript
import CryptoJS from 'crypto-js';

class SecureKeyManager {
  // Encrypt private key với user password
  static encryptPrivateKey(privateKey: string, password: string): string {
    return CryptoJS.AES.encrypt(privateKey, password).toString();
  }
  
  // Decrypt private key
  static decryptPrivateKey(encrypted: string, password: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, password);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
  
  // Store encrypted key
  static storeKey(encryptedKey: string): void {
    localStorage.setItem('encrypted_key', encryptedKey);
  }
  
  // Retrieve encrypted key
  static getKey(): string | null {
    return localStorage.getItem('encrypted_key');
  }
  
  // Clear key
  static clearKey(): void {
    localStorage.removeItem('encrypted_key');
  }
}

// Usage
const handleLogin = async (password: string) => {
  // User enters password
  const privateKey = await getUserPrivateKey(); // From wallet export
  
  // Encrypt and store
  const encrypted = SecureKeyManager.encryptPrivateKey(privateKey, password);
  SecureKeyManager.storeKey(encrypted);
  
  return true;
};

const handleLogout = () => {
  SecureKeyManager.clearKey();
};

// Use in upload/download
const useSecureKey = async (password: string) => {
  const encrypted = SecureKeyManager.getKey();
  if (!encrypted) throw new Error('No key stored');
  
  return SecureKeyManager.decryptPrivateKey(encrypted, password);
};
```

---

### 5. Alternative: Backend-Managed Keys (Hospital Use Case)

Cho hospitals/clinics có nhiều doctors:

```typescript
// Backend API với key management
const uploadAsHospital = async (
  whitelistId: string,
  files: File[],
  docTypes: number[]
) => {
  // Backend sử dụng hospital's stored key
  // Frontend chỉ cần authentication token
  
  const formData = new FormData();
  formData.append('whitelistId', whitelistId);
  formData.append('adminCapId', adminCapId);
  formData.append('uploader', currentAccount.address);
  formData.append('docTypes', docTypes.join(','));
  formData.append('useHospitalKey', 'true'); // Backend flag
  
  files.forEach(file => formData.append('files', file));
  
  const response = await fetch(`${API_URL}/records/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`, // JWT token
    },
    body: formData
  });
  
  return await response.json();
};
```

---

### 6. Tổng Hợp Best Practices

| Use Case | Method | Security Level | Recommended For |
|----------|--------|----------------|-----------------|
| Tạo Whitelist | Wallet Sign | 🔒🔒🔒 High | Production |
| Thêm/Xóa Members | Wallet Sign | 🔒🔒🔒 High | Production |
| Upload Record | Password-encrypted key | 🔒🔒 Medium | Personal use |
| Download Record | Password-encrypted key | 🔒🔒 Medium | Personal use |
| Hospital Operations | Backend-managed key + JWT | 🔒🔒 Medium | Enterprise |
| Testing | Direct private key | 🔒 Low | Development only |

#### Implementation Checklist:

**Frontend (Personal Users):**
- ✅ Use Sui Wallet for whitelist operations
- ✅ Store encrypted private key for Seal operations
- ✅ Clear sensitive data from memory after use
- ✅ Implement session timeout
- ✅ Never log private keys

**Frontend (Hospital/Enterprise):**
- ✅ Use JWT authentication
- ✅ Backend manages institutional keys
- ✅ Implement role-based access control
- ✅ Audit logs for all operations

**Backend:**
- ✅ Support both privateKey and txBytes modes
- ✅ Validate signatures
- ✅ Rate limiting
- ✅ Secure key storage (KMS/Vault)
- ✅ Rotate keys periodically

---

### 7. Code Example: Complete Flow

```typescript
import { useWalletKit } from '@mysten/wallet-kit';
import { useState } from 'react';

const MedicalRecordApp = () => {
  const { currentAccount, signAndExecuteTransactionBlock } = useWalletKit();
  const [password, setPassword] = useState('');
  const [whitelistId, setWhitelistId] = useState('');
  const [adminCapId, setAdminCapId] = useState('');

  // Step 1: Create whitelist (wallet sign)
  const createWhitelist = async () => {
    const response = await fetch(`${API_URL}/whitelists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: currentAccount.address,
        label: 'My Medical Records',
      })
    });
    
    const data = await response.json();
    
    if (data.transactionBlockBytes) {
      const result = await signAndExecuteTransactionBlock({
        transactionBlock: TransactionBlock.from(data.transactionBlockBytes),
      });
      
      const wlId = extractWhitelistId(result.objectChanges);
      const acId = extractAdminCapId(result.objectChanges);
      
      setWhitelistId(wlId);
      setAdminCapId(acId);
      
      return { whitelistId: wlId, adminCapId: acId };
    }
  };

  // Step 2: Upload record (needs private key)
  const uploadRecord = async (files: File[]) => {
    // Get encrypted key from storage
    const encrypted = localStorage.getItem('encrypted_key');
    const privateKey = SecureKeyManager.decryptPrivateKey(encrypted, password);
    
    const formData = new FormData();
    formData.append('whitelistId', whitelistId);
    formData.append('adminCapId', adminCapId);
    formData.append('uploader', currentAccount.address);
    formData.append('docTypes', '2'); // Doctor notes
    formData.append('privateKey', privateKey);
    files.forEach(f => formData.append('files', f));
    
    const response = await fetch(`${API_URL}/records/upload`, {
      method: 'POST',
      body: formData
    });
    
    // Clear sensitive data
    privateKey = null;
    
    return await response.json();
  };

  // Step 3: Download record (needs private key)
  const downloadRecord = async (recordId: string) => {
    const encrypted = localStorage.getItem('encrypted_key');
    const privateKey = SecureKeyManager.decryptPrivateKey(encrypted, password);
    
    const response = await fetch(`${API_URL}/records/${recordId}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterAddress: currentAccount.address,
        fileIndex: 0,
        privateKey: privateKey
      })
    });
    
    privateKey = null;
    
    if (response.ok) {
      const blob = await response.blob();
      downloadBlob(blob, 'medical_record.pdf');
    }
  };

  return (
    <div>
      <button onClick={createWhitelist}>
        Create Whitelist (Wallet Sign)
      </button>
      <button onClick={() => uploadRecord(selectedFiles)}>
        Upload Record (Password Protected)
      </button>
      <button onClick={() => downloadRecord(recordId)}>
        Download Record (Password Protected)
      </button>
    </div>
  );
};
```

---

## Security Notes

⚠️ **QUAN TRỌNG**:
- **KHÔNG BAO GIỜ** lưu private key plain text trong localStorage
- **KHÔNG** hardcode private key trong code
- **SỬ DỤNG** Sui Wallet cho whitelist operations
- **MÃ HÓA** private key với password trước khi lưu
- **XÓA** private key từ memory sau khi sử dụng
- Validate input từ user trước khi gửi request
- Implement rate limiting cho API endpoints
- Sử dụng HTTPS trong production
- Implement session timeout cho password-protected keys
- Audit logs cho tất cả sensitive operations

---

## Testing

Test script: `backend/test/record-api.test.sh`

```bash
cd backend/test
./record-api.test.sh

# Hoặc với existing whitelist
WHITELIST_ID=0x... ./record-api.test.sh
```

---

## Support & Documentation

- Sui Documentation: https://docs.sui.io
- Seal SDK: https://github.com/MystenLabs/seal
- Walrus Documentation: https://docs.walrus.site
- API Swagger: http://localhost:3000/api (khi backend running)
