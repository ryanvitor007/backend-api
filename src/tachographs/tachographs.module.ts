import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { TachographsService } from './tachographs.service';
import { TachographsController } from './tachographs.controller';

@Module({
  imports: [StorageModule],
  controllers: [TachographsController],
  providers: [TachographsService],
  exports: [TachographsService],
})
export class TachographsModule {}
