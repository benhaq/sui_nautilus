# Sui Nautilus - Medical Vault Insurer

A **verifiable off-chain computation framework** for secure medical data processing on Sui blockchain, with a complete decentralized medical records management system.

---

## 🎯 Overview

Medical Vault is a **privacy-first, patient-owned medical record system** where patients have full ownership and control of their health data. The system ensures **security – transparency – decentralization** by combining blockchain technology with end-to-end encryption.

The Nautilus framework provides the verifiable computation layer (AWS Nitro Enclave), while the frontend/backend system handles user interactions, data encryption, and decentralized storage.

> **Nautilus**: A framework for secure and verifiable off-chain computation on Sui. See [Nautilus documentation](https://docs.sui.io/concepts/cryptography/nautilus) for full details.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Bun + React)                   │
│  • Wallet connection (Sui Wallet, Suiet)                        │
│  • Medical records UI                                           │
│  • Access control management                                    │
│  • FHIR document viewer                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    BACKEND API (NestJS)                          │
│  • Sui transaction building/execution                            │
│  • Walrus file upload/download                                   │
│  • Seal encryption/decryption                                    │
│  • Access control verification                                   │
│  • Audit logging                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│               NAUTILUS SERVER (AWS Nitro Enclave)                │
│  • FHIR R5 bundle processing                                     │
│  • OpenRouter LLM integration                                    │
│  • Intent signing                                                │
│  • Seal key management                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Sui Blockchain│  │ Seal Network  │  │ Walrus Storage│
│ (Access Ctrl) │  │ (Encryption)  │  │ (File Store)  │
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## ✨ Key Features

### 🔐 Whitelist-Based Access Control (On-Chain)

| Role | Value | Read | Write | Description |
|------|-------|------|-------|-------------|
| **Owner** | 0 | ✅ | ✅ | Patient, full control over whitelist |
| **Doctor** | 1 | ✅ | ✅ | Healthcare provider, can upload records |
| **Member** | 2 | ✅ | ❌ | Family, read-only access |
| **None** | 255 | ❌ | ❌ | No access |

**Nested Table Structure** for O(1) access lookups:
```move
WhitelistRegistry {
    user_whitelists: Table<address, Table<ID, bool>>
}
```

### 📁 Records Management

- **Upload**: Encrypt files with Seal SDK → Upload to Walrus → Store on-chain metadata
- **Download**: Verify on-chain access → Download from Walrus → Decrypt with Seal
- **Document Types**: Lab Results, Imaging, Doctor Notes, Prescriptions, Other
- **Audit Trail**: Immutable logs for all actions

### 🏥 FHIR R5 Processing

The Nautilus enclave provides:
- Raw medical data → FHIR R5 bundle conversion via LLM (OpenRouter)
- Semantic hashing for data integrity verification
- Patient context and PHI handling (include/exclude options)
- Intent signing for blockchain verification

### 🔒 Security Model

1. **No user private keys stored** - Wallet signing only
2. **On-chain access enforcement** - Role-based permissions
3. **End-to-end encryption** - Seal Network threshold cryptography
4. **Verifiable computation** - AWS Nitro Enclave with remote attestation
5. **Immutable audit trail** - All actions logged on-chain

---

## 📦 Components

### Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/whitelists` | POST | Create new whitelist |
| `/whitelists/:id/doctors` | POST/DELETE | Add/remove doctors |
| `/whitelists/:id/members` | POST/DELETE | Add/remove members |
| `/whitelists/user/:address/chain` | GET | Get user's whitelists (on-chain) |
| `/whitelists/:id/access/:address` | GET | Check user access details |
| `/whitelists/:id/check-access/:address` | GET | O(1) access check |
| `/records/upload` | POST | Upload encrypted medical record |
| `/records/confirm` | POST | Confirm after wallet signing |
| `/records/:id` | GET | Get record details |
| `/records/:id/download` | POST | Download & decrypt file |
| `/records/whitelist/:whitelistId` | GET | List records in whitelist |
| `/log/address/:address` | GET | Action history by address |

### Move Smart Contracts

| Contract | Purpose |
|----------|---------|
| `seal_whitelist.move` | Whitelist registry with nested Table access control |
| `medical_record.move` | Medical record creation and management |
| `export.move` | Data export utilities |
| `audit.move` | Audit logging |

### Nautilus Server

| Port | Endpoint | Purpose |
|------|----------|---------|
| 3000 | `/process_data` | FHIR conversion via LLM |
| 3000 | `/health_check` | Enclave health & connectivity |
| 3001 | `/admin/init_seal_key_load` | Initialize Seal key fetch |
| 3001 | `/admin/complete_seal_key_load` | Complete key provisioning |
| 3001 | `/admin/provision_openrouter_api_key` | Provision API key |

### Frontend

- **Tech Stack**: Bun, React, Tailwind CSS
- **Wallet**: @mysten/dapp-kit, Sui Wallet, Suiet
- **Design**: Healthcare-focused, WCAG AAA accessible
- **Components**: Whitelist management, record viewer, access control UI

---

## 🔧 Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Bun, React, Tailwind CSS, Lucide React |
| **Backend** | NestJS, TypeScript |
| **Blockchain** | Sui Move, Sui TypeScript SDK |
| **Enclave** | AWS Nitro Enclave, Nautilus Server (Rust) |
| **Encryption** | Seal Network (IBE threshold cryptography) |
| **Storage** | Walrus (decentralized blob storage) |
| **LLM** | OpenRouter (GPT models) |
| **Data Format** | FHIR R5 (HL7 Healthcare standard) |

---

## 🎨 UI/UX Design Principles

- **Healthcare Blue** (`#0891B2`) - Trust and professionalism
- **Swiss Modernism** - Clean grid-based layouts
- **WCAG AAA** - Maximum accessibility compliance
- **Minimalism** - Essential information, no clutter
- **Dark/Light Mode** - Consistent design in both themes
- **Reduced Motion** - Respects user preferences

---

## 🚀 Getting Started

### Prerequisites

- AWS account with Nitro Enclaves enabled
- Sui CLI configured for testnet
- Bun runtime
- Rust toolchain (for enclave build)

### Quick Start

```bash
# 1. Build the enclave
cd src/nautilus-server
cargo build --package nautilus-server --features medical-vault-insurer

# 2. Build EIF (Enclave Image File)
make ENCLAVE_APP=medical-vault-insurer

# 3. Start EC2 instance and deploy
cd scripts/staging
./ec2-start.sh --register

# 4. Provision Seal keys
./provision-api-key.sh

# 5. Test the API
curl http://3.0.207.181:3000/health_check
```

### Development Workflow

```bash
# Make code changes
# Rebuild and redeploy
./ec2-rebuild.sh --register

# Or just restart services if no code changes
./ec2-restart-forwarders.sh
```

---

## 📁 Project Structure

```
sui_nautilus/
├── src/nautilus-server/         # Nautilus server (Rust)
│   └── apps/medical-vault-insurer/  # FHIR processing app
│       ├── mod.rs                    # Main module & endpoints
│       ├── types.rs                  # Request/response types
│       ├── fhir.rs                   # FHIR processing logic
│       └── seal_config.yaml          # Seal server config
├── move/                        # Move contracts
│   ├── medical-vault/           # Medical vault contracts
│   │   ├── seal_whitelist.move  # Whitelist with nested Table
│   │   ├── medical_record.move  # Record management
│   │   └── timeline.move        # Event timeline (deprecated intent pattern)
│   └── enclave/                 # Enclave utilities
├── scripts/staging/             # EC2 deployment scripts
│   ├── ec2-start.sh            # Start & register enclave
│   ├── ec2-stop.sh             # Stop instance
│   ├── ec2-rebuild.sh          # Sync code & rebuild
│   ├── ec2-restart-forwarders.sh # Restart port forwarders
│   ├── provision-api-key.sh    # Provision Seal keys
│   └── .env.example            # Environment template
├── frontend/                    # React frontend
│   ├── src/components/         # UI components
│   ├── src/services/           # API services
│   ├── src/hooks/              # React hooks
│   └── DESIGN_DOCS.md          # UI/UX design system
├── backend/                     # NestJS backend (placeholder)
└── docs/                        # Documentation
```

---

## 🔒 Security Considerations

> **Important**: The reproducible build template is intended as a starting point for building your own enclave. It is not feature complete, has not undergone a security audit, and is offered as a modification-friendly reference licensed under the Apache 2.0 license. THE TEMPLATE AND ITS RELATED DOCUMENTATION ARE PROVIDED AS IS WITHOUT WARRANTY OF ANY KIND FOR EVALUATION PURPOSES ONLY.

### Seal Key Provisioning

Keys are fetched using a certificate-based mechanism with 30-minute TTL:

```bash
# Step 1: Initialize key load
curl -X POST http://localhost:3001/admin/init_seal_key_load \
  -H 'Content-Type: application/json' \
  -d '{"enclave_object_id": "...", "initial_shared_version": ...}'

# Step 2: Fetch from Seal servers
seal-cli fetch-keys --request "$ENCODED_REQUEST" \
  -k 0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8 \
  -t 2 -n testnet

# Step 3: Complete key load
curl -X POST http://localhost:3001/admin/complete_seal_key_load \
  -H 'Content-Type: application/json' \
  -d '{"seal_responses": "..."}'
```

### Enclave Attestation

All enclave responses are signed with an ephemeral key generated at startup. The enclave's PCRs (Platform Configuration Registers) are registered on-chain during deployment.

---

## 🧪 Testing

### Local Build Test

```bash
cd src/nautilus-server
cargo build --package nautilus-server --features medical-vault-insurer
```

### Enclave Health Check

```bash
curl http://3.0.207.181:3000/health_check
# Response: {"pk":"<enclave_public_key>","endpoints_status":{}}
```

### FHIR Processing

```bash
curl -X POST "http://3.0.207.181:3000/process_data" \
  -H 'Content-Type: application/json' \
  -d '{
    "raw_data": "Patient John Doe, 45 years old, history of hypertension...",
    "source_format": "text",
    "include_phi": true
  }'
```

---

## 📊 Current Status (Staging)

| Component | Status |
|-----------|--------|
| EC2 Instance | `i-03992c29f04547b14` (ap-southeast-1) |
| Public IP | `3.0.207.181` |
| Enclave | Running (CID varies on restart) |
| API | Port 3000 → `/` responding "Pong!" |
| Admin | Port 3001 → Via SSH tunnel |
| Network | Sui testnet |

### Configuration

```bash
ENCLAVE_ID=0x70735f72ed050a18c717643619c0df3e9f578efb2738b6efc6d75010f619d655
ENCLAVE_OBJ_VERSION=734013140
WALRUS_ENDPOINT=aggregator.walrus-testnet.walrus.space:443
SUI_ENDPOINT=fullnode.testnet.sui.io:443
OPENROUTER_ENDPOINT=openrouter.ai:443
SEAL_SERVERS=0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8
```

---

## 📚 Documentation

- [Nautilus Documentation](https://docs.sui.io/concepts/cryptography/nautilus)
- [Staging Scripts](./scripts/staging/README.md)
- [Medical Vault App](./src/nautilus-server/src/apps/medical-vault-insurer/README.md)
- [Contract API](./frontend/CONTRACT_SUMMARY.md)
- [Backend API Guide](./frontend/BACKEND_API_SUMMARY.md)
- [UI/UX Design](./frontend/DESIGN_DOCS.md)
- [Seal SDK](https://github.com/MystenLabs/seal)

---

## 🤝 Contributing

For questions about Nautilus, use case discussions, or integration support, contact the Nautilus team on [Sui Discord](https://discord.gg/sui).

---

## 📄 License

Apache 2.0 License - See LICENSE file for details.
