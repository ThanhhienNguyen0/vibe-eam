import { AnalysisService } from './analysis.service';
export declare class AnalysisController {
    private readonly analysis;
    constructor(analysis: AnalysisService);
    impact(branchId: string, elementKey: string, direction?: string, maxDepth?: string): Promise<import("./analysis.service").ImpactResult>;
}
