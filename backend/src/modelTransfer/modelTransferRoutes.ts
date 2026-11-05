import { Router } from "express";
import { readSidebarState, writeSidebarState } from "../Sidebar/sidebarStore.js";
import { TenantResourceIdConflictError } from "../persistence/databaseSidebarRepository.js";
import {
  exportModelTransferDocument,
  materializeModelTransferState,
  ModelTransferError,
  parseModelTransferDocument
} from "./modelTransfer.js";

const router = Router();

router.get("/model/export", async (_req, res, next) => {
  try {
    const document = exportModelTransferDocument(await readSidebarState(), _req.user!.companyId);
    res.setHeader("Content-Disposition", "attachment; filename=\"vibe-eam-model-v1.json\"");
    res.json(document);
  } catch (error) {
    next(error);
  }
});

router.post("/model/import", async (req, res, next) => {
  try {
    const document = parseModelTransferDocument(req.body);
    const stored = await writeSidebarState(materializeModelTransferState(document, req.user!.companyId), {
      action: "model-json.import",
      entityType: "model",
      summary: `Vollständiges JSON-Modell (Schema ${document.schemaVersion}) importiert.`,
      details: { schemaVersion: document.schemaVersion, format: document.format }
    });
    res.json(exportModelTransferDocument(stored, req.user!.companyId));
  } catch (error) {
    if (error instanceof ModelTransferError) {
      res.status(error.status).json({ error: error.message, code: error.code, details: error.details });
      return;
    }
    if (error instanceof TenantResourceIdConflictError) {
      res.status(409).json({
        error: "Import rejected because one or more portable resource IDs are owned by another company.",
        code: "MODEL_ID_TENANT_CONFLICT"
      });
      return;
    }
    next(error);
  }
});

export default router;
