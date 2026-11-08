import express, { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import { readSidebarState, writeSidebarState, listAuditLog } from "../Sidebar/sidebarStore.js";
import { OptimisticLockError } from "../persistence/databaseSidebarRepository.js";
import {
  catalogElementFilter,
  catalogPropertyKeys,
  catalogRelationFilter
} from "../catalog/catalogModel.js";
import { buildExportSheets, buildTemplateSheets } from "./exportBuilder.js";
import { countErrors, planImport, type ImportPlan } from "./importPlan.js";
import {
  ImportFormatError,
  buildXlsx,
  parseImportFile,
  serializeCsv,
  type NamedSheet,
  type SheetKind
} from "./tabular.js";

/**
 * Excel/CSV import and export (REQ-31). Mounted below /api/sidebar; every route must also be
 * listed in ROUTE_POLICIES. Uploads are sent as raw bytes (application/octet-stream), so the
 * global 2 MB JSON parser is not involved.
 */
const router = Router();

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const rawUpload = express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES });
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

class TransferError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const firstString = (value: unknown): string | undefined => {
  const item = Array.isArray(value) ? value[0] : value;
  return typeof item === "string" && item.trim() ? item.trim() : undefined;
};

const listParam = (value: unknown): string[] =>
  (firstString(value)?.split(",") ?? []).map((item) => item.trim()).filter(Boolean);

function boundedFilter(value: unknown, name: string): string | undefined {
  const result = firstString(value);
  if (result && result.length > 200) throw new TransferError(400, `${name} ist zu lang.`);
  return result;
}

function dateFilter(value: unknown, name: string): Date | undefined {
  const raw = firstString(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw) || Number.isNaN(parsed.getTime())) {
    throw new TransferError(400, `${name} muss ein ISO-8601-Zeitpunkt mit Zeitzone sein.`);
  }
  return parsed;
}

function auditCursor(value: unknown): { occurredAt: Date | null; id: string } | undefined {
  const raw = firstString(value);
  if (!raw) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { occurredAt?: unknown; id?: unknown };
    if (typeof decoded.id !== "string" || decoded.id.length < 1 || decoded.id.length > 200) throw new Error("invalid id");
    if (decoded.occurredAt === null) return { occurredAt: null, id: decoded.id };
    if (typeof decoded.occurredAt !== "string") throw new Error("invalid timestamp");
    const occurredAt = new Date(decoded.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw new Error("invalid timestamp");
    return { occurredAt, id: decoded.id };
  } catch {
    throw new TransferError(400, "cursor ist ungültig.");
  }
}

function formatParam(value: unknown): "xlsx" | "csv" | undefined {
  const raw = firstString(value)?.toLowerCase();
  if (raw === undefined) return undefined;
  if (raw === "xlsx" || raw === "csv") return raw;
  throw new TransferError(400, "format muss „xlsx“ oder „csv“ sein.");
}

function sheetParam(value: unknown): SheetKind | undefined {
  const raw = firstString(value)?.toLowerCase();
  if (raw === undefined) return undefined;
  if (raw === "elements" || raw === "relations") return raw;
  throw new TransferError(400, "sheet muss „elements“ oder „relations“ sein.");
}

/** Reduces a client supplied file name to a safe, printable label (no path, no control chars). */
function safeFileName(value: unknown): string {
  const name = (firstString(value) ?? "import").split(/[\\/]/).pop() ?? "import";
  // eslint-disable-next-line no-control-regex -- intentionally strips control characters
  return name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) || "import";
}

async function sendTable(res: Response, format: "xlsx" | "csv", sheets: NamedSheet[], baseName: string): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `attachment; filename="${baseName}.${format}"`);
  if (format === "csv") {
    res.type("text/csv; charset=utf-8").send(serializeCsv(sheets[0].rows));
    return;
  }
  res.type(XLSX_MIME).send(await buildXlsx(sheets));
}

