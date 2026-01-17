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
