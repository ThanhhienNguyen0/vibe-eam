import { Router } from "express";
import type { ComponentShape } from "./sidebarTypes.js";
import { validateConnectionInstance, validateDiagram } from "./metamodelRules.js";
import {
  addComponent,
  addComponentType,
  addConnection,
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
  updateViewpoint
} from "./sidebarStore.js";

const router = Router();

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
    const { name, color, icon, description, customPropertyKeys, shape, category, layer, isRequiredInViewpoint, allowedInViewpointIds } = req.body as {
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
    const ct = await addComponentType({
      id: crypto.randomUUID(),
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
    });
    res.status(201).json(ct);
  } catch (err) {
    next(err);
  }
});

router.patch("/component-types/:id", async (req, res, next) => {
  try {
    const updated = await updateComponentType(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Component type not found." });
    res.json(updated);
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
      directionDescription
    } = req.body as {
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
    const ct = await addConnectionType({
      id: crypto.randomUUID(),
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
    });
    res.status(201).json(ct);
  } catch (err) {
    next(err);
  }
});

router.patch("/connection-types/:id", async (req, res, next) => {
  try {
    const updated = await updateConnectionType(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Connection type not found." });
    res.json(updated);
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
    const { name, componentTypeId, properties, description } = req.body as {
      name?: string;
      componentTypeId?: string;
      properties?: Record<string, string>;
      description?: string;
    };
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    if (!componentTypeId) return res.status(400).json({ error: "componentTypeId is required." });
    const comp = await addComponent({
      id: crypto.randomUUID(),
      name: name.trim(),
      componentTypeId,
      properties: properties ?? {},
      description: description ?? ""
    });
    res.status(201).json(comp);
  } catch (err) {
    next(err);
  }
});

router.patch("/components/:id", async (req, res, next) => {
  try {
    const updated = await updateComponent(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Component not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/components/:id", async (req, res, next) => {
  try {
    const deleted = await deleteComponent(req.params.id);
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
    const candidate = {
      id: crypto.randomUUID(),
      name: name ?? "",
      connectionTypeId,
      sourceComponentId,
      targetComponentId,
      description: description ?? "",
      properties: properties ?? {}
    };
    const state = await readSidebarState();
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
    const state = await readSidebarState();
    const existing = state.connections.find((connection) => connection.id === req.params.id);
    if (!existing) return res.status(404).json({ error: "Connection not found." });
    const candidate = { ...existing, ...req.body, id: req.params.id };
    const validation = validateConnectionInstance(candidate, state);
    if (!validation.valid) return res.status(400).json({ error: validation.errors[0]?.message ?? "Connection is not valid.", ...validation });
    const updated = await updateConnection(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Connection not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/connections/:id", async (req, res, next) => {
  try {
    const deleted = await deleteConnection(req.params.id);
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
    const state = await readSidebarState();
    const existing = state.diagrams.find((diagram) => diagram.id === req.params.id);
    if (!existing) return res.status(404).json({ error: "Diagram not found." });
    const candidate = { ...existing, ...req.body, id: req.params.id };
    const validation = validateDiagram(candidate, state, { includeRequiredRules: false });
    if (!validation.valid) return res.status(400).json({ error: validation.errors[0]?.message ?? "Diagram is not valid.", ...validation });
    const updated = await updateDiagram(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Diagram not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/diagrams/:id", async (req, res, next) => {
  try {
    const deleted = await deleteDiagram(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Diagram not found." });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
