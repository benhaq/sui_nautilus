import { Module } from '@nestjs/common';
import { LogModule } from "../log/log.module";
import { SealModule } from '../seal/seal.module';
import { SuiModule } from '../sui/sui.module';
import { WalrusModule } from '../walrus/walrus.module';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';

@Module({
  imports: [SuiModule, SealModule, WalrusModule, LogModule],
  controllers: [FoldersController],
  providers: [FoldersService],
  exports: [FoldersService],
})
export class FoldersModule {}
