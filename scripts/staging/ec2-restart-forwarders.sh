#!/bin/bash
# ec2-restart-forwarders.sh - Restart port forwarders when enclave CID changes
# Usage: ./ec2-restart-forwarders.sh
#
# This script:
# 1. Gets current enclave CID
# 2. Kills all old forwarder and vsock-proxy processes (including orphaned sudo wrappers)
# 3. Updates vsock-proxy allowlist config
# 4. Starts TCP-VSOCK forwarders for ports 3000 and 3001
# 5. Starts vsock-proxy services for Walrus, Sui, and OpenRouter
# 6. Verifies the enclave API is responding

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# Load config from .env
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# Defaults
INSTANCE_ID="${INSTANCE_ID:-i-03992c29f04547b14}"
REGION="${REGION:-ap-southeast-1}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/medical-vault-key.pem}"

# Get current public IP
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>/dev/null)

if [ -z "$PUBLIC_IP" ] || [ "$PUBLIC_IP" == "None" ]; then
    echo "ERROR: Could not get public IP"
    exit 1
fi

echo "=== Restarting Port Forwarders ==="
echo "Instance IP: $PUBLIC_IP"

# Get current CID
ENCLAVE_CID=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" \
    "sudo nitro-cli describe-enclaves 2>/dev/null | grep -o '\"EnclaveCID\": [0-9]*' | grep -o '[0-9]*'" 2>/dev/null)

if [ -z "$ENCLAVE_CID" ]; then
    echo "ERROR: Could not get Enclave CID"
    exit 1
fi

echo "Enclave CID: $ENCLAVE_CID"

# ==============================================================================
# STEP 1: Kill all old processes (forwarders and vsock-proxy)
# ==============================================================================
echo ""
echo "=== Step 1: Killing old processes ==="

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" << 'REMOTE'
# Kill TCP-VSOCK forwarders
echo "Killing TCP-VSOCK forwarders..."
pkill -9 -f tcp-vsock-forwarder 2>/dev/null || true

# Kill ALL vsock-proxy processes (including sudo wrapper processes)
echo "Killing all vsock-proxy processes..."
sudo pkill -9 vsock-proxy 2>/dev/null || true
sleep 2

# Verify all killed
echo "Verifying processes killed..."
ps aux | grep -E "vsock-proxy|tcp-vsock" | grep -v grep || echo "All processes killed"
REMOTE

sleep 1

# ==============================================================================
# STEP 2: Update vsock-proxy config and start services
# ==============================================================================
echo ""
echo "=== Step 2: Updating vsock-proxy config and starting services ==="

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" << 'REMOTE'
# Update vsock-proxy allowlist config
echo "Updating vsock-proxy allowlist..."
sudo bash -c 'cat > /etc/nitro_enclaves/vsock-proxy.yaml << EOF
allowlist:
- {address: aggregator.walrus-testnet.walrus.space, port: 443}
- {address: fullnode.testnet.sui.io, port: 443}
- {address: openrouter.ai, port: 443}
EOF'

echo "Config contents:"
cat /etc/nitro_enclaves/vsock-proxy.yaml

echo ""
echo "Starting vsock-proxy services..."

# Start vsock-proxy services for each endpoint
# Port 8101: Walrus Aggregator
sudo vsock-proxy 8101 aggregator.walrus-testnet.walrus.space 443 \
    --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-walrus.log 2>&1 &

# Port 8102: Sui RPC
sudo vsock-proxy 8102 fullnode.testnet.sui.io 443 \
    --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-sui.log 2>&1 &

# Port 8103: OpenRouter
sudo vsock-proxy 8103 openrouter.ai 443 \
    --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-openrouter.log 2>&1 &

echo "vsock-proxy services started"
REMOTE

sleep 2

# ==============================================================================
# STEP 3: Start TCP-VSOCK forwarders
# ==============================================================================
echo ""
echo "=== Step 3: Starting TCP-VSOCK forwarders ==="

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" << REMOTE
# Start forwarders for ports 3000 (public API) and 3001 (admin)
echo "Starting forwarders for CID $ENCLAVE_CID..."
nohup python3 /home/ec2-user/tcp-vsock-forwarder.py 3000 $ENCLAVE_CID 3000 > /tmp/forwarder-3000.log 2>&1 &
nohup python3 /home/ec2-user/tcp-vsock-forwarder.py 3001 $ENCLAVE_CID 3001 > /tmp/forwarder-3001.log 2>&1 &
echo "Forwarders started"
REMOTE

sleep 2

# ==============================================================================
# STEP 4: Verify all services are running
# ==============================================================================
echo ""
echo "=== Step 4: Verifying services ==="

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" << 'REMOTE'
echo "=== Process Status ==="
ps aux | grep -E "vsock-proxy|tcp-vsock" | grep -v grep

echo ""
echo "=== vsock-proxy Logs ==="
echo "--- Walrus (8101) ---"
tail -3 /tmp/vsock-proxy-walrus.log 2>/dev/null || echo "No log yet"
echo "--- Sui (8102) ---"
tail -3 /tmp/vsock-proxy-sui.log 2>/dev/null || echo "No log yet"
echo "--- OpenRouter (8103) ---"
tail -3 /tmp/vsock-proxy-openrouter.log 2>/dev/null || echo "No log yet"

echo ""
echo "=== API Test (localhost:3000) ==="
curl -s --max-time 5 http://localhost:3000/ 2>&1 || echo "FAILED"
REMOTE

# ==============================================================================
# STEP 5: Verify public API
# ==============================================================================
echo ""
echo "=== Step 5: Verifying public API ==="
RESPONSE=$(curl -s --max-time 10 "http://$PUBLIC_IP:3000/" 2>/dev/null || echo "")
if echo "$RESPONSE" | grep -q "Pong\|pk=\|endpoints_status"; then
    echo "SUCCESS: Enclave is responding on port 3000"
else
    echo "WARNING: Enclave not responding on port 3000"
    echo "Response: $RESPONSE"
fi

echo ""
echo "============================================"
echo "=== RESTART COMPLETE ==="
echo "============================================"
echo ""
echo "Enclave CID: $ENCLAVE_CID"
echo "Instance IP: $PUBLIC_IP"
echo ""
echo "Endpoints:"
echo "  API:      http://$PUBLIC_IP:3000/"
echo "  Admin:    http://localhost:3001/ (via SSH tunnel)"
echo ""
echo "vsock-proxy services:"
echo "  8101 -> aggregator.walrus-testnet.walrus.space:443"
echo "  8102 -> fullnode.testnet.sui.io:443"
echo "  8103 -> openrouter.ai:443"
echo ""
echo "Log files:"
echo "  /tmp/forwarder-3000.log"
echo "  /tmp/forwarder-3001.log"
echo "  /tmp/vsock-proxy-walrus.log"
echo "  /tmp/vsock-proxy-sui.log"
echo "  /tmp/vsock-proxy-openrouter.log"
