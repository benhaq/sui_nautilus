import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SealService } from '../seal/seal.service';
import { SuiService } from '../sui/sui.service';
import {
  AddDoctorDto,
  AddMemberDto,
  CreateFolderDto,
  RemoveDoctorDto,
  RemoveMemberDto,
} from './dto/folder.dto';

@Injectable()
export class FoldersService {
  private readonly logger = new Logger(FoldersService.name);

  constructor(
    private suiService: SuiService,
    private sealService: SealService,
    private configService: ConfigService,
  ) {}

  /**
   * Create whitelist (primary container for medical records)
   */
  async createAndExecuteFolder(createFolderDto: CreateFolderDto) {
    try {
      const { owner, creator, label, privateKey } = createFolderDto;
      const creatorAddress = creator || this.configService.get<string>('HOSPITAL_ADDRESS') || owner;
      const isDoctorCreating = creatorAddress !== owner;
      const doctors = isDoctorCreating ? [creatorAddress] : [];
      const members: string[] = [];
      const whitelistResult = await this.sealService.createWhitelistOnChain(
        owner,
        label,
        owner, // patient is the owner
        doctors,
        members,
        privateKey,
      );

      return {
        success: true,
        message: isDoctorCreating
          ? `Doctor created whitelist for patient ${owner}`
          : 'Whitelist created and executed on-chain',
        digest: whitelistResult.digest,
        explorerUrl: `https://suiscan.xyz/testnet/tx/${whitelistResult.digest}`,
        whitelistId: whitelistResult.whitelistId,
        adminCapId: whitelistResult.adminCapId,
        owner: owner,
        creator: creatorAddress,
        whitelistDetails: {
          label,
          owner,
          creator: creatorAddress,
          isDoctorCreating,
          // Access control
          accessControl: {
            doctors: doctors, // Addresses that can add records & view (writers)
            members: members, // Addresses that can only view (readers)
            doctorsCount: doctors.length,
            membersCount: members.length,
            description: 'Doctors (owner + doctors) can add records & view. Members can only view.',
          },
        },
      };
    } catch (error) {
      this.logger.error('Error creating whitelist:', error);
      throw new BadRequestException(`Failed to create whitelist: ${error.message}`);
    }
  }

  /**
   * Add a doctor to a whitelist (WRITER access)
   * Returns transaction for client to sign
   */
  async addDoctor(whitelistId: string, addDoctorDto: AddDoctorDto) {
    try {
      const { doctor, ownerAddress, whitelistCapId } = addDoctorDto;
      const txData = await this.suiService.addDoctorWithWhitelist(
        ownerAddress,
        whitelistId,
        whitelistCapId,
        doctor,
      );

      return {
        success: true,
        message: 'Add doctor transaction prepared. Please sign and submit.',
        transactionBlockBytes: txData.transactionBytes,
        transaction: txData.transaction,
      };
    } catch (error) {
      this.logger.error('Error adding doctor:', error);
      throw new BadRequestException(`Failed to add doctor: ${error.message}`);
    }
  }

  /**
   * Add a doctor to a whitelist and execute on-chain (WRITER access)
   * Executes the transaction immediately with provided private key
   */
  async addDoctorAndExecute(whitelistId: string, addDoctorDto: AddDoctorDto) {
    try {
      const { doctor, ownerAddress, whitelistCapId, privateKey } = addDoctorDto;

      if (!privateKey) {
        throw new BadRequestException('Private key is required for execution');
      }

      const result = await this.sealService.addDoctorToWhitelist(
        whitelistId,
        whitelistCapId,
        doctor,
        ownerAddress,
        privateKey,
      );

      return {
        success: true,
        message: 'Doctor added successfully on-chain',
        digest: result.digest,
        explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
        whitelistId,
        doctor,
      };
    } catch (error) {
      this.logger.error('Error adding doctor:', error);
      throw new BadRequestException(`Failed to add doctor: ${error.message}`);
    }
  }

  /**
   * Add a member to a whitelist (READER access - can only view records)
   * Returns transaction for client to sign
   * Only whitelist owner can add members
   *
   * Access level: READ-ONLY (can only decrypt)
   * - Can view/decrypt existing records
   * - CANNOT upload/add new medical records
   * - Uses seal_approve_read for decryption operations
   */
  async addMember(whitelistId: string, addMemberDto: AddMemberDto) {
    try {
      const { member, ownerAddress, whitelistCapId } = addMemberDto;
      const txData = await this.suiService.addMemberWithWhitelist(
        ownerAddress,
        whitelistId,
        whitelistCapId,
        member,
      );
      return {
        success: true,
        message: 'Add member transaction prepared. Please sign and submit.',
        transactionBlockBytes: txData.transactionBytes,
        transaction: txData.transaction,
      };
    } catch (error) {
      this.logger.error('Error adding member:', error);
      throw new BadRequestException(`Failed to add member: ${error.message}`);
    }
  }

