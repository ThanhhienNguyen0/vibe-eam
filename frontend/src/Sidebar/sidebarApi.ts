import type {
  ComponentInstance,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram,
  SidebarState
} from "./sidebarTypes";

const BASE = "/api/sidebar";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const sidebarApi = {
  getAll: () => request<SidebarState>(`${BASE}/`),

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
  updateDiagram: (id: string, data: Partial<Diagram>) =>
    request<Diagram>(`${BASE}/diagrams/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteDiagram: (id: string) =>
    request<void>(`${BASE}/diagrams/${id}`, { method: "DELETE" })
};
