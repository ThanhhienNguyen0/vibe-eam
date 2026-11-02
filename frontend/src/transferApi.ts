import { ApiError, apiRequest, getAuthToken, handleAuthStatus } from "./authApi";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/sidebar";

export type TransferFormat = "xlsx" | "csv";
export type TransferSheet = "elements" | "relations";
export type RowStatus = "new" | "changed" | "unchanged" | "error";

export interface FieldChange { field: string; from: string; to: string }

export interface PlannedRow {
  sheet: TransferSheet;
  row: number;
  status: RowStatus;
  id?: string;
  label: string;
  changes: FieldChange[];
  errors: string[];
  warnings: string[];
}

export interface SheetSummary { new: number; changed: number; unchanged: number; error: number }

export interface ImportPreview {
  fileName: string;
  format: TransferFormat;
  summary: Record<TransferSheet, SheetSummary>;
  errorCount: number;
  applicableRows: number;
  fileErrors: string[];
  fileWarnings: string[];
  rows: PlannedRow[];
  canCommit: boolean;
  canCommitValidOnly: boolean;
  applied?: boolean;
}

export interface AuditEntry {
  id: string;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  summary: string;
  details: Record<string, unknown>;
}

export interface ExportParams {
  format: TransferFormat;
  /** Export a saved catalog (its types, properties and columns). */
  catalogId?: string;
  sheet?: TransferSheet;
  typeIds?: string[];
  connectionTypeIds?: string[];
  query?: string;
}

export function buildExportQuery(params: ExportParams): string {
  const search = new URLSearchParams({ format: params.format });
  if (params.catalogId) search.set("catalogId", params.catalogId);
  if (params.sheet) search.set("sheet", params.sheet);
  if (params.typeIds && params.typeIds.length > 0) search.set("typeIds", params.typeIds.join(","));
  if (params.connectionTypeIds && params.connectionTypeIds.length > 0) search.set("connectionTypeIds", params.connectionTypeIds.join(","));
  if (params.query?.trim()) search.set("q", params.query.trim());
  return search.toString();
}

async function errorFrom(response: Response): Promise<ApiError> {
  if (response.status !== 403) handleAuthStatus(response.status);
  const body = await response.json().catch(() => ({})) as { error?: string };
  return new ApiError(response.status, body.error ?? `HTTP ${response.status}`);
}

function fileNameFrom(response: Response, fallback: string): string {
  const header = response.headers.get("content-disposition") ?? "";
  return /filename="([^"]+)"/.exec(header)?.[1] ?? fallback;
}

/** Fetches a file with the bearer token and hands it to the browser as a download. */
async function download(url: string, fallbackName: string): Promise<void> {
  const token = getAuthToken();
  const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw await errorFrom(response);
  const blob = await response.blob();
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = fileNameFrom(response, fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function upload(path: string, file: File): Promise<ImportPreview> {
  const token = getAuthToken();
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${BASE}${path}${separator}fileName=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: file
  });
  if (!response.ok) throw await errorFrom(response);
  return await response.json() as ImportPreview;
}

export const transferApi = {
  exportModel: (params: ExportParams) =>
    download(`${BASE}/export?${buildExportQuery(params)}`, `eam-export.${params.format}`),
  downloadTemplate: (format: TransferFormat, sheet?: TransferSheet) =>
    download(`${BASE}/import/template?format=${format}${sheet ? `&sheet=${sheet}` : ""}`, `eam-import-vorlage.${format}`),
  previewImport: (file: File) => upload("/import/preview", file),
  commitImport: (file: File, skipInvalid: boolean) => upload(`/import/commit${skipInvalid ? "?skipInvalid=true" : ""}`, file),
  auditLog: (limit = 100) => apiRequest<AuditEntry[]>(`${BASE}/audit-log?limit=${limit}`)
};
