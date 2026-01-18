#!/bin/bash
# ec2-stop.sh - Stop Medical Vault Insurer EC2 instance
# Usage: ./ec2-stop.sh
#
# NOTE: The Elastic IP will persist and be re-associated when you start again.
#       This prevents the IP change issue with spot instances.

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

echo "=== Stopping $INSTANCE_NAME (Staging) ==="

# Check current state
STATE=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
  --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null)

if [ "$STATE" == "stopped" ]; then
  echo "Instance is already stopped"
  exit 0
fi

# Stop instance
echo "Stopping instance..."
aws ec2 stop-instances --instance-ids "$INSTANCE_ID" --region "$REGION" > /dev/null

# Wait for stopped
echo "Waiting for instance to stop..."
aws ec2 wait instance-stopped --instance-ids "$INSTANCE_ID" --region "$REGION"

echo ""
echo "Instance stopped!"
echo ""
echo "=== What to expect when starting again ==="
echo "- Code at ~/sui_nautilus will persist"
echo "- No need to rsync unless you made local changes"
echo "- Enclave will need to be restarted: ./ec2-start.sh --skip-register"
echo "- Elastic IP will be re-associated automatically"
echo ""
echo "Run ./ec2-start.sh to start again"
