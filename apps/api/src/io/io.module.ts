import { Module } from '@nestjs/common';
import { IoController } from './io.controller';
import { IoService } from './io.service';

@Module({
  controllers: [IoController],
  providers: [IoService],
})
export class IoModule {}