const today = (): string => new Date().toISOString().slice(0, 10);

router.get("/export", async (req, res, next) => {
  try {
    const format = formatParam(req.query.format) ?? "xlsx";
    const catalogId = firstString(req.query.catalogId);
    if (catalogId) {
      // A catalog defines type filter, property and standard columns. The search text narrows it further.
      const state = await readSidebarState();
      const catalog = state.catalogs.find((item) => item.id === catalogId);
      if (!catalog) throw new TransferError(404, "Katalog nicht gefunden.");
      const query = firstString(req.query.q);
      const sheets = catalog.kind === "relations"
        ? buildExportSheets(state, { sheet: "relations", relationFilter: catalogRelationFilter(catalog, state, query), columns: catalog.columns })
        : buildExportSheets(state, {
          sheet: "elements",
          elementFilter: catalogElementFilter(catalog, state, query),
          propertyKeys: catalogPropertyKeys(catalog, state),
          columns: catalog.columns
        });
      await sendTable(res, format, sheets, `eam-katalog-${safeFileName(catalog.name).replace(/[^\p{L}\p{N}_-]+/gu, "-")}-${today()}`);
      return;
    }
    const sheet = sheetParam(req.query.sheet);
    if (format === "csv" && !sheet) throw new TransferError(400, "Für CSV muss sheet=elements oder sheet=relations angegeben werden.");
    const query = firstString(req.query.q);
    const state = await readSidebarState();
    const sheets = buildExportSheets(state, {
      sheet,
      elementFilter: { typeIds: listParam(req.query.typeIds), query: sheet === "relations" ? undefined : query },
      // In a combined export relations follow their exported elements instead of being filtered on their own.
      relationFilter: sheet === "relations" ? { connectionTypeIds: listParam(req.query.connectionTypeIds), query } : {}
    });
    await sendTable(res, format, sheets, `eam-${sheet ?? "modell"}-${today()}`);
  } catch (error) {
    next(error);
  }
});

router.get("/import/template", async (req, res, next) => {
  try {
    const format = formatParam(req.query.format) ?? "xlsx";
    const sheet = sheetParam(req.query.sheet);
    if (format === "csv" && !sheet) throw new TransferError(400, "Für CSV muss sheet=elements oder sheet=relations angegeben werden.");
    const sheets = buildTemplateSheets(await readSidebarState(), sheet);
    await sendTable(res, format, sheets, `eam-import-vorlage${sheet ? `-${sheet}` : ""}`);
  } catch (error) {
    next(error);
  }
});

interface UploadedImport {
  plan: ImportPlan;
  fileName: string;
  format: "xlsx" | "csv";
  sha256: string;
  dataRevision: number;
}

async function planUpload(req: Request): Promise<UploadedImport> {
  const body: unknown = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new TransferError(400, "Es wurde keine Datei übermittelt. Die Datei muss als application/octet-stream gesendet werden.");
  }
  const fileName = safeFileName(req.query.fileName);
  const format = formatParam(req.query.format)
    ?? (fileName.toLowerCase().endsWith(".csv") ? "csv" : fileName.toLowerCase().endsWith(".xlsx") ? "xlsx" : body.subarray(0, 2).toString("latin1") === "PK" ? "xlsx" : "csv");
  const parsed = await parseImportFile(body, format, sheetParam(req.query.sheet));
  const state = await readSidebarState();
  const plan = planImport(state, parsed);
  return { plan, fileName, format, dataRevision: state.dataRevision ?? 0, sha256: createHash("sha256").update(body).digest("hex") };
}

function describePlan({ plan, fileName, format, dataRevision }: UploadedImport) {
  const errorCount = countErrors(plan);
  const applicable = plan.rows.filter((row) => row.status === "new" || row.status === "changed").length;
  return {
    fileName,
    format,
    dataRevision,
    summary: plan.summary,
    errorCount,
    applicableRows: applicable,
    fileErrors: plan.fileErrors,
    fileWarnings: plan.fileWarnings,
    rows: plan.rows,
    // A file with errors can only be committed when the user explicitly skips the invalid rows.
    canCommit: errorCount === 0 && plan.hasChanges,
    canCommitValidOnly: errorCount > 0 && plan.hasChanges
  };
}

