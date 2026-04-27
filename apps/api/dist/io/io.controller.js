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
exports.IoController = void 0;
const common_1 = require("@nestjs/common");
const import_csv_dto_1 = require("./dto/import-csv.dto");
const io_service_1 = require("./io.service");
let IoController = class IoController {
    io;
    constructor(io) {
        this.io = io;
    }
    async exportCsv(branchId) {
        return this.io.exportCsv(branchId);
    }
    async importCsv(dto) {
        return this.io.importCsv(dto.branchId, dto.elementsCsv, dto.relationsCsv);
    }
};
exports.IoController = IoController;
__decorate([
    (0, common_1.Get)('export/csv'),
    __param(0, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], IoController.prototype, "exportCsv", null);
__decorate([
    (0, common_1.Post)('import/csv'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [import_csv_dto_1.ImportCsvDto]),
    __metadata("design:returntype", Promise)
], IoController.prototype, "importCsv", null);
exports.IoController = IoController = __decorate([
    (0, common_1.Controller)('io'),
    __metadata("design:paramtypes", [io_service_1.IoService])
], IoController);
//# sourceMappingURL=io.controller.js.map