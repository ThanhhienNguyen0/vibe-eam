import type {
  ComponentInstance,
  ConnectionInstance,
  Diagram,
  SidebarState
} from "../Sidebar/sidebarTypes.js";

export interface DiagramAggregate {
  diagram: Diagram;
  components: ComponentInstance[];
  connections: ConnectionInstance[];
}

export function diagramWithContents(state: SidebarState, id: string): DiagramAggregate | null {
  const diagram = state.diagrams.find((item) => item.id === id);
  if (!diagram) return null;
  const componentIds = new Set(diagram.componentIds);
  const connectionIds = new Set(diagram.connectionIds);
  return {
    diagram,
    components: state.components.filter((item) => componentIds.has(item.id)),
    connections: state.connections.filter((item) => connectionIds.has(item.id))
  };
}

export function assertValidConnectionEndpoints(state: SidebarState, connection: ConnectionInstance): void {
  const componentIds = new Set(state.components.map((item) => item.id));
  if (!componentIds.has(connection.sourceComponentId) || !componentIds.has(connection.targetComponentId)) {
    throw new Error(`ConnectionInstance '${connection.id}' must reference valid source and target ComponentInstances.`);
  }
}

export function addConnectionToDiagramState(
  state: SidebarState,
  connection: ConnectionInstance,
  diagramId: string
): SidebarState {
  assertValidConnectionEndpoints(state, connection);
  const diagram = state.diagrams.find((item) => item.id === diagramId);
  if (!diagram) throw new Error(`Diagram '${diagramId}' does not exist.`);
  if (!diagram.componentIds.includes(connection.sourceComponentId) || !diagram.componentIds.includes(connection.targetComponentId)) {
    throw new Error("Connection source and target must both be visible in the diagram.");
  }

  const connectionExists = state.connections.some((item) => item.id === connection.id);
  const connectionAlreadyAssigned = diagram.connectionIds.includes(connection.id);
  return {
    ...state,
    connections: connectionExists ? state.connections : [...state.connections, connection],
    diagrams: state.diagrams.map((item) => item.id === diagramId
      ? { ...item, connectionIds: connectionAlreadyAssigned ? item.connectionIds : [...item.connectionIds, connection.id] }
      : item)
  };
}

export function removeComponentWithConnections(state: SidebarState, componentId: string): SidebarState {
  const removedConnectionIds = new Set(
    state.connections
      .filter((item) => item.sourceComponentId === componentId || item.targetComponentId === componentId)
      .map((item) => item.id)
  );
  return {
    ...state,
    components: state.components.filter((item) => item.id !== componentId),
    connections: state.connections.filter((item) => !removedConnectionIds.has(item.id)),
    diagrams: state.diagrams.map((diagram) => ({
      ...diagram,
      componentIds: diagram.componentIds.filter((id) => id !== componentId),
      connectionIds: diagram.connectionIds.filter((id) => !removedConnectionIds.has(id)),
      positions: Object.fromEntries(Object.entries(diagram.positions).filter(([id]) => id !== componentId))
    }))
  };
}

export function removeDanglingInstanceReferences(state: SidebarState): SidebarState {
  const componentTypeIds = new Set(state.componentTypes.map((item) => item.id));
  const connectionTypeIds = new Set(state.connectionTypes.map((item) => item.id));
  const components = state.components.filter((item) => componentTypeIds.has(item.componentTypeId));
  const componentIds = new Set(components.map((item) => item.id));
  const connections = state.connections.filter((item) =>
    connectionTypeIds.has(item.connectionTypeId) &&
    componentIds.has(item.sourceComponentId) &&
    componentIds.has(item.targetComponentId)
  );
  const connectionIds = new Set(connections.map((item) => item.id));

  return {
    ...state,
    components,
    connections,
    diagrams: state.diagrams.map((diagram) => ({
      ...diagram,
      componentIds: diagram.componentIds.filter((id) => componentIds.has(id)),
      connectionIds: diagram.connectionIds.filter((id) => connectionIds.has(id)),
      positions: Object.fromEntries(Object.entries(diagram.positions).filter(([id]) => componentIds.has(id)))
    }))
  };
}
