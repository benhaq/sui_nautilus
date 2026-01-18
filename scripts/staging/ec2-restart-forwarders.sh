#!/bin/bash
# ec2-restart-forwarders.sh - Restart port forwarders when enclave CID changes
# Usage: ./ec2-restart-forwarders.sh

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
INSTANCE_ID="${INSTANCE_ID:-i-074440a7ab3e41a84}"
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
    "sudo nitro-cli describe-enclaves | grep -o '\"EnclaveCID\": [0-9]*' | grep -o '[0-9]*'" 2>/dev/null)

if [ -z "$ENCLAVE_CID" ]; then
    echo "ERROR: Could not get Enclave CID"
    exit 1
fi

echo "Enclave CID: $ENCLAVE_CID"

# Kill old forwarders
echo "Killing old forwarders..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" \
    "pkill -f tcp-vsock-forwarder 2>/dev/null || true"
sleep 1

# Start new forwarders (port 3000 public, 3001 EC2-local via forwarder)
echo "Starting forwarders..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" << EOF
nohup python3 /home/ec2-user/tcp-vsock-forwarder.py 3000 $ENCLAVE_CID 3000 > /tmp/forwarder-3000.log 2>&1 &
nohup python3 /home/ec2-user/tcp-vsock-forwarder.py 3001 $ENCLAVE_CID 3001 > /tmp/forwarder-3001.log 2>&1 &
echo "Forwarders started for ports 3000 and 3001"
EOF

echo ""
echo "=== Restarting vsock-proxy services ==="
# Restart vsock-proxy (ensures config is correct and services are running)
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "ec2-user@$PUBLIC_IP" << 'EOF'
# Kill old vsock-proxy processes
sudo pkill -f "vsock-proxy" 2>/dev/null || true
sleep 1

# Ensure config is correct (proper YAML format without :443 in address)
sudo bash -c 'cat > /etc/nitro_enclaves/vsock-proxy.yaml << ALLOWLIST
allowlist:
- {address: aggregator.walrus-testnet.walrus.space, port: 443}
- {address: fullnode.testnet.sui.io, port: 443}
- {address: openrouter.ai, port: 443}
ALLOWLIST'

# Verify config
cat /etc/nitro_enclaves/vsock-proxy.yaml

# Start vsock-proxy services
sudo vsock-proxy 8101 aggregator.walrus-testnet.walrus.space 443 --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-walrus.log 2>&1 &
sudo vsock-proxy 8102 fullnode.testnet.sui.io 443 --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-sui.log 2>&1 &
sudo vsock-proxy 8103 openrouter.ai 443 --config /etc/nitro_enclaves/vsock-proxy.yaml > /tmp/vsock-proxy-openrouter.log 2>&1 &
sleep 2

# Verify
echo "=== vsock-proxy status ==="
ps aux | grep vsock-proxy | grep -v grep
echo "=== vsock-proxy logs ==="
cat /tmp/vsock-proxy-openrouter.log 2>/dev/null | tail -3
EOF

sleep 2

# Verify
echo "Verifying..."
RESPONSE=$(curl -s --max-time 10 "http://$PUBLIC_IP:3000/")
if echo "$RESPONSE" | grep -q "Pong\|pk=\|endpoints_status"; then
    echo "SUCCESS: Enclave is responding on port 3000"
else
    echo "WARNING: Enclave not responding on port 3000"
    echo "Response: $RESPONSE"
fi

echo ""
echo "Forwarders restarted with CID: $ENCLAVE_CID"
echo "API:      http://$PUBLIC_IP:3000/"
echo "Admin:    http://localhost:3001/ (via SSH tunnel: ssh -L 3001:localhost:3001 ec2-user@$PUBLIC_IP)"
echo ""
echo "vsock-proxy services: ports 8101 (Walrus), 8102 (Sui), 8103 (OpenRouter)"
