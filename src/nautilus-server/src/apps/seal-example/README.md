# Seal-Nautilus Pattern

This example is currently WIP. Use it as a reference only.

The Seal-Nautilus pattern provides secure secret management for enclave applications, where user can encrypt any secrets to an enclave binary.

One can define a Seal policy configured with specified PCRs of the enclave. Users can encrypt any data using Seal with a fixed ID, and only the enclave of the given PCRs can decrypt them.

Here we reuse the weather example: Instead of storing the `weather-api-key` with AWS Secret Manager, we encrypt it using Seal, and show that only the enclave with the expected PCRs is able to decrypt and use it.

## Components

1. Nautilus server running inside AWS Nitro Enclave (`src/nautilus-server/src/apps/seal-example`): This is the only place that the Seal secret can be decrypted according to the policy. It exposes the endpoints at port 3000 to the Internet with the `/get_attestation` and `/process_data` endpoints. It also exposes port 3001 to the `localhost` with 3 `/admin` endpoints, which can only be used to initialize and complete the key load steps on the host instance that the enclave runs.

2. Seal [CLI](https://github.com/MystenLabs/seal/tree/main/crates/seal-cli): In particular, `encrypt` and `fetch-keys` are used for this example. The latest doc for the CLI can be found [here](https://seal-docs.wal.app/SealCLI/#7-encrypt-and-fetch-keys-using-service-providers).

3. Move contract `move/seal-policy/seal_policy.move`: This defines the `seal_approve` policy that verifies the signature committed to the wallet public key using the enclave ephermal key.

## Overview

> [!NOTE]
> Admin is someone that has access to the EC2 instance. He can build and run the enclave binary on it. He can also call the admin only enclave endpoints via localhost on the EC2 instance.

Phase 1: Start and Register the Server

1. Admin specifies the `seal_config.yaml` with the published Seal policy package ID and Seal configurations. Then the admin builds and runs the enclave with exposed `/get_attestation` endpoint.

2. Admin uses the attestation response to register PCRs and the enclave public key. The `/process_data` endpoint currently returns an error because the `SEAL_API_KEY` is not yet initialized.

3. Admin registers the enclave on-chain and get enclave object ID and initial shared version.

Phase 2: Initialize and Complete Key Load

4. Admin calls `/admin/init_seal_key_load` with the enclave object. Enclave returns an encoded `FetchKeyRequest`.

5. Admin uses FetchKeyRequest to call CLI to get Seal responses that are encrypted under the enclave's encryption public key.

6. Admin calls `/admin/complete_seal_key_load` with Seal responses. Enclave decrypts and caches all Seal keys in memory for later use.

Phase 3: Provision Application Secrets

7. Now that Seal keys are cached, encrypted objects can be decrypted on-demand using the cached keys. Specifically for our example, Admin calls `/admin/provision_weather_api_key` with the encrypted weather API key object. The enclave decrypts it using the cached keys and stores it as `SEAL_API_KEY`.

8. Enclave can now serve `/process_data` requests.

## Security Guarantees

The enclave generates 3 keys on startup, all kept only in enclave memory:

1. Enclave ephemeral keypair (`state.eph_kp`): Ed25519 keypair. Used to sign `/process_data` responses and to create the signature argument in `seal_approve` PTB. Its public key is registered on-chain in the Enclave object.
2. Seal wallet (`WALLET_BYTES`): Ed25519 keypair. Used for Seal certificate signing and as the transaction sender for `seal_approve`.
3. ElGamal encryption keypair (`ENCRYPTION_KEYS`): BLS group elements. Used to decrypt Seal responses.

During `/init_seal_key_load`, the wallet signs a PersonalMessage for the certificate. The enclave also creates a PTB for `seal_approve` where the signature argument is created by the enclave ephemeral keypair signing an intent message containing the wallet's public key and timestamp. When Seal servers dry-run the transaction, `seal_approve` verifies:

1. The signature is verified using the enclave's ephemeral public key (from `enclave.pk()`) and the intent message with scope `WalletPK` over the wallet public key and timestamp.
2. The key ID is a fixed value of `vector[0]`.
3. The transaction sender matches the wallet public key.

This proves that only the enclave (which has access to wallet and the ephemeral keypair) could have created a valid signed PTB, as the ephemeral keypair commits to the wallet public key.

During `/init_seal_key_load`, the enclave also generates an encryption keypair and return the encryption public key as part of `FetchKeyRequest`. The fetch key CLI is called outside the enclave, but no one except the enclave can decrypt the `FetchKeyResponse` since only enclave has the encryption secret key. Then the `FetchKeyResponse` is passed to the enclave at `/complete_seal_key_load`, and only the enclave can verify and decrypt the Seal key in memory.

### Why Two Step Key Load is Needed for Phase 2?

This is because an enclave operates without direct internet access so it cannot fetch secrets from Seal key servers' HTTP endpoints directly. Here we use the host acts as an intermediary to fetch encrypted secrets from Seal servers.

This delegation is secure because the Seal responses are encrypted under the enclave's encryption key, so only the enclave can later decrypt the fetched Seal responses. The public keys of the Seal servers in `seal_config.yaml` are defined by the admin in the enclave, so the enclave can verify the decrypted Seal key is not tampered with.

## Steps

### Step 0: Build, Run and Register Enclave

This is largely the as the main Nautilus template (Refer to the main guide `UsingNautilus.md` for
more detailed instructions) with two additions:

1. Update `seal_config.yaml` used by the enclave.
2. Record `ENCLAVE_OBJ_VERSION` in addition to `ENCLAVE_OBJECT_ID`.

```shell
# publish the enclave package
cd move/enclave
sui move build && sui client publish



# publish the seal-policy app package
cd ../seal-policy
sui move build && sui client publish

# find these in output and set env vars
# find this in output and set env var
ENCLAVE_PACKAGE_ID=0x5114530c1fc03da3c502cc0036540464b94683af900ac788a47d76aa2adba856
CAP_OBJECT_ID=0x15668c177c3c501ef9e0973ada36bda8995af1ba54ac5e5a266092eb830fbef3
ENCLAVE_CONFIG_OBJECT_ID=0xc003830ab4e97cdbb743285c4ab8ffae7e37781c77aa41ea44e50a7286952629
APP_PACKAGE_ID=0x5114530c1fc03da3c502cc0036540464b94683af900ac788a47d76aa2adba856

# update seal_config.yaml with APP_PACKAGE_ID inside the enclave

# configure ec2 instance for enclave, see main guide for more details: UsingNautilus.md

# ssh in the ec2 instance containing the repo on configured diff: docker build, run and expose
make ENCLAVE_APP=seal-example && make run && sh expose_enclave.sh

# find the pcrs and set env vars
cat out/nitro.pcrs

PCR0=9351ed1346270bea8cad40e261f4e9eb4c6a66d1e9964cfe24f94bc35ae2fd4e11132011cb7aa262bee2c74fe4cb3b66
PCR1=9351ed1346270bea8cad40e261f4e9eb4c6a66d1e9964cfe24f94bc35ae2fd4e11132011cb7aa262bee2c74fe4cb3b66
PCR2=21b9efbc184807662e966d34f390821309eeac6802309798826296bf3e8bec7c10edb30948c90ba67310f7b964fc500a

# populate name and url
MODULE_NAME=timeline
OTW_NAME=TIMELINE
ENCLAVE_URL=http://13.212.13.94:3000

# update pcrs
sui client call --function update_pcrs --module enclave --package $ENCLAVE_PACKAGE_ID --type-args "$APP_PACKAGE_ID::$MODULE_NAME::$OTW_NAME" --args $ENCLAVE_CONFIG_OBJECT_ID $CAP_OBJECT_ID 0x$PCR0 0x$PCR1 0x$PCR2

# optional, update name
sui client call --function update_name --module enclave --package $ENCLAVE_PACKAGE_ID --type-args "$APP_PACKAGE_ID::$MODULE_NAME::$OTW_NAME" --args $ENCLAVE_CONFIG_OBJECT_ID $CAP_OBJECT_ID "some name here"

# register the enclave onchain
sh register_enclave.sh $ENCLAVE_PACKAGE_ID $APP_PACKAGE_ID $ENCLAVE_CONFIG_OBJECT_ID $ENCLAVE_URL $MODULE_NAME $OTW_NAME

# read from output the created enclave obj id and finds its initial shared version
ENCLAVE_OBJECT_ID=0x9b8bc44069abc9843bbd2f54b4e7732136cc7c615c34959f98ab2f7c74f002bd
ENCLAVE_OBJ_VERSION=722158400
```

Currently, the enclave is running but has no `SEAL_API_KEY` and cannot process requests.

```bash
curl -H 'Content-Type: application/json' -d '{"payload": { "location": "San Francisco"}}' -X POST http://<PUBLIC_IP>:3000/process_data

{"error":"API key not initialized. Please complete key load first."}%
```

### Step 1: Encrypt Secret

The Seal CLI command can be ran in the root directory of [Seal repo](https://github.com/MystenLabs/seal). This step can be done anywhere where the secret value is secure. The output is later used for step 4.

This command looks up the public keys of the specified key servers ID using public fullnode on the given network. Then it uses the identity `id`, threshold `t`, the specified key servers `-k` and the policy package `-p` to encrypt the secret.

```bash
# in seal repo
# set package id from step 0
APP_PACKAGE_ID=0x1d10a3f87bdba6e54d2d09f7d708d5f9c6b3160b2599f5f01b18012eff8cb41e
cargo run --bin seal-cli encrypt --secret 736b2d6f722d76312d35313736653034316633623236656639653838306436646337613230643435383263313765333233663363633462326466643538663532626366636334336536 \
    --id 0x00 \
    -p $APP_PACKAGE_ID \
    -t 2 \
    -k 0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8 \
    -n testnet

Encrypted object:
<ENCRYPTED_OBJECT>
```

`--secret`: The secret value you are encrypting in Hex format. Only the enclave has access to decrypt it. Here we use an example value for `weather-api-key` converted from UTF-8 to Hex:

```python
>>> '045a27812dbe456392913223221306'.encode('utf-8').hex()
'303435613237383132646265343536333932393133323233323231333036'
```

`--id`: A fixed value of 0x00. This is the identity used to encrypt any data to the enclave.
`-p`: The package ID containing the Seal policy (the APP_PACKAGE_ID from Step 0).
`-k`: A list of key server object ids. Here we use the two Mysten open testnet servers.
`-t`: Threshold used for encryption.
`-n`: The network of the key servers you are using.

### Step 2: Initialize Key Load

This step is done in the host that the enclave runs in, that can communicate to the enclave via port 3001.

In this call, the enclave creates a certificate (signed by the wallet) and constructs a PTB calling `seal_approve`. The enclave ephemeral keypair signs an intent message of the wallet public key. A session key signs the request and returns the encoded FetchKeyRequest.

```bash
# use ENCLAVE_OBJECT_ID and ENCLAVE_OBJ_VERSION from step 0
curl -X POST http://localhost:3001/admin/init_seal_key_load \
  -H 'Content-Type: application/json' \
  -d '{"enclave_object_id": "0x7c81d9d63530be773cf94733e742963f820cda0747f855534d2ca234a43c811f", "initial_shared_version": 734118493}'

# Expected response:
{"encoded_request":"<FETCH_KEY_REQUEST>"}
```

### Step 3: Fetch Keys from Seal Servers

The Seal CLI command can be run in the root of [Seal repo](https://github.com/MystenLabs/seal). This can be done anywhere with any Internet connection. Replace `<FETCH_KEY_REQUEST>` with the output from Step 2.

This command parses the Hex encoded BCS serialized `FetchKeyRequest` and fetches keys from the specified key server objects for the given network. Each key server verifies the PTB and signature, then returns encrypted key shares (encrypted to enclave's ephemeral ElGamal key) if the Seal policy is satisfied. The CLI gathers all responses and return a Hex encoded value containing a list of Seal object IDs and its server responses.

```bash
# in seal repo
cargo run --bin seal-cli fetch-keys --request cc024251414341514141515543477139704d6275515458464e62786749544e717679704247627869596e4e7134745a70645a494d2b5a355848536a44687a2f374d51706d46344a567a6169313659724a6237324d4c7a5a65576357552f38794c4949414345674b356456586e5131456a6e435a783761456d6b64586837436a6d636c4a366b587677445a397762705a7a6b41434b776235632b62415141414151463867646e574e54432b647a7a35527a506e5170592f67677a614230663456564e4e4c4b493070447942483133437753734141414141414145416c7a566f476533684d74752b616d62744f79594f4863686f6f566843654f6a7666414377774d58594852634f633256686246393361476c305a5778706333515663325668624639686348427962335a6c5832567559327868646d567a41415542414141424151414241674142417741424241413da882251ea8bfffbd920607b958b61852aa78d24f43bb11027f42a9c5be8eb4c74425a6e52ae156ed585123c3c0b572f3b655af8023d737bdcbe6f780b221436b5ee7a9e685d0535cb1ff1c61a188bf45f3e4fa66b7a1f28f72f9490c76e792e209f614a9ada9a8350af02fe8e0bc5c90356ce6a86e828775a5067de39ef29531f6e8bc6b57e217401701beff3102c73c442e82700c76db1b9520bff8c0f8da2fddde8528be18d5731e0dc2f39d2e744cd9b6b8afac924e4387d17dac1116c491aaa6d1508ee34460836403f34c174203a9e881eb953cab05fa6f724119d7d73f76026eb8e04f1a315c35ede1a97fde4d516661163c931d9778efc498df24dc40d743727bc1eb40e579956a6c8be08000ac1be5cf9b0100001e00610008baa519dbe16701e48126e6966503218c049713a93f0cce778aa17a46aa94f3952d68aad2af505554b38051c495f01c47ea84a7ad3fc317af427b42fef134012b97555e74351239c2671eda12691d5e1ec28e672527a917bf00d9f706e9673900 \
    -k 0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8 \
    -t 2 \
    -n testnet

Encoded seal responses:
<ENCODED_SEAL_RESPONSES>
```

`--request`: Output of step 2.
`-k`: A list of key server object ids, here we use the two Mysten open testnet servers.
`-t`: Threshold used for encryption.
`-n`: The network of the key servers you are using.

### Step 4: Complete Key Load

This step is done in the host that the enclave runs in, that can communicate to the enclave via 3001. If it returns OK, the enclave decrypts and caches the Seal keys in memory. Replace `<ENCODED_SEAL_RESPONSES>` with the output from Step 3.

```bash
curl -X POST http://localhost:3001/admin/complete_seal_key_load \
  -H "Content-Type: application/json" \
  -d '{
    "seal_responses": "0273d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75012197356819ede132dbbe6a66ed3b260e1dc868a1584278e8ef7c00b0c0c5d81d17009881b48050643208d6aa9707ee7c8ed1d6616b5f5b86b7e2247414d54af75451b81db57261dc48bce2304af73368466aa240c48a859f25c93b61c1a94dc38d964a43ebdb6eaeb4e7abb842772f26bfa71da77d749112b12384a0373451228850f5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8012197356819ede132dbbe6a66ed3b260e1dc868a1584278e8ef7c00b0c0c5d81d170091e9fc82a11de64770dda085f9d4135a45ba17116f8a865989d6fadaba39787fa317973d7e9b8999d4c6177cde1265e490a111750be5846c576948e8fa7badb83120721304c1062ff7492b0925cca99c4a832acf5f5cc62be1799b3f67135040"
  }'

# Expected response:
{"status":"OK"}
```

### Step 5: Provision Weather API Key

This step is done in the host that the enclave runs in, that can communicate to the enclave via port 3001. Replace `<ENCRYPTED_OBJECT>` with the output from Step 1.

In this call, the enclave uses the cached keys from Step 4 to decrypt the encrypted weather API key. This endpoint is application specific and replace or add more if needed. Repeat step 1 to encrypt other data using ID value 0 and provision them to the enclave with an endpoint.

```bash
curl -X POST http://localhost:3001/admin/provision_openrouter_api_key \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted_object": "0097356819ede132dbbe6a66ed3b260e1dc868a1584278e8ef7c00b0c0c5d81d1701000273d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db7501f5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c80202008e511cb1990009965ec6af23efcf55c72b75de00870315715dba6934d0752bcc71d1a377b1f86cd9ab3098917ca21f5a12f59cd612af36e495e3bbe7f3e8674a699a3c29dae5d18dab79d18f822f5a4ec7f4ca0f5274b270cffa488d122abdf3023417c120d80bc4095182f7ab6bcba1d2dada5612d239ee717034b082da58aea0b7cc35f17aa69ef90cadfa171845713d77dcf0c84e33b4fc1596446f2abfdb89457c87c0a59c3f51e9fc800d9d32a2e06be707a48d2e2eceb283d5611fc435e7005907b40812e924e512abde24fab65dab47dfe6e7c5710ffedb99e3fde70a0c5a9420a0656c82ea102fb3eaff375ae9ff81d2c00f1c44c82d20acc80bb4cc7f7d7a81b8518e9e9a2fc5eca6438b16d90b484f62ffe4206ab57ae300"
  }'

# Expected response:
{"status":"OK"}
```

### Step 6: Use the Service

Now the enclave server is fully functional to process data.

```bash
curl -H 'Content-Type: application/json' -d '{"payload": { "location": "San Francisco"}}' -X POST http://<PUBLIC_IP>:3000/process_data

# Example response:
{"response":{"intent":0,"timestamp_ms":1755805500000,"data":{"location":"San Francisco","temperature":18}},"signature":"4587c11eafe8e78c766c745c9f89b3bb7fd1a914d6381921e8d7d9822ddc9556966932df1c037e23bedc21f369f6edc66c1b8af019778eb6b1ec1ee7f324e801"}
```

## Handle Multiple Secrets

Since Seal uses public key encryption, one can encrypt many secrets using the same fixed ID value of 0. Repeat step 1 with any data, using the same package ID and the same ID value of 0.

Run steps 2-4 once to cache the Seal keys for the enclave.

Once keys are cached, decrypt any encrypted object by implementing one or more provision endpoints similar to step 5.

## Multiple Enclaves

Multiple enclaves can access the same Seal encrypted secret. An alternative it to use one enclave to provision to other attested enclaves directly, without needing to fetch keys from Seal.

## Troubleshooting

1. Certificate expired error in Step 3: The certificate in the `FetchKeyRequest` expires after 30 minutes (TTL). Re-run Step 2 or update default to generate a fresh request with a new certificate, then retry Step 3.

2. Enclave Restarts: If the enclave restarts, all ephemeral keys (including cached Seal keys) are lost. You must re-run Steps 2-5 to reinitialize the enclave with secrets.