  /**
   * Add a member to a whitelist and execute on-chain (READER access - can only view records)
   * Executes the transaction immediately with provided private key
   * Only whitelist owner can add members
   *
   * Access level: READ-ONLY (can only decrypt)
   * - Can view/decrypt existing records
   * - CANNOT upload/add new medical records
   * - Uses seal_approve_read for decryption operations
   */
  async addMemberAndExecute(whitelistId: string, addMemberDto: AddMemberDto) {
    try {
      const { member, ownerAddress, whitelistCapId, privateKey } = addMemberDto;

      if (!privateKey) {
        throw new BadRequestException('Private key is required for execution');
      }

      const result = await this.sealService.addMemberToWhitelist(
        whitelistId,
        whitelistCapId,
        member,
        ownerAddress,
        privateKey,
      );

      return {
        success: true,
        message: 'Member added successfully on-chain',
        digest: result.digest,
        explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
        whitelistId,
        member,
      };
    } catch (error) {
      this.logger.error('Error adding member:', error);
      throw new BadRequestException(`Failed to add member: ${error.message}`);
    }
  }

  /**
   * Remove a doctor from a whitelist
   * Returns transaction for client to sign
   * Only whitelist owner can remove doctors
   *
   * This removes WRITE access (can no longer add records or view)
   */
  async removeDoctor(whitelistId: string, removeDoctorDto: RemoveDoctorDto) {
    try {
      const { doctor, ownerAddress, whitelistCapId } = removeDoctorDto;
      console.log('Removing doctor:', { doctor, ownerAddress, whitelistId, whitelistCapId });
      const txData = await this.suiService.removeDoctorWithWhitelist(
        ownerAddress,
        whitelistId,
        whitelistCapId,
        doctor,
      );
      return {
        success: true,
        message: 'Remove doctor transaction prepared. Please sign and submit.',
        transactionBlockBytes: txData.transactionBytes,
        transaction: txData.transaction,
      };
    } catch (error) {
      this.logger.error('Error removing doctor:', error);
      throw new BadRequestException(`Failed to remove doctor: ${error.message}`);
    }
  }

  /**
   * Remove a doctor from a whitelist and execute on-chain
   * Executes the transaction immediately with provided private key
   * Only whitelist owner can remove doctors
   *
   * This removes WRITE access (can no longer add records or view)
   */
  async removeDoctorAndExecute(whitelistId: string, removeDoctorDto: RemoveDoctorDto) {
    try {
      const { doctor, ownerAddress, whitelistCapId, privateKey } = removeDoctorDto;

      if (!privateKey) {
        throw new BadRequestException('Private key is required for execution');
      }

      const result = await this.sealService.removeDoctorFromWhitelist(
        whitelistId,
        whitelistCapId,
        doctor,
        ownerAddress,
        privateKey,
      );

      return {
        success: true,
        message: 'Doctor removed successfully from whitelist',
        digest: result.digest,
        explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
        whitelistId,
        doctor,
      };
    } catch (error) {
      this.logger.error('Error removing doctor:', error);
      throw new BadRequestException(`Failed to remove doctor: ${error.message}`);
    }
  }

  /**
   * Remove a member from a whitelist
   * Returns transaction for client to sign
   * Only whitelist owner can remove members
   *
   * This removes READ-ONLY access (can no longer view records)
   */
  async removeMember(whitelistId: string, removeMemberDto: RemoveMemberDto) {
    try {
      const { member, ownerAddress, whitelistCapId } = removeMemberDto;
      const txData = await this.suiService.removeMemberWithWhitelist(
        ownerAddress,
        whitelistId,
        whitelistCapId,
        member,
      );
      return {
        success: true,
        message: 'Remove member transaction prepared. Please sign and submit.',
        transactionBlockBytes: txData.transactionBytes,
        transaction: txData.transaction,
      };
    } catch (error) {
      this.logger.error('Error removing member:', error);
      throw new BadRequestException(`Failed to remove member: ${error.message}`);
    }
  }

