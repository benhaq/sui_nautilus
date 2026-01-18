import { Module } from '@nestjs/common';
import { LogModule } from "../log/log.module";
import { SealModule } from "../seal/seal.module";
import { SuiModule } from "../sui/sui.module";
import { WalrusModule } from "../walrus/walrus.module";
import { RecordsController } from "./records.controller";
import { RecordsService } from "./records.service";

@Module({
  imports: [SuiModule, SealModule, WalrusModule, LogModule],
  controllers: [RecordsController],
  providers: [RecordsService],
  exports: [RecordsService],
})
export class RecordsModule {}
