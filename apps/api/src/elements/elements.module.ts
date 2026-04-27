import { Module } from '@nestjs/common';
import { ElementsController } from './elements.controller';
import { ElementsService } from './elements.service';

@Module({
  controllers: [ElementsController],
  providers: [ElementsService],
})
export class ElementsModule {}

