import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../prisma/to-json';
import { CreateBranchDto } from './dto/create-branch.dto';
import { MergeBranchDto } from './dto/merge-branch.dto';

type MergeResult = {
  createdElements: number;
  updatedElements: number;
  createdRelations: number;
  updatedRelations: number;
  conflicts: Array<{
    kind: 'element' | 'relation';
    key: string;
    reason: string;
  }>;
};

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.branch.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async get(id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(dto: CreateBranchDto) {
    await this.prisma.user.upsert({
      where: { id: dto.createdById },
      update: {},
      create: {
        id: dto.createdById,
        email: `demo+${dto.createdById}@local`,
        displayName: 'Demo User',
        role: 'ADMIN',
      },
    });

    if (dto.baseBranchId) {
      const base = await this.prisma.branch.findUnique({
        where: { id: dto.baseBranchId },
      });
      if (!base) throw new NotFoundException('Base branch not found');
    }

    return this.prisma.branch.create({
      data: {
        name: dto.name,
        baseBranchId: dto.baseBranchId ?? null,
        createdById: dto.createdById,
        forkedAt: new Date(),
      },
    });
  }

  /**
   * Prototype "git-like" merge:
   * - copies missing elements/relations by key
   * - updates target if only source changed since fork
   * - reports conflicts if both changed since fork
   */
  async merge(dto: MergeBranchDto): Promise<MergeResult> {
    const [source, target] = await Promise.all([
      this.get(dto.sourceBranchId),
      this.get(dto.targetBranchId),
    ]);
    if (target.id === source.id)
      throw new ConflictException('Cannot merge branch into itself');

    const forkBaseId = source.baseBranchId;
    if (!forkBaseId)
      throw new ConflictException('Source branch has no base branch (cannot detect conflicts)');

    const forkedAt = source.forkedAt;

    const conflicts: MergeResult['conflicts'] = [];
    let createdElements = 0;
    let updatedElements = 0;
    let createdRelations = 0;
    let updatedRelations = 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: dto.actorUserId },
        update: {},
        create: {
          id: dto.actorUserId,
          email: `demo+${dto.actorUserId}@local`,
          displayName: 'Demo User',
          role: 'ADMIN',
        },
      });
      const [sourceElements, targetElements] = await Promise.all([
        tx.element.findMany({ where: { branchId: source.id } }),
        tx.element.findMany({ where: { branchId: target.id } }),
      ]);

      const targetByKey = new Map(targetElements.map((e) => [e.key, e]));

      for (const se of sourceElements) {
        const te = targetByKey.get(se.key);
        if (!te) {
          await tx.element.create({
            data: {
              branchId: target.id,
              key: se.key,
              name: se.name,
              archiType: se.archiType,
              layer: se.layer,
              documentation: se.documentation,
              attributes: toJson(se.attributes ?? {}),
              startDate: se.startDate,
              endOfLife: se.endOfLife,
              x: se.x,
              y: se.y,
            },
          });
          createdElements += 1;
          continue;
        }

        const sourceChangedSinceFork = se.updatedAt > forkedAt;
        const targetChangedSinceFork = te.updatedAt > forkedAt;

        if (sourceChangedSinceFork && targetChangedSinceFork) {
          conflicts.push({
            kind: 'element',
            key: se.key,
            reason: 'Element changed in both branches since fork',
          });
          continue;
        }

        if (sourceChangedSinceFork && !targetChangedSinceFork) {
          await tx.element.update({
            where: { id: te.id },
            data: {
              name: se.name,
              archiType: se.archiType,
              layer: se.layer,
              documentation: se.documentation,
              attributes: toJson(se.attributes ?? {}),
              startDate: se.startDate,
              endOfLife: se.endOfLife,
              x: se.x,
              y: se.y,
            },
          });
          updatedElements += 1;
        }
      }

      const [sourceRelations, targetRelations] = await Promise.all([
        tx.relation.findMany({ where: { branchId: source.id } }),
        tx.relation.findMany({ where: { branchId: target.id } }),
      ]);
      const targetRelByKey = new Map(targetRelations.map((r) => [r.key, r]));

      for (const sr of sourceRelations) {
        const tr = targetRelByKey.get(sr.key);
        if (!tr) {
          await tx.relation.create({
            data: {
              branchId: target.id,
              key: sr.key,
              type: sr.type,
              sourceKey: sr.sourceKey,
              targetKey: sr.targetKey,
              attributes: toJson(sr.attributes ?? {}),
            },
          });
          createdRelations += 1;
          continue;
        }

        const sourceChangedSinceFork = sr.updatedAt > forkedAt;
        const targetChangedSinceFork = tr.updatedAt > forkedAt;

        if (sourceChangedSinceFork && targetChangedSinceFork) {
          conflicts.push({
            kind: 'relation',
            key: sr.key,
            reason: 'Relation changed in both branches since fork',
          });
          continue;
        }

        if (sourceChangedSinceFork && !targetChangedSinceFork) {
          await tx.relation.update({
            where: { id: tr.id },
            data: {
              type: sr.type,
              sourceKey: sr.sourceKey,
              targetKey: sr.targetKey,
              attributes: toJson(sr.attributes ?? {}),
            },
          });
          updatedRelations += 1;
        }
      }

      await tx.auditEvent.create({
        data: {
          branchId: target.id,
          actorUserId: dto.actorUserId,
          action: 'MERGE',
          entityType: 'branch',
          entityKey: target.id,
          before: { sourceBranchId: source.id },
          after: {
            createdElements,
            updatedElements,
            createdRelations,
            updatedRelations,
            conflicts,
          },
        },
      });
    });

    return {
      createdElements,
      updatedElements,
      createdRelations,
      updatedRelations,
      conflicts,
    };
  }
}

