use crate::apps::medical_vault_insurer::{
    walrus::download_walrus_blob,
    seal::decrypt_content,
    types::{
        IntentScope, CreateTimelineIntentRequest, TimelineEntryIntentPayload,
        InitKeyLoadRequest, InitKeyLoadResponse,
        CompleteKeyLoadRequest, CompleteKeyLoadResponse,
        ProvisionOpenRouterApiKeyRequest, ProvisionOpenRouterApiKeyResponse,
        SealConfig,    
    },
};
use crate::common::{IntentMessage, ProcessedDataResponse, to_signed_response};
use crate::{AppState, EnclaveError};
use axum::{
    extract::State,
    Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener;
use tracing::info;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use fastcrypto::ed25519::Ed25519KeyPair;
use fastcrypto::encoding::{Base64, Encoding, Hex};
use fastcrypto::groups::bls12381::G1Element;
use fastcrypto::hash::{HashFunction, Sha3_256};
use fastcrypto::traits::{KeyPair, Signer, ToFromBytes};
use rand::thread_rng;
use seal_sdk::types::{ElGamalPublicKey, ElgamalVerificationKey, FetchKeyRequest};
use seal_sdk::{decrypt_seal_responses, genkey, seal_decrypt_object, signed_message, signed_request, Certificate, ElGamalSecretKey};
use sui_crypto::ed25519::Ed25519PrivateKey;
use sui_sdk_types::{
    Address, Argument, Command, Identifier, Input, MoveCall, PersonalMessage,
    ProgrammableTransaction,
};
use tokio::sync::RwLock;

lazy_static::lazy_static! {
    /// Configuration for Seal key servers, containing the Seal policy package ID, key server object
    /// IDs and its public keys, hardcoded here so they can be used to verify fetch key responses.
    pub static ref SEAL_CONFIG: SealConfig = {
        let config_str = include_str!("seal_config.yaml");
        serde_yaml::from_str(config_str)
            .expect("Failed to parse seal_config.yaml")
    };

    /// Encryption secret key generated initialized on startup.
    pub static ref ENCRYPTION_KEYS: (ElGamalSecretKey, ElGamalPublicKey, ElgamalVerificationKey) = {
        genkey(&mut thread_rng())
    };

    /// Wallet stored as bytes, used to sign personal messages for certificate used to fetch keys
    /// from Seal servers.
    pub static ref WALLET_BYTES: [u8; 32] = {
        let keypair = Ed25519KeyPair::generate(&mut thread_rng());
        let private_key = keypair.private();
        let bytes = private_key.as_ref();
        bytes.try_into().expect("Invalid private key length")
    };

    /// Cached Seal keys stored as full_id -> (server_id -> UserSecretKey).
    /// Set when /complete_seal_key_load is called.
    pub static ref CACHED_SEAL_KEYS: RwLock<HashMap<Vec<u8>, HashMap<Address, G1Element>>> = RwLock::new(HashMap::new());

    /// Secret plaintext decrypted with Seal keys.
    /// Set when provisioning encrypted medical data.
    pub static ref SEAL_API_KEY: Arc<RwLock<Option<String>>> = Arc::new(RwLock::new(None));

    /// OpenRouter API key for LLM inference.
    /// Set when /provision_openrouter_api_key is called.
    pub static ref OPENROUTER_API_KEY: Arc<RwLock<Option<String>>> = Arc::new(RwLock::new(None));
}

/// Response for the ping endpoint
#[derive(Debug, Serialize, Deserialize)]
pub struct PingResponse {
    pub message: String,
}

/// Simple ping handler for host-only access
pub async fn ping() -> Json<PingResponse> {
    info!("Host init ping received");
    Json(PingResponse {
        message: "pong".to_string(),
    })
}

/// This endpoint takes an enclave object id with initial shared version. It initializes the session
/// key and uses the wallet to sign the personal message. Returns the Hex encoded BCS serialized
/// FetchKeyRequest. This is called during the first step for the key load phase.
pub async fn init_seal_key_load(
    State(state): State<Arc<AppState>>,
    Json(request): Json<InitKeyLoadRequest>,
) -> Result<Json<InitKeyLoadResponse>, EnclaveError> {
    // Generate the session and create certificate.
    let session = Ed25519KeyPair::generate(&mut thread_rng());
    let session_vk = session.public();
    let creation_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| EnclaveError::GenericError(format!("Time error: {e}")))?
        .as_millis() as u64;
    let ttl_min = 30; // Certificate valid for 30 minutes.
    let message = signed_message(
        SEAL_CONFIG.package_id.to_string(),
        session_vk,
        creation_time,
        ttl_min,
    );

    // Load wallet.
    let wallet = Ed25519PrivateKey::new(*WALLET_BYTES);

    // Sign personal message.
    let signature = {
        use sui_crypto::SuiSigner;
        wallet
            .sign_personal_message(&PersonalMessage(message.as_bytes().into()))
            .map_err(|e| {
                EnclaveError::GenericError(format!("Failed to sign personal message: {e}"))
            })?
    };

    // Create certificate with wallet's address and session vk.
    let certificate = Certificate {
        user: wallet.public_key().derive_address(),
        session_vk: session_vk.clone(),
        creation_time,
        ttl_min,
        signature,
        mvr_name: None,
    };

    // Create PTB for seal_approve_enclaves of package with enclave keypair.
    let ptb = create_ptb(
        SEAL_CONFIG.package_id,
        request.enclave_object_id,
        request.initial_shared_version,
        &state.eph_kp,
        creation_time,
    )
    .await
    .map_err(|e| EnclaveError::GenericError(format!("Failed to create PTB: {e}")))?;

    // Load the encryption public key and verification key.
    let (_enc_secret, enc_key, enc_verification_key) = &*ENCRYPTION_KEYS;

    // Create the FetchKeyRequest.
    let request_message = signed_request(&ptb, enc_key, enc_verification_key);
    let request_signature = session.sign(&request_message);
    let request = FetchKeyRequest {
        ptb: Base64::encode(bcs::to_bytes(&ptb).expect("should not fail")),
        enc_key: enc_key.clone(),
        enc_verification_key: enc_verification_key.clone(),
        request_signature,
        certificate,
    };

    Ok(Json(InitKeyLoadResponse {
        encoded_request: Hex::encode(bcs::to_bytes(&request).expect("should not fail")),
    }))
}

