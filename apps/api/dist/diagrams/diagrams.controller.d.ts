import { CreateDiagramDto } from './dto/create-diagram.dto';
import { DiagramsService } from './diagrams.service';
import { CreateDiagramEdgeDto } from './dto/create-edge.dto';
import { CreateDiagramNodeDto } from './dto/create-node.dto';
import { UpdateDiagramNodeDto } from './dto/update-node.dto';
export declare class DiagramsController {
    private readonly diagrams;
    constructor(diagrams: DiagramsService);
    list(branchId: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        branchId: string;
        updatedAt: Date;
    }[]>;
    get(id: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        branchId: string;
        updatedAt: Date;
    }>;
    create(dto: CreateDiagramDto): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        branchId: string;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        branchId: string;
        updatedAt: Date;
    }>;
    view(id: string): Promise<{
        diagram: {
            name: string;
            id: string;
            createdAt: Date;
            branchId: string;
            updatedAt: Date;
        };
        nodes: {
            element: {
                name: string;
                id: string;
                createdAt: Date;
                key: string;
                branchId: string;
                diagramId: string | null;
                archiType: string;
                layer: string;
                documentation: string | null;
                attributes: import("@prisma/client/runtime/library").JsonValue;
                x: number;
                y: number;
                startDate: Date | null;
                endOfLife: Date | null;
                updatedAt: Date;
            } | null;
            id: string;
            createdAt: Date;
            diagramId: string;
            x: number;
            y: number;
            updatedAt: Date;
            elementKey: string;
        }[];
        edges: {
            id: string;
            createdAt: Date;
            diagramId: string;
            attributes: import("@prisma/client/runtime/library").JsonValue;
            updatedAt: Date;
            type: string;
            sourceKey: string;
            targetKey: string;
        }[];
    }>;
    createNode(dto: CreateDiagramNodeDto): Promise<{
        id: string;
        createdAt: Date;
        diagramId: string;
        x: number;
        y: number;
        updatedAt: Date;
        elementKey: string;
    }>;
    updateNode(nodeId: string, dto: UpdateDiagramNodeDto): Promise<{
        id: string;
        createdAt: Date;
        diagramId: string;
        x: number;
        y: number;
        updatedAt: Date;
        elementKey: string;
    }>;
    createEdge(dto: CreateDiagramEdgeDto): Promise<{
        id: string;
        createdAt: Date;
        diagramId: string;
        attributes: import("@prisma/client/runtime/library").JsonValue;
        updatedAt: Date;
        type: string;
        sourceKey: string;
        targetKey: string;
    }>;
}
