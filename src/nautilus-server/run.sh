#!/bin/sh
# Copyright (c), Mysten Labs, Inc.
# SPDX-License-Identifier: Apache-2.0

# - Setup script for nautilus-server that acts as an init script
# - Sets up Python and library paths
# - Configures loopback network and /etc/hosts
# - Waits for secrets.json to be passed from the parent instance. 
# - Forwards VSOCK port 3000 to localhost:3000
# - Optionally pulls secrets and sets in environmen variables.
# - Launches nautilus-server

set -e # Exit immediately if a command exits with a non-zero status
echo "run.sh script is running"
export PYTHONPATH=/lib/python3.11:/usr/local/lib/python3.11/lib-dynload:/usr/local/lib/python3.11/site-packages:/lib
export LD_LIBRARY_PATH=/lib:$LD_LIBRARY_PATH

echo "Script completed."
# Assign an IP address to local loopback
busybox ip addr add 127.0.0.1/32 dev lo
busybox ip link set dev lo up

# Add a hosts record, pointing target site calls to local loopback
echo "127.0.0.1   localhost" > /etc/hosts
echo "127.0.0.64   aggregator.walrus-testnet.walrus.space" >> /etc/hosts
echo "127.0.0.65   fullnode.testnet.sui.io" >> /etc/hosts
echo "127.0.0.66   openrouter.ai" >> /etc/hosts




# == ATTENTION: code should be generated here that parses allowed_endpoints.yaml and populate domains here ===

cat /etc/hosts

# Optional: Get secrets from VSOCK port 7777 (timeout after 10s)
# This allows the host to send secrets to the enclave
echo "Waiting for secrets (timeout 10s)..."
JSON_RESPONSE=$(timeout 10 socat - VSOCK-LISTEN:7777,reuseaddr,bind=7777 2>/dev/null || echo "{}")
if [ "$JSON_RESPONSE" != "{}" ] && [ -n "$JSON_RESPONSE" ]; then
    echo "Received secrets, setting environment variables..."
    echo "$JSON_RESPONSE" | jq -r 'to_entries[] | "\(.key)=\(.value)"' > /tmp/kvpairs
    while IFS="=" read -r key value; do
        if [ -n "$key" ]; then
            export "$key"="$value"
            echo "  Set: $key"
        fi
    done < /tmp/kvpairs
    rm -f /tmp/kvpairs
else
    echo "No secrets received (timeout or empty), continuing without..."
fi

# Run traffic forwarder in background and start the server
# Forwards traffic from 127.0.0.x -> VSOCK Port 810x at CID 2 (host)
# The host's vsock-proxy then forwards to the respective external services

# == ATTENTION: code should be generated here that added all hosts to forward traffic ===
# Traffic-forwarder-block
# CID 2 = Nitro Enclave host
python3 /traffic_forwarder.py 127.0.0.64 443 2 8101 &
python3 /traffic_forwarder.py 127.0.0.65 443 2 8102 &
python3 /traffic_forwarder.py 127.0.0.66 443 2 8103 &


# Listens on Local VSOCK Port 3000 and forwards to localhost 3000
socat VSOCK-LISTEN:3000,reuseaddr,fork TCP:localhost:3000 &
# For seal-example: Listen on VSOCK Port 3001 and forward to localhost 3001
socat VSOCK-LISTEN:3001,reuseaddr,fork TCP:localhost:3001 &

# Start the nautilus-server
echo "Starting nautilus-server..."
exec /nautilus-server
