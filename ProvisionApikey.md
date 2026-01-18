Seal Key Load Process (to provision OpenRouter API Key)
Step 1: Initialize Key Load
ssh -i ~/.ssh/medical-vault-key.pem ec2-user@3.0.207.181

# Inside EC2

curl -X POST http://localhost:3001/admin/init_seal_key_load \
 -H 'Content-Type: application/json' \
 -d '{
"enclave_object_id": "0xbed9d22b255ff082ad831d288623c86d70864aa975c22520b82f47a555104e1f",
"initial_shared_version": 733495934
}'
Step 2: Fetch Keys from Seal Servers

# In Seal repository

cargo run --bin seal-cli fetch-keys --request <ENCODED_REQUEST> \
 -k 0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8 \
 -t 2 \
 -n testnet
Step 3: Complete Key Load

# Back in EC2

curl -X POST http://localhost:3001/admin/complete_seal_key_load \
 -H 'Content-Type: application/json' \
 -d '{"seal_responses": "<ENCODED_SEAL_RESPONSES>"}'
Step 4: Provision OpenRouter API Key

# Encrypt API key with Seal, then

curl -X POST http://localhost:3001/admin/provision_openrouter_api_key \
 -H 'Content-Type: application/json' \
 -d '{"encrypted_object": "<ENCRYPTED_OBJECT>"}'

---
