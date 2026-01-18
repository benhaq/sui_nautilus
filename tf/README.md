# Terraform Configuration for Medical Vault EC2

## Prerequisites

1. AWS CLI configured with credentials
2. Terraform installed
3. Key pair created in AWS

## Setup

### 1. Create Key Pair (if not exists)

```bash
aws ec2 create-key-pair \
  --key-name medical-vault-key \
  --region ap-southeast-1 \
  --query 'KeyMaterial' \
  --output text > medical-vault-key.pem

chmod 400 medical-vault-key.pem
```

### 2. Initialize Terraform

```bash
cd tf
terraform init
```

### 3. Plan and Apply

```bash
# Preview changes
terraform plan

# Apply changes (type 'yes' to confirm)
terraform apply
```

### 4. Connect to Instance

```bash
# Get public IP
terraform output ec2_public_ip

# SSH
ssh -i medical-vault-key.pem ec2-user@<PUBLIC_IP>
```

## Destroy Resources

```bash
terraform destroy
```

## Resources Created

| Resource | Name | CIDR/IP |
|----------|------|---------|
| VPC | medical-vault-vpc | 10.0.0.0/16 |
| Subnet | medical-vault-public | 10.0.1.0/24 |
| Internet Gateway | medical-vault-igw | - |
| Security Group | medical-vault-sg | Ports: 22, 3000, 3001, 443 |
| Elastic IP | medical-vault-eip | Static Public IP |
| EC2 Instance | medical-vault-insurer | m5.xlarge, 100GB |

## Key Features

### Elastic IP

An Elastic IP (EIP) is allocated and associated with the EC2 instance. This provides:

- **Static Public IP** - IP persists across stop/start cycles
- **No DNS updates needed** - IP doesn't change
- **Cost** - $0.005/hour (~ $3.60/month) when not associated

### Nitro Enclaves

The EC2 instance is configured with:
- Nitro Enclaves enabled
- Pre-installed Nitro CLI
- Pre-built vsock-proxy for outbound connections
- Systemd service files for vsock-proxy (disabled by default)

## Instance Details

- **AMI**: Amazon Linux 2 (ap-southeast-1)
- **Instance Type**: m5.xlarge (4 vCPU, 16 GB RAM)
- **Storage**: 100GB gp3 (encrypted)
- **Nitro Enclaves**: Enabled
- **Public IP**: Elastic IP (static)

## Outputs

After `terraform apply`, useful outputs:

```bash
# Static Public IP (doesn't change on stop/start)
terraform output ec2_public_ip

# EC2 Instance ID
terraform output ec2_instance_id

# Security Group ID (for reference)
terraform output security_group_id

# Elastic IP Allocation ID (for Route53)
terraform output eip_allocation_id
```

## Networking

### Inbound Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH access |
| 3000 | TCP | Enclave API (socat-vsock forward) |
| 3001 | TCP | Admin API (socat-vsock forward) |
| 8101 | TCP | Walrus vsock-proxy |
| 8102 | TCP | Sui RPC vsock-proxy |
| 8103 | TCP | OpenRouter vsock-proxy |

### Outbound

All traffic routed through VPC internet gateway to:
- Walrus Aggregator (443)
- Sui RPC (443)
- OpenRouter AI (443)
- AWS KMS (443)
- Standard DNS (53 UDP)
