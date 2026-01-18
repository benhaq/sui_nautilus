// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Json;
use fastcrypto::ed25519::Ed25519KeyPair;
use serde_json::json;
use std::fmt;

pub mod apps {
    #[cfg(feature = "medical-vault-insurer")]
    #[path = "medical-vault-insurer/mod.rs"]
    pub mod medical_vault_insurer;
}

pub mod app {
    #[cfg(feature = "medical-vault-insurer")]
    pub use crate::apps::medical_vault_insurer::*;
}

pub mod common;

/// App state, at minimum needs to maintain the ephemeral keypair.  
pub struct AppState {
    /// Ephemeral keypair on boot
    pub eph_kp: Ed25519KeyPair,
    /// API key when querying api.weatherapi.com
    pub api_key: String,
}

/// Implement IntoResponse for EnclaveError.
impl IntoResponse for EnclaveError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            EnclaveError::GenericError(e) => (StatusCode::BAD_REQUEST, e),
            EnclaveError::WalrusError(e) => (StatusCode::INTERNAL_SERVER_ERROR, e),
            EnclaveError::SealError(e) => (StatusCode::INTERNAL_SERVER_ERROR, e),
        };
        let body = Json(json!({
            "error": error_message,
        }));
        (status, body).into_response()
    }
}

/// Enclave errors enum.
#[derive(Debug)]
pub enum EnclaveError {
    GenericError(String),
    WalrusError(String),
    SealError(String),
}

impl fmt::Display for EnclaveError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EnclaveError::GenericError(e) => write!(f, "{e}"),
            EnclaveError::WalrusError(e) => write!(f, "Walrus error: {e}"),
            EnclaveError::SealError(e) => write!(f, "Seal error: {e}"),
        }
    }
}

impl std::error::Error for EnclaveError {}
