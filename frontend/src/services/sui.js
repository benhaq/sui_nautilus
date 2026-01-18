import { SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { MEDICAL_VAULT_PACKAGE_ID, SUI_RPC_URL } from '../utils/constants'

/**
 * Sui Blockchain Service
 */
class SuiService {
  constructor() {
    this.client = new SuiClient({ url: SUI_RPC_URL })
  }

  /**
   * Sign message with wallet
   * @param {Object} wallet - Connected wallet
   * @param {string} message - Message to sign
   */
  async signMessage(wallet, message) {
    try {
      const signedMessage = await wallet.signPersonalMessage({
        message: new TextEncoder().encode(message),
      })
      return signedMessage
    } catch (error) {
      console.error('Failed to sign message:', error)
      throw error
    }
  }

  /**
   * Create medical folder on-chain
   */
  async createMedicalFolder(wallet, folderName, description) {
    try {
      const tx = new Transaction()
      
      tx.moveCall({
        target: `${MEDICAL_VAULT_PACKAGE_ID}::medical_record::create_folder`,
        arguments: [
          tx.pure.string(folderName),
          tx.pure.string(description),
        ],
      })

      const result = await wallet.signAndExecuteTransaction({
        transaction: tx,
      })

      return result
    } catch (error) {
      console.error('Failed to create folder:', error)
      throw error
    }
  }

  /**
   * Grant access permission on-chain
   */
  async grantAccess(wallet, recordId, granteeAddress, accessLevel, expirationDate) {
    try {
      const tx = new Transaction()
      
      tx.moveCall({
        target: `${MEDICAL_VAULT_PACKAGE_ID}::medical_record::grant_access`,
        arguments: [
          tx.pure.id(recordId),
          tx.pure.address(granteeAddress),
          tx.pure.u8(accessLevel),
          tx.pure.u64(expirationDate),
        ],
      })

      const result = await wallet.signAndExecuteTransaction({
        transaction: tx,
      })

      return result
    } catch (error) {
      console.error('Failed to grant access:', error)
      throw error
    }
  }

  /**
   * Revoke access permission on-chain
   */
  async revokeAccess(wallet, permissionId) {
    try {
      const tx = new Transaction()
      
      tx.moveCall({
        target: `${MEDICAL_VAULT_PACKAGE_ID}::medical_record::revoke_access`,
        arguments: [
          tx.pure.id(permissionId),
        ],
      })

      const result = await wallet.signAndExecuteTransaction({
        transaction: tx,
      })

      return result
    } catch (error) {
      console.error('Failed to revoke access:', error)
      throw error
    }
  }

  /**
   * Get medical record from chain
   */
  async getMedicalRecord(recordId) {
    try {
      const record = await this.client.getObject({
        id: recordId,
        options: {
          showContent: true,
          showOwner: true,
        },
      })
      return record
    } catch (error) {
      console.error('Failed to get record:', error)
      throw error
    }
  }

  /**
   * Get account balance
   */
  async getBalance(address) {
    try {
      const balance = await this.client.getBalance({
        owner: address,
      })
      return balance
    } catch (error) {
      console.error('Failed to get balance:', error)
      throw error
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(digest) {
    try {
      const tx = await this.client.getTransactionBlock({
        digest,
        options: {
          showEffects: true,
          showInput: true,
          showEvents: true,
        },
      })
      return tx
    } catch (error) {
      console.error('Failed to get transaction:', error)
      throw error
    }
  }
}

export default new SuiService()
