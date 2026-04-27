import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { MergeBranchDto } from './dto/merge-branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  async list() {
    return this.branches.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.branches.get(id);
  }

  @Post()
  async create(@Body() dto: CreateBranchDto) {
    return this.branches.create(dto);
  }

  @Post('merge')
  async merge(@Body() dto: MergeBranchDto) {
    return this.branches.merge(dto);
  }
}

