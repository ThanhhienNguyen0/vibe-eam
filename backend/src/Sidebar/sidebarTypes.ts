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
