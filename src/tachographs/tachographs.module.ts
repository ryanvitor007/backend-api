import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { TachographsService } from './tachographs.service';
import { TachographsController } from './tachographs.controller';
import { TachographsAiService } from './tachographs-ai.service';

@Module({
  imports: [StorageModule],
  controllers: [TachographsController],
  providers: [TachographsService, TachographsAiService],
  exports: [TachographsService, TachographsAiService],
})
export class TachographsModule {}
