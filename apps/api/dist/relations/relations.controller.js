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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationsController = void 0;
const common_1 = require("@nestjs/common");
const relations_service_1 = require("./relations.service");
const create_relation_dto_1 = require("./dto/create-relation.dto");
const update_relation_dto_1 = require("./dto/update-relation.dto");
let RelationsController = class RelationsController {
    relations;
    constructor(relations) {
        this.relations = relations;
    }
    async list(branchId, diagramId) {
        if (diagramId)
            return this.relations.listByDiagram(branchId, diagramId);
        return this.relations.list(branchId);
    }
    async get(id) {
        return this.relations.get(id);
    }
    async create(dto) {
        return this.relations.create(dto);
    }
    async update(id, dto) {
        return this.relations.update(id, dto);
    }
    async remove(id) {
        return this.relations.remove(id);
    }
};
exports.RelationsController = RelationsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('branchId')),
    __param(1, (0, common_1.Query)('diagramId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RelationsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RelationsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_relation_dto_1.CreateRelationDto]),
    __metadata("design:returntype", Promise)
], RelationsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_relation_dto_1.UpdateRelationDto]),
    __metadata("design:returntype", Promise)
], RelationsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RelationsController.prototype, "remove", null);
exports.RelationsController = RelationsController = __decorate([
    (0, common_1.Controller)('relations'),
    __metadata("design:paramtypes", [relations_service_1.RelationsService])
], RelationsController);
//# sourceMappingURL=relations.controller.js.map