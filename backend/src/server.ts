import cors from "cors";
import express from "express";
import {
  addElement,
  addRelation,
  deleteElement,
  deleteRelation,
  getAuditLog,
  getModel,
  importModel,
  updateElement
} from "./store.js";
import {
  layerForType,
  normalizeElement,
  normalizeRelation,
  validateElement,
  validateModel,
  validateRelation
} from "./validation.js";
import type { EamModel } from "./types.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/model", async (_req, res, next) => {
  try {
    res.json(await getModel());
  } catch (error) {
    next(error);
  }
});

app.post("/api/model/elements", async (req, res, next) => {
  try {
    const model = await getModel();
    const element = normalizeElement({
      ...req.body,
      layer: req.body.layer ?? layerForType(req.body.type ?? "Business Capability")
    });
    const validation = validateElement(element, new Set(model.elements.map((item) => item.id)));
    if (!validation.valid) return res.status(400).json(validation);
    const state = await addElement(element);
    res.status(201).json({ element, model: { elements: state.elements, relations: state.relations } });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/model/elements/:id", async (req, res, next) => {
  try {
    const existing = (await getModel()).elements.find((element) => element.id === req.params.id);
    if (!existing) return res.status(404).json({ error: "Element not found." });

    const updatedCandidate = normalizeElement({ ...existing, ...req.body, id: req.params.id });
    const validation = validateElement(updatedCandidate);
    if (!validation.valid) return res.status(400).json(validation);

    const updated = await updateElement(req.params.id, updatedCandidate);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/model/elements/:id", async (req, res, next) => {
  try {
    const deleted = await deleteElement(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Element not found." });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/model/relations", async (req, res, next) => {
  try {
    const model = await getModel();
    const relation = normalizeRelation(req.body);
    const validation = validateRelation(relation, model, new Set(model.relations.map((item) => item.id)));
    if (!validation.valid) return res.status(400).json(validation);
    const state = await addRelation(relation);
    res.status(201).json({ relation, model: { elements: state.elements, relations: state.relations } });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/model/relations/:id", async (req, res, next) => {
  try {
    const deleted = await deleteRelation(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Relation not found." });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/model/import", async (req, res, next) => {
  try {
    const model = req.body as EamModel;
    const validation = validateModel(model);
    if (!validation.valid) return res.status(400).json(validation);
    const state = await importModel(model);
    res.json({ elements: state.elements, relations: state.relations });
  } catch (error) {
    next(error);
  }
});

app.get("/api/model/export", async (_req, res, next) => {
  try {
    res.json(await getModel());
  } catch (error) {
    next(error);
  }
});

app.get("/api/audit-log", async (_req, res, next) => {
  try {
    res.json(await getAuditLog());
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error." });
});

app.listen(port, () => {
  console.log(`EAM backend listening on http://localhost:${port}`);
});
