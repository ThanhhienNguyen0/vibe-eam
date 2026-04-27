import { PrismaService } from '../prisma/prisma.service';
import { CreateRelationDto } from './dto/create-relation.dto';
import { UpdateRelationDto } from './dto/update-relation.dto';
export declare class RelationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(branchId: string): Promise<{
        id: string;
        createdAt: Date;
        key: string;
        branchId: string;
        diagramId: string | null;
        attributes: import("@prisma/client/runtime/library").JsonValue;
        updatedAt: Date;
        type: string;
        sourceKey: string;
        targetKey: string;
    }[]>;
    listByDiagram(branchId: string, diagramId: string): Promise<{
        id: string;
        createdAt: Date;
        key: string;
        branchId: string;
        diagramId: string | null;
        attributes: import("@prisma/client/runtime/library").JsonValue;
        updatedAt: Date;
        type: string;
        sourceKey: string;
        targetKey: string;
    }[]>;
    get(id: string): Promise<{
        id: string;
        createdAt: Date;
        key: string;
        branchId: string;
        diagramId: string | null;
        attributes: import("@prisma/client/runtime/library").JsonValue;
        updatedAt: Date;
        type: string;
        sourceKey: string;
        targetKey: string;
    }>;
    create(dto: CreateRelationDto): Promise<{
        id: string;
        createdAt: Date;
        key: string;
        branchId: string;
        diagramId: string | null;
        attributes: import("@prisma/client/runtime/library").JsonValue;
        updatedAt: Date;
        type: string;
        sourceKey: string;
        targetKey: string;
    }>;
    update(id: string, dto: UpdateRelationDto): Promise<{
        id: string;
        createdAt: Date;
        key: string;
        branchId: string;
        diagramId: string | null;
        attributes: import("@prisma/client/runtime/library").JsonValue;
        updatedAt: Date;
        type: string;
        sourceKey: string;
        targetKey: string;
    }>;
    remove(id: string): Promise<{
        id: string;
        createdAt: Date;
        key: string;
        branchId: string;
        diagramId: string | null;
        attributes: import("@prisma/client/runtime/library").JsonValue;
        updatedAt: Date;
        type: string;
        sourceKey: string;
        targetKey: string;
    }>;
}