router.post("/import/preview", rawUpload, async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(describePlan(await planUpload(req)));
  } catch (error) {
    next(error);
  }
});

router.post("/import/commit", rawUpload, async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const upload = await planUpload(req);
    const description = describePlan(upload);
    const expectedRaw = firstString(req.query.expectedRevision);
    if (expectedRaw === undefined) throw new TransferError(428, "Der Commit benötigt die Datenbasisrevision aus der Vorschau.");
    const expectedRevision = Number(expectedRaw);
    if (!/^\d+$/.test(expectedRaw) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new TransferError(400, "expectedRevision muss eine nichtnegative ganze Zahl sein.");
    }
    if (expectedRevision !== upload.dataRevision) {
      res.status(409).json({
        error: "Die Datenbasis wurde seit der Vorschau geändert. Bitte Import erneut prüfen.",
        code: "IMPORT_BASE_REVISION_CONFLICT",
        currentRevision: upload.dataRevision
      });
      return;
    }
    const skipInvalid = firstString(req.query.skipInvalid) === "true";
    if (description.errorCount > 0 && !skipInvalid) {
      res.status(422).json({ error: "Die Datei enthält Fehler. Bitte korrigieren oder fehlerhafte Zeilen bewusst überspringen.", ...description });
      return;
    }
    if (!upload.plan.hasChanges) {
      res.json({ ...description, applied: false });
      return;
    }
    const { elements, relations } = upload.plan.summary;
    const created = elements.new + relations.new;
    const changed = elements.changed + relations.changed;
    const skipped = elements.error + relations.error;
    await writeSidebarState(upload.plan.nextState, {
      action: "import.commit",
      entityType: "model",
      summary: `Import „${upload.fileName}“: ${created} neu, ${changed} geändert${skipped > 0 ? `, ${skipped} fehlerhafte Zeilen übersprungen` : ""}.`,
      details: {
        fileName: upload.fileName,
        format: upload.format,
        sha256: upload.sha256,
        skippedInvalidRows: skipped,
        elements,
        relations
      }
    });
    res.json({ ...description, applied: true });
  } catch (error) {
    next(error);
  }
});

router.get("/audit-log", async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const limitRaw = firstString(req.query.limit) ?? "50";
    const limit = Number(limitRaw);
    if (!/^\d+$/.test(limitRaw) || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
      throw new TransferError(400, "limit muss zwischen 1 und 200 liegen.");
    }
    const from = dateFilter(req.query.from, "from");
    const to = dateFilter(req.query.to, "to");
    if (from && to && from > to) throw new TransferError(400, "from darf nicht nach to liegen.");
    res.json(await listAuditLog({
      limit,
      from,
      to,
      actor: boundedFilter(req.query.actor, "actor"),
      entityId: boundedFilter(req.query.entityId, "entityId"),
      entityType: boundedFilter(req.query.entityType, "entityType"),
      action: boundedFilter(req.query.action, "action"),
      cursor: auditCursor(req.query.cursor)
    }));
  } catch (error) {
    next(error);
  }
});

// Scoped to this router: translates upload/format problems into 4xx instead of a generic 500.
router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof TransferError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof ImportFormatError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof OptimisticLockError) {
    res.status(409).json({ error: "Die Datenbasis wurde während des Imports geändert. Bitte Import erneut prüfen.", code: "IMPORT_BASE_REVISION_CONFLICT" });
    return;
  }
  if (typeof error === "object" && error !== null && (error as { type?: string }).type === "entity.too.large") {
    res.status(413).json({ error: "Die Datei ist größer als 10 MB." });
    return;
  }
  next(error);
});

export default router;