  /**
   * Remove a member from a whitelist and execute on-chain
   * Executes the transaction immediately with provided private key
   * Only whitelist owner can remove members
   *
   * This removes READ-ONLY access (can no longer view records)
   */
  async removeMemberAndExecute(whitelistId: string, removeMemberDto: RemoveMemberDto) {
    try {
      const { member, ownerAddress, whitelistCapId, privateKey } = removeMemberDto;

      if (!privateKey) {
        throw new BadRequestException('Private key is required for execution');
      }

      const result = await this.sealService.removeMemberFromWhitelist(
        whitelistId,
        whitelistCapId,
        member,
        ownerAddress,
        privateKey,
      );

      return {
        success: true,
        message: 'Member removed successfully from whitelist',
        digest: result.digest,
        explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
        whitelistId,
        member,
      };
    } catch (error) {
      this.logger.error('Error removing member:', error);
      throw new BadRequestException(`Failed to remove member: ${error.message}`);
    }
  }

  /**
   * Get all whitelists with access details from on-chain registry
   * This uses the WhitelistRegistry to efficiently query accessible whitelists
   */
  async getUserWhitelistsFromChain(address: string) {
    try {
      // Get whitelist IDs from the registry
      const whitelistIds = await this.suiService.getUserAccessibleWhitelists(address);

      if (whitelistIds.length === 0) {
        return {
          success: true,
          count: 0,
          whitelists: [],
        };
      }

      // Get details for each whitelist
      const whitelistsWithAccess = await Promise.all(
        whitelistIds.map(async (whitelistId) => {
          try {
            const [whitelistDetails, accessInfo] = await Promise.all([
              this.suiService.getWhitelistDetails(whitelistId),
              this.suiService.getUserWhitelistAccess(whitelistId, address),
            ]);

            // Get whitelistCapId if user is owner
            let whitelistCapId = await this.suiService.getWhitelistCapId(address, whitelistId);

            return {
              whitelistId,
              whitelistCapId, // Add capId to response
              name: whitelistDetails.name,
              owner: whitelistDetails.owner,
              role: accessInfo.role,
              roleName: accessInfo.roleName,
              hasRead: accessInfo.hasRead,
              hasWrite: accessInfo.hasWrite,
              permissions: accessInfo.permissions,
              doctors: whitelistDetails.doctors,
              members: whitelistDetails.members,
              recordCount: whitelistDetails.records.length,
              createdAt: whitelistDetails.createdAt,
            };
          } catch (error) {
            this.logger.error(`Failed to get details for whitelist ${whitelistId}:`, error);
            return null;
          }
        }),
      );

      // Filter out any failed requests
      const validWhitelists = whitelistsWithAccess.filter((w) => w !== null);

      return {
        success: true,
        count: validWhitelists.length,
        whitelists: validWhitelists,
      };
    } catch (error) {
      this.logger.error('Error getting user whitelists from chain:', error);
      throw new BadRequestException(`Failed to get user whitelists from chain: ${error.message}`);
    }
  }

  /**
   * Get detailed access information for a user in a whitelist
   * Returns role, permissions (read/write/manage), and access details from on-chain data
   */
  async getUserWhitelistAccess(whitelistId: string, address: string) {
    try {
      // Get access details from on-chain
      const accessInfo = await this.suiService.getUserWhitelistAccess(whitelistId, address);

      return {
        success: true,
        whitelistId: accessInfo.whitelistId,
        address: accessInfo.userAddress,
        role: accessInfo.role,
        roleName: accessInfo.roleName,
        hasRead: accessInfo.hasRead,
        hasWrite: accessInfo.hasWrite,
        permissions: accessInfo.permissions,
        hasAccess: accessInfo.role !== 255,
      };
    } catch (error) {
      this.logger.error('Error getting user whitelist access:', error);
      throw new BadRequestException(`Failed to get user whitelist access: ${error.message}`);
    }
  }

  /**
   * Check if user has access to a specific whitelist (O(1) lookup)
   * Fast access check using nested Table structure without fetching full whitelist
   */
  async checkWhitelistAccess(whitelistId: string, address: string) {
    try {
      const hasAccess = await this.suiService.checkWhitelistAccess(address, whitelistId);

      return {
        success: true,
        whitelistId,
        address,
        hasAccess,
      };
    } catch (error) {
      this.logger.error('Error checking whitelist access:', error);
      throw new BadRequestException(`Failed to check whitelist access: ${error.message}`);
    }
  }
}
