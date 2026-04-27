import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../prisma/to-json';

type ElementRow = {
  key?: string;
  name: string;
  archiType: string;
  layer: string;
  documentation?: string;
  x?: string;
  y?: string;
  startDate?: string;
  endOfLife?: string;
  attributes?: string;
};

type RelationRow = {
  key?: string;
  type: string;
  sourceKey: string;
  targetKey: string;
  attributes?: string;
};

@Injectable()
export class IoService {
  constructor(private readonly prisma: PrismaService) {}

  async exportCsv(branchId: string) {
    const [elements, relations] = await Promise.all([
      this.prisma.element.findMany({ where: { branchId } }),
      this.prisma.relation.findMany({ where: { branchId } }),
    ]);

    const elementsCsv = stringify(
      elements.map((e) => ({
        key: e.key,
        name: e.name,
        archiType: e.archiType,
        layer: e.layer,
        documentation: e.documentation ?? '',
        x: e.x,
        y: e.y,
        startDate: e.startDate?.toISOString() ?? '',
        endOfLife: e.endOfLife?.toISOString() ?? '',
        attributes: JSON.stringify(e.attributes ?? {}),
      })),
      { header: true },
    );

    const relationsCsv = stringify(
      relations.map((r) => ({
        key: r.key,
        type: r.type,
        sourceKey: r.sourceKey,
        targetKey: r.targetKey,
        attributes: JSON.stringify(r.attributes ?? {}),
      })),
      { header: true },
    );

    return { elementsCsv, relationsCsv };
  }

  async importCsv(branchId: string, elementsCsv: string, relationsCsv?: string) {
    const elementRows = parse(elementsCsv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as ElementRow[];

    const relationRows = relationsCsv
      ? (parse(relationsCsv, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as RelationRow[])
      : [];

    const result = await this.prisma.$transaction(async (tx) => {
      let upsertedElements = 0;
      let upsertedRelations = 0;

      for (const row of elementRows) {
        const key = row.key?.trim();
        const attributes = row.attributes ? JSON.parse(row.attributes) : {};
        const data = {
          branchId,
          name: row.name,
          archiType: row.archiType,
          layer: row.layer,
          documentation: row.documentation?.trim() ? row.documentation : null,
          x: row.x ? Number(row.x) : 0,
          y: row.y ? Number(row.y) : 0,
          startDate: row.startDate?.trim() ? new Date(row.startDate) : null,
          endOfLife: row.endOfLife?.trim() ? new Date(row.endOfLife) : null,
          attributes: toJson(attributes),
        } as const;

        if (key) {
          await tx.element.upsert({
            where: { branchId_key: { branchId, key } },
            create: { ...data, key },
            update: data,
          });
        } else {
          await tx.element.create({ data });
        }

        upsertedElements += 1;
      }

      for (const row of relationRows) {
        const key = row.key?.trim();
        const attributes = row.attributes ? JSON.parse(row.attributes) : {};
        const data = {
          branchId,
          type: row.type,
          sourceKey: row.sourceKey,
          targetKey: row.targetKey,
          attributes: toJson(attributes),
        } as const;

        if (key) {
          await tx.relation.upsert({
            where: { branchId_key: { branchId, key } },
            create: { ...data, key },
            update: data,
          });
        } else {
          await tx.relation.create({ data });
        }

        upsertedRelations += 1;
      }

      return { upsertedElements, upsertedRelations };
    });

    return result;
  }
}

