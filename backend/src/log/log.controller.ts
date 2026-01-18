import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActionType } from '../schemas';
import { LogService } from './log.service';

@ApiTags("Log")
@Controller("log")
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Get("address/:address")
  @ApiOperation({ summary: "Get all actions by address" })
  @ApiParam({ name: "address", description: "Wallet address" })
  async getActionsByAddress(@Param("address") address: string) {
    const actions = await this.logService.getActionsByAddress(address);
    return {
      success: true,
      address,
      count: actions.length,
      actions,
    };
  }

  @Get("whitelist/:whitelistId")
  @ApiOperation({ summary: "Get all actions for a whitelist" })
  @ApiParam({ name: "whitelistId", description: "Whitelist ID" })
  async getActionsByWhitelist(@Param("whitelistId") whitelistId: string) {
    const actions = await this.logService.getActionsByWhitelist(whitelistId);
    return {
      success: true,
      whitelistId,
      count: actions.length,
      actions,
    };
  }

  @Get("type/:actionType")
  @ApiOperation({ summary: "Get all actions by type" })
  @ApiParam({
    name: "actionType",
    enum: ActionType,
    description: "Action type",
  })
  async getActionsByType(@Param("actionType") actionType: ActionType) {
    const actions = await this.logService.getActionsByType(actionType);
    return {
      success: true,
      actionType,
      count: actions.length,
      actions,
    };
  }

  @Get()
  @ApiOperation({ summary: "Get all actions with pagination" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getAllActions(
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    const result = await this.logService.getAllActions(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50
    );
    return {
      success: true,
      ...result,
    };
  }

  @Get("relationship/:address/:targetAddress")
  @ApiOperation({
    summary: "Get actions between two addresses (e.g., adding/removing doctor)",
  })
  @ApiParam({ name: "address", description: "Source wallet address" })
  @ApiParam({ name: "targetAddress", description: "Target wallet address" })
  async getActionsByAddressAndTarget(
    @Param("address") address: string,
    @Param("targetAddress") targetAddress: string
  ) {
    const actions = await this.logService.getActionsByAddressAndTarget(
      address,
      targetAddress
    );
    return {
      success: true,
      address,
      targetAddress,
      count: actions.length,
      actions,
    };
  }

  // ==================== WHITELIST ENDPOINTS ====================

  @Get("whitelists/owner/:owner")
  @ApiOperation({ summary: "Get all whitelists owned by an address" })
  @ApiParam({ name: "owner", description: "Owner wallet address" })
  async getWhitelistsByOwner(@Param("owner") owner: string) {
    const whitelists = await this.logService.getWhitelistsByOwner(owner);
    return {
      success: true,
      owner,
      count: whitelists.length,
      whitelists,
    };
  }

  @Get("whitelists/doctor/:doctorAddress")
  @ApiOperation({ summary: "Get all whitelists where address is a doctor" })
  @ApiParam({ name: "doctorAddress", description: "Doctor wallet address" })
  async getWhitelistsByDoctor(@Param("doctorAddress") doctorAddress: string) {
    const whitelists =
      await this.logService.getWhitelistsByDoctor(doctorAddress);
    return {
      success: true,
      doctorAddress,
      count: whitelists.length,
      whitelists,
    };
  }

  @Get("whitelists/member/:memberAddress")
  @ApiOperation({ summary: "Get all whitelists where address is a member" })
  @ApiParam({ name: "memberAddress", description: "Member wallet address" })
  async getWhitelistsByMember(@Param("memberAddress") memberAddress: string) {
    const whitelists =
      await this.logService.getWhitelistsByMember(memberAddress);
    return {
      success: true,
      memberAddress,
      count: whitelists.length,
      whitelists,
    };
  }

  @Get("whitelists/:whitelistId")
  @ApiOperation({ summary: "Get whitelist details by ID" })
  @ApiParam({ name: "whitelistId", description: "Whitelist ID" })
  async getWhitelist(@Param("whitelistId") whitelistId: string) {
    const whitelist = await this.logService.getWhitelist(whitelistId);
    return {
      success: true,
      whitelist,
    };
  }

  // ==================== MEDICAL RECORD ENDPOINTS ====================

  @Get("records/:recordId")
  @ApiOperation({ summary: "Get medical record details by ID" })
  @ApiParam({ name: "recordId", description: "Medical record ID" })
  async getRecord(@Param("recordId") recordId: string) {
    const record = await this.logService.getRecord(recordId);
    return {
      success: true,
      record,
    };
  }

  @Get("records/whitelist/:whitelistId")
  @ApiOperation({ summary: "Get all medical records for a whitelist" })
  @ApiParam({ name: "whitelistId", description: "Whitelist ID" })
  async getRecordsByWhitelist(@Param("whitelistId") whitelistId: string) {
    const records = await this.logService.getRecordsByWhitelist(whitelistId);
    return {
      success: true,
      whitelistId,
      count: records.length,
      records,
    };
  }

  @Get("records/uploader/:uploader")
  @ApiOperation({ summary: "Get all medical records uploaded by an address" })
  @ApiParam({ name: "uploader", description: "Uploader wallet address" })
  async getRecordsByUploader(@Param("uploader") uploader: string) {
    const records = await this.logService.getRecordsByUploader(uploader);
    return {
      success: true,
      uploader,
      count: records.length,
      records,
    };
  }
}
