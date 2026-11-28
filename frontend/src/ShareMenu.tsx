import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Image, Link2, Share2 } from "lucide-react";
import { copyText } from "./CopyLinkButton";
import { dropdownPosition, type DropdownPosition } from "./dropdownPosition";

interface Props {
  /** Öffnet den Export-Dialog (REQ-11). */
  onExportImage: () => void;
  /** Grund, warum der Export nicht geht (z. B. leeres Diagramm); deaktiviert den Eintrag. */
  exportDisabledReason?: string;
  /** Teilbarer Link auf das Diagramm (REQ-12); wird beim Klick erzeugt, damit er aktuell ist. */
  getLink: () => string;
  className?: string;
}

/**
 * Ein „Teilen“-Button statt zwei Toolbar-Buttons: das Menü bietet Bild-Export und Link kopieren.
 * Schließt per Klick daneben oder Escape; per Tastatur bedienbar.
 * #121: Die Liste hängt per Portal am <body> und liegt `position: fixed` über allem (auch über dem
 * Detail-Panel); sie wird an den Button angelegt und im Fenster gehalten.
 */
export default function ShareMenu({ onExportImage, exportDisabledReason, getLink, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const fallbackInput = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setCopied(false);
    setFallback(null);
    setPosition(null);
  }, []);

  // Position am Button ausrichten – auch nach Größenänderung, Scrollen oder wenn die Liste wächst (Fallback-Feld).
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      const list = listRef.current;
      if (!button || !list) return;
      const next = dropdownPosition(
        button.getBoundingClientRect(),
        { width: list.offsetWidth, height: list.scrollHeight },
        { width: window.innerWidth, height: window.innerHeight }
      );
      setPosition((prev) => (prev && prev.top === next.top && prev.left === next.left && prev.maxHeight === next.maxHeight ? prev : next));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, fallback, copied]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      buttonRef.current?.focus();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  // Fokus erst, wenn die Liste positioniert (sichtbar) ist – unsichtbare Elemente nehmen keinen Fokus an.
  const placed = position !== null;
  useEffect(() => { if (open && placed) firstItem.current?.focus(); }, [open, placed]);

  useEffect(() => { if (fallback) fallbackInput.current?.select(); }, [fallback]);

  // Nach erfolgreichem Kopieren kurz die Bestätigung zeigen, dann schließen.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(close, 1100);
    return () => window.clearTimeout(timer);
  }, [close, copied]);

  async function copyLink() {
    const url = getLink();
    if (await copyText(url)) setCopied(true);
    else setFallback(url);
  }

  return (
    <div className="share-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`${className}${open ? " diagram-toggle--on" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        title="Diagramm teilen: als Bild exportieren oder Link kopieren"
      >
        <Share2 size={16} /> <span className="diagram-tb-label">Teilen</span> <ChevronDown size={14} className="share-menu-caret" />
      </button>

      {open && createPortal(
        <div
          ref={listRef}
          className="share-menu-list"
          role="menu"
          aria-label="Teilen"
          style={position
            ? { top: position.top, left: position.left, maxHeight: position.maxHeight }
            : { top: 0, left: 0, visibility: "hidden" }}
        >
          <button
            ref={firstItem}
            type="button"
            role="menuitem"
            className="share-menu-item"
            disabled={Boolean(exportDisabledReason)}
            title={exportDisabledReason}
            onClick={() => { close(); onExportImage(); }}
          >
            <Image size={16} />
            <span>
              <strong>Als Bild exportieren …</strong>
              <small>{exportDisabledReason ?? "PNG oder SVG herunterladen"}</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={`share-menu-item${copied ? " is-done" : ""}`}
            onClick={() => void copyLink()}
          >
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            <span aria-live="polite">
              <strong>{copied ? "Link kopiert" : "Link kopieren"}</strong>
              <small>{copied ? "Du kannst ihn jetzt einfügen" : "Führt direkt zu diesem Diagramm mit aktueller Ansicht"}</small>
            </span>
          </button>
          {fallback && (
            <div className="share-menu-fallback">
              <strong>Mit Strg+C kopieren</strong>
              <input ref={fallbackInput} readOnly value={fallback} onFocus={(e) => e.target.select()} aria-label="Link zum Kopieren" />
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
