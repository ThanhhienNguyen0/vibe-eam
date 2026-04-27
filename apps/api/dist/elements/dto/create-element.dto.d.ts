export declare class CreateElementDto {
    branchId: string;
    diagramId?: string;
    name: string;
    archiType: string;
    layer: string;
    documentation?: string;
    attributes?: Record<string, unknown>;
    x?: number;
    y?: number;
    startDate?: string;
    endOfLife?: string;
}
