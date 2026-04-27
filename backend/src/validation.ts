import {
  elementTypes,
  relationTypes,
  riskLevels,
  statuses,
  type EamElement,
  type EamModel,
  type EamRelation
} from "./types.js";
import { describeRelationViolation, findRelationRule, layerByElementType } from "./metamodel.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function layerForType(type: EamElement["type"]): EamElement["layer"] {
  return layerByElementType[type] ?? "Business";
}

export function normalizeElement(input: unknown): EamElement {
  if (!isRecord(input)) {
    throw new Error("Element payload must be an object.");
  }

  const type = String(input.type ?? "Business Capability") as EamElement["type"];
  const layer = String(input.layer ?? layerForType(type)) as EamElement["layer"];

  return {
    id: String(input.id ?? crypto.randomUUID()),
    name: String(input.name ?? "New Element"),
    type,
    layer,
    description: String(input.description ?? ""),
    risk: String(input.risk ?? "medium") as EamElement["risk"],
    cost: Number(input.cost ?? 0),
    status: String(input.status ?? "planned") as EamElement["status"],
    startDate: String(input.startDate ?? new Date().toISOString().slice(0, 10)),
    endOfLifeDate: String(input.endOfLifeDate ?? ""),
    customAttributes: isRecord(input.customAttributes)
      ? Object.fromEntries(Object.entries(input.customAttributes).map(([key, value]) => [key, String(value)]))
      : {},
    position: isRecord(input.position)
      ? { x: Number(input.position.x ?? 0), y: Number(input.position.y ?? 0) }
      : { x: 80, y: 80 }
  };
}

export function validateElement(element: EamElement, existingIds: Set<string> = new Set()): ValidationResult {
  const errors: string[] = [];
  if (!element.id.trim()) errors.push("Element id is required.");
  if (existingIds.has(element.id)) errors.push(`Element id '${element.id}' already exists.`);
  if (!element.name.trim()) errors.push("Element name is required.");
  if (!elementTypes.includes(element.type)) errors.push(`Element type '${element.type}' is not allowed.`);
  if (elementTypes.includes(element.type) && element.layer !== layerByElementType[element.type]) {
    errors.push(`Element type '${element.type}' must be assigned to layer '${layerByElementType[element.type]}'.`);
  }
  if (!riskLevels.includes(element.risk)) errors.push(`Risk '${element.risk}' is not allowed.`);
  if (!statuses.includes(element.status)) errors.push(`Status '${element.status}' is not allowed.`);
  if (!Number.isFinite(element.cost) || element.cost < 0) errors.push("Cost must be a non-negative number.");
  if (typeof element.customAttributes !== "object" || Array.isArray(element.customAttributes)) {
    errors.push("Custom attributes must be a key-value object.");
  }
  return { valid: errors.length === 0, errors };
}

export function normalizeRelation(input: unknown): EamRelation {
  if (!isRecord(input)) {
    throw new Error("Relation payload must be an object.");
  }

  return {
    id: String(input.id ?? crypto.randomUUID()),
    source: String(input.source ?? ""),
    target: String(input.target ?? ""),
    type: String(input.type ?? "uses") as EamRelation["type"],
    description: String(input.description ?? "")
  };
}

export function validateRelation(relation: EamRelation, model: EamModel, existingIds: Set<string> = new Set()): ValidationResult {
  const elementIds = new Set(model.elements.map((element) => element.id));
  const errors: string[] = [];

  if (!relation.id.trim()) errors.push("Relation id is required.");
  if (existingIds.has(relation.id)) errors.push(`Relation id '${relation.id}' already exists.`);
  if (!elementIds.has(relation.source)) errors.push(`Relation source '${relation.source}' does not exist.`);
  if (!elementIds.has(relation.target)) errors.push(`Relation target '${relation.target}' does not exist.`);
  if (relation.source === relation.target) errors.push("Relation source and target must not be identical.");
  if (!relationTypes.includes(relation.type)) errors.push(`Relation type '${relation.type}' is not allowed.`);
  const sourceElement = model.elements.find((element) => element.id === relation.source);
  const targetElement = model.elements.find((element) => element.id === relation.target);
  if (sourceElement && targetElement && relationTypes.includes(relation.type)) {
    const rule = findRelationRule(sourceElement.type, relation.type, targetElement.type);
    if (!rule) {
      errors.push(describeRelationViolation(sourceElement.type, relation.type, targetElement.type));
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateModel(model: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(model)) {
    return { valid: false, errors: ["Imported model must be an object."] };
  }

  if (!Array.isArray(model.elements)) {
    errors.push("Imported model must contain an elements array.");
  }

  if (!Array.isArray(model.relations)) {
    errors.push("Imported model must contain a relations array.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const candidate = model as unknown as EamModel;
  const elementIds = new Set<string>();
  const relationIds = new Set<string>();

  for (const element of candidate.elements) {
    const result = validateElement(element, elementIds);
    errors.push(...result.errors);
    elementIds.add(element.id);
  }

  for (const relation of candidate.relations) {
    const result = validateRelation(relation, candidate, relationIds);
    errors.push(...result.errors);
    relationIds.add(relation.id);
  }

  return { valid: errors.length === 0, errors };
}
