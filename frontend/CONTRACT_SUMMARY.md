# Seal Whitelist Contract API Reference

Tài liệu này mô tả các function của smart contract `seal_whitelist` để frontend có thể tích hợp.

**Package ID**: `0xc4f956117f2ea91392c8a5af2a2ba53d00afdac00801e2df7f77a0f16705dd62`  
**Module**: `medical_vault::seal_whitelist`  
**Registry ID**: `0x5a8347fa5f2d9065c0e28326b73db549d4e190bcf60f01fbd3e2026f87ddf168`

## 📋 Table of Contents

- [Access Roles](#access-roles)
- [Data Structures](#data-structures)
- [Entry Functions (Transactions)](#entry-functions-transactions)
- [View Functions (Read-only)](#view-functions-read-only)
- [Frontend Integration Guide](#frontend-integration-guide)

---

## 🔐 Access Roles

Contract có 3 loại role với quyền khác nhau:

| Role | Value | Read Access | Write Access | Description |
|------|-------|-------------|--------------|-------------|
| **Owner** | 0 | ✅ Yes | ✅ Yes | Chủ sở hữu whitelist, có thể quản lý doctors/members |
| **Doctor** | 1 | ✅ Yes | ✅ Yes | Bác sĩ, có thể encrypt và decrypt data |
| **Member** | 2 | ✅ Yes | ❌ No | Thành viên (gia đình), chỉ có thể decrypt data |
| **None** | 255 | ❌ No | ❌ No | Không có quyền truy cập |

**Key Points:**
- **Write Access** = có thể encrypt data (tạo medical records mới)
- **Read Access** = có thể decrypt data (xem medical records)
- Owner và Doctor có cả 2 quyền
- Member chỉ có thể xem, không tạo mới

---

## 📦 Data Structures

### SealWhitelist

Đối tượng chính để quản lý access control:

```typescript
{
  id: ObjectId,              // Whitelist ID
  name: string,              // Tên whitelist (e.g., "Personal Medical Records")
  owner: address,            // Địa chỉ chủ sở hữu
  doctors: address[],        // Danh sách bác sĩ có quyền read/write
  members: address[],        // Danh sách members có quyền read-only
  records: ObjectId[],       // Danh sách medical record IDs
  created_at: u64           // Timestamp tạo
}
```

### WhitelistRegistry

Shared object toàn cục để track user access:

```typescript
{
  id: ObjectId,
  user_whitelists: Table<address, Table<ObjectId, bool>>
  // Nested structure cho O(1) lookup:
  // user_address -> { whitelist_id -> true }
}
```

### WhitelistAdminCap

Capability object được owner nắm giữ để quản lý whitelist:

```typescript
{
  id: ObjectId,
  whitelist_id: ObjectId    // ID của whitelist mà cap này quản lý
}
```

---

## 🚀 Entry Functions (Transactions)

### 1. create_whitelist

Tạo whitelist mới. Sender tự động trở thành owner.

```typescript
// Move signature
public entry fun create_whitelist(
    registry: &mut WhitelistRegistry,
    name: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext
)
```

**Sui TypeScript SDK:**

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::seal_whitelist::create_whitelist`,
  arguments: [
    tx.object(REGISTRY_ID),                // WhitelistRegistry shared object
    tx.pure(new TextEncoder().encode("My Medical Records")), // name as bytes
    tx.object('0x6'),                      // Clock object (mainnet/testnet)
  ],
});

const result = await signAndExecuteTransactionBlock({
  transactionBlock: tx,
  options: { showObjectChanges: true, showEvents: true },
});

// Extract whitelist ID and cap ID from objectChanges
const whitelist = result.objectChanges.find(
  obj => obj.objectType?.includes('SealWhitelist')
);
const cap = result.objectChanges.find(
  obj => obj.objectType?.includes('WhitelistAdminCap')
);
```

**Events Emitted:**
- `WhitelistCreated { whitelist_id, creator, timestamp }`
- `RegistryUpdated { user, whitelist_id, operation: "add" }`

**Returns:**
- New `SealWhitelist` shared object
- New `WhitelistAdminCap` transferred to sender

---

### 2. add_doctor

Thêm bác sĩ vào whitelist (read/write access).

```typescript
// Move signature
public entry fun add_doctor(
    registry: &mut WhitelistRegistry,
    whitelist: &mut SealWhitelist,
    cap: &WhitelistAdminCap,
    doctor: address,
    clock: &Clock,
    ctx: &mut TxContext
)
```

**Sui TypeScript SDK:**

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::seal_whitelist::add_doctor`,
  arguments: [
    tx.object(REGISTRY_ID),
    tx.object(whitelistId),        // Whitelist ID
    tx.object(whitelistCapId),     // WhitelistAdminCap owned by sender
    tx.pure(doctorAddress, 'address'),
    tx.object('0x6'),
  ],
});

await signAndExecuteTransactionBlock({ transactionBlock: tx });
```

**Events Emitted:**
- `AccessGranted { whitelist_id, user: doctor, role: 1, timestamp }`
- `RegistryUpdated { user: doctor, whitelist_id, operation: "add" }`

**Requirements:**
- Sender phải sở hữu `WhitelistAdminCap` cho whitelist này
- Doctor address chưa tồn tại trong danh sách

---

### 3. add_member

Thêm member vào whitelist (read-only access).

```typescript
// Move signature
public entry fun add_member(
    registry: &mut WhitelistRegistry,
    whitelist: &mut SealWhitelist,
    cap: &WhitelistAdminCap,
    member: address,
    clock: &Clock,
    ctx: &mut TxContext
)
```

**Sui TypeScript SDK:**

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::seal_whitelist::add_member`,
  arguments: [
    tx.object(REGISTRY_ID),
    tx.object(whitelistId),
    tx.object(whitelistCapId),
    tx.pure(memberAddress, 'address'),
    tx.object('0x6'),
  ],
});

await signAndExecuteTransactionBlock({ transactionBlock: tx });
```

**Events Emitted:**
- `AccessGranted { whitelist_id, user: member, role: 2, timestamp }`
- `RegistryUpdated { user: member, whitelist_id, operation: "add" }`

---

### 4. remove_doctor

Xóa bác sĩ khỏi whitelist.

```typescript
// Move signature
public entry fun remove_doctor(
    registry: &mut WhitelistRegistry,
    whitelist: &mut SealWhitelist,
    cap: &WhitelistAdminCap,
    doctor: address,
    clock: &Clock,
    ctx: &mut TxContext
)
```

**Sui TypeScript SDK:**

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::seal_whitelist::remove_doctor`,
  arguments: [
    tx.object(REGISTRY_ID),
    tx.object(whitelistId),
    tx.object(whitelistCapId),
    tx.pure(doctorAddress, 'address'),
    tx.object('0x6'),
  ],
});

await signAndExecuteTransactionBlock({ transactionBlock: tx });
```

**Events Emitted:**
- `AccessRevoked { whitelist_id, user: doctor, timestamp }`

**Note:** Nếu doctor không còn role nào khác (không phải member, không phải owner), sẽ bị xóa khỏi registry.

---

### 5. remove_member

Xóa member khỏi whitelist.

```typescript
// Move signature  
public entry fun remove_member(
    registry: &mut WhitelistRegistry,
    whitelist: &mut SealWhitelist,
    cap: &WhitelistAdminCap,
    member: address,
    clock: &Clock,
    ctx: &mut TxContext
)
```

**Sui TypeScript SDK:** Tương tự `remove_doctor`, đổi function name.

---

### 6. seal_approve_write

Được gọi bởi Seal service khi encrypt data. Frontend không cần gọi trực tiếp.

```typescript
public entry fun seal_approve_write(
    id: vector<u8>,           // Key ID
    whitelist: &SealWhitelist,
    clock: &Clock,
    ctx: &TxContext
)
```

**Usage:** Seal SDK tự động gọi function này khi user encrypt data.

**Requirements:**
- Sender phải là owner hoặc doctor
- Key ID phải có prefix của whitelist namespace

---

### 7. seal_approve_read

Được gọi bởi Seal service khi decrypt data. Frontend không cần gọi trực tiếp.

```typescript
public entry fun seal_approve_read(
    id: vector<u8>,
    whitelist: &SealWhitelist,
    clock: &Clock,
    ctx: &TxContext
)
```

**Usage:** Seal SDK tự động gọi function này khi user decrypt data.

**Requirements:**
- Sender phải là owner, doctor, hoặc member
- Key ID phải có prefix của whitelist namespace

---

## 👁️ View Functions (Read-only)

Các function này có thể gọi qua `devInspectTransactionBlock` để read data mà không cần tạo transaction.

### 1. get_user_role

Lấy role của user trong whitelist.

```typescript
public fun get_user_role(whitelist: &SealWhitelist, user: address): u8
```

**Returns:** `0` (owner) | `1` (doctor) | `2` (member) | `255` (no access)

**TypeScript Example:**

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::seal_whitelist::get_user_role`,
  arguments: [
    tx.object(whitelistId),
    tx.pure(userAddress, 'address'),
  ],
});

const result = await client.devInspectTransactionBlock({
  transactionBlock: tx,
  sender: userAddress,
});

// Parse return value from result.results
const role = result.results[0].returnValues[0][0][0]; // u8
```

---

### 2. has_access

Kiểm tra user có quyền truy cập whitelist không.

```typescript
public fun has_access(whitelist: &SealWhitelist, user: address): bool
```

**Returns:** `true` nếu user là owner/doctor/member, `false` otherwise.

---

### 3. can_write

Kiểm tra user có quyền write (encrypt) không.

```typescript
public fun can_write(
    whitelist: &SealWhitelist,
    user: address,
    clock: &Clock
): bool
```

**Returns:** `true` nếu user là owner hoặc doctor.

---

### 4. can_read

Kiểm tra user có quyền read (decrypt) không.

```typescript
public fun can_read(
    whitelist: &SealWhitelist,
    user: address,
    clock: &Clock
): bool
```

**Returns:** `true` nếu user là owner, doctor, hoặc member.

---

### 5. user_has_whitelist_access

Kiểm tra user có trong registry cho whitelist cụ thể không (O(1) lookup).

```typescript
public fun user_has_whitelist_access(
    registry: &WhitelistRegistry,
    user: address,
    whitelist_id: ID
): bool
```

**TypeScript Example:**

```typescript
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::seal_whitelist::user_has_whitelist_access`,
  arguments: [
    tx.object(REGISTRY_ID),
    tx.pure(userAddress, 'address'),
    tx.pure(whitelistId, 'address'), // ID type = address in TS
  ],
});

const result = await client.devInspectTransactionBlock({
  transactionBlock: tx,
  sender: userAddress,
});

const hasAccess = result.results[0].returnValues[0][0][0] === 1; // bool
```

---

### 6. get_whitelist_full_access_info

Lấy đầy đủ thông tin về whitelist và quyền của user.

```typescript
public fun get_whitelist_full_access_info(
    whitelist: &SealWhitelist,
    user: address
): (ID, String, address, u8, bool, bool, u64)
```

**Returns:**
1. `whitelist_id: ID`
2. `name: String`
3. `owner: address`
4. `role: u8`
5. `has_read: bool`
6. `has_write: bool`
7. `record_count: u64`

---

### 7. Getter Functions

```typescript
// Lấy tên whitelist
public fun name(whitelist: &SealWhitelist): String

// Lấy owner address
public fun owner(whitelist: &SealWhitelist): address

// Lấy danh sách doctors
public fun doctors(whitelist: &SealWhitelist): &vector<address>

// Lấy danh sách members
public fun members(whitelist: &SealWhitelist): &vector<address>

// Lấy danh sách record IDs
public fun records(whitelist: &SealWhitelist): &vector<ID>

// Kiểm tra record có trong whitelist không
public fun has_record(whitelist: &SealWhitelist, record_id: ID): bool

// Lấy whitelist ID
public fun whitelist_id(whitelist: &SealWhitelist): ID

// Lấy timestamp tạo
public fun created_at(whitelist: &SealWhitelist): u64

// Kiểm tra user có phải owner không
public fun is_owner(whitelist: &SealWhitelist, user: address): bool

// Kiểm tra user có phải doctor không
public fun is_doctor(whitelist: &SealWhitelist, user: address): bool

// Kiểm tra user có phải member không
public fun is_member(whitelist: &SealWhitelist, user: address): bool
```

---

## 📚 Frontend Integration Guide

### Query User's Whitelists

**Recommended Approach:** Sử dụng Backend API (đã fix)

```typescript
// GET /whitelists/user/:address/chain
const response = await fetch(
  `http://localhost:3000/whitelists/user/${userAddress}/chain`
);

const data = await response.json();
// {
//   success: true,
//   count: 1,
//   whitelists: [{
//     whitelistId: "0x...",
//     name: "My Medical Records",
//     owner: "0x...",
//     role: 0,
//     roleName: "owner",
//     hasRead: true,
//     hasWrite: true,
//     permissions: { canRead: true, canWrite: true, canManage: true },
//     doctors: [],
//     members: [],
//     recordCount: 0,
//     createdAt: "..."
//   }]
// }
```

**Direct Blockchain Query:** Query nested Table structure

```typescript
// Step 1: Get registry object
const registryObject = await client.getObject({
  id: REGISTRY_ID,
  options: { showContent: true },
});

// Step 2: Extract outer table ID
const outerTableId = registryObject.data.content.fields
  .user_whitelists.fields.id.id;

// Step 3: Query outer table for user's field
const outerFields = await client.getDynamicFields({
  parentId: outerTableId,
});

const userField = outerFields.data.find(
  f => f.name?.value === userAddress
);

// Step 4: Get user field object to extract inner table ID
const userFieldObject = await client.getObject({
  id: userField.objectId,
  options: { showContent: true },
});

const innerTableId = userFieldObject.data.content.fields
  .value.fields.id.id;

// Step 5: Query inner table for whitelist IDs
const innerFields = await client.getDynamicFields({
  parentId: innerTableId,
});

const whitelistIds = innerFields.data.map(f => f.name.value);

// Step 6: Fetch each whitelist object
const whitelists = await Promise.all(
  whitelistIds.map(id => 
    client.getObject({
      id,
      options: { showContent: true },
    })
  )
);
```

---

### Check User Access (Quick)

```typescript
// GET /whitelists/:id/check-access/:address
const response = await fetch(
  `http://localhost:3000/whitelists/${whitelistId}/check-access/${userAddress}`
);

const { hasAccess } = await response.json();
// { success: true, hasAccess: true }
```

---

### Get Full Access Details

```typescript
// GET /whitelists/:id/access/:address
const response = await fetch(
  `http://localhost:3000/whitelists/${whitelistId}/access/${userAddress}`
);

const data = await response.json();
// {
//   role: 0,
//   roleName: "owner",
//   hasRead: true,
//   hasWrite: true,
//   permissions: {
//     canRead: true,
//     canWrite: true,
//     canManage: true
//   }
// }
```

---

### Create Whitelist Flow

```typescript
import { TransactionBlock } from '@mysten/sui.js/transactions';

async function createWhitelist(name: string) {
  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::seal_whitelist::create_whitelist`,
    arguments: [
      tx.object(REGISTRY_ID),
      tx.pure(new TextEncoder().encode(name)),
      tx.object('0x6'),
    ],
  });
  
  const result = await signAndExecuteTransactionBlock({
    transactionBlock: tx,
    options: {
      showObjectChanges: true,
      showEvents: true,
    },
  });
  
  // Extract created objects
  const whitelist = result.objectChanges.find(
    obj => obj.type === 'created' && 
           obj.objectType?.includes('SealWhitelist')
  );
  
  const cap = result.objectChanges.find(
    obj => obj.type === 'created' && 
           obj.objectType?.includes('WhitelistAdminCap')
  );
  
  return {
    whitelistId: whitelist.objectId,
    capId: cap.objectId,
    digest: result.digest,
  };
}
```

---

### Add Doctor/Member Flow

```typescript
async function addDoctor(
  whitelistId: string,
  capId: string,
  doctorAddress: string
) {
  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::seal_whitelist::add_doctor`,
    arguments: [
      tx.object(REGISTRY_ID),
      tx.object(whitelistId),
      tx.object(capId),
      tx.pure(doctorAddress, 'address'),
      tx.object('0x6'),
    ],
  });
  
  return await signAndExecuteTransactionBlock({
    transactionBlock: tx,
  });
}

async function addMember(
  whitelistId: string,
  capId: string,
  memberAddress: string
) {
  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::seal_whitelist::add_member`,
    arguments: [
      tx.object(REGISTRY_ID),
      tx.object(whitelistId),
      tx.object(capId),
      tx.pure(memberAddress, 'address'),
      tx.object('0x6'),
    ],
  });
  
  return await signAndExecuteTransactionBlock({
    transactionBlock: tx,
  });
}
```

---

### Get Whitelist Details

```typescript
async function getWhitelistDetails(whitelistId: string, userAddress: string) {
  // Option 1: Backend API (recommended)
  const response = await fetch(
    `http://localhost:3000/whitelists/${whitelistId}`
  );
  return await response.json();
  
  // Option 2: Direct blockchain query
  const whitelist = await client.getObject({
    id: whitelistId,
    options: { showContent: true },
  });
  
  const fields = whitelist.data.content.fields;
  
  // Use devInspect to get user's role
  const tx = new TransactionBlock();
  tx.moveCall({
    target: `${PACKAGE_ID}::seal_whitelist::get_user_role`,
    arguments: [
      tx.object(whitelistId),
      tx.pure(userAddress, 'address'),
    ],
  });
  
  const result = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: userAddress,
  });
  
  const role = result.results[0].returnValues[0][0][0];
  
  return {
    id: whitelistId,
    name: fields.name,
    owner: fields.owner,
    doctors: fields.doctors,
    members: fields.members,
    records: fields.records,
    createdAt: fields.created_at,
    userRole: role,
  };
}
```

---

## 🔍 Common Patterns

### Pattern 1: Check Permission Before Action

```typescript
async function canUserUploadRecord(whitelistId: string, userAddress: string) {
  const response = await fetch(
    `http://localhost:3000/whitelists/${whitelistId}/access/${userAddress}`
  );
  const { hasWrite } = await response.json();
  
  if (!hasWrite) {
    throw new Error('User does not have write permission');
  }
  
  return true;
}
```

### Pattern 2: List All Accessible Whitelists

```typescript
async function getUserWhitelists(userAddress: string) {
  const response = await fetch(
    `http://localhost:3000/whitelists/user/${userAddress}/chain`
  );
  const { whitelists } = await response.json();
  
  // Filter by role if needed
  const ownedWhitelists = whitelists.filter(w => w.role === 0);
  const doctorWhitelists = whitelists.filter(w => w.role === 1);
  const memberWhitelists = whitelists.filter(w => w.role === 2);
  
  return { ownedWhitelists, doctorWhitelists, memberWhitelists };
}
```

### Pattern 3: Batch Permission Check

```typescript
async function checkBatchAccess(
  whitelistIds: string[],
  userAddress: string
) {
  const results = await Promise.all(
    whitelistIds.map(async id => {
      const response = await fetch(
        `http://localhost:3000/whitelists/${id}/check-access/${userAddress}`
      );
      const { hasAccess } = await response.json();
      return { whitelistId: id, hasAccess };
    })
  );
  
  return results;
}
```

---

## 🚨 Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 0 | E_INVALID_CAP | WhitelistAdminCap không khớp với whitelist |
| 2 | E_DUPLICATE | User đã tồn tại trong danh sách |
| 5 | E_NO_WRITE_ACCESS | User không có quyền write |
| 6 | E_NO_READ_ACCESS | User không có quyền read |

---

## 📝 Notes

1. **Registry Structure**: Nested Table cho O(1) lookup
   - `Registry -> user_whitelists (outer Table) -> user address (field) -> inner Table -> whitelist ID -> true`

2. **WhitelistAdminCap**: Owner cần giữ object này để quản lý whitelist. Không transfer cho người khác.

3. **Seal Integration**: `seal_approve_write` và `seal_approve_read` được Seal SDK tự động gọi, frontend không cần lo.

4. **Listing Limitations**: Move Table không support iteration, nên phải dùng Backend API hoặc index off-chain để list whitelists.

5. **Clock Object**: Luôn dùng `0x6` cho mainnet/testnet Sui.

---

## 🔗 Related Documentation

- [Backend API Guide](./FRONTEND_API_GUIDE.md)
- [Seal Documentation](https://github.com/MystenLabs/seal)
- [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript)

---

**Last Updated**: January 14, 2026  
**Contract Version**: Latest deployment with nested Table structure
