import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type {
  ComponentInstance,
  ConnectionInstance,
  Diagram,
  SidebarState
} from "../Sidebar/sidebarTypes.js";
import { auditMutation, diffSidebarStates } from "../audit/auditDiff.js";
import type {
  AuditActorInput,
  AuditEntry,
  AuditFieldChange,
  AuditMutationInput,
  AuditPage,
  AuditQuery,
  AuditWrite
} from "../audit/auditTypes.js";
import { removeDanglingInstanceReferences } from "./stateOperations.js";

/** `catalogs` is undefined until the company stored catalogs once, so starter catalogs can be seeded. */
export type PersistedSidebarState = Omit<SidebarState, "catalogs"> & { catalogs?: SidebarState["catalogs"] };

export interface SidebarStateRepository {
  read(companyId: string): Promise<PersistedSidebarState | null>;
  /** Writes the whole state; an optional audit entry is stored in the same transaction. */
  write(state: SidebarState, companyId: string, audit?: AuditWrite): Promise<SidebarState>;
  listAudit(companyId: string, query: AuditQuery): Promise<AuditPage>;
  disconnect(): Promise<void>;
}

export class TenantResourceIdConflictError extends Error {}
export class ResourceNotFoundError extends Error {}
export class OptimisticLockError<T = unknown> extends Error {
  constructor(readonly current: T, message = "The resource was changed by another request.") {
    super(message);
  }
}

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const stringArray = (value: Prisma.JsonValue | null | undefined): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const objectValue = <T extends object>(value: Prisma.JsonValue | null | undefined, fallback: T): T =>
  value && typeof value === "object" && !Array.isArray(value) ? value as T : fallback;
const withoutVersion = <T extends { version?: unknown }>(value: T): Omit<T, "version"> => {
  const business = { ...value };
  delete business.version;
  return business;
};

