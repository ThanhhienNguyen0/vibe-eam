import type {
  ComponentInstance,
  ComponentType,
  ConnectionInstance,
  ConnectionRule,
  ConnectionType,
  Diagram,
  SidebarState,
  ValidationMessage,
  ValidationMessageScope,
  ValidationRuleType,
  Viewpoint,
  ViewpointRule
} from "./sidebarTypes";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  missingRequiredComponentTypeIds: string[];
  missingRequiredConnectionTypeIds: string[];
  missingRequiredConnectionRuleIds: string[];
}

export type DiagramValidationResult = ValidationResult;

interface ValidationOptions {
  includeRequiredRules?: boolean;
}

const emptyResult = (): ValidationResult => ({
  valid: true,
  errors: [],
  warnings: [],
  missingRequiredComponentTypeIds: [],
  missingRequiredConnectionTypeIds: [],
  missingRequiredConnectionRuleIds: []
});

function message(
  severity: "error" | "warning",
  code: string,
  text: string,
  affectedEntityId?: string,
  ruleId?: string,
  scope?: ValidationMessageScope,
  ruleType?: ValidationRuleType
): ValidationMessage {
  return { id: `${code}:${affectedEntityId ?? "model"}:${ruleId ?? "none"}`, severity, code, message: text, affectedEntityId, ruleId, scope, ruleType };
}

function add(result: ValidationResult, item: ValidationMessage): void {
  if (item.severity === "warning") result.warnings.push(item);
  else result.errors.push(item);
}

function merge(into: ValidationResult, from: ValidationResult): void {
  into.missingRequiredComponentTypeIds.push(...from.missingRequiredComponentTypeIds);
  into.missingRequiredConnectionTypeIds.push(...from.missingRequiredConnectionTypeIds);
  into.missingRequiredConnectionRuleIds.push(...from.missingRequiredConnectionRuleIds);
  for (const item of [...from.errors, ...from.warnings]) add(into, item);
}

function typeName(componentTypes: ComponentType[], id: string): string {
  return componentTypes.find((type) => type.id === id)?.name ?? id;
}

function connectionTypeName(connectionTypes: ConnectionType[], id: string): string {
  return connectionTypes.find((type) => type.id === id)?.name ?? id;
}

function relationVerb(name: string): string {
  const map: Record<string, string> = {
    serves: "serve",
    uses: "use",
    realizes: "realize",
    "responsible_for": "be responsible for",
    "interested_in": "be interested in",
    "depends_on": "depend on"
  };
  return map[name] ?? name;
}

function componentTypeFor(component: ComponentInstance | undefined, state: SidebarState): ComponentType | undefined {
  return component ? state.componentTypes.find((type) => type.id === component.componentTypeId) : undefined;
}

function ruleAppliesToViewpoint(rule: ConnectionRule, viewpointId?: string): boolean {
  if (!viewpointId || !rule.viewpointIds || rule.viewpointIds.length === 0) return true;
  return rule.viewpointIds.includes(viewpointId);
}

function ruleForViewpoint(viewpoint: Viewpoint, state: SidebarState): ViewpointRule {
  const existing = (state.viewpointRules ?? []).find((item) => item.viewpointId === viewpoint.id);
  if (existing) return existing;
  return {
    id: `derived-${viewpoint.id}`,
    viewpointId: viewpoint.id,
    allowedComponentTypeIds: viewpoint.allowedComponentTypeIds,
    allowedConnectionTypeIds: viewpoint.allowedConnectionTypeIds,
    allowedConnectionRuleIds: state.connectionRules.filter((rule) => ruleAppliesToViewpoint(rule, viewpoint.id)).map((rule) => rule.id),
    requiredComponentTypeIds: viewpoint.requiredComponentTypeIds,
    requiredConnectionTypeIds: viewpoint.requiredConnectionTypeIds,
    requiredConnectionRuleIds: viewpoint.requiredConnectionRuleIds ?? [],
    visibleComponentTypeIds: viewpoint.allowedComponentTypeIds,
    description: "Derived from legacy Viewpoint fields.",
    severity: "error"
  };
}

function matchingConnectionRule(connection: ConnectionInstance, state: SidebarState): ConnectionRule | undefined {
  const source = state.components.find((component) => component.id === connection.sourceComponentId);
  const target = state.components.find((component) => component.id === connection.targetComponentId);
  if (!source || !target) return undefined;
  return state.connectionRules.find((rule) =>
    rule.sourceComponentTypeId === source.componentTypeId &&
    rule.connectionTypeId === connection.connectionTypeId &&
    rule.targetComponentTypeId === target.componentTypeId
  );
}

