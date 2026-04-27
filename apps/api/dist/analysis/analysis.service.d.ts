import { PrismaService } from '../prisma/prisma.service';
export type ImpactDirection = 'downstream' | 'upstream';
export type ImpactResult = {
    startKey: string;
    direction: ImpactDirection;
    maxDepth: number;
    visitedKeys: string[];
    relations: Array<{
        key: string;
        type: string;
        sourceKey: string;
        targetKey: string;
    }>;
};
export declare class AnalysisService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    impact(params: {
        branchId: string;
        elementKey: string;
        direction: ImpactDirection;
        maxDepth: number;
    }): Promise<ImpactResult>;
}
