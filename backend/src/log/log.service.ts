import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActionType, LogDocument, Logs, RecordDocument, Records } from '../schemas';
import { Whitelist, WhitelistDocument } from '../schemas/whitelist.schema';

export interface CreateLogDto {
  address: string;
  actionType: ActionType;
  whitelistId?: string;
  targetAddress?: string;
  recordId?: string;
  digest?: string;
  metadata?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);

  constructor(
    @InjectModel(Logs.name) private logModel: Model<LogDocument>,
    @InjectModel(Whitelist.name)
    private whitelistModel: Model<WhitelistDocument>,
    @InjectModel(Records.name) private recordModel: Model<RecordDocument>
  ) {}

  /**
   * Log an action to the database
   */
  async logAction(createLogDto: CreateLogDto): Promise<Logs> {
    try {
      const log = new this.logModel(createLogDto);
      return await log.save();
    } catch (error) {
      this.logger.error("Error logging action:", error);
      throw error;
    }
  }

  /**
   * Get all actions for a specific address
   */
  async getActionsByAddress(address: string): Promise<Logs[]> {
    return this.logModel.find({ address }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Get all actions for a specific whitelist
   */
  async getActionsByWhitelist(whitelistId: string): Promise<Logs[]> {
    return this.logModel
      .find({ whitelistId })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get actions by type
   */
  async getActionsByType(actionType: ActionType): Promise<Logs[]> {
    return this.logModel
      .find({ actionType })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get all actions with pagination
   */
  async getAllActions(
    page: number = 1,
    limit: number = 50
  ): Promise<{
    data: Logs[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.logModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.logModel.countDocuments(),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get actions for an address targeting another address (e.g., adding/removing doctors/members)
   */
  async getActionsByAddressAndTarget(
    address: string,
    targetAddress: string
  ): Promise<Logs[]> {
    return this.logModel
      .find({ address, targetAddress })
      .sort({ createdAt: -1 })
      .exec();
  }

  // ==================== WHITELIST METHODS ====================

  /**
   * Save whitelist/folder information
   */
  async saveWhitelist(whitelistData: Partial<Whitelist>): Promise<Whitelist> {
    try {
      const whitelist = new this.whitelistModel(whitelistData);
      return await whitelist.save();
    } catch (error) {
      this.logger.error("Error saving whitelist:", error);
      throw error;
    }
  }

  /**
   * Update whitelist information
   */
  async updateWhitelist(
    whitelistId: string,
    updateData: Partial<Whitelist>
  ): Promise<Whitelist> {
    try {
      const updated = await this.whitelistModel
        .findOneAndUpdate(
          { whitelistId },
          { $set: updateData },
          { new: true, upsert: false }
        )
        .exec();

      return updated;
    } catch (error) {
      this.logger.error("Error updating whitelist:", error);
      throw error;
    }
  }

  /**
   * Get whitelist by ID
   */
  async getWhitelist(whitelistId: string): Promise<Whitelist> {
    return this.whitelistModel.findOne({ whitelistId }).exec();
  }

  /**
   * Get all whitelists
   */
  async getAllWhitelists(): Promise<Whitelist[]> {
    return this.whitelistModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get whitelists by owner
   */
  async getWhitelistsByOwner(owner: string): Promise<Whitelist[]> {
    return this.whitelistModel
      .find({ owner, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get whitelists where address is a doctor
   */
  async getWhitelistsByDoctor(doctorAddress: string): Promise<Whitelist[]> {
    return this.whitelistModel
      .find({ doctors: doctorAddress, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get whitelists where address is a member
   */
  async getWhitelistsByMember(memberAddress: string): Promise<Whitelist[]> {
    return this.whitelistModel
      .find({ members: memberAddress, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Add doctor to whitelist
   */
  async addDoctorToWhitelist(
    whitelistId: string,
    doctorAddress: string
  ): Promise<Whitelist> {
    return this.whitelistModel
      .findOneAndUpdate(
        { whitelistId },
        { $addToSet: { doctors: doctorAddress } },
        { new: true }
      )
      .exec();
  }

  /**
   * Remove doctor from whitelist
   */
  async removeDoctorFromWhitelist(
    whitelistId: string,
    doctorAddress: string
  ): Promise<Whitelist> {
    return this.whitelistModel
      .findOneAndUpdate(
        { whitelistId },
        { $pull: { doctors: doctorAddress } },
        { new: true }
      )
      .exec();
  }

  /**
   * Add member to whitelist
   */
  async addMemberToWhitelist(
    whitelistId: string,
    memberAddress: string
  ): Promise<Whitelist> {
    return this.whitelistModel
      .findOneAndUpdate(
        { whitelistId },
        { $addToSet: { members: memberAddress } },
        { new: true }
      )
      .exec();
  }

  /**
   * Remove member from whitelist
   */
  async removeMemberFromWhitelist(
    whitelistId: string,
    memberAddress: string
  ): Promise<Whitelist> {
    return this.whitelistModel
      .findOneAndUpdate(
        { whitelistId },
        { $pull: { members: memberAddress } },
        { new: true }
      )
      .exec();
  }

  // ==================== MEDICAL RECORD METHODS ====================

  /**
   * Save medical record information
   */
  async saveRecord(recordData: Partial<Records>): Promise<Records> {
    try {
      const record = new this.recordModel(recordData);
      return await record.save();
    } catch (error) {
      this.logger.error("Error saving medical record:", error);
      throw error;
    }
  }

  /**
   * Get medical record by ID
   */
  async getRecord(recordId: string): Promise<Records> {
    return this.recordModel.findOne({ recordId }).exec();
  }

  /**
   * Get medical records by whitelist
   */
  async getRecordsByWhitelist(whitelistId: string): Promise<Records[]> {
    return this.recordModel
      .find({ whitelistId, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get medical records by uploader
   */
  async getRecordsByUploader(uploader: string): Promise<Records[]> {
    return this.recordModel
      .find({ uploader, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Update medical record
   */
  async updateRecord(
    recordId: string,
    updateData: Partial<Records>
  ): Promise<Records> {
    try {
      const updated = await this.recordModel
        .findOneAndUpdate({ recordId }, { $set: updateData }, { new: true })
        .exec();

      return updated;
    } catch (error) {
      this.logger.error("Error updating medical record:", error);
      throw error;
    }
  }
}
