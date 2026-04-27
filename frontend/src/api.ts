import type { AuditLogEntry, EamElement, EamModel, EamRelation } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    const message = payload.errors?.join(" ") ?? payload.error ?? "Request failed.";
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  getModel: () => request<EamModel>("/api/model"),
  createElement: (element: Partial<EamElement>) =>
    request<{ element: EamElement; model: EamModel }>("/api/model/elements", {
      method: "POST",
      body: JSON.stringify(element)
    }),
  updateElement: (id: string, patch: Partial<EamElement>) =>
    request<EamElement>(`/api/model/elements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    }),
  deleteElement: (id: string) =>
    request<void>(`/api/model/elements/${id}`, {
      method: "DELETE"
    }),
  createRelation: (relation: Partial<EamRelation>) =>
    request<{ relation: EamRelation; model: EamModel }>("/api/model/relations", {
      method: "POST",
      body: JSON.stringify(relation)
    }),
  deleteRelation: (id: string) =>
    request<void>(`/api/model/relations/${id}`, {
      method: "DELETE"
    }),
  importModel: (model: EamModel) =>
    request<EamModel>("/api/model/import", {
      method: "POST",
      body: JSON.stringify(model)
    }),
  exportModel: () => request<EamModel>("/api/model/export"),
  getAuditLog: () => request<AuditLogEntry[]>("/api/audit-log")
};
