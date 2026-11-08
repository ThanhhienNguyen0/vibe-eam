// Historical ArchitectureModel API. JSONB writes are serialized by a DB row lock so separate
// backend processes cannot overwrite one another (REQ-26).
import { Prisma, PrismaClient } from "@prisma/client";
import { seedState } from "./seed.js";
import { requireCompanyId } from "./tenant.js";
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

async function mutateState<T>(
  mutation: (state: PersistedState, revision: number) => Promise<T> | T
): Promise<{ state: PersistedState; value: T; revision: number }> {
  const companyId = requireCompanyId();
  return prisma.$transaction(async (tx) => {
    await tx.architectureModel.upsert({
      where: { companyId },
      create: { companyId, ...dataFor(withVersions(seedState)) },
      update: {}
    });
    await tx.$queryRaw`SELECT "id" FROM "ArchitectureModel" WHERE "companyId" = ${companyId} FOR UPDATE`;
    const persisted = await tx.architectureModel.findUniqueOrThrow({ where: { companyId } });
    const state = withVersions({
      elements: persisted.elements as unknown as EamElement[],
      relations: persisted.relations as unknown as EamRelation[],
      auditLog: persisted.auditLog as unknown as AuditLogEntry[]
    });
    const value = await mutation(state, persisted.revision);
    const saved = await tx.architectureModel.update({
      where: { companyId },
      data: { ...dataFor(state), revision: { increment: 1 } },
      select: { revision: true }
    });
    return { state: structuredClone(state), value, revision: saved.revision };
  }, { timeout: 30_000 });
}

async function readStateSnapshot(): Promise<{ state: PersistedState; revision: number }> {
  const companyId = requireCompanyId();
  let persisted = await prisma.architectureModel.findUnique({ where: { companyId } });
  if (!persisted) {
    await mutateState(() => undefined);
    persisted = await prisma.architectureModel.findUniqueOrThrow({ where: { companyId } });
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
  return (await mutateState((state) => {
    const stored = { ...element, version: 1 };
    state.elements.push(stored);
    appendAuditLog(state, "create", stored.id, `Created element '${stored.name}'.`);
  })).state;
}

export async function updateElement(id: string, patch: Partial<EamElement>, expectedVersion: number): Promise<EamElement> {
  return (await mutateState((state) => {
    const index = state.elements.findIndex((element) => element.id === id);
    if (index === -1) throw new ResourceNotFoundError("Element not found.");
    const current = state.elements[index];
    if (current.version !== expectedVersion) throw new OptimisticLockError(current);
    state.elements[index] = { ...current, ...patch, id, version: expectedVersion + 1 };
    appendAuditLog(state, "update", id, `Updated element '${state.elements[index].name}'.`);
    return state.elements[index];
  })).value;
}

export async function deleteElement(id: string, expectedVersion: number): Promise<void> {
  await mutateState((state) => {
    const current = state.elements.find((element) => element.id === id);
    if (!current) throw new ResourceNotFoundError("Element not found.");
    if (current.version !== expectedVersion) throw new OptimisticLockError(current);
    const removedRelations = state.relations.filter((relation) => relation.source === id || relation.target === id).length;
    state.elements = state.elements.filter((element) => element.id !== id);
    state.relations = state.relations.filter((relation) => relation.source !== id && relation.target !== id);
    appendAuditLog(state, "delete", id, `Deleted element and ${removedRelations} attached relation(s).`);
  });
}

export async function addRelation(relation: EamRelation): Promise<PersistedState> {
  return (await mutateState((state) => {
    const stored = { ...relation, version: 1 };
    state.relations.push(stored);
    appendAuditLog(state, "create", stored.id, `Created relation '${stored.type}' from ${stored.source} to ${stored.target}.`);
  })).state;
}

export async function deleteRelation(id: string, expectedVersion: number): Promise<void> {
  await mutateState((state) => {
    const current = state.relations.find((relation) => relation.id === id);
    if (!current) throw new ResourceNotFoundError("Relation not found.");
    if (current.version !== expectedVersion) throw new OptimisticLockError(current);
    state.relations = state.relations.filter((relation) => relation.id !== id);
    appendAuditLog(state, "delete", id, "Deleted relation.");
  });
}

export async function importModel(model: EamModel, expectedRevision: number): Promise<PersistedState> {
  return (await mutateState((state, revision) => {
    if (revision !== expectedRevision) throw new OptimisticLockError({ revision });
    const importedVersion = revision + 1;
    state.elements = model.elements.map((item) => ({ ...item, version: importedVersion }));
    state.relations = model.relations.map((item) => ({ ...item, version: importedVersion }));
    appendAuditLog(state, "import", "model", `Imported model with ${state.elements.length} elements and ${state.relations.length} relations.`);
  })).state;
}

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  return (await readState()).auditLog;
}
