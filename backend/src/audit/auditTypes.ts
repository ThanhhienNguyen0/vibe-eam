export type AuditActorType = "user" | "system" | "legacy";

export type AuditJsonValue = null | boolean | number | string | AuditJsonValue[] | { [key: string]: AuditJsonValue };

export interface AuditFieldChange {
  field: string;
  before: AuditJsonValue;
  after: AuditJsonValue;
}

/** Business event recorded in addition to automatically derived object changes. */
export interface AuditEntryInput {
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  details?: Record<string, unknown>;
}

export type AuditActorInput =
  | { type: "user"; userId: string }
  | { type: "system"; label: string };

/** Context for one atomic state transition. The client never supplies the actor. */
export interface AuditWrite {
  actor: AuditActorInput;
  event?: AuditEntryInput;
  /** Snapshot used only to derive field changes; the DB revision still decides whether the write may commit. */
  beforeState?: import("../Sidebar/sidebarTypes.js").SidebarState | null;
}

export interface AuditMutationInput {
  action: "create" | "update" | "delete";
  entityType: string;
  entityId: string;
  summary: string;
  changes: AuditFieldChange[];
  details?: Record<string, unknown>;
}

export interface AuditEntry {
  id: string;
  occurredAt: string | null;
  createdAt: string;
  actorType: AuditActorType;
  actorLabel: string | null;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  changes: AuditFieldChange[];
  details: Record<string, unknown>;
  batchId: string | null;
}

export interface AuditQuery {
  limit: number;
  from?: Date;
  to?: Date;
  actor?: string;
  entityId?: string;
  entityType?: string;
  action?: string;
  cursor?: { occurredAt: Date | null; id: string };
}

export interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
}
