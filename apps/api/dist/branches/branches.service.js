"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const to_json_1 = require("../prisma/to-json");
let BranchesService = class BranchesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list() {
        return this.prisma.branch.findMany({ orderBy: { createdAt: 'desc' } });
    }
    async get(id) {
        const branch = await this.prisma.branch.findUnique({ where: { id } });
        if (!branch)
            throw new common_1.NotFoundException('Branch not found');
        return branch;
    }
    async create(dto) {
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
            if (!base)
                throw new common_1.NotFoundException('Base branch not found');
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
    async merge(dto) {
        const [source, target] = await Promise.all([
            this.get(dto.sourceBranchId),
            this.get(dto.targetBranchId),
        ]);
        if (target.id === source.id)
            throw new common_1.ConflictException('Cannot merge branch into itself');
        const forkBaseId = source.baseBranchId;
        if (!forkBaseId)
            throw new common_1.ConflictException('Source branch has no base branch (cannot detect conflicts)');
        const forkedAt = source.forkedAt;
        const conflicts = [];
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
                            attributes: (0, to_json_1.toJson)(se.attributes ?? {}),
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
                            attributes: (0, to_json_1.toJson)(se.attributes ?? {}),
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
                            attributes: (0, to_json_1.toJson)(sr.attributes ?? {}),
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
                            attributes: (0, to_json_1.toJson)(sr.attributes ?? {}),
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
};
exports.BranchesService = BranchesService;
exports.BranchesService = BranchesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BranchesService);
//# sourceMappingURL=branches.service.js.map