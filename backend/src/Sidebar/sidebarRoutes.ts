import { Router } from "express";
import {
  addComponent,
  addComponentType,
  addConnection,
  addConnectionType,
  addDiagram,
  deleteComponent,
  deleteComponentType,
  deleteConnection,
  deleteConnectionType,
  deleteDiagram,
  getComponents,
  getComponentTypes,
  getConnections,
  getConnectionTypes,
  getDiagrams,
  readSidebarState,
  updateComponent,
  updateComponentType,
  updateConnection,
  updateConnectionType,
  updateDiagram
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

router.get("/component-types", async (_req, res, next) => {
  try {
    res.json(await getComponentTypes());
  } catch (err) {
    next(err);
  }
});

router.post("/component-types", async (req, res, next) => {
  try {
    const { name, color, icon, description, customPropertyKeys } = req.body as {
      name?: string;
      color?: string;
      icon?: string;
      description?: string;
      customPropertyKeys?: string[];
    };
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    const ct = await addComponentType({
      id: crypto.randomUUID(),
      name: name.trim(),
      color: color ?? "#475569",
      icon: icon ?? "box",
      description: description ?? "",
      customPropertyKeys: customPropertyKeys ?? []
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
    const { name, color, lineStyle, allowedSourceTypeIds, allowedTargetTypeIds, description } = req.body as {
      name?: string;
      color?: string;
      lineStyle?: string;
      allowedSourceTypeIds?: string[];
      allowedTargetTypeIds?: string[];
      description?: string;
    };
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    const ct = await addConnectionType({
      id: crypto.randomUUID(),
      name: name.trim(),
      color: color ?? "#475569",
      lineStyle: (lineStyle as "solid" | "dashed" | "dotted") ?? "solid",
      allowedSourceTypeIds: allowedSourceTypeIds ?? [],
      allowedTargetTypeIds: allowedTargetTypeIds ?? [],
      description: description ?? ""
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
    const conn = await addConnection({
      id: crypto.randomUUID(),
      name: name ?? "",
      connectionTypeId,
      sourceComponentId,
      targetComponentId,
      description: description ?? "",
      properties: properties ?? {}
    });
    res.status(201).json(conn);
  } catch (err) {
    next(err);
  }
});

router.patch("/connections/:id", async (req, res, next) => {
  try {
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
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name?.trim()) return res.status(400).json({ error: "name is required." });
    const diagram = await addDiagram({
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description ?? "",
      componentIds: [],
      connectionIds: [],
      positions: {}
    });
    res.status(201).json(diagram);
  } catch (err) {
    next(err);
  }
});

router.patch("/diagrams/:id", async (req, res, next) => {
  try {
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
