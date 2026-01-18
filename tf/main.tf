provider "aws" {
  region = "ap-southeast-1"
}

# VPC - Required by configure_enclave.sh for security group creation
resource "aws_vpc" "medical_vault_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "medical-vault-vpc"
  }
}

# Public Subnet - Required for EC2 instance placement
resource "aws_subnet" "public_subnet" {
  vpc_id                  = aws_vpc.medical_vault_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ap-southeast-1a"
  map_public_ip_on_launch = true

  tags = {
    Name = "medical-vault-public"
  }
}

# Internet Gateway - Required for internet access
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.medical_vault_vpc.id

  tags = {
    Name = "medical-vault-igw"
  }
}

# Route Table - Required for routing traffic through IGW
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.medical_vault_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "medical-vault-public-rt"
  }
}

# Associate Route Table with Subnet
resource "aws_route_table_association" "public_assoc" {
  route_table_id = aws_route_table.public_rt.id
  subnet_id      = aws_subnet.public_subnet.id
}

# Security Group for EC2 with Nitro Enclaves
resource "aws_security_group" "ec2_sg" {
  name        = "medical-vault-ec2-sg"
  description = "Security group for EC2 instance with Nitro Enclaves"
  vpc_id      = aws_vpc.medical_vault_vpc.id

  # ==========================================
  # INBOUND RULES
  # ==========================================

  # SSH from your IP (replace with your actual IP or keep 0.0.0.0/0 for any)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Enclave API (HTTP) - socat-vsock forwards to enclave
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # vsock-proxy for Twitter API
  ingress {
    from_port   = 8101
    to_port     = 8101
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # vsock-proxy for Sui RPC
  ingress {
    from_port   = 8102
    to_port     = 8102
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # vsock-proxy for OpenRouter AI
  ingress {
    from_port   = 8103
    to_port     = 8103
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # ==========================================
  # OUTBOUND RULES
  # ==========================================

  # Allow all HTTPS (443) for vsock-proxy endpoints:
  # - aggregator.walrus-testnet.walrus.space (port 8101)
  # - fullnode.testnet.sui.io (port 8102)
  # - openrouter.ai (port 8103)
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # AWS KMS
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # AWS KMS FIPS
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow DNS for hostname resolution
  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "medical-vault-ec2-sg"
  }
}

# SSH key pair (existing key in AWS)
resource "aws_key_pair" "medical_vault_key" {
  key_name   = "medical-vault-key"
  public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCaKZ37rwK8dh6hrZnTNQB0L/+CvktG4AubOCu42yrNeQoKEvHP9xA3Ee8yFIM5y65WAAKRu87UnWkChvhZyKfHZx6U3e5h5ZXaGZSGVMuMFfQvN8PnapTtnrbKg4RwU7dpj7iVUTggmJhCpnKB143W7UTRbNOIEj9s208U7xzVqxLrtOWQwnfGdjkMAsrzAV3NKptXjqDlBt/i5rg6qBn3TCNcenien5JzHhLPQYZZSziITKpYS3V/BQhjPk07UXJbtRqBevmh16lJq3mpaemjpLimWIlZGHOIoU2gnEx9nGyD4AuUwV/kFgWT3cHrDH1Jpry88QjU/uRJbkRltcGD"
}

# EC2 Instance with Nitro Enclaves support
resource "aws_instance" "medical_vault_ec2" {
  ami                         = "ami-05edef9230865e65c"
  instance_type               = "m5.xlarge"
  subnet_id                   = aws_subnet.public_subnet.id
  vpc_security_group_ids      = [aws_security_group.ec2_sg.id]
  associate_public_ip_address = true
  key_name                    = "medical-vault-key"

  # Enable Nitro Enclaves
  enclave_options {
    enabled = true
  }

  root_block_device {
    volume_size = 100
    volume_type = "gp3"
  }

  # User data to install Nitro CLI and vsock-proxy (Amazon Linux 2)
  user_data = <<-EOF
#!/bin/bash
set -e

echo "=== Installing Nitro Enclaves CLI and dependencies ==="

# Install dependencies
yum install -y \
    docker \
    socat \
    curl \
    wget \
    git \
    gcc \
    gcc-c++ \
    pkgconfig \
    openssl-devel

# Start Docker (needed for some Nitro tools)
systemctl start docker
systemctl enable docker

echo "=== Installing Rust ==="
# Install Rust (needed to build vsock-proxy)
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    source "$HOME/.cargo/env"
else
    echo "Rust already installed: $(rustc --version)"
fi

echo "=== Installing Nitro CLI ==="
# Install Nitro CLI from amazon-linux-extras
amazon-linux-extras install aws-nitro-enclaves-cli -y

# Source nitro-cli environment
source /etc/profile.d/nitro-cli-env.sh 2>/dev/null || true

echo ">>> Starting allocator service..."
systemctl start nitro-enclaves-allocator.service
systemctl enable nitro-enclaves-allocator.service

echo "=== Building vsock-proxy ==="
# Clone and build vsock-proxy for vsock communication
git clone https://github.com/aws/aws-nitro-enclaves-vsock-proxy.git /tmp/vsock-proxy
cd /tmp/vsock-proxy
cargo build --release

# Copy vsock-proxy binary to /usr/local/bin
cp target/release/vsock-proxy /usr/local/bin/vsock-proxy
chmod +x /usr/local/bin/vsock-proxy

echo "=== Installing Python TCP->VSOCK forwarder ==="
# Since system socat doesn't have VSOCK support, we use a Python script for forwarding
cat > /usr/local/bin/tcp-vsock-forwarder.py << 'PYEOF'
#!/usr/bin/env python3
"""TCP to VSOCK forwarder for Nitro Enclaves."""
import socket
import struct
import threading

AF_VSOCK = 40

def get_local_cid():
    try:
        s = socket.socket(AF_VSOCK, socket.SOCK_STREAM)
        cid = s.getsockopt(AF_VSOCK, 0, struct.pack('I', 0))
        return struct.unpack('I', cid)[0]
    except:
        return 2

def forward_tcp_to_vsock(local_port, enclave_cid, enclave_vsock_port):
    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server_sock.bind(('0.0.0.0', local_port))
        server_sock.listen(10)
        while True:
            try:
                client_sock, addr = server_sock.accept()
                vsock_sock = socket.socket(AF_VSOCK, socket.SOCK_STREAM)
                try:
                    vsock_sock.connect((enclave_cid, enclave_vsock_port))
                    def forward(src, dst):
                        try:
                            while True:
                                data = src.recv(4096)
                                if not data: break
                                dst.sendall(data)
                        except: pass
                        finally:
                            src.close()
                            dst.close()
                    t1 = threading.Thread(target=forward, args=(client_sock, vsock_sock))
                    t2 = threading.Thread(target=forward, args=(vsock_sock, client_sock))
                    t1.daemon = True
                    t2.daemon = True
                    t1.start()
                    t2.start()
                except:
                    client_sock.close()
            except: pass
    finally:
        server_sock.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 4:
        print(f"Usage: {sys.argv[0]} <local_port> <enclave_cid> <enclave_vsock_port>")
        sys.exit(1)
    forward_tcp_to_vsock(int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]))
PYEOF
chmod +x /usr/local/bin/tcp-vsock-forwarder.py

echo "=== Installation complete ==="
echo "Binaries installed:"
which rustc && echo "  - rustc: $(rustc --version | head -1)"
which nitro-cli && echo "  - nitro-cli: $(nitro-cli --version 2>&1 || echo 'version unknown')"
which vsock-proxy && echo "  - vsock-proxy"
which tcp-vsock-forwarder.py && echo "  - tcp-vsock-forwarder.py (Python-based VSOCK forwarder)"
echo ""
echo "Allocator service: $(systemctl is-active nitro-enclaves-allocator.service)"
echo ""
echo "Note: Run scripts/staging/ec2-start.sh to start the enclave"
EOF

  tags = {
    Name = "medical-vault-ec2"
  }
}

# Elastic IP to prevent IP changes on stop/start
resource "aws_eip" "medical_vault_eip" {
  domain   = "vpc"
  instance = aws_instance.medical_vault_ec2.id

  tags = {
    Name = "medical-vault-eip"
  }
}

# Outputs for configure_enclave.sh
output "vpc_id" {
  value       = aws_vpc.medical_vault_vpc.id
  description = "VPC ID - export this as VPC_ID before running configure_enclave.sh"
}

output "subnet_id" {
  value       = aws_subnet.public_subnet.id
  description = "Public Subnet ID"
}

output "availability_zone" {
  value       = aws_subnet.public_subnet.availability_zone
  description = "Availability Zone"
}

output "ec2_public_ip" {
  value       = aws_eip.medical_vault_eip.public_ip
  description = "Static Public IP (Elastic IP)"
}

output "ec2_instance_id" {
  value       = aws_instance.medical_vault_ec2.id
  description = "EC2 Instance ID"
}

output "security_group_id" {
  value       = aws_security_group.ec2_sg.id
  description = "Security Group ID"
}

output "eip_allocation_id" {
  value       = aws_eip.medical_vault_eip.allocation_id
  description = "Elastic IP Allocation ID - needed if using Route53"
}
