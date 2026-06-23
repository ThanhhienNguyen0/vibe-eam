import type { SidebarState } from "../Sidebar/sidebarTypes.js";

const ids = (values: string[] | undefined, mapping: Map<string, string>): string[] | undefined =>
  values?.map((id) => mapping.get(id) ?? id);

export function cloneSidebarStateForCompany(source: SidebarState, companyId: string): SidebarState {
  const prefix = `${companyId}:`;
  const makeMap = (values: Array<{ id: string }>) => new Map(values.map(({ id }) => [id, `${prefix}${id}`]));
  const componentTypes = makeMap(source.componentTypes);
  const connectionTypes = makeMap(source.connectionTypes);
  const connectionRules = makeMap(source.connectionRules);
  const viewpoints = makeMap(source.viewpoints);
  const viewpointRules = makeMap(source.viewpointRules);
  const validationRules = makeMap(source.validationRules);
  const components = makeMap(source.components);
  const connections = makeMap(source.connections);
  const diagrams = makeMap(source.diagrams);
  const metamodelId = `${prefix}${source.metamodel.id}`;

  return {
    metamodel: { ...source.metamodel, id: metamodelId },
    componentTypes: source.componentTypes.map((item) => ({
      ...item,
      id: componentTypes.get(item.id)!,
      allowedInViewpointIds: ids(item.allowedInViewpointIds, viewpoints)
    })),
    connectionTypes: source.connectionTypes.map((item) => ({
      ...item,
      id: connectionTypes.get(item.id)!,
      allowedSourceTypeIds: ids(item.allowedSourceTypeIds, componentTypes) ?? [],
      allowedTargetTypeIds: ids(item.allowedTargetTypeIds, componentTypes) ?? [],
      requiredForSourceTypes: ids(item.requiredForSourceTypes, componentTypes),
      requiredForTargetTypes: ids(item.requiredForTargetTypes, componentTypes)
    })),
    connectionRules: source.connectionRules.map((item) => ({
      ...item,
      id: connectionRules.get(item.id)!,
      sourceComponentTypeId: componentTypes.get(item.sourceComponentTypeId) ?? item.sourceComponentTypeId,
      connectionTypeId: connectionTypes.get(item.connectionTypeId) ?? item.connectionTypeId,
      targetComponentTypeId: componentTypes.get(item.targetComponentTypeId) ?? item.targetComponentTypeId,
      viewpointIds: ids(item.viewpointIds, viewpoints)
    })),
    viewpoints: source.viewpoints.map((item) => ({
      ...item,
      id: viewpoints.get(item.id)!,
      allowedComponentTypeIds: ids(item.allowedComponentTypeIds, componentTypes) ?? [],
      allowedConnectionTypeIds: ids(item.allowedConnectionTypeIds, connectionTypes) ?? [],
      requiredComponentTypeIds: ids(item.requiredComponentTypeIds, componentTypes) ?? [],
      requiredConnectionTypeIds: ids(item.requiredConnectionTypeIds, connectionTypes) ?? [],
      requiredConnectionRuleIds: ids(item.requiredConnectionRuleIds, connectionRules)
    })),
    viewpointRules: source.viewpointRules.map((item) => ({
      ...item,
      id: viewpointRules.get(item.id)!,
      viewpointId: viewpoints.get(item.viewpointId) ?? item.viewpointId,
      allowedComponentTypeIds: ids(item.allowedComponentTypeIds, componentTypes) ?? [],
      allowedConnectionTypeIds: ids(item.allowedConnectionTypeIds, connectionTypes) ?? [],
      allowedConnectionRuleIds: ids(item.allowedConnectionRuleIds, connectionRules) ?? [],
      requiredComponentTypeIds: ids(item.requiredComponentTypeIds, componentTypes) ?? [],
      requiredConnectionTypeIds: ids(item.requiredConnectionTypeIds, connectionTypes) ?? [],
      requiredConnectionRuleIds: ids(item.requiredConnectionRuleIds, connectionRules) ?? [],
      editableComponentTypeIds: ids(item.editableComponentTypeIds, componentTypes),
      visibleComponentTypeIds: ids(item.visibleComponentTypeIds, componentTypes)
    })),
    validationRules: source.validationRules.map((item) => ({
      ...item,
      id: validationRules.get(item.id)!,
      viewpointId: item.viewpointId ? viewpoints.get(item.viewpointId) ?? item.viewpointId : undefined,
      sourceComponentTypeId: item.sourceComponentTypeId ? componentTypes.get(item.sourceComponentTypeId) ?? item.sourceComponentTypeId : undefined,
      requiredConnectionTypeId: item.requiredConnectionTypeId ? connectionTypes.get(item.requiredConnectionTypeId) ?? item.requiredConnectionTypeId : undefined,
      targetComponentTypeId: item.targetComponentTypeId ? componentTypes.get(item.targetComponentTypeId) ?? item.targetComponentTypeId : undefined
    })),
    components: source.components.map((item) => ({
      ...item,
      id: components.get(item.id)!,
      componentTypeId: componentTypes.get(item.componentTypeId) ?? item.componentTypeId
    })),
    connections: source.connections.map((item) => ({
      ...item,
      id: connections.get(item.id)!,
      connectionTypeId: connectionTypes.get(item.connectionTypeId) ?? item.connectionTypeId,
      sourceComponentId: components.get(item.sourceComponentId) ?? item.sourceComponentId,
      targetComponentId: components.get(item.targetComponentId) ?? item.targetComponentId
    })),
    diagrams: source.diagrams.map((item) => ({
      ...item,
      id: diagrams.get(item.id)!,
      metamodelId,
      viewpointId: item.viewpointId ? viewpoints.get(item.viewpointId) ?? item.viewpointId : undefined,
      componentIds: ids(item.componentIds, components) ?? [],
      connectionIds: ids(item.connectionIds, connections) ?? [],
      positions: Object.fromEntries(Object.entries(item.positions).map(([id, position]) => [components.get(id) ?? id, position]))
    }))
  };
}
