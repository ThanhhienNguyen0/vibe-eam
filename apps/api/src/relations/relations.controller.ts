import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RelationsService } from './relations.service';
import { CreateRelationDto } from './dto/create-relation.dto';
import { UpdateRelationDto } from './dto/update-relation.dto';

@Controller('relations')
export class RelationsController {
  constructor(private readonly relations: RelationsService) {}

  @Get()
  async list(@Query('branchId') branchId: string, @Query('diagramId') diagramId?: string) {
    if (diagramId) return this.relations.listByDiagram(branchId, diagramId);
    return this.relations.list(branchId);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.relations.get(id);
  }

  @Post()
  async create(@Body() dto: CreateRelationDto) {
    return this.relations.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRelationDto) {
    return this.relations.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.relations.remove(id);
  }
}

