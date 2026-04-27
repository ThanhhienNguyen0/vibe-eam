import { PrismaService } from '../prisma/prisma.service';
export declare class IoService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    exportCsv(branchId: string): Promise<{
        elementsCsv: string;
        relationsCsv: string;
    }>;
    importCsv(branchId: string, elementsCsv: string, relationsCsv?: string): Promise<{
        upsertedElements: number;
        upsertedRelations: number;
    }>;
}
