import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Injectable()
export class PaymentGuard implements CanActivate {
  private readonly logger = new Logger(PaymentGuard.name);

  constructor(private readonly paymentService: PaymentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const nonce = request.headers['x-payment-nonce'];
    const sender = request.headers['x-payment-sender'];
    const recipient = request.headers['x-payment-recipient'];
    const amount = request.headers['x-payment-amount'];
    const coinType = request.headers['x-payment-coin-type'] || '0x2::sui::SUI';

    if (!nonce || !sender || !recipient || !amount) {
      this.logger.warn('Missing payment headers');
      return false;
    }

    try {
      const verification = await this.paymentService.verifyPayment(
        nonce,
        sender,
        recipient,
        parseInt(amount),
        coinType,
      );

      if (!verification.isValid) {
        this.logger.warn(`Payment verification failed for nonce: ${nonce}`);
        return false;
      }

      this.logger.log(`Payment verified for nonce: ${nonce}`);
      return true;
    } catch (error) {
      this.logger.error(`Error verifying payment: ${error.message}`);
      return false;
    }
  }
}
