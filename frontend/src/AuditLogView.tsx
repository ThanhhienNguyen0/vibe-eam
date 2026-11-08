import { useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { transferApi, type AuditEntry, type AuditFilters } from "./transferApi";

const ACTION_LABELS: Record<string, string> = {
  create: "Erstellt",
  update: "Geändert",
  delete: "Gelöscht",
  "import.commit": "Tabellenimport",
  "model-json.import": "JSON-Modellimport",
  "system.initialize": "Initialisierung"
};
const formatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "medium" });

const localIso = (value: string): string | undefined => value ? new Date(value).toISOString() : undefined;
const displayValue = (value: unknown) => value === null ? "∅" : typeof value === "string" ? value : JSON.stringify(value);

export function AuditEntryDetails({ entry }: { entry: AuditEntry }) {
  return (
    <details>
      <summary>{entry.changes.length > 0 ? `${entry.changes.length} Feldänderung${entry.changes.length === 1 ? "" : "en"}` : "Details"}</summary>
      {entry.changes.length > 0 && (
        <dl className="audit-change-list">
          {entry.changes.map((change) => (
            <div key={change.field}>
              <dt>{change.field}</dt>
              <dd><del>{displayValue(change.before)}</del><span aria-hidden="true"> → </span><ins>{displayValue(change.after)}</ins></dd>
            </div>
          ))}
        </dl>
      )}
      {Object.keys(entry.details).length > 0 && <pre className="audit-details">{JSON.stringify(entry.details, null, 2)}</pre>}
    </details>
  );
}

export function ElementAuditHistory({ entityId, entityType }: { entityId: string; entityType: "component" | "connection" }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setEntries(null);
    setNextCursor(null);
    setLoading(true);
    setError("");
    transferApi.auditLog({ entityId, entityType, limit: 20 })
      .then((page) => {
        if (!active) return;
        setEntries(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Historie konnte nicht geladen werden."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [entityId, entityType]);

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError("");
    try {
      const page = await transferApi.auditLog({ entityId, entityType, limit: 20, cursor: nextCursor });
      setEntries((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Weitere Historie konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="element-history" aria-label="Elementhistorie">
      <h3>Historie</h3>
      {error && <p className="error-banner" role="alert">{error}</p>}
      {entries?.map((entry) => (
        <article key={entry.id} className="element-history-entry">
          <strong>{ACTION_LABELS[entry.action] ?? entry.action}</strong>
          <span>{entry.occurredAt ? formatter.format(new Date(entry.occurredAt)) : "Zeitpunkt unbekannt (Legacy)"}</span>
          <small>{entry.actorLabel ?? entry.userEmail ?? (entry.actorType === "system" ? "System" : "Akteur unbekannt")}</small>
          <p>{entry.summary}</p>
          <AuditEntryDetails entry={entry} />
        </article>
      ))}
      {entries?.length === 0 && <p className="muted">Noch keine Historie für dieses Objekt.</p>}
      {entries === null && !error && <p className="muted">Historie wird geladen…</p>}
      {nextCursor && <button type="button" disabled={loading} onClick={loadMore}>Weitere Historieneinträge laden</button>}
    </section>
  );
}

export default function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ from: "", to: "", actor: "", entityId: "", entityType: "" });
  const [filters, setFilters] = useState<AuditFilters>({ limit: 50 });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    transferApi.auditLog(filters)
      .then((page) => {
        if (!active) return;
        setEntries((current) => filters.cursor ? [...current, ...page.items] : page.items);
        setNextCursor(page.nextCursor);
        setError("");
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Das Protokoll konnte nicht geladen werden."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, reloadKey]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setFilters({
      limit: 50,
      from: localIso(draft.from),
      to: localIso(draft.to),
      actor: draft.actor.trim() || undefined,
      entityId: draft.entityId.trim() || undefined,
      entityType: draft.entityType.trim() || undefined
    });
  }

  return (
    <div className="catalog-view">
      <header className="catalog-header">
        <div>
          <h2>Änderungsprotokoll</h2>
          <p className="muted">Append-only über Anwendung und API. Direkte privilegierte Datenbankzugriffe sind keine WORM-Sicherung.</p>
        </div>
        <div className="catalog-actions">
          <button type="button" onClick={() => { setFilters((current) => ({ ...current, cursor: undefined })); setReloadKey((key) => key + 1); }}><RefreshCw size={14} /> Aktualisieren</button>
        </div>
      </header>
      <form className="audit-filters" onSubmit={applyFilters}>
        <label>Von<input type="datetime-local" value={draft.from} onChange={(event) => setDraft((value) => ({ ...value, from: event.target.value }))} /></label>
        <label>Bis<input type="datetime-local" value={draft.to} onChange={(event) => setDraft((value) => ({ ...value, to: event.target.value }))} /></label>
        <label>Akteur<input value={draft.actor} onChange={(event) => setDraft((value) => ({ ...value, actor: event.target.value }))} placeholder="E-Mail oder ID" /></label>
        <label>Element<input value={draft.entityId} onChange={(event) => setDraft((value) => ({ ...value, entityId: event.target.value }))} placeholder="Objekt-ID" /></label>
        <label>Objektart<input value={draft.entityType} onChange={(event) => setDraft((value) => ({ ...value, entityType: event.target.value }))} placeholder="z. B. component" /></label>
        <button type="submit"><Search size={14} /> Filtern</button>
        <button type="button" onClick={() => { setDraft({ from: "", to: "", actor: "", entityId: "", entityType: "" }); setFilters({ limit: 50 }); }}>Zurücksetzen</button>
      </form>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead><tr><th>Zeitpunkt</th><th>Akteur</th><th>Aktion</th><th>Objekt</th><th>Zusammenfassung</th><th>Diff</th></tr></thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.occurredAt ? formatter.format(new Date(entry.occurredAt)) : <span className="muted">unbekannt (Legacy)</span>}</td>
                <td>{entry.actorLabel ?? entry.userEmail ?? <span className="muted">unbekannt</span>}</td>
                <td>{ACTION_LABELS[entry.action] ?? entry.action}</td>
                <td><code>{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}</code></td>
                <td>{entry.summary}</td>
                <td><AuditEntryDetails entry={entry} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && entries.length === 0 && <p className="catalog-empty">Keine passenden Einträge.</p>}
        {loading && entries.length === 0 && <p className="catalog-empty">Wird geladen…</p>}
        {nextCursor && <button type="button" disabled={loading} onClick={() => setFilters((current) => ({ ...current, cursor: nextCursor }))}>Weitere Einträge laden</button>}
      </div>
    </div>
  );
}
