"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElementsModule = void 0;
const common_1 = require("@nestjs/common");
const elements_controller_1 = require("./elements.controller");
const elements_service_1 = require("./elements.service");
let ElementsModule = class ElementsModule {
};
exports.ElementsModule = ElementsModule;
exports.ElementsModule = ElementsModule = __decorate([
    (0, common_1.Module)({
        controllers: [elements_controller_1.ElementsController],
        providers: [elements_service_1.ElementsService],
    })
], ElementsModule);
//# sourceMappingURL=elements.module.js.map