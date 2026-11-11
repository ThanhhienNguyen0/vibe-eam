import { useEffect, useRef, useState } from "react";
import { Check, Link2, X } from "lucide-react";

/**
 * Kopiert Text in die Zwischenablage. Die Clipboard-API gibt es nur in sicheren Kontexten (https,
 * localhost); sonst wird auf `execCommand("copy")` zurückgegriffen. Liefert false, wenn beides scheitert.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Fallback unten */ }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

interface Props {
  /** Link oder Funktion, die ihn beim Klick erzeugt (damit er immer aktuell ist). */
  link: string | (() => string);
  label?: string;
  /** Nur Icon (z. B. im Panel-Kopf); der Text erscheint dann als Tooltip. */
  iconOnly?: boolean;
  title?: string;
  className?: string;
}

/** „Link kopieren“ mit sichtbarer Bestätigung und Notlösung, falls die Zwischenablage blockiert ist. */
export default function CopyLinkButton({ link, label = "Link kopieren", iconOnly = false, title, className = "" }: Props) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => { if (fallback) inputRef.current?.select(); }, [fallback]);

  async function onClick() {
    const url = typeof link === "function" ? link() : link;
    if (await copyText(url)) {
      setFallback(null);
      setCopied(true);
    } else {
      setFallback(url);
    }
  }

  const text = copied ? "Link kopiert" : label;
  return (
    <span className="copy-link">
      <button
        type="button"
        className={`${className}${copied ? " copy-link--done" : ""}`}
        onClick={() => void onClick()}
        title={title ?? text}
        aria-label={iconOnly ? text : undefined}
      >
        {copied ? <Check size={iconOnly ? 15 : 16} /> : <Link2 size={iconOnly ? 15 : 16} />}
        {!iconOnly && <span aria-live="polite">{text}</span>}
      </button>
      {iconOnly && copied && <span className="copy-link-toast" role="status">Link kopiert</span>}
      {fallback && (
        <span className="copy-link-fallback" role="dialog" aria-label="Link manuell kopieren">
          <span className="copy-link-fallback-head">
            <strong>Mit Strg+C kopieren</strong>
            <button type="button" className="sb-close-btn" onClick={() => setFallback(null)} aria-label="Schließen"><X size={13} /></button>
          </span>
          <input ref={inputRef} readOnly value={fallback} onFocus={(e) => e.target.select()} />
        </span>
      )}
    </span>
  );
}
