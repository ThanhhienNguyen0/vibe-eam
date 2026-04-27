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
exports.AnalysisService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AnalysisService = class AnalysisService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async impact(params) {
        const start = await this.prisma.element.findUnique({
            where: { branchId_key: { branchId: params.branchId, key: params.elementKey } },
            select: { key: true },
        });
        if (!start)
            throw new common_1.NotFoundException('Start element not found in branch');
        const rels = await this.prisma.relation.findMany({
            where: { branchId: params.branchId },
            select: { key: true, type: true, sourceKey: true, targetKey: true },
        });
        const nextMap = new Map();
        const edgeByPair = new Map();
        for (const r of rels) {
            const from = params.direction === 'downstream' ? r.sourceKey : r.targetKey;
            const to = params.direction === 'downstream' ? r.targetKey : r.sourceKey;
            const arr = nextMap.get(from) ?? [];
            arr.push(to);
            nextMap.set(from, arr);
            const pairKey = `${from}::${to}`;
            const edges = edgeByPair.get(pairKey) ?? [];
            edges.push({ key: r.key, type: r.type, sourceKey: r.sourceKey, targetKey: r.targetKey });
            edgeByPair.set(pairKey, edges);
        }
        const maxDepth = Math.max(1, Math.min(50, params.maxDepth));
        const visited = new Set();
        const queue = [{ key: params.elementKey, depth: 0 }];
        visited.add(params.elementKey);
        while (queue.length) {
            const cur = queue.shift();
            if (cur.depth >= maxDepth)
                continue;
            const next = nextMap.get(cur.key) ?? [];
            for (const nk of next) {
                if (visited.has(nk))
                    continue;
                visited.add(nk);
                queue.push({ key: nk, depth: cur.depth + 1 });
            }
        }
        const visitedKeys = Array.from(visited);
        const visitedSet = new Set(visitedKeys);
        const usedEdges = [];
        for (const r of rels) {
            if (!visitedSet.has(r.sourceKey) || !visitedSet.has(r.targetKey))
                continue;
            usedEdges.push(r);
        }
        return {
            startKey: params.elementKey,
            direction: params.direction,
            maxDepth,
            visitedKeys,
            relations: usedEdges,
        };
    }
};
exports.AnalysisService = AnalysisService;
exports.AnalysisService = AnalysisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalysisService);
//# sourceMappingURL=analysis.service.js.map