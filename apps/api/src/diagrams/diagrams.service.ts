import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../prisma/to-json';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { CreateDiagramEdgeDto } from './dto/create-edge.dto';
import { CreateDiagramNodeDto } from './dto/create-node.dto';
import { UpdateDiagramNodeDto } from './dto/update-node.dto';

@Injectable()
export class DiagramsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(branchId: string) {
    return this.prisma.diagram.findMany({
      where: { branchId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(id: string) {
    const d = await this.prisma.diagram.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Diagram not found');
    return d;
  }

  async create(dto: CreateDiagramDto) {
    return this.prisma.diagram.create({
      data: {
        branchId: dto.branchId,
        name: dto.name,
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    return this.prisma.diagram.delete({ where: { id } });
  }

  async getView(diagramId: string) {
    const diagram = await this.prisma.diagram.findUnique({ where: { id: diagramId } });
    if (!diagram) throw new NotFoundException('Diagram not found');

    const nodes = await this.prisma.diagramNode.findMany({
      where: { diagramId },
      orderBy: { updatedAt: 'desc' },
    });
    const elementKeys = nodes.map((n) => n.elementKey);
    const elements = await this.prisma.element.findMany({
      where: { branchId: diagram.branchId, key: { in: elementKeys } },
    });
    const elementsByKey = new Map(elements.map((e) => [e.key, e]));

    const hydratedNodes = nodes
      .map((n) => ({ ...n, element: elementsByKey.get(n.elementKey) ?? null }))
      .filter((n) => n.element !== null);

    const edges = await this.prisma.diagramEdge.findMany({
      where: { diagramId },
      orderBy: { updatedAt: 'desc' },
    });

    return { diagram, nodes: hydratedNodes, edges };
  }

  async createNode(dto: CreateDiagramNodeDto) {
    // idempotent: if already placed, just update position
    return this.prisma.diagramNode.upsert({
      where: { diagramId_elementKey: { diagramId: dto.diagramId, elementKey: dto.elementKey } },
      create: {
        diagramId: dto.diagramId,
        elementKey: dto.elementKey,
        x: dto.x ?? 0,
        y: dto.y ?? 0,
      },
      update: {
        x: dto.x ?? undefined,
        y: dto.y ?? undefined,
      },
    });
  }

  async updateNode(nodeId: string, dto: UpdateDiagramNodeDto) {
    const existing = await this.prisma.diagramNode.findUnique({ where: { id: nodeId } });
    if (!existing) throw new NotFoundException('Diagram node not found');
    return this.prisma.diagramNode.update({
      where: { id: nodeId },
      data: {
        x: dto.x ?? undefined,
        y: dto.y ?? undefined,
      },
    });
  }

  async createEdge(dto: CreateDiagramEdgeDto) {
    return this.prisma.diagramEdge.create({
      data: {
        diagramId: dto.diagramId,
        type: dto.type,
        sourceKey: dto.sourceKey,
        targetKey: dto.targetKey,
        attributes: toJson(dto.attributes ?? {}),
      },
    });
  }
}

