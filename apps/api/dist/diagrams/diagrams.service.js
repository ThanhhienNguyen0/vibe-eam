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
exports.DiagramsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const to_json_1 = require("../prisma/to-json");
let DiagramsService = class DiagramsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(branchId) {
        return this.prisma.diagram.findMany({
            where: { branchId },
            orderBy: { updatedAt: 'desc' },
        });
    }
    async get(id) {
        const d = await this.prisma.diagram.findUnique({ where: { id } });
        if (!d)
            throw new common_1.NotFoundException('Diagram not found');
        return d;
    }
    async create(dto) {
        return this.prisma.diagram.create({
            data: {
                branchId: dto.branchId,
                name: dto.name,
            },
        });
    }
    async remove(id) {
        await this.get(id);
        return this.prisma.diagram.delete({ where: { id } });
    }
    async getView(diagramId) {
        const diagram = await this.prisma.diagram.findUnique({ where: { id: diagramId } });
        if (!diagram)
            throw new common_1.NotFoundException('Diagram not found');
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
    async createNode(dto) {
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
    async updateNode(nodeId, dto) {
        const existing = await this.prisma.diagramNode.findUnique({ where: { id: nodeId } });
        if (!existing)
            throw new common_1.NotFoundException('Diagram node not found');
        return this.prisma.diagramNode.update({
            where: { id: nodeId },
            data: {
                x: dto.x ?? undefined,
                y: dto.y ?? undefined,
            },
        });
    }
    async createEdge(dto) {
        return this.prisma.diagramEdge.create({
            data: {
                diagramId: dto.diagramId,
                type: dto.type,
                sourceKey: dto.sourceKey,
                targetKey: dto.targetKey,
                attributes: (0, to_json_1.toJson)(dto.attributes ?? {}),
            },
        });
    }
};
exports.DiagramsService = DiagramsService;
exports.DiagramsService = DiagramsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DiagramsService);
//# sourceMappingURL=diagrams.service.js.map