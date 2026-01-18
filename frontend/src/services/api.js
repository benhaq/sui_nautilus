import { API_BASE_URL } from '../utils/constants';

/**
 * API Client for Medical Vault Backend
 */
class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Make HTTP request
   * @private
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    console.log('API Request:', url);
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      console.log('API Response status:', response.status, response.statusText);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
      }

      const data = await response.json();
      console.log('API Response data:', data);
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // ==================== Whitelists Management ====================

  /**
   * Create new whitelist (with privateKey for auto-execute, or returns txBytes)
   */
  async createWhitelist(data) {
    return this.request('/whitelists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get user's whitelists from blockchain (real-time)
   */
  async getUserWhitelists(address) {
    return this.request(`/whitelists/user/${address}/chain`);
  }

  /**
   * Check user access to whitelist (from on-chain)
   */
  async checkWhitelistAccess(whitelistId, address) {
    return this.request(`/whitelists/${whitelistId}/access/${address}`);
  }

  /**
   * Add doctor to whitelist (with privateKey for auto-execute, or returns txBytes)
   */
  async addDoctor(whitelistId, data) {
    return this.request(`/whitelists/${whitelistId}/doctors`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Remove doctor from whitelist
   */
  async removeDoctor(whitelistId, data) {
    return this.request(`/whitelists/${whitelistId}/doctors`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  }

  /**
   * Add member to whitelist (with privateKey for auto-execute, or returns txBytes)
   */
  async addMember(whitelistId, data) {
    return this.request(`/whitelists/${whitelistId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Remove member from whitelist
   */
  async removeMember(whitelistId, data) {
    return this.request(`/whitelists/${whitelistId}/members`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  }

  // ==================== Medical Records ====================

  /**
   * Upload medical record with files
   * Can work with or without privateKey (wallet signing)
   */
  async uploadRecord(formData) {
    const url = `${this.baseURL}/records/upload`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.error || error.message || 'Upload failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Upload Error:', error);
      throw error;
    }
  }

  /**
   * Get record details
   */
  async getRecordDetails(recordId) {
    return this.request(`/records/${recordId}`);
  }

  /**
   * Get all records in whitelist
   */
  async getWhitelistRecords(whitelistId) {
    return this.request(`/records/whitelist/${whitelistId}`);
  }

  /**
   * Upload file to Walrus (proxied through backend to avoid CORS)
   * @param {File} file - File to upload
   * @param {number} epochs - Number of epochs to store (default: 3)
   * @param {string} sendTo - Address to send the Blob object to (optional)
   * @returns {Promise<Object>} Walrus upload result with blobId
   */
  async uploadToWalrus(file, epochs = 3, sendTo = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('epochs', epochs.toString());
    if (sendTo) {
      formData.append('sendTo', sendTo);
    }

    const url = `${this.baseURL}/walrus/upload`;
    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        // Don't set Content-Type header, let browser set it with boundary for FormData
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Walrus upload failed" }));
        throw new Error(error.error || error.message || "Walrus upload failed");
      }

      return await response.json();
    } catch (error) {
      console.error("Walrus Upload Error:", error);
      throw error;
    }
  }

  /**
   * Process file content through data processing endpoint
   * @param {string} rawData - File content as string
   * @param {string} sourceFormat - Source format (e.g., 'text', 'pdf', 'image')
   * @param {boolean} includePhi - Whether to include PHI (Protected Health Information)
   * @param {string} processDataUrl - Optional custom URL for process_data endpoint
   * @returns {Promise<Object>} Processed data result
   */
  async processData(rawData, sourceFormat = 'text', includePhi = true, processDataUrl = null) {
    const url = processDataUrl || 'http://3.0.207.181:3000/process_data';
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw_data: rawData,
          source_format: sourceFormat,
          include_phi: includePhi,
        }),
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: "Process data failed" }));
        throw new Error(error.error || error.message || "Process data failed");
      }

      return await response.json();
    } catch (error) {
      console.error("Process Data Error:", error);
      throw error;
    }
  }

  /**
   * Download and decrypt file
   */
  /**
   * Step 1: Prepare download - Get message to sign
   */
  async prepareDownload(recordId, requesterAddress, fileIndex = 0) {
    const url = `${this.baseURL}/records/${recordId}/download/prepare`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requesterAddress,
          fileIndex,
        }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: 'Failed to prepare download' }));
        throw new Error(error.error || error.message || 'Failed to prepare download');
      }

      return await response.json();
    } catch (error) {
      console.error('Prepare Download Error:', error);
      throw error;
    }
  }

  /**
   * Step 2: Complete download with signature
   */
  async viewRecord(recordId, sessionId, signature) {
    const url = `${this.baseURL}/records/${recordId}/view`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          signature,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'View failed' }));
        throw new Error(error.error || error.message || 'View failed');
      }

      return await response.blob();
    } catch (error) {
      console.error('View Error:', error);
      throw error;
    }
  }

  async completeDownload(recordId, sessionId, signature) {
    const url = `${this.baseURL}/records/${recordId}/download/complete`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          signature,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(error.error || error.message || 'Download failed');
      }

      return await response.blob();
    } catch (error) {
      console.error('Complete Download Error:', error);
      throw error;
    }
  }

  /**
   * @deprecated Use prepareDownload + completeDownload instead
   * Legacy method for backward compatibility
   */
  async downloadRecord(recordId, data) {
    const url = `${this.baseURL}/records/${recordId}/download`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(error.error || error.message || 'Download failed');
      }

      return await response.blob();
    } catch (error) {
      console.error('Download Error:', error);
      throw error;
    }
  }

  // ==================== Logs & History ====================

  /**
   * Get actions by address (with pagination)
   */
  async getUserActions(address, page = 1, limit = 50) {
    return this.request(`/log/address/${address}?page=${page}&limit=${limit}`);
  }

  /**
   * Get actions by whitelist
   */
  async getWhitelistActions(whitelistId) {
    return this.request(`/log/whitelist/${whitelistId}`);
  }

  /**
   * Get actions by type
   */
  async getActionsByType(actionType) {
    return this.request(`/log/type/${actionType}`);
  }

  /**
   * Get all actions (with pagination)
   */
  async getAllActions(page = 1, limit = 50) {
    return this.request(`/log?page=${page}&limit=${limit}`);
  }

  /**
   * Get actions between two users
   */
  async getRelationshipActions(address, targetAddress) {
    return this.request(`/log/relationship/${address}/${targetAddress}`);
  }

  /**
   * Get whitelists by owner from database (audit logs)
   */
  async getWhitelistsByOwner(owner) {
    return this.request(`/log/whitelists/owner/${owner}`);
  }

  /**
   * Get whitelists by doctor from database (audit logs)
   */
  async getWhitelistsByDoctor(doctorAddress) {
    return this.request(`/log/whitelists/doctor/${doctorAddress}`);
  }

  /**
   * Get whitelists by member from database (audit logs)
   */
  async getWhitelistsByMember(memberAddress) {
    return this.request(`/log/whitelists/member/${memberAddress}`);
  }

  /**
   * Get whitelist details from database (audit log)
   */
  async getWhitelistDetailsFromDB(whitelistId) {
    return this.request(`/log/whitelists/${whitelistId}`);
  }

  /**
   * Get record details from database (audit log)
   */
  async getRecordDetailsFromDB(recordId) {
    return this.request(`/log/records/${recordId}`);
  }

  /**
   * Get records by whitelist from database (audit log)
   */
  async getRecordsByWhitelistFromDB(whitelistId) {
    return this.request(`/log/records/whitelist/${whitelistId}`);
  }

  /**
   * Get records by uploader
   */
  async getRecordsByUploader(uploader) {
    return this.request(`/log/records/uploader/${uploader}`);
  }

  // ==================== MCP Protocol API ====================

  /**
   * Search patient records using natural language (MCP)
   */
  async mcpSearchPatientRecord(query, patientAddress, accessToken = null) {
    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return this.request('/mcp/search', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, patientAddress }),
    });
  }

  /**
   * Get clinical summary (MCP)
   */
  async mcpGetClinicalSummary(patientId, accessToken = null) {
    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return this.request(`/mcp/clinical-summary?patientId=${patientId}`, {
      method: 'GET',
      headers,
    });
  }

  /**
   * Query FHIR resources (MCP)
   */
  async mcpQueryFHIRResource(resourceType, params, accessToken = null) {
    const headers = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return this.request('/mcp/fhir/query', {
      method: 'POST',
      headers,
      body: JSON.stringify({ resourceType, params }),
    });
  }

  /**
   * Translate natural language to FHIR query
   */
  async mcpNaturalLanguageToFHIR(query) {
    return this.request('/mcp/nlp-to-fhir', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  /**
   * Get MCP capabilities
   */
  async mcpGetCapabilities() {
    return this.request('/mcp/capabilities', {
      method: 'GET',
    });
  }

  // ==================== Payment API (x402) ====================

  /**
   * Initiate payment for MCP endpoint access
   */
  async paymentInitiate(patientAddress, endpoint, amount = null) {
    return this.request('/payment/initiate', {
      method: 'POST',
      body: JSON.stringify({ patientAddress, endpoint, amount }),
    });
  }

  /**
   * Verify payment and get access token
   */
  async paymentVerify(paymentId, transactionDigest) {
    return this.request('/payment/verify', {
      method: 'POST',
      body: JSON.stringify({ paymentId, transactionDigest }),
    });
  }

  /**
   * Get payment history
   */
  async paymentGetHistory(patientAddress, limit = 50) {
    return this.request(`/payment/history?patientAddress=${patientAddress}&limit=${limit}`);
  }

  /**
   * Get pricing information
   */
  async paymentGetPricing() {
    return this.request('/payment/pricing', {
      method: 'GET',
    });
  }

  /**
   * Validate access token
   */
  async paymentValidateToken(token, patientAddress) {
    return this.request('/payment/validate-token', {
      method: 'POST',
      body: JSON.stringify({ token, patientAddress }),
    });
  }

  // ==================== Beep A402 Payment API ====================

  /**
   * Initialize Beep MCP session
   */
  async beepInitSession(clientInfo = { name: 'medical-vault', version: '1.0.0' }) {
    return this.request('/beep/session/init', {
      method: 'POST',
      body: JSON.stringify({ clientInfo }),
    });
  }

  /**
   * List available Beep MCP tools
   */
  async beepListTools(sessionId) {
    return this.request(`/beep/tools?sessionId=${sessionId}`);
  }

  /**
   * Initiate A402 payment through Beep
   */
  async beepInitiatePayment(sessionId, patientAddress, endpoint, amount, currency = 'USDC') {
    return this.request('/beep/payment/initiate', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        patientAddress,
        endpoint,
        amount,
        currency,
      }),
    });
  }

  /**
   * Verify A402 payment
   */
  async beepVerifyPayment(paymentId, transactionDigest) {
    return this.request('/beep/payment/verify', {
      method: 'POST',
      body: JSON.stringify({ paymentId, transactionDigest }),
    });
  }

  /**
   * Get A402 payment history
   */
  async beepGetPaymentHistory(patientAddress, limit = 50) {
    return this.request(`/beep/payment/history?address=${patientAddress}&limit=${limit}`);
  }
}

export default new ApiClient();
