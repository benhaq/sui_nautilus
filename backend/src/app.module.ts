import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { FoldersModule } from "./folders/folders.module";
import { RecordsModule } from "./records/records.module";
import { SealModule } from "./seal/seal.module";
import { SuiModule } from "./sui/sui.module";
import { WalrusModule } from "./walrus/walrus.module";
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || "mongodb://localhost:27017/medical-vault"
    ),
    SuiModule,
    WalrusModule,
    SealModule,
    FoldersModule,
    RecordsModule,
    PaymentModule
  ],
})
export class AppModule {}
