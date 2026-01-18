import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentRecord, PaymentRecordSchema } from '../schemas/payment-record.schema';
import { SuiModule } from '../sui/sui.module';
import { PaymentController } from './payment.controller';
import { PaymentGuard } from './payment.guard';
import { PaymentService } from './payment.service';

@Module({
  imports: [
    SuiModule,
    MongooseModule.forFeature([{ name: PaymentRecord.name, schema: PaymentRecordSchema }]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentGuard],
  exports: [PaymentService, PaymentGuard],
})
export class PaymentModule {}