/// This endpoint accepts encoded seal responses and decrypts the keys from all servers. The
/// decrypted keys are cached in CACHED_SEAL_KEYS for later use when decrypting objects on demand.
/// This is called at the third step of the key load phase, after fetch key is done.
pub async fn complete_seal_key_load(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<CompleteKeyLoadRequest>,
) -> Result<Json<CompleteKeyLoadResponse>, EnclaveError> {
    // Decrypt ALL keys from ALL servers and cache them
    let (enc_secret, _enc_key, _enc_verification_key) = &*ENCRYPTION_KEYS;
    let seal_keys = decrypt_seal_responses(
        enc_secret,
        &request.seal_responses,
        &SEAL_CONFIG.server_pk_map,
    )
    .map_err(|e| EnclaveError::GenericError(format!("Failed to decrypt seal responses: {e}")))?;

    // Cache the Seal keys for later use.
    CACHED_SEAL_KEYS.write().await.extend(seal_keys);

    Ok(Json(CompleteKeyLoadResponse {
        status: "OK".to_string(),
    }))
}

/// This endpoint decrypts an OpenRouter API key using cached Seal keys.
/// The decrypted key is stored in OPENROUTER_API_KEY for LLM inference calls.
pub async fn provision_openrouter_api_key(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<ProvisionOpenRouterApiKeyRequest>,
) -> Result<Json<ProvisionOpenRouterApiKeyResponse>, EnclaveError> {
    // Decrypt the encrypted object using cached keys.
    let cached_keys_read = CACHED_SEAL_KEYS.read().await;
    let api_key_bytes = seal_decrypt_object(
        &request.encrypted_object,
        &cached_keys_read,
        &SEAL_CONFIG.server_pk_map,
    )
    .map_err(|e| EnclaveError::GenericError(format!("Failed to decrypt OpenRouter API key: {e}")))?;

    // Convert decrypted bytes to UTF-8 string.
    let api_key_str = String::from_utf8(api_key_bytes)
        .map_err(|e| EnclaveError::GenericError(format!("Invalid UTF-8 in API key: {e}")))?;

    // Store the API key so it can be used for LLM inference calls.
    let mut api_key_guard = (*OPENROUTER_API_KEY).write().await;
    *api_key_guard = Some(api_key_str);

    Ok(Json(ProvisionOpenRouterApiKeyResponse {
        status: "OK".to_string(),
    }))
}
/// Signing payload struct that matches Move contract's struct EnclavePK. Signed by enclave ephemeral
/// keypair.
#[derive(serde::Serialize, Debug)]
struct EnclavePKPayload {
    pk: Vec<u8>,
}

