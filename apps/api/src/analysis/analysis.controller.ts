import { Controller, Get, Query } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get('impact')
  async impact(
    @Query('branchId') branchId: string,
    @Query('elementKey') elementKey: string,
    @Query('direction') direction: string = 'downstream',
    @Query('maxDepth') maxDepth: string = '5',
  ) {
    return this.analysis.impact({
      branchId,
      elementKey,
      direction: direction === 'upstream' ? 'upstream' : 'downstream',
      maxDepth: Number(maxDepth),
    });
  }
}