function connectionRuleAllowedByViewpoint(rule: ConnectionRule, state: SidebarState, viewpointId?: string): boolean {
  if (!viewpointId) return true;
  const viewpoint = state.viewpoints.find((item) => item.id === viewpointId);
  if (!viewpoint) return false;
  const viewpointRule = ruleForViewpoint(viewpoint, state);
  if (!ruleAppliesToViewpoint(rule, viewpointId)) return false;
  if (viewpointRule.allowedConnectionRuleIds.length > 0 && !viewpointRule.allowedConnectionRuleIds.includes(rule.id)) return false;
  if (viewpointRule.allowedConnectionTypeIds.length > 0 && !viewpointRule.allowedConnectionTypeIds.includes(rule.connectionTypeId)) return false;
  if (viewpointRule.allowedComponentTypeIds.length > 0 && !viewpointRule.allowedComponentTypeIds.includes(rule.sourceComponentTypeId)) return false;
  if (viewpointRule.allowedComponentTypeIds.length > 0 && !viewpointRule.allowedComponentTypeIds.includes(rule.targetComponentTypeId)) return false;
  return true;
}

export function getAllowedConnectionRules(
  state: SidebarState,
  sourceComponentTypeId: string,
  targetComponentTypeId: string,
  viewpointId?: string
): ConnectionRule[] {
  return state.connectionRules.filter((rule) => {
    if (rule.sourceComponentTypeId !== sourceComponentTypeId) return false;
    if (rule.targetComponentTypeId !== targetComponentTypeId) return false;
    if (!rule.allowed) return false;
    return connectionRuleAllowedByViewpoint(rule, state, viewpointId);
  });
}

export function getAllowedConnectionTypes(
  state: SidebarState,
  sourceComponentTypeId: string,
  targetComponentTypeId: string,
  viewpointId?: string
): ConnectionType[] {
  const allowedTypeIds = new Set(getAllowedConnectionRules(state, sourceComponentTypeId, targetComponentTypeId, viewpointId).map((rule) => rule.connectionTypeId));
  return state.connectionTypes.filter((type) => allowedTypeIds.has(type.id));
}

