# Medical Vault Insurer - Staging Scripts

## Overview

Scripts for deploying and managing the Medical Vault Insurer Nitro Enclave on AWS EC2.

## Prerequisites

- AWS CLI configured with credentials
- Terraform for EC2 infrastructure (`tf/`)
- SSH key at path specified in `.env` (`SSH_KEY`)
- Sui CLI installed and configured

## Setup

```bash
cd scripts/staging
cp .env.example .env
# Edit .env with your configuration
```

## Scripts

| Script           | Purpose                                                 |
| ---------------- | ------------------------------------------------------- |
| `ec2-start.sh`   | Start EC2, deploy enclave, optionally register on-chain |
| `ec2-stop.sh`    | Stop EC2 instance                                       |
| `ec2-status.sh`  | Check instance and enclave status                       |
| `ec2-rebuild.sh` | Sync code, rebuild, and restart enclave                 |

## Usage

### Initial Deployment

```bash
# Start and register enclave on-chain
./ec2-start.sh --register
```

### Daily Operations

```bash
# Check status
./ec2-status.sh

# Stop (IP will change on restart - spot instance)
./ec2-stop.sh

# Start again (without re-registration if PCRs unchanged)
./ec2-start.sh --skip-register

# Re-register if enclave was rebuilt (PCRs changed)
./ec2-start.sh --register
```

### Code Updates

```bash
# Sync local changes, rebuild, and restart (with re-registration)
./ec2-rebuild.sh --register

# Sync and rebuild without re-registration
./ec2-rebuild.sh
```

## Important Notes

### Public IP / DNS

> **Warning:** If you don't use Elastic IP, the Public IP changes when the instance starts (spot instance).

- IP changes on every start for spot instances
- Update DNS records or client configurations if needed
- Check current IP: `./ec2-status.sh`

### Nitro Enclave Behavior

- **Enclave does NOT auto-start** when EC2 boots - you must run `./ec2-start.sh` or `make run`
- **CID changes** on every enclave start - VSOCK forwarding is re-established automatically
- **Public key changes** on every enclave rebuild - re-register with `--register` flag

### Secrets Management

> **Warning:** Secrets do NOT persist in the enclave between restarts.

- Secrets are sent via socat-vsock at startup
- Re-send secrets every time the enclave restarts
- Secrets are copied to EC2 and sent via VSOCK port 7777

### Port Forwarding

- socat-vsock maps `TCP4-LISTEN:3000` → `VSOCK-CONNECT:CID:3000`
- Must restart socat when enclave CID changes (handled automatically)
- Binary location: `/usr/local/bin/socat-vsock`

### /dev/vsock Permissions

If you see "Permission denied" errors:

```bash
sudo chmod 666 /dev/vsock
```

This is handled automatically in the startup scripts.

### vsock-proxy Services

vsock-proxy forwards outbound traffic from enclave:

| Port | Service           | Restart Required? |
| ---- | ----------------- | ----------------- |
| 8101 | Walrus Aggregator | Yes               |
| 8102 | Sui RPC           | Yes               |
| 8103 | OpenRouter        | Yes               |

Config file `/etc/nitro_enclaves/vsock-proxy.yaml` persists; only the process needs restart.

### Nitro Enclaves Allocator Service

Check if running:

```bash
sudo systemctl status nitro-enclaves-allocator.service
```

Start if needed:

```bash
sudo systemctl start nitro-enclaves-allocator.service
```

### On-Chain Registration

When the enclave restarts:

1. New PCRs (Platform Configuration Registers) are generated
2. New ephemeral keypair is created
3. **You must re-register** the new public key on-chain

```bash
./ec2-start.sh --register
# or
./ec2-rebuild.sh --register
```

### Build & Code Sync

**If instance is stopped and started (not terminated):**

- Code at `~/sui_nautilus` persists
- Usually NO need to rsync code
- Just restart the enclave: `./ec2-start.sh --skip-register`

**If instance is replaced or new:**

- Code is synced automatically via rsync in `ec2-rebuild.sh`
- Enclave is rebuilt with `make ENCLAVE_APP=medical-vault-insurer`

## Troubleshooting

### Enclave not responding

```bash
# SSH to EC2
ssh -i $HOME/.ssh/medical-vault-key.pem ec2-user@<PUBLIC_IP>

# Check enclave status
sudo nitro-cli describe-enclaves

# Check logs
cat /tmp/socat-3000.log
cat /tmp/vsock-proxy-*.log
```

### Permission denied on /dev/vsock

```bash
sudo chmod 666 /dev/vsock
```

### vsock-proxy not working

```bash
# Check process
ps aux | grep vsock-proxy

# Restart
pkill vsock-proxy
vsock-proxy 8101 aggregator.walrus-testnet.walrus.space:443 --config /etc/nitro_enclaves/vsock-proxy.yaml &
```

### Need to re-register

```bash
./ec2-start.sh --register
```
