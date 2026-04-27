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
exports.CreateDiagramEdgeDto = void 0;
const class_validator_1 = require("class-validator");
class CreateDiagramEdgeDto {
    diagramId;
    type;
    sourceKey;
    targetKey;
    attributes;
}
exports.CreateDiagramEdgeDto = CreateDiagramEdgeDto;
__decorate([
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], CreateDiagramEdgeDto.prototype, "diagramId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 120),
    __metadata("design:type", String)
], CreateDiagramEdgeDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], CreateDiagramEdgeDto.prototype, "sourceKey", void 0);
__decorate([
    (0, class_validator_1.IsUUID)('all'),
    __metadata("design:type", String)
], CreateDiagramEdgeDto.prototype, "targetKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateDiagramEdgeDto.prototype, "attributes", void 0);
//# sourceMappingURL=create-edge.dto.js.map