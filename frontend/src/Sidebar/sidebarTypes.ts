/** DataTransfer-MIME-Type für Drag & Drop von Komponenten auf die Diagrammfläche. */
export const COMPONENT_DRAG_MIME = "application/x-vibe-component";

export interface ComponentType {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  customPropertyKeys: string[];
}

export interface ConnectionType {
  id: string;
  name: string;
  color: string;
  lineStyle: "solid" | "dashed" | "dotted";
  allowedSourceTypeIds: string[];
  allowedTargetTypeIds: string[];
  description: string;
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
