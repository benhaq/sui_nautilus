import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Logs, LogSchema, Records, RecordSchema } from '../schemas';
import { Whitelist, WhitelistSchema } from '../schemas/whitelist.schema';
import { LogController } from './log.controller';
import { LogService } from './log.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Logs.name, schema: LogSchema },
      { name: Whitelist.name, schema: WhitelistSchema },
      { name: Records.name, schema: RecordSchema },
    ]),
  ],
  controllers: [LogController],
  providers: [LogService],
  exports: [LogService],
})
export class LogModule {}
