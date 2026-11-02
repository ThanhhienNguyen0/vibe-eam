import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { transferApi, type AuditEntry } from "./transferApi";

const ACTION_LABELS: Record<string, string> = { "import.commit": "Import" };
const formatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "medium" });

export default function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    transferApi.auditLog(200)
      .then((loaded) => { if (active) { setEntries(loaded); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Das Protokoll konnte nicht geladen werden."); });
    return () => { active = false; };
  }, [reloadKey]);

  return (
    <div className="catalog-view">
      <header className="catalog-header">
        <div>
          <h2>Protokoll</h2>
          <p className="muted">Fachliche Ereignisse deines Unternehmens, aktuell Importe. Einträge können nicht verändert werden.</p>
        </div>
        <div className="catalog-actions">
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw size={14} /> Aktualisieren</button>
        </div>
      </header>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead><tr><th>Zeitpunkt</th><th>Nutzer</th><th>Aktion</th><th>Zusammenfassung</th><th>Details</th></tr></thead>
          <tbody>
            {(entries ?? []).map((entry) => (
              <tr key={entry.id}>
                <td>{formatter.format(new Date(entry.createdAt))}</td>
                <td>{entry.userEmail ?? <span className="muted">unbekannt</span>}</td>
                <td>{ACTION_LABELS[entry.action] ?? entry.action}</td>
                <td>{entry.summary}</td>
                <td>
                  <details>
                    <summary>anzeigen</summary>
                    <pre className="audit-details">{JSON.stringify(entry.details, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries !== null && entries.length === 0 && <p className="catalog-empty">Noch keine Einträge.</p>}
        {entries === null && !error && <p className="catalog-empty">Wird geladen…</p>}
      </div>
    </div>
  );
}
