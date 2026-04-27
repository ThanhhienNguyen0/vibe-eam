import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ElementsService } from './elements.service';
import { CreateElementDto } from './dto/create-element.dto';
import { UpdateElementDto } from './dto/update-element.dto';

@Controller('elements')
export class ElementsController {
  constructor(private readonly elements: ElementsService) {}

  @Get()
  async list(@Query('branchId') branchId: string, @Query('diagramId') diagramId?: string) {
    if (diagramId) return this.elements.listByDiagram(branchId, diagramId);
    return this.elements.list(branchId);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.elements.get(id);
  }

  @Post()
  async create(@Body() dto: CreateElementDto) {
    return this.elements.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateElementDto) {
    return this.elements.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.elements.remove(id);
  }
}

