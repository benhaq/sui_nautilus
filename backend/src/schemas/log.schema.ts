import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LogDocument = Logs & Document;

export enum ActionType {
  CREATE_WHITELIST = "CREATE_WHITELIST",
  ADD_DOCTOR = "ADD_DOCTOR",
  REMOVE_DOCTOR = "REMOVE_DOCTOR",
  ADD_MEMBER = "ADD_MEMBER",
  REMOVE_MEMBER = "REMOVE_MEMBER",
  CREATE_RECORD = "CREATE_RECORD",
  EXPORT_RECORDS = "EXPORT_RECORDS",
}

@Schema({ timestamps: true })
export class Logs {
  @Prop({ required: true })
  address: string;

  @Prop({ required: true, enum: ActionType })
  actionType: ActionType;

  @Prop({ required: false })
  whitelistId?: string;

  @Prop({ required: false })
  targetAddress?: string; // doctor/member being added or removed

  @Prop({ required: false })
  recordId?: string;

  @Prop({ required: false })
  digest?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: true })
  success: boolean;

  @Prop()
  errorMessage?: string;

  // Timestamp fields
  createdAt?: Date;
  updatedAt?: Date;
}

export const LogSchema = SchemaFactory.createForClass(Logs);
