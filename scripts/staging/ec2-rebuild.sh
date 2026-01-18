#!/bin/bash
# ec2-rebuild.sh - Rebuild Medical Vault Insurer staging enclave on EC2 from local code
# Usage: ./ec2-rebuild.sh [--register] [--skip-rsync]
#
# NOTE: Code persists on stop/start. Use --skip-rsync if instance wasn't replaced.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
LOCAL_NAUTILUS_DIR="$SCRIPT_DIR/../.."

# Load config from .env
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env not found at $ENV_FILE"
  echo "Copy .env.example to .env and fill in the values"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

# Set defaults
INSTANCE_ID="${INSTANCE_ID:-i-074440a7ab3e41a84}"
INSTANCE_NAME="medical-vault-insurer"
REGION="${REGION:-ap-southeast-1}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/medical-vault-key.pem}"
REMOTE_DIR="~/sui_nautilus"
ENCLAVE_APP="medical-vault-insurer"

# Validate required variables
if [ -z "$ENCLAVE_PACKAGE_ID" ]; then
  echo "ERROR: ENCLAVE_PACKAGE_ID not set in .env"
  exit 1
fi

if [ -z "$ENCLAVE_CONFIG_ID" ]; then
  echo "ERROR: ENCLAVE_CONFIG_ID not set in .env"
  exit 1
fi

# ============================================
# PRE-FLIGHT CHECKS
# ============================================
echo "=== $INSTANCE_NAME Staging Enclave Rebuild ==="
echo ""

# Check SSH key
if [ ! -f "$SSH_KEY" ]; then
    echo "ERROR: SSH key not found at $SSH_KEY"
    echo "Update SSH_KEY in .env"
    exit 1
fi

# Check local directory exists
if [ ! -d "$LOCAL_NAUTILUS_DIR" ]; then
    echo "ERROR: Local nautilus directory not found at $LOCAL_NAUTILUS_DIR"
    exit 1
fi

# Get current public IP
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>/dev/null)

if [ -z "$PUBLIC_IP" ] || [ "$PUBLIC_IP" == "None" ]; then
    echo "ERROR: Could not get public IP. Is the instance running?"
    echo "Try: ./ec2-start.sh first"
    exit 1
fi

echo "Instance IP: $PUBLIC_IP"

# Check if instance is reachable via SSH
echo "Checking EC2 instance connectivity..."
if ! ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "ec2-user@$PUBLIC_IP" "echo 'SSH OK'" 2>/dev/null; then
    echo "ERROR: Cannot connect to EC2 instance at $PUBLIC_IP"
    echo "Make sure the instance is running. Try: ./ec2-start.sh --skip-register"
    exit 1
fi
echo "EC2 instance is reachable"

# Check if code exists on remote
echo "Checking remote code directory..."
REMOTE_CODE_EXISTS=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" \
    "test -d ~/sui_nautilus && echo 'exists' || echo 'missing'" 2>/dev/null)

# ============================================
# STEP 1: SYNC CODE (if needed)
# ============================================
if [ "$3" != "--skip-rsync" ] && [ "$REMOTE_CODE_EXISTS" == "missing" ]; then
    echo ""
    echo "=== Step 1: Syncing code to EC2 (first deploy) ==="
    echo "From: $LOCAL_NAUTILUS_DIR"
    echo "To:   ec2-user@$PUBLIC_IP:$REMOTE_DIR"
    echo ""

    rsync -avz --progress \
        --exclude 'target' \
        --exclude 'out' \
        --exclude '.git' \
        --exclude '.DS_Store' \
        --exclude '*.eif' \
        --exclude '*.pcrs' \
        --exclude '.terraform' \
        -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
        "$LOCAL_NAUTILUS_DIR/" \
        "ec2-user@$PUBLIC_IP:$REMOTE_DIR/"

    echo "Code synced successfully!"
elif [ "$3" != "--skip-rsync" ]; then
    echo ""
    echo "=== Step 1: Syncing local changes to EC2 ==="

    rsync -avz --progress \
        --exclude 'target' \
        --exclude 'out' \
        --exclude '.git' \
        --exclude '.DS_Store' \
        --exclude '*.eif' \
        --exclude '*.pcrs' \
        --exclude '.terraform' \
        -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
        "$LOCAL_NAUTILUS_DIR/" \
        "ec2-user@$PUBLIC_IP:$REMOTE_DIR/"

    echo "Code synced!"
else
    echo ""
    echo "=== Step 1: Skipping rsync (--skip-rsync or code exists) ==="
fi

# Copy .env to EC2
echo "Copying .env to EC2..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$ENV_FILE" "ec2-user@$PUBLIC_IP:/home/ec2-user/.env"

# ============================================
# STEP 2: REBUILD ENCLAVE ON EC2
# ============================================
echo ""
echo "=== Step 2: Rebuilding enclave on EC2 ==="
echo "This may take several minutes..."
echo ""

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" << 'ENDSSH'
set -e
cd ~/sui_nautilus

echo ">>> Setting execute permissions..."
chmod +x *.sh 2>/dev/null || true

echo ">>> Terminating existing enclave..."
sudo nitro-cli terminate-enclave --all 2>/dev/null || true

echo ">>> Building new enclave image..."
sudo make ENCLAVE_APP=medical-vault-insurer

echo ">>> Build complete!"
ENDSSH

# ============================================
# STEP 3: START ENCLAVE
# ============================================
echo ""
echo "=== Step 3: Starting enclave ==="

ENCLAVE_OUTPUT=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" \
    "sudo nitro-cli run-enclave --eif-path ~/sui_nautilus/out/nitro.eif --memory 2048 --cpu-count 2")

