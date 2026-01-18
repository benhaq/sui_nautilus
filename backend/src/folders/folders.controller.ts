import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AddDoctorDto,
  AddMemberDto,
  CreateFolderDto,
  RemoveDoctorDto,
  RemoveMemberDto,
} from './dto/folder.dto';
import { FoldersService } from './folders.service';

@ApiTags('whitelists')
@Controller('whitelists')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create whitelist',
    description: 'Creates a new whitelist for medical records with two-level access control',
  })
  @ApiResponse({ status: 201, description: 'Whitelist created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createAndExecuteFolder(@Body() createFolderDto: CreateFolderDto) {
    return this.foldersService.createAndExecuteFolder(createFolderDto);
  }

  @Post(':id/doctors')
  @ApiOperation({
    summary: 'Add doctor to whitelist',
    description:
      'Grants write access (can add and view records). If privateKey is provided, executes immediately on-chain.',
  })
  @ApiResponse({ status: 200, description: 'Doctor added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async addDoctor(@Param('id') whitelistId: string, @Body() addDoctorDto: AddDoctorDto) {
    // If private key is provided, execute on-chain immediately
    if (addDoctorDto.privateKey) {
      return this.foldersService.addDoctorAndExecute(whitelistId, addDoctorDto);
    }
    // Otherwise, return transaction for client to sign
    return this.foldersService.addDoctor(whitelistId, addDoctorDto);
  }

  @Post(':id/members')
  @ApiOperation({
    summary: 'Add member to whitelist',
    description:
      'Grants read-only access (can only view records). If privateKey is provided, executes immediately on-chain.',
  })
  @ApiResponse({ status: 200, description: 'Member added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async addMember(@Param('id') whitelistId: string, @Body() addMemberDto: AddMemberDto) {
    // If private key is provided, execute on-chain immediately
    if (addMemberDto.privateKey) {
      return this.foldersService.addMemberAndExecute(whitelistId, addMemberDto);
    }
    // Otherwise, return transaction for client to sign
    return this.foldersService.addMember(whitelistId, addMemberDto);
  }

  @Delete(':id/doctors')
  @ApiOperation({
    summary: 'Remove doctor from whitelist',
    description: 'Revokes write access. If privateKey is provided, executes immediately on-chain.',
  })
  @ApiResponse({ status: 200, description: 'Doctor removed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async removeDoctor(@Param('id') whitelistId: string, @Body() removeDoctorDto: RemoveDoctorDto) {
    // If private key is provided, execute on-chain immediately
    if (removeDoctorDto.privateKey) {
      return this.foldersService.removeDoctorAndExecute(whitelistId, removeDoctorDto);
    }
    // Otherwise, return transaction for client to sign
    return this.foldersService.removeDoctor(whitelistId, removeDoctorDto);
  }

  @Delete(':id/members')
  @ApiOperation({
    summary: 'Remove member from whitelist',
    description:
      'Removes read-only access. If privateKey is provided, executes immediately on-chain.',
  })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async removeMember(@Param('id') whitelistId: string, @Body() removeMemberDto: RemoveMemberDto) {
    // If private key is provided, execute on-chain immediately
    if (removeMemberDto.privateKey) {
      return this.foldersService.removeMemberAndExecute(whitelistId, removeMemberDto);
    }
    // Otherwise, return transaction for client to sign
    return this.foldersService.removeMember(whitelistId, removeMemberDto);
  }

  @Get('user/:address/chain')
  @ApiOperation({
    summary: 'Get whitelists for a user from on-chain registry',
    description:
      'Returns all whitelists the user can access by querying the WhitelistRegistry on-chain. Includes detailed access information.',
  })
  @ApiResponse({
    status: 200,
    description: 'On-chain whitelists retrieved successfully',
  })
  async getUserWhitelistsFromChain(@Param('address') address: string) {
    return this.foldersService.getUserWhitelistsFromChain(address);
  }

  @Get(':id/access/:address')
  @ApiOperation({
    summary: 'Get detailed access information for a user in a whitelist',
    description:
      'Returns role, permissions (read/write/manage), and access details from on-chain data',
  })
  @ApiResponse({
    status: 200,
    description: 'Access information retrieved successfully',
  })
  async getUserWhitelistAccess(
    @Param('id') whitelistId: string,
    @Param('address') address: string,
  ) {
    return this.foldersService.getUserWhitelistAccess(whitelistId, address);
  }

  @Get(':id/check-access/:address')
  @ApiOperation({
    summary: 'Check if user has access to whitelist (O(1) lookup)',
    description:
      'Fast access check using nested Table structure. Returns true/false without fetching full whitelist details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Access check completed',
  })
  async checkWhitelistAccess(@Param('id') whitelistId: string, @Param('address') address: string) {
    return this.foldersService.checkWhitelistAccess(whitelistId, address);
  }
}
