#!/bin/bash
# ec2-start.sh - Start Medical Vault Insurer EC2 instance and register enclave
# Usage: ./ec2-start.sh [--register] [--skip-register]
#
# Options:
#   --register       Force re-register enclave even if running
#   --skip-register  Skip enclave registration (just start)

# ============================================
# CONFIGURATION (STAGING)
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# Load config from .env
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env not found at $ENV_FILE"
  echo "Copy .env.example to .env and fill in the values"
  exit 1
fi

# Source the env file for variables
set -a
source "$ENV_FILE"
set +a

# Set defaults if not specified
INSTANCE_ID="${INSTANCE_ID:-i-03992c29f04547b14}"
INSTANCE_NAME="medical-vault-insurer"
REGION="${REGION:-ap-southeast-1}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/medical-vault-key.pem}"
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

if [ -z "$CAP_OBJECT_ID" ]; then
  echo "ERROR: CAP_OBJECT_ID not set in .env"
  exit 1
fi

if [ -z "$ENCLAVE_TYPE_ARG" ]; then
  echo "ERROR: ENCLAVE_TYPE_ARG not set in .env"
  exit 1
fi

if [ -z "$SUI_RPC_URL" ]; then
  echo "ERROR: SUI_RPC_URL not set in .env"
  exit 1
fi

echo "=== Starting $INSTANCE_NAME (Staging) ==="

# Check current state
STATE=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
  --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null)

# Get current public IP (spot instance - IP changes on restart)
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>/dev/null)

if [ "$STATE" == "running" ]; then
  echo "Instance is already running"
  echo "   IP: $PUBLIC_IP"
  echo "   Testing enclave..."
  RESPONSE=$(curl -s --max-time 5 http://$PUBLIC_IP:3000/ 2>/dev/null)
  if [ "$RESPONSE" == "Pong!" ]; then
    echo "   Enclave: Running ✓"
    if [ "$1" != "--register" ]; then
      echo ""
      echo "============================================"
      echo "Staging enclave is already running!"
      echo "============================================"
      echo "IP:  $PUBLIC_IP"
      echo "API: http://$PUBLIC_IP:3000/"
      echo ""
      echo "To re-register enclave: ./ec2-start.sh --register"
      exit 0
    fi
  else
    echo "   Enclave: Not responding - will restart"
  fi
fi

# Start instance if not running
if [ "$STATE" != "running" ]; then
  # Check if this is a spot instance with disabled request (happens after stop)
  SPOT_REQUEST_ID=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
    --query 'Reservations[0].Instances[0].SpotInstanceRequestId' --output text 2>/dev/null)

  if [ -n "$SPOT_REQUEST_ID" ] && [ "$SPOT_REQUEST_ID" != "None" ]; then
    SPOT_STATE=$(aws ec2 describe-spot-instance-requests --spot-instance-request-ids "$SPOT_REQUEST_ID" \
      --region "$REGION" --query 'SpotInstanceRequests[0].State' --output text 2>/dev/null)

    if [ "$SPOT_STATE" == "disabled" ]; then
      echo "Spot request is disabled (normal after stop). Starting will re-enable it..."
    fi
  fi

  echo "Starting instance..."
  START_RESULT=$(aws ec2 start-instances --instance-ids "$INSTANCE_ID" --region "$REGION" 2>&1)

  if [ $? -ne 0 ]; then
    # Check for spot-specific error
    if echo "$START_RESULT" | grep -q "IncorrectSpotRequestState"; then
      echo ""
      echo "ERROR: Spot instance cannot be started."
      echo "This can happen if the spot request was cancelled or there's a capacity issue."
      echo ""
      echo "Checking spot request status..."
      aws ec2 describe-spot-instance-requests --spot-instance-request-ids "$SPOT_REQUEST_ID" \
        --region "$REGION" --query 'SpotInstanceRequests[0].{State:State,Status:Status.Code,Message:Status.Message}' \
        --output table 2>/dev/null
      echo ""
      echo "You may need to:"
      echo "  1. Wait a few minutes and try again"
      echo "  2. Or terminate this instance and create a new spot request"
      exit 1
    else
      echo "ERROR: Failed to start instance"
      echo "$START_RESULT"
      exit 1
    fi
  fi

  echo "Waiting for instance to start..."
  aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"
  echo "Instance running!"

  # Get new public IP after start
  PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>/dev/null)
  echo ""
  echo "============================================"
  echo "NEW PUBLIC IP: $PUBLIC_IP"
  echo "============================================"
  echo "(IP changed because this is a spot instance)"
  echo ""

  # Wait for SSH to be ready
  echo "Waiting for SSH to be ready (30s)..."
  sleep 30
