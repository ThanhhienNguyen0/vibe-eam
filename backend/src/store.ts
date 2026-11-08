// Historical ArchitectureModel API. JSONB writes are serialized by a DB row lock so separate
// backend processes cannot overwrite one another (REQ-26).
import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { auditMutation } from "./audit/auditDiff.js";
import type { AuditMutationInput } from "./audit/auditTypes.js";
import { seedState } from "./seed.js";
import { currentPrincipal, requireCompanyId } from "./tenant.js";
import type { AuditLogEntry, EamElement, EamModel, EamRelation, PersistedState } from "./types.js";
import { OptimisticLockError, ResourceNotFoundError } from "./persistence/databaseSidebarRepository.js";

const prisma = new PrismaClient();

const withVersions = (state: PersistedState): PersistedState => ({
  ...structuredClone(state),
  elements: state.elements.map((item) => ({ ...item, version: item.version ?? 1 })),
  relations: state.relations.map((item) => ({ ...item, version: item.version ?? 1 }))
});

const dataFor = (state: PersistedState) => ({
  elements: state.elements as unknown as Prisma.InputJsonValue,
  relations: state.relations as unknown as Prisma.InputJsonValue,
  auditLog: state.auditLog as unknown as Prisma.InputJsonValue
});

type LegacyMutationResult<T> = { value: T; changed: boolean };

