import { SuiClient } from '@mysten/sui/client';
import { decodeSuiPrivateKey, Signer } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SuiService {
  private readonly logger = new Logger(SuiService.name);
  private client: SuiClient;
  private keypair: Ed25519Keypair;
  private packageId: string;
  private whitelistRegistryId: string;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('SUI_RPC_URL');
    this.client = new SuiClient({ url: rpcUrl });
    this.packageId = this.configService.get<string>('MEDICAL_VAULT_PACKAGE_ID');
    this.whitelistRegistryId = this.configService.get<string>('WHITELIST_REGISTRY_ID');
    const privateKey = this.configService.get<string>('HOSPITAL_PRIVATE_KEY');
    if (privateKey) {
      try {
        if (privateKey.startsWith('suiprivkey')) {
          const decoded = decodeSuiPrivateKey(privateKey);
          this.keypair = Ed25519Keypair.fromSecretKey(decoded.secretKey);
        } else {
          const keyBytes = Buffer.from(privateKey, 'base64');
          if (keyBytes.length !== 32) {
            throw new Error(`Invalid secret key length: expected 32 bytes, got ${keyBytes.length}`);
          }
          this.keypair = Ed25519Keypair.fromSecretKey(keyBytes);
        }
      } catch (error) {
        this.logger.error('Failed to initialize admin keypair:', error.message);
        throw error;
      }
    }
  }

  getClient(): SuiClient {
    return this.client;
  }

  getPackageId(): string {
    return this.packageId;
  }

  getAddress(): string {
    return this.keypair.toSuiAddress();
  }

  getRegistryId(): string {
    return this.configService.get<string>('WHITELIST_REGISTRY_ID');
  }

  /**
   * Set whitelist ID for a whitelist (links Seal whitelist to on-chain whitelist)
   */

  /**
   * Create a new whitelist and execute with server-side signing (for testing)
   * WARNING: Only use in development/testing environments
   * @param signerAddress - Doctor/creator address (must match private key if doctor creates)
   * @param ownerAddress - Patient/owner address (who will own the whitelist)
   * @param label - whitelist label
   * @param whitelistType - 0 = personal, 1 = family
   * @param userPrivateKey - Optional private key (if not provided, uses HOSPITAL_PRIVATE_KEY from env)
   */
  async createwhitelistAndExecute(
    signerAddress: string,
    ownerAddress: string,
    label: string,
    whitelistType: number = 0,
    userPrivateKey?: string,
    clockId: string = '0x6',
  ) {
    // Determine which keypair to use
    let signer: Signer = this.keypair;
    try {
      // Step 1: Create whitelist
      const tx = new Transaction();
      tx.setSender(signerAddress);

      // Convert label to bytes
      const labelBytes = Array.from(Buffer.from(label, 'utf-8'));

      tx.moveCall({
        target: `${this.packageId}::seal_whitelist::create_whitelist`,
        arguments: [
          tx.pure('address', ownerAddress),
          tx.pure('vector<u8>', labelBytes),
          tx.pure('u8', whitelistType),
          tx.object(clockId),
        ],
      });

      // Execute with signing keypair
      const result = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: signer,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });

      this.logger.log(`whitelist created and executed: ${result.digest}`);
      this.logger.log(`Doctor: ${signerAddress} → Created whitelist for patient: ${ownerAddress}`);

      // Extract created whitelist ID and whitelistOwnerCap
      let whitelistId = null;
      let whitelistCapId = null;

      if (result.objectChanges) {
        const createdwhitelist = result.objectChanges.find(
          (change: any) =>
            change.type === 'created' &&
            change.objectType?.includes('::seal_whitelist::seal_whitelist') &&
            !change.objectType?.includes('::seal_whitelist::seal_whitelistOwnerCap'),
        );
        if (createdwhitelist) {
          whitelistId = (createdwhitelist as any).objectId;
        }

        const createdCap = result.objectChanges.find(
          (change: any) =>
            change.type === 'created' &&
            change.objectType?.includes('::seal_whitelist::seal_whitelistOwnerCap'),
        );
        if (createdCap) {
          whitelistCapId = (createdCap as any).objectId;
        }
      }

      return {
        success: true,
        digest: result.digest,
        whitelistId,
        whitelistCapId,
        owner: ownerAddress,
        creator: signerAddress,
        objectChanges: result.objectChanges,
        events: result.events,
        effects: result.effects,
      };
    } catch (error) {
      this.logger.error('Failed to create and execute whitelist:', error);
      throw error;
    }
  }

  /**
   * Add doctor to whitelist
   */
  async addDoctorWithWhitelist(
    ownerAddress: string,
    whitelistId: string,
    whitelistCapId: string,
    doctorAddress: string,
    clockId: string = '0x6',
  ) {
    const tx = new Transaction();
    tx.setSender(ownerAddress);
    const whitelistObj = tx.object(whitelistId);
    tx.moveCall({
      target: `${this.packageId}::seal_whitelist::add_doctor`,
      arguments: [
        tx.object(whitelistId),
        tx.object(whitelistCapId),
        tx.pure('address', doctorAddress),
        tx.object(clockId),
      ],
    });

    const txBytes = await tx.build({ client: this.client });

    return {
      transactionBytes: Buffer.from(txBytes).toString('base64'),
      transaction: tx,
    };
  }

  /**
   * Remove doctor from whitelist
   */
  async removeDoctorWithWhitelist(
    ownerAddress: string,
    whitelistId: string,
    whitelistCapId: string,
    doctorAddress: string,
    clockId: string = '0x6',
  ) {
    const tx = new Transaction();
    tx.setSender(ownerAddress);

    tx.moveCall({
      target: `${this.packageId}::seal_whitelist::remove_doctor`,
      arguments: [
        tx.object(whitelistId),
        tx.object(whitelistCapId),
        tx.pure('address', doctorAddress),
        tx.object(clockId),
      ],
    });

    const txBytes = await tx.build({ client: this.client });

    return {
      transactionBytes: Buffer.from(txBytes).toString('base64'),
      transaction: tx,
    };
  }

  /**
   * Add member to whitelist
   */
  async addMemberWithWhitelist(
    ownerAddress: string,
    whitelistId: string,
    whitelistCapId: string,
    memberAddress: string,
    clockId: string = '0x6',
  ) {
    const tx = new Transaction();
    tx.setSender(ownerAddress);

    tx.moveCall({
      target: `${this.packageId}::seal_whitelist::add_member`,
      arguments: [
        tx.object(whitelistId),
        tx.object(whitelistCapId),
        tx.pure('address', memberAddress),
        tx.object(clockId),
      ],
    });

    const txBytes = await tx.build({ client: this.client });

    return {
      transactionBytes: Buffer.from(txBytes).toString('base64'),
      transaction: tx,
    };
  }

  /**
   * Remove member from whitelist
   */
  async removeMemberWithWhitelist(
    ownerAddress: string,
    whitelistId: string,
    whitelistCapId: string,
    memberAddress: string,
    clockId: string = '0x6',
  ) {
    const tx = new Transaction();
    tx.setSender(ownerAddress);

    tx.moveCall({
      target: `${this.packageId}::seal_whitelist::remove_member`,
      arguments: [
        tx.object(whitelistId),
        tx.object(whitelistCapId),
        tx.pure('address', memberAddress),
        tx.object(clockId),
      ],
    });

    const txBytes = await tx.build({ client: this.client });

    return {
      transactionBytes: Buffer.from(txBytes).toString('base64'),
      transaction: tx,
    };
  }

  /**
   * Register a medical record on-chain (build transaction for wallet signing)
   */
  async registerRecord(
    signerAddress: string,
    whitelistId: string,
    adminCapId: string | null,
    recordId: string,
    walrusCids: string[],
    sealedKeyRefs: string[],
    docTypes: number[],
    clockId: string = '0x6',
  ) {
    const tx = new Transaction();
    tx.setSender(signerAddress);

    const walrusCidsBytes = walrusCids.map((cid) => Array.from(Buffer.from(cid, 'utf-8')));
    const sealedKeyRefsBytes = sealedKeyRefs.map((ref) => Array.from(Buffer.from(ref, 'utf-8')));

    // Use create_record_by_doctor if no adminCapId (doctor uploading)
    // Use create_record if adminCapId provided (owner uploading)
    if (adminCapId) {
      tx.moveCall({
        target: `${this.packageId}::medical_record::create_record`,
        arguments: [
          tx.object(whitelistId),
          tx.object(adminCapId),
          tx.pure('vector<u8>', Array.from(Buffer.from(recordId, 'utf-8'))),
          tx.pure('vector<vector<u8>>', walrusCidsBytes),
          tx.pure('vector<vector<u8>>', sealedKeyRefsBytes),
          tx.pure('vector<u8>', docTypes),
          tx.object(clockId),
        ],
      });
    } else {
      console.log('Doctor creating record without admin cap');
      // Doctor creating record without admin cap
      tx.moveCall({
        target: `${this.packageId}::medical_record::create_record_by_doctor`,
        arguments: [
          tx.object(whitelistId),
          tx.pure('vector<u8>', Array.from(Buffer.from(recordId, 'utf-8'))),
          tx.pure('vector<vector<u8>>', walrusCidsBytes),
          tx.pure('vector<vector<u8>>', sealedKeyRefsBytes),
          tx.pure('vector<u8>', docTypes),
          tx.object(clockId),
        ],
      });
    }

    const txBytes = await tx.build({ client: this.client });

    return {
      transactionBytes: Array.from(txBytes),
      transaction: tx,
      sender: signerAddress,
    };
  }

  /**
   * Upload record and execute on-chain
   * Registers medical record with Walrus CIDs on the blockchain
   */
  async uploadRecordAndExecute(
    signerAddress: string,
    whitelistId: string,
    adminCapId: string | null,
    recordId: string,
    walrusCids: string[],
    sealedKeyRefs: string[],
    docTypes: number[],
    privateKey?: string,
    clockId: string = '0x6',
  ): Promise<{ success: boolean; digest: string; recordId: string }> {
    try {
      this.logger.log(`Uploading record ${recordId} to blockchain...`);

      const tx = new Transaction();

      const walrusCidsBytes = walrusCids.map((cid) => Array.from(Buffer.from(cid, 'utf-8')));
      const sealedKeyRefsBytes = sealedKeyRefs.map((ref) => Array.from(Buffer.from(ref, 'utf-8')));

      // Use create_record_by_doctor if no adminCapId (doctor uploading)
      // Use create_record if adminCapId provided (owner uploading)
      if (adminCapId) {
        tx.moveCall({
          target: `${this.packageId}::medical_record::create_record`,
          arguments: [
            tx.object(whitelistId),
            tx.object(adminCapId),
            tx.pure('vector<u8>', Array.from(Buffer.from(recordId, 'utf-8'))),
            tx.pure('vector<vector<u8>>', walrusCidsBytes),
            tx.pure('vector<vector<u8>>', sealedKeyRefsBytes),
            tx.pure('vector<u8>', docTypes),
            tx.object(clockId),
          ],
        });
      } else {
        // Doctor creating record without admin cap
        tx.moveCall({
          target: `${this.packageId}::medical_record::create_record_by_doctor`,
          arguments: [
            tx.object(whitelistId),
            tx.pure('vector<u8>', Array.from(Buffer.from(recordId, 'utf-8'))),
            tx.pure('vector<vector<u8>>', walrusCidsBytes),
            tx.pure('vector<vector<u8>>', sealedKeyRefsBytes),
            tx.pure('vector<u8>', docTypes),
            tx.object(clockId),
          ],
        });
      }

      // Execute transaction
      const keypair = privateKey ? this.parsePrivateKey(privateKey) : this.keypair;

      if (!keypair) {
        throw new Error(
          'No private key available for signing. Either provide privateKey parameter or set HOSPITAL_PRIVATE_KEY in environment variables.',
        );
      }

      const result = await this.client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      // Extract the created Record object ID from object changes
      let createdRecordObjectId = recordId; // fallback to UUID if not found
      if (result.objectChanges) {
        const createdRecord = result.objectChanges.find(
          (change: any) =>
            change.type === 'created' && change.objectType?.includes('::medical_record::Record'),
        );
        if (createdRecord && (createdRecord as any).objectId) {
          createdRecordObjectId = (createdRecord as any).objectId;
          this.logger.log(`Record object created with ID: ${createdRecordObjectId}`);
        }
      }

      this.logger.log(`Record uploaded successfully: ${result.digest}`);

      return {
        success: true,
        digest: result.digest,
        recordId: createdRecordObjectId,
      };
    } catch (error) {
      this.logger.error(`Error uploading record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Request export initiation
   */
  async requestExport(
    signerAddress: string,
    whitelistId: string,
    recordIds: string[],
    clockId: string = '0x6',
  ) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::export::request_export`,
      arguments: [tx.object(whitelistId), tx.pure('vector<string>', recordIds), tx.object(clockId)],
    });

    return {
      transaction: tx,
      sender: signerAddress,
    };
  }

  /**
   * Get whitelist details
   */
  async getWhitelist(whitelistId: string) {
    try {
      const object = await this.client.getObject({
        id: whitelistId,
        options: { showContent: true, showOwner: true },
      });

      return object.data;
    } catch (error) {
      this.logger.error(`Error fetching whitelist ${whitelistId}:`, error);
      throw error;
    }
  }

  /**
   * Get medical record details
   */
  async getRecord(recordId: string) {
    try {
      const object = await this.client.getObject({
        id: recordId,
        options: { showContent: true, showOwner: true },
      });

      return object.data;
    } catch (error) {
      this.logger.error(`Error fetching record ${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Create whitelist on-chain and execute
   */
  async createWhitelistAndExecute(
    ownerAddress: string,
    name: string,
    patientAddress: string,
    privateKey?: string,
    clockId: string = '0x6',
  ) {
    const keypair = privateKey ? this.parsePrivateKey(privateKey) : this.keypair;
    if (!keypair) {
      throw new Error('No private key available for signing');
    }

    try {
      const tx = new Transaction();
      tx.setSender(ownerAddress);

      const nameBytes = Array.from(Buffer.from(name, 'utf-8'));

      tx.moveCall({
        target: `${this.packageId}::seal_whitelist::create_whitelist`,
        arguments: [
          tx.object(this.whitelistRegistryId),
          tx.pure('vector<u8>', nameBytes),
          tx.pure('address', patientAddress),
          tx.object(clockId),
        ],
      });

      const result = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });

      let whitelistId = null;
      let whitelistCapId = null;

      if (result.objectChanges) {
        const createdWhitelist = result.objectChanges.find(
          (change: any) =>
            change.type === 'created' &&
            change.objectType?.includes('::seal_whitelist::SealWhitelist'),
        );
        if (createdWhitelist) {
          whitelistId = (createdWhitelist as any).objectId;
        }

        const createdCap = result.objectChanges.find(
          (change: any) =>
            change.type === 'created' &&
            change.objectType?.includes('::seal_whitelist::WhitelistAdminCap'),
        );
        if (createdCap) {
          whitelistCapId = (createdCap as any).objectId;
        }
      }

      return {
        success: true,
        digest: result.digest,
        whitelistId,
        whitelistCapId,
        objectChanges: result.objectChanges,
      };
    } catch (error) {
      this.logger.error('Failed to create whitelist:', error);
      throw error;
    }
  }

  /**
   * Add doctor to whitelist and execute
   */
  async addDoctorToWhitelistAndExecute(
    whitelistId: string,
    whitelistCapId: string,
    doctorAddress: string,
    ownerAddress: string,
    privateKey?: string,
    clockId: string = '0x6',
  ) {
    const keypair = privateKey ? this.parsePrivateKey(privateKey) : this.keypair;
    if (!keypair) {
      throw new Error('No private key available for signing');
    }

    try {
      const tx = new Transaction();
      tx.setSender(ownerAddress);

      tx.moveCall({
        target: `${this.packageId}::seal_whitelist::add_doctor`,
        arguments: [
          tx.object(whitelistId),
          tx.object(whitelistCapId),
          tx.pure('address', doctorAddress),
          tx.object(clockId),
        ],
      });

      const result = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      return {
        success: true,
        digest: result.digest,
      };
    } catch (error) {
      this.logger.error('Failed to add doctor to whitelist:', error);
      throw error;
    }
  }

  /**
   * Remove doctor from whitelist and execute
   */
  async removeDoctorFromWhitelistAndExecute(
    whitelistId: string,
    whitelistCapId: string,
    doctorAddress: string,
    ownerAddress: string,
    privateKey?: string,
    clockId: string = '0x6',
  ) {
    const keypair = privateKey ? this.parsePrivateKey(privateKey) : this.keypair;
    if (!keypair) {
      throw new Error('No private key available for signing');
    }

    try {
      const tx = new Transaction();
      tx.setSender(ownerAddress);

      tx.moveCall({
        target: `${this.packageId}::seal_whitelist::remove_doctor`,
        arguments: [
          tx.object(whitelistId),
          tx.object(whitelistCapId),
          tx.pure('address', doctorAddress),
          tx.object(clockId),
        ],
      });

      const result = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      return {
        success: true,
        digest: result.digest,
      };
    } catch (error) {
      this.logger.error('Failed to remove doctor from whitelist:', error);
      throw error;
    }
  }

  /**
   * Add member to whitelist and execute
   */
  async addMemberToWhitelistAndExecute(
    whitelistId: string,
    whitelistCapId: string,
    memberAddress: string,
    ownerAddress: string,
    privateKey?: string,
    clockId: string = '0x6',
  ) {
    const keypair = privateKey ? this.parsePrivateKey(privateKey) : this.keypair;
    if (!keypair) {
      throw new Error('No private key available for signing');
    }

    try {
      const tx = new Transaction();
      tx.setSender(ownerAddress);

      tx.moveCall({
        target: `${this.packageId}::seal_whitelist::add_member`,
        arguments: [
          tx.object(whitelistId),
          tx.object(whitelistCapId),
          tx.pure('address', memberAddress),
          tx.object(clockId),
        ],
      });

      const result = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      return {
        success: true,
        digest: result.digest,
      };
    } catch (error) {
      this.logger.error('Failed to add member to whitelist:', error);
      throw error;
    }
  }

  /**
   * Remove member from whitelist and execute
   */
  async removeMemberFromWhitelistAndExecute(
    whitelistId: string,
    whitelistCapId: string,
    memberAddress: string,
    ownerAddress: string,
    privateKey?: string,
    clockId: string = '0x6',
  ) {
    const keypair = privateKey ? this.parsePrivateKey(privateKey) : this.keypair;
    if (!keypair) {
      throw new Error('No private key available for signing');
    }

    try {
      const tx = new Transaction();
      tx.setSender(ownerAddress);

      tx.moveCall({
        target: `${this.packageId}::seal_whitelist::remove_member`,
        arguments: [
          tx.object(whitelistId),
          tx.object(whitelistCapId),
          tx.pure('address', memberAddress),
          tx.object(clockId),
        ],
      });

      const result = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      return {
        success: true,
        digest: result.digest,
      };
    } catch (error) {
      this.logger.error('Failed to remove member from whitelist:', error);
      throw error;
    }
  }

  /**
   * Helper to parse private key
   */
  private parsePrivateKey(privateKey: string): Ed25519Keypair {
    try {
      if (privateKey.startsWith('suiprivkey')) {
        const decoded = decodeSuiPrivateKey(privateKey);
        return Ed25519Keypair.fromSecretKey(decoded.secretKey);
      } else {
        const keyBytes = Buffer.from(privateKey, 'base64');
        if (keyBytes.length !== 32) {
          throw new Error(`Invalid secret key length: expected 32 bytes, got ${keyBytes.length}`);
        }
        return Ed25519Keypair.fromSecretKey(keyBytes);
      }
    } catch (error) {
      throw new Error(`Failed to parse private key: ${error.message}`);
    }
  }

  /**
   * Execute a transaction block (server-side signing)
   */
  async executeTransaction(txBlock: Transaction, signer: Ed25519Keypair) {
    try {
      const result = await this.client.signAndExecuteTransaction({
        transaction: txBlock,
        signer,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });

      this.logger.log(`Transaction executed: ${result.digest}`);
      return result;
    } catch (error) {
      this.logger.error('Transaction execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute a user-signed transaction
   * Takes transaction bytes and signature from client
   */
  async executeUserSignedTransaction(transactionBytes: string, signature: string) {
    try {
      const result = await this.client.executeTransactionBlock({
        transactionBlock: transactionBytes,
        signature,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });

      this.logger.log(`User-signed transaction executed: ${result.digest}`);
      return result;
    } catch (error) {
      this.logger.error('User-signed transaction execution failed:', error);
      throw error;
    }
  }

  /**
   * Get all whitelist IDs that a user has access to from the registry
   * NOTE: With nested Table structure, we need to query DynamicField objects
   * This method queries the user's nested table (ID -> bool mapping)
   */
  async getUserAccessibleWhitelists(userAddress: string): Promise<string[]> {
    try {
      const registryId = this.getRegistryId();
      if (!registryId) {
        this.logger.warn('WHITELIST_REGISTRY_ID not configured');
        return [];
      }

      this.logger.log(`Querying registry: ${registryId} for user: ${userAddress}`);

      // Step 1: Get WhitelistRegistry object to extract outer Table ID
      const registryObject = await this.client.getObject({
        id: registryId,
        options: { showContent: true },
      });

      if (
        !registryObject.data ||
        !registryObject.data.content ||
        !('fields' in registryObject.data.content)
      ) {
        this.logger.warn('Registry object not found or has no fields');
        return [];
      }

      const registryFields = registryObject.data.content.fields as any;
      const outerTableId = registryFields.user_whitelists?.fields?.id?.id;

      if (!outerTableId) {
        this.logger.warn('Outer table ID not found in registry');
        return [];
      }

      // this.logger.log(`Outer table ID: ${outerTableId}`);

      // Step 2: Query outer Table dynamic fields
      const outerFields = await this.client.getDynamicFields({
        parentId: outerTableId,
      });

      // this.logger.log(`Outer fields count: ${outerFields.data.length}`);
      // this.logger.log(
      //   `Outer field names: ${JSON.stringify(outerFields.data.map((f) => f.name?.value))}`
      // );

      // Step 3: Find user's field in outer table
      const userField = outerFields.data.find((field) => field.name?.value === userAddress);

      if (!userField || !userField.objectId) {
        this.logger.log(`User field not found for ${userAddress}`);
        return []; // User has no whitelists
      }

      // this.logger.log(`User field objectId: ${userField.objectId}`);

      // Step 4: Get user field object to extract inner table ID
      const userFieldObject = await this.client.getObject({
        id: userField.objectId,
        options: { showContent: true },
      });

      if (
        !userFieldObject.data ||
        !userFieldObject.data.content ||
        !('fields' in userFieldObject.data.content)
      ) {
        return [];
      }

      // Step 5: Extract inner table ID from value.fields.id.id
      const fields = userFieldObject.data.content.fields as any;
      const innerTableId = fields.value?.fields?.id?.id;

      if (!innerTableId) {
        return [];
      }

      // Step 6: Query inner Table<ID, bool> dynamic fields
      const innerTableFields = await this.client.getDynamicFields({
        parentId: innerTableId,
      });

      // Step 7: Extract whitelist IDs from keys
      const whitelistIds = innerTableFields.data
        .map((field) => field.name?.value as string)
        .filter((id) => id);

      return whitelistIds;
    } catch (error) {
      this.logger.error('Failed to get user accessible whitelists:', error);
      return [];
    }
  }

  /**
   * Check if a user has access to a specific whitelist (O(1) lookup)
   * Uses the new nested Table structure for efficient access checking
   */
  async checkWhitelistAccess(userAddress: string, whitelistId: string): Promise<boolean> {
    try {
      const registryId = this.getRegistryId();
      if (!registryId) {
        this.logger.warn('WHITELIST_REGISTRY_ID not configured');
        return false;
      }

      // Use devInspect to call user_has_whitelist_access
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::seal_whitelist::user_has_whitelist_access`,
        arguments: [
          tx.object(registryId),
          tx.pure('address', userAddress),
          tx.pure('address', whitelistId),
        ],
      });

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: userAddress,
      });

      // Parse the return value
      if (result.results && result.results[0]?.returnValues) {
        const returnData = result.results[0].returnValues[0];
        if (returnData && returnData[0]) {
          // Decode boolean result
          return returnData[0][0] === 1;
        }
      }

      return false;
    } catch (error) {
      this.logger.error('Failed to check whitelist access:', error);
      return false;
    }
  }

  /**
   * Get detailed whitelist information from on-chain
   */
  async getWhitelistDetails(whitelistId: string) {
    try {
      const whitelist = await this.client.getObject({
        id: whitelistId,
        options: {
          showContent: true,
          showOwner: true,
        },
      });

      if (!whitelist.data || !whitelist.data.content || !('fields' in whitelist.data.content)) {
        throw new Error('Invalid whitelist object');
      }

      const fields = whitelist.data.content.fields as any;

      return {
        whitelistId,
        name: fields.name,
        owner: fields.owner,
        patient: fields.patient,
        doctors: fields.doctors || [],
        members: fields.members || [],
        records: fields.records || [],
        createdAt: fields.created_at,
      };
    } catch (error) {
      this.logger.error(`Failed to get whitelist details for ${whitelistId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's role and access in a specific whitelist
   */
  async getUserWhitelistAccess(whitelistId: string, userAddress: string) {
    try {
      const whitelist = await this.getWhitelistDetails(whitelistId);

      let role: number;
      let roleName: string;
      let hasRead: boolean;
      let hasWrite: boolean;

      if (whitelist.owner === userAddress) {
        role = 0;
        roleName = 'owner';
        hasRead = true;
        hasWrite = true;
      } else if (whitelist.doctors.includes(userAddress)) {
        role = 1;
        roleName = 'doctor';
        hasRead = true;
        hasWrite = true;
      } else if (whitelist.members.includes(userAddress)) {
        role = 2;
        roleName = 'member';
        hasRead = true;
        hasWrite = false;
      } else if (whitelist.patient === userAddress) {
        role = 3;
        roleName = 'patient';
        hasRead = true;
        hasWrite = false;
      } else {
        role = 255;
        roleName = 'none';
        hasRead = false;
        hasWrite = false;
      }

      return {
        whitelistId,
        userAddress,
        role,
        roleName,
        hasRead,
        hasWrite,
        permissions: {
          canRead: hasRead,
          canWrite: hasWrite,
          canManage: role === 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get user whitelist access:', error);
      throw error;
    }
  }

  /**
   * Get WhitelistAdminCap ID for a specific whitelist owned by user
   * Only owner has the WhitelistAdminCap
   */
  async getWhitelistCapId(ownerAddress: string, whitelistId: string): Promise<string | null> {
    try {
      // Query owned objects of type WhitelistAdminCap
      const ownedObjects = await this.client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${this.packageId}::seal_whitelist::WhitelistAdminCap`,
        },
        options: {
          showContent: true,
        },
      });

      // Find the cap that matches the whitelist ID
      for (const obj of ownedObjects.data) {
        if (obj.data && obj.data.content && 'fields' in obj.data.content) {
          const fields = obj.data.content.fields as any;
          // Check if whitelist_id field matches
          if (fields.whitelist_id === whitelistId) {
            return obj.data.objectId;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get whitelist cap for ${whitelistId}:`, error);
      return null;
    }
  }
}
