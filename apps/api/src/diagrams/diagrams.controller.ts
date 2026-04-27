import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { DiagramsService } from './diagrams.service';
import { CreateDiagramEdgeDto } from './dto/create-edge.dto';
import { CreateDiagramNodeDto } from './dto/create-node.dto';
import { UpdateDiagramNodeDto } from './dto/update-node.dto';

@Controller('diagrams')
export class DiagramsController {
  constructor(private readonly diagrams: DiagramsService) {}

  @Get()
  async list(@Query('branchId') branchId: string) {
    return this.diagrams.list(branchId);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.diagrams.get(id);
  }

  @Post()
  async create(@Body() dto: CreateDiagramDto) {
    return this.diagrams.create(dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.diagrams.remove(id);
  }

  @Get(':id/view')
  async view(@Param('id') id: string) {
    return this.diagrams.getView(id);
  }

  @Post('nodes')
  async createNode(@Body() dto: CreateDiagramNodeDto) {
    return this.diagrams.createNode(dto);
  }

  @Patch('nodes/:nodeId')
  async updateNode(@Param('nodeId') nodeId: string, @Body() dto: UpdateDiagramNodeDto) {
    return this.diagrams.updateNode(nodeId, dto);
  }

  @Post('edges')
  async createEdge(@Body() dto: CreateDiagramEdgeDto) {
    return this.diagrams.createEdge(dto);
  }
}

