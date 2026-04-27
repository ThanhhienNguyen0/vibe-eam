import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../prisma/to-json';
import { CreateElementDto } from './dto/create-element.dto';
import { UpdateElementDto } from './dto/update-element.dto';

@Injectable()
export class ElementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(branchId: string) {
    return this.prisma.element.findMany({
      where: { branchId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listByDiagram(branchId: string, diagramId: string) {
    return this.prisma.element.findMany({
      where: { branchId, diagramId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(id: string) {
    const el = await this.prisma.element.findUnique({ where: { id } });
    if (!el) throw new NotFoundException('Element not found');
    return el;
  }

  async create(dto: CreateElementDto) {
    return this.prisma.element.create({
      data: {
        branchId: dto.branchId,
        diagramId: dto.diagramId ?? null,
        name: dto.name,
        archiType: dto.archiType,
        layer: dto.layer,
        documentation: dto.documentation ?? null,
        attributes: toJson(dto.attributes ?? {}),
        x: dto.x ?? 0,
        y: dto.y ?? 0,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endOfLife: dto.endOfLife ? new Date(dto.endOfLife) : null,
      },
    });
  }

  async update(id: string, dto: UpdateElementDto) {
    const existing = await this.prisma.element.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Element not found');

    return this.prisma.element.update({
      where: { id },
      data: {
        diagramId: dto.diagramId ?? undefined,
        name: dto.name ?? undefined,
        archiType: dto.archiType ?? undefined,
        layer: dto.layer ?? undefined,
        documentation: dto.documentation ?? undefined,
        attributes: dto.attributes ? toJson(dto.attributes) : undefined,
        x: dto.x ?? undefined,
        y: dto.y ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endOfLife: dto.endOfLife ? new Date(dto.endOfLife) : undefined,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.element.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Element not found');

    return this.prisma.element.delete({ where: { id } });
  }
}

