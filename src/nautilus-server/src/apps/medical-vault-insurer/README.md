# Medical Vault Insurer - Nautilus Server

This application provides FHIR R5 document validation for medical records using the Nautilus verifiable computation framework with Seal integration for secure secret management.

## Overview

The medical-vault-insurer application enables:
- FHIR R5 bundle validation for medical records
- Secure secret management using Seal encryption
- Enclave-based validation with cryptographic guarantees

## Architecture

### Components

1. **Nautilus Server** (`src/nautilus-server/src/apps/medical-vault-insurer/`):
   - Runs inside AWS Nitro Enclave
   - Exposes `/process_data` endpoint for FHIR validation (port 3000)
   - Exposes admin endpoints for key management (port 3001)

2. **Move Contracts** (`move/medical-vault-insurer/`):
   - `seal_whitelist.move` - Whitelist management with Seal policy
   - `validator.move` - FHIR bundle validation logic
   - `medical_record.move` - Medical record management

3. **Seal Integration**:
   - Secure secret provisioning for validator credentials
   - Encrypted key storage with threshold decryption

### Intent Scopes

| Scope | Value | Purpose |
|-------|-------|---------|
| `ValidateBundle` | 100 | FHIR bundle validation |
| `VerifyBundle` | 101 | FHIR bundle verification |
| `ValidateClaim` | 102 | Insurance claim validation |
| `WalletPK` | 1 | Wallet public key registration (Seal) |

## Setup

### Step 0: Build and Publish Move Contracts

```bash
# Build and publish medical-vault-insurer package
cd move/medical-vault-insurer
sui move build
sui client publish

# Record the package ID
APP_PACKAGE_ID=0x...
```

### Step 1: Configure Seal

Update `seal_config.yaml` with your package ID:

```yaml
package_id: "0xYOUR_PACKAGE_ID"
```

### Step 2: Build and Run Enclave

```bash
# Build with medical-vault-insurer app
make ENCLAVE_APP=medical-vault-insurer && make run

# In another terminal, expose the enclave
sh expose_enclave.sh
```

### Step 3: Register Enclave

Follow the standard Nautilus registration process to:
1. Get PCRs from the running enclave
2. Update PCRs on-chain
3. Register the enclave

## Key Load Process

### Step 1: Initialize Key Load

```bash
curl -X POST http://localhost:3001/admin/init_seal_key_load \
  -H 'Content-Type: application/json' \
  -d '{
    "enclave_object_id": "0xENCLAVE_OBJECT_ID",
    "initial_shared_version": ENCLAVE_OBJ_VERSION
  }'

# Response:
{"encoded_request": "<FETCH_KEY_REQUEST>"}
```

### Step 2: Fetch Keys from Seal Servers

```bash
# In Seal repository
cargo run --bin seal-cli fetch-keys --request <FETCH_KEY_REQUEST> \
    -k 0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8 \
    -t 2 \
    -n testnet

# Response:
{"encoded_seal_responses": "<ENCODED_SEAL_RESPONSES>"}
```

### Step 3: Complete Key Load

```bash
curl -X POST http://localhost:3001/admin/complete_seal_key_load \
  -H 'Content-Type: application/json' \
  -d '{
    "seal_responses": "<ENCODED_SEAL_RESPONSES>"
  }'

# Response:
{"status":"OK"}
```

## Usage

### Process FHIR Validation Request

```bash
curl -H 'Content-Type: application/json' \
  -d '{
    "payload": {
      "walrus_blob_id": "blob123",
      "semantic_hash": "abc123def456",
      "patient_id": "patient456",
      "resource_count": 5,
      "resource_types": ["Patient", "Observation", "Condition"],
      "include_phi": true
    }
  }' \
  -X POST http://<PUBLIC_IP>:3000/process_data

# Response:
{
  "response": {
    "intent": 100,
    "timestamp_ms": 1744038900000,
    "data": {
      "walrus_blob_id": "blob123",
      "semantic_hash": "abc123def456",
      "patient_id": "patient456",
      "resource_count": 5,
      "resource_types": ["Patient", "Observation", "Condition"],
      "validated": true,
      "validated_at": 1744038900000,
      "validator": "0x..."
    }
  },
  "signature": "..."
}
```

## Security Guarantees

The medical-vault-insurer application inherits security guarantees from:

1. **Nautilus Framework**: Enclave-based execution with remote attestation
2. **Seal Integration**: Encrypted secret provisioning with threshold cryptography
3. **Intent Signing**: All responses signed by enclave ephemeral key

### Seal Security

- Enclave generates wallet keypair for Seal operations
- Enclave generates ElGamal keypair for response decryption
- Certificate-based key fetch with 30-minute TTL
- Threshold decryption requiring multiple key servers

## Troubleshooting

1. **Certificate Expired**: Re-run Step 1 of key load process
2. **Enclave Restart**: Re-run Steps 1-3 of key load process
3. **Key Fetch Failed**: Verify Seal server IDs in `seal_config.yaml`

## File Structure

```
medical-vault-insurer/
├── mod.rs                    # Main module with endpoints
├── types.rs                  # Request/response types and Seal config
├── seal_config.yaml          # Seal server configuration
├── allowed_endpoints.yaml    # External API allowlist
└── README.md                 # This file
```

## Dependencies

- Nautilus server framework
- Seal SDK for key management
- Sui SDK for blockchain operations
- FastCrypto for cryptographic operations
