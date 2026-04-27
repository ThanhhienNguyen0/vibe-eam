import type { EamElement, EamModel, EamRelation, ElementType, Layer, RelationType } from "./types.js";

export type ImpactMode = "downstream" | "upstream";

export interface RelationRule {
  sourceType: ElementType;
  relationType: RelationType;
  targetType: ElementType;
  description: string;
  mvpShortcut?: boolean;
}

export interface AnalysisStep {
  elementId: string;
  relationId: string;
  relationType: RelationType;
  depth: number;
  path: string[];
}

export const layerByElementType: Record<ElementType, Layer> = {
  "Business Capability": "Business",
  "Business Process": "Business",
  "Application Component": "Application",
  "Data Object": "Data",
  "Technology Node": "Technology"
};

export const relationRules: RelationRule[] = [
  {
    sourceType: "Business Process",
    relationType: "realizes",
    targetType: "Business Capability",
    description: "A business process realizes a business capability by operationalizing it."
  },
  {
    sourceType: "Application Component",
    relationType: "serves",
    targetType: "Business Process",
    description: "An application component serves a business process."
  },
  {
    sourceType: "Application Component",
    relationType: "uses",
    targetType: "Data Object",
    description: "An application component uses a data object."
  },
  {
    sourceType: "Application Component",
    relationType: "depends_on",
    targetType: "Technology Node",
    description: "An application component depends on a technology node."
  },
  {
    sourceType: "Application Component",
    relationType: "depends_on",
    targetType: "Application Component",
    description: "An application component depends on another application component."
  },
  {
    sourceType: "Data Object",
    relationType: "depends_on",
    targetType: "Technology Node",
    description: "A data object depends on the technology node that stores or provides it."
  },
  {
    sourceType: "Technology Node",
    relationType: "depends_on",
    targetType: "Technology Node",
    description: "A technology node depends on another technology node."
  },
  {
    sourceType: "Application Component",
    relationType: "realizes",
    targetType: "Business Capability",
    description: "MVP shortcut: an application component directly realizes a capability when process modelling is skipped.",
    mvpShortcut: true
  }
];

export function getAllowedRelationRules(sourceType?: ElementType, targetType?: ElementType): RelationRule[] {
  return relationRules.filter((rule) => {
    const sourceMatches = !sourceType || rule.sourceType === sourceType;
    const targetMatches = !targetType || rule.targetType === targetType;
    return sourceMatches && targetMatches;
  });
}

export function getAllowedRelationTypes(sourceType?: ElementType, targetType?: ElementType): RelationType[] {
  return Array.from(new Set(getAllowedRelationRules(sourceType, targetType).map((rule) => rule.relationType)));
}

export function findRelationRule(sourceType: ElementType, relationType: RelationType, targetType: ElementType): RelationRule | undefined {
  return relationRules.find(
    (rule) => rule.sourceType === sourceType && rule.relationType === relationType && rule.targetType === targetType
  );
}

export function isRelationAllowed(sourceType: ElementType, relationType: RelationType, targetType: ElementType): boolean {
  return Boolean(findRelationRule(sourceType, relationType, targetType));
}

export function describeRelationViolation(sourceType: ElementType, relationType: RelationType, targetType: ElementType): string {
  return `Relation '${relationType}' from ${sourceType} to ${targetType} is not allowed by the EAM metamodel.`;
}

function elementById(model: EamModel): Map<string, EamElement> {
  return new Map(model.elements.map((element) => [element.id, element]));
}

function nextAnalysisSteps(currentId: string, model: EamModel, mode: ImpactMode): Array<{ relation: EamRelation; nextId: string }> {
  if (mode === "downstream") {
    return model.relations.flatMap((relation) => {
      if ((relation.type === "depends_on" || relation.type === "uses") && relation.target === currentId) {
        return [{ relation, nextId: relation.source }];
      }
      if ((relation.type === "serves" || relation.type === "realizes") && relation.source === currentId) {
        return [{ relation, nextId: relation.target }];
      }
      return [];
    });
  }

  return model.relations.flatMap((relation) => {
    if ((relation.type === "depends_on" || relation.type === "uses") && relation.source === currentId) {
      return [{ relation, nextId: relation.target }];
    }
    if ((relation.type === "serves" || relation.type === "realizes") && relation.target === currentId) {
      return [{ relation, nextId: relation.source }];
    }
    return [];
  });
}

export function analyzeImpact(model: EamModel, startId: string, mode: ImpactMode): AnalysisStep[] {
  const elements = elementById(model);
  if (!elements.has(startId)) return [];

  const results: AnalysisStep[] = [];
  const visited = new Set<string>([startId]);
  const queue: Array<{ elementId: string; depth: number; path: string[] }> = [{ elementId: startId, depth: 0, path: [startId] }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    for (const step of nextAnalysisSteps(current.elementId, model, mode)) {
      if (visited.has(step.nextId) || !elements.has(step.nextId)) continue;
      const path = [...current.path, step.nextId];
      visited.add(step.nextId);
      results.push({
        elementId: step.nextId,
        relationId: step.relation.id,
        relationType: step.relation.type,
        depth: current.depth + 1,
        path
      });
      queue.push({ elementId: step.nextId, depth: current.depth + 1, path });
    }
  }

  return results;
}
