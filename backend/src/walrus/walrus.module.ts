import { Module } from '@nestjs/common';
import { WalrusService } from './walrus.service';

@Module({
  providers: [WalrusService],
  exports: [WalrusService],
})
export class WalrusModule {}
