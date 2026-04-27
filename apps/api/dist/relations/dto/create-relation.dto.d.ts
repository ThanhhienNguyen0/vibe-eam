export declare class CreateRelationDto {
    branchId: string;
    diagramId?: string;
    type: string;
    sourceKey: string;
    targetKey: string;
    attributes?: Record<string, unknown>;
}
