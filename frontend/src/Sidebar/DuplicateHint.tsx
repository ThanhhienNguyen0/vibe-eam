import { ArrowRight, Copy } from "lucide-react";

/** REQ-02: non-blocking hint shown when an element or metamodel type with the same normalized name already exists. */
export default function DuplicateHint({
  duplicates,
  typeName,
  onOpen,
  onUseExisting,
  note,
  title = "Mögliches Duplikat",
  intro
}: {
  duplicates: Array<{ id: string; name: string }>;
  typeName?: string;
  onOpen?: (id: string) => void;
  onUseExisting?: (id: string) => void;
  note: string;
  title?: string;
  intro?: string;
}) {
  if (duplicates.length === 0) return null;
  return (
    <div className="duplicate-warning" role="status">
      <strong>{title}</strong>
      <span>
        {intro ?? (typeName
          ? <>Im Typ <strong>{typeName}</strong> gibt es diesen Namen bereits:</>
          : "Dieser Name ist bereits vergeben:")}
      </span>
      <div className="sb-link-list">
        {duplicates.map((item) => (
          <div key={item.id} className="duplicate-warning-row">
            {onOpen ? (
              <button type="button" className="sb-link-row" onClick={() => onOpen(item.id)} title="Vorhandenen Eintrag anzeigen">
                <span className="sb-link-label"><strong>{item.name}</strong></span>
                <ArrowRight size={12} className="sb-link-arrow" />
              </button>
            ) : <span className="sb-link-label"><strong>{item.name}</strong></span>}
            {onUseExisting && (
              <button type="button" className="sb-save-btn duplicate-warning-use" onClick={() => onUseExisting(item.id)}>
                <Copy size={12} /> Vorhandenes Element verwenden
              </button>
            )}
          </div>
        ))}
      </div>
      <span className="duplicate-warning-note">{note}</span>
    </div>
  );
}