export function validateConnectionInstance(connection: ConnectionInstance, state: SidebarState, diagram?: Diagram): ValidationResult {
  const result = emptyResult();
  const viewpointId = diagram?.viewpointId;
  const connectionType = state.connectionTypes.find((type) => type.id === connection.connectionTypeId);
  const source = state.components.find((component) => component.id === connection.sourceComponentId);
  const target = state.components.find((component) => component.id === connection.targetComponentId);
  const sourceType = componentTypeFor(source, state);
  const targetType = componentTypeFor(target, state);

  if (!connectionType) add(result, message("error", "CONNECTION_TYPE_MISSING", `Connection type '${connection.connectionTypeId}' does not exist.`, connection.id, undefined, "metamodel"));
  if (!source) add(result, message("error", "SOURCE_MISSING", `Source component '${connection.sourceComponentId}' does not exist.`, connection.id, undefined, "diagram"));
  if (!target) add(result, message("error", "TARGET_MISSING", `Target component '${connection.targetComponentId}' does not exist.`, connection.id, undefined, "diagram"));
  if (connection.sourceComponentId === connection.targetComponentId) add(result, message("error", "SELF_CONNECTION", "Connection source and target must not be identical.", connection.id, undefined, "diagram"));

  if (connectionType && sourceType && targetType) {
    const rule = matchingConnectionRule(connection, state);
    if (!rule || !rule.allowed) {
      add(result, message(rule?.severity ?? "error", rule ? "CONNECTION_RULE_DENIED" : "CONNECTION_RULE_MISSING", `${sourceType.name} may not ${relationVerb(connectionType.name)} ${targetType.name} according to the active metamodel.`, connection.id, rule?.id, "metamodel", "connection-rule"));
    } else if (viewpointId && !connectionRuleAllowedByViewpoint(rule, state, viewpointId)) {
      const viewpointName = state.viewpoints.find((item) => item.id === viewpointId)?.name ?? viewpointId;
      add(result, message("error", "VIEWPOINT_RULE_DENIED", `${rule.description} is not allowed in ${viewpointName}.`, connection.id, rule.id, "viewpoint", "viewpoint-rule"));
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}

export function validateViewpointCompliance(diagram: Diagram, viewpoint: Viewpoint, state: SidebarState): ValidationResult {
  const result = emptyResult();
  const viewpointRule = ruleForViewpoint(viewpoint, state);
  const diagramComponents = diagram.componentIds
    .map((id) => state.components.find((component) => component.id === id))
    .filter((component): component is ComponentInstance => Boolean(component));
  const diagramConnections = diagram.connectionIds
    .map((id) => state.connections.find((connection) => connection.id === id))
    .filter((connection): connection is ConnectionInstance => Boolean(connection));

  for (const component of diagramComponents) {
    const componentType = state.componentTypes.find((type) => type.id === component.componentTypeId);
    if (!componentType) {
      add(result, message("error", "COMPONENT_TYPE_MISSING", `Component '${component.name}' references missing component type '${component.componentTypeId}'.`, component.id, undefined, "metamodel"));
      continue;
    }
    if (viewpointRule.allowedComponentTypeIds.length > 0 && !viewpointRule.allowedComponentTypeIds.includes(componentType.id)) add(result, message("error", "VIEWPOINT_COMPONENT_DENIED", `${componentType.name} is not allowed in ${viewpoint.name}.`, component.id, viewpointRule.id, "viewpoint", "viewpoint-rule"));
    if (viewpointRule.visibleComponentTypeIds && viewpointRule.visibleComponentTypeIds.length > 0 && !viewpointRule.visibleComponentTypeIds.includes(componentType.id)) add(result, message("warning", "VIEWPOINT_COMPONENT_HIDDEN", `${componentType.name} is hidden in ${viewpoint.name}.`, component.id, viewpointRule.id, "viewpoint", "viewpoint-rule"));
    if (viewpoint.visibleLayerIds && viewpoint.visibleLayerIds.length > 0 && componentType.layer && !viewpoint.visibleLayerIds.includes(componentType.layer)) {
      add(result, message("warning", "VIEWPOINT_LAYER_HIDDEN", `${componentType.name} is outside the visible layers of ${viewpoint.name}.`, component.id, viewpointRule.id, "viewpoint", "viewpoint-rule"));
    }
  }

  for (const connection of diagramConnections) {
    const connectionType = state.connectionTypes.find((type) => type.id === connection.connectionTypeId);
    if (connectionType && viewpointRule.allowedConnectionTypeIds.length > 0 && !viewpointRule.allowedConnectionTypeIds.includes(connectionType.id)) add(result, message("error", "VIEWPOINT_CONNECTION_DENIED", `${connectionType.name} is not allowed in ${viewpoint.name}.`, connection.id, viewpointRule.id, "viewpoint", "viewpoint-rule"));
    const rule = matchingConnectionRule(connection, state);
    if (rule && viewpointRule.allowedConnectionRuleIds.length > 0 && !viewpointRule.allowedConnectionRuleIds.includes(rule.id)) add(result, message("error", "VIEWPOINT_RULE_DENIED", `${rule.description} is not allowed in ${viewpoint.name}.`, connection.id, rule.id, "viewpoint", "viewpoint-rule"));
  }

  result.valid = result.errors.length === 0;
  return result;
}

export function validateRequiredRules(diagram: Diagram, viewpoint: Viewpoint, state: SidebarState): ValidationResult {
  const result = emptyResult();
  const viewpointRule = ruleForViewpoint(viewpoint, state);
  const diagramComponents = diagram.componentIds
    .map((id) => state.components.find((component) => component.id === id))
    .filter((component): component is ComponentInstance => Boolean(component));
  const diagramConnections = diagram.connectionIds
    .map((id) => state.connections.find((connection) => connection.id === id))
    .filter((connection): connection is ConnectionInstance => Boolean(connection));

  const presentComponentTypeIds = new Set(diagramComponents.map((component) => component.componentTypeId));
  for (const requiredId of viewpointRule.requiredComponentTypeIds) {
    if (!presentComponentTypeIds.has(requiredId)) {
      result.missingRequiredComponentTypeIds.push(requiredId);
      add(result, message("error", "REQUIRED_COMPONENT_MISSING", `${viewpoint.name} requires at least one ${typeName(state.componentTypes, requiredId)}.`, diagram.id, viewpointRule.id, "required-rule", "viewpoint-rule"));
    }
  }

  const presentConnectionTypeIds = new Set(diagramConnections.map((connection) => connection.connectionTypeId));
  for (const requiredId of viewpointRule.requiredConnectionTypeIds) {
    if (!presentConnectionTypeIds.has(requiredId)) {
      result.missingRequiredConnectionTypeIds.push(requiredId);
      add(result, message("error", "REQUIRED_CONNECTION_MISSING", `${viewpoint.name} requires at least one ${connectionTypeName(state.connectionTypes, requiredId)} connection.`, diagram.id, viewpointRule.id, "required-rule", "viewpoint-rule"));
    }
  }

  const requiredRuleIds = new Set([
    ...viewpointRule.requiredConnectionRuleIds,
    ...state.connectionRules.filter((rule) => rule.required && connectionRuleAllowedByViewpoint(rule, state, viewpoint.id)).map((rule) => rule.id)
  ]);

  for (const requiredRuleId of requiredRuleIds) {
    const rule = state.connectionRules.find((item) => item.id === requiredRuleId);
    if (!rule) continue;
    const count = diagramConnections.filter((connection) => matchingConnectionRule(connection, state)?.id === rule.id).length;
    const min = rule.minOccurrences ?? 1;
    if (count < min) {
      result.missingRequiredConnectionRuleIds.push(rule.id);
      add(result, message("error", "REQUIRED_CONNECTION_RULE_MISSING", `${viewpoint.name} requires ${rule.description}.`, diagram.id, rule.id, "required-rule", "connection-rule"));
    }
    if (typeof rule.maxOccurrences === "number" && count > rule.maxOccurrences) add(result, message(rule.severity, "CONNECTION_RULE_MAX_EXCEEDED", `${rule.description} may occur at most ${rule.maxOccurrences} times.`, diagram.id, rule.id, "required-rule", "connection-rule"));
  }

  result.valid = result.errors.length === 0;
  return result;
}

export function validateValidationRules(diagram: Diagram, state: SidebarState): ValidationResult {
  const result = emptyResult();
  const diagramComponents = diagram.componentIds
    .map((id) => state.components.find((component) => component.id === id))
    .filter((component): component is ComponentInstance => Boolean(component));
  const diagramConnections = diagram.connectionIds
    .map((id) => state.connections.find((connection) => connection.id === id))
    .filter((connection): connection is ConnectionInstance => Boolean(connection));

  for (const rule of state.validationRules ?? []) {
    if (!rule.active) continue;
    if (rule.scope === "viewpoint" && rule.viewpointId !== diagram.viewpointId) continue;
    if (!rule.sourceComponentTypeId || !rule.requiredConnectionTypeId || !rule.targetComponentTypeId) continue;
    for (const component of diagramComponents.filter((item) => item.componentTypeId === rule.sourceComponentTypeId)) {
      const count = diagramConnections.filter((connection) => {
        if (connection.connectionTypeId !== rule.requiredConnectionTypeId) return false;
        if (rule.direction === "outgoing") {
          if (connection.sourceComponentId !== component.id) return false;
          const target = state.components.find((item) => item.id === connection.targetComponentId);
          return target?.componentTypeId === rule.targetComponentTypeId;
        }
        if (connection.targetComponentId !== component.id) return false;
        const source = state.components.find((item) => item.id === connection.sourceComponentId);
        return source?.componentTypeId === rule.targetComponentTypeId;
      }).length;
      if (count < rule.minOccurrences) add(result, message(rule.severity, "VALIDATION_RULE_MIN_OCCURRENCES", `${component.name}: ${rule.message}`, component.id, rule.id, "required-rule", "validation-rule"));
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}

export function validateDiagram(diagram: Diagram, state: SidebarState, options: ValidationOptions = {}): ValidationResult {
  const includeRequiredRules = options.includeRequiredRules ?? true;
  const result = emptyResult();
  const viewpoint = diagram.viewpointId ? state.viewpoints.find((item) => item.id === diagram.viewpointId) : undefined;

  if (diagram.metamodelId && diagram.metamodelId !== state.metamodel.id) add(result, message("error", "METAMODEL_MISMATCH", `Diagram violates Metamodel: expected '${state.metamodel.name}' but references '${diagram.metamodelId}'.`, diagram.id, state.metamodel.id, "metamodel"));
  if (diagram.viewpointId && !viewpoint) add(result, message("error", "VIEWPOINT_MISSING", `Viewpoint '${diagram.viewpointId}' does not exist.`, diagram.id, undefined, "viewpoint"));

  for (const id of diagram.componentIds.filter((componentId) => !state.components.some((component) => component.id === componentId))) add(result, message("error", "DIAGRAM_COMPONENT_MISSING", `Diagram references missing component '${id}'.`, diagram.id, undefined, "diagram"));

  const diagramConnections = diagram.connectionIds
    .map((id) => state.connections.find((connection) => connection.id === id))
    .filter((connection): connection is ConnectionInstance => Boolean(connection));
  for (const id of diagram.connectionIds.filter((connectionId) => !state.connections.some((connection) => connection.id === connectionId))) add(result, message("error", "DIAGRAM_CONNECTION_MISSING", `Diagram references missing connection '${id}'.`, diagram.id, undefined, "diagram"));

  for (const connection of diagramConnections) {
    merge(result, validateConnectionInstance(connection, state, diagram));
    if (!diagram.componentIds.includes(connection.sourceComponentId) || !diagram.componentIds.includes(connection.targetComponentId)) add(result, message("error", "CONNECTION_ENDPOINTS_HIDDEN", "Connection endpoints must both be visible in the diagram.", connection.id, undefined, "diagram"));
  }

  if (viewpoint) {
    merge(result, validateViewpointCompliance(diagram, viewpoint, state));
    if (includeRequiredRules) merge(result, validateRequiredRules(diagram, viewpoint, state));
  }

  if (includeRequiredRules) merge(result, validateValidationRules(diagram, state));

  result.valid = result.errors.length === 0;
  return result;
}
