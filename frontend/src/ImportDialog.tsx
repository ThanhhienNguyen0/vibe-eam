import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, TriangleAlert, Upload, X } from "lucide-react";
import { transferApi, type ImportPreview, type PlannedRow, type RowStatus, type TransferSheet } from "./transferApi";

interface Props {
  onClose: () => void;
  /** Called after a successful commit so the caller can reload the model. */
  onImported: () => Promise<void>;
}

const STATUS_LABELS: Record<RowStatus, string> = { new: "Neu", changed: "Geändert", unchanged: "Unverändert", error: "Fehler" };
const SHEET_LABELS: Record<TransferSheet, string> = { elements: "Elemente", relations: "Relationen" };
const STATUS_ORDER: RowStatus[] = ["error", "new", "changed", "unchanged"];
const MAX_VISIBLE_ROWS = 500;

function RowDetails({ row }: { row: PlannedRow }) {
  return (
    <>
      {row.errors.map((message) => <div key={message} className="import-error">{message}</div>)}
      {row.warnings.map((message) => <div key={message} className="import-warning">{message}</div>)}
      {row.changes.map((change) => (
        <div key={change.field} className="import-change">
          <strong>{change.field}:</strong> <span className="import-from">{change.from || "–"}</span> → <span>{change.to || "–"}</span>
        </div>
      ))}
      {row.status === "new" && row.errors.length === 0 && row.warnings.length === 0 && <span className="muted">wird angelegt</span>}
      {row.status === "unchanged" && row.warnings.length === 0 && <span className="muted">keine Änderung</span>}
    </>
  );
}

export function describeImportResult(preview: ImportPreview): string {
  const created = preview.summary.elements.new + preview.summary.relations.new;
  const changed = preview.summary.elements.changed + preview.summary.relations.changed;
  const skipped = preview.summary.elements.error + preview.summary.relations.error;
  return `${created} neu angelegt, ${changed} geändert${skipped > 0 ? `, ${skipped} fehlerhafte Zeilen übersprungen` : ""}.`;
}

