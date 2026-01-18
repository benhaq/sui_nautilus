import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WhitelistDocument = Whitelist & Document;

@Schema({ timestamps: true })
export class Whitelist {
  @Prop({ required: true, unique: true, index: true })
  whitelistId: string;

  @Prop({ required: true })
  adminCapId: string;

  @Prop({ required: true, index: true })
  owner: string;

  @Prop({ required: true, index: true })
  patient: string;

  @Prop({ required: true })
  creator: string;

  @Prop({ required: true })
  label: string;

  @Prop({ type: [String], default: [], index: true })
  doctors: string[];

  @Prop({ type: [String], default: [], index: true })
  members: string[];

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

export const WhitelistSchema = SchemaFactory.createForClass(Whitelist);

// Add compound indexes for better query performance
WhitelistSchema.index({ owner: 1, isActive: 1 });
WhitelistSchema.index({ patient: 1, isActive: 1 });
WhitelistSchema.index({ doctors: 1, isActive: 1 });
WhitelistSchema.index({ members: 1, isActive: 1 });
