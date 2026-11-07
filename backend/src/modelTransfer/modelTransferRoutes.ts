import { Router, type Response } from "express";
import { readSidebarState, writeSidebarState } from "../Sidebar/sidebarStore.js";
import { OptimisticLockError, TenantResourceIdConflictError } from "../persistence/databaseSidebarRepository.js";
import {
  exportModelTransferDocument,
  materializeModelTransferState,
  ModelTransferError,
  parseModelTransferDocument
} from "./modelTransfer.js";

const router = Router();

function sendTransferError(res: Response, error: ModelTransferError): void {
  res.status(error.status).json({ error: error.message, code: error.code, details: error.details });
}

router.get("/model/export", async (_req, res, next) => {
  try {
    const state = await readSidebarState();
    const document = exportModelTransferDocument(state, _req.user!.companyId);
    res.setHeader("ETag", `"${state.dataRevision}"`);
    res.setHeader("Content-Disposition", "attachment; filename=\"vibe-eam-model-v1.json\"");
    res.json(document);
  } catch (error) {
    if (error instanceof ModelTransferError) {
      sendTransferError(res, error);
      return;
    }
    next(error);
  }
});

router.post("/model/import", async (req, res, next) => {
  try {
    const ifMatch = req.header("if-match");
    if (ifMatch === undefined) {
      res.status(428).json({ error: "If-Match mit der Datenbasisrevision aus dem Export ist erforderlich.", code: "PRECONDITION_REQUIRED" });
      return;
    }
    const normalized = ifMatch.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
    const expectedRevision = Number(normalized);
    if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      res.status(400).json({ error: "If-Match muss eine nichtnegative ganzzahlige Datenbasisrevision enthalten.", code: "PRECONDITION_INVALID" });
      return;
    }
    const document = parseModelTransferDocument(req.body);
    const imported = materializeModelTransferState(document, req.user!.companyId);
    imported.dataRevision = expectedRevision;
    const stored = await writeSidebarState(imported, {
      action: "model-json.import",
      entityType: "model",
      summary: `Vollständiges JSON-Modell (Schema ${document.schemaVersion}) importiert.`,
      details: { schemaVersion: document.schemaVersion, format: document.format }
    });
    res.json(exportModelTransferDocument(stored, req.user!.companyId));
  } catch (error) {
    if (error instanceof ModelTransferError) {
      sendTransferError(res, error);
      return;
    }
    if (error instanceof TenantResourceIdConflictError) {
      res.status(409).json({
        error: "Import rejected because one or more portable resource IDs are owned by another company.",
        code: "MODEL_ID_TENANT_CONFLICT"
      });
      return;
    }
    if (error instanceof OptimisticLockError) {
      res.status(409).json({
        error: "Die Datenbasis wurde seit dem Export geändert. Bitte aktuellen Stand exportieren oder erneut bestätigen.",
        code: "MODEL_BASE_REVISION_CONFLICT",
        current: error.current
      });
      return;
    }
    next(error);
  }
});

export default router;
