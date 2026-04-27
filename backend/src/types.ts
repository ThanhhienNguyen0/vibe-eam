export const elementTypes = [
  "Business Capability",
  "Business Process",
  "Application Component",
  "Data Object",
  "Technology Node"
] as const;

export const layers = ["Business", "Application", "Data", "Technology"] as const;
export const riskLevels = ["low", "medium", "high"] as const;
export const statuses = ["planned", "active", "deprecated", "retired"] as const;
export const relationTypes = ["uses", "depends_on", "realizes", "serves"] as const;

export type ElementType = (typeof elementTypes)[number];
export type Layer = (typeof layers)[number];
export type Risk = (typeof riskLevels)[number];
export type Status = (typeof statuses)[number];
export type RelationType = (typeof relationTypes)[number];

export interface Position {
  x: number;
  y: number;
}

export interface EamElement {
  id: string;
  name: string;
  type: ElementType;
  layer: Layer;
  description: string;
  risk: Risk;
  cost: number;
  status: Status;
  startDate: string;
  endOfLifeDate: string;
  customAttributes: Record<string, string>;
  position: Position;
}

export interface EamRelation {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  description: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: "create" | "update" | "delete" | "import";
  entityId: string;
  description: string;
}

export interface EamModel {
  elements: EamElement[];
  relations: EamRelation[];
}

export interface PersistedState extends EamModel {
  auditLog: AuditLogEntry[];
}
