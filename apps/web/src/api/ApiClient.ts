import axios from 'axios';
import type { AxiosInstance } from 'axios';

export type Branch = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  forkedAt: string;
  baseBranchId: string | null;
  createdById: string;
};

export type ElementDto = {
  id: string;
  key: string;
  branchId: string;
  name: string;
  archiType: string;
  layer: string;
  documentation: string | null;
  attributes: Record<string, unknown>;
  x: number;
  y: number;
  startDate: string | null;
  endOfLife: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RelationDto = {
  id: string;
  key: string;
  branchId: string;
  type: string;
  sourceKey: string;
  targetKey: string;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type DiagramDto = {
  id: string;
  branchId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export class ApiClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async listBranches(): Promise<Branch[]> {
    const res = await this.http.get<Branch[]>('/branches');
    return res.data;
  }

  async createBranch(input: { name: string; baseBranchId?: string; createdById: string }): Promise<Branch> {
    const res = await this.http.post<Branch>('/branches', input);
    return res.data;
  }

  async mergeBranches(input: { sourceBranchId: string; targetBranchId: string; actorUserId: string }) {
    const res = await this.http.post('/branches/merge', input);
    return res.data as {
      createdElements: number;
      updatedElements: number;
      createdRelations: number;
      updatedRelations: number;
      conflicts: Array<{ kind: 'element' | 'relation'; key: string; reason: string }>;
    };
  }

  async listElements(branchId: string): Promise<ElementDto[]> {
    const res = await this.http.get<ElementDto[]>('/elements', { params: { branchId } });
    return res.data;
  }

  async listElementsByDiagram(branchId: string, diagramId: string): Promise<ElementDto[]> {
    const res = await this.http.get<ElementDto[]>('/elements', { params: { branchId, diagramId } });
    return res.data;
  }

  async createElement(input: {
    branchId: string;
    diagramId?: string;
    name: string;
    archiType: string;
    layer: string;
    x?: number;
    y?: number;
    attributes?: Record<string, unknown>;
  }): Promise<ElementDto> {
    const res = await this.http.post<ElementDto>('/elements', input);
    return res.data;
  }

  async updateElement(id: string, patch: Partial<Pick<ElementDto, 'name' | 'archiType' | 'layer' | 'x' | 'y' | 'attributes'>>) {
    const res = await this.http.patch<ElementDto>(`/elements/${id}`, patch);
    return res.data;
  }

  async deleteElement(id: string) {
    await this.http.delete(`/elements/${id}`);
  }

  async listRelations(branchId: string): Promise<RelationDto[]> {
    const res = await this.http.get<RelationDto[]>('/relations', { params: { branchId } });
    return res.data;
  }

  async listRelationsByDiagram(branchId: string, diagramId: string): Promise<RelationDto[]> {
    const res = await this.http.get<RelationDto[]>('/relations', { params: { branchId, diagramId } });
    return res.data;
  }

  async createRelation(input: {
    branchId: string;
    diagramId?: string;
    type: string;
    sourceKey: string;
    targetKey: string;
    attributes?: Record<string, unknown>;
  }): Promise<RelationDto> {
    const res = await this.http.post<RelationDto>('/relations', input);
    return res.data;
  }

  async deleteRelation(id: string) {
    await this.http.delete(`/relations/${id}`);
  }

  async impact(params: { branchId: string; elementKey: string; direction?: 'downstream' | 'upstream'; maxDepth?: number }) {
    const res = await this.http.get('/analysis/impact', { params });
    return res.data as {
      startKey: string;
      direction: 'downstream' | 'upstream';
      maxDepth: number;
      visitedKeys: string[];
      relations: Array<{ key: string; type: string; sourceKey: string; targetKey: string }>;
    };
  }

  async exportCsv(branchId: string) {
    const res = await this.http.get('/io/export/csv', { params: { branchId } });
    return res.data as { elementsCsv: string; relationsCsv: string };
  }

  async importCsv(input: { branchId: string; elementsCsv: string; relationsCsv?: string }) {
    const res = await this.http.post('/io/import/csv', input);
    return res.data as { upsertedElements: number; upsertedRelations: number };
  }

  async listDiagrams(branchId: string): Promise<DiagramDto[]> {
    const res = await this.http.get<DiagramDto[]>('/diagrams', { params: { branchId } });
    return res.data;
  }

  async createDiagram(input: { branchId: string; name: string }): Promise<DiagramDto> {
    const res = await this.http.post<DiagramDto>('/diagrams', input);
    return res.data;
  }

  async diagramView(diagramId: string) {
    const res = await this.http.get(`/diagrams/${diagramId}/view`);
    return res.data as {
      diagram: DiagramDto;
      nodes: Array<{
        id: string;
        diagramId: string;
        elementKey: string;
        x: number;
        y: number;
        element: ElementDto;
      }>;
      edges: Array<{
        id: string;
        diagramId: string;
        type: string;
        sourceKey: string;
        targetKey: string;
        attributes: Record<string, unknown>;
      }>;
    };
  }

  async placeElement(input: { diagramId: string; elementKey: string; x?: number; y?: number }) {
    const res = await this.http.post('/diagrams/nodes', input);
    return res.data as { id: string; diagramId: string; elementKey: string; x: number; y: number };
  }

  async movePlacedElement(nodeId: string, patch: { x?: number; y?: number }) {
    const res = await this.http.patch(`/diagrams/nodes/${nodeId}`, patch);
    return res.data as { id: string; diagramId: string; elementKey: string; x: number; y: number };
  }

  async createDiagramEdge(input: {
    diagramId: string;
    type: string;
    sourceKey: string;
    targetKey: string;
    attributes?: Record<string, unknown>;
  }) {
    const res = await this.http.post('/diagrams/edges', input);
    return res.data as {
      id: string;
      diagramId: string;
      type: string;
      sourceKey: string;
      targetKey: string;
      attributes: Record<string, unknown>;
    };
  }
}