/// Helper function that creates a PTB with a single seal_approve_enclaves command for the given ID and the
/// enclave shared object. The signature argument is created using the enclave ephemeral keypair
/// signing over the intent message of wallet public key.
pub async fn create_ptb(
    package_id: Address,
    enclave_object_id: Address,
    initial_shared_version: u64,
    enclave_kp: &Ed25519KeyPair,
    timestamp: u64,
) -> Result<ProgrammableTransaction, Box<dyn std::error::Error>> {
    let mut inputs = vec![];
    let mut commands = vec![];

    // Load wallet.
    let wallet = Ed25519PrivateKey::new(*WALLET_BYTES);
    let wallet_pk = wallet.public_key().as_bytes().to_vec();

    // Create intent message with wallet public key.
    let signing_payload = EnclavePKPayload {
        pk: wallet_pk.clone(),
    };
    let intent_msg = IntentMessage::new(signing_payload, timestamp, IntentScope::WalletPK as u8); // 1 = WalletPK intent for seal_approve_enclaves

    // Sign with enclave ephemeral keypair.
    let signing_bytes = bcs::to_bytes(&intent_msg)?;
    let signature = enclave_kp.sign(&signing_bytes).as_bytes().to_vec();

    // Input 0: ID (fixed vector[0] for seal policy).
    inputs.push(Input::Pure {
        value: bcs::to_bytes(&vec![0u8])?,
    });

    // Input 1: signature.
    inputs.push(Input::Pure {
        value: bcs::to_bytes(&signature)?,
    });

    // Input 2: wallet_pk.
    inputs.push(Input::Pure {
        value: bcs::to_bytes(&wallet_pk)?,
    });

    // Input 3: timestamp.
    inputs.push(Input::Pure {
        value: bcs::to_bytes(&timestamp)?,
    });

    // Input 4: shared enclave object.
    inputs.push(Input::Shared {
        object_id: enclave_object_id,
        initial_shared_version,
        mutable: false,
    });

    // Create seal_approve_enclaves Move call.
    let move_call = MoveCall {
        package: package_id,
        module: Identifier::new("seal_whitelist")?,
        function: Identifier::new("seal_approve_enclaves")?,
        type_arguments: vec![],
        arguments: vec![
            Argument::Input(0), // id
            Argument::Input(1), // signature
            Argument::Input(2), // wallet_pk
            Argument::Input(3), // timestamp
            Argument::Input(4), // enclave object
        ],
    };
    commands.push(Command::MoveCall(move_call));

    Ok(ProgrammableTransaction { inputs, commands })
}


