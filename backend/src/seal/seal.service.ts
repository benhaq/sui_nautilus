import { EncryptedObject, SealClient, SessionKey } from '@mysten/seal';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex } from '@mysten/sui/utils';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SuiService } from '../sui/sui.service';

/**
 * Seal whitelist interface for two-level access control
 * - Writers (owner + doctors): Can encrypt AND decrypt data
 * - Readers (members): Can ONLY decrypt data
 */
export interface SealWhitelist {
  whitelistId: string; // On-chain whitelist object ID
  owner: string; // Owner address (patient)
  writers: string[]; // Addresses that can encrypt & decrypt (doctors)
  readers: string[]; // Addresses that can only decrypt (members)
  roleRestrictions?: string[]; // Additional restrictions
}

export interface SealWrapResult {
  sealedKeyId: string;
  encryptedKey: string;
  whitelistId: string;
}

export interface SealUnwrapResult {
  key: Buffer;
  whitelistId: string;
}

@Injectable()
export class SealService {
  private readonly logger = new Logger(SealService.name);
  private sealEnabled: boolean;
  private suiClient: SuiClient;
  private sealClient: SealClient | null = null;
  private sealPackageId: string;
  private serverObjectIds: string[];
  private threshold: number;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => SuiService))
    private suiService: SuiService,
  ) {
    this.sealEnabled = this.configService.get<boolean>('SEAL_ENABLED') || false;
    const network = this.configService.get<string>('SUI_NETWORK') || 'testnet';

    // Seal package IDs by network
    this.sealPackageId =
      network === 'mainnet'
        ? '0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d'
        : '0x927a54e9ae803f82ebf480136a9bcff45101ccbe28b13f433c89f5181069d682';

    // Key server object IDs from environment or use defaults
    const serverIds = this.configService.get<string>('SEAL_SERVER_OBJECT_IDS');
    this.serverObjectIds = serverIds
      ? serverIds.split(',').map((id) => id.trim())
      : [
          '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
          '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
        ];

    this.threshold = this.configService.get<number>('SEAL_THRESHOLD') || 2;

    if (this.sealEnabled) {
      // Create SuiClient with proper typing for Seal compatibility
      const fullnodeUrl = getFullnodeUrl(network as 'mainnet' | 'testnet' | 'devnet' | 'localnet');
      this.suiClient = new SuiClient({ url: fullnodeUrl });
      this.initializeSealClient();
      this.logger.log(`Seal encryption service enabled`);
      this.logger.log(`Network: ${network}`);
      this.logger.log(`Seal Package ID: ${this.sealPackageId}`);
      this.logger.log(`Key Servers: ${this.serverObjectIds.length}`);
      this.logger.log(`Threshold: ${this.threshold}`);
    } else {
      this.logger.warn('Seal encryption service disabled - using local encryption only');
    }
  }

  /**
   * Initialize Seal client with key server configurations
   */
  private async initializeSealClient() {
    try {
      this.sealClient = new SealClient({
        suiClient: this.suiClient as any, // Type assertion to handle version mismatch
        serverConfigs: this.serverObjectIds.map((id) => ({
          objectId: id,
          weight: 1,
        })),
        verifyKeyServers: false, // Set to true in production for first-time verification
      });
      this.logger.log('Seal client initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Seal client: ${error.message}`);
      this.sealEnabled = false;
    }
  }

  ////////////////////////////////////////////////////////////
  // Seal Encryption/Decryption Operations
  ////////////////////////////////////////////////////////////

  /**
   * Encrypt data with Seal for WRITE operations
   * Uses the official Seal SDK encrypt method
   * Only owner and writers (doctors) can encrypt
   */
  async encryptData(
    data: Buffer,
    packageId: string,
    id: string,
  ): Promise<{ encryptedData: Buffer; backupKey: Buffer }> {
    if (!this.sealEnabled || !this.sealClient) {
      // Fallback: simple encryption without Seal
      return this.localEncrypt(data);
    }

    try {
      this.logger.log(`[ENCRYPT] packageId: ${packageId}`);
      this.logger.log(`[ENCRYPT] id (whitelistId): ${id}`);
      this.logger.log(`[ENCRYPT] threshold: ${this.threshold}`);

      const { encryptedObject: encryptedBytes, key: backupKey } = await this.sealClient.encrypt({
        threshold: this.threshold,
        packageId: packageId,
        id: id,
        data,
      });

      this.logger.log(`Data encrypted successfully`);
      return {
        encryptedData: Buffer.from(encryptedBytes),
        backupKey: Buffer.from(backupKey),
      };
    } catch (error) {
      this.logger.error('Error encrypting with Seal:', error.message);
      // Fallback to local encryption if Seal fails
      this.logger.warn('Falling back to local encryption');
      return this.localEncrypt(data);
    }
  }

  /**
   * Wrap encryption key with Seal whitelist for WRITE operations (deprecated - use encryptData)
   * This creates a whitelist-bound encrypted key for encryption operations
   * Only owner and writers (doctors) can wrap keys
   */
  async wrapKey(key: Buffer, whitelist: SealWhitelist): Promise<SealWrapResult> {
    if (!this.sealEnabled || !this.sealClient) {
      // Fallback: simple key wrapping without Seal
      return this.localWrapKey(key, whitelist);
    }

    try {
      this.logger.log(`Wrapping key with Seal - Whitelist: ${whitelist.whitelistId}`);

      // Use encrypt method with the key as data
      const { encryptedObject: encryptedBytes } = await this.sealClient.encrypt({
        threshold: this.threshold,
        packageId: this.sealPackageId,
        id: whitelist.whitelistId,
        data: key,
      });

      const encryptedObject = EncryptedObject.parse(encryptedBytes);

      this.logger.log(`Key wrapped successfully: ${encryptedObject.id}`);
      return {
        sealedKeyId: encryptedObject.id,
        encryptedKey: Buffer.from(encryptedBytes).toString('base64'),
        whitelistId: whitelist.whitelistId,
      };
    } catch (error) {
      this.logger.error('Error wrapping key with Seal:', error.message);
      // Fallback to local wrapping if Seal fails
      this.logger.warn('Falling back to local key wrapping');
      return this.localWrapKey(key, whitelist);
    }
  }

  /**
   * Decrypt data using Seal for READ operations
   * Requires requester to have a valid session key with signature
   * Uses seal_approve_read or seal_approve_write based on access
   */
  async decryptData(
    encryptedData: Buffer,
    packageId: string,
    moduleName: string,
    approveFunction: string,
    id: string,
    sessionKey: SessionKey,
    additionalArgs?: any[],
  ): Promise<Buffer> {
    if (!this.sealEnabled || !this.sealClient) {
      // Fallback: local decrypt (for development/testing)
      return this.localDecrypt(encryptedData);
    }

    try {
      this.logger.log(`[DECRYPT] packageId: ${packageId}`);
      this.logger.log(`[DECRYPT] moduleName: ${moduleName}`);
      this.logger.log(`[DECRYPT] approveFunction: ${approveFunction}`);
      this.logger.log(`[DECRYPT] id (whitelistId): ${id}`);
      this.logger.log(`[DECRYPT] SessionKey address: ${(sessionKey as any).address}`);
      this.logger.log(`[DECRYPT] SessionKey packageId: ${(sessionKey as any).packageId}`);

      // Create transaction for seal_approve function
      const tx = new Transaction();

      // Remove '0x' prefix if present for hex conversion
      const cleanId = id.startsWith('0x') ? id.slice(2) : id;

      // Arguments for seal_approve_read: (id: vector<u8>, whitelist: &SealWhitelist, _clock: &Clock, ctx: &TxContext)
      // Note: TxContext is implicit, Clock needs to be the shared Sui clock object
      const args = [
        tx.pure.vector('u8', fromHex(cleanId)), // id as vector<u8>
        tx.object(id), // whitelist object reference
        tx.object('0x6'), // Sui system clock object (always 0x6)
      ];

      // Add additional arguments if provided (e.g., WhitelistAdminCap for write operations)
      if (additionalArgs && additionalArgs.length > 0) {
        args.push(...additionalArgs);
      }

      this.logger.log(`[DECRYPT] PTB target: ${packageId}::${moduleName}::${approveFunction}`);
      this.logger.log(`[DECRYPT] PTB args count: ${args.length}`);

      tx.moveCall({
        target: `${packageId}::${moduleName}::${approveFunction}`,
        arguments: args,
      });

      const txBytes = await tx.build({
        client: this.suiClient,
        onlyTransactionKind: true,
      });

      const decryptedBytes = await this.sealClient.decrypt({
        data: encryptedData,
        sessionKey,
        txBytes,
      });

      this.logger.log('Data decrypted successfully');
      return Buffer.from(decryptedBytes);
    } catch (error) {
      this.logger.error('Error decrypting with Seal:', error.message);
      // Fallback to local decrypt
      this.logger.warn('Falling back to local decryption');
      return this.localDecrypt(encryptedData);
    }
  }

  /**
   * Create a session key for decryption operations
   * User must sign the message in their wallet
   */
  async createSessionKey(
    address: string,
    packageId: string,
    ttlMin: number = 60,
  ): Promise<{ sessionKey: SessionKey; message: Uint8Array }> {
    if (!this.sealEnabled) {
      throw new Error('Seal is not enabled');
    }

    try {
      this.logger.log(`[SESSION_KEY] Creating for address: ${address}`);
      this.logger.log(`[SESSION_KEY] packageId: ${packageId}`);
      this.logger.log(`[SESSION_KEY] ttlMin: ${ttlMin}`);

      const sessionKey = await SessionKey.create({
        address,
        packageId, // Keep as string - Seal SDK expects string format
        ttlMin,
        suiClient: this.suiClient as any, // Type assertion to handle version mismatch
      });

      const message = sessionKey.getPersonalMessage();

      this.logger.log(`Session key created successfully`);
      return { sessionKey, message };
    } catch (error) {
      this.logger.error('Error creating session key:', error.message);
      throw error;
    }
  }

  async getSessionKey(sesssionKey: any): Promise<SessionKey> {
    return await SessionKey.import(sesssionKey, this.suiClient);
  }

  /**
   * Unwrap encryption key using Seal for READ operations (deprecated - use decryptData)
   * Requires requester address to be in the whitelist (owner, writer, or reader)
   */
  async unwrapKey(
    sealedKeyId: string,
    encryptedKeyData: string,
    packageId: string,
    moduleName: string,
    approveFunction: string,
    sessionKey: SessionKey,
    additionalArgs?: any[],
  ): Promise<Buffer> {
    if (!this.sealEnabled || !this.sealClient) {
      // Fallback: local unwrap (for development/testing)
      return this.localUnwrapKey(sealedKeyId, '');
    }

    try {
      this.logger.log(`Unwrapping key with Seal - ID: ${sealedKeyId}`);

      const encryptedBytes = Buffer.from(encryptedKeyData, 'base64');

      // Create transaction for seal_approve function
      const tx = new Transaction();
      const args = [tx.pure.vector('u8', fromHex(sealedKeyId))];

      if (additionalArgs && additionalArgs.length > 0) {
        args.push(...additionalArgs);
      }

      tx.moveCall({
        target: `${packageId}::${moduleName}::${approveFunction}`,
        arguments: args,
      });

      const txBytes = await tx.build({
        client: this.suiClient,
        onlyTransactionKind: true,
      });

      const decryptedKey = await this.sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });

      this.logger.log('Key unwrapped successfully');
      return Buffer.from(decryptedKey);
    } catch (error) {
      this.logger.error('Error unwrapping key with Seal:', error.message);
      // Fallback to local unwrap
      this.logger.warn('Falling back to local key unwrapping');
      return this.localUnwrapKey(sealedKeyId, '');
    }
  }

  ////////////////////////////////////////////////////////////
  // On-Chain Whitelist Management
  ////////////////////////////////////////////////////////////

  /**
   * Create a whitelist on-chain (new simplified signature)
   */
  async createWhitelistOnChain(
    owner: string,
    name: string,
    patient: string,
    doctors: string[],
    members: string[],
    privateKey?: string,
  ): Promise<{
    whitelistId: string;
    adminCapId: string;
    digest: string;
  }> {
    try {
      this.logger.log(`Creating whitelist on-chain: ${name}...`);

      const result = await this.suiService.createWhitelistAndExecute(
        owner,
        name,
        patient,
        privateKey,
      );

      if (!result.success || !result.whitelistId) {
        throw new Error('Failed to create whitelist on-chain');
      }

      this.logger.log(`Whitelist created: ${result.whitelistId}`);

      // Add doctors
      if (doctors.length > 0 && result.whitelistCapId) {
        for (const doctor of doctors) {
          try {
            await this.addDoctorToWhitelist(
              result.whitelistId,
              result.whitelistCapId,
              doctor,
              owner,
              privateKey,
            );
          } catch (error) {
            this.logger.error(`Failed to add doctor ${doctor}: ${error.message}`);
          }
        }
      }

      // Add members
      if (members.length > 0 && result.whitelistCapId) {
        for (const member of members) {
          try {
            await this.addMemberToWhitelist(
              result.whitelistId,
              result.whitelistCapId,
              member,
              owner,
              privateKey,
            );
          } catch (error) {
            this.logger.error(`Failed to add member ${member}: ${error.message}`);
          }
        }
      }

      return {
        whitelistId: result.whitelistId,
        adminCapId: result.whitelistCapId,
        digest: result.digest,
      };
    } catch (error) {
      this.logger.error(`Error creating whitelist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a doctor to an existing whitelist on-chain (write access)
   */
  async addDoctorToWhitelist(
    whitelistId: string,
    whitelistCapId: string,
    doctorAddress: string,
    ownerAddress: string,
    privateKey?: string,
  ): Promise<{ success: boolean; digest: string }> {
    try {
      this.logger.log(`Adding doctor ${doctorAddress} to whitelist ${whitelistId}...`);

      const result = await this.suiService.addDoctorToWhitelistAndExecute(
        whitelistId,
        whitelistCapId,
        doctorAddress,
        ownerAddress,
        privateKey,
      );

      this.logger.log(`Doctor added successfully: ${result.digest}`);
      return result;
    } catch (error) {
      this.logger.error(`Error adding doctor to whitelist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a doctor from whitelist on-chain
   */
  async removeDoctorFromWhitelist(
    whitelistId: string,
    whitelistCapId: string,
    doctorAddress: string,
    ownerAddress: string,
    privateKey?: string,
  ): Promise<{ success: boolean; digest: string }> {
    try {
      this.logger.log(`Removing doctor ${doctorAddress} from whitelist ${whitelistId}...`);

      const result = await this.suiService.removeDoctorFromWhitelistAndExecute(
        whitelistId,
        whitelistCapId,
        doctorAddress,
        ownerAddress,
        privateKey,
      );

      this.logger.log(`Doctor removed successfully: ${result.digest}`);
      return result;
    } catch (error) {
      this.logger.error(`Error removing doctor from whitelist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a member to an existing whitelist on-chain (read-only access)
   */
  async addMemberToWhitelist(
    whitelistId: string,
    whitelistCapId: string,
    memberAddress: string,
    ownerAddress: string,
    privateKey?: string,
  ): Promise<{ success: boolean; digest: string }> {
    try {
      this.logger.log(`Adding member ${memberAddress} to whitelist ${whitelistId}...`);

      const result = await this.suiService.addMemberToWhitelistAndExecute(
        whitelistId,
        whitelistCapId,
        memberAddress,
        ownerAddress,
        privateKey,
      );

      this.logger.log(`Member added successfully: ${result.digest}`);
      return result;
    } catch (error) {
      this.logger.error(`Error adding member to whitelist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a member from whitelist on-chain
   */
  async removeMemberFromWhitelist(
    whitelistId: string,
    whitelistCapId: string,
    memberAddress: string,
    ownerAddress: string,
    privateKey?: string,
  ): Promise<{ success: boolean; digest: string }> {
    try {
      this.logger.log(`Removing member ${memberAddress} from whitelist ${whitelistId}...`);

      const result = await this.suiService.removeMemberFromWhitelistAndExecute(
        whitelistId,
        whitelistCapId,
        memberAddress,
        ownerAddress,
        privateKey,
      );

      this.logger.log(`Member removed successfully: ${result.digest}`);
      return result;
    } catch (error) {
      this.logger.error(`Error removing member from whitelist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get whitelist records from chain
   */
  async getWhitelistRecords(whitelistId: string): Promise<string[]> {
    try {
      const whitelist = await this.suiService.getWhitelist(whitelistId);
      const fields = (whitelist.content as any)?.fields;
      return fields?.records || [];
    } catch (error) {
      this.logger.error(`Error getting whitelist records: ${error.message}`);
      return [];
    }
  }

  ////////////////////////////////////////////////////////////
  // Access Control Helpers
  ////////////////////////////////////////////////////////////

  /**
   * Verify if an address has write access (encrypt) for a folder
   * Only owner and doctors can write
   */
  canWriteRecord(requesterAddress: string, owner: string, doctors: string[]): boolean {
    return requesterAddress === owner || doctors.includes(requesterAddress);
  }

  /**
   * Verify if an address has read access (decrypt) for a folder
   * Owner, doctors, and members can read
   */
  canReadRecord(
    requesterAddress: string,
    owner: string,
    doctors: string[],
    members: string[],
  ): boolean {
    return (
      requesterAddress === owner ||
      doctors.includes(requesterAddress) ||
      members.includes(requesterAddress)
    );
  }

  ////////////////////////////////////////////////////////////
  // Local Fallback Methods (Development Only)
  ////////////////////////////////////////////////////////////

  /**
   * Local encryption (fallback when Seal is not available)
   * WARNING: This is a simplified version for development only
   */
  private localEncrypt(data: Buffer): {
    encryptedData: Buffer;
    backupKey: Buffer;
  } {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const encryptedData = Buffer.concat([iv, authTag, encrypted]);

    this.logger.warn('Using local encryption - NOT SECURE FOR PRODUCTION');

    return {
      encryptedData,
      backupKey: key,
    };
  }

  /**
   * Local decryption (fallback)
   * WARNING: This is a simplified version for development only
   */
  private localDecrypt(encryptedData: Buffer): Buffer {
    this.logger.warn('Local decrypt used - NOT SECURE FOR PRODUCTION');
    // Return dummy decrypted data for development
    return Buffer.from('Decrypted data (local fallback)');
  }

  /**
   * Local key wrapping (fallback when Seal is not available)
   * WARNING: This is a simplified version for development only
   */
  private localWrapKey(key: Buffer, whitelist: SealWhitelist): SealWrapResult {
    const sealedKeyId = crypto.randomUUID();

    // Simple encryption with whitelist metadata
    const wrappingKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, iv);

    const encryptedKey = Buffer.concat([cipher.update(key), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // In production, store this securely with the whitelist
    const wrapped = Buffer.concat([iv, authTag, encryptedKey]);

    this.logger.warn('Using local key wrapping - NOT SECURE FOR PRODUCTION');

    return {
      sealedKeyId,
      encryptedKey: wrapped.toString('base64'),
      whitelistId: whitelist.whitelistId,
    };
  }

  /**
   * Local key unwrapping (fallback)
   * WARNING: This is a simplified version for development only
   */
  private localUnwrapKey(sealedKeyId: string, requesterAddress: string): Buffer {
    // In production, verify requesterAddress against stored whitelist
    // For now, return a dummy key (this should never be used in production)
    this.logger.warn(`Local unwrap used - NOT SECURE FOR PRODUCTION`);
    return crypto.randomBytes(32);
  }
}
