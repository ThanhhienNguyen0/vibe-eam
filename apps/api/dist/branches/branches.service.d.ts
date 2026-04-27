import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { MergeBranchDto } from './dto/merge-branch.dto';
type MergeResult = {
    createdElements: number;
    updatedElements: number;
    createdRelations: number;
    updatedRelations: number;
    conflicts: Array<{
        kind: 'element' | 'relation';
        key: string;
        reason: string;
    }>;
};
export declare class BranchesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(): Promise<{
        name: string;
        baseBranchId: string | null;
        createdById: string;
        id: string;
        status: import(".prisma/client").$Enums.BranchStatus;
        createdAt: Date;
        forkedAt: Date;
    }[]>;
    get(id: string): Promise<{
        name: string;
        baseBranchId: string | null;
        createdById: string;
        id: string;
        status: import(".prisma/client").$Enums.BranchStatus;
        createdAt: Date;
        forkedAt: Date;
    }>;
    create(dto: CreateBranchDto): Promise<{
        name: string;
        baseBranchId: string | null;
        createdById: string;
        id: string;
        status: import(".prisma/client").$Enums.BranchStatus;
        createdAt: Date;
        forkedAt: Date;
    }>;
    merge(dto: MergeBranchDto): Promise<MergeResult>;
}
export {};
