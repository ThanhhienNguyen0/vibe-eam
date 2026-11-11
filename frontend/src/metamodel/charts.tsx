import type { CSSProperties } from "react";

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutSegment extends ChartDatum {
  /** Fraction of the full circle (0..1). */
  fraction: number;
  /** Fraction of the circle before this segment starts (0..1). */
  offset: number;
}

/** Turns raw values into donut segments; zero values are dropped. */
export function donutSegments(data: ChartDatum[]): DonutSegment[] {
  const positive = data.filter((item) => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return [];
  let offset = 0;
  return positive.map((item) => {
    const fraction = item.value / total;
    const segment = { ...item, fraction, offset };
    offset += fraction;
    return segment;
  });
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ data, title, centerLabel, onSelect, activeKey, hideCaption }: {
  data: ChartDatum[];
  title: string;
  hideCaption?: boolean;
  centerLabel?: string;
  onSelect?: (key: string) => void;
  activeKey?: string;
}) {
  const segments = donutSegments(data);
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  return (
    <figure className="mm-chart mm-donut" aria-label={title}>
      {!hideCaption && <figcaption>{title}</figcaption>}
      <div className="mm-donut-body">
        <svg viewBox="0 0 100 100" role="img" aria-label={`${title}: ${segments.map((item) => `${item.label} ${item.value}`).join(", ") || "keine Daten"}`}>
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="14" />
          {segments.map((segment) => {
            // A 1px gap between segments keeps neighbouring colours readable.
            const gap = segments.length > 1 ? 1.2 : 0;
            const length = Math.max(0, segment.fraction * CIRCUMFERENCE - gap);
            const dimmed = activeKey && activeKey !== segment.key;
            return (
              <circle
                key={segment.key}
                data-segment={segment.key}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth="14"
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={-segment.offset * CIRCUMFERENCE}
                transform="rotate(-90 50 50)"
                opacity={dimmed ? 0.3 : 1}
                className={onSelect ? "mm-clickable" : undefined}
                onClick={onSelect ? () => onSelect(segment.key) : undefined}
              >
                <title>{`${segment.label}: ${segment.value}`}</title>
              </circle>
            );
          })}
          <text x="50" y="49" textAnchor="middle" className="mm-donut-total">{total}</text>
          {centerLabel && <text x="50" y="61" textAnchor="middle" className="mm-donut-caption">{centerLabel}</text>}
        </svg>
        <ul className="mm-legend">
          {data.map((item) => (
            <li key={item.key} className={activeKey && activeKey !== item.key ? "dimmed" : undefined}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(item.key)}>
                  <i style={{ background: item.color }} />{item.label}<b>{item.value}</b>
                </button>
              ) : (
                <span><i style={{ background: item.color }} />{item.label}<b>{item.value}</b></span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function BarList({ data, title, onSelect, activeKey, emptyText = "Keine Daten", hideCaption }: {
  data: ChartDatum[];
  title: string;
  hideCaption?: boolean;
  onSelect?: (key: string) => void;
  activeKey?: string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <figure className="mm-chart mm-bars" aria-label={title}>
      {!hideCaption && <figcaption>{title}</figcaption>}
      {data.length === 0 && <p className="mm-chart-empty">{emptyText}</p>}
      <ul>
        {data.map((item) => {
          const content = (
            <>
              <span className="mm-bar-label">{item.label}</span>
              <span className="mm-bar-track">
                <span className="mm-bar-fill" style={{ width: `${(item.value / max) * 100}%`, background: item.color }} />
              </span>
              <b>{item.value}</b>
            </>
          );
          return (
            <li key={item.key} className={activeKey && activeKey !== item.key ? "dimmed" : undefined}>
              {onSelect
                ? <button type="button" onClick={() => onSelect(item.key)}>{content}</button>
                : <span className="mm-bar-row">{content}</span>}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/** Horizontal stacked bar for status splits (e.g. Fehler vs. Warnung). */
export function StatusBar({ data, title, hideCaption }: { data: ChartDatum[]; title: string; hideCaption?: boolean }) {
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  return (
    <figure className="mm-chart mm-status" aria-label={title}>
      {!hideCaption && <figcaption>{title}</figcaption>}
      <div className="mm-status-track" role="img" aria-label={`${title}: ${data.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
        {total === 0 && <span className="mm-status-empty" />}
        {data.filter((item) => item.value > 0).map((item) => (
          <span key={item.key} style={{ width: `${(item.value / total) * 100}%`, background: item.color }} title={`${item.label}: ${item.value}`} />
        ))}
      </div>
      <ul className="mm-legend mm-legend--inline">
        {data.map((item) => (
          <li key={item.key}><span><i style={{ background: item.color }} />{item.label}<b>{item.value}</b></span></li>
        ))}
      </ul>
    </figure>
  );
}

export interface HeatmapAxisItem {
  key: string;
  label: string;
  color?: string;
}

/** Matrix of counts; cell intensity scales with the value. */
export function Heatmap({ title, rows, cols, value, onSelect, activeCell, rowHeader, colHeader, hideCaption }: {
  title: string;
  hideCaption?: boolean;
  rows: HeatmapAxisItem[];
  cols: HeatmapAxisItem[];
  value: (rowKey: string, colKey: string) => number;
  onSelect?: (rowKey: string, colKey: string) => void;
  activeCell?: { row: string; col: string } | null;
  rowHeader: string;
  colHeader: string;
}) {
  const max = Math.max(1, ...rows.flatMap((row) => cols.map((col) => value(row.key, col.key))));
  return (
    <figure className="mm-chart mm-heatmap" aria-label={title}>
      {!hideCaption && <figcaption>{title}</figcaption>}
      <div className="mm-scroll-x">
        <table>
          <thead>
            <tr>
              <th scope="col" className="mm-heatmap-corner">{rowHeader} ↓ / {colHeader} →</th>
              {cols.map((col) => <th key={col.key} scope="col"><i style={{ background: col.color }} />{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row"><i style={{ background: row.color }} />{row.label}</th>
                {cols.map((col) => {
                  const count = value(row.key, col.key);
                  const active = activeCell?.row === row.key && activeCell.col === col.key;
                  const style = { "--mm-heat": count === 0 ? 0 : 0.15 + (count / max) * 0.85 } as CSSProperties;
                  return (
                    <td key={col.key} style={style} className={`${count === 0 ? "zero" : ""}${active ? " active" : ""}`}>
                      {onSelect && count > 0
                        ? <button type="button" onClick={() => onSelect(row.key, col.key)} title={`${row.label} → ${col.label}: ${count}`}>{count}</button>
                        : <span>{count || "·"}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
