import { Body, Controller, Get, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatePaymentDto, VerifyPaymentDto } from './dto/payment.dto';
import { PaymentService } from './payment.service';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) { }

  @Post('verify')
  @ApiOperation({
    summary: 'Verify a payment transaction',
    description:
      'Verifies that a payment is valid using Payment Kit against the configured registry and saves the record',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verification result',
    schema: {
      example: {
        isValid: true,
        digest: 'ABC123XYZ789',
        timestamp: 1705747200000,
      },
    },
  })
  async verifyPayment(@Body() verifyDto: VerifyPaymentDto) {
    try {
      const result = await this.paymentService.verifyPayment(
        verifyDto.nonce,
        verifyDto.sender,
        verifyDto.recipient,
        verifyDto.amount,
        verifyDto.coinType,
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':id/pay')
  @ApiOperation({
    summary: 'Create payment transaction for folder action',
    description: 'Creates a payment transaction for a specific folder action that requires payment',
  })
  @ApiResponse({ status: 201, description: 'Payment transaction created' })
  async createPaymentForAction(
    @Param('id') whitelistId: string,
    @Body() paymentDto: CreatePaymentDto,
  ) {
    const recipient =
      process.env.PAYMENT_RECIPIENT ||
      '0x742d35cc6634c0532925a3b844bc9e7eb503501d0721069a0d8f29b10e0b5e91';

    const result = await this.paymentService.createPaymentTransaction(
      paymentDto.sender,
      recipient,
      paymentDto.amount,
    );

    return {
      success: true,
      data: {
        ...result,
        whitelistId,
        recipient,
        amount: paymentDto.amount,
        coinType: '0x2::sui::SUI',
      },
    };
  }

  @Get('history/:address')
  @ApiOperation({
    summary: 'Get payment history',
    description: 'Retrieves verified payment history from database',
  })
  @ApiParam({
    name: 'address',
    description: 'Wallet address (recipient/clinic)',
    example: '0x1234...',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment history',
    schema: {
      example: {
        success: true,
        data: [
          {
            nonce: '123...',
            digest: '0x123abc...',
            recipient: '0x123...',
            amount: '1000000',
            coinType: '0x2::sui::SUI',
            timestamp: 1705747200000,
            type: 'received',
          },
        ],
      },
    },
  })
  async getPaymentHistory(@Param('address') address: string) {
    try {
      const history = await this.paymentService.getPaymentHistory(address);
      return {
        success: true,
        data: history,
        count: history.length,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
