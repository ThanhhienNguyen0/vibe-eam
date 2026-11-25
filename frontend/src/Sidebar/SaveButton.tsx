/** #117: the save button of a detail panel shows the save itself: „Speichern …“, then briefly „Gespeichert“. */
import { createContext, useContext, useState, type ReactNode } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { useSavedFeedback } from "../savedFeedback";

/** Feedback target of the open detail panel, e.g. `component:<id>`; set by `SidebarPanels`. */
export const SaveTargetContext = createContext<string | null>(null);

export function SaveButton({ onSave, disabled = false, dirty, children = "Speichern" }: {
  onSave: () => unknown;
  disabled?: boolean;
  /** Unsaved edits in the form: then the button offers saving again instead of „Gespeichert“. */
  dirty: boolean;
  children?: ReactNode;
}) {
  const feedback = useSavedFeedback(useContext(SaveTargetContext));
  const [busy, setBusy] = useState(false);
  const saved = !busy && !dirty && feedback?.kind === "saved";

  async function click() {
    setBusy(true);
    try {
      await onSave();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`sb-save-btn${saved ? " sb-save-btn--saved" : ""}`}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        onClick={() => void click()}
      >
        {busy ? <><LoaderCircle size={14} className="sb-save-spin" aria-hidden="true" /> Speichern …</>
          : saved ? <><Check size={14} aria-hidden="true" /> Gespeichert</>
          : children}
      </button>
      <span className="sb-sr-only" role="status">{saved ? "Gespeichert" : ""}</span>
    </>
  );
}
