import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../prisma/to-json';
import { CreateRelationDto } from './dto/create-relation.dto';
import { UpdateRelationDto } from './dto/update-relation.dto';

@Injectable()
export class RelationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(branchId: string) {
    return this.prisma.relation.findMany({
      where: { branchId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listByDiagram(branchId: string, diagramId: string) {
    return this.prisma.relation.findMany({
      where: { branchId, diagramId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(id: string) {
    const rel = await this.prisma.relation.findUnique({ where: { id } });
    if (!rel) throw new NotFoundException('Relation not found');
    return rel;
  }

  async create(dto: CreateRelationDto) {
    return this.prisma.relation.create({
      data: {
        branchId: dto.branchId,
        diagramId: dto.diagramId ?? null,
        type: dto.type,
        sourceKey: dto.sourceKey,
        targetKey: dto.targetKey,
        attributes: toJson(dto.attributes ?? {}),
      },
    });
  }

  async update(id: string, dto: UpdateRelationDto) {
    const existing = await this.prisma.relation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Relation not found');

    return this.prisma.relation.update({
      where: { id },
      data: {
        type: dto.type ?? undefined,
        sourceKey: dto.sourceKey ?? undefined,
        targetKey: dto.targetKey ?? undefined,
        attributes: dto.attributes ? toJson(dto.attributes) : undefined,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.relation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Relation not found');
    return this.prisma.relation.delete({ where: { id } });
  }
}