/// Compute semantic hash from decrypted content (FHIR bundle JSON)
fn compute_semantic_hash_from_content(content: &[u8]) -> Result<String, EnclaveError> {
    // Parse the JSON content
    let bundle: serde_json::Value = serde_json::from_slice(content)
        .map_err(|e| EnclaveError::GenericError(format!("Failed to parse JSON content: {e}")))?;
    
    // Canonicalize using JCS-style sorted, indented JSON
    let canonical = serde_json::to_string_pretty(&bundle)
        .map_err(|e| EnclaveError::GenericError(format!("Canonicalization failed: {e}")))?;
    
    // Compute SHA3-256 hash
    let mut hasher = Sha3_256::default();
    hasher.update(canonical.as_bytes());
    let result = hasher.finalize();
    
    Ok(Hex::encode(result))
}

// ============================================
// Timeline Entry Intent Endpoint
// ============================================


/// Process a create timeline entry intent request:
/// 1. Download encrypted blob from Walrus
/// 2. Decrypt using cached Seal keys
/// 3. Compute semantic hash from decrypted content
/// 4. Compare with expected semantic hash
/// 5. Return signed intent response
pub async fn process_create_timeline_intent(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateTimelineIntentRequest>,
) -> Result<Json<ProcessedDataResponse<IntentMessage<TimelineEntryIntentPayload>>>, EnclaveError> {
    let blob_id_str = String::from_utf8_lossy(&request.walrus_blob_id).to_string();
    info!("Processing create timeline intent request for blob: {}", blob_id_str);
    
    let current_timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| EnclaveError::GenericError(format!("Failed to get current timestamp: {e}")))?
        .as_millis() as u64;
    
    // Step 1: Download blob from Walrus
    let blob_content = match download_walrus_blob(&blob_id_str).await {
        Ok(content) => content,
        Err(e) => {            
            return Err(EnclaveError::WalrusError(
                format!("Failed to download Walrus blob: {}", e),
            ));
        }
    };
    
    // Step 2: Decrypt using cached Seal keys
    let decrypted_content = decrypt_content(
        &blob_content,
        Address::from_bytes(&request.policy_id)
            .map_err(|e| EnclaveError::GenericError(format!("Invalid policy ID: {}", e)))?,
        &state,
    ).await?;

    // Step 3: Compute semantic hash from decrypted content
    let computed_hash = match compute_semantic_hash_from_content(&decrypted_content) {
        Ok(hash) => hash,
        Err(e) => {
            return Err(EnclaveError::GenericError(
                format!("Failed to compute semantic hash: {}", e),
            ));
        }
    };
    
    // Step 4: Compare with expected semantic hash
    let hash_valid = computed_hash == request.expected_semantic_hash;
    
    if !hash_valid {
        return Err(EnclaveError::GenericError(
            "Semantic hash mismatch".to_string(),
        ));
    }
    
    Ok(Json(to_signed_response(
        &state.eph_kp,
        TimelineEntryIntentPayload {
            patient_ref_bytes: request.patient_ref_bytes.clone(),
            walrus_blob_id: request.walrus_blob_id.clone(),
            content_hash: request.content_hash.clone(),
        },
        current_timestamp,
        IntentScope::TimelineEntry as u8,
    )))
}


/// Spawn a separate server on localhost:3001 for host-only bootstrap access.
pub async fn spawn_host_init_server(state: Arc<AppState>) -> Result<(), EnclaveError> {
    let host_app = Router::new()
        .route("/ping", get(ping))
        .route("/admin/init_seal_key_load", post(init_seal_key_load))
        .route(
            "/admin/complete_seal_key_load",
            post(complete_seal_key_load),
        )
        .route(
            "/admin/provision_openrouter_api_key",
            post(provision_openrouter_api_key),
        )
        .with_state(state);

    let host_listener = TcpListener::bind("127.0.0.1:3001")
        .await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to bind host init server: {e}")))?;

    info!(
        "Host-only init server listening on {}",
        host_listener.local_addr().unwrap()
    );

    tokio::spawn(async move {
        axum::serve(host_listener, host_app.into_make_service())
            .await
            .expect("Host init server failed");
    });

    Ok(())
}