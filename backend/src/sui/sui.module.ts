import { Module, forwardRef } from '@nestjs/common';
import { SealModule } from '../seal/seal.module';
import { SuiService } from './sui.service';

@Module({
  imports: [forwardRef(() => SealModule)],
  providers: [SuiService],
  exports: [SuiService],
})
export class SuiModule {}
