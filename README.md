# Nautilus: Verifiable offchain computation on Sui

Nautilus is a framework for **secure and verifiable off-chain computation on Sui**. For full product details, see the [Nautilus documentation](https://docs.sui.io/concepts/cryptography/nautilus).

This repository includes a reproducible build template for AWS Nitro Enclaves, along with patterns and examples for hybrid application development. For a complete end-to-end example, see the [Nautilus Twitter repository](https://github.com/MystenLabs/nautilus-twitter).

> [!IMPORTANT]
> The reproducible build template is intended as a starting point for building your own enclave. It is not feature complete, has not undergone a security audit, and is offered as a modification-friendly reference licensed under the Apache 2.0 license. THE TEMPLATE AND ITS RELATED DOCUMENTATION ARE PROVIDED AS IS WITHOUT WARRANTY OF ANY KIND FOR EVALUATION PURPOSES ONLY. You can adapt and extend it to fit your specific use case.

## Contact Us
For questions about Nautilus, use case discussions, or integration support, contact the Nautilus team on [Sui Discord](https://discord.com/channels/916379725201563759/1361500579603546223).

ENCODED_REQUEST=$(curl -s -X POST http://localhost:3001/admin/init_seal_key_load \
-H 'Content-Type: application/json' \
-d '{"enclave_object_id":"0x3cb90da7a8c0b6738b9c3a8dffbd3b53cff0b5130359b4336d20a7ba6fbdd6e6", "initial_shared_version":734013140 }' | jq -r '.encoded_request') && seal-cli fetch-keys --request "$ENCODED_REQUEST"   -k 0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8   -t 2 -n testnet