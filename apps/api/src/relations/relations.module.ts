import { Module } from '@nestjs/common';
import { RelationsController } from './relations.controller';
import { RelationsService } from './relations.service';

@Module({
  controllers: [RelationsController],
  providers: [RelationsService],
})
export class RelationsModule {}

