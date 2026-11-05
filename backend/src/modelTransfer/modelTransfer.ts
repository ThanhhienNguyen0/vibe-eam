import { readFileSync } from "node:fs";
import { Ajv, type ErrorObject } from "ajv";
import type { SidebarState } from "../Sidebar/sidebarTypes.js";

export const MODEL_TRANSFER_SCHEMA_VERSION = 1 as const;
export const MODEL_TRANSFER_FORMAT = "vibe-eam-model" as const;

export interface ModelTransferDocument {
  schemaVersion: typeof MODEL_TRANSFER_SCHEMA_VERSION;
  format: typeof MODEL_TRANSFER_FORMAT;
  model: SidebarState;
}

export class ModelTransferError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: string[] = []
  ) {
    super(message);
  }
}

function loadSchema(): object {
  const candidates = [
    new URL("./vibe-eam-model.schema.json", import.meta.url),
    // Compiled modules live in backend/dist/modelTransfer; Docker deliberately retains backend/src.
    new URL("../../src/modelTransfer/vibe-eam-model.schema.json", import.meta.url)
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(readFileSync(candidate, "utf8")) as object;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error("The REQ-33 model transfer JSON Schema is missing.");
}

const validateSchema = new Ajv({ allErrors: true, strict: true }).compile<ModelTransferDocument>(loadSchema());

function schemaMessage(error: ErrorObject): string {
  const path = error.instancePath || "/";
  return `${path}: ${error.message ?? error.keyword}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requireUniqueIds(items: Array<{ id: string }>, label: string): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw semanticError(`${label} contains duplicate id '${item.id}'.`);
    ids.add(item.id);
  }
  return ids;
}

function requireReferences(ids: readonly string[], available: Set<string>, path: string): void {
  for (const id of ids) {
    if (!available.has(id)) throw semanticError(`${path} references missing id '${id}'.`);
  }
}

function semanticError(message: string): ModelTransferError {
  return new ModelTransferError(400, "MODEL_REFERENCE_INVALID", message);
}

function validateSemanticReferences(state: SidebarState): void {
  const componentTypeIds = requireUniqueIds(state.componentTypes, "componentTypes");
  const connectionTypeIds = requireUniqueIds(state.connectionTypes, "connectionTypes");
  const connectionRuleIds = requireUniqueIds(state.connectionRules, "connectionRules");
  const viewpointIds = requireUniqueIds(state.viewpoints, "viewpoints");
  const viewpointRuleIds = requireUniqueIds(state.viewpointRules, "viewpointRules");
  const validationRuleIds = requireUniqueIds(state.validationRules, "validationRules");
  const componentIds = requireUniqueIds(state.components, "components");
  const connectionIds = requireUniqueIds(state.connections, "connections");
  const diagramIds = requireUniqueIds(state.diagrams, "diagrams");
  const catalogIds = requireUniqueIds(state.catalogs, "catalogs");
  void viewpointRuleIds;
  void validationRuleIds;
  void diagramIds;
  void catalogIds;

  for (const type of state.componentTypes) {
    requireReferences(type.allowedInViewpointIds ?? [], viewpointIds, `componentTypes/${type.id}/allowedInViewpointIds`);
  }
  for (const type of state.connectionTypes) {
    requireReferences(type.allowedSourceTypeIds, componentTypeIds, `connectionTypes/${type.id}/allowedSourceTypeIds`);
    requireReferences(type.allowedTargetTypeIds, componentTypeIds, `connectionTypes/${type.id}/allowedTargetTypeIds`);
    requireReferences(type.requiredForSourceTypes ?? [], componentTypeIds, `connectionTypes/${type.id}/requiredForSourceTypes`);
    requireReferences(type.requiredForTargetTypes ?? [], componentTypeIds, `connectionTypes/${type.id}/requiredForTargetTypes`);
  }
  const ruleTriples = new Set<string>();
  for (const rule of state.connectionRules) {
    requireReferences([rule.sourceComponentTypeId, rule.targetComponentTypeId], componentTypeIds, `connectionRules/${rule.id}`);
    requireReferences([rule.connectionTypeId], connectionTypeIds, `connectionRules/${rule.id}`);
    requireReferences(rule.viewpointIds ?? [], viewpointIds, `connectionRules/${rule.id}/viewpointIds`);
    const triple = `${rule.sourceComponentTypeId}\u0000${rule.connectionTypeId}\u0000${rule.targetComponentTypeId}`;
    if (ruleTriples.has(triple)) throw semanticError(`connectionRules contains duplicate source/type/target triple at '${rule.id}'.`);
    ruleTriples.add(triple);
    if (rule.minOccurrences !== undefined && rule.maxOccurrences !== undefined && rule.minOccurrences > rule.maxOccurrences) {
      throw semanticError(`connectionRules/${rule.id} has minOccurrences greater than maxOccurrences.`);
    }
  }
  for (const viewpoint of state.viewpoints) {
    requireReferences(viewpoint.allowedComponentTypeIds, componentTypeIds, `viewpoints/${viewpoint.id}/allowedComponentTypeIds`);
    requireReferences(viewpoint.requiredComponentTypeIds, componentTypeIds, `viewpoints/${viewpoint.id}/requiredComponentTypeIds`);
    requireReferences(viewpoint.allowedConnectionTypeIds, connectionTypeIds, `viewpoints/${viewpoint.id}/allowedConnectionTypeIds`);
    requireReferences(viewpoint.requiredConnectionTypeIds, connectionTypeIds, `viewpoints/${viewpoint.id}/requiredConnectionTypeIds`);
    requireReferences(viewpoint.requiredConnectionRuleIds ?? [], connectionRuleIds, `viewpoints/${viewpoint.id}/requiredConnectionRuleIds`);
  }
  for (const rule of state.viewpointRules) {
    requireReferences([rule.viewpointId], viewpointIds, `viewpointRules/${rule.id}/viewpointId`);
    requireReferences([
      ...rule.allowedComponentTypeIds,
      ...rule.requiredComponentTypeIds,
      ...(rule.editableComponentTypeIds ?? []),
      ...(rule.visibleComponentTypeIds ?? [])
    ], componentTypeIds, `viewpointRules/${rule.id}/componentTypes`);
    requireReferences([...rule.allowedConnectionTypeIds, ...rule.requiredConnectionTypeIds], connectionTypeIds, `viewpointRules/${rule.id}/connectionTypes`);
    requireReferences([...rule.allowedConnectionRuleIds, ...rule.requiredConnectionRuleIds], connectionRuleIds, `viewpointRules/${rule.id}/connectionRules`);
  }
  for (const rule of state.validationRules) {
    requireReferences(rule.viewpointId ? [rule.viewpointId] : [], viewpointIds, `validationRules/${rule.id}/viewpointId`);
    requireReferences([
      ...(rule.sourceComponentTypeId ? [rule.sourceComponentTypeId] : []),
      ...(rule.targetComponentTypeId ? [rule.targetComponentTypeId] : [])
    ], componentTypeIds, `validationRules/${rule.id}/componentTypes`);
    requireReferences(rule.requiredConnectionTypeId ? [rule.requiredConnectionTypeId] : [], connectionTypeIds, `validationRules/${rule.id}/requiredConnectionTypeId`);
  }

  const componentExternalIds = new Set<string>();
  for (const component of state.components) {
    requireReferences([component.componentTypeId], componentTypeIds, `components/${component.id}/componentTypeId`);
    if (component.externalId) {
      if (componentExternalIds.has(component.externalId)) throw semanticError(`components contains duplicate externalId '${component.externalId}'.`);
      componentExternalIds.add(component.externalId);
    }
  }
  const connectionExternalIds = new Set<string>();
  const connectionsById = new Map(state.connections.map((item) => [item.id, item]));
  for (const connection of state.connections) {
    requireReferences([connection.connectionTypeId], connectionTypeIds, `connections/${connection.id}/connectionTypeId`);
    requireReferences([connection.sourceComponentId, connection.targetComponentId], componentIds, `connections/${connection.id}/endpoints`);
    if (connection.externalId) {
      if (connectionExternalIds.has(connection.externalId)) throw semanticError(`connections contains duplicate externalId '${connection.externalId}'.`);
      connectionExternalIds.add(connection.externalId);
    }
  }
  for (const diagram of state.diagrams) {
    if (diagram.metamodelId && diagram.metamodelId !== state.metamodel.id) {
      throw semanticError(`diagrams/${diagram.id}/metamodelId must equal model.metamodel.id.`);
    }
    requireReferences(diagram.viewpointId ? [diagram.viewpointId] : [], viewpointIds, `diagrams/${diagram.id}/viewpointId`);
    requireReferences(diagram.componentIds, componentIds, `diagrams/${diagram.id}/componentIds`);
    requireReferences(diagram.connectionIds, connectionIds, `diagrams/${diagram.id}/connectionIds`);
    const members = new Set(diagram.componentIds);
    for (const positionId of Object.keys(diagram.positions)) {
      if (!members.has(positionId)) throw semanticError(`diagrams/${diagram.id}/positions contains non-member '${positionId}'.`);
    }
    for (const id of diagram.connectionIds) {
      const connection = connectionsById.get(id)!;
      if (!members.has(connection.sourceComponentId) || !members.has(connection.targetComponentId)) {
        throw semanticError(`diagrams/${diagram.id} contains connection '${id}' without both endpoint components.`);
      }
    }
  }
  for (const catalog of state.catalogs) {
    requireReferences(catalog.componentTypeIds, componentTypeIds, `catalogs/${catalog.id}/componentTypeIds`);
    requireReferences(catalog.connectionTypeIds, connectionTypeIds, `catalogs/${catalog.id}/connectionTypeIds`);
    if (catalog.kind === "elements" && catalog.connectionTypeIds.length > 0) {
      throw semanticError(`catalogs/${catalog.id} is an element catalog but contains connection types.`);
    }
    if (catalog.kind === "relations" && (catalog.componentTypeIds.length > 0 || catalog.propertyKeys.length > 0)) {
      throw semanticError(`catalogs/${catalog.id} is a relation catalog but contains element-only configuration.`);
    }
  }

  for (const field of ["createdAt", "updatedAt"] as const) {
    const value = state.metamodel[field];
    if (!Number.isFinite(Date.parse(value))) throw semanticError(`model.metamodel.${field} must be an ISO date-time string.`);
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalState(state: SidebarState): SidebarState {
  const copy = structuredClone(state);
  for (const collection of [
    copy.componentTypes,
    copy.connectionTypes,
    copy.connectionRules,
    copy.viewpoints,
    copy.viewpointRules,
    copy.validationRules,
    copy.components,
    copy.connections,
    copy.diagrams
  ]) {
    collection.sort((left, right) => compareStrings(left.id, right.id));
  }
  for (const diagram of copy.diagrams) {
    diagram.componentIds.sort(compareStrings);
    diagram.connectionIds.sort(compareStrings);
  }
  return canonicalize(copy) as SidebarState;
}

function mapStateIds(state: SidebarState, map: (id: string) => string): SidebarState {
  const copy = structuredClone(state);
  copy.metamodel.id = map(copy.metamodel.id);
  for (const type of copy.componentTypes) {
    type.id = map(type.id);
    type.allowedInViewpointIds = type.allowedInViewpointIds?.map(map);
  }
  for (const type of copy.connectionTypes) {
    type.id = map(type.id);
    type.allowedSourceTypeIds = type.allowedSourceTypeIds.map(map);
    type.allowedTargetTypeIds = type.allowedTargetTypeIds.map(map);
    type.requiredForSourceTypes = type.requiredForSourceTypes?.map(map);
    type.requiredForTargetTypes = type.requiredForTargetTypes?.map(map);
  }
  for (const rule of copy.connectionRules) {
    rule.id = map(rule.id);
    rule.sourceComponentTypeId = map(rule.sourceComponentTypeId);
    rule.connectionTypeId = map(rule.connectionTypeId);
    rule.targetComponentTypeId = map(rule.targetComponentTypeId);
    rule.viewpointIds = rule.viewpointIds?.map(map);
  }
  for (const viewpoint of copy.viewpoints) {
    viewpoint.id = map(viewpoint.id);
    viewpoint.allowedComponentTypeIds = viewpoint.allowedComponentTypeIds.map(map);
    viewpoint.allowedConnectionTypeIds = viewpoint.allowedConnectionTypeIds.map(map);
    viewpoint.requiredComponentTypeIds = viewpoint.requiredComponentTypeIds.map(map);
    viewpoint.requiredConnectionTypeIds = viewpoint.requiredConnectionTypeIds.map(map);
    viewpoint.requiredConnectionRuleIds = viewpoint.requiredConnectionRuleIds?.map(map);
  }
  for (const rule of copy.viewpointRules) {
    rule.id = map(rule.id);
    rule.viewpointId = map(rule.viewpointId);
    rule.allowedComponentTypeIds = rule.allowedComponentTypeIds.map(map);
    rule.allowedConnectionTypeIds = rule.allowedConnectionTypeIds.map(map);
    rule.allowedConnectionRuleIds = rule.allowedConnectionRuleIds.map(map);
    rule.requiredComponentTypeIds = rule.requiredComponentTypeIds.map(map);
    rule.requiredConnectionTypeIds = rule.requiredConnectionTypeIds.map(map);
    rule.requiredConnectionRuleIds = rule.requiredConnectionRuleIds.map(map);
    rule.editableComponentTypeIds = rule.editableComponentTypeIds?.map(map);
    rule.visibleComponentTypeIds = rule.visibleComponentTypeIds?.map(map);
  }
  for (const rule of copy.validationRules) {
    rule.id = map(rule.id);
    if (rule.viewpointId) rule.viewpointId = map(rule.viewpointId);
    if (rule.sourceComponentTypeId) rule.sourceComponentTypeId = map(rule.sourceComponentTypeId);
    if (rule.requiredConnectionTypeId) rule.requiredConnectionTypeId = map(rule.requiredConnectionTypeId);
    if (rule.targetComponentTypeId) rule.targetComponentTypeId = map(rule.targetComponentTypeId);
  }
  for (const component of copy.components) {
    component.id = map(component.id);
    component.componentTypeId = map(component.componentTypeId);
  }
  for (const connection of copy.connections) {
    connection.id = map(connection.id);
    connection.connectionTypeId = map(connection.connectionTypeId);
    connection.sourceComponentId = map(connection.sourceComponentId);
    connection.targetComponentId = map(connection.targetComponentId);
  }
  for (const diagram of copy.diagrams) {
    diagram.id = map(diagram.id);
    if (diagram.metamodelId) diagram.metamodelId = map(diagram.metamodelId);
    if (diagram.viewpointId) diagram.viewpointId = map(diagram.viewpointId);
    diagram.componentIds = diagram.componentIds.map(map);
    diagram.connectionIds = diagram.connectionIds.map(map);
    diagram.positions = Object.fromEntries(Object.entries(diagram.positions).map(([id, position]) => [map(id), position]));
  }
  for (const catalog of copy.catalogs) {
    catalog.id = map(catalog.id);
    catalog.componentTypeIds = catalog.componentTypeIds.map(map);
    catalog.connectionTypeIds = catalog.connectionTypeIds.map(map);
  }
  return copy;
}

export function materializeModelTransferState(document: ModelTransferDocument, companyId: string): SidebarState {
  const prefix = `${companyId}:`;
  return mapStateIds(document.model, (id) => `${prefix}${id}`);
}

export function exportModelTransferDocument(state: SidebarState, companyId?: string): ModelTransferDocument {
  const portableState = companyId
    ? mapStateIds(state, (id) => id.startsWith(`${companyId}:`) ? id.slice(companyId.length + 1) : id)
    : state;
  return canonicalize({
    schemaVersion: MODEL_TRANSFER_SCHEMA_VERSION,
    format: MODEL_TRANSFER_FORMAT,
    model: canonicalState(portableState)
  }) as ModelTransferDocument;
}

export function parseModelTransferDocument(input: unknown): ModelTransferDocument {
  const record = asRecord(input);
  if (!record || !("schemaVersion" in record)) {
    throw new ModelTransferError(400, "SCHEMA_VERSION_REQUIRED", "schemaVersion is required; unversioned legacy model files are not imported.");
  }
  if (!Number.isInteger(record.schemaVersion)) {
    throw new ModelTransferError(400, "SCHEMA_VERSION_INVALID", "schemaVersion must be an integer.");
  }
  if (record.schemaVersion !== MODEL_TRANSFER_SCHEMA_VERSION) {
    const direction = (record.schemaVersion as number) < MODEL_TRANSFER_SCHEMA_VERSION ? "legacy" : "future";
    throw new ModelTransferError(
      400,
      direction === "legacy" ? "SCHEMA_VERSION_UNSUPPORTED_LEGACY" : "SCHEMA_VERSION_UNSUPPORTED_FUTURE",
      `Unsupported ${direction} schemaVersion ${String(record.schemaVersion)}; this server accepts schemaVersion ${MODEL_TRANSFER_SCHEMA_VERSION}.`
    );
  }
  if (!validateSchema(input)) {
    const details = (validateSchema.errors ?? []).map(schemaMessage);
    throw new ModelTransferError(400, "MODEL_SCHEMA_INVALID", `Model file does not match schemaVersion ${MODEL_TRANSFER_SCHEMA_VERSION}.`, details);
  }
  const document = structuredClone(input) as ModelTransferDocument;
  validateSemanticReferences(document.model);
  return document;
}
