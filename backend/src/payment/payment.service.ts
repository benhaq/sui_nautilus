import { DEFAULT_REGISTRY_NAME, paymentKit, PaymentKitClient } from '@mysten/payment-kit';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Signer } from '@mysten/sui/cryptography';
import { ClientWithExtensions } from '@mysten/sui/experimental';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import console from 'console';
import * as crypto from 'crypto';
import { Model } from 'mongoose';
import { PaymentRecord, PaymentRecordDocument } from '../schemas/payment-record.schema';
import { SuiService } from '../sui/sui.service';

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private client: ClientWithExtensions<{
    [x: string]: unknown;
  }, SuiClient>
  private paymentKitClient: PaymentKitClient;
  private registryId: string;
  private signer: Signer;

  constructor(
    private suiService: SuiService,
    private configService: ConfigService,
    @InjectModel(PaymentRecord.name)
    private paymentRecordModel: Model<PaymentRecordDocument>
  ) { }

  onModuleInit() {
    this.initializePaymentKit();
  }

  private async initializePaymentKit() {
    try {
      // this.client = this.suiService.getClient();
      this.client = new SuiClient({
        url: getFullnodeUrl('testnet'),
        network: 'testnet',
      }).$extend(paymentKit() as any);
      this.paymentKitClient = this.client.paymentKit as any;
      this.signer = Ed25519Keypair.fromSecretKey(this.configService.get<string>("SUI_KEYPAIR") || 'suiprivkey1qpj6q88wcra24ycrfas5f72u2yql8wavt49f0g5f4peumrcqhmfz2nevhss');

      const registryName = this.configService.get<string>("PAYMENT_REGISTRY_NAME") || DEFAULT_REGISTRY_NAME;
      this.registryId = await this.paymentKitClient.getRegistryIdFromName(registryName);
      this.logger.log(`Payment Kit initialized. Registry: ${registryName} (${this.registryId})`);
    } catch (error) {
      this.logger.error(`Failed to initialize Payment Kit: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a payment transaction for frontend to sign
   * Uses processRegistryPayment to ensure payment works with the registry
   */
  async createPaymentTransaction(
    sender: string,
    recipient: string,
    amount: number
  ): Promise<{ tx: string; nonce: string }> {
    try {
      this.logger.log(`Creating payment transaction for sender ${sender} to ${recipient}`);

      const nonce = crypto.randomUUID();
      console.log({
        sender,
        amount: BigInt(amount),
        receiver: recipient,
        nonce,
        coinType: '0x2::sui::SUI',
        registryId: this.registryId,
      })
      const txPayment = this.paymentKitClient.tx?.processRegistryPayment({
        sender,
        amount: BigInt(amount),
        receiver: recipient,
        nonce,
        coinType: '0x2::sui::SUI',
        registryId: this.registryId,
      });
      // tx.setSender(sender);
      // const result = await this.client.signAndExecuteTransaction({
      //   transaction: tx as any,
      //   signer: this.signer,
      //   options: {
      //     showEffects: true,
      //     showEvents: true,
      //   },
      // });
      // await sleep(5000);
      const tx = await txPayment.toJSON();

      return {
        tx,
        nonce
      };
    } catch (error) {
      this.logger.error(`Error creating payment transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify payment using Payment Kit and save record to DB
   */
  async verifyPayment(
    nonce: string,
    sender: string,
    recipient: string,
    amount: number,
    coinType: string = '0x2::sui::SUI'
  ): Promise<{
    isValid: boolean;
    digest?: string;
    timestamp?: number;
  }> {
    try {
      this.logger.log(`Verifying payment nonce: ${nonce}`);

      // Check if nonce has already been used
      const existingRecord = await this.paymentRecordModel.findOne({ nonce });
      if (existingRecord && existingRecord.used) {
        this.logger.warn(`Payment nonce already used: ${nonce}`);
        return { isValid: false };
      }

      const record = await this.paymentKitClient.getPaymentRecord({
        nonce,
        receiver: recipient,
        amount: BigInt(amount),
        coinType,
        registryId: this.registryId,
      } as any);

      if (!record) {
        this.logger.warn(`Payment record not found for nonce: ${nonce}`);
        return { isValid: false };
      }

      this.logger.log(
        `Payment verified: ${record.paymentTransactionDigest || 'Unknown Digest'}`
      );

      // Save or update verified payment record to DB and mark as used
      try {
        if (existingRecord) {
          await this.paymentRecordModel.updateOne(
            { nonce },
            {
              transactionDigest: record.paymentTransactionDigest,
              sender,
              recipient,
              amount: amount.toString(),
              coinType,
              registryId: this.registryId,
              verifiedAt: new Date(),
              used: true
            }
          );
        } else {
          await this.paymentRecordModel.create({
            nonce,
            transactionDigest: record.paymentTransactionDigest,
            sender,
            recipient,
            amount: amount.toString(),
            coinType,
            registryId: this.registryId,
            verifiedAt: new Date(),
            used: true
          });
        }
        this.logger.log(`Payment record saved/updated and marked as used for nonce: ${nonce}`);
      } catch (dbError) {
        this.logger.error(`Failed to save/update payment record to DB: ${dbError.message}`);
      }

      return {
        isValid: true,
        digest: record.paymentTransactionDigest || undefined,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Error verifying payment: ${error.message}`);
      return { isValid: false };
    }
  }

  /**
   * Get payment history from database
   */
  async getPaymentHistory(address: string, limit: number = 20) {
    try {
      const records = await this.paymentRecordModel
        .find({ $or: [{ recipient: address }, { sender: address }] })
        .sort({ verifiedAt: -1 })
        .limit(limit)
        .exec();

      return records.map(record => ({
        nonce: record.nonce,
        digest: record.transactionDigest,
        sender: record.sender,
        recipient: record.recipient,
        amount: record.amount,
        coinType: record.coinType,
        timestamp: record.verifiedAt.getTime(),
        type: record.sender === address ? 'sent' : 'received',
      }));
    } catch (error) {
      this.logger.error(`Error fetching payment history from DB: ${error.message}`);
      throw error;
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

