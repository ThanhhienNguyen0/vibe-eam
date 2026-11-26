import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { elementNameError, placeholderQuestion, placeholderWarning } from "./nameRules";
import { useSecondConfirmation } from "./useSecondConfirmation";

export interface CreateConfirmations {
  /** REQ-02: a possible duplicate was shown and the user creates anyway. */
  acknowledgeDuplicate: boolean;
  /** #113: the user confirmed a placeholder name a second time. */
  acknowledgePlaceholder: boolean;
}

/**
 * #113: Asks for a name (and for components the type) before anything is created, instead of storing a
 * placeholder like „Neue Komponente“ and renaming it afterwards. A placeholder is still possible, but only
 * after a warning and a second confirmation.
 */
export default function CreateElementDialog({
  title,
  placeholder,
  types,
  initialTypeId,
  duplicateWarning,
  onSubmit,
  onCancel
}: {
  title: string;
  placeholder: string;
  /** When given, the dialog also asks for the component type. */
  types?: Array<{ id: string; name: string }>;
  initialTypeId?: string;
  /** REQ-02: possible duplicate for the typed name; creating anyway is allowed and audited. */
  duplicateWarning?: (name: string, typeId: string) => string | null;
  onSubmit: (name: string, typeId: string, confirmations: CreateConfirmations) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState(initialTypeId ?? types?.[0]?.id ?? "");
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const ids = useId();
  const nameError = elementNameError(name);
  const showNameError = nameError && (attempted || name.length > 0);
  const placeholderHint = placeholderWarning(name);
  const placeholderStep = useSecondConfirmation(placeholderHint, name);
  const warning = !nameError && !saving ? duplicateWarning?.(name, typeId) ?? null : null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  async function submit() {
    setAttempted(true);
    if (nameError || saving || (types && !typeId)) return;
    // First click on a placeholder only asks again; the second click creates.
    if (!placeholderStep.confirm()) return;
    setSaving(true);
    setServerError("");
    try {
      await onSubmit(name.trim(), typeId, { acknowledgeDuplicate: warning !== null, acknowledgePlaceholder: placeholderHint !== null });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Anlegen fehlgeschlagen.");
      setSaving(false);
    }
  }

  const submitLabel = placeholderStep.awaiting ? "Ja, mit Platzhalter anlegen" : warning ? "Trotzdem anlegen" : "Anlegen";

  return (
    <div className="diagram-suggestion-overlay" onPointerDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="diagram-suggestion-card create-element-dialog" role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`}>
        <div className="diagram-suggestion-header">
          <strong id={`${ids}-title`}>{title}</strong>
          <button className="sb-close-btn" aria-label="Schließen" onClick={onCancel}><X size={14} /></button>
        </div>
        <form
          className="sb-form"
          noValidate
          onSubmit={(event) => { event.preventDefault(); void submit(); }}
        >
          <label>Name
            <input
              autoFocus
              value={name}
              placeholder={placeholder}
              aria-invalid={showNameError ? true : undefined}
              aria-describedby={showNameError ? `${ids}-name-error` : placeholderHint ? `${ids}-name-hint` : undefined}
              onChange={(event) => { setName(event.target.value); setServerError(""); }}
            />
            {showNameError && <span id={`${ids}-name-error`} className="sb-field-error" role="alert">{nameError}</span>}
            {placeholderHint && !placeholderStep.awaiting && <span id={`${ids}-name-hint`} className="sb-field-hint">{placeholderHint}</span>}
          </label>
          {placeholderStep.awaiting && (
            <p id={`${ids}-name-hint`} className="sb-field-confirm" role="alert">
              {placeholderQuestion(name)} Zum Bestätigen noch einmal auf „{submitLabel}“ klicken.
            </p>
          )}
          {types && (
            <label>Typ
              <select value={typeId} onChange={(event) => setTypeId(event.target.value)}>
                {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </label>
          )}
          {warning && <p className="sb-field-hint" role="status">{warning}</p>}
          {serverError && <p className="sb-error" role="alert">{serverError}</p>}
          <div className="diagram-suggestion-actions">
            <button type="button" onClick={onCancel}>Abbrechen</button>
            <button type="submit" className="sb-save-btn" style={{ margin: 0 }} disabled={saving || !!showNameError}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
