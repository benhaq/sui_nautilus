import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentRecordDocument = HydratedDocument<PaymentRecord>;

@Schema({ timestamps: true, collection: 'payment_records' })
export class PaymentRecord {
  @Prop({ required: true, unique: true, index: true })
  nonce: string;

  @Prop({ required: true })
  transactionDigest: string;

  @Prop({ required: true })
  sender: string;

  @Prop({ required: true })
  recipient: string;

  @Prop({ required: true })
  amount: string; // Storing as string to handle large numbers (MIST) safely

  @Prop({ required: true })
  coinType: string;

  @Prop()
  registryId?: string;

  @Prop()
  verifiedAt: Date;

  @Prop({ default: false })
  used: boolean;
}

export const PaymentRecordSchema = SchemaFactory.createForClass(PaymentRecord);
