#!/bin/bash
# provision-api-key.sh - Fetch Seal keys and provision API key to enclave
# Usage: ./provision-api-key.sh [enclave_obj_id] [enclave_obj_version]

set -e

# Default values
ENCLAVE_OBJ_ID="${1:-0xb6bbabc3611c1a9e82cb371d7055c04c0c847f53f2869d733ae1c8e57bfae1ae}"
ENCLAVE_OBJ_VERSION="${2:-733660157}"

# Seal configuration
SEAL_CLI="${SEAL_CLI:-/Users/s6klabs/Documents/dev/seal/target/debug/seal-cli}"
SEAL_REPO_DIR="${SEAL_REPO_DIR:-/Users/s6klabs/Documents/dev/seal}"
SEAL_SERVERS="0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
SEAL_THRESHOLD=2
SEAL_NETWORK="testnet"

# Check if seal-cli exists, try to build if not
if [ ! -f "$SEAL_CLI" ]; then
    echo "seal-cli not found at $SEAL_CLI"
    echo "Building seal-cli..."
    cd "$SEAL_REPO_DIR"
    cargo build --bin seal-cli --release 2>/dev/null || cargo build --bin seal-cli
    SEAL_CLI="$SEAL_REPO_DIR/target/release/seal-cli"
    if [ ! -f "$SEAL_CLI" ]; then
        SEAL_CLI="$SEAL_REPO_DIR/target/debug/seal-cli"
    fi
    echo "Built seal-cli at $SEAL_CLI"
fi

echo "Using seal-cli: $SEAL_CLI"

echo ""
echo "=== Step 1: Initialize Seal Key Load ==="
RESPONSE=$(curl -s -X POST http://localhost:3001/admin/init_seal_key_load \
  -H 'Content-Type: application/json' \
  -d "{\"enclave_object_id\": \"$ENCLAVE_OBJ_ID\", \"initial_shared_version\": $ENCLAVE_OBJ_VERSION}")

ENCODED_REQUEST=$(echo "$RESPONSE" | jq -r '.encoded_request')
echo "Encoded request: ${ENCODED_REQUEST:0:50}..."

echo ""
echo "=== Step 2: Fetch Keys from Seal Servers ==="
SEAL_RESPONSE=$("$SEAL_CLI" fetch-keys --request "$ENCODED_REQUEST" \
  -k "$SEAL_SERVERS" \
  -t "$SEAL_THRESHOLD" \
  -n "$SEAL_NETWORK")

echo "Seal response: ${SEAL_RESPONSE:0:50}..."

echo ""
echo "=== Step 3: Complete Seal Key Load ==="
curl -s -X POST http://localhost:3001/admin/complete_seal_key_load \
  -H 'Content-Type: application/json' \
  -d "{\"seal_responses\": \"$SEAL_RESPONSE\"}"

echo ""
echo "=== Step 4: Provision OpenRouter API Key ==="
curl -s -X POST http://localhost:3001/admin/provision_openrouter_api_key \
  -H 'Content-Type: application/json' \
  -d '{"api_key": "'"$OPENROUTER_API_KEY"'"}'

echo ""
echo "=== Provisioning Complete ==="
