import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { WalrusClient } from '@mysten/walrus';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface WalrusUploadResult {
  blobId: string;
  endEpoch: number;
  event?: {
    txDigest: string;
    eventSeq: string;
  };
}

@Injectable()
export class WalrusService {
  private readonly logger = new Logger(WalrusService.name);
  private walrusClient: WalrusClient;
  private epochs: number;
  private signer: Ed25519Keypair;

  constructor(private configService: ConfigService) {
    this.walrusClient = new WalrusClient({
      suiRpcUrl: this.configService.get<string>('SUI_RPC_URL') ||
        'https://fullnode.testnet.sui.io:443',
      network: 'testnet',
    });

    this.epochs = this.configService.get<number>('WALRUS_EPOCHS') || 5;

    // Initialize signer from environment (required for writeBlob)
    const privateKey = this.configService.get<string>('HOSPITAL_PRIVATE_KEY');
    if (!privateKey) {
      throw new Error('HOSPITAL_PRIVATE_KEY is required for Walrus operations');
    }
    this.signer = Ed25519Keypair.fromSecretKey(privateKey);
  }

  /**
   * Upload encrypted file to Walrus using SDK
   * @param buffer - File buffer (already encrypted client-side)
   * @param filename - Original filename
   * @returns Walrus blob ID
   */
  async uploadBlob(buffer: Buffer, filename: string): Promise<WalrusUploadResult> {
    try {
      // Convert Buffer to Uint8Array for Walrus SDK
      const uint8Array = new Uint8Array(buffer);

      // Use Walrus SDK to upload - writeBlob takes a single options object
      const result = await this.walrusClient.writeBlob({
        blob: uint8Array,
        epochs: this.epochs,
        signer: this.signer,
        deletable: false,
      });

      return {
        blobId: result.blobId,
        endEpoch: result.blobObject.storage.end_epoch,
        event: {
          txDigest: result.blobObject.id.id,
          eventSeq: "0",
        },
      };
    } catch (error) {
      this.logger.error(`Walrus SDK upload failed: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response: ${JSON.stringify(error.response)}`);
      }
      throw new Error(`Walrus upload failed: ${error.message}`);
    }
  }

  /**
   * Download blob from Walrus using SDK
   * @param blobId - Walrus blob ID
   * @returns File buffer
   */
  async downloadBlob(blobId: string): Promise<Buffer> {
    try {
      // Use Walrus SDK to download
      const blob = await this.walrusClient.readBlob({ blobId });

      return Buffer.from(blob);
    } catch (error) {
      this.logger.error(
        `Walrus download failed for blob ${blobId}: ${error.message}`
      );

      // Provide more specific error messages
      if (error.message.includes("No valid blob metadata")) {
        throw new Error(
          `Walrus blob not found (${blobId}). The file may have expired or never existed. ` +
            `Walrus testnet files expire after a few epochs.`
        );
      }

      throw new Error(`Walrus download failed: ${error.message}`);
    }
  }

  /**
   * Check if blob exists
   */
  async blobExists(blobId: string): Promise<boolean> {
    try {
      await this.walrusClient.readBlob({ blobId });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Encrypt file data using AES-256-GCM
   * This can be done client-side or server-side depending on your security model
   */
  encryptFile(buffer: Buffer, key: Buffer): {
    encrypted: Buffer;
    iv: Buffer;
    authTag: Buffer;
  } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return { encrypted, iv, authTag };
  }

  /**
   * Decrypt file data
   */
  decryptFile(
    encrypted: Buffer,
    key: Buffer,
    iv: Buffer,
    authTag: Buffer,
  ): Buffer {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Generate a random encryption key
   */
  generateKey(): Buffer {
    return crypto.randomBytes(32); // 256-bit key
  }
}
