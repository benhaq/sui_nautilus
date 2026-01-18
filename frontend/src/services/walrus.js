import { WALRUS_AGGREGATOR_URL, WALRUS_PUBLISHER_URL } from '../utils/constants'

/**
 * Walrus Storage Service for decentralized file storage
 */
class WalrusService {
  constructor() {
    this.publisherUrl = WALRUS_PUBLISHER_URL
    this.aggregatorUrl = WALRUS_AGGREGATOR_URL
  }

  /**
   * Upload file to Walrus
   * @param {File} file - File to upload
   * @param {number} epochs - Number of epochs to store
   */
  async uploadFile(file, epochs = 1) {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${this.publisherUrl}/v1/store?epochs=${epochs}`, {
        method: 'PUT',
        body: file,
      })

      if (!response.ok) {
        throw new Error('Failed to upload to Walrus')
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Walrus upload error:', error)
      throw error
    }
  }

  /**
   * Download file from Walrus
   * @param {string} blobId - Blob ID from Walrus
   */
  async downloadFile(blobId) {
    try {
      const response = await fetch(`${this.aggregatorUrl}/v1/${blobId}`)

      if (!response.ok) {
        throw new Error('Failed to download from Walrus')
      }

      const blob = await response.blob()
      return blob
    } catch (error) {
      console.error('Walrus download error:', error)
      throw error
    }
  }

  /**
   * Get file URL from Walrus
   * @param {string} blobId - Blob ID from Walrus
   */
  getFileUrl(blobId) {
    return `${this.aggregatorUrl}/v1/${blobId}`
  }

  /**
   * Check blob status
   * @param {string} blobId - Blob ID to check
   */
  async getBlobStatus(blobId) {
    try {
      const response = await fetch(`${this.aggregatorUrl}/v1/status/${blobId}`)

      if (!response.ok) {
        throw new Error('Failed to get blob status')
      }

      const status = await response.json()
      return status
    } catch (error) {
      console.error('Walrus status error:', error)
      throw error
    }
  }

  /**
   * Delete blob from Walrus
   * @param {string} blobId - Blob ID to delete
   */
  async deleteBlob(blobId) {
    try {
      const response = await fetch(`${this.publisherUrl}/v1/delete/${blobId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete from Walrus')
      }

      return await response.json()
    } catch (error) {
      console.error('Walrus delete error:', error)
      throw error
    }
  }
}

export default new WalrusService()
