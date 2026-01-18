import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Sui wallet address of the sender (user paying)',
    example: '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91',
  })
  @IsString()
  sender: string;

  @ApiProperty({
    description: 'Amount to pay in MIST (smallest unit of SUI)',
    example: 1000000, // 1 SUI
  })
  @IsNumber()
  amount: number;
}

export class VerifyPaymentDto {
  @ApiProperty({
    description: 'Payment nonce',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  nonce: string;

  @ApiProperty({
    description: 'Sender address (User/Patient)',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  sender: string;

  @ApiProperty({
    description: 'Recipient address (clinic)',
    example: '0xabcdef...',
  })
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @ApiProperty({
    description: 'Amount in MIST',
    example: 1000000000,
  })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Coin Type',
    example: '0x2::sui::SUI',
    required: false,
    default: '0x2::sui::SUI',
  })
  @IsString()
  @IsOptional()
  coinType?: string;
}

export class RefundPaymentDto {
  @ApiProperty({
    description: 'Recipient address (typically the patient)',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @ApiProperty({
    description: 'Amount to refund in MIST',
    example: 500000000,
  })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Original transaction digest causing this refund (for auditing)',
    example: 'ABC123XYZ789',
  })
  @IsString()
  @IsNotEmpty()
  originalTxDigest: string;
}

export class CreatePaymentTxDto {
  @ApiProperty({
    description: 'Sender address (User/Patient) who will sign the transaction',
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  sender: string;

  @ApiProperty({
    description: 'Recipient address (Clinic)',
    example: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  })
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @ApiProperty({
    description: 'Amount in MIST',
    example: 1000000000,
  })
  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
