/** Business event to be recorded in the company-scoped audit log (REQ-31, groundwork for REQ-23). */
export interface AuditEntryInput {
  /** Machine readable action, e.g. "import.commit". */
  action: string;
  /** Affected entity kind, e.g. "model". */
  entityType: string;
  /** Short human readable summary (German, shown in the UI). */
  summary: string;
  /** Structured, non-sensitive details (counts, file name, checksum). */
  details?: Record<string, unknown>;
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

/** The acting user is attached by the store from the authenticated principal. */
export type AuditWrite = AuditEntryInput & { userId?: string };
