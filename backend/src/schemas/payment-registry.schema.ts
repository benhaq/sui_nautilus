import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentRegistryDocument = HydratedDocument<PaymentRegistry>;

@Schema({ timestamps: true, collection: 'payment_registries' })
export class PaymentRegistry {
  @Prop({ required: true, unique: true, index: true })
  ownerAddress: string;

  @Prop({ required: true })
  registryName: string;

  @Prop({ required: false })
  registryId: string;

  @Prop({ required: true })
  digest: string;
}

export const PaymentRegistrySchema = SchemaFactory.createForClass(PaymentRegistry);
