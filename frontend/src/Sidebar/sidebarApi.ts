import type {
  ComponentInstance,
  ConnectionRule,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram,
  MetamodelDefinition,
  MetamodelImportResult,
  SidebarState,
  Viewpoint
} from "./sidebarTypes";
import type { DiagramValidationResult } from "./metamodelRules";
import { clearAuthToken, getAuthToken } from "../authApi";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/sidebar";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  });
  if (res.status === 401) {
    clearAuthToken();
    window.dispatchEvent(new Event("eam:unauthorized"));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const sidebarApi = {
  getAll: () => request<SidebarState>(`${BASE}/`),

  exportMetamodel: () =>
    request<MetamodelDefinition>(`${BASE}/metamodel/export`),
  getDefaultMetamodel: () =>
    request<MetamodelDefinition>(`${BASE}/metamodel/default`),
  importMetamodel: (data: unknown) =>
    request<MetamodelImportResult>(`${BASE}/metamodel/import`, { method: "POST", body: JSON.stringify(data) }),

  // Component Types
  createComponentType: (data: Omit<ComponentType, "id">) =>
    request<ComponentType>(`${BASE}/component-types`, { method: "POST", body: JSON.stringify(data) }),
  updateComponentType: (id: string, data: Partial<ComponentType>) =>
    request<ComponentType>(`${BASE}/component-types/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteComponentType: (id: string) =>
    request<void>(`${BASE}/component-types/${id}`, { method: "DELETE" }),

  // Connection Types
  createConnectionType: (data: Omit<ConnectionType, "id">) =>
    request<ConnectionType>(`${BASE}/connection-types`, { method: "POST", body: JSON.stringify(data) }),
  updateConnectionType: (id: string, data: Partial<ConnectionType>) =>
    request<ConnectionType>(`${BASE}/connection-types/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteConnectionType: (id: string) =>
    request<void>(`${BASE}/connection-types/${id}`, { method: "DELETE" }),

  // Connection Rules
  createConnectionRule: (data: Omit<ConnectionRule, "id">) =>
    request<ConnectionRule>(`${BASE}/connection-rules`, { method: "POST", body: JSON.stringify(data) }),
  updateConnectionRule: (id: string, data: Partial<ConnectionRule>) =>
    request<ConnectionRule>(`${BASE}/connection-rules/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteConnectionRule: (id: string) =>
    request<void>(`${BASE}/connection-rules/${id}`, { method: "DELETE" }),

  // Viewpoints
  createViewpoint: (data: Omit<Viewpoint, "id">) =>
    request<Viewpoint>(`${BASE}/viewpoints`, { method: "POST", body: JSON.stringify(data) }),
  updateViewpoint: (id: string, data: Partial<Viewpoint>) =>
    request<Viewpoint>(`${BASE}/viewpoints/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteViewpoint: (id: string) =>
    request<void>(`${BASE}/viewpoints/${id}`, { method: "DELETE" }),

  // Components
  createComponent: (data: Omit<ComponentInstance, "id">) =>
    request<ComponentInstance>(`${BASE}/components`, { method: "POST", body: JSON.stringify(data) }),
  updateComponent: (id: string, data: Partial<ComponentInstance>) =>
    request<ComponentInstance>(`${BASE}/components/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteComponent: (id: string) =>
    request<void>(`${BASE}/components/${id}`, { method: "DELETE" }),

  // Connections
  createConnection: (data: Omit<ConnectionInstance, "id">) =>
    request<ConnectionInstance>(`${BASE}/connections`, { method: "POST", body: JSON.stringify(data) }),
  updateConnection: (id: string, data: Partial<ConnectionInstance>) =>
    request<ConnectionInstance>(`${BASE}/connections/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteConnection: (id: string) =>
    request<void>(`${BASE}/connections/${id}`, { method: "DELETE" }),

  // Diagrams
  createDiagram: (data: { name: string; description?: string }) =>
    request<Diagram>(`${BASE}/diagrams`, { method: "POST", body: JSON.stringify(data) }),
  createDiagramConnection: (diagramId: string, data: Omit<ConnectionInstance, "id">) =>
    request<{ connection: ConnectionInstance; diagram: Diagram; created: boolean }>(`${BASE}/diagrams/${diagramId}/connections`, { method: "POST", body: JSON.stringify(data) }),
  updateDiagram: (id: string, data: Partial<Diagram>) =>
    request<Diagram>(`${BASE}/diagrams/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  validateDiagram: (id: string) =>
    request<DiagramValidationResult>(`${BASE}/diagrams/${id}/validate`),
  deleteDiagram: (id: string) =>
    request<void>(`${BASE}/diagrams/${id}`, { method: "DELETE" })
};