export function assertDiagramMemberships(state: SidebarState): void {
  const viewpointIds = new Set(state.viewpoints.map((viewpoint) => viewpoint.id));
  const componentIds = new Set(state.components.map((component) => component.id));
  const connections = new Map(state.connections.map((connection) => [connection.id, connection]));

  for (const diagram of state.diagrams) {
    if (diagram.metamodelId && diagram.metamodelId !== state.metamodel.id) {
      throw new Error(`Diagram '${diagram.id}' must use the authenticated company's active metamodel.`);
    }
    if (diagram.viewpointId && !viewpointIds.has(diagram.viewpointId)) {
      throw new Error(`Diagram '${diagram.id}' must reference a viewpoint from the authenticated company.`);
    }
    for (const componentId of diagram.componentIds) {
      if (!componentIds.has(componentId)) {
        throw new Error(`Diagram '${diagram.id}' references missing ComponentInstance '${componentId}'.`);
      }
    }
    const diagramComponentIds = new Set(diagram.componentIds);
    for (const connectionId of diagram.connectionIds) {
      const connection = connections.get(connectionId);
      if (!connection) {
        throw new Error(`Diagram '${diagram.id}' references missing ConnectionInstance '${connectionId}'.`);
      }
      if (!diagramComponentIds.has(connection.sourceComponentId) || !diagramComponentIds.has(connection.targetComponentId)) {
        throw new Error(`ConnectionInstance '${connectionId}' and both endpoints must belong to diagram '${diagram.id}'.`);
      }
    }
  }

  for (const connection of state.connections) {
    if (!componentIds.has(connection.sourceComponentId) || !componentIds.has(connection.targetComponentId)) {
      throw new Error(`ConnectionInstance '${connection.id}' must reference valid source and target ComponentInstances.`);
    }
  }
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

export class PrismaSidebarStateRepository implements SidebarStateRepository {
  constructor(
    private readonly prisma = new PrismaClient(),
    private readonly afterReadSnapshotEstablished?: () => Promise<void>,
    private readonly afterCompanyLockAcquired?: () => Promise<void>
  ) {}

  private async appendAuditEntries(
    tx: Prisma.TransactionClient,
    companyId: string,
    actorInput: AuditActorInput,
    mutations: AuditMutationInput[],
    event?: AuditWrite["event"]
  ): Promise<void> {
    if (mutations.length === 0 && !event) return;
    const actor = actorInput.type === "user"
      ? await tx.user.findFirst({
        where: { id: actorInput.userId, companyId },
        select: { id: true, email: true, name: true }
      })
      : null;
    if (actorInput.type === "user" && !actor) {
      throw new Error("Authenticated audit actor no longer belongs to the company.");
    }
    const actorType = actorInput.type;
    const actorLabel = actor ? actor.name ?? actor.email : actorInput.type === "system" ? actorInput.label : null;
    const occurredAt = new Date();
    const batchId = mutations.length + (event ? 1 : 0) > 1 ? randomUUID() : null;
    const rows: Array<{
      action: string;
      entityType: string;
      entityId?: string;
      summary: string;
      changes: AuditFieldChange[];
      details?: Record<string, unknown>;
    }> = [
      ...mutations,
      ...(event ? [{
        ...event,
        changes: [] as AuditFieldChange[],
        details: { ...(event.details ?? {}), affectedObjectEntries: mutations.length }
      }] : [])
    ];
    for (const row of rows) {
      const rawDetails = row.details ?? {};
      const details = JSON.stringify(rawDetails).length <= 32_000
        ? rawDetails
        : { truncated: true, reason: "Auditdetails überschritten 32000 Zeichen." };
      await tx.auditLogEntry.create({
        data: {
          companyId,
          userId: actor?.id ?? null,
          userEmail: actor?.email ?? null,
          actorType,
          actorLabel,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId ?? null,
          summary: row.summary.slice(0, 500),
          changes: json(row.changes),
          details: json(details),
          batchId,
          occurredAt
        }
      });
    }
  }

  private async withLockedCompany<T>(
    companyId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    currentOnConflict: () => Promise<unknown>
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const company = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE
        `;
        if (company.length !== 1) throw new ResourceNotFoundError("Company not found.");
        await this.afterCompanyLockAcquired?.();
        return operation(tx);
      }, { timeout: 30_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new OptimisticLockError(await currentOnConflict(), "Concurrent transaction conflict.");
      }
      throw error;
    }
  }

  async read(companyId: string): Promise<PersistedSidebarState | null> {
    return this.prisma.$transaction(async (tx) => {
      const metamodel = await tx.metamodel.findFirst({ where: { companyId }, orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }] });
      if (!metamodel) return null;
      await this.afterReadSnapshotEstablished?.();

      const [componentTypes, connectionTypes, connectionRules, viewpoints, viewpointRules, validationRules, diagrams, components, connections, catalogRows, company] = await Promise.all([
        tx.componentType.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.connectionType.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.connectionRule.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.viewpoint.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.viewpointRule.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.validationRule.findMany({ where: { metamodelId: metamodel.id }, orderBy: { id: "asc" } }),
        tx.diagram.findMany({
          where: { companyId, metamodelId: metamodel.id },
          include: { componentMemberships: true, connectionMemberships: true },
          orderBy: { createdAt: "asc" }
        }),
        tx.componentInstance.findMany({ where: { companyId, componentType: { metamodelId: metamodel.id } }, orderBy: { id: "asc" } }),
        tx.connectionInstance.findMany({ where: { companyId, connectionType: { metamodelId: metamodel.id } }, orderBy: { id: "asc" } }),
        tx.catalog.findMany({ where: { companyId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
        tx.company.findUnique({ where: { id: companyId }, select: { catalogsInitialized: true, dataRevision: true } })
      ]);

      return {
        dataRevision: company?.dataRevision ?? 0,
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
        components: components.map((item): ComponentInstance => withoutUndefined({
          id: item.id,
          version: item.version,
          externalId: item.externalId ?? undefined,
          name: item.name,
          componentTypeId: item.componentTypeId,
          description: item.description,
          properties: objectValue(item.properties, {}) as Record<string, string>
        })),
        connections: connections.map((item): ConnectionInstance => withoutUndefined({
          id: item.id,
          version: item.version,
          externalId: item.externalId ?? undefined,
          name: item.name,
          connectionTypeId: item.connectionTypeId,
          sourceComponentId: item.sourceComponentId,
          targetComponentId: item.targetComponentId,
          description: item.description,
          properties: objectValue(item.properties, {}) as Record<string, string>
        })),
        catalogs: company?.catalogsInitialized ? catalogRows.map((item) => {
          const config = objectValue(item.config, {}) as Record<string, unknown>;
          return {
            id: item.id,
            name: item.name,
            description: item.description,
            kind: item.kind === "relations" ? "relations" as const : "elements" as const,
            componentTypeIds: stringArray(config.componentTypeIds as Prisma.JsonValue),
            connectionTypeIds: stringArray(config.connectionTypeIds as Prisma.JsonValue),
            propertyKeys: stringArray(config.propertyKeys as Prisma.JsonValue),
            columns: stringArray(config.columns as Prisma.JsonValue)
          };
        }) : undefined,
        diagrams: diagrams.map((item) => ({
          id: item.id,
          version: item.version,
          name: item.name,
          description: item.description,
          metamodelId: item.metamodelId,
          viewpointId: item.viewpointId ?? undefined,
          componentIds: item.componentMemberships.map((membership) => membership.componentId),
          connectionIds: item.connectionMemberships.map((membership) => membership.connectionId),
          positions: Object.fromEntries(item.componentMemberships.map((membership) => [
            membership.componentId,
            objectValue(membership.position, { x: 0, y: 0 })
          ]))
        }))
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
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
      this.prisma.catalog.count({ where: { id: { in: state.catalogs.map((item) => item.id) }, companyId: { not: companyId } } }),
      this.prisma.componentInstance.count({ where: { id: { in: state.components.map((item) => item.id) }, companyId: { not: companyId } } }),
      this.prisma.connectionInstance.count({ where: { id: { in: state.connections.map((item) => item.id) }, companyId: { not: companyId } } })
    ]);
    if (foreignCounts.some((count) => count > 0)) {
      throw new TenantResourceIdConflictError("One or more resource IDs are already owned by another company.");
    }
  }

  async write(state: SidebarState, companyId: string, audit?: AuditWrite): Promise<SidebarState> {
    state = removeDanglingInstanceReferences(state);
    assertDiagramMemberships(state);
    const metamodelId = state.metamodel.id;
    const auditMutations = audit
      ? audit.event?.action === "system.initialize" && audit.beforeState === null
        ? []
        : diffSidebarStates(audit.beforeState ?? null, state)
      : [];
    await this.assertTenantIdsAvailable(state, companyId);

    try {
      await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.company.updateMany({
        where: { id: companyId, dataRevision: state.dataRevision ?? 0 },
        data: { dataRevision: { increment: 1 } }
      });
      if (claimed.count !== 1) {
        const current = await tx.company.findUnique({ where: { id: companyId }, select: { dataRevision: true } });
        throw new OptimisticLockError(current, "The company data changed after it was read.");
      }
      await this.afterCompanyLockAcquired?.();
      const [storedComponents, storedConnections, storedDiagrams] = await Promise.all([
        tx.componentInstance.findMany({ where: { companyId } }),
        tx.connectionInstance.findMany({ where: { companyId } }),
        tx.diagram.findMany({
          where: { companyId },
          include: { componentMemberships: true, connectionMemberships: true }
        })
      ]);
      const storedComponentById = new Map(storedComponents.map((item) => [item.id, item]));
      const storedConnectionById = new Map(storedConnections.map((item) => [item.id, item]));
      const storedDiagramById = new Map(storedDiagrams.map((item) => [item.id, item]));
      const sameIds = (left: string[], right: string[]) => {
        const sortedLeft = [...left].sort();
        const sortedRight = [...right].sort();
        return sortedLeft.length === sortedRight.length && sortedLeft.every((id, index) => id === sortedRight[index]);
      };
      const componentVersion = (item: ComponentInstance) => {
        const current = storedComponentById.get(item.id);
        if (!current) return 1;
        const unchanged = current.componentTypeId === item.componentTypeId
          && current.externalId === (item.externalId ?? null)
          && current.name === item.name
          && current.description === item.description
          && isDeepStrictEqual(objectValue(current.properties, {}), item.properties);
        return current.version + (unchanged ? 0 : 1);
      };
      const connectionVersion = (item: ConnectionInstance) => {
        const current = storedConnectionById.get(item.id);
        if (!current) return 1;
        const unchanged = current.connectionTypeId === item.connectionTypeId
          && current.sourceComponentId === item.sourceComponentId
          && current.targetComponentId === item.targetComponentId
          && current.externalId === (item.externalId ?? null)
          && current.name === item.name
          && current.description === item.description
          && isDeepStrictEqual(objectValue(current.properties, {}), item.properties ?? {});
        return current.version + (unchanged ? 0 : 1);
      };
      const diagramVersion = (item: Diagram) => {
        const current = storedDiagramById.get(item.id);
        if (!current) return 1;
        const currentPositions = Object.fromEntries(current.componentMemberships.map((membership) => [
          membership.componentId,
          objectValue(membership.position, { x: 0, y: 0 })
        ]));
        const unchanged = current.metamodelId === item.metamodelId
          && current.viewpointId === (item.viewpointId ?? null)
          && current.name === item.name
          && current.description === item.description
          && sameIds(current.componentMemberships.map((membership) => membership.componentId), item.componentIds)
          && sameIds(current.connectionMemberships.map((membership) => membership.connectionId), item.connectionIds)
          && isDeepStrictEqual(currentPositions, item.positions);
        return current.version + (unchanged ? 0 : 1);
      };
      // A whole-state write with a new metamodel id is a replacement, not an append. Deleting
      // prior company metamodels here cascades their types, rules, diagrams and instances inside
      // this same transaction; users, audit entries and legacy ModelRecords are not descendants.
      await tx.metamodel.deleteMany({ where: { companyId, id: { not: metamodelId } } });
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
          createdAt: new Date(state.metamodel.createdAt),
          updatedAt: new Date(state.metamodel.updatedAt)
        }
      });

      for (const item of state.componentTypes) {
        const data = {
          metamodelId,
          name: item.name,
          description: item.description,
          layer: item.layer ?? null,
          category: item.category ?? null,
          color: item.color,
          icon: item.icon,
          shape: item.shape ?? null,
          customPropertyKeys: json(item.customPropertyKeys),
          isRequiredInViewpoint: item.isRequiredInViewpoint ?? null,
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
          directionDescription: item.directionDescription ?? null,
          color: item.color,
          lineStyle: item.lineStyle,
          semanticCategory: item.semanticCategory ?? null,
          category: item.category ?? null,
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
          maxVisibleLayers: item.maxVisibleLayers ?? null
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
          minOccurrences: item.minOccurrences ?? null,
          maxOccurrences: item.maxOccurrences ?? null
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
          description: item.description ?? null,
          severity: item.severity ?? null
        };
        await tx.viewpointRule.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const item of state.validationRules) {
        const data = {
          metamodelId,
          name: item.name,
          description: item.description,
          scope: item.scope,
          viewpointId: item.viewpointId ?? null,
          sourceComponentTypeId: item.sourceComponentTypeId ?? null,
          requiredConnectionTypeId: item.requiredConnectionTypeId ?? null,
          targetComponentTypeId: item.targetComponentTypeId ?? null,
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
          viewpointId: item.viewpointId ?? null,
          name: item.name,
          description: item.description,
          version: diagramVersion(item)
        };
        await tx.diagram.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const [index, item] of state.catalogs.entries()) {
        const data = {
          companyId,
          name: item.name,
          description: item.description,
          kind: item.kind,
          config: json({
            componentTypeIds: item.componentTypeIds,
            connectionTypeIds: item.connectionTypeIds,
            propertyKeys: item.propertyKeys,
            columns: item.columns
          }),
          sortOrder: index
        };
        await tx.catalog.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      await tx.company.update({ where: { id: companyId }, data: { catalogsInitialized: true } });
      for (const item of state.components) {
        const data = {
          companyId,
          componentTypeId: item.componentTypeId,
          externalId: item.externalId ?? null,
          name: item.name,
          description: item.description,
          properties: json(item.properties),
          version: componentVersion(item)
        };
        await tx.componentInstance.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }
      for (const item of state.connections) {
        const data = {
          companyId,
          connectionTypeId: item.connectionTypeId,
          sourceComponentId: item.sourceComponentId,
          targetComponentId: item.targetComponentId,
          externalId: item.externalId ?? null,
          name: item.name,
          description: item.description,
          properties: json(item.properties ?? {}),
          version: connectionVersion(item)
        };
        await tx.connectionInstance.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
      }

      for (const diagram of state.diagrams) {
        await tx.diagramComponentMembership.deleteMany({ where: { diagramId: diagram.id } });
        if (diagram.componentIds.length > 0) {
          await tx.diagramComponentMembership.createMany({
            data: diagram.componentIds.map((componentId) => ({
              diagramId: diagram.id,
              componentId,
              position: json(diagram.positions[componentId] ?? { x: 0, y: 0 })
            }))
          });
        }
        await tx.diagramConnectionMembership.deleteMany({ where: { diagramId: diagram.id } });
        if (diagram.connectionIds.length > 0) {
          await tx.diagramConnectionMembership.createMany({
            data: diagram.connectionIds.map((connectionId) => ({ diagramId: diagram.id, connectionId }))
          });
        }
      }

      const missing = (ids: string[]) => ids.length > 0 ? { id: { notIn: ids } } : {};
      await tx.connectionInstance.deleteMany({ where: { companyId, connectionType: { metamodelId }, ...missing(state.connections.map((item) => item.id)) } });
      await tx.componentInstance.deleteMany({ where: { companyId, componentType: { metamodelId }, ...missing(state.components.map((item) => item.id)) } });
      await tx.diagram.deleteMany({ where: { companyId, metamodelId, ...missing(state.diagrams.map((item) => item.id)) } });
      await tx.catalog.deleteMany({ where: { companyId, ...missing(state.catalogs.map((item) => item.id)) } });
      await tx.validationRule.deleteMany({ where: { metamodelId, ...missing(state.validationRules.map((item) => item.id)) } });
      await tx.viewpointRule.deleteMany({ where: { metamodelId, ...missing(state.viewpointRules.map((item) => item.id)) } });
      await tx.connectionRule.deleteMany({ where: { metamodelId, ...missing(state.connectionRules.map((item) => item.id)) } });
      await tx.viewpoint.deleteMany({ where: { metamodelId, ...missing(state.viewpoints.map((item) => item.id)) } });
      await tx.connectionType.deleteMany({ where: { metamodelId, ...missing(state.connectionTypes.map((item) => item.id)) } });
      await tx.componentType.deleteMany({ where: { metamodelId, ...missing(state.componentTypes.map((item) => item.id)) } });

      if (audit) await this.appendAuditEntries(tx, companyId, audit.actor, auditMutations, audit.event);
      }, { timeout: 30_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        const current = await this.prisma.company.findUnique({ where: { id: companyId }, select: { dataRevision: true } });
        throw new OptimisticLockError(current, "Concurrent whole-state transaction conflict.");
      }
      throw error;
    }

    // The company flag is set above, so catalogs are always present here.
    return ((await this.read(companyId)) as SidebarState | null) ?? structuredClone(state);
  }

  async updateComponent(
    companyId: string,
    value: ComponentInstance,
    expectedVersion: number,
    actor: AuditActorInput = { type: "system", label: "System" }
  ): Promise<ComponentInstance> {
    return this.withLockedCompany(companyId, async (tx) => {
      const current = await tx.componentInstance.findFirst({ where: { id: value.id, companyId } });
      if (!current) throw new ResourceNotFoundError("Component not found.");
      const currentValue: ComponentInstance = {
        id: current.id,
        version: current.version,
        externalId: current.externalId ?? undefined,
        name: current.name,
        componentTypeId: current.componentTypeId,
        description: current.description,
        properties: objectValue(current.properties, {}) as Record<string, string>
      };
      if (current.version !== expectedVersion) throw new OptimisticLockError(currentValue);
      const mutation = auditMutation("component", value.id, "Komponente", withoutVersion(currentValue), withoutVersion(value));
      if (!mutation) return currentValue;
      const updated = await tx.componentInstance.updateMany({
        where: { id: value.id, companyId, version: expectedVersion },
        data: {
          componentTypeId: value.componentTypeId,
          externalId: value.externalId ?? null,
          name: value.name,
          description: value.description,
          properties: json(value.properties),
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) {
        throw new OptimisticLockError(currentValue);
      }
      await tx.company.update({ where: { id: companyId }, data: { dataRevision: { increment: 1 } } });
      await this.appendAuditEntries(tx, companyId, actor, [mutation]);
      return { ...value, version: expectedVersion + 1 };
    }, async () => (await this.prisma.componentInstance.findFirst({
      where: { id: value.id, companyId }, select: { id: true, version: true, name: true }
    })) ?? { id: value.id, version: expectedVersion });
  }

  async deleteComponent(companyId: string, id: string, expectedVersion: number, actor: AuditActorInput = { type: "system", label: "System" }): Promise<void> {
    await this.withLockedCompany(companyId, async (tx) => {
      const current = await tx.componentInstance.findFirst({ where: { id, companyId } });
      if (!current) throw new ResourceNotFoundError("Component not found.");
      if (current.version !== expectedVersion) throw new OptimisticLockError({ id: current.id, version: current.version, name: current.name });
      const connected = await tx.connectionInstance.findMany({
        where: { companyId, OR: [{ sourceComponentId: id }, { targetComponentId: id }] }
      });
      const connectedIds = connected.map((item) => item.id);
      const affectedDiagrams = await tx.diagram.findMany({
        where: {
          companyId,
          OR: [
            { componentMemberships: { some: { componentId: id } } },
            ...(connectedIds.length > 0 ? [{ connectionMemberships: { some: { connectionId: { in: connectedIds } } } }] : [])
          ]
        },
        include: { componentMemberships: true, connectionMemberships: true }
      });
      const affectedDiagramIds = affectedDiagrams.map((item) => item.id);
      const mutations = [
        auditMutation("component", id, "Komponente", withoutVersion({
          id: current.id,
          version: current.version,
          externalId: current.externalId ?? undefined,
          name: current.name,
          componentTypeId: current.componentTypeId,
          description: current.description,
          properties: objectValue(current.properties, {})
        }), null),
        ...connected.map((item) => auditMutation("connection", item.id, "Verbindung", withoutVersion({
          id: item.id,
          version: item.version,
          externalId: item.externalId ?? undefined,
          name: item.name,
          connectionTypeId: item.connectionTypeId,
          sourceComponentId: item.sourceComponentId,
          targetComponentId: item.targetComponentId,
          description: item.description,
          properties: objectValue(item.properties, {})
        }), null)),
        ...affectedDiagrams.map((item) => {
          const before = {
            id: item.id,
            name: item.name,
            description: item.description,
            metamodelId: item.metamodelId,
            viewpointId: item.viewpointId ?? undefined,
            componentIds: item.componentMemberships.map((membership) => membership.componentId),
            connectionIds: item.connectionMemberships.map((membership) => membership.connectionId),
            positions: Object.fromEntries(item.componentMemberships.map((membership) => [membership.componentId, objectValue(membership.position, { x: 0, y: 0 })]))
          };
          return auditMutation("diagram", item.id, "Diagramm", before, {
            ...before,
            componentIds: before.componentIds.filter((componentId) => componentId !== id),
            connectionIds: before.connectionIds.filter((connectionId) => !connectedIds.includes(connectionId)),
            positions: Object.fromEntries(Object.entries(before.positions).filter(([componentId]) => componentId !== id))
          });
        })
      ].filter((item): item is AuditMutationInput => item !== null);
      const removed = await tx.componentInstance.deleteMany({ where: { id, companyId, version: expectedVersion } });
      if (removed.count !== 1) {
        const current = await tx.componentInstance.findFirst({ where: { id, companyId } });
        if (!current) throw new ResourceNotFoundError("Component not found.");
        throw new OptimisticLockError({ id: current.id, version: current.version, name: current.name });
      }
      if (affectedDiagramIds.length > 0) {
        await tx.diagram.updateMany({
          where: { companyId, id: { in: affectedDiagramIds } },
          data: { version: { increment: 1 } }
        });
      }
      await tx.company.update({ where: { id: companyId }, data: { dataRevision: { increment: 1 } } });
      await this.appendAuditEntries(tx, companyId, actor, mutations);
    }, async () => (await this.prisma.componentInstance.findFirst({
      where: { id, companyId }, select: { id: true, version: true, name: true }
    })) ?? { id, version: expectedVersion });
  }

  async createComponentInDiagram(
    companyId: string,
    component: ComponentInstance,
    diagramId: string,
    position: { x: number; y: number },
    expectedDiagramVersion: number,
    actor: AuditActorInput = { type: "system", label: "System" }
  ): Promise<{ component: ComponentInstance; diagram: Diagram }> {
    return this.withLockedCompany(companyId, async (tx) => {
      const beforeDiagram = await tx.diagram.findFirst({
        where: { id: diagramId, companyId },
        include: { componentMemberships: true, connectionMemberships: true }
      });
      if (!beforeDiagram) throw new ResourceNotFoundError("Diagram not found.");
      if (beforeDiagram.version !== expectedDiagramVersion) {
        throw new OptimisticLockError({ id: beforeDiagram.id, version: beforeDiagram.version, name: beforeDiagram.name });
      }
      const advanced = await tx.diagram.updateMany({
        where: { id: diagramId, companyId, version: expectedDiagramVersion },
        data: { version: { increment: 1 } }
      });
      if (advanced.count !== 1) {
        const current = await tx.diagram.findFirst({ where: { id: diagramId, companyId } });
        if (!current) throw new ResourceNotFoundError("Diagram not found.");
        throw new OptimisticLockError({ id: current.id, version: current.version, name: current.name });
      }
      const stored = await tx.componentInstance.create({
        data: {
          id: component.id,
          companyId,
          componentTypeId: component.componentTypeId,
          externalId: component.externalId ?? null,
          name: component.name,
          description: component.description,
          properties: json(component.properties),
          version: 1
        }
      });
      await tx.diagramComponentMembership.create({
        data: { diagramId, componentId: stored.id, position: json(position) }
      });
      await tx.company.update({ where: { id: companyId }, data: { dataRevision: { increment: 1 } } });
      const diagram = await tx.diagram.findUniqueOrThrow({
        where: { id: diagramId },
        include: { componentMemberships: true, connectionMemberships: true }
      });
      const diagramValue = (item: typeof diagram) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        metamodelId: item.metamodelId,
        viewpointId: item.viewpointId ?? undefined,
        componentIds: item.componentMemberships.map((membership) => membership.componentId),
        connectionIds: item.connectionMemberships.map((membership) => membership.connectionId),
        positions: Object.fromEntries(item.componentMemberships.map((membership) => [membership.componentId, objectValue(membership.position, { x: 0, y: 0 })]))
      });
      const mutations = [
        auditMutation("component", stored.id, "Komponente", null, withoutVersion({
          id: stored.id,
          version: stored.version,
          externalId: stored.externalId ?? undefined,
          name: stored.name,
          componentTypeId: stored.componentTypeId,
          description: stored.description,
          properties: objectValue(stored.properties, {})
        })),
        auditMutation("diagram", diagram.id, "Diagramm", diagramValue(beforeDiagram), diagramValue(diagram))
      ].filter((item): item is AuditMutationInput => item !== null);
      await this.appendAuditEntries(tx, companyId, actor, mutations);
      return {
        component: {
          id: stored.id,
          version: stored.version,
          externalId: stored.externalId ?? undefined,
          name: stored.name,
          componentTypeId: stored.componentTypeId,
          description: stored.description,
          properties: objectValue(stored.properties, {}) as Record<string, string>
        },
        diagram: {
          id: diagram.id,
          version: diagram.version,
          name: diagram.name,
          description: diagram.description,
          metamodelId: diagram.metamodelId,
          viewpointId: diagram.viewpointId ?? undefined,
          componentIds: diagram.componentMemberships.map((membership) => membership.componentId),
          connectionIds: diagram.connectionMemberships.map((membership) => membership.connectionId),
          positions: Object.fromEntries(diagram.componentMemberships.map((membership) => [
            membership.componentId,
            objectValue(membership.position, { x: 0, y: 0 })
          ]))
        }
      };
    }, async () => (await this.prisma.diagram.findFirst({
      where: { id: diagramId, companyId }, select: { id: true, version: true, name: true }
    })) ?? { id: diagramId, version: expectedDiagramVersion });
  }

  async updateConnection(
    companyId: string,
    value: ConnectionInstance,
    expectedVersion: number,
    actor: AuditActorInput = { type: "system", label: "System" }
  ): Promise<ConnectionInstance> {
    return this.withLockedCompany(companyId, async (tx) => {
      const current = await tx.connectionInstance.findFirst({ where: { id: value.id, companyId } });
      if (!current) throw new ResourceNotFoundError("Connection not found.");
      const currentValue: ConnectionInstance = {
        id: current.id,
        version: current.version,
        externalId: current.externalId ?? undefined,
        name: current.name,
        connectionTypeId: current.connectionTypeId,
        sourceComponentId: current.sourceComponentId,
        targetComponentId: current.targetComponentId,
        description: current.description,
        properties: objectValue(current.properties, {}) as Record<string, string>
      };
      if (current.version !== expectedVersion) throw new OptimisticLockError(currentValue);
      const mutation = auditMutation("connection", value.id, "Verbindung", withoutVersion(currentValue), withoutVersion(value));
      if (!mutation) return currentValue;
      const updated = await tx.connectionInstance.updateMany({
        where: { id: value.id, companyId, version: expectedVersion },
        data: {
          connectionTypeId: value.connectionTypeId,
          sourceComponentId: value.sourceComponentId,
          targetComponentId: value.targetComponentId,
          externalId: value.externalId ?? null,
          name: value.name,
          description: value.description,
          properties: json(value.properties ?? {}),
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) {
        throw new OptimisticLockError(currentValue);
      }
      await tx.company.update({ where: { id: companyId }, data: { dataRevision: { increment: 1 } } });
      await this.appendAuditEntries(tx, companyId, actor, [mutation]);
      return { ...value, version: expectedVersion + 1 };
    }, async () => (await this.prisma.connectionInstance.findFirst({
      where: { id: value.id, companyId }, select: { id: true, version: true, name: true }
    })) ?? { id: value.id, version: expectedVersion });
  }

  async deleteConnection(companyId: string, id: string, expectedVersion: number, actor: AuditActorInput = { type: "system", label: "System" }): Promise<void> {
    await this.withLockedCompany(companyId, async (tx) => {
      const current = await tx.connectionInstance.findFirst({ where: { id, companyId } });
      if (!current) throw new ResourceNotFoundError("Connection not found.");
      if (current.version !== expectedVersion) throw new OptimisticLockError({ id: current.id, version: current.version, name: current.name });
      const diagrams = await tx.diagram.findMany({
        where: { companyId, connectionMemberships: { some: { connectionId: id } } },
        include: { componentMemberships: true, connectionMemberships: true }
      });
      const affectedDiagramIds = diagrams.map((item) => item.id);
      const mutations = [
        auditMutation("connection", id, "Verbindung", withoutVersion({
          id: current.id,
          version: current.version,
          externalId: current.externalId ?? undefined,
          name: current.name,
          connectionTypeId: current.connectionTypeId,
          sourceComponentId: current.sourceComponentId,
          targetComponentId: current.targetComponentId,
          description: current.description,
          properties: objectValue(current.properties, {})
        }), null),
        ...diagrams.map((item) => {
          const before = {
            id: item.id,
            name: item.name,
            description: item.description,
            metamodelId: item.metamodelId,
            viewpointId: item.viewpointId ?? undefined,
            componentIds: item.componentMemberships.map((membership) => membership.componentId),
            connectionIds: item.connectionMemberships.map((membership) => membership.connectionId),
            positions: Object.fromEntries(item.componentMemberships.map((membership) => [membership.componentId, objectValue(membership.position, { x: 0, y: 0 })]))
          };
          return auditMutation("diagram", item.id, "Diagramm", before, {
            ...before,
            connectionIds: before.connectionIds.filter((connectionId) => connectionId !== id)
          });
        })
      ].filter((item): item is AuditMutationInput => item !== null);
      const removed = await tx.connectionInstance.deleteMany({ where: { id, companyId, version: expectedVersion } });
      if (removed.count !== 1) {
        const current = await tx.connectionInstance.findFirst({ where: { id, companyId } });
        if (!current) throw new ResourceNotFoundError("Connection not found.");
        throw new OptimisticLockError({ id: current.id, version: current.version, name: current.name });
      }
      if (affectedDiagramIds.length > 0) {
        await tx.diagram.updateMany({
          where: { companyId, id: { in: affectedDiagramIds } },
          data: { version: { increment: 1 } }
        });
      }
      await tx.company.update({ where: { id: companyId }, data: { dataRevision: { increment: 1 } } });
      await this.appendAuditEntries(tx, companyId, actor, mutations);
    }, async () => (await this.prisma.connectionInstance.findFirst({
      where: { id, companyId }, select: { id: true, version: true, name: true }
    })) ?? { id, version: expectedVersion });
  }

  async updateDiagram(companyId: string, value: Diagram, expectedVersion: number, actor: AuditActorInput = { type: "system", label: "System" }): Promise<Diagram> {
    return this.withLockedCompany(companyId, async (tx) => {
      const current = await tx.diagram.findFirst({
        where: { id: value.id, companyId },
        include: { componentMemberships: true, connectionMemberships: true }
      });
      if (!current) throw new ResourceNotFoundError("Diagram not found.");
      const currentValue: Diagram = {
        id: current.id,
        version: current.version,
        name: current.name,
        description: current.description,
        metamodelId: current.metamodelId,
        viewpointId: current.viewpointId ?? undefined,
        componentIds: current.componentMemberships.map((membership) => membership.componentId),
        connectionIds: current.connectionMemberships.map((membership) => membership.connectionId),
        positions: Object.fromEntries(current.componentMemberships.map((membership) => [membership.componentId, objectValue(membership.position, { x: 0, y: 0 })]))
      };
      if (current.version !== expectedVersion) throw new OptimisticLockError({ id: current.id, version: current.version, name: current.name });
      const mutation = auditMutation("diagram", value.id, "Diagramm", withoutVersion(currentValue), withoutVersion(value));
      if (!mutation) return currentValue;
      const updated = await tx.diagram.updateMany({
        where: { id: value.id, companyId, version: expectedVersion },
        data: {
          viewpointId: value.viewpointId ?? null,
          name: value.name,
          description: value.description,
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) {
        throw new OptimisticLockError({ id: current.id, version: current.version, name: current.name });
      }
      await tx.diagramComponentMembership.deleteMany({ where: { diagramId: value.id } });
      if (value.componentIds.length > 0) {
        await tx.diagramComponentMembership.createMany({
          data: value.componentIds.map((componentId) => ({
            diagramId: value.id,
            componentId,
            position: json(value.positions[componentId] ?? { x: 0, y: 0 })
          }))
        });
      }
      await tx.diagramConnectionMembership.deleteMany({ where: { diagramId: value.id } });
      if (value.connectionIds.length > 0) {
        await tx.diagramConnectionMembership.createMany({
          data: value.connectionIds.map((connectionId) => ({ diagramId: value.id, connectionId }))
        });
      }
      await tx.company.update({ where: { id: companyId }, data: { dataRevision: { increment: 1 } } });
      await this.appendAuditEntries(tx, companyId, actor, [mutation]);
      return { ...value, version: expectedVersion + 1 };
    }, async () => (await this.prisma.diagram.findFirst({
      where: { id: value.id, companyId }, select: { id: true, version: true, name: true }
    })) ?? { id: value.id, version: expectedVersion });
  }

  async deleteDiagram(companyId: string, id: string, expectedVersion: number, actor: AuditActorInput = { type: "system", label: "System" }): Promise<void> {
    await this.withLockedCompany(companyId, async (tx) => {
      const current = await tx.diagram.findFirst({
        where: { id, companyId },
        include: { componentMemberships: true, connectionMemberships: true }
      });
      if (!current) throw new ResourceNotFoundError("Diagram not found.");
      if (current.version !== expectedVersion) throw new OptimisticLockError({ id: current.id, version: current.version, name: current.name });
      const mutation = auditMutation("diagram", id, "Diagramm", {
        id: current.id,
        name: current.name,
        description: current.description,
        metamodelId: current.metamodelId,
        viewpointId: current.viewpointId ?? undefined,
        componentIds: current.componentMemberships.map((membership) => membership.componentId),
        connectionIds: current.connectionMemberships.map((membership) => membership.connectionId),
        positions: Object.fromEntries(current.componentMemberships.map((membership) => [membership.componentId, objectValue(membership.position, { x: 0, y: 0 })]))
      }, null)!;
      const removed = await tx.diagram.deleteMany({ where: { id, companyId, version: expectedVersion } });
      if (removed.count !== 1) {
        const current = await tx.diagram.findFirst({ where: { id, companyId } });
        if (!current) throw new ResourceNotFoundError("Diagram not found.");
        throw new OptimisticLockError({ id: current.id, version: current.version, name: current.name });
      }
      await tx.company.update({ where: { id: companyId }, data: { dataRevision: { increment: 1 } } });
      await this.appendAuditEntries(tx, companyId, actor, [mutation]);
    }, async () => (await this.prisma.diagram.findFirst({
      where: { id, companyId }, select: { id: true, version: true, name: true }
    })) ?? { id, version: expectedVersion });
  }

  async listAudit(companyId: string, query: AuditQuery): Promise<AuditPage> {
    const occurredAt: Prisma.DateTimeNullableFilter = {};
    if (query.from) occurredAt.gte = query.from;
    if (query.to) occurredAt.lte = query.to;
    const cursorFilter = query.cursor
      ? query.cursor.occurredAt
        ? {
          OR: [
            { occurredAt: { lt: query.cursor.occurredAt } },
            { occurredAt: query.cursor.occurredAt, id: { lt: query.cursor.id } },
            { occurredAt: null }
          ]
        }
        : { occurredAt: null, id: { lt: query.cursor.id } }
      : {};
    const entries = await this.prisma.auditLogEntry.findMany({
      where: {
        companyId,
        ...(query.from || query.to ? { occurredAt } : {}),
        ...(query.actor ? {
          OR: [
            { userId: query.actor },
            { userEmail: { equals: query.actor, mode: "insensitive" } },
            { actorLabel: { equals: query.actor, mode: "insensitive" } }
          ]
        } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...cursorFilter
      },
      orderBy: [{ occurredAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: query.limit + 1
    });
    const hasMore = entries.length > query.limit;
    if (hasMore) entries.pop();
    const items: AuditEntry[] = entries.map((entry) => ({
      id: entry.id,
      occurredAt: entry.occurredAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      actorType: entry.actorType as AuditEntry["actorType"],
      actorLabel: entry.actorLabel,
      userId: entry.userId,
      userEmail: entry.userEmail,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      changes: Array.isArray(entry.changes) ? entry.changes as unknown as AuditEntry["changes"] : [],
      details: objectValue(entry.details, {}) as Record<string, unknown>,
      batchId: entry.batchId
    }));
    const last = entries.at(-1);
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ occurredAt: last.occurredAt?.toISOString() ?? null, id: last.id })).toString("base64url")
      : null;
    return { items, nextCursor };
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

let singleton: PrismaSidebarStateRepository | undefined;

// PostgreSQL is the only persistence layer (ADR 0001). STORAGE_BACKEND is a removed setting:
// "database" is tolerated for old .env files, anything else fails so nobody expects JSON storage.
export function requireDatabaseConfiguration(environment: NodeJS.ProcessEnv = process.env): string {
  const requested = environment.STORAGE_BACKEND?.trim().toLowerCase();
  if (requested && requested !== "database") {
    throw new Error(
      `STORAGE_BACKEND=${requested} is no longer supported. JSON file storage was removed (REQ-28); ` +
      "remove STORAGE_BACKEND and migrate old JSON data with 'npm run db:migrate-json --workspace backend'."
    );
  }
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Start PostgreSQL (e.g. 'docker compose up -d postgres') and set DATABASE_URL in .env."
    );
  }
  return databaseUrl;
}

export function databaseSidebarRepository(): PrismaSidebarStateRepository {
  singleton ??= new PrismaSidebarStateRepository();
  return singleton;
}