echo "$ENCLAVE_OUTPUT"

# Extract CID
ENCLAVE_CID=$(echo "$ENCLAVE_OUTPUT" | grep -o '"EnclaveCID": [0-9]*' | grep -o '[0-9]*')

if [ -z "$ENCLAVE_CID" ]; then
    echo "ERROR: Failed to get Enclave CID"
    exit 1
fi

echo ""
echo "Enclave started with CID: $ENCLAVE_CID"

# ============================================
# STEP 4: CONFIGURE ENCLAVE
# ============================================
echo ""
echo "=== Step 4: Configuring enclave (CID=$ENCLAVE_CID) ==="

# Get vsock-proxy endpoints from config
WALRUS_ENDPOINT="${WALRUS_AGGREGATOR:-aggregator.walrus-testnet.walrus.space:443}"
SUI_ENDPOINT="${SUI_RPC_TARGET:-fullnode.testnet.sui.io:443}"
OPENROUTER_ENDPOINT="${OPENROUTER_TARGET:-openrouter.ai:443}"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" << ENDSSH
set -e
CID=$ENCLAVE_CID

echo ">>> Waiting for enclave to initialize (10s)..."
sleep 10

echo ">>> Setting VSOCK permissions..."
sudo chmod 666 /dev/vsock 2>/dev/null || true

echo ">>> Killing old processes..."
pkill -f "socat-vsock.*3000" 2>/dev/null || true
pkill -f "vsock-proxy" 2>/dev/null || true
sleep 2

echo ">>> Updating vsock-proxy allowlist..."
# Extract hostnames (strip port if present) and create allowlist
WALRUS_HOST=$(echo "$WALRUS_ENDPOINT" | cut -d: -f1)
SUI_HOST=$(echo "$SUI_ENDPOINT" | cut -d: -f1)
OPENROUTER_HOST=$(echo "$OPENROUTER_ENDPOINT" | cut -d: -f1)
sudo bash -c "cat > /etc/nitro_enclaves/vsock-proxy.yaml << ALLOWLIST
allowlist:
- {address: $WALRUS_HOST, port: 443}
- {address: $SUI_HOST, port: 443}
- {address: $OPENROUTER_HOST, port: 443}
ALLOWLIST"

echo ">>> Starting port forwarding (CID=\$CID)..."
# Use Python-based forwarder since system socat doesn't have VSOCK support
# Note: Port 3000 is publicly exposed, port 3001 is EC2-local only (admin endpoints)
nohup python3 /home/ec2-user/tcp-vsock-forwarder.py 3000 $CID 3000 > /tmp/forwarder-3000.log 2>&1 &
# Port 3001 is bound to 127.0.0.1 - accessible via SSH tunnel only
# Access via: ssh -L 3001:localhost:3001 ec2-user@IP

echo ">>> Starting vsock-proxy for Walrus (port 8101)..."
nohup vsock-proxy 8101 $WALRUS_HOST 443 --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-walrus.log 2>&1 &

echo ">>> Starting vsock-proxy for Sui RPC (port 8102)..."
nohup vsock-proxy 8102 $SUI_HOST 443 --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-sui.log 2>&1 &

echo ">>> Starting vsock-proxy for OpenRouter (port 8103)..."
nohup vsock-proxy 8103 $OPENROUTER_HOST 443 --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-openrouter.log 2>&1 &

sleep 3

echo ">>> Waiting for enclave to respond (polling up to 60s)..."
for i in {1..30}; do
    if curl -s --max-time 3 http://localhost:3000/ 2>/dev/null | grep -q "Pong!"; then
        echo ">>> Enclave is ready!"
        exit 0
    fi
    sleep 2
done

echo "ERROR: Enclave not responding after 60s"
echo "Checking enclave status..."
sudo nitro-cli describe-enclaves
echo ""
echo "Logs:"
cat /tmp/socat-3000.log 2>/dev/null || true
exit 1
ENDSSH

# ============================================
# STEP 5: VERIFY ENCLAVE
# ============================================
echo ""
echo "=== Step 5: Verifying enclave ==="
sleep 3

RESPONSE=$(curl -s --max-time 10 http://$PUBLIC_IP:3000/ 2>/dev/null)
if [ "$RESPONSE" == "Pong!" ]; then
    echo "Enclave is running and responding!"
else
    echo "WARNING: Enclave not responding yet"
    echo "Response: $RESPONSE"
    echo ""
    echo "Debug commands:"
    echo "  ssh -i $SSH_KEY ec2-user@$PUBLIC_IP"
    echo "  sudo nitro-cli describe-enclaves"
    echo "  curl http://localhost:3000/"
    echo "  cat /tmp/socat-3000.log"
fi

# ============================================
# STEP 6: REGISTER (OPTIONAL)
# ============================================
if [ "$1" == "--register" ]; then
    echo ""
    echo "=== Step 6: Registering enclave on-chain ==="
    "$SCRIPT_DIR/ec2-start.sh" --register
else
    echo ""
    echo "============================================"
    echo "=== STAGING REBUILD COMPLETE ==="
    echo "============================================"
    echo ""
    echo "Instance:    $INSTANCE_NAME"
    echo "IP:          $PUBLIC_IP"
    echo "API:         http://$PUBLIC_IP:3000/"
    echo "Admin:       http://$PUBLIC_IP:3001/"
    echo "Enclave CID: $ENCLAVE_CID"
    echo ""
    echo "NOTE: Enclave attestation (PCRs) has changed!"
    echo "To register the new enclave on-chain, run:"
    echo "  ./ec2-rebuild.sh --register"
    echo "  OR"
    echo "  ./ec2-start.sh --register"
fi
