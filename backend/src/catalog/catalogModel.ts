import type {
  ComponentInstance,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram
} from "../Sidebar/sidebarTypes.js";

/**
 * Pure catalog logic (REQ-31). It is shared by the catalog UI and the exporter so that
 * "what you see in a catalog" and "what you export" always use the same filter.
 * Keep this file free of Node/React imports.
 */

export interface CatalogSource {
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  components: ComponentInstance[];
  connections: ConnectionInstance[];
  diagrams: Pick<Diagram, "id" | "name" | "componentIds">[];
}

export interface ElementFilter {
  /** Empty or undefined means "all types". */
  typeIds?: string[];
  query?: string;
}

export interface RelationFilter {
  /** Empty or undefined means "all connection types". */
  connectionTypeIds?: string[];
  query?: string;
}

const normalize = (value: string | undefined): string => (value ?? "").toLocaleLowerCase("de").trim();

function matchesQuery(haystack: Array<string | undefined>, query: string | undefined): boolean {
  const needle = normalize(query);
  if (!needle) return true;
  return haystack.some((value) => normalize(value).includes(needle));
}

export function filterElements(
  source: Pick<CatalogSource, "components" | "componentTypes">,
  filter: ElementFilter = {}
): ComponentInstance[] {
  const typeNames = new Map(source.componentTypes.map((type) => [type.id, type.name]));
  const typeIds = filter.typeIds && filter.typeIds.length > 0 ? new Set(filter.typeIds) : null;
  return source.components.filter((component) => {
    if (typeIds && !typeIds.has(component.componentTypeId)) return false;
    return matchesQuery([
      component.name,
      component.description,
      component.externalId,
      typeNames.get(component.componentTypeId),
      ...Object.values(component.properties ?? {})
    ], filter.query);
  });
}

export function filterRelations(
  source: Pick<CatalogSource, "components" | "connections" | "connectionTypes">,
  filter: RelationFilter = {}
): ConnectionInstance[] {
  const typeNames = new Map(source.connectionTypes.map((type) => [type.id, type.name]));
  const componentNames = new Map(source.components.map((component) => [component.id, component.name]));
  const typeIds = filter.connectionTypeIds && filter.connectionTypeIds.length > 0 ? new Set(filter.connectionTypeIds) : null;
  return source.connections.filter((connection) => {
    if (typeIds && !typeIds.has(connection.connectionTypeId)) return false;
    return matchesQuery([
      connection.name,
      connection.description,
      connection.externalId,
      typeNames.get(connection.connectionTypeId),
      componentNames.get(connection.sourceComponentId),
      componentNames.get(connection.targetComponentId)
    ], filter.query);
  });
}

/** Ordered union of the custom property keys of the given types. */
export function propertyKeysForTypes(types: ComponentType[]): string[] {
  const keys: string[] = [];
  for (const type of types) {
    for (const key of type.customPropertyKeys ?? []) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

export interface ElementCatalogRow {
  id: string;
  externalId: string;
  name: string;
  typeId: string;
  typeName: string;
  layer: string;
  description: string;
  properties: Record<string, string>;
  outgoing: number;
  incoming: number;
  diagrams: string[];
}

/** Rows of the element catalog including usage ("where is this element used"). */
export function elementCatalogRows(source: CatalogSource, filter: ElementFilter = {}): ElementCatalogRow[] {
  const types = new Map(source.componentTypes.map((type) => [type.id, type]));
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const connection of source.connections) {
    outgoing.set(connection.sourceComponentId, (outgoing.get(connection.sourceComponentId) ?? 0) + 1);
    incoming.set(connection.targetComponentId, (incoming.get(connection.targetComponentId) ?? 0) + 1);
  }
  const diagramsByComponent = new Map<string, string[]>();
  for (const diagram of source.diagrams) {
    for (const componentId of diagram.componentIds) {
      const list = diagramsByComponent.get(componentId) ?? [];
      list.push(diagram.name);
      diagramsByComponent.set(componentId, list);
    }
  }
  return filterElements(source, filter).map((component) => {
    const type = types.get(component.componentTypeId);
    return {
      id: component.id,
      externalId: component.externalId ?? "",
      name: component.name,
      typeId: component.componentTypeId,
      typeName: type?.name ?? component.componentTypeId,
      layer: type?.layer ?? "",
      description: component.description,
      properties: component.properties ?? {},
      outgoing: outgoing.get(component.id) ?? 0,
      incoming: incoming.get(component.id) ?? 0,
      diagrams: diagramsByComponent.get(component.id) ?? []
    };
  });
}

export interface RelationCatalogRow {
  id: string;
  externalId: string;
  name: string;
  typeId: string;
  typeName: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  description: string;
}

export function relationCatalogRows(source: CatalogSource, filter: RelationFilter = {}): RelationCatalogRow[] {
  const typeNames = new Map(source.connectionTypes.map((type) => [type.id, type.name]));
  const componentNames = new Map(source.components.map((component) => [component.id, component.name]));
  return filterRelations(source, filter).map((connection) => ({
    id: connection.id,
    externalId: connection.externalId ?? "",
    name: connection.name,
    typeId: connection.connectionTypeId,
    typeName: typeNames.get(connection.connectionTypeId) ?? connection.connectionTypeId,
    sourceId: connection.sourceComponentId,
    sourceName: componentNames.get(connection.sourceComponentId) ?? connection.sourceComponentId,
    targetId: connection.targetComponentId,
    targetName: componentNames.get(connection.targetComponentId) ?? connection.targetComponentId,
    description: connection.description
  }));
}

export interface ElementCatalog {
  /** "all" or the component type id. */
  id: string;
  label: string;
  typeIds: string[];
  count: number;
  layer: string;
}

/** One catalog per component type plus an "all elements" catalog. */
export function elementCatalogs(source: Pick<CatalogSource, "componentTypes" | "components">): ElementCatalog[] {
  const counts = new Map<string, number>();
  for (const component of source.components) {
    counts.set(component.componentTypeId, (counts.get(component.componentTypeId) ?? 0) + 1);
  }
  const perType = source.componentTypes
    .filter((type) => !type.isAbstract)
    .map((type): ElementCatalog => ({
      id: type.id,
      label: type.name,
      typeIds: [type.id],
      count: counts.get(type.id) ?? 0,
      layer: type.layer ?? ""
    }))
    .sort((a, b) => a.layer.localeCompare(b.layer, "de") || a.label.localeCompare(b.label, "de"));
  return [
    { id: "all", label: "Alle Elemente", typeIds: [], count: source.components.length, layer: "" },
    ...perType
  ];
}