async function lockCompany(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
  const company = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE
  `;
  if (company.length !== 1) throw new ResourceNotFoundError("Company not found.");
}

async function ensureArchitectureModel(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<Prisma.ArchitectureModelGetPayload<object>> {
  const existing = await tx.architectureModel.findUnique({ where: { companyId } });
  if (existing) return existing;
  const created = await tx.architectureModel.create({
    data: { companyId, ...dataFor(withVersions(seedState)) }
  });
  await tx.auditLogEntry.create({
    data: {
      companyId,
      userId: null,
      userEmail: null,
      actorType: "system",
      actorLabel: "Systeminitialisierung",
      action: "system.initialize",
      entityType: "legacy-model",
      entityId: created.id,
      summary: "Historisches Architekturmodell initialisiert.",
      changes: [],
      details: { origin: "architecture-model-api" },
      batchId: null,
      occurredAt: new Date()
    }
  });
  return created;
}

async function mutateState<T>(
  mutation: (state: PersistedState, revision: number, tx: Prisma.TransactionClient, companyId: string) => Promise<LegacyMutationResult<T>> | LegacyMutationResult<T>
): Promise<{ state: PersistedState; value: T; revision: number }> {
  const companyId = requireCompanyId();
  return prisma.$transaction(async (tx) => {
    await lockCompany(tx, companyId);
    await ensureArchitectureModel(tx, companyId);
    await tx.$queryRaw`SELECT "id" FROM "ArchitectureModel" WHERE "companyId" = ${companyId} FOR UPDATE`;
    const persisted = await tx.architectureModel.findUniqueOrThrow({ where: { companyId } });
    const state = withVersions({
      elements: persisted.elements as unknown as EamElement[],
      relations: persisted.relations as unknown as EamRelation[],
      auditLog: persisted.auditLog as unknown as AuditLogEntry[]
    });
    const result = await mutation(state, persisted.revision, tx, companyId);
    if (!result.changed) {
      return { state: structuredClone(state), value: result.value, revision: persisted.revision };
    }
    const saved = await tx.architectureModel.update({
      where: { companyId },
      data: { ...dataFor(state), revision: { increment: 1 } },
      select: { revision: true }
    });
    return { state: structuredClone(state), value: result.value, revision: saved.revision };
  }, { timeout: 30_000 });
}

async function appendCanonicalAudit(
  tx: Prisma.TransactionClient,
  companyId: string,
  mutations: AuditMutationInput[]
): Promise<void> {
  if (mutations.length === 0) return;
  const principal = currentPrincipal();
  if (!principal || principal.companyId !== companyId) throw new Error("Authenticated audit actor is required.");
  const actor = await tx.user.findFirst({
    where: { id: principal.userId, companyId },
    select: { id: true, email: true, name: true }
  });
  if (!actor) throw new Error("Authenticated audit actor no longer belongs to the company.");
  const occurredAt = new Date();
  const batchId = mutations.length > 1 ? randomUUID() : null;
  for (const mutation of mutations) {
    await tx.auditLogEntry.create({
      data: {
        companyId,
        userId: actor.id,
        userEmail: actor.email,
        actorType: "user",
        actorLabel: actor.name ?? actor.email,
        action: mutation.action,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        summary: mutation.summary,
        changes: mutation.changes as unknown as Prisma.InputJsonValue,
        details: { origin: "architecture-model-api", ...(mutation.details ?? {}) } as Prisma.InputJsonValue,
        batchId,
        occurredAt
      }
    });
  }
}

async function readStateSnapshot(): Promise<{ state: PersistedState; revision: number }> {
  const companyId = requireCompanyId();
  let persisted = await prisma.architectureModel.findUnique({ where: { companyId } });
  if (!persisted) {
    persisted = await prisma.$transaction(async (tx) => {
      await lockCompany(tx, companyId);
      return ensureArchitectureModel(tx, companyId);
    }, { timeout: 30_000 });
  }
  return {
    state: withVersions({
      elements: persisted.elements as unknown as EamElement[],
      relations: persisted.relations as unknown as EamRelation[],
      auditLog: persisted.auditLog as unknown as AuditLogEntry[]
    }),
    revision: persisted.revision
  };
}

export async function readState(): Promise<PersistedState> {
  return (await readStateSnapshot()).state;
}

export async function getModel(): Promise<EamModel> {
  const { state } = await readStateSnapshot();
  return { elements: state.elements, relations: state.relations };
}

export async function getModelSnapshot(): Promise<{ model: EamModel; revision: number }> {
  const { state, revision } = await readStateSnapshot();
  return { model: { elements: state.elements, relations: state.relations }, revision };
}

function appendAuditLog(state: PersistedState, action: AuditLogEntry["action"], entityId: string, description: string): void {
  state.auditLog.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), action, entityId, description });
}

export async function addElement(element: EamElement): Promise<PersistedState> {
  return (await mutateState(async (state, _revision, tx, companyId) => {
    const stored = { ...element, version: 1 };
    state.elements.push(stored);
    appendAuditLog(state, "create", stored.id, `Created element '${stored.name}'.`);
    const mutation = auditMutation("legacy-element", stored.id, "Legacy-Element", null, { ...stored, version: undefined });
    if (mutation) await appendCanonicalAudit(tx, companyId, [mutation]);
    return { value: undefined, changed: true };
  })).state;
}

export async function updateElement(id: string, patch: Partial<EamElement>, expectedVersion: number): Promise<EamElement> {
  return (await mutateState(async (state, _revision, tx, companyId) => {
    const index = state.elements.findIndex((element) => element.id === id);
    if (index === -1) throw new ResourceNotFoundError("Element not found.");
    const current = state.elements[index];
    if (current.version !== expectedVersion) throw new OptimisticLockError(current);
    const candidate = { ...current, ...patch, id, version: expectedVersion };
    const mutation = auditMutation("legacy-element", id, "Legacy-Element", { ...current, version: undefined }, { ...candidate, version: undefined });
    if (!mutation) return { value: current, changed: false };
    const updated = { ...candidate, version: expectedVersion + 1 };
    state.elements[index] = updated;
    appendAuditLog(state, "update", id, `Updated element '${updated.name}'.`);
    await appendCanonicalAudit(tx, companyId, [mutation]);
    return { value: updated, changed: true };
  })).value;
}

export async function deleteElement(id: string, expectedVersion: number): Promise<void> {
  await mutateState(async (state, _revision, tx, companyId) => {
    const current = state.elements.find((element) => element.id === id);
    if (!current) throw new ResourceNotFoundError("Element not found.");
    if (current.version !== expectedVersion) throw new OptimisticLockError(current);
    const attachedRelations = state.relations.filter((relation) => relation.source === id || relation.target === id);
    const removedRelations = attachedRelations.length;
    state.elements = state.elements.filter((element) => element.id !== id);
    state.relations = state.relations.filter((relation) => relation.source !== id && relation.target !== id);
    appendAuditLog(state, "delete", id, `Deleted element and ${removedRelations} attached relation(s).`);
    const mutations = [
      auditMutation("legacy-element", id, "Legacy-Element", { ...current, version: undefined }, null),
      ...attachedRelations.map((relation) => auditMutation("legacy-relation", relation.id, "Legacy-Relation", { ...relation, version: undefined }, null))
    ].filter((item): item is AuditMutationInput => item !== null);
    await appendCanonicalAudit(tx, companyId, mutations);
    return { value: undefined, changed: true };
  });
}

export async function addRelation(relation: EamRelation): Promise<PersistedState> {
  return (await mutateState(async (state, _revision, tx, companyId) => {
    const stored = { ...relation, version: 1 };
    state.relations.push(stored);
    appendAuditLog(state, "create", stored.id, `Created relation '${stored.type}' from ${stored.source} to ${stored.target}.`);
    const mutation = auditMutation("legacy-relation", stored.id, "Legacy-Relation", null, { ...stored, version: undefined });
    if (mutation) await appendCanonicalAudit(tx, companyId, [mutation]);
    return { value: undefined, changed: true };
  })).state;
}

export async function deleteRelation(id: string, expectedVersion: number): Promise<void> {
  await mutateState(async (state, _revision, tx, companyId) => {
    const current = state.relations.find((relation) => relation.id === id);
    if (!current) throw new ResourceNotFoundError("Relation not found.");
    if (current.version !== expectedVersion) throw new OptimisticLockError(current);
    state.relations = state.relations.filter((relation) => relation.id !== id);
    appendAuditLog(state, "delete", id, "Deleted relation.");
    const mutation = auditMutation("legacy-relation", id, "Legacy-Relation", { ...current, version: undefined }, null);
    if (mutation) await appendCanonicalAudit(tx, companyId, [mutation]);
    return { value: undefined, changed: true };
  });
}

export async function importModel(model: EamModel, expectedRevision: number): Promise<PersistedState> {
  return (await mutateState(async (state, revision, tx, companyId) => {
    if (revision !== expectedRevision) throw new OptimisticLockError({ revision });
    const previousElements = state.elements;
    const previousRelations = state.relations;
    const importedVersion = revision + 1;
    const previousElementVersions = new Map(previousElements.map((item) => [item.id, item.version ?? 1]));
    const previousRelationVersions = new Map(previousRelations.map((item) => [item.id, item.version ?? 1]));
    const nextElements = model.elements.map((item) => ({
      ...item,
      version: Math.max(importedVersion, (previousElementVersions.get(item.id) ?? 0) + 1)
    }));
    const nextRelations = model.relations.map((item) => ({
      ...item,
      version: Math.max(importedVersion, (previousRelationVersions.get(item.id) ?? 0) + 1)
    }));
    type LegacyAudited = { type: "legacy-element" | "legacy-relation"; label: string; item: EamElement | EamRelation };
    const before = new Map<string, LegacyAudited>([
      ...previousElements.map((item) => [`legacy-element:${item.id}`, { type: "legacy-element", label: "Legacy-Element", item }] as const),
      ...previousRelations.map((item) => [`legacy-relation:${item.id}`, { type: "legacy-relation", label: "Legacy-Relation", item }] as const)
    ]);
    const after = new Map<string, LegacyAudited>([
      ...nextElements.map((item) => [`legacy-element:${item.id}`, { type: "legacy-element", label: "Legacy-Element", item }] as const),
      ...nextRelations.map((item) => [`legacy-relation:${item.id}`, { type: "legacy-relation", label: "Legacy-Relation", item }] as const)
    ]);
    const mutations = [...new Set([...before.keys(), ...after.keys()])].sort().map((key) => {
      const left = before.get(key);
      const right = after.get(key);
      const current = right ?? left!;
      return auditMutation(
        current.type,
        current.item.id,
        current.label,
        left ? { ...left.item, version: undefined } : null,
        right ? { ...right.item, version: undefined } : null
      );
    }).filter((item): item is AuditMutationInput => item !== null);
    if (mutations.length === 0) return { value: undefined, changed: false };
    state.elements = nextElements;
    state.relations = nextRelations;
    appendAuditLog(state, "import", "model", `Imported model with ${state.elements.length} elements and ${state.relations.length} relations.`);
    await appendCanonicalAudit(tx, companyId, mutations);
    return { value: undefined, changed: true };
  })).state;
}

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  return (await readState()).auditLog;
}
