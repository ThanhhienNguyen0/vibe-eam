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
}

export interface SidebarState {
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  components: ComponentInstance[];
  connections: ConnectionInstance[];
  diagrams: Diagram[];
}
