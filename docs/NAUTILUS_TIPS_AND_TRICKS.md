# Nautilus Development Tips & Tricks

A practical guide for developers working with the Nautilus Nitro Enclave framework on Sui.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Common Issues & Debugging](#common-issues--debugging)
3. [Key Commands & Tools](#key-commands--tools)
4. [Testing Locally](#testing-locally)
5. [Deployment Workflow](#deployment-workflow)
6. [Troubleshooting Checklist](#troubleshooting-checklist)
7. [Best Practices](#best-practices)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        EC2 Host (Amazon Linux)                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Nitro Enclave (Isolated VM)             │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │  │
│  │  │ run.sh      │  │ nautilus-   │  │ socat VSOCK→TCP   │  │  │
│  │  │ (init)      │  │ server      │  │ (port 3000, 3001) │  │  │
│  │  └─────────────┘  └─────────────┘  └───────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Host-Side Forwarding                    │  │
│  │                                                           │  │
│  │  ┌─────────────────────┐  ┌─────────────────────────────┐ │  │
│  │  │ Python Forwarder    │  │ vsock-proxy (enclave→host)  │ │  │
│  │  │ TCP:3000 → VSOCK:X  │  │ (ports 8101, 8102, 8103)    │ │  │
│  │  │ TCP:3001 → VSOCK:X  │  │                             │ │  │
│  │  └─────────────────────┘  └─────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Public IP: 3.0.207.181                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Ports

| Port | Direction | Purpose |
|------|-----------|---------|
| 3000 | Host→Enclave | Main API (`/`, `/process_data`, `/health_check`) |
| 3001 | Host→Enclave | Admin API (`/admin/*` endpoints) |
| 7777 | Enclave→Host | Secrets provisioning (optional) |
| 8101 | Enclave→External | Walrus Aggregator (via vsock-proxy) |
| 8102 | Enclave→External | Sui RPC (via vsock-proxy) |
| 8103 | Enclave→External | OpenRouter AI (via vsock-proxy) |

---

## Common Issues & Debugging

### Issue: "Connection reset by peer" when connecting to enclave

**Symptoms:**
- VSOCK connection resets immediately
- `curl` to localhost:3000 fails
- No response from enclave

**Root Cause:** The `run.sh` script inside the enclave was blocking on line 37:
```bash
JSON_RESPONSE=$(socat - VSOCK-LISTEN:7777,reuseaddr)
```
This waits forever for secrets that are never sent.

**Fix:**
```bash
# Make secrets optional with timeout
JSON_RESPONSE=$(timeout 10 socat - VSOCK-LISTEN:7777,reuseaddr,bind=7777 2>/dev/null || echo "{}")
```

**Debug Commands:**
```bash
# Check if enclave is running
ssh ec2-user@<IP> "sudo nitro-cli describe-enclaves"

# Test direct VSOCK connection
python3 -c "
import socket
s = socket.socket(40, socket.SOCK_STREAM)  # AF_VSOCK = 40
s.connect((<CID>, 3000))
s.send(b'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n')
print(s.recv(1024))
"

# Check port forwarding
ssh ec2-user@<IP> "netstat -tlnp | grep 3000"
```

---

### Issue: "unknown device/address VSOCK-CONNECT"

**Symptoms:**
- socat logs show: `E unknown device/address "VSOCK-CONNECT"`
- Port forwarding doesn't work

**Root Cause:** Amazon Linux's system socat (`socat version 1.7.3.2`) doesn't include VSOCK support.

**Solution:** Use the Python-based TCP→VSOCK forwarder instead:
```bash
python3 /home/ec2-user/tcp-vsock-forwarder.py 3000 <CID> 3000
```

**Location:** `scripts/staging/tcp-vsock-forwarder.py`

---

### Issue: Enclave CID changes on restart

**Symptoms:**
- Port forwarding fails after enclave restart
- Old CID still being used

**Root Cause:** Nitro Enclaves get a new CID (Context ID) every time they start.

**Solution:** Always extract the new CID from the run-enclave output:
```bash
RESULT=$(nitro-cli run-enclave --eif-path ~/sui_nautilus/out/nitro.eif --memory 2048 --cpu-count 2)
CID=$(echo "$RESULT" | grep -o '"EnclaveCID": [0-9]*' | grep -o '[0-9]*')
echo "Enclave CID: $CID"
```

---

### Issue: Enclave not responding after start

**Symptoms:**
- Enclave shows "RUNNING" state
- But `/` endpoint returns nothing or times out

**Root Cause:** The `run.sh` script might have `set -e` and be exiting early, or the nautilus-server binary isn't being started.

**Debug Commands:**
```bash
# Check enclave state
ssh ec2-user@<IP> "sudo nitro-cli describe-enclaves"

# Check if port 3000 is listening
ssh ec2-user@<IP> "netstat -tlnp | grep 3000"

# Check forwarder logs
ssh ec2-user@<IP> "cat /tmp/forwarder-3000.log"

# Try direct connection
ssh ec2-user@<IP> "curl http://localhost:3000/"
```

---

## Key Commands & Tools

### EC2 Commands

```bash
# SSH to EC2
ssh -i ~/.ssh/medical-vault-key.pem ec2-user@<PUBLIC_IP>

# Check enclave status
sudo nitro-cli describe-enclaves

# Start enclave
sudo nitro-cli run-enclave --eif-path ~/sui_nautilus/out/nitro.eif --memory 2048 --cpu-count 2

# Terminate enclave
sudo nitro-cli terminate-enclave --all

# Check allocator service
sudo systemctl status nitro-enclaves-allocator.service
```

### Local Testing Commands

```bash
# Build with specific app
cd src/nautilus-server
cargo build --features medical-vault-insurer --release

# Run locally (no enclave)
cd src/nautilus-server
./target/release/nautilus-server

# Test endpoints
curl http://localhost:3000/
curl http://localhost:3000/health_check
curl -X POST http://localhost:3000/process_data -H 'Content-Type: application/json' -d '{...}'
```

### Deployment Commands

```bash
# Sync code and rebuild enclave
cd scripts/staging
./ec2-rebuild.sh

# Start enclave and register on-chain
./ec2-start.sh --register

# Start enclave without registration
./ec2-start.sh --skip-register

# Check status
./ec2-status.sh
```

### Debug Commands

```bash
# Check port forwarding
netstat -tlnp | grep 3000
ss -tlnp | grep 3000

# Test VSOCK connection
python3 -c "
import socket
s = socket.socket(40, socket.SOCK_STREAM)
s.settimeout(10)
s.connect((<CID>, 3000))
s.send(b'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n')
print(s.recv(1024))
"

# Check forwarder logs
cat /tmp/forwarder-3000.log
cat /tmp/socat-3000.log

# List processes
ps aux | grep -E "(nitro|socat|python|nautilus)"
```

---

## Testing Locally

### Why Test Locally?

1. **Faster iteration** - No need to build EIF or deploy to EC2
2. **Better debugging** - Can use IDE, logs, etc.
3. **Catch issues early** - Test core functionality before deployment

### Setup

```bash
# Build the binary
cd src/nautilus-server
cargo build --features medical-vault-insurer --release

# Run locally
./target/release/nautilus-server
```

### Expected Behavior (Medical Vault Insurer)

```bash
$ curl http://localhost:3000/
Pong!

$ curl http://localhost:3000/health_check
{"pk":"<public_key>","endpoints_status":{}}

$ curl -X POST http://localhost:3000/process_data -H 'Content-Type: application/json' \
  -d '{"payload": {...}}'
{"error":"OpenRouter API key not initialized. Please complete key load first."}

# Note: /get_attestation will fail locally (needs NSM driver in enclave)
$ curl http://localhost:3000/get_attestation
{"error":"unexpected response"}
```

### Host-Only Server (Port 3001)

The medical-vault-insurer app also starts a host-only server on port 3001 for admin operations:

```bash
$ curl http://localhost:3001/ping
{"message":"pong"}

# Key load endpoints (require Seal setup)
$ curl -X POST http://localhost:3001/admin/init_seal_key_load -d '{...}'
```

---

## Deployment Workflow

### Initial Deployment

```bash
# 1. Ensure Terraform infrastructure exists
cd tf
terraform init
terraform apply

# 2. Sync code to EC2 and rebuild
cd scripts/staging
./ec2-rebuild.sh

# 3. Start and register on-chain
./ec2-start.sh --register
```

### Code Changes Only (No Infrastructure Changes)

```bash
# Sync and rebuild (no Terraform)
cd scripts/staging
./ec2-rebuild.sh

# If PCRs changed, re-register
./ec2-start.sh --register

# If only code changed but PCRs same
./ec2-start.sh --skip-register
```

### Quick Restart (Enclave Was Stopped)

```bash
cd scripts/staging
./ec2-start.sh --skip-register
```

### Full Redeploy (Infrastructure Changes)

```bash
# Update Terraform
cd tf
terraform apply

# Then follow Initial Deployment steps
```

---

## Troubleshooting Checklist

### Enclave Not Starting

- [ ] Check allocator service: `sudo systemctl status nitro-enclaves-allocator.service`
- [ ] Increase memory if needed: Edit `/etc/nitro_enclaves/allocator.yaml`, then `sudo systemctl restart nitro-enclaves-allocator.service`
- [ ] Check EIF exists: `ls -la ~/sui_nautilus/out/nitro.eif`
- [ ] Check EIF is valid: `nitro-cli inspect-enclave --eif-path ~/sui_nautilus/out/nitro.eif`

### Enclave Running But Not Responding

- [ ] Check CID: `sudo nitro-cli describe-enclaves | grep EnclaveCID`
- [ ] Check port forwarding: `netstat -tlnp | grep 3000`
- [ ] Check forwarder logs: `cat /tmp/forwarder-3000.log`
- [ ] Test direct VSOCK: `python3 -c "import socket; s=socket.socket(40,socket.SOCK_STREAM); s.connect((<CID>,3000))..."`
- [ ] Check enclave console: `sudo nitro-cli console` (may not be available)

### Port Forwarding Issues

- [ ] Kill old forwarders: `pkill -f "tcp-vsock-forwarder"`
- [ ] Start fresh forwarders: `python3 tcp-vsock-forwarder.py 3000 <CID> 3000`
- [ ] Check forwarder is running: `ps aux | grep tcp-vsock-forwarder`
- [ ] Check port is listening: `netstat -tlnp | grep 3000`

### On-Chain Registration Fails

- [ ] Verify attestation: `curl http://<IP>:3000/get_attestation`
- [ ] Check PCRs match: Extract from attestation document
- [ ] Verify Sui CLI: `sui client active-address`
- [ ] Check gas balance: `sui client gas`

---

## Best Practices

### 1. Always Test Locally First

```bash
# Before deploying to EC2, test locally
cd src/nautilus-server
cargo build --features medical-vault-insurer --release
./target/release/nautilus-server
```

### 2. Check Enclave State Before Debugging

```bash
# Always start here
ssh ec2-user@<IP> "sudo nitro-cli describe-enclaves"
```

### 3. Use the Right Forwarder

- **System socat** → NO VSOCK support on Amazon Linux
- **Python forwarder** → YES, works with AF_VSOCK sockets
- **vsock-proxy** → For enclave→host forwarding (not host→enclave)

### 4. Handle CID Changes

The enclave CID changes on every start. Always extract it dynamically:
```bash
CID=$(nitro-cli describe-enclaves | grep -o '"EnclaveCID": [0-9]*' | grep -o '[0-9]*')
```

### 5. Make Secrets Optional

Never block startup waiting for secrets:
```bash
# Bad - blocks forever
JSON_RESPONSE=$(socat - VSOCK-LISTEN:7777,reuseaddr)

# Good - times out after 10 seconds
JSON_RESPONSE=$(timeout 10 socat - VSOCK-LISTEN:7777,reuseaddr,bind=7777 2>/dev/null || echo "{}")
```

### 6. Check Logs First

```bash
# Forwarder logs
cat /tmp/forwarder-3000.log

# vsock-proxy logs
cat /tmp/vsock-proxy-*.log

# Enclave logs (if available)
sudo nitro-cli console
```

### 7. Document PCR Changes

When rebuilding, PCRs change. Note this in your commit/PR:
```
Enclave rebuilt with fix for run.sh blocking issue.
New PCRs: <values>
Must re-register on-chain with: ./ec2-start.sh --register
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/nautilus-server/run.sh` | Enclave init script (runs inside EIF) |
| `src/nautilus-server/src/main.rs` | Main server entry point |
| `src/nautilus-server/src/apps/medical-vault-insurer/` | Medical vault insurer app |
| `scripts/staging/tcp-vsock-forwarder.py` | Host→enclave port forwarder |
| `scripts/staging/ec2-start.sh` | Start EC2 and deploy enclave |
| `scripts/staging/ec2-rebuild.sh` | Sync code, rebuild, restart enclave |
| `tf/main.tf` | EC2 infrastructure with Nitro Enclaves |
| `Containerfile` | EIF build configuration |

---

## Useful Links

- [Nautilus Documentation](https://docs.sui.io/concepts/cryptography/nautilus)
- [Nitro Enclaves Documentation](https://docs.aws.amazon.com/enclaves/index.html)
- [Nitro CLI Reference](https://docs.aws.amazon.com/enclaves/latest/users/nitro-cli-reference.html)
- [Seal SDK](https://github.com/MystenLabs/seal)
- [Sui Documentation](https://docs.sui.io/)

---

## Quick Reference Card

```bash
# === DAILY DEVELOPMENT ===

# Test locally
cd src/nautilus-server && cargo run --features medical-vault-insurer

# Deploy to staging
cd scripts/staging && ./ec2-rebuild.sh

# Re-register on-chain
cd scripts/staging && ./ec2-start.sh --register

# === DEBUGGING ===

# Check enclave
ssh ec2-user@<IP> "sudo nitro-cli describe-enclaves"

# Test connection
ssh ec2-user@<IP> "curl http://localhost:3000/"

# Check logs
ssh ec2-user@<IP> "cat /tmp/forwarder-3000.log"

# Get CID
ssh ec2-user@<IP> "sudo nitro-cli describe-enclaves | grep EnclaveCID"

# === PORT FORWARDING ===

# Start forwarder
python3 tcp-vsock-forwarder.py 3000 <CID> 3000
python3 tcp-vsock-forwarder.py 3001 <CID> 3001
```
