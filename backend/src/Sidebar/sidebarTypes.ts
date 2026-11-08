export type ComponentShape =
  | "box"
  | "process"
  | "event"
  | "event-start"
  | "event-end"
  | "gateway"
  | "gateway-xor"
  | "gateway-and"
  | "gateway-or"
  | "datastore"
  | "pool";

export interface ComponentType {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  customPropertyKeys: string[];
  shape?: ComponentShape;
  category?: string;
  layer?: string;
  isRequiredInViewpoint?: boolean;
  allowedInViewpointIds?: string[];
  isAbstract?: boolean;
  isStakeholderRelevant?: boolean;
}

export interface ConnectionType {
  id: string;
  name: string;
  color: string;
  lineStyle: "solid" | "dashed" | "dotted";
  allowedSourceTypeIds: string[];
  allowedTargetTypeIds: string[];
  description: string;
  category?: string;
  requiredForSourceTypes?: string[];
  requiredForTargetTypes?: string[];
  directionDescription?: string;
  semanticCategory?: string;
}

export type ValidationSeverity = "error" | "warning";
export type ValidationMessageScope = "metamodel" | "viewpoint" | "diagram" | "required-rule";
export type ValidationRuleType = "connection-rule" | "viewpoint-rule" | "validation-rule";

export interface ConnectionRule {
  id: string;
  sourceComponentTypeId: string;
  connectionTypeId: string;
  targetComponentTypeId: string;
  allowed: boolean;
  required: boolean;
  severity: ValidationSeverity;
  description: string;
  rationale: string;
  viewpointIds?: string[];
  minOccurrences?: number;
  maxOccurrences?: number;
}

export interface Metamodel {
  id: string;
  name: string;
  description: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ViewpointRule {
  id: string;
  viewpointId: string;
  allowedComponentTypeIds: string[];
  allowedConnectionTypeIds: string[];
  allowedConnectionRuleIds: string[];
  requiredComponentTypeIds: string[];
  requiredConnectionTypeIds: string[];
  requiredConnectionRuleIds: string[];
  description?: string;
  editableComponentTypeIds?: string[];
  visibleComponentTypeIds?: string[];
  severity?: ValidationSeverity;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  scope: "metamodel" | "viewpoint";
  viewpointId?: string;
  sourceComponentTypeId?: string;
  requiredConnectionTypeId?: string;
  targetComponentTypeId?: string;
  direction: "outgoing" | "incoming";
  minOccurrences: number;
  severity: ValidationSeverity;
  message: string;
  active: boolean;
}

export interface ComponentInstance {
  id: string;
  /** Server-managed runtime revision (REQ-26). */
  version?: number;
  /** Optional identifier from a source system (REQ-35); unique per company. */
  externalId?: string;
  name: string;
  componentTypeId: string;
  properties: Record<string, string>;
  description: string;
}

export interface ConnectionInstance {
  id: string;
  /** Server-managed runtime revision (REQ-26). */
  version?: number;
  /** Optional identifier from a source system (REQ-35); unique per company. */
  externalId?: string;
  name: string;
  connectionTypeId: string;
  sourceComponentId: string;
  targetComponentId: string;
  description: string;
  properties?: Record<string, string>;
}

export interface DiagramPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface Diagram {
  id: string;
  /** Server-managed runtime revision (REQ-26). */
  version?: number;
  name: string;
  description: string;
  componentIds: string[];
  connectionIds: string[];
  positions: Record<string, DiagramPosition>;
  metamodelId?: string;
  viewpointId?: string;
}

export type CatalogKind = "elements" | "relations";

/** User defined catalog (REQ-31): a saved selection of types, properties and columns. */
export interface Catalog {
  id: string;
  name: string;
  description: string;
  kind: CatalogKind;
  /** elements: included component types. Empty = all concrete types. */
  componentTypeIds: string[];
  /** relations: included connection types. Empty = all. */
  connectionTypeIds: string[];
  /** elements: property columns to show (explicit, empty = none). */
  propertyKeys: string[];
  /** Optional standard columns, see catalogModel (ELEMENT_COLUMNS / RELATION_COLUMNS). */
  columns: string[];
}

export interface Viewpoint {
  id: string;
  name: string;
  description: string;
  stakeholderRole: string;
  allowedComponentTypeIds: string[];
  allowedConnectionTypeIds: string[];
  requiredComponentTypeIds: string[];
  requiredConnectionTypeIds: string[];
  requiredConnectionRuleIds?: string[];
  maxVisibleLayers?: number;
  visibleLayerIds?: string[];
  purpose: string;
}

export interface ValidationMessage {
  id: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  affectedEntityId?: string;
  ruleId?: string;
  scope?: ValidationMessageScope;
  ruleType?: ValidationRuleType;
}

export interface MetamodelDefinition {
  metamodel: Metamodel;
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  connectionRules: ConnectionRule[];
  viewpoints: Viewpoint[];
  viewpointRules: ViewpointRule[];
  validationRules: ValidationRule[];
}

export interface MetamodelImportIssue {
  code: string;
  message: string;
  path?: string;
}

export interface MetamodelImportResult {
  success: boolean;
  errors: MetamodelImportIssue[];
  warnings: MetamodelImportIssue[];
  importedCounts: {
    componentTypes: number;
    connectionTypes: number;
    connectionRules: number;
    viewpoints: number;
    viewpointRules: number;
    validationRules: number;
  };
}

export interface SidebarState {
  /** Server-managed company data revision; excluded from REQ-33 transfer documents. */
  dataRevision?: number;
  metamodel: Metamodel;
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  connectionRules: ConnectionRule[];
  viewpointRules: ViewpointRule[];
  validationRules: ValidationRule[];
  components: ComponentInstance[];
  connections: ConnectionInstance[];
  diagrams: Diagram[];
  viewpoints: Viewpoint[];
  catalogs: Catalog[];
}
