import { useEffect, useRef, useState } from "react";
import { Download, Filter, Info, X } from "lucide-react";
import {
  clampPngScale,
  DEFAULT_PNG_SCALE,
  defaultFileBase,
  exportFileName,
  PNG_SCALES,
  type ExportArea,
  type ExportFormat
} from "./diagramExport";

export interface ExportChoice {
  format: ExportFormat;
  area: ExportArea;
  scale: number;
  legend: boolean;
  /** Fertiger, bereinigter Dateiname inkl. Endung. */
  fileName: string;
}

interface Props {
  diagramName: string;
  /** Name des aktiven Ansichtsfilters – wird als Hinweis angezeigt, weil er den Export einschränkt. */
  activeViewName?: string;
  /** Endgröße des Bildes (Diagramm-Einheiten) für Bereich und Legende – für die Pixel-Angaben. */
  measure: (area: ExportArea, legend: boolean) => { width: number; height: number } | null;
  /** Dasselbe SVG wie beim Export, für die optionale Vorschau. */
  renderPreview: (area: ExportArea, legend: boolean) => Promise<string>;
  onExport: (choice: ExportChoice) => Promise<void>;
  onClose: () => void;
}

const STORAGE_KEY = "eam.diagramExport";

/** Bildqualität in Alltagssprache statt „1×/2×/4×“; daneben steht die echte Pixelgröße. */
const QUALITY_LEVELS: Array<{ scale: (typeof PNG_SCALES)[number]; title: string; hint: string }> = [
  { scale: 1, title: "Normal", hint: "Für Bildschirm und E-Mail – kleinste Datei." },
  { scale: 2, title: "Hoch", hint: "Empfohlen. Bleibt in PowerPoint und Word scharf, auch im Vollbild." },
  { scale: 4, title: "Sehr hoch", hint: "Für Druck und Poster – größte Datei." }
];

/** Erklärungen hinter dem ⓘ neben jeder Überschrift – spart Platz im Dialog. */
const HELP = {
  format: [
    { title: "PNG", text: "Normales Bild. Passt überall hinein: PowerPoint, Word, E-Mail, Teams." },
    { title: "SVG", text: "Vektorgrafik. Bleibt in jeder Größe gestochen scharf, Texte sind durchsuchbar. Gut für Dokumentationen und zum Weiterbearbeiten." }
  ],
  area: [
    { title: "Ganzes Diagramm", text: "Alle Elemente – egal, wohin du gerade gescrollt oder gezoomt hast." },
    { title: "Ausschnitt", text: "Genau das, was du gerade im Fenster siehst." }
  ],
  preview: [
    { title: "Vorschau", text: "Zeigt hier im Fenster genau das Bild, das heruntergeladen wird – inklusive Bereich, Filter und Legende." }
  ],
  quality: QUALITY_LEVELS.map((level) => ({ title: level.title, text: level.hint })),
  legend: [
    { title: "Legende", text: "Erklärt unter dem Diagramm, welche Farbe, Form und welches Icon zu welchem Elementtyp gehört – nur für Typen, die im Bild vorkommen." }
  ]
};

const formatPixels = (size: { width: number; height: number }, scale: number) =>
  `${Math.round(size.width * scale).toLocaleString("de-DE")} × ${Math.round(size.height * scale).toLocaleString("de-DE")} px`;

type Remembered = Partial<Pick<ExportChoice, "format" | "scale" | "legend">> & { preview?: boolean };

function loadLastChoice(): Remembered {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      format: parsed.format === "svg" ? "svg" : parsed.format === "png" ? "png" : undefined,
      scale: (PNG_SCALES as readonly number[]).includes(parsed.scale) ? parsed.scale : undefined,
      legend: typeof parsed.legend === "boolean" ? parsed.legend : undefined,
      preview: typeof parsed.preview === "boolean" ? parsed.preview : undefined
    };
  } catch {
    return {};
  }
}

function saveLastChoice(choice: Remembered) {
  try {
    const merged = { ...loadLastChoice(), ...choice };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ format: merged.format, scale: merged.scale, legend: merged.legend, preview: merged.preview }));
  } catch { /* Merken ist nur Komfort. */ }
}

/**
 * Rendert die Vorschau als Bild. Ein Objekt-URL statt Inline-SVG, damit IDs (Pfeil-Marker, Clip)
 * nicht mit dem Rest der Seite kollidieren.
 */
function usePreviewUrl(enabled: boolean, area: ExportArea, legend: boolean, render: Props["renderPreview"]) {
  const [state, setState] = useState<{ url: string | null; loading: boolean; error: string }>({ url: null, loading: false, error: "" });
  // `render` ist bei jedem Editor-Render eine neue Funktion; neu gerendert wird nur bei geänderter Auswahl.
  const renderRef = useRef(render);
  renderRef.current = render;
  // Das alte Bild bleibt sichtbar, bis das neue fertig ist; erst dann wird seine URL freigegeben.
  const currentUrl = useRef<string | null>(null);
  const replaceUrl = (next: string | null) => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = next;
  };
  useEffect(() => {
    if (!enabled) { replaceUrl(null); setState({ url: null, loading: false, error: "" }); return; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    renderRef.current(area, legend)
      .then((svg) => {
        if (cancelled) return;
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
        replaceUrl(url);
        setState({ url, loading: false, error: "" });
      })
      .catch((caught) => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: caught instanceof Error ? caught.message : "Vorschau nicht verfügbar." }));
      });
    return () => { cancelled = true; };
  }, [enabled, area, legend]);
  useEffect(() => () => replaceUrl(null), []);
  return state;
}

export default function DiagramExportDialog({ diagramName, activeViewName, measure, renderPreview, onExport, onClose }: Props) {
  const [last] = useState(loadLastChoice);
  const [format, setFormat] = useState<ExportFormat>(last.format ?? "png");
  const [area, setArea] = useState<ExportArea>("all");
  const [scale, setScale] = useState<number>(last.scale ?? DEFAULT_PNG_SCALE);
  const [legend, setLegend] = useState<boolean>(last.legend ?? true);
  const [showPreview, setShowPreview] = useState<boolean>(last.preview ?? false);
  const preview = usePreviewUrl(showPreview, area, legend, renderPreview);
  const [fileBase, setFileBase] = useState(() => defaultFileBase(diagramName));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const exportButton = useRef<HTMLButtonElement>(null);

  useEffect(() => { exportButton.current?.focus(); }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [busy, onClose]);

  const size = measure(area, legend);
  const effective = size && format === "png" ? clampPngScale(size, scale) : null;
  const fileName = exportFileName(diagramName, format, undefined, fileBase);

  async function submit() {
    if (!size || busy) return;
    const choice = { format, area, scale, legend, fileName };
    setBusy(true);
    setError("");
    try {
      await onExport(choice);
      saveLastChoice({ format, scale, legend });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export fehlgeschlagen.");
      setBusy(false);
    }
  }

  return (
    <div className="diagram-suggestion-overlay" role="dialog" aria-modal="true" aria-labelledby="diagram-export-title" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="diagram-suggestion-card export-dialog" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="diagram-suggestion-header">
          <strong id="diagram-export-title">Diagramm exportieren</strong>
          <button type="button" className="sb-close-btn" onClick={onClose} disabled={busy} aria-label="Dialog schließen"><X size={14} /></button>
        </div>

        <div className="export-form">
          <FieldLabel id="export-format-label" text="Format" help={HELP.format} />
          <div className="export-segments" role="radiogroup" aria-labelledby="export-format-label">
            <Segment name="export-format" checked={format === "png"} onChange={() => setFormat("png")} title="PNG" />
            <Segment name="export-format" checked={format === "svg"} onChange={() => setFormat("svg")} title="SVG" />
          </div>

          <FieldLabel id="export-area-label" text="Bereich" help={HELP.area} />
          <div className="export-segments" role="radiogroup" aria-labelledby="export-area-label">
            <Segment name="export-area" checked={area === "all"} onChange={() => setArea("all")} title="Ganzes Diagramm" />
            <Segment name="export-area" checked={area === "viewport"} onChange={() => setArea("viewport")} title="Ausschnitt" />
          </div>

          <FieldLabel id="export-preview-label" text="Vorschau" help={HELP.preview} />
          <label className="export-check">
            <input type="checkbox" checked={showPreview} onChange={(e) => { setShowPreview(e.target.checked); saveLastChoice({ preview: e.target.checked }); }} aria-labelledby="export-preview-label" />
            Anzeigen
          </label>
          {showPreview && (
            <div className="export-preview" aria-live="polite">
              {preview.url
                ? <img src={preview.url} alt={`Vorschau des Exports von ${diagramName}`} className={preview.loading ? "is-updating" : ""} />
                : <span className="muted">{preview.error || "Vorschau wird erstellt …"}</span>}
            </div>
          )}

          {format === "png" && (
            <>
              <FieldLabel id="export-quality-label" text="Qualität" help={HELP.quality} />
              <div className="export-segments export-segments--3" role="radiogroup" aria-labelledby="export-quality-label">
                {QUALITY_LEVELS.map((level) => (
                  <Segment
                    key={level.scale}
                    name="export-quality"
                    checked={scale === level.scale}
                    onChange={() => setScale(level.scale)}
                    title={level.title}
                    sub={size ? formatPixels(size, clampPngScale(size, level.scale).scale) : undefined}
                  />
                ))}
              </div>
            </>
          )}

          <FieldLabel id="export-legend-label" text="Legende" help={HELP.legend} />
          <label className="export-check">
            <input type="checkbox" checked={legend} onChange={(e) => setLegend(e.target.checked)} aria-labelledby="export-legend-label" />
            Unter dem Diagramm einfügen
          </label>

          <label className="export-label" htmlFor="export-file-name">Dateiname</label>
          <div className="export-file">
            <input
              id="export-file-name"
              value={fileBase}
              onChange={(e) => setFileBase(e.target.value)}
              onFocus={(e) => e.target.select()}
              spellCheck={false}
              autoComplete="off"
            />
            <span className="export-file-ext">.{format}</span>
          </div>
        </div>

        {activeViewName && (
          <div className="export-hint">
            <Filter size={14} />
            <span>Filter <strong>„{activeViewName}“</strong> ist aktiv – nur gefilterte Elemente werden exportiert.</span>
          </div>
        )}
        {effective?.reduced && size && (
          <div className="export-hint export-hint--warn">
            Sehr großes Diagramm: Das Bild wird auf {formatPixels(size, effective.scale)} verkleinert. Für volle Schärfe nimm SVG.
          </div>
        )}
        {error && <div className="error-banner" role="alert">{error}</div>}

        <div className="diagram-suggestion-actions export-actions">
          <button type="button" onClick={onClose} disabled={busy}>Abbrechen</button>
          <button ref={exportButton} type="submit" className="sb-save-btn export-submit" disabled={busy || !size} title={fileName}>
            <Download size={15} /> {busy ? "Wird erstellt …" : "Herunterladen"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Segment({ name, checked, onChange, title, sub }: { name: string; checked: boolean; onChange: () => void; title: string; sub?: string }) {
  return (
    <label className={`export-segment${checked ? " is-active" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <strong>{title}</strong>
      {sub && <small>{sub}</small>}
    </label>
  );
}

/** Überschrift mit ⓘ: Erklärung erscheint beim Drüberfahren und per Tastatur (Tab) – ohne Platz zu kosten. */
function FieldLabel({ id, text, help }: { id: string; text: string; help: Array<{ title: string; text: string }> }) {
  const tipId = `${id}-help`;
  return (
    <span className="export-label">
      <span id={id}>{text}</span>
      <span className="export-info">
        <button type="button" className="export-info-btn" aria-label={`Erklärung zu ${text}`} aria-describedby={tipId}>
          <Info size={14} aria-hidden="true" />
        </button>
        <span className="export-info-tip" role="tooltip" id={tipId}>
          {help.map((item) => (
            <span key={item.title} className="export-info-item"><strong>{item.title}:</strong> {item.text}</span>
          ))}
        </span>
      </span>
    </span>
  );
}
