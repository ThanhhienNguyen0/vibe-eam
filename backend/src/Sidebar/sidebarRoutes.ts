import { Router, type NextFunction, type Request, type Response } from "express";
import type { Catalog, ComponentShape, ComponentType, ConnectionType, SidebarState } from "./sidebarTypes.js";
import { catalogColumnKeys } from "../catalog/catalogModel.js";
import { validateConnectionInstance, validateDiagram } from "./metamodelRules.js";
import { OptimisticLockError, ResourceNotFoundError } from "../persistence/databaseSidebarRepository.js";
import {
  duplicateAuditEvent,
  duplicateComponentWarnings,
  duplicateWarnings,
  findDuplicateComponents,
  findDuplicatesByName,
  type DuplicateWarningCode
} from "./componentDuplicates.js";
import {
  addComponent,
  addComponentToDiagram,
  addComponentType,
  addConnection,
  addConnectionToDiagram,
  addConnectionRule,
  addConnectionType,
  addDiagram,
  addViewpoint,
  deleteComponent,
  deleteComponentType,
  deleteConnection,
  deleteConnectionRule,
  deleteConnectionType,
  deleteDiagram,
  deleteViewpoint,
  exportMetamodelDefinition,
  getComponents,
  getComponentTypes,
  getConnections,
  getConnectionRules,
  getConnectionTypes,
  getDiagrams,
  getDiagramWithContents,
  getViewpoints,
  importMetamodelDefinition,
  readDefaultMetamodelDefinition,
  readSidebarState,
  updateComponent,
  updateComponentType,
  updateConnection,
  updateConnectionRule,
  updateConnectionType,
  updateDiagram,
  updateViewpoint,
  addCatalog,
  updateCatalog,
  deleteCatalog
} from "./sidebarStore.js";

const router = Router();

const MAX_EXTERNAL_ID_LENGTH = 200;

/** REQ-02 for metamodel types: warn and audit (REQ-23 event in the same write), but never block. */
function checkTypeNameDuplicates(
  code: DuplicateWarningCode,
  entityType: "component-type" | "connection-type",
  existing: Array<{ id: string; name: string }>,
  candidateName: string,
  excludeId?: string
) {
  const duplicates = findDuplicatesByName(existing, candidateName, excludeId);
  return {
    warnings: duplicateWarnings(code, duplicates),
    event: (verb: "created" | "updated", item: { id: string; name: string }, acknowledged: boolean) =>
      duplicateAuditEvent(entityType, verb, item, duplicates, acknowledged)
  };
}

/** Name and type of a component after applying a PATCH body; null when neither changes. */
function changedComponentIdentity(
  existing: { name: string; componentTypeId: string },
  patch: Record<string, unknown>
): { name: string; componentTypeId: string } | null {
  const name = typeof patch.name === "string" ? patch.name : existing.name;
  const componentTypeId = typeof patch.componentTypeId === "string" ? patch.componentTypeId : existing.componentTypeId;
  return name !== existing.name || componentTypeId !== existing.componentTypeId ? { name, componentTypeId } : null;
}

class PreconditionError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function expectedVersion(header: string | undefined): number {
  if (header === undefined) throw new PreconditionError(428, "If-Match mit der aktuellen Objektversion ist erforderlich.");
  const normalized = header.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  const value = Number(normalized);
  if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(value) || value < 1) {
    throw new PreconditionError(400, "If-Match muss eine positive ganzzahlige Objektversion enthalten.");
  }
  return value;
}

/** Empty/null clears the external id; anything else must be a short string. */
function parseExternalId(value: unknown): { value?: string; error?: string } {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value !== "string") return { error: "Die Externe ID muss ein Text sein." };
  const trimmed = value.trim();
  if (trimmed.length > MAX_EXTERNAL_ID_LENGTH) return { error: `Die Externe ID darf höchstens ${MAX_EXTERNAL_ID_LENGTH} Zeichen lang sein.` };
  return { value: trimmed || undefined };
}

