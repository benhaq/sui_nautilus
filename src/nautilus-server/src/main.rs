// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

use anyhow::Result;
use axum::{routing::get, routing::post, Router};
use fastcrypto::{ed25519::Ed25519KeyPair, traits::KeyPair};
#[cfg(feature = "medical-vault-insurer")]
use nautilus_server::apps::medical_vault_insurer::{process_data, process_create_timeline_intent, spawn_host_init_server};
#[cfg(not(feature = "medical-vault-insurer"))]
use nautilus_server::app::process_data;
use nautilus_server::common::{get_attestation, health_check};
use nautilus_server::AppState;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    let eph_kp = Ed25519KeyPair::generate(&mut rand::thread_rng());
    // Medical-vault-insurer uses Seal, so no API key needed from environment
    let api_key = String::new();

    let state = Arc::new(AppState { eph_kp, api_key });

    // Spawn host-only init server for Seal key provisioning (port 3001)
    #[cfg(feature = "medical-vault-insurer")]
    {
        spawn_host_init_server(state.clone()).await?;
    }

    // Define your own restricted CORS policy here if needed.
    let cors = CorsLayer::new().allow_methods(Any).allow_headers(Any);

    let app = Router::new()
        .route("/", get(ping))
        .route("/get_attestation", get(get_attestation))
        .route("/process_data", post(process_data))
        .route("/process_create_timeline_intent", post(process_create_timeline_intent))
        .route("/health_check", get(health_check))
        .with_state(state)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    info!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app.into_make_service())
        .await
        .map_err(|e| anyhow::anyhow!("Server error: {e}"))
}

async fn ping() -> &'static str {
    "Pong!"
}
