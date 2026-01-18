#!/bin/bash
# ec2-status.sh - Check Medical Vault Insurer EC2 instance status
# Usage: ./ec2-status.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

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

echo "=== $INSTANCE_NAME Instance Status ==="
echo ""

# Get instance info
INFO=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
  --query 'Reservations[0].Instances[0].[State.Name,InstanceType,PublicIpAddress,InstanceLifecycle]' \
  --output text 2>/dev/null)

STATE=$(echo "$INFO" | awk '{print $1}')
TYPE=$(echo "$INFO" | awk '{print $2}')
IP=$(echo "$INFO" | awk '{print $3}')
LIFECYCLE=$(echo "$INFO" | awk '{print $4}')

echo "Name:     $INSTANCE_NAME"
echo "Type:     $TYPE"
echo "State:    $STATE"
echo "IP:       $IP"
if [ "$LIFECYCLE" == "spot" ]; then
  echo "Lifecycle: Spot Instance (Elastic IP prevents changes)"
fi
echo ""

if [ "$STATE" == "running" ]; then
  echo "=== Nitro Enclave Allocator Service ==="
  ALLOCATOR_STATUS=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 ec2-user@$IP \
    "sudo systemctl is-active nitro-enclaves-allocator.service" 2>/dev/null || echo "unknown")
  echo "Allocator: $ALLOCATOR_STATUS"
  echo ""

  echo "=== Enclave Status ==="
  RESPONSE=$(curl -s --max-time 5 http://$IP:3000/ 2>/dev/null)
  if [ "$RESPONSE" == "Pong!" ]; then
    echo "Enclave:  Running"
    echo "API:      http://$IP:3000/"
    echo "Admin:    http://$IP:3001/"

    # Check admin endpoints
    echo ""
    echo "=== Admin Endpoints ==="
    PING=$(curl -s --max-time 3 http://$IP:3001/ping 2>/dev/null)
    echo "Ping:     ${PING:-Not responding}"
  else
    echo "Enclave:  Not responding"
    echo "          (May still be starting, wait 1-2 minutes)"
    echo ""
    echo "=== Quick Debug ==="
    echo "1. Check if EC2 is running: aws ec2 describe-instances --instance-id $INSTANCE_ID"
    echo "2. SSH to instance: ssh -i $SSH_KEY ec2-user@$IP"
    echo "3. Check enclave: sudo nitro-cli describe-enclaves"
    echo "4. Check logs: cat /tmp/socat-3000.log"
  fi
else
  echo "Instance is $STATE - enclave not available"
  echo ""
  echo "To start: ./ec2-start.sh"
fi