const MAX_CATALOG_NAME = 120;

const stringList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === "string") ? [...new Set(value as string[])] : null;

/** Validates a catalog payload against the model; unknown ids and keys are rejected, never silently dropped. */
function parseCatalog(body: Record<string, unknown>, state: SidebarState, existing?: Catalog): { value?: Omit<Catalog, "id">; error?: string } {
  const merged = { ...(existing ?? {}), ...body } as Record<string, unknown>;
  const name = typeof merged.name === "string" ? merged.name.trim() : "";
  if (!name) return { error: "Der Name des Katalogs ist erforderlich." };
  if (name.length > MAX_CATALOG_NAME) return { error: `Der Name darf höchstens ${MAX_CATALOG_NAME} Zeichen lang sein.` };
  const kind = merged.kind === "relations" ? "relations" : merged.kind === "elements" || merged.kind === undefined ? "elements" : null;
  if (!kind) return { error: "Die Art des Katalogs muss „elements“ oder „relations“ sein." };
  if (merged.description !== undefined && typeof merged.description !== "string") return { error: "Die Beschreibung muss ein Text sein." };
  const lists = {
    componentTypeIds: stringList(merged.componentTypeIds ?? []),
    connectionTypeIds: stringList(merged.connectionTypeIds ?? []),
    propertyKeys: stringList(merged.propertyKeys ?? []),
    columns: stringList(merged.columns ?? [])
  };
  if (Object.values(lists).some((list) => list === null)) return { error: "Auswahllisten müssen aus Texten bestehen." };
  const componentTypeIds = kind === "elements" ? lists.componentTypeIds! : [];
  const connectionTypeIds = kind === "relations" ? lists.connectionTypeIds! : [];
  const propertyKeys = kind === "elements" ? lists.propertyKeys! : [];
  const columns = lists.columns!;
  const knownComponentTypes = new Set(state.componentTypes.map((type) => type.id));
  const knownConnectionTypes = new Set(state.connectionTypes.map((type) => type.id));
  if (componentTypeIds.some((id) => !knownComponentTypes.has(id))) return { error: "Mindestens ein ausgewählter Elementtyp existiert nicht." };
  if (connectionTypeIds.some((id) => !knownConnectionTypes.has(id))) return { error: "Mindestens ein ausgewählter Verbindungstyp existiert nicht." };
  const allowedColumns = new Set(catalogColumnKeys(kind));
  if (columns.some((key) => !allowedColumns.has(key))) return { error: "Mindestens eine ausgewählte Spalte ist ungültig." };
  if (propertyKeys.length > 200 || propertyKeys.some((key) => key.length > 200)) return { error: "Zu viele oder zu lange Eigenschaftsnamen." };
  return { value: { name, description: (merged.description as string | undefined) ?? "", kind, componentTypeIds, connectionTypeIds, propertyKeys, columns } };
}

// ── Catalogs (REQ-31) ────────────────────────────────────────────────────────

router.get("/catalogs", async (_req, res, next) => {
  try {
    res.json((await readSidebarState()).catalogs);
  } catch (err) {
    next(err);
  }
});

router.post("/catalogs", async (req, res, next) => {
  try {
    const parsed = parseCatalog((req.body ?? {}) as Record<string, unknown>, await readSidebarState());
    if (!parsed.value) return res.status(400).json({ error: parsed.error });
    res.status(201).json(await addCatalog({ id: crypto.randomUUID(), ...parsed.value }));
  } catch (err) {
    next(err);
  }
});

router.patch("/catalogs/:id", async (req, res, next) => {
  try {
    const state = await readSidebarState();
    const existing = state.catalogs.find((item) => item.id === req.params.id);
    if (!existing) return res.status(404).json({ error: "Katalog nicht gefunden." });
    const parsed = parseCatalog((req.body ?? {}) as Record<string, unknown>, state, existing);
    if (!parsed.value) return res.status(400).json({ error: parsed.error });
    res.json(await updateCatalog(req.params.id, parsed.value));
  } catch (err) {
    next(err);
  }
});

