import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MulterFile } from 'src/utils/types';
import { SealService } from '../seal/seal.service';
import { SuiService } from '../sui/sui.service';
import { WalrusService } from '../walrus/walrus.service';
import { DownloadRecordFileDto, UploadRecordDto } from './dto/record.dto';

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);
  private packageId: string;
  private downloadSessions: Map<string, any>; // In-memory storage for download sessions

  constructor(
    private suiService: SuiService,
    private sealService: SealService,
    private walrusService: WalrusService,
    private configService: ConfigService,
  ) {
    this.packageId = this.configService.get<string>('MEDICAL_VAULT_PACKAGE_ID');
  }

  /**
   * Parse private key from various formats
   */
  private parsePrivateKey(privateKey: string): Ed25519Keypair {
    try {
      if (privateKey.startsWith('suiprivkey')) {
        const { secretKey } = decodeSuiPrivateKey(privateKey);
        return Ed25519Keypair.fromSecretKey(secretKey);
      } else {
        return Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'base64'));
      }
    } catch (error) {
      throw new BadRequestException(`Invalid private key format: ${error.message}`);
    }
  }

  /**
   * Upload medical record(s) to whitelist
   * Uses Seal to encrypt data, then uploads encrypted data to Walrus
   * Saves Walrus CID on-chain via contract
   */
  async uploadRecord(uploadRecordDto: UploadRecordDto, files: MulterFile[]) {
    try {
      const { whitelistId, adminCapId, uploader, docTypes, privateKey } = uploadRecordDto;
      if (files.length !== docTypes.length) {
        throw new BadRequestException('Number of files must match number of doc types');
      }

      const walrusCids: string[] = [];
      const sealedKeyRefs: string[] = [];

      // Get whitelist details
      const whitelistData = await this.suiService.getWhitelist(whitelistId);
      const whitelistFields = (whitelistData.content as any)?.fields;
      const owner = whitelistFields?.owner;
      const doctors = whitelistFields?.doctors || [];
      const members = whitelistFields?.members || [];

      // Verify uploader has write permission
      const hasWritePermission = this.sealService.canWriteRecord(uploader, owner, doctors);

      if (!hasWritePermission) {
        throw new ForbiddenException('Uploader does not have write permission for this whitelist');
      }

      // Determine if uploader is the owner or a doctor
      // Only owner should use adminCapId, doctors should use null
      const isOwner = uploader.toLowerCase() === owner.toLowerCase();
      const finalAdminCapId = isOwner ? adminCapId : null;

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Encrypt file data using Seal
        // ID is the whitelistId which is used for access control
        const { encryptedData, backupKey } = await this.sealService.encryptData(
          file.buffer,
          this.packageId,
          whitelistId,
        );

        // Upload encrypted data to Walrus
        const walrusResult = await this.walrusService.uploadBlob(
          encryptedData,
          `${file.originalname}.enc`,
        );

        walrusCids.push(walrusResult.blobId);

        // Store backup key reference (the Seal encrypted object ID)
        // In Seal, the encryptedData contains metadata including the ID
        // We'll use the walrusCid as the reference since the encrypted data is stored there
        sealedKeyRefs.push(walrusResult.blobId);
      }

      // Register record on-chain with Walrus CIDs
      const recordId = crypto.randomUUID();

      // If privateKey is provided, execute on-chain immediately
      if (privateKey) {
        const result = await this.suiService.uploadRecordAndExecute(
          uploader,
          whitelistId,
          finalAdminCapId,
          recordId,
          walrusCids,
          sealedKeyRefs,
          docTypes,
          privateKey,
        );

        return {
          success: true,
          message: 'Record encrypted with Seal, uploaded to Walrus, and registered on-chain',
          recordId: result.recordId, // Use the on-chain object ID
          filesUploaded: files.length,
          walrusCids,
          sealedKeyRefs,
          digest: result.digest,
          explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
        };
      } else {
        // Return transaction for client to sign
        const txData = await this.suiService.registerRecord(
          uploader,
          whitelistId,
          finalAdminCapId,
          recordId,
          walrusCids,
          sealedKeyRefs,
          docTypes,
        );

        // Store pending upload info temporarily (for confirmation later)
        const pendingUploadData = {
          recordId,
          whitelistId,
          adminCapId: finalAdminCapId,
          uploader,
          walrusCids,
          sealedKeyRefs,
          docTypes,
          originalFileNames: files.map((f) => f.originalname),
          filesCount: files.length,
        };

        return {
          success: true,
          message:
            'Files encrypted with Seal and uploaded to Walrus. Please sign transaction with your wallet to register on-chain.',
          pendingRecordId: recordId,
          filesUploaded: files.length,
          walrusCids,
          sealedKeyRefs,
          transactionBlockBytes: txData.transactionBytes,
          // Include data needed for confirmation
          uploadData: pendingUploadData,
        };
      }
    } catch (error) {
      this.logger.error('Error uploading record:', error);
      throw new BadRequestException(`Failed to upload record: ${error.message}`);
    }
  }

  /**
   * Get record details with encrypted data
   * Checks if requester has read permission
   * Returns metadata and Walrus CIDs for encrypted files
   */
  async getRecord(recordId: string, requesterAddress?: string) {
    try {
      const record = await this.suiService.getRecord(recordId);
      const recordData = (record as any).parsedJson || (record as any).content?.fields;

      if (!recordData) {
        throw new NotFoundException('Record data not found');
      }

      // Get whitelist to check permissions
      const whitelistId = recordData.whitelist_id;
      const whitelistData = await this.suiService.getWhitelist(whitelistId);
      const whitelistFields = (whitelistData.content as any)?.fields;

      const owner = whitelistFields?.owner;
      const doctors = whitelistFields?.doctors || [];
      const members = whitelistFields?.members || [];

      // // Check if requester has read permission
      // if (requesterAddress) {
      //   const hasReadPermission = this.sealService.canReadRecord(
      //     requesterAddress,
      //     owner,
      //     doctors,
      //     members,
      //   );

      //   if (!hasReadPermission) {
      //     throw new ForbiddenException(
      //       'You do not have permission to access this record',
      //     );
      //   }
      // }

      // Convert walrus_cid from vector<u8> arrays to strings
      const walrusCids = (recordData.walrus_cid || []).map((cid: any) => {
        if (Array.isArray(cid)) {
          return Buffer.from(cid).toString('utf-8');
        }
        return cid;
      });

      // Convert sealed_key_ref from vector<u8> arrays to strings
      const sealedKeyRefs = (recordData.sealed_key_ref || []).map((ref: any) => {
        if (Array.isArray(ref)) {
          return Buffer.from(ref).toString('utf-8');
        }
        return ref;
      });

      // Return record with Walrus CIDs (encrypted data references)
      return {
        success: true,
        record: {
          id: recordId,
          whitelistId,
          uploader: recordData.uploader,
          timestamp: recordData.timestamp,
          walrusCids,
          sealedKeyRefs,
          docTypes: recordData.doc_type || [],
          // Access control info
          accessControl: {
            owner,
            doctors,
            members,
            canWrite: requesterAddress
              ? this.sealService.canWriteRecord(requesterAddress, owner, doctors)
              : false,
            canRead: requesterAddress
              ? this.sealService.canReadRecord(requesterAddress, owner, doctors, members)
              : false,
          },
        },
        message:
          'Record retrieved. Files are encrypted. Use decrypt endpoint with SessionKey to access content.',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Error fetching record ${recordId}:`, error);
      throw new NotFoundException(`Record not found: ${error.message}`);
    }
  }

  /**
   * Download and decrypt a specific file from a record
   * Requires SessionKey for Seal decryption
   */
  async downloadRecordFile(
    recordId: string,
    fileIndex: number,
    requesterAddress: string,
    sessionKey: any, // SessionKey from Seal SDK
  ): Promise<{ decryptedData: Buffer; filename: string }> {
    try {
      // Get record and check permissions
      const recordInfo = await this.getRecord(recordId, requesterAddress);
      const record = recordInfo.record;
      console.log('Record info retrieved', record);
      // if (!record.accessControl.canRead) {
      //   throw new ForbiddenException(
      //     'You do not have permission to download files from this record',
      //   );
      // }

      if (fileIndex >= record.walrusCids.length) {
        throw new BadRequestException('Invalid file index');
      }

      // Download encrypted data from Walrus
      const walrusCid = record.walrusCids[fileIndex];

      const encryptedData = await this.walrusService.downloadBlob(walrusCid);

      // Decrypt with Seal
      const moduleName = 'seal_whitelist'; // Your contract module name
      const approveFunction = 'seal_approve_read'; // Function for read access

      this.logger.log(`Decrypting file with Seal...`);
      const decryptedData = await this.sealService.decryptData(
        encryptedData,
        this.packageId,
        moduleName,
        approveFunction,
        record.whitelistId,
        sessionKey,
      );

      this.logger.log('File decrypted successfully');

      return {
        decryptedData,
        filename: `record_${recordId}_file_${fileIndex}`,
      };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error downloading file:`, error);
      throw new BadRequestException(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Get all records in a whitelist
   */
  async getRecordsByWhitelist(whitelistId: string) {
    try {
      const recordIds = await this.sealService.getWhitelistRecords(whitelistId);

      const records = await Promise.all(recordIds.map((id) => this.suiService.getRecord(id)));

      return {
        success: true,
        count: records.length,
        records,
      };
    } catch (error) {
      this.logger.error(`Error fetching records for whitelist ${whitelistId}:`, error);
      throw new BadRequestException(`Failed to fetch records: ${error.message}`);
    }
  }

  /**
   * Prepare download - Get message to sign
   * Step 1: Client calls this to get the message that needs to be signed
   */
  async prepareDownload(
    recordId: string,
    requesterAddress: string,
    fileIndex: number,
  ): Promise<{
    sessionId: string;
    message: Uint8Array;
    messageBase64: string;
    mimeType: string;
    extension: string;
    ttl: number;
  }> {
    try {
      // Get record and check permissions
      const recordInfo = await this.getRecord(recordId, requesterAddress);
      const record = recordInfo.record;

      if (fileIndex >= record.walrusCids.length) {
        throw new BadRequestException('Invalid file index');
      }

      // Determine mime type based on doc type
      const docTypeNames = ['lab', 'imaging', 'notes', 'prescription', 'other'];
      const docType = record.docTypes[fileIndex] || 4;
      const docTypeName = docTypeNames[docType] || 'unknown';
      let mimeType = 'application/octet-stream';
      let extension = '';
      if (docTypeName === 'lab' || docTypeName === 'notes' || docTypeName === 'prescription') {
        mimeType = 'text/plain';
        extension = '.txt';
      } else if (docTypeName === 'imaging') {
        mimeType = 'image/png';
        extension = '.png';
      }

      // Create SessionKey - this generates the message to be signed
      const { sessionKey, message } = await this.sealService.createSessionKey(
        requesterAddress,
        this.packageId, // Medical Vault package ID for the approve function
        30, // 30 minutes TTL
      );

      // Store session temporarily (in-memory for now, use Redis in production)
      const sessionId = crypto.randomUUID();
      if (!this.downloadSessions) {
        this.downloadSessions = new Map();
      }
      const exportedSessionKey = sessionKey.export();
      this.downloadSessions.set(sessionId, {
        recordId,
        fileIndex,
        requesterAddress,
        exportedSessionKey,
        message,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      });

      // Clean up expired sessions
      this.cleanupExpiredSessions();

      this.logger.log(`Download session prepared: ${sessionId}`);

      return {
        sessionId,
        message,
        messageBase64: Buffer.from(message).toString('base64'),
        mimeType,
        extension,
        ttl: 30 * 60, // 30 minutes in seconds
      };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error preparing download:`, error);
      throw new BadRequestException(`Failed to prepare download: ${error.message}`);
    }
  }

  /**
   * Complete download with signature from wallet
   * Step 2: Client signs the message and sends signature to download file
   */
  async downloadWithSignature(
    sessionId: string,
    signature: string,
  ): Promise<{ decryptedData: Buffer; filename: string; extension: string; mimeType: string }> {
    try {
      if (!this.downloadSessions) {
        throw new BadRequestException('Invalid or expired session');
      }

      const session = this.downloadSessions.get(sessionId);
      if (!session) {
        throw new BadRequestException('Invalid or expired session');
      }

      // Check if session expired
      if (new Date() > session.expiresAt) {
        this.downloadSessions.delete(sessionId);
        throw new BadRequestException('Session expired. Please prepare download again.');
      }

      // Check for empty signature
      if (!signature || typeof signature !== 'string' || signature.trim() === '') {
        throw new BadRequestException(
          'Signature is required. Please sign the message with your wallet.',
        );
      }

      const { recordId, fileIndex, requesterAddress, exportedSessionKey, message } = session;
      // Get record info
      const recordInfo = await this.getRecord(recordId, requesterAddress);
      const record = recordInfo.record;

      // Attach signature to SessionKey
      const sessionKey = await this.sealService.getSessionKey(exportedSessionKey);
      await (sessionKey as any).setPersonalMessageSignature(signature);
      // Download encrypted data from Walrus
      const walrusCid = record.walrusCids[fileIndex];

      // Check if blob exists first
      const blobExists = await this.walrusService.blobExists(walrusCid);
      if (!blobExists) {
        throw new BadRequestException(
          `File not found on Walrus. The file may have expired (Walrus files expire after ${this.configService.get('WALRUS_EPOCHS', 5)} epochs). Please re-upload the record.`,
        );
      }

      const encryptedData = await this.walrusService.downloadBlob(walrusCid);
      // Decrypt with Seal
      const moduleName = 'seal_whitelist';
      const approveFunction = 'seal_approve_read';

      const decryptedData = await this.sealService.decryptData(
        encryptedData,
        this.packageId,
        moduleName,
        approveFunction,
        record.whitelistId,
        sessionKey,
      );

      // Clean up session after successful download
      this.downloadSessions.delete(sessionId);
      // Get original filename from doc type
      const docTypeNames = ['lab', 'imaging', 'notes', 'prescription', 'other'];
      const docType = record.docTypes[fileIndex] || 4;
      const docTypeName = docTypeNames[docType] || 'unknown';
      let mimeType = 'application/octet-stream';
      let extension = '';
      if (docTypeName === 'lab' || docTypeName === 'notes' || docTypeName === 'prescription') {
        mimeType = 'text/plain';
        extension = '.txt';
      } else if (docTypeName === 'imaging') {
        mimeType = 'image/png';
        extension = '.png';
      }

      this.logger.log(`File downloaded successfully for session: ${sessionId}`);

      return {
        decryptedData,
        filename: `record_${recordId}`,
        extension,
        mimeType,
      };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error downloading with signature:`, error);
      throw new BadRequestException(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Clean up expired download sessions
   */
  private cleanupExpiredSessions() {
    if (!this.downloadSessions) return;

    const now = new Date();
    for (const [sessionId, session] of this.downloadSessions.entries()) {
      if (now > session.expiresAt) {
        this.downloadSessions.delete(sessionId);
      }
    }
  }

  /**
   * Download and decrypt a record file with SessionKey
   * Creates SessionKey from signature, downloads from Walrus, and decrypts
   * If privateKey is provided, generates signature automatically
   */
  async downloadRecordFileWithSessionKey(
    recordId: string,
    downloadDto: DownloadRecordFileDto,
  ): Promise<{ decryptedData: Buffer; filename: string }> {
    try {
      const { requesterAddress, fileIndex, signature, privateKey } = downloadDto;
      // Validate that either signature or privateKey is provided
      if (!privateKey) {
        throw new BadRequestException('Either signature or privateKey must be provided');
      }

      // Get record and check permissions
      const recordInfo = await this.getRecord(recordId, requesterAddress);
      const record = recordInfo.record;

      // if (!record.accessControl.canRead) {
      //   throw new ForbiddenException(
      //     'You do not have permission to download files from this record',
      //   );
      // }

      if (fileIndex >= record.walrusCids.length) {
        throw new BadRequestException('Invalid file index');
      }

      // Create SessionKey - uses Medical Vault package ID for PTB approval
      const { sessionKey, message } = await this.sealService.createSessionKey(
        requesterAddress,
        this.packageId, // Medical Vault package ID for the approve function
        30, // 30 minutes TTL
      );

      let actualSignature: string;

      // Generate signature from private key if provided
      if (privateKey) {
        const keypair = this.parsePrivateKey(privateKey);

        // For Sui personal message signatures, we need to sign the message directly
        // The Seal SDK already provides the correct message format
        const signResult = await keypair.signPersonalMessage(message);

        // The signPersonalMessage returns {bytes, signature}
        // We need the signature which is already in the correct Sui format
        actualSignature = signResult.signature;
      } else {
        actualSignature = signature;
      }

      // Attach signature to SessionKey using the proper SDK method
      // This must be done before calling decrypt
      await (sessionKey as any).setPersonalMessageSignature(actualSignature);

      // Download encrypted data from Walrus
      const walrusCid = record.walrusCids[fileIndex];

      // Check if blob exists first
      const blobExists = await this.walrusService.blobExists(walrusCid);
      if (!blobExists) {
        throw new BadRequestException(
          `File not found on Walrus. The file may have expired (Walrus files expire after ${this.configService.get('WALRUS_EPOCHS', 5)} epochs). Please re-upload the record.`,
        );
      }

      const encryptedData = await this.walrusService.downloadBlob(walrusCid);

      // Decrypt with Seal - uses Medical Vault package ID for the PTB
      const moduleName = 'seal_whitelist'; // Your contract module name
      const approveFunction = 'seal_approve_read'; // Function for read access

      const decryptedData = await this.sealService.decryptData(
        encryptedData,
        this.packageId, // Medical Vault package ID
        moduleName,
        approveFunction,
        record.whitelistId,
        sessionKey,
      );

      // Get original filename from doc type
      const docTypeNames = ['lab', 'imaging', 'notes', 'prescription', 'other'];
      const docType = record.docTypes[fileIndex] || 4;
      const docTypeName = docTypeNames[docType] || 'unknown';

      return {
        decryptedData,
        filename: `record_${recordId}_${docTypeName}_${fileIndex}.bin`,
      };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error downloading and decrypting file:`, error);
      throw new BadRequestException(`Failed to download and decrypt file: ${error.message}`);
    }
  }

  /**
   * View file content after decrypt (text/image/pdf)
   * Return buffer and mime type for frontend preview
   */
  async viewRecordInline(
    sessionId: string,
    signature: string,
  ): Promise<{ decryptedData: Buffer; filename: string; mimeType: string }> {
    try {
      if (!this.downloadSessions) {
        throw new BadRequestException('Invalid or expired session');
      }
      const session = this.downloadSessions.get(sessionId);
      if (!session) {
        throw new BadRequestException('Invalid or expired session');
      }
      if (new Date() > session.expiresAt) {
        this.downloadSessions.delete(sessionId);
        throw new BadRequestException('Session expired. Please prepare download again.');
      }
      if (!signature || typeof signature !== 'string' || signature.trim() === '') {
        throw new BadRequestException(
          'Signature is required. Please sign the message with your wallet.',
        );
      }
      const { recordId, fileIndex, requesterAddress, exportedSessionKey, message } = session;
      // Get record info
      const recordInfo = await this.getRecord(recordId, requesterAddress);
      const record = recordInfo.record;
      // Attach signature to SessionKey
      const sessionKey = await this.sealService.getSessionKey(exportedSessionKey);
      await (sessionKey as any).setPersonalMessageSignature(signature);
      // Download encrypted data from Walrus
      const walrusCid = record.walrusCids[fileIndex];
      const blobExists = await this.walrusService.blobExists(walrusCid);
      if (!blobExists) {
        throw new BadRequestException(
          `File not found on Walrus. The file may have expired (Walrus files expire after ${this.configService.get('WALRUS_EPOCHS', 5)} epochs). Please re-upload the record.`,
        );
      }
      const encryptedData = await this.walrusService.downloadBlob(walrusCid);
      // Decrypt with Seal
      const moduleName = 'seal_whitelist';
      const approveFunction = 'seal_approve_read';
      const decryptedData = await this.sealService.decryptData(
        encryptedData,
        this.packageId,
        moduleName,
        approveFunction,
        record.whitelistId,
        sessionKey,
      );
      // Không xóa session để cho phép xem lại nhiều lần (hoặc có thể xóa nếu muốn)
      // this.downloadSessions.delete(sessionId);
      // Đoán loại file
      let mimeType = 'application/octet-stream';
      const docTypeNames = ['lab', 'imaging', 'notes', 'prescription', 'other'];
      const docType = record.docTypes[fileIndex] || 4;
      const docTypeName = docTypeNames[docType] || 'unknown';
      if (docTypeName === 'lab' || docTypeName === 'notes' || docTypeName === 'prescription') {
        mimeType = 'text/plain';
      } else if (docTypeName === 'imaging') {
        mimeType = 'image/png';
      }
      // Có thể mở rộng đoán mimeType từ filename hoặc magic bytes nếu cần
      console.log('Determined mimeType:', mimeType);
      return {
        decryptedData,
        filename: `record_${recordId}_${docTypeName}_${fileIndex}`,
        mimeType,
      };
    } catch (error) {
      this.logger.error('Error viewing file inline:', error);
      throw new BadRequestException(`Failed to view file inline: ${error.message}`);
    }
  }
}