export default function ImportDialog({ onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RowStatus | "all">("all");

  const visibleRows = useMemo(() => {
    if (!preview) return [];
    return preview.rows
      .filter((row) => statusFilter === "all" || row.status === statusFilter)
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.sheet.localeCompare(b.sheet) || a.row - b.row);
  }, [preview, statusFilter]);

  async function choose(selected: File | undefined) {
    if (!selected) return;
    setFile(selected);
    setPreview(null);
    setResult(null);
    setError("");
    setSkipInvalid(false);
    setStatusFilter("all");
    setBusy(true);
    try {
      setPreview(await transferApi.previewImport(selected));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Datei konnte nicht geprüft werden.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (!preview) return;
      const committed = await transferApi.commitImport(file, skipInvalid, preview.dataRevision);
      setResult(committed);
      await onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Der Import ist fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const canCommit = preview !== null && result === null && !busy && (preview.canCommit || (preview.canCommitValidOnly && skipInvalid));
  const sheets = (["elements", "relations"] as const).filter((sheet) => preview && Object.values(preview.summary[sheet]).some((count) => count > 0));

  return (
    <div className="import-backdrop" role="presentation" onKeyDown={(event) => { if (event.key === "Escape" && !busy) onClose(); }}>
      <div className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header>
          <h3 id="import-title">Excel/CSV importieren</h3>
          <button type="button" className="import-close" onClick={onClose} disabled={busy} aria-label="Schließen"><X size={16} /></button>
        </header>

        <div className="import-body">
          <p className="muted">
            Die Datei wird zuerst nur geprüft. Erst nach der Vorschau werden Daten übernommen.
            Zeilen werden über ID oder Externe ID zugeordnet, sonst neu angelegt.
          </p>
          <div className="import-pick">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }}
            />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy || result !== null}>
              <Upload size={14} /> {file ? "Andere Datei wählen" : "Datei wählen (.xlsx oder .csv)"}
            </button>
            <button type="button" onClick={() => void transferApi.downloadTemplate("xlsx").catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Download fehlgeschlagen."))}>
              <FileSpreadsheet size={14} /> Vorlage
            </button>
            {file && <span className="import-file">{file.name}</span>}
          </div>

          {busy && !preview && <p>Datei wird geprüft…</p>}
          {error && <div className="error-banner" role="alert">{error}</div>}

          {preview && (
            <>
              {preview.fileErrors.map((message) => <div key={message} className="error-banner">{message}</div>)}
              {preview.fileWarnings.length > 0 && (
                <div className="import-warning-box">
                  <TriangleAlert size={14} />
                  <ul>{preview.fileWarnings.map((message) => <li key={message}>{message}</li>)}</ul>
                </div>
              )}

              <div className="import-summary">
                {sheets.map((sheet) => (
                  <div key={sheet} className="import-summary-row">
                    <strong>{SHEET_LABELS[sheet]}</strong>
                    {STATUS_ORDER.map((status) => (
                      <span key={status} className={`import-chip import-chip--${status}`}>{preview.summary[sheet][status]} {STATUS_LABELS[status]}</span>
                    ))}
                  </div>
                ))}
                {sheets.length === 0 && <p className="muted">Die Datei enthält keine Datenzeilen.</p>}
              </div>

              {preview.rows.length > 0 && (
                <>
                  <div className="import-filter" role="group" aria-label="Zeilen filtern">
                    {(["all", ...STATUS_ORDER] as const).map((status) => (
                      <button key={status} type="button" className={statusFilter === status ? "active" : undefined} onClick={() => setStatusFilter(status)}>
                        {status === "all" ? "Alle" : STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                  <div className="import-table-wrap">
                    <table className="catalog-table">
                      <thead><tr><th>Status</th><th>Blatt</th><th>Zeile</th><th>Eintrag</th><th>Details</th></tr></thead>
                      <tbody>
                        {visibleRows.slice(0, MAX_VISIBLE_ROWS).map((row) => (
                          <tr key={`${row.sheet}-${row.row}`}>
                            <td><span className={`import-chip import-chip--${row.status}`}>{STATUS_LABELS[row.status]}</span></td>
                            <td>{SHEET_LABELS[row.sheet]}</td>
                            <td className="catalog-num">{row.row}</td>
                            <td>{row.label}</td>
                            <td><RowDetails row={row} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {visibleRows.length > MAX_VISIBLE_ROWS && (
                      <p className="catalog-empty">Es werden {MAX_VISIBLE_ROWS} von {visibleRows.length} Zeilen angezeigt. Fehler stehen zuerst.</p>
                    )}
                  </div>
                </>
              )}

              {!preview.canCommit && !preview.canCommitValidOnly && preview.errorCount === 0 && preview.fileErrors.length === 0 && result === null && (
                <p className="import-note"><CheckCircle2 size={14} /> Keine Änderungen: Die Datei entspricht dem aktuellen Stand.</p>
              )}
              {preview.canCommitValidOnly && result === null && (
                <label className="import-skip">
                  <input type="checkbox" checked={skipInvalid} onChange={(event) => setSkipInvalid(event.target.checked)} />
                  Fehlerhafte Zeilen überspringen und nur die {preview.applicableRows} gültigen Zeilen importieren
                </label>
              )}
              {result && (
                <p className="import-success" role="status"><CheckCircle2 size={16} /> {result.applied ? `Import abgeschlossen: ${describeImportResult(result)}` : "Es gab nichts zu übernehmen."}</p>
              )}
            </>
          )}
        </div>

        <footer>
          <button type="button" onClick={onClose} disabled={busy}>{result ? "Schließen" : "Abbrechen"}</button>
          {result === null && (
            <button type="button" className="catalog-primary" onClick={() => void commit()} disabled={!canCommit}>
              {busy && preview ? "Importiere…" : preview ? `Import übernehmen (${preview.applicableRows})` : "Import übernehmen"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
