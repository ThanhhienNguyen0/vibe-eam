import { Prisma, PrismaClient } from "@prisma/client";
import type {
  ComponentInstance,
  ConnectionInstance,
  DiagramPosition,
  SidebarState
} from "../Sidebar/sidebarTypes.js";
import { removeDanglingInstanceReferences } from "./stateOperations.js";

export interface SidebarStateRepository {
  read(companyId: string): Promise<SidebarState | null>;
  write(state: SidebarState, companyId: string): Promise<SidebarState>;
  disconnect(): Promise<void>;
}

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const stringArray = (value: Prisma.JsonValue | null | undefined): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const objectValue = <T extends object>(value: Prisma.JsonValue | null | undefined, fallback: T): T =>
  value && typeof value === "object" && !Array.isArray(value) ? value as T : fallback;

function memberships(state: SidebarState): {
  componentDiagram: Map<string, { diagramId: string; position: DiagramPosition }>;
  connectionDiagram: Map<string, string>;
} {
  const componentDiagram = new Map<string, { diagramId: string; position: DiagramPosition }>();
  const connectionDiagram = new Map<string, string>();
  const viewpointIds = new Set(state.viewpoints.map((viewpoint) => viewpoint.id));

  for (const diagram of state.diagrams) {
    if (diagram.metamodelId && diagram.metamodelId !== state.metamodel.id) {
      throw new Error(`Diagram '${diagram.id}' must use the authenticated company's active metamodel.`);
    }
    if (diagram.viewpointId && !viewpointIds.has(diagram.viewpointId)) {
      throw new Error(`Diagram '${diagram.id}' must reference a viewpoint from the authenticated company.`);
    }
    for (const componentId of diagram.componentIds) {
      const previous = componentDiagram.get(componentId);
      if (previous && previous.diagramId !== diagram.id) {
        throw new Error(`ComponentInstance '${componentId}' belongs to more than one diagram; the database MVP supports one diagram per instance.`);
      }
      componentDiagram.set(componentId, { diagramId: diagram.id, position: diagram.positions[componentId] ?? { x: 0, y: 0 } });
    }
    for (const connectionId of diagram.connectionIds) {
      const previous = connectionDiagram.get(connectionId);
      if (previous && previous !== diagram.id) {
        throw new Error(`ConnectionInstance '${connectionId}' belongs to more than one diagram.`);
      }
      connectionDiagram.set(connectionId, diagram.id);
    }
  }

  const componentIds = new Set(state.components.map((component) => component.id));
  for (const connection of state.connections) {
    if (!componentIds.has(connection.sourceComponentId) || !componentIds.has(connection.targetComponentId)) {
      throw new Error(`ConnectionInstance '${connection.id}' must reference valid source and target ComponentInstances.`);
    }
    const diagramId = connectionDiagram.get(connection.id);
    if (diagramId && (
      componentDiagram.get(connection.sourceComponentId)?.diagramId !== diagramId ||
      componentDiagram.get(connection.targetComponentId)?.diagramId !== diagramId
    )) {
      throw new Error(`ConnectionInstance '${connection.id}' and both endpoints must belong to diagram '${diagramId}'.`);
    }
  }

  return { componentDiagram, connectionDiagram };
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

export class PrismaSidebarStateRepository implements SidebarStateRepository {
  constructor(private readonly prisma = new PrismaClient()) {}

  async read(companyId: string): Promise<SidebarState | null> {
    return this.prisma.$transaction(async (tx) => {
      const metamodel = await tx.metamodel.findFirst({ where: { companyId }, orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }] });
      if (!metamodel) return null;

      const [componentTypes, connectionTypes, connectionRules, viewpoints, viewpointRules, validationRules, diagrams, components, connections] = await Promise.all([
        tx.componentType.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.connectionType.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.connectionRule.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.viewpoint.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.viewpointRule.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.validationRule.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.diagram.findMany({
          where: { companyId, metamodelId: metamodel.id },
          include: { componentInstances: true, connectionInstances: true },
          orderBy: { createdAt: "asc" }
        }),
        tx.componentInstance.findMany({ where: { companyId, componentType: { metamodelId: metamodel.id } }, orderBy: { id: "asc" } }),
        tx.connectionInstance.findMany({ where: { companyId, connectionType: { metamodelId: metamodel.id } }, orderBy: { id: "asc" } })
      ]);

      return {
        metamodel: {
          id: metamodel.id,
          name: metamodel.name,
          description: metamodel.description,
          version: metamodel.version,
          isActive: metamodel.isActive,
          createdAt: metamodel.createdAt.toISOString(),
          updatedAt: metamodel.updatedAt.toISOString()
        },
        componentTypes: componentTypes.map((item) => withoutUndefined({
          id: item.id,
          name: item.name,
          description: item.description,
          layer: item.layer ?? undefined,
          category: item.category ?? undefined,
          color: item.color,
          icon: item.icon,
          shape: item.shape as SidebarState["componentTypes"][number]["shape"] ?? undefined,
          customPropertyKeys: stringArray(item.customPropertyKeys),
          isRequiredInViewpoint: item.isRequiredInViewpoint ?? undefined,
          allowedInViewpointIds: stringArray(item.allowedInViewpointIds),
          isAbstract: item.isAbstract,
          isStakeholderRelevant: item.isStakeholderRelevant
        })),
        connectionTypes: connectionTypes.map((item) => withoutUndefined({
          id: item.id,
          name: item.name,
          description: item.description,
          directionDescription: item.directionDescription ?? undefined,
          color: item.color,
          lineStyle: item.lineStyle as SidebarState["connectionTypes"][number]["lineStyle"],
          semanticCategory: item.semanticCategory ?? undefined,
          category: item.category ?? undefined,
          allowedSourceTypeIds: stringArray(item.allowedSourceTypeIds),
          allowedTargetTypeIds: stringArray(item.allowedTargetTypeIds),
          requiredForSourceTypes: stringArray(item.requiredForSourceTypes),
          requiredForTargetTypes: stringArray(item.requiredForTargetTypes)
        })),
        connectionRules: connectionRules.map((item) => withoutUndefined({
          id: item.id,
          sourceComponentTypeId: item.sourceComponentTypeId,
          connectionTypeId: item.connectionTypeId,
          targetComponentTypeId: item.targetComponentTypeId,
          allowed: item.allowed,
          required: item.required,
          severity: item.severity as SidebarState["connectionRules"][number]["severity"],
          description: item.description,
          rationale: item.rationale,
          viewpointIds: stringArray(item.viewpointIds),
          minOccurrences: item.minOccurrences ?? undefined,
          maxOccurrences: item.maxOccurrences ?? undefined
        })),
        viewpoints: viewpoints.map((item) => withoutUndefined({
          id: item.id,
          name: item.name,
          description: item.description,
          stakeholderRole: item.stakeholderRole,
          purpose: item.purpose,
          visibleLayerIds: stringArray(item.visibleLayerIds),
          allowedComponentTypeIds: stringArray(item.allowedComponentTypeIds),
          allowedConnectionTypeIds: stringArray(item.allowedConnectionTypeIds),
          requiredComponentTypeIds: stringArray(item.requiredComponentTypeIds),
          requiredConnectionTypeIds: stringArray(item.requiredConnectionTypeIds),
          requiredConnectionRuleIds: stringArray(item.requiredConnectionRuleIds),
          maxVisibleLayers: item.maxVisibleLayers ?? undefined
        })),
        viewpointRules: viewpointRules.map((item) => withoutUndefined({
          id: item.id,
          viewpointId: item.viewpointId,
          allowedComponentTypeIds: stringArray(item.allowedComponentTypeIds),
          allowedConnectionTypeIds: stringArray(item.allowedConnectionTypeIds),
          allowedConnectionRuleIds: stringArray(item.allowedConnectionRuleIds),
          requiredComponentTypeIds: stringArray(item.requiredComponentTypeIds),
          requiredConnectionTypeIds: stringArray(item.requiredConnectionTypeIds),
          requiredConnectionRuleIds: stringArray(item.requiredConnectionRuleIds),
          editableComponentTypeIds: stringArray(item.editableComponentTypeIds),
          visibleComponentTypeIds: stringArray(item.visibleComponentTypeIds),
          description: item.description ?? undefined,
          severity: item.severity as SidebarState["viewpointRules"][number]["severity"] ?? undefined
        })),
        validationRules: validationRules.map((item) => withoutUndefined({
          id: item.id,
          name: item.name,
          description: item.description,
          scope: item.scope as SidebarState["validationRules"][number]["scope"],
          viewpointId: item.viewpointId ?? undefined,
          sourceComponentTypeId: item.sourceComponentTypeId ?? undefined,
          requiredConnectionTypeId: item.requiredConnectionTypeId ?? undefined,
          targetComponentTypeId: item.targetComponentTypeId ?? undefined,
          direction: item.direction as SidebarState["validationRules"][number]["direction"],
          minOccurrences: item.minOccurrences,
          severity: item.severity as SidebarState["validationRules"][number]["severity"],
          message: item.message,
          active: item.active
        })),
        components: components.map((item): ComponentInstance => ({
          id: item.id,
          name: item.name,
          componentTypeId: item.componentTypeId,
          description: item.description,
          properties: objectValue(item.properties, {}) as Record<string, string>
        })),
        connections: connections.map((item): ConnectionInstance => ({
          id: item.id,
          name: item.name,
          connectionTypeId: item.connectionTypeId,
          sourceComponentId: item.sourceComponentId,
          targetComponentId: item.targetComponentId,
          description: item.description,
          properties: objectValue(item.properties, {}) as Record<string, string>
        })),
        diagrams: diagrams.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          metamodelId: item.metamodelId,
          viewpointId: item.viewpointId ?? undefined,
          componentIds: item.componentInstances.map((component) => component.id),
          connectionIds: item.connectionInstances.map((connection) => connection.id),
          positions: Object.fromEntries(item.componentInstances.map((component) => [
            component.id,
            objectValue(component.position, { x: 0, y: 0 })
          ]))
        }))
      };
    });
  }

  private async assertTenantIdsAvailable(state: SidebarState, companyId: string): Promise<void> {
    const foreignCounts = await Promise.all([
      this.prisma.metamodel.count({ where: { id: state.metamodel.id, companyId: { not: companyId } } }),
      this.prisma.componentType.count({ where: { id: { in: state.componentTypes.map((item) => item.id) }, metamodel: { companyId: { not: companyId } } } }),
      this.prisma.connectionType.count({ where: { id: { in: state.connectionTypes.map((item) => item.id) }, metamodel: { companyId: { not: companyId } } } }),
      this.prisma.connectionRule.count({ where: { id: { in: state.connectionRules.map((item) => item.id) }, metamodel: { companyId: { not: companyId } } } }),
      this.prisma.viewpoint.count({ where: { id: { in: state.viewpoints.map((item) => item.id) }, metamodel: { companyId: { not: companyId } } } }),
      this.prisma.viewpointRule.count({ where: { id: { in: state.viewpointRules.map((item) => item.id) }, metamodel: { companyId: { not: companyId } } } }),
      this.prisma.validationRule.count({ where: { id: { in: state.validationRules.map((item) => item.id) }, metamodel: { companyId: { not: companyId } } } }),
      this.prisma.diagram.count({ where: { id: { in: state.diagrams.map((item) => item.id) }, companyId: { not: companyId } } }),
      this.prisma.componentInstance.count({ where: { id: { in: state.components.map((item) => item.id) }, companyId: { not: companyId } } }),
      this.prisma.connectionInstance.count({ where: { id: { in: state.connections.map((item) => item.id) }, companyId: { not: companyId } } })
    ]);
    if (foreignCounts.some((count) => count > 0)) {
      throw new Error("One or more resource IDs are already owned by another company.");
    }
  }

  async write(state: SidebarState, companyId: string): Promise<SidebarState> {
    state = removeDanglingInstanceReferences(state);
    const { componentDiagram, connectionDiagram } = memberships(state);
    const metamodelId = state.metamodel.id;
    await this.assertTenantIdsAvailable(state, companyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.metamodel.updateMany({ where: { companyId }, data: { isActive: false } });
      await tx.metamodel.upsert({
        where: { id: metamodelId },
        create: {
          ...state.metamodel,
          companyId,
          createdAt: new Date(state.metamodel.createdAt),
          updatedAt: new Date(state.metamodel.updatedAt)
        },
        update: {
          name: state.metamodel.name,
          description: state.metamodel.description,
          version: state.metamodel.version,
          isActive: state.metamodel.isActive,
          updatedAt: new Date(state.metamodel.updatedAt)
        }
      });

      for (const item of state.componentTypes) {
        const data = {
          metamodelId,
          name: item.name,
          description: item.description,
          layer: item.layer,
          category: item.category,
          color: item.color,
          icon: item.icon,
          shape: item.shape,
          customPropertyKeys: json(item.customPropertyKeys),
          isRequiredInViewpoint: item.isRequiredInViewpoint,
          allowedInViewpointIds: json(item.allowedInViewpointIds ?? []),
          isAbstract: item.isAbstract ?? false,
          isStakeholderRelevant: item.isStakeholderRelevant ?? false
        };
        await tx.componentType.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const item of state.connectionTypes) {
        const data = {
          metamodelId,
          name: item.name,
          description: item.description,
          directionDescription: item.directionDescription,
          color: item.color,
          lineStyle: item.lineStyle,
          semanticCategory: item.semanticCategory,
          category: item.category,
          allowedSourceTypeIds: json(item.allowedSourceTypeIds),
          allowedTargetTypeIds: json(item.allowedTargetTypeIds),
          requiredForSourceTypes: json(item.requiredForSourceTypes ?? []),
          requiredForTargetTypes: json(item.requiredForTargetTypes ?? [])
        };
        await tx.connectionType.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const item of state.viewpoints) {
        const data = {
          metamodelId,
          name: item.name,
          description: item.description,
          stakeholderRole: item.stakeholderRole,
          purpose: item.purpose,
          visibleLayerIds: json(item.visibleLayerIds ?? []),
          allowedComponentTypeIds: json(item.allowedComponentTypeIds),
          allowedConnectionTypeIds: json(item.allowedConnectionTypeIds),
          requiredComponentTypeIds: json(item.requiredComponentTypeIds),
          requiredConnectionTypeIds: json(item.requiredConnectionTypeIds),
          requiredConnectionRuleIds: json(item.requiredConnectionRuleIds ?? []),
          maxVisibleLayers: item.maxVisibleLayers
        };
        await tx.viewpoint.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const item of state.connectionRules) {
        const data = {
          metamodelId,
          sourceComponentTypeId: item.sourceComponentTypeId,
          connectionTypeId: item.connectionTypeId,
          targetComponentTypeId: item.targetComponentTypeId,
          allowed: item.allowed,
          required: item.required,
          severity: item.severity,
          description: item.description,
          rationale: item.rationale,
          viewpointIds: json(item.viewpointIds ?? []),
          minOccurrences: item.minOccurrences,
          maxOccurrences: item.maxOccurrences
        };
        await tx.connectionRule.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const item of state.viewpointRules) {
        const data = {
          metamodelId,
          viewpointId: item.viewpointId,
          allowedComponentTypeIds: json(item.allowedComponentTypeIds),
          allowedConnectionTypeIds: json(item.allowedConnectionTypeIds),
          allowedConnectionRuleIds: json(item.allowedConnectionRuleIds),
          requiredComponentTypeIds: json(item.requiredComponentTypeIds),
          requiredConnectionTypeIds: json(item.requiredConnectionTypeIds),
          requiredConnectionRuleIds: json(item.requiredConnectionRuleIds),
          editableComponentTypeIds: json(item.editableComponentTypeIds ?? []),
          visibleComponentTypeIds: json(item.visibleComponentTypeIds ?? []),
          description: item.description,
          severity: item.severity
        };
        await tx.viewpointRule.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const item of state.validationRules) {
        const data = {
          metamodelId,
          name: item.name,
          description: item.description,
          scope: item.scope,
          viewpointId: item.viewpointId,
          sourceComponentTypeId: item.sourceComponentTypeId,
          requiredConnectionTypeId: item.requiredConnectionTypeId,
          targetComponentTypeId: item.targetComponentTypeId,
          direction: item.direction,
          minOccurrences: item.minOccurrences,
          severity: item.severity,
          message: item.message,
          active: item.active
        };
        await tx.validationRule.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const item of state.diagrams) {
        const data = {
          companyId,
          metamodelId,
          viewpointId: item.viewpointId,
          name: item.name,
          description: item.description
        };
        await tx.diagram.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const item of state.components) {
        const membership = componentDiagram.get(item.id);
        const data = {
          companyId,
          diagramId: membership?.diagramId,
          componentTypeId: item.componentTypeId,
          name: item.name,
          description: item.description,
          properties: json(item.properties),
          position: json(membership?.position ?? {})
        };
        await tx.componentInstance.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const item of state.connections) {
        const data = {
          companyId,
          diagramId: connectionDiagram.get(item.id),
          connectionTypeId: item.connectionTypeId,
          sourceComponentId: item.sourceComponentId,
          targetComponentId: item.targetComponentId,
          name: item.name,
          description: item.description,
          properties: json(item.properties ?? {})
        };
        await tx.connectionInstance.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }

      const missing = (ids: string[]) => ids.length > 0 ? { id: { notIn: ids } } : {};
      await tx.connectionInstance.deleteMany({ where: { companyId, connectionType: { metamodelId }, ...missing(state.connections.map((item) => item.id)) } });
      await tx.componentInstance.deleteMany({ where: { companyId, componentType: { metamodelId }, ...missing(state.components.map((item) => item.id)) } });
      await tx.diagram.deleteMany({ where: { companyId, metamodelId, ...missing(state.diagrams.map((item) => item.id)) } });
      await tx.validationRule.deleteMany({ where: { metamodelId, ...missing(state.validationRules.map((item) => item.id)) } });
      await tx.viewpointRule.deleteMany({ where: { metamodelId, ...missing(state.viewpointRules.map((item) => item.id)) } });
      await tx.connectionRule.deleteMany({ where: { metamodelId, ...missing(state.connectionRules.map((item) => item.id)) } });
      await tx.viewpoint.deleteMany({ where: { metamodelId, ...missing(state.viewpoints.map((item) => item.id)) } });
      await tx.connectionType.deleteMany({ where: { metamodelId, ...missing(state.connectionTypes.map((item) => item.id)) } });
      await tx.componentType.deleteMany({ where: { metamodelId, ...missing(state.componentTypes.map((item) => item.id)) } });
    }, { timeout: 30_000 });

    return (await this.read(companyId)) ?? structuredClone(state);
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

let singleton: PrismaSidebarStateRepository | undefined;

export function configuredStorageBackend(environment: NodeJS.ProcessEnv = process.env): "database" | "json" {
  const requested = environment.STORAGE_BACKEND?.trim().toLowerCase();
  const hasDatabaseUrl = Boolean(environment.DATABASE_URL?.trim());
  if (requested && requested !== "database" && requested !== "json") {
    throw new Error("STORAGE_BACKEND must be either 'database' or 'json'.");
  }
  if (requested === "database" && !hasDatabaseUrl) {
    throw new Error("DATABASE_URL is required when STORAGE_BACKEND=database.");
  }
  if (requested === "json") return "json";
  return hasDatabaseUrl ? "database" : "json";
}

export function databasePersistenceEnabled(): boolean {
  return configuredStorageBackend() === "database";
}

export function databaseSidebarRepository(): PrismaSidebarStateRepository {
  singleton ??= new PrismaSidebarStateRepository();
  return singleton;
}
