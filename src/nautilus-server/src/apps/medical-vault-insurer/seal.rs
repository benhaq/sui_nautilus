
use crate::apps::medical_vault_insurer::endpoints::{SEAL_CONFIG, ENCRYPTION_KEYS};
use crate::apps::medical_vault_insurer::AppState;
use crate::EnclaveError;
use reqwest;
use seal_sdk::{seal_decrypt_object, decrypt_seal_responses, EncryptedObject};
use seal_sdk::types::FetchKeyResponse;
use seal_sdk::{signed_message, signed_request};
use sui_sdk_types::{Argument, Command, Identifier, Input, MoveCall, PersonalMessage, ProgrammableTransaction, Address};
use fastcrypto::ed25519::Ed25519KeyPair;
use fastcrypto::traits::{KeyPair as _, Signer};
use fastcrypto::encoding::{Base64, Encoding, Hex};
use tracing::{info, error};
use sui_crypto::SuiSigner;

pub async fn decrypt_content(
    encrypted_bytes: &[u8],
    seal_policy_id: Address,
    current_shared_version: u64,
    state: &AppState,
) -> Result<Vec<u8>, EnclaveError> {
    // The frontend stores encrypted_details as UTF-8 bytes of base64 string
    let encrypted_str = String::from_utf8(encrypted_bytes.to_vec())
        .map_err(|e| EnclaveError::GenericError(format!("Invalid UTF-8 in encrypted_details: {}", e)))?;

    info!("  Encrypted details length: {} chars", encrypted_str.len());


    // Decode base64 to get SEAL encrypted object bytes
    let seal_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encrypted_str)
        .map_err(|e| EnclaveError::GenericError(format!("Failed to decode base64: {}", e)))?;

    // Parse SEAL encrypted object
    let encrypted_obj: EncryptedObject = bcs::from_bytes(&seal_bytes)
        .map_err(|e| EnclaveError::GenericError(format!("Failed to parse SEAL encrypted object: {}", e)))?;

    info!("  SEAL encryption ID: {}", Hex::encode(&encrypted_obj.id));

    // Create session key
    let session_key = Ed25519KeyPair::generate(&mut rand::thread_rng());
    let session_vk = session_key.public();

    let creation_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| EnclaveError::GenericError(format!("Time error: {}", e)))?
        .as_millis() as u64;

    let ttl_min = 30;

    let message = signed_message(
        SEAL_CONFIG.package_id.to_string(),
        session_vk,
        creation_time,
        ttl_min,
    );

    // Sign with TEE key
    let sui_private_key = {
        let priv_key_bytes = state.eph_kp.as_ref();
        let key_bytes: [u8; 32] = priv_key_bytes
            .try_into()
            .expect("Invalid private key length");
        sui_crypto::ed25519::Ed25519PrivateKey::new(key_bytes)
    };

    // Sign with TEE key - returns UserSignature directly
    let user_signature = sui_private_key
        .sign_personal_message(&PersonalMessage(message.as_bytes().into()))
        .map_err(|e| EnclaveError::GenericError(format!("Failed to sign: {}", e)))?;

    // Create certificate - derive address from public key
    let certificate_user = sui_private_key.public_key().derive_address();

    info!("  TEE address: {}", certificate_user);

    // Build seal_approve_tee PTB
    let ptb = ProgrammableTransaction {
        inputs: vec![
            Input::Pure {
                value: bcs::to_bytes(&encrypted_obj.id).unwrap(),
            },
            Input::Shared {
                object_id: seal_policy_id,
                initial_shared_version: current_shared_version,
                mutable: false,
            },
        ],
        commands: vec![
            Command::MoveCall(MoveCall {
                package: SEAL_CONFIG.package_id,
                module: Identifier::new("seal_policy").unwrap(),
                function: Identifier::new("seal_approve_read").unwrap(),
                type_arguments: vec![],
                arguments: vec![
                    Argument::Input(0), // encryption_id
                    Argument::Input(1), // seal_policy
                ],
            }),
        ],
    };

    // Create fetch request
    let (enc_secret, enc_key, enc_verification_key) = &*ENCRYPTION_KEYS;

    let request_message = signed_request(&ptb, enc_key, enc_verification_key);
    let request_signature = session_key.sign(&request_message);

    let fetch_request = seal_sdk::types::FetchKeyRequest {
        ptb: Base64::encode(bcs::to_bytes(&ptb).unwrap()),
        enc_key: enc_key.clone(),
        enc_verification_key: enc_verification_key.clone(),
        request_signature,
        certificate: seal_sdk::Certificate {
            user: certificate_user,
            session_vk: session_vk.clone(),
            creation_time,
            ttl_min,
            signature: user_signature,
            mvr_name: None,
        },
    };

    let mut responses: Vec<(Address, FetchKeyResponse)> = Vec::new();
    let client = reqwest::Client::new();

    for server_id in &SEAL_CONFIG.key_servers {
        let server_url = if server_id.to_string() == "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75" {
            "https://seal-key-server-testnet-1.mystenlabs.com"
        } else {
            "https://seal-key-server-testnet-2.mystenlabs.com"
        };

        let url = format!("{}/v1/fetch_key", server_url);
        info!("  Calling SEAL server: {}", server_url);

        // Use to_json_string for proper signature serialization
        let request_body = fetch_request.to_json_string()
            .map_err(|e| EnclaveError::GenericError(format!("Failed to serialize request: {}", e)))?;

        match client.post(&url)
            .header("Client-Sdk-Version", "0.5.11")
            .header("Content-Type", "application/json")
            .body(request_body.clone())
            .send()
            .await
        {
            Ok(response) => {
                let status = response.status();
                if status.is_success() {
                    match response.json::<FetchKeyResponse>().await {
                        Ok(fetch_response) => {
                            info!("  Got key from {}", server_url);
                            responses.push((*server_id, fetch_response));
                        }
                        Err(e) => {
                            error!("  Failed to parse response: {}", e);
                        }
                    }
                } else {
                    let error_body = response.text().await.unwrap_or_default();
                    error!("  Server error {}: {}", status, error_body);
                }
            }
            Err(e) => {
                error!("  Connection failed: {}", e);
            }
        }
    }

    if responses.is_empty() {
        return Err(EnclaveError::GenericError("Failed to fetch keys from any SEAL server".to_string()));
    }

    info!("  Got {} key responses", responses.len());

    let seal_keys = decrypt_seal_responses(
        enc_secret,
        &responses,
        &SEAL_CONFIG.server_pk_map,
    )
    .map_err(|e| EnclaveError::GenericError(format!("Failed to decrypt seal responses: {}", e)))?;

    // Decrypt
    let decrypted_result = seal_decrypt_object(
        &encrypted_obj,
        &seal_keys,
        &SEAL_CONFIG.server_pk_map,
    )
    .map_err(|e| EnclaveError::GenericError(format!("SEAL decryption failed: {}", e)))?;

    if decrypted_result.is_empty() {
        return Err(EnclaveError::GenericError("No data decrypted".to_string()));
    }

    Ok(decrypted_result)
}
