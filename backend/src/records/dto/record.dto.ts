import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class UploadRecordDto {
  @ApiProperty({
    description: 'Whitelist ID where the record will be stored',
    example: '0x123...',
  })
  @IsString()
  whitelistId: string;

  @ApiProperty({
    description: 'Whitelist Admin Cap ID',
    example: '0x456...',
  })
  @IsString()
  adminCapId: string;

  @ApiProperty({
    description: 'Uploader address (doctor/hospital)',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  uploader: string;

  @ApiProperty({
    description: 'Document types (0=lab, 1=imaging, 2=notes, 3=prescription, 4=other)',
    example: [0, 1],
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return value.split(',').map(v => parseInt(v.trim(), 10));
      }
    }
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsNumber({}, { each: true })
  docTypes: number[];

  @ApiProperty({
    description: 'Private key for on-chain execution (optional - if provided, will execute immediately)',
    example: 'suiprivkey1...',
    required: false,
  })
  @IsOptional()
  @IsString()
  privateKey?: string;
}

export class DownloadRecordFileDto {
  @ApiProperty({
    description: 'Requester wallet address (must have read permission)',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  requesterAddress: string;

  @ApiProperty({
    description: 'File index to download (0-based)',
    example: 0,
  })
  @IsNumber()
  fileIndex: number;

  @ApiProperty({
    description: 'User signature for SessionKey authentication (optional if privateKey provided)',
    example: '0xabc123...',
    required: false,
  })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiProperty({
    description: 'Private key for automatic signing (optional - if provided, signature will be generated)',
    example: 'suiprivkey1...',
    required: false,
  })
  @IsOptional()
  @IsString()
  privateKey?: string;
}

export class AddFilesToRecordDto {
  @ApiProperty({
    description: 'Uploader address',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  uploader: string;

  @ApiProperty({
    description: 'Document type',
    example: 1,
  })
  @IsNumber()
  docType: number;
}
