// ArchitectureModel stores elements, relations and the audit log as JSONB per company (ADR 0001).
import { Prisma, PrismaClient } from "@prisma/client";
import { seedState } from "./seed.js";
import { requireCompanyId } from "./tenant.js";
import type { AuditLogEntry, EamElement, EamModel, EamRelation, PersistedState } from "./types.js";

const prisma = new PrismaClient();

const cachedStates = new Map<string, PersistedState>();

export async function readState(): Promise<PersistedState> {
  const companyId = requireCompanyId();
  const cached = cachedStates.get(companyId);
  if (cached) return structuredClone(cached);
  const persisted = await prisma.architectureModel.findUnique({ where: { companyId } });
  const state: PersistedState = persisted ? {
    elements: persisted.elements as unknown as EamElement[],
    relations: persisted.relations as unknown as EamRelation[],
    auditLog: persisted.auditLog as unknown as AuditLogEntry[]
  } : structuredClone(seedState);
  if (!persisted) await writeState(state);
  cachedStates.set(companyId, state);
  return structuredClone(state);
}

export async function writeState(state: PersistedState): Promise<PersistedState> {
  const companyId = requireCompanyId();
  const cachedState = structuredClone(state);
  const data = {
    elements: cachedState.elements as unknown as Prisma.InputJsonValue,
    relations: cachedState.relations as unknown as Prisma.InputJsonValue,
    auditLog: cachedState.auditLog as unknown as Prisma.InputJsonValue
  };
  await prisma.architectureModel.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data
  });
  cachedStates.set(companyId, cachedState);
  return structuredClone(cachedState);
}

export async function getModel(): Promise<EamModel> {
  const state = await readState();
  return { elements: state.elements, relations: state.relations };
}

export async function appendAuditLog(
  action: AuditLogEntry["action"],
  entityId: string,
  description: string,
  stateOverride?: PersistedState
): Promise<PersistedState> {
  const state = stateOverride ?? (await readState());
  state.auditLog.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    entityId,
    description
  });
  return state;
}

export async function addElement(element: EamElement): Promise<PersistedState> {
  const state = await readState();
  state.elements.push(element);
  await appendAuditLog("create", element.id, `Created element '${element.name}'.`, state);
  return writeState(state);
}

export async function updateElement(id: string, patch: Partial<EamElement>): Promise<EamElement | null> {
  const state = await readState();
  const index = state.elements.findIndex((element) => element.id === id);
  if (index === -1) return null;
  state.elements[index] = { ...state.elements[index], ...patch, id };
  await appendAuditLog("update", id, `Updated element '${state.elements[index].name}'.`, state);
  await writeState(state);
  return state.elements[index];
}

export async function deleteElement(id: string): Promise<boolean> {
  const state = await readState();
  const before = state.elements.length;
  const removedRelations = state.relations.filter((relation) => relation.source === id || relation.target === id).length;
  state.elements = state.elements.filter((element) => element.id !== id);
  state.relations = state.relations.filter((relation) => relation.source !== id && relation.target !== id);
  if (state.elements.length === before) return false;
  await appendAuditLog("delete", id, `Deleted element and ${removedRelations} attached relation(s).`, state);
  await writeState(state);
  return true;
}

export async function addRelation(relation: EamRelation): Promise<PersistedState> {
  const state = await readState();
  state.relations.push(relation);
  await appendAuditLog("create", relation.id, `Created relation '${relation.type}' from ${relation.source} to ${relation.target}.`, state);
  return writeState(state);
}

export async function deleteRelation(id: string): Promise<boolean> {
  const state = await readState();
  const before = state.relations.length;
  state.relations = state.relations.filter((relation) => relation.id !== id);
  if (state.relations.length === before) return false;
  await appendAuditLog("delete", id, "Deleted relation.", state);
  await writeState(state);
  return true;
}

export async function importModel(model: EamModel): Promise<PersistedState> {
  const state: PersistedState = {
    elements: model.elements,
    relations: model.relations,
    auditLog: (await readState()).auditLog
  };
  await appendAuditLog("import", "model", `Imported model with ${model.elements.length} elements and ${model.relations.length} relations.`, state);
  return writeState(state);
}

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  const state = await readState();
  return state.auditLog;
}
