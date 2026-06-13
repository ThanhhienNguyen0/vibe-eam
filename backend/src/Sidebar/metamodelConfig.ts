import type {
  ComponentType,
  ConnectionRule,
  ConnectionType,
  Metamodel,
  MetamodelDefinition,
  MetamodelImportIssue,
  MetamodelImportResult,
  SidebarState,
  ValidationRule,
  Viewpoint,
  ViewpointRule
} from "./sidebarTypes.js";

const emptyCounts = {
  componentTypes: 0,
  connectionTypes: 0,
  connectionRules: 0,
  viewpoints: 0,
  viewpointRules: 0,
  validationRules: 0
};

function issue(code: string, message: string, path?: string): MetamodelImportIssue {
  return { code, message, path };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasDuplicateIds(items: { id: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

function result(
  errors: MetamodelImportIssue[],
  warnings: MetamodelImportIssue[],
  definition?: MetamodelDefinition
): MetamodelImportResult {
  return {
    success: errors.length === 0,
    errors,
    warnings,
    importedCounts: definition
      ? {
          componentTypes: definition.componentTypes.length,
          connectionTypes: definition.connectionTypes.length,
          connectionRules: definition.connectionRules.length,
          viewpoints: definition.viewpoints.length,
          viewpointRules: definition.viewpointRules.length,
          validationRules: definition.validationRules.length
        }
      : emptyCounts
  };
}

function requireArray(input: Record<string, unknown>, key: keyof MetamodelDefinition, errors: MetamodelImportIssue[]): unknown[] {
  const value = input[key];
  if (!Array.isArray(value)) {
    errors.push(issue("METAMODEL_ARRAY_REQUIRED", `${String(key)} must be an array.`, String(key)));
    return [];
  }
  return value;
}

function readMetamodel(input: unknown, errors: MetamodelImportIssue[]): Metamodel {
  if (!isRecord(input)) {
    errors.push(issue("METAMODEL_REQUIRED", "metamodel must be an object.", "metamodel"));
    return { id: "", name: "", description: "", version: "", isActive: true, createdAt: "", updatedAt: "" };
  }
  for (const key of ["id", "name", "description", "version"] as const) {
    if (!isNonEmptyString(input[key])) errors.push(issue("METAMODEL_FIELD_REQUIRED", `metamodel.${key} is required.`, `metamodel.${key}`));
  }
  return {
    id: String(input.id ?? ""),
    name: String(input.name ?? ""),
    description: String(input.description ?? ""),
    version: String(input.version ?? ""),
    isActive: typeof input.isActive === "boolean" ? input.isActive : true,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function readComponentTypes(items: unknown[], errors: MetamodelImportIssue[]): ComponentType[] {
  return items.flatMap((item, index) => {
    if (!isRecord(item)) {
      errors.push(issue("COMPONENT_TYPE_OBJECT_REQUIRED", "Component type must be an object.", `componentTypes.${index}`));
      return [];
    }
    for (const key of ["id", "name", "description", "color", "icon"] as const) {
      if (!isNonEmptyString(item[key])) errors.push(issue("COMPONENT_TYPE_FIELD_REQUIRED", `componentTypes.${index}.${key} is required.`, `componentTypes.${index}.${key}`));
    }
    if (item.customPropertyKeys !== undefined && !isStringArray(item.customPropertyKeys)) {
      errors.push(issue("COMPONENT_TYPE_CUSTOM_PROPERTIES_INVALID", "customPropertyKeys must be an array of strings.", `componentTypes.${index}.customPropertyKeys`));
    }
    return [{
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      color: String(item.color ?? "#475569"),
      icon: String(item.icon ?? "box"),
      description: String(item.description ?? ""),
      customPropertyKeys: isStringArray(item.customPropertyKeys) ? item.customPropertyKeys : [],
      shape: typeof item.shape === "string" ? item.shape as ComponentType["shape"] : "box",
      category: typeof item.category === "string" ? item.category : undefined,
      layer: typeof item.layer === "string" ? item.layer : typeof item.category === "string" ? item.category : "Other",
      isAbstract: typeof item.isAbstract === "boolean" ? item.isAbstract : undefined,
      isStakeholderRelevant: typeof item.isStakeholderRelevant === "boolean" ? item.isStakeholderRelevant : undefined,
      isRequiredInViewpoint: typeof item.isRequiredInViewpoint === "boolean" ? item.isRequiredInViewpoint : undefined,
      allowedInViewpointIds: isStringArray(item.allowedInViewpointIds) ? item.allowedInViewpointIds : undefined
    }];
  });
}

function readConnectionTypes(items: unknown[], errors: MetamodelImportIssue[]): ConnectionType[] {
  return items.flatMap((item, index) => {
    if (!isRecord(item)) {
      errors.push(issue("CONNECTION_TYPE_OBJECT_REQUIRED", "Connection type must be an object.", `connectionTypes.${index}`));
      return [];
    }
    for (const key of ["id", "name", "description", "color"] as const) {
      if (!isNonEmptyString(item[key])) errors.push(issue("CONNECTION_TYPE_FIELD_REQUIRED", `connectionTypes.${index}.${key} is required.`, `connectionTypes.${index}.${key}`));
    }
    if (!["solid", "dashed", "dotted"].includes(String(item.lineStyle ?? ""))) {
      errors.push(issue("CONNECTION_TYPE_LINE_STYLE_INVALID", "lineStyle must be solid, dashed or dotted.", `connectionTypes.${index}.lineStyle`));
    }
    return [{
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      color: String(item.color ?? "#475569"),
      lineStyle: ["solid", "dashed", "dotted"].includes(String(item.lineStyle)) ? item.lineStyle as ConnectionType["lineStyle"] : "solid",
      allowedSourceTypeIds: isStringArray(item.allowedSourceTypeIds) ? item.allowedSourceTypeIds : [],
      allowedTargetTypeIds: isStringArray(item.allowedTargetTypeIds) ? item.allowedTargetTypeIds : [],
      description: String(item.description ?? ""),
      category: typeof item.category === "string" ? item.category : undefined,
      requiredForSourceTypes: isStringArray(item.requiredForSourceTypes) ? item.requiredForSourceTypes : [],
      requiredForTargetTypes: isStringArray(item.requiredForTargetTypes) ? item.requiredForTargetTypes : [],
      directionDescription: typeof item.directionDescription === "string" ? item.directionDescription : undefined,
      semanticCategory: typeof item.semanticCategory === "string" ? item.semanticCategory : undefined
    }];
  });
}

function readConnectionRules(items: unknown[], errors: MetamodelImportIssue[]): ConnectionRule[] {
  return items.flatMap((item, index) => {
    if (!isRecord(item)) {
      errors.push(issue("CONNECTION_RULE_OBJECT_REQUIRED", "Connection rule must be an object.", `connectionRules.${index}`));
      return [];
    }
    for (const key of ["id", "sourceComponentTypeId", "connectionTypeId", "targetComponentTypeId", "description", "rationale"] as const) {
      if (!isNonEmptyString(item[key])) errors.push(issue("CONNECTION_RULE_FIELD_REQUIRED", `connectionRules.${index}.${key} is required.`, `connectionRules.${index}.${key}`));
    }
    if (typeof item.id === "string" && item.id.startsWith("legacy-rule-")) {
      errors.push(issue("LEGACY_CONNECTION_RULE_NOT_ALLOWED", "legacy-rule-* entries are migration artifacts and must not be imported as metamodel rules.", `connectionRules.${index}.id`));
    }
    if (typeof item.allowed !== "boolean") errors.push(issue("CONNECTION_RULE_ALLOWED_REQUIRED", "allowed must be boolean.", `connectionRules.${index}.allowed`));
    if (typeof item.required !== "boolean") errors.push(issue("CONNECTION_RULE_REQUIRED_REQUIRED", "required must be boolean.", `connectionRules.${index}.required`));
    if (!["error", "warning"].includes(String(item.severity ?? ""))) errors.push(issue("CONNECTION_RULE_SEVERITY_INVALID", "severity must be error or warning.", `connectionRules.${index}.severity`));
    return [{
      id: String(item.id ?? ""),
      sourceComponentTypeId: String(item.sourceComponentTypeId ?? ""),
      connectionTypeId: String(item.connectionTypeId ?? ""),
      targetComponentTypeId: String(item.targetComponentTypeId ?? ""),
      allowed: typeof item.allowed === "boolean" ? item.allowed : true,
      required: typeof item.required === "boolean" ? item.required : false,
      severity: item.severity === "warning" ? "warning" : "error",
      description: String(item.description ?? ""),
      rationale: String(item.rationale ?? ""),
      viewpointIds: isStringArray(item.viewpointIds) ? item.viewpointIds : undefined,
      minOccurrences: typeof item.minOccurrences === "number" ? item.minOccurrences : undefined,
      maxOccurrences: typeof item.maxOccurrences === "number" ? item.maxOccurrences : undefined
    }];
  });
}

function readViewpoints(items: unknown[], errors: MetamodelImportIssue[]): Viewpoint[] {
  return items.flatMap((item, index) => {
    if (!isRecord(item)) {
      errors.push(issue("VIEWPOINT_OBJECT_REQUIRED", "Viewpoint must be an object.", `viewpoints.${index}`));
      return [];
    }
    for (const key of ["id", "name", "description", "stakeholderRole", "purpose"] as const) {
      if (!isNonEmptyString(item[key])) errors.push(issue("VIEWPOINT_FIELD_REQUIRED", `viewpoints.${index}.${key} is required.`, `viewpoints.${index}.${key}`));
    }
    return [{
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      stakeholderRole: String(item.stakeholderRole ?? ""),
      purpose: String(item.purpose ?? ""),
      allowedComponentTypeIds: isStringArray(item.allowedComponentTypeIds) ? item.allowedComponentTypeIds : [],
      allowedConnectionTypeIds: isStringArray(item.allowedConnectionTypeIds) ? item.allowedConnectionTypeIds : [],
      requiredComponentTypeIds: isStringArray(item.requiredComponentTypeIds) ? item.requiredComponentTypeIds : [],
      requiredConnectionTypeIds: isStringArray(item.requiredConnectionTypeIds) ? item.requiredConnectionTypeIds : [],
      requiredConnectionRuleIds: isStringArray(item.requiredConnectionRuleIds) ? item.requiredConnectionRuleIds : [],
      maxVisibleLayers: typeof item.maxVisibleLayers === "number" ? item.maxVisibleLayers : undefined,
      visibleLayerIds: isStringArray(item.visibleLayerIds) ? item.visibleLayerIds : undefined
    }];
  });
}

function readViewpointRules(items: unknown[], errors: MetamodelImportIssue[]): ViewpointRule[] {
  return items.flatMap((item, index) => {
    if (!isRecord(item)) {
      errors.push(issue("VIEWPOINT_RULE_OBJECT_REQUIRED", "Viewpoint rule must be an object.", `viewpointRules.${index}`));
      return [];
    }
    for (const key of ["id", "viewpointId"] as const) {
      if (!isNonEmptyString(item[key])) errors.push(issue("VIEWPOINT_RULE_FIELD_REQUIRED", `viewpointRules.${index}.${key} is required.`, `viewpointRules.${index}.${key}`));
    }
    for (const key of ["allowedComponentTypeIds", "allowedConnectionTypeIds", "allowedConnectionRuleIds", "requiredComponentTypeIds", "requiredConnectionTypeIds", "requiredConnectionRuleIds"] as const) {
      if (!isStringArray(item[key])) errors.push(issue("VIEWPOINT_RULE_ARRAY_REQUIRED", `${key} must be an array of strings.`, `viewpointRules.${index}.${key}`));
    }
    return [{
      id: String(item.id ?? ""),
      viewpointId: String(item.viewpointId ?? ""),
      allowedComponentTypeIds: isStringArray(item.allowedComponentTypeIds) ? item.allowedComponentTypeIds : [],
      allowedConnectionTypeIds: isStringArray(item.allowedConnectionTypeIds) ? item.allowedConnectionTypeIds : [],
      allowedConnectionRuleIds: isStringArray(item.allowedConnectionRuleIds) ? item.allowedConnectionRuleIds : [],
      requiredComponentTypeIds: isStringArray(item.requiredComponentTypeIds) ? item.requiredComponentTypeIds : [],
      requiredConnectionTypeIds: isStringArray(item.requiredConnectionTypeIds) ? item.requiredConnectionTypeIds : [],
      requiredConnectionRuleIds: isStringArray(item.requiredConnectionRuleIds) ? item.requiredConnectionRuleIds : [],
      description: typeof item.description === "string" ? item.description : undefined,
      editableComponentTypeIds: isStringArray(item.editableComponentTypeIds) ? item.editableComponentTypeIds : undefined,
      visibleComponentTypeIds: isStringArray(item.visibleComponentTypeIds) ? item.visibleComponentTypeIds : undefined,
      severity: item.severity === "warning" ? "warning" : item.severity === "error" ? "error" : undefined
    }];
  });
}

function readValidationRules(items: unknown[], errors: MetamodelImportIssue[]): ValidationRule[] {
  return items.flatMap((item, index) => {
    if (!isRecord(item)) {
      errors.push(issue("VALIDATION_RULE_OBJECT_REQUIRED", "Validation rule must be an object.", `validationRules.${index}`));
      return [];
    }
    for (const key of ["id", "name", "description", "message"] as const) {
      if (!isNonEmptyString(item[key])) errors.push(issue("VALIDATION_RULE_FIELD_REQUIRED", `validationRules.${index}.${key} is required.`, `validationRules.${index}.${key}`));
    }
    if (!["metamodel", "viewpoint"].includes(String(item.scope ?? ""))) errors.push(issue("VALIDATION_RULE_SCOPE_INVALID", "scope must be metamodel or viewpoint.", `validationRules.${index}.scope`));
    if (!["incoming", "outgoing"].includes(String(item.direction ?? ""))) errors.push(issue("VALIDATION_RULE_DIRECTION_INVALID", "direction must be incoming or outgoing.", `validationRules.${index}.direction`));
    if (!["error", "warning"].includes(String(item.severity ?? ""))) errors.push(issue("VALIDATION_RULE_SEVERITY_INVALID", "severity must be error or warning.", `validationRules.${index}.severity`));
    if (typeof item.minOccurrences !== "number") errors.push(issue("VALIDATION_RULE_MIN_OCCURRENCES_REQUIRED", "minOccurrences must be a number.", `validationRules.${index}.minOccurrences`));
    if (typeof item.active !== "boolean") errors.push(issue("VALIDATION_RULE_ACTIVE_REQUIRED", "active must be boolean.", `validationRules.${index}.active`));
    return [{
      id: String(item.id ?? ""),
      name: String(item.name ?? ""),
      description: String(item.description ?? ""),
      scope: item.scope === "viewpoint" ? "viewpoint" : "metamodel",
      viewpointId: typeof item.viewpointId === "string" ? item.viewpointId : undefined,
      sourceComponentTypeId: typeof item.sourceComponentTypeId === "string" ? item.sourceComponentTypeId : undefined,
      requiredConnectionTypeId: typeof item.requiredConnectionTypeId === "string" ? item.requiredConnectionTypeId : undefined,
      targetComponentTypeId: typeof item.targetComponentTypeId === "string" ? item.targetComponentTypeId : undefined,
      direction: item.direction === "incoming" ? "incoming" : "outgoing",
      minOccurrences: typeof item.minOccurrences === "number" ? item.minOccurrences : 1,
      severity: item.severity === "error" ? "error" : "warning",
      message: String(item.message ?? ""),
      active: typeof item.active === "boolean" ? item.active : true
    }];
  });
}

function validateUniqueIds(definition: MetamodelDefinition, errors: MetamodelImportIssue[]): void {
  for (const [key, items] of [
    ["componentTypes", definition.componentTypes],
    ["connectionTypes", definition.connectionTypes],
    ["connectionRules", definition.connectionRules],
    ["viewpoints", definition.viewpoints],
    ["viewpointRules", definition.viewpointRules],
    ["validationRules", definition.validationRules]
  ] as const) {
    for (const duplicate of hasDuplicateIds(items)) {
      errors.push(issue("DUPLICATE_ID", `Duplicate id '${duplicate}' in ${key}.`, key));
    }
  }
}

function validateReferences(definition: MetamodelDefinition, errors: MetamodelImportIssue[]): void {
  const componentTypeIds = new Set(definition.componentTypes.map((type) => type.id));
  const connectionTypeIds = new Set(definition.connectionTypes.map((type) => type.id));
  const connectionRuleIds = new Set(definition.connectionRules.map((rule) => rule.id));
  const viewpointIds = new Set(definition.viewpoints.map((viewpoint) => viewpoint.id));

  const requireReference = (set: Set<string>, id: string | undefined, code: string, message: string, path: string) => {
    if (id && !set.has(id)) errors.push(issue(code, message, path));
  };

  definition.connectionRules.forEach((rule, index) => {
    requireReference(componentTypeIds, rule.sourceComponentTypeId, "UNKNOWN_SOURCE_COMPONENT_TYPE", `ConnectionRule '${rule.id}' references unknown sourceComponentTypeId '${rule.sourceComponentTypeId}'.`, `connectionRules.${index}.sourceComponentTypeId`);
    requireReference(componentTypeIds, rule.targetComponentTypeId, "UNKNOWN_TARGET_COMPONENT_TYPE", `ConnectionRule '${rule.id}' references unknown targetComponentTypeId '${rule.targetComponentTypeId}'.`, `connectionRules.${index}.targetComponentTypeId`);
    requireReference(connectionTypeIds, rule.connectionTypeId, "UNKNOWN_CONNECTION_TYPE", `ConnectionRule '${rule.id}' references unknown connectionTypeId '${rule.connectionTypeId}'.`, `connectionRules.${index}.connectionTypeId`);
    rule.viewpointIds?.forEach((viewpointId) => requireReference(viewpointIds, viewpointId, "UNKNOWN_RULE_VIEWPOINT", `ConnectionRule '${rule.id}' references unknown viewpoint '${viewpointId}'.`, `connectionRules.${index}.viewpointIds`));
  });

  definition.viewpointRules.forEach((rule, index) => {
    requireReference(viewpointIds, rule.viewpointId, "UNKNOWN_VIEWPOINT", `ViewpointRule '${rule.id}' references unknown viewpointId '${rule.viewpointId}'.`, `viewpointRules.${index}.viewpointId`);
    rule.allowedComponentTypeIds.forEach((id) => requireReference(componentTypeIds, id, "UNKNOWN_ALLOWED_COMPONENT_TYPE", `ViewpointRule '${rule.id}' references unknown allowed component type '${id}'.`, `viewpointRules.${index}.allowedComponentTypeIds`));
    rule.requiredComponentTypeIds.forEach((id) => requireReference(componentTypeIds, id, "UNKNOWN_REQUIRED_COMPONENT_TYPE", `ViewpointRule '${rule.id}' references unknown required component type '${id}'.`, `viewpointRules.${index}.requiredComponentTypeIds`));
    rule.visibleComponentTypeIds?.forEach((id) => requireReference(componentTypeIds, id, "UNKNOWN_VISIBLE_COMPONENT_TYPE", `ViewpointRule '${rule.id}' references unknown visible component type '${id}'.`, `viewpointRules.${index}.visibleComponentTypeIds`));
    rule.allowedConnectionTypeIds.forEach((id) => requireReference(connectionTypeIds, id, "UNKNOWN_ALLOWED_CONNECTION_TYPE", `ViewpointRule '${rule.id}' references unknown allowed connection type '${id}'.`, `viewpointRules.${index}.allowedConnectionTypeIds`));
    rule.requiredConnectionTypeIds.forEach((id) => requireReference(connectionTypeIds, id, "UNKNOWN_REQUIRED_CONNECTION_TYPE", `ViewpointRule '${rule.id}' references unknown required connection type '${id}'.`, `viewpointRules.${index}.requiredConnectionTypeIds`));
    rule.allowedConnectionRuleIds.forEach((id) => requireReference(connectionRuleIds, id, "UNKNOWN_ALLOWED_CONNECTION_RULE", `ViewpointRule '${rule.id}' references unknown allowed connection rule '${id}'.`, `viewpointRules.${index}.allowedConnectionRuleIds`));
    rule.requiredConnectionRuleIds.forEach((id) => requireReference(connectionRuleIds, id, "UNKNOWN_REQUIRED_CONNECTION_RULE", `ViewpointRule '${rule.id}' references unknown required connection rule '${id}'.`, `viewpointRules.${index}.requiredConnectionRuleIds`));
  });

  definition.viewpoints.forEach((viewpoint, index) => {
    viewpoint.allowedComponentTypeIds.forEach((id) => requireReference(componentTypeIds, id, "UNKNOWN_VIEWPOINT_COMPONENT_TYPE", `Viewpoint '${viewpoint.id}' references unknown component type '${id}'.`, `viewpoints.${index}.allowedComponentTypeIds`));
    viewpoint.requiredComponentTypeIds.forEach((id) => requireReference(componentTypeIds, id, "UNKNOWN_VIEWPOINT_REQUIRED_COMPONENT_TYPE", `Viewpoint '${viewpoint.id}' references unknown required component type '${id}'.`, `viewpoints.${index}.requiredComponentTypeIds`));
    viewpoint.allowedConnectionTypeIds.forEach((id) => requireReference(connectionTypeIds, id, "UNKNOWN_VIEWPOINT_CONNECTION_TYPE", `Viewpoint '${viewpoint.id}' references unknown connection type '${id}'.`, `viewpoints.${index}.allowedConnectionTypeIds`));
    viewpoint.requiredConnectionTypeIds.forEach((id) => requireReference(connectionTypeIds, id, "UNKNOWN_VIEWPOINT_REQUIRED_CONNECTION_TYPE", `Viewpoint '${viewpoint.id}' references unknown required connection type '${id}'.`, `viewpoints.${index}.requiredConnectionTypeIds`));
    viewpoint.requiredConnectionRuleIds?.forEach((id) => requireReference(connectionRuleIds, id, "UNKNOWN_VIEWPOINT_REQUIRED_CONNECTION_RULE", `Viewpoint '${viewpoint.id}' references unknown required connection rule '${id}'.`, `viewpoints.${index}.requiredConnectionRuleIds`));
  });

  definition.validationRules.forEach((rule, index) => {
    requireReference(componentTypeIds, rule.sourceComponentTypeId, "UNKNOWN_VALIDATION_SOURCE_TYPE", `ValidationRule '${rule.id}' references unknown source component type '${rule.sourceComponentTypeId}'.`, `validationRules.${index}.sourceComponentTypeId`);
    requireReference(componentTypeIds, rule.targetComponentTypeId, "UNKNOWN_VALIDATION_TARGET_TYPE", `ValidationRule '${rule.id}' references unknown target component type '${rule.targetComponentTypeId}'.`, `validationRules.${index}.targetComponentTypeId`);
    requireReference(connectionTypeIds, rule.requiredConnectionTypeId, "UNKNOWN_VALIDATION_CONNECTION_TYPE", `ValidationRule '${rule.id}' references unknown connection type '${rule.requiredConnectionTypeId}'.`, `validationRules.${index}.requiredConnectionTypeId`);
    requireReference(viewpointIds, rule.viewpointId, "UNKNOWN_VALIDATION_VIEWPOINT", `ValidationRule '${rule.id}' references unknown viewpoint '${rule.viewpointId}'.`, `validationRules.${index}.viewpointId`);
  });
}

export function extractMetamodelDefinition(state: SidebarState): MetamodelDefinition {
  return {
    metamodel: state.metamodel,
    componentTypes: state.componentTypes,
    connectionTypes: state.connectionTypes,
    connectionRules: state.connectionRules.filter((rule) => !rule.id.startsWith("legacy-rule-")),
    viewpoints: state.viewpoints,
    viewpointRules: state.viewpointRules,
    validationRules: state.validationRules
  };
}

export function validateMetamodelDefinition(input: unknown): MetamodelImportResult & { definition?: MetamodelDefinition } {
  const errors: MetamodelImportIssue[] = [];
  const warnings: MetamodelImportIssue[] = [];
  if (!isRecord(input)) {
    return result([issue("METAMODEL_JSON_OBJECT_REQUIRED", "Metamodel JSON must be an object.")], warnings);
  }

  const definition: MetamodelDefinition = {
    metamodel: readMetamodel(input.metamodel, errors),
    componentTypes: readComponentTypes(requireArray(input, "componentTypes", errors), errors),
    connectionTypes: readConnectionTypes(requireArray(input, "connectionTypes", errors), errors),
    connectionRules: readConnectionRules(requireArray(input, "connectionRules", errors), errors),
    viewpoints: readViewpoints(requireArray(input, "viewpoints", errors), errors),
    viewpointRules: readViewpointRules(requireArray(input, "viewpointRules", errors), errors),
    validationRules: readValidationRules(requireArray(input, "validationRules", errors), errors)
  };

  validateUniqueIds(definition, errors);
  validateReferences(definition, errors);

  if (definition.connectionRules.length === 0) {
    warnings.push(issue("NO_CONNECTION_RULES", "The metamodel contains no ConnectionRules. Diagram building will reject new connections."));
  }
  if (definition.viewpointRules.length === 0) {
    warnings.push(issue("NO_VIEWPOINT_RULES", "The metamodel contains no ViewpointRules. Viewpoint filtering will fall back to legacy Viewpoint fields."));
  }

  return { ...result(errors, warnings, definition), definition: errors.length === 0 ? definition : undefined };
}

export function applyMetamodelDefinition(state: SidebarState, definition: MetamodelDefinition): SidebarState {
  const viewpointIds = new Set(definition.viewpoints.map((viewpoint) => viewpoint.id));
  return {
    ...state,
    metamodel: definition.metamodel,
    componentTypes: definition.componentTypes,
    connectionTypes: definition.connectionTypes,
    connectionRules: definition.connectionRules,
    viewpoints: definition.viewpoints,
    viewpointRules: definition.viewpointRules,
    validationRules: definition.validationRules,
    diagrams: state.diagrams.map((diagram) => ({
      ...diagram,
      metamodelId: definition.metamodel.id,
      viewpointId: diagram.viewpointId && viewpointIds.has(diagram.viewpointId) ? diagram.viewpointId : undefined
    }))
  };
}
