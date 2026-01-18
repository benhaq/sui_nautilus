import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RecordDocument = Records & Document;

export enum DocumentType {
  LAB = 0,
  IMAGING = 1,
  NOTES = 2,
  PRESCRIPTION = 3,
  OTHER = 4,
}

@Schema({ timestamps: true })
export class Records {
  @Prop({ required: true, unique: true, index: true })
  recordId: string;

  @Prop({ required: true, index: true })
  whitelistId: string;

  @Prop({ required: true })
  adminCapId: string;

  @Prop({ required: true, index: true })
  uploader: string;

  @Prop({ type: [String], required: true })
  walrusCids: string[];

  @Prop({ type: [String], required: true })
  sealedKeyRefs: string[];

  @Prop({ type: [Number], required: true })
  docTypes: number[];

  @Prop({ type: [String] })
  originalFileNames?: string[];

  @Prop()
  digest?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;

  // Timestamp fields
  createdAt?: Date;
  updatedAt?: Date;
}

export const RecordSchema = SchemaFactory.createForClass(Records);

// Add compound indexes for better query performance
RecordSchema.index({ whitelistId: 1, isActive: 1 });
RecordSchema.index({ uploader: 1, isActive: 1 });
RecordSchema.index({ createdAt: -1 });
