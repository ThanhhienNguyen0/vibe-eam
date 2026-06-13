/** DataTransfer-MIME-Type für Drag & Drop von Komponenten auf die Diagrammfläche. */
export const COMPONENT_DRAG_MIME = "application/x-vibe-component";

/** DataTransfer-MIME-Type für Drag & Drop von Komponenten-Typen (erstellt neue Instanz). */
export const COMPONENT_TYPE_DRAG_MIME = "application/x-vibe-component-type";

/** Darstellungsform einer Komponente im Diagramm (BPMN-angelehnt). */
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

export const COMPONENT_SHAPES: { value: ComponentShape; label: string }[] = [
  { value: "box", label: "Standard (Rechteck)" },
  { value: "process", label: "Prozess / Aufgabe (abgerundet)" },
  { value: "event-start", label: "Start-Ereignis (dünner Kreis)" },
  { value: "event", label: "Zwischenereignis (Doppelkreis)" },
  { value: "event-end", label: "End-Ereignis (dicker Kreis)" },
  { value: "gateway", label: "Gateway (Raute)" },
  { value: "gateway-xor", label: "XOR-Gateway (Raute mit ✕)" },
  { value: "gateway-and", label: "AND-Gateway (Raute mit +)" },
  { value: "gateway-or", label: "OR-Gateway (Raute mit ○)" },
  { value: "datastore", label: "Datenspeicher (Zylinder)" },
  { value: "pool", label: "Pool / Container (groß, skalierbar)" }
];

/** Fallback-Kategorie für Typen ohne eigene Kategorie. */
export const DEFAULT_TYPE_CATEGORY = "Standard";

export interface ComponentType {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  customPropertyKeys: string[];
  /** Form im Diagramm; ältere Daten ohne Feld werden als "box" gerendert. */
  shape?: ComponentShape;
  /** Gruppierung in der Sidebar (z. B. "Standard", "BPMN"). */
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
  name: string;
  componentTypeId: string;
  properties: Record<string, string>;
  description: string;
}

export interface ConnectionInstance {
  id: string;
  name: string;
  connectionTypeId: string;
  sourceComponentId: string;
  targetComponentId: string;
  description: string;
  /** Frei definierbare Key/Value-Eigenschaften (optional, ältere Daten haben das Feld nicht). */
  properties?: Record<string, string>;
}

export interface DiagramPosition {
  x: number;
  y: number;
  /** Optionale Größe – wird z. B. beim Skalieren von Pools gespeichert. */
  width?: number;
  height?: number;
}

export interface Diagram {
  id: string;
  name: string;
  description: string;
  componentIds: string[];
  connectionIds: string[];
  positions: Record<string, DiagramPosition>;
  metamodelId?: string;
  viewpointId?: string;
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
}
