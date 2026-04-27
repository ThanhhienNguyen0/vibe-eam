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
exports.IoService = void 0;
const common_1 = require("@nestjs/common");
const sync_1 = require("csv-parse/sync");
const sync_2 = require("csv-stringify/sync");
const prisma_service_1 = require("../prisma/prisma.service");
const to_json_1 = require("../prisma/to-json");
let IoService = class IoService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async exportCsv(branchId) {
        const [elements, relations] = await Promise.all([
            this.prisma.element.findMany({ where: { branchId } }),
            this.prisma.relation.findMany({ where: { branchId } }),
        ]);
        const elementsCsv = (0, sync_2.stringify)(elements.map((e) => ({
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
        })), { header: true });
        const relationsCsv = (0, sync_2.stringify)(relations.map((r) => ({
            key: r.key,
            type: r.type,
            sourceKey: r.sourceKey,
            targetKey: r.targetKey,
            attributes: JSON.stringify(r.attributes ?? {}),
        })), { header: true });
        return { elementsCsv, relationsCsv };
    }
    async importCsv(branchId, elementsCsv, relationsCsv) {
        const elementRows = (0, sync_1.parse)(elementsCsv, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        const relationRows = relationsCsv
            ? (0, sync_1.parse)(relationsCsv, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            })
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
                    attributes: (0, to_json_1.toJson)(attributes),
                };
                if (key) {
                    await tx.element.upsert({
                        where: { branchId_key: { branchId, key } },
                        create: { ...data, key },
                        update: data,
                    });
                }
                else {
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
                    attributes: (0, to_json_1.toJson)(attributes),
                };
                if (key) {
                    await tx.relation.upsert({
                        where: { branchId_key: { branchId, key } },
                        create: { ...data, key },
                        update: data,
                    });
                }
                else {
                    await tx.relation.create({ data });
                }
                upsertedRelations += 1;
            }
            return { upsertedElements, upsertedRelations };
        });
        return result;
    }
};
exports.IoService = IoService;
exports.IoService = IoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IoService);
//# sourceMappingURL=io.service.js.map