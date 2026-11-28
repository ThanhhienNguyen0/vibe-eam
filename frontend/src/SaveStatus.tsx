/** #117: shows whether changes are saved, and what to do when saving failed. */
import { useEffect, useSyncExternalStore } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { saveTracker, type SaveSnapshot, type SaveTracker } from "./saveTracker";

export function useSaveStatus(tracker: SaveTracker = saveTracker): SaveSnapshot {
  return useSyncExternalStore(tracker.subscribe, tracker.getSnapshot, tracker.getSnapshot);
}

/** Lets the browser ask before the tab is closed or reloaded while changes are not saved yet. */
export function useWarnBeforeLeavingUnsaved(status: SaveSnapshot) {
  const unsaved = status.pending > 0 || status.unsaved > 0;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
}

/**
 * Explains a failed save and offers the way out. It sits above every dialog, because a dialog
 * may be waiting for the held write.
 */
export function SaveFailureBanner({ status, tracker = saveTracker, onDiscarded }: {
  status: SaveSnapshot;
  tracker?: SaveTracker;
  /** Called after held writes were discarded, to show the stored state again. */
  onDiscarded: () => void;
}) {
  const { failure } = status;
  if (status.state !== "failed" || !failure) return null;
  const title = "Speichern fehlgeschlagen: " + (failure.retryable
    ? status.unsaved === 1 ? "1 Änderung ist nicht gespeichert." : `${status.unsaved} Änderungen sind nicht gespeichert.`
    : "Die letzte Änderung wurde nicht gespeichert.");
  const hint = failure.retryable
    ? "„Erneut versuchen“ sendet sie noch einmal. „Verwerfen“ lädt den zuletzt gespeicherten Stand."
    : "Der Server hat sie abgelehnt. Bitte die Eingabe prüfen und erneut speichern.";
  return (
    <div className="save-failure" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div className="save-failure-text">
        <strong>{title}</strong>
        <span>{failure.message} {hint}</span>
      </div>
      {failure.retryable ? (
        <div className="save-failure-actions">
          <button type="button" className="primary" onClick={() => void tracker.retry()}>
            <RefreshCw size={14} aria-hidden="true" /> Erneut versuchen
          </button>
          <button type="button" onClick={() => { if (tracker.discard() > 0) onDiscarded(); }}>Verwerfen</button>
        </div>
      ) : (
        <button type="button" className="save-failure-close" aria-label="Meldung schließen" title="Meldung schließen" onClick={() => tracker.dismiss()}>
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
