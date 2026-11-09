import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  AlertTriangle,
  AppWindow,
  Briefcase,
  Building2,
  Cpu,
  Database,
  Shapes,
  Target,
  Workflow,
  X,
  XCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ConnectionType } from "../Sidebar/sidebarTypes";
import { displayConnectionName, displayLayerName, displaySeverity, layerColor, SEVERITY_COLORS } from "./metamodelLabels";

const LAYER_ICONS: Record<string, LucideIcon> = {
  Motivation: Target,
  Business: Briefcase,
  Organization: Building2,
  Application: AppWindow,
  Data: Database,
  Technology: Cpu,
  BPMN: Workflow
};

export function layerIconFor(layer: string): LucideIcon {
  return LAYER_ICONS[layer] ?? Shapes;
}

export function LayerIcon({ layer, size = 16 }: { layer: string; size?: number }) {
  const Icon = layerIconFor(layer);
  return <Icon size={size} color={layerColor(layer)} aria-hidden="true" />;
}

/** Header KPI: icon, big value, label underneath. */
export function KpiCard({ label, value, icon, onClick }: {
  label: string;
  value: number | string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      {icon && <span className="mm-kpi-icon">{icon}</span>}
      <span className="mm-kpi-text">
        <strong>{value}</strong>
        <span>{label}</span>
      </span>
    </>
  );
  return onClick
    ? <button type="button" className="mm-kpi" onClick={onClick}>{body}</button>
    : <div className="mm-kpi">{body}</div>;
}

export interface StatItem {
  key: string;
  icon: ReactNode;
  value: number | string;
  label: string;
  /** Colour of the round icon badge. */
  color: string;
}

/** Horizontal summary strip: several icon + number + label blocks separated by dividers. */
export function StatStrip({ items, label }: { items: StatItem[]; label: string }) {
  return (
    <section className="mm-stat-strip" aria-label={label}>
      {items.map((item) => (
        <div key={item.key} className="mm-stat" style={{ "--mm-accent": item.color } as CSSProperties}>
          <span className="mm-stat-icon">{item.icon}</span>
          <span>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

/** White content card with an optional header row. */
export function Card({ title, icon, count, actions, children, className = "" }: {
  title?: ReactNode;
  icon?: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mm-card ${className}`}>
      {(title || actions) && (
        <header className="mm-card-header">
          <h3>
            {icon && <span className="mm-card-icon">{icon}</span>}
            {title}
            {count !== undefined && <span className="mm-card-count">({count})</span>}
          </h3>
          {actions && <div className="mm-card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function LayerChip({ layer, count, active, onClick }: {
  layer: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const style = { "--mm-layer": layerColor(layer) } as CSSProperties;
  const body = (
    <>
      <i />
      {displayLayerName(layer)}
      {count !== undefined && <b>{count}</b>}
    </>
  );
  const className = `mm-chip mm-layer-chip${active ? " active" : ""}`;
  return onClick
    ? <button type="button" className={className} style={style} onClick={onClick} aria-pressed={active}>{body}</button>
    : <span className={className} style={style}>{body}</span>;
}

export function Chip({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "info" | "ok" | "warn" | "error"; title?: string }) {
  return <span className={`mm-chip mm-chip--${tone}`} title={title}>{children}</span>;
}

/** Relation name as a pill tinted with the connection type colour. */
export function RelationPill({ type }: { type: ConnectionType }) {
  return (
    <span className="mm-relation" style={{ "--mm-rel": type.color } as CSSProperties}>
      {displayConnectionName(type)}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const style = { "--mm-sev": SEVERITY_COLORS[severity] ?? "#64748b" } as CSSProperties;
  const Icon = severity === "error" ? XCircle : AlertTriangle;
  return <span className="mm-severity" style={style}><Icon size={11} aria-hidden="true" />{displaySeverity(severity)}</span>;
}

/** Visual "Quelle → Beziehung → Ziel" line. */
export function FlowLabel({ source, relation, target, relationColor, sourceColor, targetColor }: {
  source: string;
  relation: string;
  target: string;
  relationColor?: string;
  sourceColor?: string;
  targetColor?: string;
}) {
  return (
    <span className="mm-flow">
      <span className="mm-flow-node" style={{ "--mm-layer": sourceColor ?? "#64748b" } as CSSProperties}>{source}</span>
      <span className="mm-flow-rel" style={{ color: relationColor }}>→ {relation} →</span>
      <span className="mm-flow-node" style={{ "--mm-layer": targetColor ?? "#64748b" } as CSSProperties}>{target}</span>
    </span>
  );
}

export function DetailDrawer({ open, title, subtitle, onClose, children }: {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="mm-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="mm-drawer" role="dialog" aria-modal="false" aria-label={title}>
        <header>
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="mm-drawer-subtitle">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Details schließen" title="Schließen (Esc)"><X size={16} /></button>
        </header>
        <div className="mm-drawer-body">{children}</div>
      </aside>
    </>
  );
}

export function DrawerSection({ title, children, count }: { title: string; children: ReactNode; count?: number }) {
  return (
    <section className="mm-drawer-section">
      <h4>{title}{count !== undefined && <b>{count}</b>}</h4>
      {children}
    </section>
  );
}

export function EmptyHint({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="metamodel-empty">
      {text}
      {action && <div><button type="button" className="mm-link-button" onClick={action.onClick}>{action.label}</button></div>}
    </div>
  );
}
