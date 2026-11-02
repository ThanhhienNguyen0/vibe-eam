/**
 * Pure catalog logic (REQ-31). It is shared by the catalog UI and the exporter so that
 * "what you see in a catalog" and "what you export" always use the same filter.
 *
 * This file must stay free of imports: the frontend image build copies it on its own
 * (see frontend/Dockerfile). The interfaces below are structural subsets of the sidebar types.
 */

export interface CatalogComponentType {
  id: string;
  name: string;
  layer?: string;
  isAbstract?: boolean;
  customPropertyKeys?: string[];
}

export interface CatalogConnectionType {
  id: string;
  name: string;
}

export interface CatalogComponent {
  id: string;
  externalId?: string;
  name: string;
  componentTypeId: string;
  description: string;
  properties?: Record<string, string>;
}

export interface CatalogConnection {
  id: string;
  externalId?: string;
  name: string;
  connectionTypeId: string;
  sourceComponentId: string;
  targetComponentId: string;
  description: string;
}

export interface CatalogDiagram {
  id: string;
  name: string;
  componentIds: string[];
}

export interface CatalogSource {
  componentTypes: CatalogComponentType[];
  connectionTypes: CatalogConnectionType[];
  components: CatalogComponent[];
  connections: CatalogConnection[];
  diagrams: CatalogDiagram[];
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

export function filterElements<C extends CatalogComponent>(
  source: { components: C[]; componentTypes: CatalogComponentType[] },
  filter: ElementFilter = {}
): C[] {
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

export function filterRelations<R extends CatalogConnection>(
  source: { components: CatalogComponent[]; connections: R[]; connectionTypes: CatalogConnectionType[] },
  filter: RelationFilter = {}
): R[] {
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
export function propertyKeysForTypes(types: CatalogComponentType[]): string[] {
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

// ── User defined catalogs ────────────────────────────────────────────────────

export const ELEMENT_COLUMNS = [
  { key: "type", label: "Typ" },
  { key: "layer", label: "Ebene" },
  { key: "externalId", label: "Externe ID" },
  { key: "description", label: "Beschreibung" },
  { key: "outgoing", label: "Ausgehende Verbindungen" },
  { key: "incoming", label: "Eingehende Verbindungen" },
  { key: "diagrams", label: "Diagramme" }
] as const;

export const RELATION_COLUMNS = [
  { key: "type", label: "Typ" },
  { key: "name", label: "Name" },
  { key: "externalId", label: "Externe ID" },
  { key: "description", label: "Beschreibung" }
] as const;

export function catalogColumnKeys(kind: "elements" | "relations"): string[] {
  return (kind === "elements" ? ELEMENT_COLUMNS : RELATION_COLUMNS).map((column) => column.key);
}

/** The subset of a catalog that drives filtering and export. */
export interface CatalogDefinition {
  kind: "elements" | "relations";
  componentTypeIds: string[];
  connectionTypeIds: string[];
  propertyKeys: string[];
  columns: string[];
}

/** Matches nothing: used when a catalog only references types that no longer exist. */
export const NO_MATCH_ID = "__no-match__";

function existingIds(selected: string[], existing: Array<{ id: string }>): string[] {
  if (selected.length === 0) return [];
  const known = new Set(existing.map((item) => item.id));
  const kept = selected.filter((id) => known.has(id));
  return kept.length > 0 ? kept : [NO_MATCH_ID];
}

/** Component types the catalog includes (all concrete types when none are selected). */
export function catalogComponentTypes(
  catalog: Pick<CatalogDefinition, "componentTypeIds">,
  source: { componentTypes: CatalogComponentType[] }
): CatalogComponentType[] {
  const ids = existingIds(catalog.componentTypeIds, source.componentTypes);
  return ids.length > 0
    ? source.componentTypes.filter((type) => ids.includes(type.id))
    : source.componentTypes.filter((type) => !type.isAbstract);
}

/** Property keys that can be chosen for a catalog (union over its types). */
export function availablePropertyKeys(
  catalog: Pick<CatalogDefinition, "componentTypeIds">,
  source: { componentTypes: CatalogComponentType[] }
): string[] {
  return propertyKeysForTypes(catalogComponentTypes(catalog, source));
}

/** Selected property keys that still exist on the catalog's types, in the order of the types. */
export function catalogPropertyKeys(catalog: CatalogDefinition, source: { componentTypes: CatalogComponentType[] }): string[] {
  const selected = new Set(catalog.propertyKeys);
  return availablePropertyKeys(catalog, source).filter((key) => selected.has(key));
}

export function catalogElementFilter(
  catalog: Pick<CatalogDefinition, "componentTypeIds">,
  source: { componentTypes: CatalogComponentType[] },
  query?: string
): ElementFilter {
  return { typeIds: existingIds(catalog.componentTypeIds, source.componentTypes), query };
}

export function catalogRelationFilter(
  catalog: Pick<CatalogDefinition, "connectionTypeIds">,
  source: { connectionTypes: CatalogConnectionType[] },
  query?: string
): RelationFilter {
  return { connectionTypeIds: existingIds(catalog.connectionTypeIds, source.connectionTypes), query };
}
