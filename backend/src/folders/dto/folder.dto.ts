import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({
    description: 'Sui wallet address of the folder owner (patient)',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  owner: string;

  @ApiProperty({
    description:
      'Sui wallet address of the creator (doctor). If not provided, assumes creator = owner',
    example: '0xce113e90491222ae02967221584604bf90992a94879bf9d76cb1ce9867e2bd19',
    required: false,
  })
  @IsString()
  @IsOptional()
  creator?: string;

  @ApiProperty({
    description: 'Label for the folder (e.g., "Personal", "Family - Jane", "Pet - Rex")',
    example: 'Personal - Medical Records',
  })
  @IsString()
  label: string;

  @ApiProperty({
    description: 'Label for the folder (e.g., "Personal", "Family - Jane", "Pet - Rex")',
    example: 'Personal - Medical Records',
  })
  @IsNumber()
  @IsOptional()
  folderType?: number;

  @ApiProperty({
    description: 'Whitelist configuration for access control',
    required: false,
  })
  @IsOptional()
  whitelist?: {
    roleRestrictions?: string[];
  };

  @ApiProperty({
    description:
      '[TESTING ONLY] Private key for server-side signing. Format: suiprivkey1... or base64. WARNING: Never use in production!',
    example: 'suiprivkey1qrspghc7ytddscl29e5gzx0d9q4pfpjuzzsnkx8jz950lp6f35phz76vfzp',
    required: false,
  })
  @IsString()
  @IsOptional()
  privateKey?: string;
}

export class AddDoctorDto {
  @ApiProperty({
    description: 'Address of the doctor to add (can add medical records)',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  doctor: string;

  @ApiProperty({
    description: 'Address of the owner (requester)',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  ownerAddress: string;

  @ApiProperty({
    description: 'WhitelistAdminCap object ID (proves ownership)',
    example: '0x1234567890abcdef...',
  })
  @IsString()
  whitelistCapId: string;

  @ApiProperty({
    description: '[TESTING ONLY] Private key for server-side signing',
    required: false,
  })
  @IsString()
  @IsOptional()
  privateKey?: string;
}

export class AddMemberDto {
  @ApiProperty({
    description: 'Address of the member to add (can only view records)',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  member: string;

  @ApiProperty({
    description: 'Address of the owner (requester)',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  ownerAddress: string;

  @ApiProperty({
    description: 'WhitelistAdminCap object ID (proves ownership)',
    example: '0x1234567890abcdef...',
  })
  @IsString()
  whitelistCapId: string;

  @ApiProperty({
    description: '[TESTING ONLY] Private key for server-side signing',
    required: false,
  })
  @IsString()
  @IsOptional()
  privateKey?: string;
}

export class RemoveDoctorDto {
  @ApiProperty({
    description: 'Address of the doctor to remove',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  doctor: string;

  @ApiProperty({
    description: 'Address of the owner (requester)',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  ownerAddress: string;

  @ApiProperty({
    description: 'WhitelistAdminCap object ID (proves ownership)',
    example: '0x1234567890abcdef...',
  })
  @IsString()
  whitelistCapId: string;

  @ApiProperty({
    description: '[TESTING ONLY] Private key for server-side signing',
    required: false,
  })
  @IsString()
  @IsOptional()
  privateKey?: string;
}

export class RemoveMemberDto {
  @ApiProperty({
    description: 'Address of the member to remove',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  member: string;

  @ApiProperty({
    description: 'Address of the owner (requester)',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  ownerAddress: string;

  @ApiProperty({
    description: 'WhitelistAdminCap object ID (proves ownership)',
    example: '0x1234567890abcdef...',
  })
  @IsString()
  whitelistCapId: string;

  @ApiProperty({
    description: '[TESTING ONLY] Private key for server-side signing',
    required: false,
  })
  @IsString()
  @IsOptional()
  privateKey?: string;
}