fi

# ============================================
# START ENCLAVE
# ============================================
echo ""
echo "=== Starting Enclave ==="

# Check if enclave is already running
RESPONSE=$(curl -s --max-time 5 http://$PUBLIC_IP:3000/ 2>/dev/null)
if [ "$RESPONSE" != "Pong!" ]; then
  echo "Enclave not running. Starting via SSH..."

  # Check SSH key exists
  if [ ! -f "$SSH_KEY" ]; then
    echo "ERROR: SSH key not found at $SSH_KEY"
    echo "Please update SSH_KEY path in .env"
    exit 1
  fi

  # Check if startup script exists on EC2, create if not
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 ec2-user@$PUBLIC_IP \
    "test -f /home/ec2-user/enclave-startup.sh" 2>/dev/null

  if [ $? -ne 0 ]; then
    echo "Creating enclave-startup.sh on EC2..."

    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP << 'EOFSTARTUP'
cat > /home/ec2-user/enclave-startup.sh << 'EOF'
#!/bin/bash
set -e

# Load configuration
source /home/ec2-user/.env 2>/dev/null || true

# Set defaults
ENCLAVE_APP="${ENCLAVE_APP:-medical-vault-insurer}"
REMOTE_DIR="~/sui_nautilus"

echo "=== Stopping any existing enclave ==="
sudo nitro-cli terminate-enclave --all 2>/dev/null || true

echo "=== Checking if code and EIF exist ==="
if [ ! -d "$REMOTE_DIR" ]; then
    echo "Code not found. Please run ec2-rebuild.sh first to sync code."
    exit 1
fi

if [ ! -f "$REMOTE_DIR/out/nitro.eif" ]; then
    echo "EIF not found. Building enclave..."
    cd "$REMOTE_DIR"
    make ENCLAVE_APP=$ENCLAVE_APP
fi

echo "=== Starting enclave ==="
RESULT=$(nitro-cli run-enclave --eif-path $REMOTE_DIR/out/nitro.eif --memory 2048 --cpu-count 2)
echo "$RESULT"

CID=$(echo "$RESULT" | grep -o '"EnclaveCID": [0-9]*' | grep -o '[0-9]*')
if [ -z "$CID" ]; then
    echo "ERROR: Failed to get enclave CID"
    exit 1
fi
echo "Enclave CID: $CID"

echo "=== Waiting for enclave to initialize (5s) ==="
sleep 5

# Set VSOCK permissions
sudo chmod 666 /dev/vsock 2>/dev/null || true

echo "=== Killing old processes ==="
pkill -f "socat-vsock.*3000" 2>/dev/null || true
pkill -f "vsock-proxy" 2>/dev/null || true
sleep 2

# Get vsock-proxy endpoints from config
WALRUS_HOST=$(echo "${WALRUS_AGGREGATOR:-aggregator.walrus-testnet.walrus.space:443}" | cut -d: -f1)
SUI_HOST=$(echo "${SUI_RPC_TARGET:-fullnode.testnet.sui.io:443}" | cut -d: -f1)
OPENROUTER_HOST=$(echo "${OPENROUTER_TARGET:-openrouter.ai:443}" | cut -d: -f1)

echo "=== Updating vsock-proxy allowlist ==="
sudo bash -c 'cat > /etc/nitro_enclaves/vsock-proxy.yaml << ALLOWLIST
allowlist:
- {address: '$WALRUS_HOST', port: 443}
- {address: '$SUI_HOST', port: 443}
- {address: '$OPENROUTER_HOST', port: 443}
ALLOWLIST'

echo "=== Starting port forwarding (TCP -> VSOCK) ==="
# Use Python-based forwarder since system socat doesn't have VSOCK support
nohup python3 /home/ec2-user/tcp-vsock-forwarder.py 3000 $CID 3000 > /tmp/forwarder-3000.log 2>&1 &
nohup python3 /home/ec2-user/tcp-vsock-forwarder.py 3001 $CID 3001 > /tmp/forwarder-3001.log 2>&1 &

echo "=== Starting vsock-proxy for Walrus (port 8101) ==="
nohup vsock-proxy 8101 $WALRUS_HOST 443 --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-walrus.log 2>&1 &

echo "=== Starting vsock-proxy for Sui RPC (port 8102) ==="
nohup vsock-proxy 8102 $SUI_HOST 443 --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-sui.log 2>&1 &

echo "=== Starting vsock-proxy for OpenRouter (port 8103) ==="
nohup vsock-proxy 8103 $OPENROUTER_HOST 443 --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-openrouter.log 2>&1 &

for i in {1..20}; do
    RESPONSE=$(curl -s --max-time 3 http://localhost:3000/ 2>/dev/null)
    if [ "$RESPONSE" == "Pong!" ]; then
        echo "Enclave ready!"
        exit 0
    fi
    sleep 2
done
echo "ERROR: Enclave not responding"
exit 1
EOF
chmod +x /home/ec2-user/enclave-startup.sh
EOFSTARTUP
  fi

  # Copy .env to EC2 for enclave to source
  echo "Copying .env to EC2..."
  scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$ENV_FILE" "ec2-user@$PUBLIC_IP:/home/ec2-user/.env"

  # Run startup script on EC2
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 ec2-user@$PUBLIC_IP \
    "sudo /home/ec2-user/enclave-startup.sh" 2>&1

  if [ $? -ne 0 ]; then
    echo "ERROR: Failed to start enclave via SSH"
    exit 1
  fi

  # Wait and verify
  echo "Waiting for enclave to be ready..."
  sleep 5
fi

# Verify enclave is running
RESPONSE=$(curl -s --max-time 10 http://$PUBLIC_IP:3000/ 2>/dev/null)
if [ "$RESPONSE" != "Pong!" ]; then
  echo "ERROR: Enclave not responding"
  echo "Try manually: ssh -i $SSH_KEY ec2-user@$PUBLIC_IP"
  exit 1
fi
echo "Enclave ready!"

# Skip registration if requested
if [ "$1" == "--skip-register" ]; then
  echo ""
  echo "============================================"
  echo "=== STAGING ENCLAVE STARTED ==="
  echo "============================================"
  echo "Instance: $INSTANCE_NAME"
  echo "IP:       $PUBLIC_IP"
  echo "API:      http://$PUBLIC_IP:3000/"
  echo ""
  echo "Skipped registration (use --register to register)"
  exit 0
fi

# ============================================
# REGISTER ENCLAVE ON-CHAIN
# ============================================
echo ""
echo "=== Registering Enclave On-Chain ==="

# Get PCRs directly from nitro-cli (more reliable than parsing attestation)
echo "Getting PCRs from nitro-cli..."
PCRS=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP \
  "sudo nitro-cli describe-enclaves 2>/dev/null | jq -r '.[0].Measurements | .PCR0, .PCR1, .PCR2'" 2>/dev/null || echo "")

if [ -z "$PCRS" ]; then
  echo "ERROR: Failed to get PCRs from nitro-cli"
  exit 1
fi

PCR0=$(echo "$PCRS" | sed -n '1p')
PCR1=$(echo "$PCRS" | sed -n '2p')
PCR2=$(echo "$PCRS" | sed -n '3p')

echo "PCR0: ${PCR0:0:16}..."
echo "PCR1: ${PCR1:0:16}..."
echo "PCR2: ${PCR2:0:16}..."

# Fetch attestation from enclave (needed for on-chain registration)
echo ""
echo "Fetching attestation from enclave..."
ATTESTATION_HEX=$(curl -s http://$PUBLIC_IP:3000/get_attestation | jq -r '.attestation')

if [ -z "$ATTESTATION_HEX" ] || [ "$ATTESTATION_HEX" == "null" ]; then
  echo "ERROR: Failed to get attestation from enclave"
  exit 1
fi
echo "Got attestation (length: ${#ATTESTATION_HEX})"

# Convert attestation to Sui vector format
echo "Converting attestation to Sui format..."
ATTESTATION_ARRAY=$(python3 - <<EOF
hex_string = "$ATTESTATION_HEX"
byte_values = [str(int(hex_string[i:i+2], 16)) for i in range(0, len(hex_string), 2)]
rust_array = [f"{byte}u8" for byte in byte_values]
print(f"[{', '.join(rust_array)}]")
EOF
)

# Get CAP object ID from environment or use default
CAP_OBJECT_ID="${CAP_OBJECT_ID:-0x0000000000000000000000000000000000000000000000000000000000000005}"

echo ""
echo "=== Step 1: Update PCRs On-Chain ==="

# Update PCRs
UPDATE_PCR_RESULT=$(sui client ptb \
  --assign pcr0 "vector[$(python3 - <<EOF
hex_string = "$PCR0"
byte_values = [str(int(hex_string[i:i+2], 16)) for i in range(0, len(hex_string), 2)]
print(', '.join(byte_values))
EOF
)]" \
  --assign pcr1 "vector[$(python3 - <<EOF
hex_string = "$PCR1"
byte_values = [str(int(hex_string[i:i+2], 16)) for i in range(0, len(hex_string), 2)]
print(', '.join(byte_values))
EOF
)]" \
  --assign pcr2 "vector[$(python3 - <<EOF
hex_string = "$PCR2"
byte_values = [str(int(hex_string[i:i+2], 16)) for i in range(0, len(hex_string), 2)]
print(', '.join(byte_values))
EOF
)]" \
  --move-call "${ENCLAVE_PACKAGE_ID}::enclave::update_pcrs<${ENCLAVE_PACKAGE_ID}::${ENCLAVE_TYPE_ARG}>" @${ENCLAVE_CONFIG_ID} @${CAP_OBJECT_ID} pcr0 pcr1 pcr2 \
  --gas-budget 100000000 2>&1)

if [ $? -ne 0 ]; then
  echo "ERROR: Failed to update PCRs"
  echo "$UPDATE_PCR_RESULT"
  exit 1
fi

UPDATE_PCR_TX=$(echo "$UPDATE_PCR_RESULT" | grep "Transaction Digest:" | awk '{print $3}')
echo "PCRs updated: $UPDATE_PCR_TX"

echo ""
echo "=== Step 2: Register Enclave On-Chain ==="

# Register enclave on Sui
RESULT=$(sui client ptb \
  --assign v "vector$ATTESTATION_ARRAY" \
  --move-call "0x2::nitro_attestation::load_nitro_attestation" v @0x6 \
  --assign result \
  --move-call "${ENCLAVE_PACKAGE_ID}::enclave::register_enclave<${ENCLAVE_PACKAGE_ID}::${ENCLAVE_TYPE_ARG}>" @${ENCLAVE_CONFIG_ID} result \
  --gas-budget 100000000 2>&1)

if [ $? -ne 0 ]; then
  echo "ERROR: Failed to register enclave"
  echo "$RESULT"
  exit 1
fi

# Extract transaction digest
TX_DIGEST=$(echo "$RESULT" | grep "Transaction Digest:" | awk '{print $3}')

# Extract new ENCLAVE_ID using jq (more reliable)
if command -v jq &> /dev/null; then
  NEW_ENCLAVE_ID=$(sui client tx-block "$TX_DIGEST" --json 2>/dev/null | \
    jq -r '.objectChanges[] | select(.type == "created") | select(.objectType | contains("enclave::Enclave")) | .objectId' 2>/dev/null)
fi

# Fallback to grep if jq method fails
if [ -z "$NEW_ENCLAVE_ID" ]; then
  NEW_ENCLAVE_ID=$(echo "$RESULT" | grep -A5 "Created Objects" | grep -o '0x[a-f0-9]*' | head -1)
fi

echo ""
echo "============================================"
echo "=== STAGING ENCLAVE STARTED AND REGISTERED ==="
echo "============================================"
echo ""
echo "Instance:     $INSTANCE_NAME"
echo "IP:           $PUBLIC_IP"
echo "API:          http://$PUBLIC_IP:3000/"
echo ""
echo "PCR Update:   $UPDATE_PCR_TX"
echo "Registration: $TX_DIGEST"
echo ""

if [ -n "$NEW_ENCLAVE_ID" ]; then
  echo "============================================"
  echo "NEW ENCLAVE_ID: $NEW_ENCLAVE_ID"
  echo "============================================"

  # ============================================
  # UPDATE .env (local)
  # ============================================
  if [ -f "$ENV_FILE" ]; then
    echo ""
    echo "=== Updating .env (local) ==="

    # Update ENCLAVE_ID
    if grep -q "^ENCLAVE_ID=" "$ENV_FILE"; then
      sed -i '' "s|^ENCLAVE_ID=.*|ENCLAVE_ID=$NEW_ENCLAVE_ID|" "$ENV_FILE"
    else
      echo "ENCLAVE_ID=$NEW_ENCLAVE_ID" >> "$ENV_FILE"
    fi

    # Update ENCLAVE_URL (IP changes on spot instance)
    if grep -q "^ENCLAVE_URL=" "$ENV_FILE"; then
      sed -i '' "s|^ENCLAVE_URL=.*|ENCLAVE_URL=http://$PUBLIC_IP:3000|" "$ENV_FILE"
    else
      echo "ENCLAVE_URL=http://$PUBLIC_IP:3000" >> "$ENV_FILE"
    fi

    echo "Updated .env:"
    echo "  ENCLAVE_ID=$NEW_ENCLAVE_ID"
    echo "  ENCLAVE_URL=http://$PUBLIC_IP:3000"
  fi

  echo ""
  echo "=== DONE ==="
else
  echo "Transaction successful but could not extract ENCLAVE_ID."
  echo "Check transaction on explorer:"
  echo "  https://suiscan.xyz/testnet/tx/$TX_DIGEST"
fi
