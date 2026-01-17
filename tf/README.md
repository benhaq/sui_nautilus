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
terraform output public_ip

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
| EC2 Instance | medical-vault-insurer | m5.xlarge, 20GB |

## Instance Details

- **AMI**: Amazon Linux 2 (ap-southeast-1)
- **Instance Type**: m5.xlarge (4 vCPU, 16 GB RAM)
- **Storage**: 20GB gp3 (encrypted)
- **Nitro Enclaves**: Enabled
