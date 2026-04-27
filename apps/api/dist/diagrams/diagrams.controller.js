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
exports.DiagramsController = void 0;
const common_1 = require("@nestjs/common");
const create_diagram_dto_1 = require("./dto/create-diagram.dto");
const diagrams_service_1 = require("./diagrams.service");
const create_edge_dto_1 = require("./dto/create-edge.dto");
const create_node_dto_1 = require("./dto/create-node.dto");
const update_node_dto_1 = require("./dto/update-node.dto");
let DiagramsController = class DiagramsController {
    diagrams;
    constructor(diagrams) {
        this.diagrams = diagrams;
    }
    async list(branchId) {
        return this.diagrams.list(branchId);
    }
    async get(id) {
        return this.diagrams.get(id);
    }
    async create(dto) {
        return this.diagrams.create(dto);
    }
    async remove(id) {
        return this.diagrams.remove(id);
    }
    async view(id) {
        return this.diagrams.getView(id);
    }
    async createNode(dto) {
        return this.diagrams.createNode(dto);
    }
    async updateNode(nodeId, dto) {
        return this.diagrams.updateNode(nodeId, dto);
    }
    async createEdge(dto) {
        return this.diagrams.createEdge(dto);
    }
};
exports.DiagramsController = DiagramsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiagramsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiagramsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_diagram_dto_1.CreateDiagramDto]),
    __metadata("design:returntype", Promise)
], DiagramsController.prototype, "create", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiagramsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/view'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiagramsController.prototype, "view", null);
__decorate([
    (0, common_1.Post)('nodes'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_node_dto_1.CreateDiagramNodeDto]),
    __metadata("design:returntype", Promise)
], DiagramsController.prototype, "createNode", null);
__decorate([
    (0, common_1.Patch)('nodes/:nodeId'),
    __param(0, (0, common_1.Param)('nodeId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_node_dto_1.UpdateDiagramNodeDto]),
    __metadata("design:returntype", Promise)
], DiagramsController.prototype, "updateNode", null);
__decorate([
    (0, common_1.Post)('edges'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_edge_dto_1.CreateDiagramEdgeDto]),
    __metadata("design:returntype", Promise)
], DiagramsController.prototype, "createEdge", null);
exports.DiagramsController = DiagramsController = __decorate([
    (0, common_1.Controller)('diagrams'),
    __metadata("design:paramtypes", [diagrams_service_1.DiagramsService])
], DiagramsController);
//# sourceMappingURL=diagrams.controller.js.map