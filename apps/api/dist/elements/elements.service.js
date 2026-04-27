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
exports.ElementsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const to_json_1 = require("../prisma/to-json");
let ElementsService = class ElementsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(branchId) {
        return this.prisma.element.findMany({
            where: { branchId },
            orderBy: { updatedAt: 'desc' },
        });
    }
    async listByDiagram(branchId, diagramId) {
        return this.prisma.element.findMany({
            where: { branchId, diagramId },
            orderBy: { updatedAt: 'desc' },
        });
    }
    async get(id) {
        const el = await this.prisma.element.findUnique({ where: { id } });
        if (!el)
            throw new common_1.NotFoundException('Element not found');
        return el;
    }
    async create(dto) {
        return this.prisma.element.create({
            data: {
                branchId: dto.branchId,
                diagramId: dto.diagramId ?? null,
                name: dto.name,
                archiType: dto.archiType,
                layer: dto.layer,
                documentation: dto.documentation ?? null,
                attributes: (0, to_json_1.toJson)(dto.attributes ?? {}),
                x: dto.x ?? 0,
                y: dto.y ?? 0,
                startDate: dto.startDate ? new Date(dto.startDate) : null,
                endOfLife: dto.endOfLife ? new Date(dto.endOfLife) : null,
            },
        });
    }
    async update(id, dto) {
        const existing = await this.prisma.element.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Element not found');
        return this.prisma.element.update({
            where: { id },
            data: {
                diagramId: dto.diagramId ?? undefined,
                name: dto.name ?? undefined,
                archiType: dto.archiType ?? undefined,
                layer: dto.layer ?? undefined,
                documentation: dto.documentation ?? undefined,
                attributes: dto.attributes ? (0, to_json_1.toJson)(dto.attributes) : undefined,
                x: dto.x ?? undefined,
                y: dto.y ?? undefined,
                startDate: dto.startDate ? new Date(dto.startDate) : undefined,
                endOfLife: dto.endOfLife ? new Date(dto.endOfLife) : undefined,
            },
        });
    }
    async remove(id) {
        const existing = await this.prisma.element.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Element not found');
        return this.prisma.element.delete({ where: { id } });
    }
};
exports.ElementsService = ElementsService;
exports.ElementsService = ElementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ElementsService);
//# sourceMappingURL=elements.service.js.map