import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ImportCsvDto } from './dto/import-csv.dto';
import { IoService } from './io.service';

@Controller('io')
export class IoController {
  constructor(private readonly io: IoService) {}

  @Get('export/csv')
  async exportCsv(@Query('branchId') branchId: string) {
    return this.io.exportCsv(branchId);
  }

  @Post('import/csv')
  async importCsv(@Body() dto: ImportCsvDto) {
    return this.io.importCsv(dto.branchId, dto.elementsCsv, dto.relationsCsv);
  }
}