router.delete("/catalogs/:id", async (req, res, next) => {
  try {
    if (!(await deleteCatalog(req.params.id))) return res.status(404).json({ error: "Katalog nicht gefunden." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Full sidebar state ───────────────────────────────────────────────────────

router.get("/", async (_req, res, next) => {
  try {
    res.json(await readSidebarState());
  } catch (err) {
    next(err);
  }
});

// ── Component Types ──────────────────────────────────────────────────────────

router.get("/metamodel/export", async (_req, res, next) => {
  try {
    res.json(await exportMetamodelDefinition());
  } catch (err) {
    next(err);
  }
});

router.get("/metamodel/default", async (_req, res, next) => {
  try {
    res.json(await readDefaultMetamodelDefinition());
  } catch (err) {
    next(err);
  }
});

router.post("/metamodel/import", async (req, res, next) => {
  try {
    const result = await importMetamodelDefinition(req.body);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/component-types", async (_req, res, next) => {
  try {
    res.json(await getComponentTypes());
  } catch (err) {
    next(err);
  }
});

router.post("/component-types", async (req, res, next) => {
  try {
    const { name, color, icon, description, customPropertyKeys, shape, category, layer, isRequiredInViewpoint, allowedInViewpointIds, acknowledgeDuplicate } = req.body as {
      acknowledgeDuplicate?: boolean;
      name?: string;
      color?: string;
      icon?: string;
      description?: string;
      customPropertyKeys?: string[];
      shape?: string;
      category?: string;
      layer?: string;
      isRequiredInViewpoint?: boolean;
      allowedInViewpointIds?: string[];
    };
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    const check = checkTypeNameDuplicates("DUPLICATE_COMPONENT_TYPE", "component-type", await getComponentTypes(), name);
    const id = crypto.randomUUID();
    const ct = await addComponentType({
      id,
      name: name.trim(),
      color: color ?? "#475569",
      icon: icon ?? "box",
      description: description ?? "",
      customPropertyKeys: customPropertyKeys ?? [],
      shape: (shape as ComponentShape) ?? "box",
      category: category?.trim() || "Standard",
      layer: layer?.trim() || category?.trim() || "Business",
      isRequiredInViewpoint: Boolean(isRequiredInViewpoint),
      allowedInViewpointIds: allowedInViewpointIds ?? []
    }, check.event("created", { id, name: name.trim() }, acknowledgeDuplicate === true));
    res.status(201).json({ ...ct, warnings: check.warnings });
  } catch (err) {
    next(err);
  }
});

router.patch("/component-types/:id", async (req, res, next) => {
  try {
    const { acknowledgeDuplicate, ...patch } = req.body as Partial<ComponentType> & { acknowledgeDuplicate?: boolean };
    const types = await getComponentTypes();
    const existing = types.find((type) => type.id === req.params.id);
    if (!existing) return res.status(404).json({ error: "Component type not found." });
    const renamed = typeof patch.name === "string" && patch.name !== existing.name;
    const check = checkTypeNameDuplicates("DUPLICATE_COMPONENT_TYPE", "component-type", renamed ? types : [], patch.name ?? "", existing.id);
    const updated = await updateComponentType(req.params.id, patch,
      check.event("updated", { id: existing.id, name: patch.name ?? existing.name }, acknowledgeDuplicate === true));
    if (!updated) return res.status(404).json({ error: "Component type not found." });
    res.json({ ...updated, warnings: check.warnings });
  } catch (err) {
    next(err);
  }
});

router.delete("/component-types/:id", async (req, res, next) => {
  try {
    const deleted = await deleteComponentType(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Component type not found." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Connection Types ─────────────────────────────────────────────────────────

router.get("/connection-types", async (_req, res, next) => {
  try {
    res.json(await getConnectionTypes());
  } catch (err) {
    next(err);
  }
});

router.post("/connection-types", async (req, res, next) => {
  try {
    const {
      name,
      color,
      lineStyle,
      allowedSourceTypeIds,
      allowedTargetTypeIds,
      description,
      category,
      requiredForSourceTypes,
      requiredForTargetTypes,
      directionDescription,
      acknowledgeDuplicate
    } = req.body as {
      acknowledgeDuplicate?: boolean;
      name?: string;
      color?: string;
      lineStyle?: string;
      allowedSourceTypeIds?: string[];
      allowedTargetTypeIds?: string[];
      description?: string;
      category?: string;
      requiredForSourceTypes?: string[];
      requiredForTargetTypes?: string[];
      directionDescription?: string;
    };
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    const check = checkTypeNameDuplicates("DUPLICATE_CONNECTION_TYPE", "connection-type", await getConnectionTypes(), name);
    const id = crypto.randomUUID();
    const ct = await addConnectionType({
      id,
      name: name.trim(),
      color: color ?? "#475569",
      lineStyle: (lineStyle as "solid" | "dashed" | "dotted") ?? "solid",
      allowedSourceTypeIds: allowedSourceTypeIds ?? [],
      allowedTargetTypeIds: allowedTargetTypeIds ?? [],
      description: description ?? "",
      category: category?.trim() || "Standard",
      requiredForSourceTypes: requiredForSourceTypes ?? [],
      requiredForTargetTypes: requiredForTargetTypes ?? [],
      directionDescription: directionDescription ?? ""
    }, check.event("created", { id, name: name.trim() }, acknowledgeDuplicate === true));
    res.status(201).json({ ...ct, warnings: check.warnings });
  } catch (err) {
    next(err);
  }
});

router.patch("/connection-types/:id", async (req, res, next) => {
  try {
    const { acknowledgeDuplicate, ...patch } = req.body as Partial<ConnectionType> & { acknowledgeDuplicate?: boolean };
    const types = await getConnectionTypes();
    const existing = types.find((type) => type.id === req.params.id);
    if (!existing) return res.status(404).json({ error: "Connection type not found." });
    const renamed = typeof patch.name === "string" && patch.name !== existing.name;
    const check = checkTypeNameDuplicates("DUPLICATE_CONNECTION_TYPE", "connection-type", renamed ? types : [], patch.name ?? "", existing.id);
    const updated = await updateConnectionType(req.params.id, patch,
      check.event("updated", { id: existing.id, name: patch.name ?? existing.name }, acknowledgeDuplicate === true));
    if (!updated) return res.status(404).json({ error: "Connection type not found." });
    res.json({ ...updated, warnings: check.warnings });
  } catch (err) {
    next(err);
  }
});

router.delete("/connection-types/:id", async (req, res, next) => {
  try {
    const deleted = await deleteConnectionType(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Connection type not found." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Components ───────────────────────────────────────────────────────────────

router.get("/connection-rules", async (_req, res, next) => {
  try {
    res.json(await getConnectionRules());
  } catch (err) {
    next(err);
  }
});

router.post("/connection-rules", async (req, res, next) => {
  try {
    const { sourceComponentTypeId, connectionTypeId, targetComponentTypeId, allowed, required, severity, description, rationale, viewpointIds, minOccurrences, maxOccurrences } = req.body as {
      sourceComponentTypeId?: string;
      connectionTypeId?: string;
      targetComponentTypeId?: string;
      allowed?: boolean;
      required?: boolean;
      severity?: "error" | "warning";
      description?: string;
      rationale?: string;
      viewpointIds?: string[];
      minOccurrences?: number;
      maxOccurrences?: number;
    };
    if (!sourceComponentTypeId) return res.status(400).json({ error: "sourceComponentTypeId is required." });
    if (!connectionTypeId) return res.status(400).json({ error: "connectionTypeId is required." });
    if (!targetComponentTypeId) return res.status(400).json({ error: "targetComponentTypeId is required." });
    const rule = await addConnectionRule({
      id: crypto.randomUUID(),
      sourceComponentTypeId,
      connectionTypeId,
      targetComponentTypeId,
      allowed: allowed ?? true,
      required: required ?? false,
      severity: severity ?? "error",
      description: description ?? "",
      rationale: rationale ?? "",
      viewpointIds: viewpointIds ?? [],
      minOccurrences,
      maxOccurrences
    });
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

router.patch("/connection-rules/:id", async (req, res, next) => {
  try {
    const updated = await updateConnectionRule(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Connection rule not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/connection-rules/:id", async (req, res, next) => {
  try {
    const deleted = await deleteConnectionRule(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Connection rule not found." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/viewpoints", async (_req, res, next) => {
  try {
    res.json(await getViewpoints());
  } catch (err) {
    next(err);
  }
});

router.post("/viewpoints", async (req, res, next) => {
  try {
    const {
      name,
      description,
      stakeholderRole,
      allowedComponentTypeIds,
      allowedConnectionTypeIds,
      requiredComponentTypeIds,
      requiredConnectionTypeIds,
      maxVisibleLayers,
      purpose
    } = req.body as {
      name?: string;
      description?: string;
      stakeholderRole?: string;
      allowedComponentTypeIds?: string[];
      allowedConnectionTypeIds?: string[];
      requiredComponentTypeIds?: string[];
      requiredConnectionTypeIds?: string[];
      maxVisibleLayers?: number;
      purpose?: string;
    };
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    const viewpoint = await addViewpoint({
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description ?? "",
      stakeholderRole: stakeholderRole ?? "",
      allowedComponentTypeIds: allowedComponentTypeIds ?? [],
      allowedConnectionTypeIds: allowedConnectionTypeIds ?? [],
      requiredComponentTypeIds: requiredComponentTypeIds ?? [],
      requiredConnectionTypeIds: requiredConnectionTypeIds ?? [],
      maxVisibleLayers,
      purpose: purpose ?? ""
    });
    res.status(201).json(viewpoint);
  } catch (err) {
    next(err);
  }
});

router.patch("/viewpoints/:id", async (req, res, next) => {
  try {
    const updated = await updateViewpoint(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Viewpoint not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/viewpoints/:id", async (req, res, next) => {
  try {
    const deleted = await deleteViewpoint(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Viewpoint not found." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/components", async (_req, res, next) => {
  try {
    res.json(await getComponents());
  } catch (err) {
    next(err);
  }
});

router.post("/components", async (req, res, next) => {
  try {
    const { name, componentTypeId, properties, description, externalId, acknowledgeDuplicate } = req.body as {
      name?: string;
      componentTypeId?: string;
      properties?: Record<string, string>;
      description?: string;
      externalId?: unknown;
      acknowledgeDuplicate?: boolean;
    };
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    if (!componentTypeId) return res.status(400).json({ error: "componentTypeId is required." });
    const external = parseExternalId(externalId);
    if (external.error) return res.status(400).json({ error: external.error });
    const components = await getComponents();
    if (external.value && components.some((item) => item.externalId === external.value)) {
      return res.status(409).json({ error: "Diese Externe ID wird bereits von einer anderen Komponente verwendet." });
    }
    const duplicates = findDuplicateComponents(components, { name, componentTypeId });
    const id = crypto.randomUUID();
    const comp = await addComponent({
      id,
      version: 1,
      name: name.trim(),
      componentTypeId,
      properties: properties ?? {},
      description: description ?? "",
      ...(external.value ? { externalId: external.value } : {})
    }, duplicateAuditEvent("component", "created", { id, name: name.trim() }, duplicates, acknowledgeDuplicate === true));
    res.status(201).json({ ...comp, warnings: duplicateComponentWarnings(duplicates) });
  } catch (err) {
    next(err);
  }
});

router.patch("/components/:id", async (req, res, next) => {
  try {
    const version = expectedVersion(req.header("if-match"));
    const { acknowledgeDuplicate, ...patch } = { ...req.body } as Record<string, unknown>;
    const components = await getComponents();
    if ("externalId" in patch) {
      const external = parseExternalId(patch.externalId);
      if (external.error) return res.status(400).json({ error: external.error });
      if (external.value && components.some((item) => item.externalId === external.value && item.id !== req.params.id)) {
        return res.status(409).json({ error: "Diese Externe ID wird bereits von einer anderen Komponente verwendet." });
      }
      patch.externalId = external.value;
    }
    const existing = components.find((item) => item.id === req.params.id);
    const identity = existing ? changedComponentIdentity(existing, patch) : null;
    const duplicates = existing && identity ? findDuplicateComponents(components, identity, existing.id) : [];
    const event = existing && identity
      ? duplicateAuditEvent("component", "updated", { id: existing.id, name: identity.name }, duplicates, acknowledgeDuplicate === true)
      : undefined;
    const updated = await updateComponent(req.params.id, patch, version, event);
    if (!updated) return res.status(404).json({ error: "Component not found." });
    res.json({ ...updated, warnings: duplicateComponentWarnings(duplicates) });
  } catch (err) {
    next(err);
  }
});

router.delete("/components/:id", async (req, res, next) => {
  try {
    const deleted = await deleteComponent(req.params.id, expectedVersion(req.header("if-match")));
    if (!deleted) return res.status(404).json({ error: "Component not found." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Connections ──────────────────────────────────────────────────────────────

router.get("/connections", async (_req, res, next) => {
  try {
    res.json(await getConnections());
  } catch (err) {
    next(err);
  }
});

router.post("/connections", async (req, res, next) => {
  try {
    const { name, connectionTypeId, sourceComponentId, targetComponentId, description, properties, externalId } = req.body as {
      name?: string;
      connectionTypeId?: string;
      sourceComponentId?: string;
      targetComponentId?: string;
      description?: string;
      properties?: Record<string, string>;
      externalId?: unknown;
    };
    if (!connectionTypeId) return res.status(400).json({ error: "connectionTypeId is required." });
    if (!sourceComponentId) return res.status(400).json({ error: "sourceComponentId is required." });
    if (!targetComponentId) return res.status(400).json({ error: "targetComponentId is required." });
    const external = parseExternalId(externalId);
    if (external.error) return res.status(400).json({ error: external.error });
    const candidate = {
      id: crypto.randomUUID(),
      version: 1,
      name: name ?? "",
      connectionTypeId,
      sourceComponentId,
      targetComponentId,
      description: description ?? "",
      properties: properties ?? {},
      ...(external.value ? { externalId: external.value } : {})
    };
    const state = await readSidebarState();
    if (external.value && state.connections.some((item) => item.externalId === external.value)) {
      return res.status(409).json({ error: "Diese Externe ID wird bereits von einer anderen Verbindung verwendet." });
    }
    const validation = validateConnectionInstance(candidate, state);
    if (!validation.valid) return res.status(400).json({ error: validation.errors[0]?.message ?? "Connection is not valid.", ...validation });
    const conn = await addConnection(candidate);
    res.status(201).json(conn);
  } catch (err) {
    next(err);
  }
});

router.patch("/connections/:id", async (req, res, next) => {
  try {
    const version = expectedVersion(req.header("if-match"));
    const state = await readSidebarState();
    const existing = state.connections.find((connection) => connection.id === req.params.id);
    if (!existing) return res.status(404).json({ error: "Connection not found." });
    const patch = { ...req.body } as Record<string, unknown>;
    if ("externalId" in patch) {
      const external = parseExternalId(patch.externalId);
      if (external.error) return res.status(400).json({ error: external.error });
      if (external.value && state.connections.some((item) => item.externalId === external.value && item.id !== req.params.id)) {
        return res.status(409).json({ error: "Diese Externe ID wird bereits von einer anderen Verbindung verwendet." });
      }
      patch.externalId = external.value;
    }
    const candidate = { ...existing, ...patch, id: req.params.id };
    const validation = validateConnectionInstance(candidate, state);
    if (!validation.valid) return res.status(400).json({ error: validation.errors[0]?.message ?? "Connection is not valid.", ...validation });
    const updated = await updateConnection(req.params.id, patch, version);
    if (!updated) return res.status(404).json({ error: "Connection not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/connections/:id", async (req, res, next) => {
  try {
    const deleted = await deleteConnection(req.params.id, expectedVersion(req.header("if-match")));
    if (!deleted) return res.status(404).json({ error: "Connection not found." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Diagrams ─────────────────────────────────────────────────────────────────

router.get("/diagrams", async (_req, res, next) => {
  try {
    res.json(await getDiagrams());
  } catch (err) {
    next(err);
  }
});

router.post("/diagrams", async (req, res, next) => {
  try {
    const { name, description, viewpointId } = req.body as { name?: string; description?: string; viewpointId?: string };
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    const state = await readSidebarState();
    const diagram = await addDiagram({
      id: crypto.randomUUID(),
      version: 1,
      name: name.trim(),
      description: description ?? "",
      componentIds: [],
      connectionIds: [],
      positions: {},
      metamodelId: state.metamodel.id,
      viewpointId
    });
    res.status(201).json(diagram);
  } catch (err) {
    next(err);
  }
});

router.post("/diagrams/:id/components", async (req, res, next) => {
  try {
    const version = expectedVersion(req.header("if-match"));
    const { name, componentTypeId, properties, description, externalId, position, acknowledgeDuplicate } = req.body as {
      name?: string;
      componentTypeId?: string;
      properties?: Record<string, string>;
      description?: string;
      externalId?: unknown;
      position?: { x?: unknown; y?: unknown };
      acknowledgeDuplicate?: boolean;
    };
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    if (!componentTypeId) return res.status(400).json({ error: "componentTypeId is required." });
    if (!position || typeof position.x !== "number" || !Number.isFinite(position.x)
      || typeof position.y !== "number" || !Number.isFinite(position.y)) {
      return res.status(400).json({ error: "position with finite x and y is required." });
    }
    const state = await readSidebarState();
    const diagram = state.diagrams.find((item) => item.id === req.params.id);
    if (!diagram) return res.status(404).json({ error: "Diagram not found." });
    if (!state.componentTypes.some((item) => item.id === componentTypeId)) {
      return res.status(400).json({ error: "componentTypeId is not part of the active metamodel." });
    }
    const external = parseExternalId(externalId);
    if (external.error) return res.status(400).json({ error: external.error });
    if (external.value && state.components.some((item) => item.externalId === external.value)) {
      return res.status(409).json({ error: "Diese Externe ID wird bereits von einer anderen Komponente verwendet." });
    }
    const duplicates = findDuplicateComponents(state.components, { name, componentTypeId });
    const id = crypto.randomUUID();
    const result = await addComponentToDiagram({
      id,
      version: 1,
      name: name.trim(),
      componentTypeId,
      properties: properties ?? {},
      description: description ?? "",
      ...(external.value ? { externalId: external.value } : {})
    }, diagram.id, { x: position.x, y: position.y }, version,
    duplicateAuditEvent("component", "created", { id, name: name.trim() }, duplicates, acknowledgeDuplicate === true));
    res.status(201).json({ ...result, warnings: duplicateComponentWarnings(duplicates) });
  } catch (err) {
    next(err);
  }
});

router.post("/diagrams/:id/connections", async (req, res, next) => {
  try {
    const { name, connectionTypeId, sourceComponentId, targetComponentId, description, properties } = req.body as {
      name?: string;
      connectionTypeId?: string;
      sourceComponentId?: string;
      targetComponentId?: string;
      description?: string;
      properties?: Record<string, string>;
    };
    if (!connectionTypeId) return res.status(400).json({ error: "connectionTypeId is required." });
    if (!sourceComponentId) return res.status(400).json({ error: "sourceComponentId is required." });
    if (!targetComponentId) return res.status(400).json({ error: "targetComponentId is required." });

    const state = await readSidebarState();
    const diagram = state.diagrams.find((item) => item.id === req.params.id);
    if (!diagram) return res.status(404).json({ error: "Diagram not found." });
    if (!diagram.componentIds.includes(sourceComponentId) || !diagram.componentIds.includes(targetComponentId)) {
      return res.status(400).json({ error: "Connection source and target must both be visible in the diagram." });
    }

    const existing = state.connections.find((connection) =>
      connection.connectionTypeId === connectionTypeId &&
      connection.sourceComponentId === sourceComponentId &&
      connection.targetComponentId === targetComponentId
    );
    const candidate = existing ?? {
      id: crypto.randomUUID(),
      version: 1,
      name: name ?? "",
      connectionTypeId,
      sourceComponentId,
      targetComponentId,
      description: description ?? "",
      properties: properties ?? {}
    };
    const validation = validateConnectionInstance(candidate, state, diagram);
    if (!validation.valid) return res.status(400).json({ error: validation.errors[0]?.message ?? "Connection is not valid.", ...validation });

    const result = await addConnectionToDiagram(candidate, diagram.id);
    res.status(existing ? 200 : 201).json({ ...result, created: !existing });
  } catch (err) {
    next(err);
  }
});

router.get("/diagrams/:id", async (req, res, next) => {
  try {
    const aggregate = await getDiagramWithContents(req.params.id);
    if (!aggregate) return res.status(404).json({ error: "Diagram not found." });
    res.json(aggregate);
  } catch (err) {
    next(err);
  }
});

router.get("/diagrams/:id/validate", async (req, res, next) => {
  try {
    const state = await readSidebarState();
    const diagram = state.diagrams.find((item) => item.id === req.params.id);
    if (!diagram) return res.status(404).json({ error: "Diagram not found." });
    res.json(validateDiagram(diagram, state));
  } catch (err) {
    next(err);
  }
});

router.patch("/diagrams/:id", async (req, res, next) => {
  try {
    const version = expectedVersion(req.header("if-match"));
    const state = await readSidebarState();
    const existing = state.diagrams.find((diagram) => diagram.id === req.params.id);
    if (!existing) return res.status(404).json({ error: "Diagram not found." });
    const candidate = { ...existing, ...req.body, id: req.params.id };
    const validation = validateDiagram(candidate, state, { includeRequiredRules: false });
    if (!validation.valid) return res.status(400).json({ error: validation.errors[0]?.message ?? "Diagram is not valid.", ...validation });
    const updated = await updateDiagram(req.params.id, req.body, version);
    if (!updated) return res.status(404).json({ error: "Diagram not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/diagrams/:id", async (req, res, next) => {
  try {
    const deleted = await deleteDiagram(req.params.id, expectedVersion(req.header("if-match")));
    if (!deleted) return res.status(404).json({ error: "Diagram not found." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof PreconditionError) {
    res.status(error.status).json({ error: error.message, code: error.status === 428 ? "PRECONDITION_REQUIRED" : "PRECONDITION_INVALID" });
    return;
  }
  if (error instanceof ResourceNotFoundError) {
    res.status(404).json({ error: error.message, code: "RESOURCE_NOT_FOUND" });
    return;
  }
  if (error instanceof OptimisticLockError) {
    res.status(409).json({
      error: "Das Objekt wurde zwischenzeitlich geändert. Neu laden oder bewusst gegen den aktuellen Stand überschreiben.",
      code: "OPTIMISTIC_LOCK_CONFLICT",
      current: error.current
    });
    return;
  }
  next(error);
});

export default router;
