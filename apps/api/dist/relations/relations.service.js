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
exports.RelationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const to_json_1 = require("../prisma/to-json");
let RelationsService = class RelationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(branchId) {
        return this.prisma.relation.findMany({
            where: { branchId },
            orderBy: { updatedAt: 'desc' },
        });
    }
    async listByDiagram(branchId, diagramId) {
        return this.prisma.relation.findMany({
            where: { branchId, diagramId },
            orderBy: { updatedAt: 'desc' },
        });
    }
    async get(id) {
        const rel = await this.prisma.relation.findUnique({ where: { id } });
        if (!rel)
            throw new common_1.NotFoundException('Relation not found');
        return rel;
    }
    async create(dto) {
        return this.prisma.relation.create({
            data: {
                branchId: dto.branchId,
                diagramId: dto.diagramId ?? null,
                type: dto.type,
                sourceKey: dto.sourceKey,
                targetKey: dto.targetKey,
                attributes: (0, to_json_1.toJson)(dto.attributes ?? {}),
            },
        });
    }
    async update(id, dto) {
        const existing = await this.prisma.relation.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Relation not found');
        return this.prisma.relation.update({
            where: { id },
            data: {
                type: dto.type ?? undefined,
                sourceKey: dto.sourceKey ?? undefined,
                targetKey: dto.targetKey ?? undefined,
                attributes: dto.attributes ? (0, to_json_1.toJson)(dto.attributes) : undefined,
            },
        });
    }
    async remove(id) {
        const existing = await this.prisma.relation.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Relation not found');
        return this.prisma.relation.delete({ where: { id } });
    }
};
exports.RelationsService = RelationsService;
exports.RelationsService = RelationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RelationsService);
//# sourceMappingURL=relations.service.js.map