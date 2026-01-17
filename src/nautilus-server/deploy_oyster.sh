#!/bin/bash
# Copyright (c), Mysten Labs, Inc.
# SPDX-License-Identifier: Apache-2.0
#
# Deployment script for medical-vault-insurer TEE with Oyster CVM
# Reference: https://docs.marlin.org/oyster/build-cvm/quickstart

set -e

# Configuration
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker.io}"
DOCKER_USERNAME="${DOCKER_USERNAME:-$(whoami)}"
IMAGE_NAME="nautilus-server"
COMPOSE_FILE="docker-compose.oyster.yml"
ENCLAVE_APP="medical-vault-insurer"
INSTANCE_TYPE="${INSTANCE_TYPE:-c6g.xlarge}"
DURATION_MINUTES="${DURATION_MINUTES:-15}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Install from https://docs.docker.com/get-docker/"
        exit 1
    fi

    # Check Oyster CLI
    if ! command -v oyster-cvm &> /dev/null; then
        log_error "oyster-cvm CLI is not installed. Install from https://docs.marlin.org/oyster/build-cvm/quickstart"
        exit 1
    fi

    # Check wallet private key
    if [ -z "$PRIVATE_KEY" ]; then
        log_error "PRIVATE_KEY environment variable is not set"
        log_info "export PRIVATE_KEY=\$(sui keytool export | grep 'Private key' | awk '{print \$NF}')"
        exit 1
    fi

    log_info "All prerequisites met"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."
    docker build \
        -f Dockerfile.oyster \
        -t ${DOCKER_REGISTRY}/${IMAGE_NAME}:latest \
        .
    log_info "Docker image built successfully"
}

# Push image to registry
push_image() {
    log_info "Pushing image to registry..."
    docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}:latest
    log_info "Image pushed successfully"
}

# Get image digest
get_image_digest() {
    local digest
    digest=$(docker inspect --format='{{index .RepoDigests 0}}' ${DOCKER_REGISTRY}/${IMAGE_NAME}:latest)
    echo "$digest"
}

# Update docker-compose with image digest
update_compose_with_digest() {
    local digest=$1
    log_info "Updating docker-compose.yml with image digest..."
    
    # Replace the image line with the digest
    sed -i "s|@sha256:.*|@${digest}|g" ${COMPOSE_FILE}
    
    log_info "docker-compose.yml updated"
}

# Compute expected image ID
compute_image_id() {
    log_info "Computing expected image ID..."
    oyster-cvm compute-image-id --docker-compose ${COMPOSE_FILE}
}

# Deploy to Oyster CVM
deploy_enclave() {
    log_info "Deploying enclave to Oyster CVM..."
    
    oyster-cvm deploy \
        --wallet-private-key "$PRIVATE_KEY" \
        --docker-compose ${COMPOSE_FILE} \
        --instance-type ${INSTANCE_TYPE} \
        --duration-in-minutes ${DURATION_MINUTES} \
        --deployment sui
    
    log_info "Deployment initiated"
}

# Verify deployment
verify_deployment() {
    local enclave_ip=$1
    local expected_image_id=$2
    
    log_info "Verifying deployment at ${enclave_ip}..."
    
    # Verify attestation
    oyster-cvm verify \
        --enclave-ip ${enclave_ip} \
        --image-id ${expected_image_id}
    
    log_info "Deployment verified successfully"
}

# Get enclave info
get_enclave_info() {
    local address=$(sui client active-address 2>/dev/null || echo "")
    if [ -n "$address" ]; then
        oyster-cvm list --address "$address"
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build          Build Docker image"
    echo "  push           Push image to registry"
    echo "  deploy         Build, push, and deploy to Oyster CVM"
    echo "  compute-id     Compute expected image ID"
    echo "  verify         Verify deployment (requires ENCLAVE_IP)"
    echo "  list           List your deployments"
    echo "  status         Check deployment status (requires JOB_ID)"
    echo "  stop           Stop deployment (requires JOB_ID)"
    echo ""
  echo "Environment Variables:"
  echo "  PRIVATE_KEY        Wallet private key (required)"
  echo "  DOCKER_REGISTRY    Docker registry (default: docker.io)"
  echo "  DOCKER_USERNAME    Docker Hub username (default: current user)"
  echo "  IMAGE_NAME         Image name (default: nautilus-server)"
  echo "  INSTANCE_TYPE      EC2 instance type (default: c6g.xlarge)"
  echo "  DURATION_MINUTES   Deployment duration (default: 60)"
  echo "  ENCLAVE_IP         Enclave IP for verification"
  echo "  JOB_ID             Job ID for status/stop commands"
  echo ""
  echo "Examples:"
  echo "  # Using Docker Hub with your username"
  echo "  DOCKER_USERNAME=myuser $0 deploy"
  echo ""
  echo "  # Using custom registry"
  echo "  DOCKER_REGISTRY=myregistry.io DOCKER_USERNAME=myuser $0 deploy"
}

# Main
case "${1:-help}" in
    build)
        check_prerequisites
        build_image
        ;;
    push)
        check_prerequisites
        push_image
        ;;
    deploy)
        check_prerequisites
        
        # Build and push
        build_image
        push_image
        
        # Get digest and update compose
        digest=$(get_image_digest)
        update_compose_with_digest "$digest"
        
        # Compute image ID
        image_id=$(compute_image_id)
        
        # Deploy
        deploy_enclave
        
        log_info "Deployment complete!"
        log_info "Expected image ID: ${image_id}"
        log_info "Run 'oyster-cvm status --job-id <JOB_ID>' to get the enclave IP"
        ;;
    compute-id)
        compute_image_id
        ;;
    verify)
        if [ -z "$ENCLAVE_IP" ]; then
            log_error "ENCLAVE_IP environment variable is not set"
            exit 1
        fi
        verify_deployment "$ENCLAVE_IP" "$IMAGE_ID"
        ;;
    list)
        get_enclave_info
        ;;
    status)
        if [ -z "$JOB_ID" ]; then
            log_error "JOB_ID environment variable is not set"
            exit 1
        fi
        oyster-cvm status --job-id "$JOB_ID"
        ;;
    stop)
        if [ -z "$JOB_ID" ]; then
            log_error "JOB_ID environment variable is not set"
            exit 1
        fi
        oyster-cvm stop --job-id "$JOB_ID"
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac
