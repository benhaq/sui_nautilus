use crate::EnclaveError;
use reqwest;
use tracing::info;

/// Download blob content from Walrus aggregator
pub async fn download_walrus_blob(blob_id: &str) -> Result<Vec<u8>, EnclaveError> {
    let client = reqwest::Client::new();
    
    // Walrus aggregator endpoint for reading blob
    let url = format!(
        "https://aggregator.walrus-testnet.walrus.space/v1/blobs/{}",
        blob_id
    );
    
    info!("Downloading blob from Walrus: {}", blob_id);
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to download Walrus blob: {e}")))?;
    
    // Get status before consuming the response
    let status_code = response.status();
    
    // Read bytes first (this consumes the response)
    let bytes = response
        .bytes()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to read blob bytes: {e}")))?
        .to_vec();
    
    if !status_code.is_success() {
        let error_text = String::from_utf8_lossy(&bytes);
        return Err(EnclaveError::GenericError(format!(
            "Walrus blob download failed with status {}: {}",
            status_code,
            error_text
        )));
    }
    
    info!("Downloaded blob: {} bytes", bytes.len());
    Ok(bytes)
}
