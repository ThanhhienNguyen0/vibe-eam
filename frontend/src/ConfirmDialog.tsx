import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmRequest {
  title: string;
  message: string;
  /** Optional list, e.g. the diagrams that still use an element. */
  items?: string[];
  itemsLabel?: string;
  notes?: string[];
  confirmLabel?: string;
  tone?: "danger" | "default";
}

type Confirm = (request: ConfirmRequest) => Promise<boolean>;

function nativeConfirm(request: ConfirmRequest): Promise<boolean> {
  const lines = [request.title, "", request.message];
  if (request.items?.length) lines.push("", request.itemsLabel ?? "", ...request.items.map((item) => `  • ${item}`));
  if (request.notes?.length) lines.push("", ...request.notes);
  return Promise.resolve(window.confirm(lines.join("\n")));
}

// Without a provider (e.g. isolated component tests) the browser dialog is the fallback.
const ConfirmContext = createContext<Confirm>(nativeConfirm);

export function useConfirm(): Confirm {
  return useContext(ConfirmContext);
}

export function ConfirmDialog({
  request,
  onResolve
}: {
  request: ConfirmRequest;
  onResolve: (confirmed: boolean) => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const danger = request.tone !== "default";

  useEffect(() => {
    // Safe default: focus "Abbrechen", so Enter never deletes by accident.
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onResolve(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onResolve]);

  return (
    <div className="diagram-suggestion-overlay" onPointerDown={(event) => event.target === event.currentTarget && onResolve(false)}>
      <div
        className={`diagram-suggestion-card confirm-dialog${danger ? " confirm-dialog--danger" : ""}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="diagram-suggestion-header">
          <strong id="confirm-dialog-title" className="confirm-dialog-title">
            {danger && <AlertTriangle size={18} className="confirm-dialog-icon" />}
            {request.title}
          </strong>
          <button className="sb-close-btn" aria-label="Schließen" onClick={() => onResolve(false)}><X size={14} /></button>
        </div>
        <p id="confirm-dialog-message" className="confirm-dialog-message">{request.message}</p>
        {request.items && request.items.length > 0 && (
          <div className="confirm-dialog-usage">
            {request.itemsLabel && <span>{request.itemsLabel}</span>}
            <ul>
              {request.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {request.notes?.map((note) => <p key={note} className="muted confirm-dialog-note">{note}</p>)}
        <div className="diagram-suggestion-actions confirm-dialog-actions">
          <button ref={cancelRef} onClick={() => onResolve(false)}>Abbrechen</button>
          <button className={danger ? "confirm-dialog-danger-btn" : "sb-save-btn confirm-dialog-primary-btn"} onClick={() => onResolve(true)}>
            {request.confirmLabel ?? "Bestätigen"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((request) => new Promise<boolean>((resolve) => {
    resolver.current?.(false); // a newer question replaces an unanswered one
    resolver.current = resolve;
    setPending(request);
  }), []);

  const resolve = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setPending(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog request={pending} onResolve={resolve} />}
    </ConfirmContext.Provider>
  );
}
