import { Module, forwardRef } from '@nestjs/common';
import { SuiModule } from '../sui/sui.module';
import { SealService } from './seal.service';

@Module({
  imports: [forwardRef(() => SuiModule)],
  providers: [SealService],
  exports: [SealService],
})
export class SealModule {}
