import { useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, GitBranch, Link2, X, XCircle } from "lucide-react";
import type { Viewpoint } from "../Sidebar/sidebarTypes";
import { BarList, Heatmap } from "./charts";
import {
  compact,
  displayConnectionName,
  displayLayerName,
  displayRuleRationale,
  displayTypeName,
  displayViewpointName,
  layerColor,
  layerOf,
  SEVERITY_COLORS,
  sortLayers,
  viewpointNames
} from "./metamodelLabels";
import type { EdgeRule, SortKey } from "./metamodelLabels";
import { Card, EmptyHint, RelationPill, SeverityBadge, StatStrip } from "./ui";

function ViewpointPills({ ids, viewpoints }: { ids?: string[]; viewpoints: Viewpoint[] }) {
  if (!ids || ids.length === 0) return <span className="mm-vp-pill mm-vp-pill--all">Alle</span>;
  const first = displayViewpointName(viewpoints.find((vp) => vp.id === ids[0]), ids[0]);
  return (
    <span className="mm-vp-pills" title={viewpointNames(ids, viewpoints)}>
      <span className="mm-vp-pill">{first}</span>
      {ids.length > 1 && <span className="mm-vp-more">+{ids.length - 1}</span>}
    </span>
  );
}

export function ConnectionRulesTab({ rules, viewpoints, sortKey, onSortChange, onSelect, connectionTypeFilter, onConnectionTypeFilterChange, onResetFilters }: {
  rules: EdgeRule[];
  viewpoints: Viewpoint[];
  sortKey: SortKey;
  onSortChange: (value: SortKey) => void;
  onSelect: (item: EdgeRule) => void;
  connectionTypeFilter: string;
  onConnectionTypeFilterChange: (id: string) => void;
  onResetFilters: () => void;
}) {
  const [pairFilter, setPairFilter] = useState<{ row: string; col: string } | null>(null);

  if (rules.length === 0) {
    return <EmptyHint text="Keine Verbindungsregeln passen zu den aktuellen Filtern." action={{ label: "Filter zurücksetzen", onClick: onResetFilters }} />;
  }

  const sourceLayers = sortLayers(rules.map((item) => layerOf(item.sourceType)));
  const targetLayers = sortLayers(rules.map((item) => layerOf(item.targetType)));
  const visibleRules = pairFilter
    ? rules.filter((item) => layerOf(item.sourceType) === pairFilter.row && layerOf(item.targetType) === pairFilter.col)
    : rules;

  const required = rules.filter((item) => item.rule.required).length;
  const errors = rules.filter((item) => item.rule.severity === "error").length;
  const warnings = rules.filter((item) => item.rule.severity === "warning").length;
  const connectionBars = [...new Map(rules.map((item) => [item.connectionType.id, item.connectionType])).values()]
    .map((type) => ({
      key: type.id,
      label: displayConnectionName(type),
      value: rules.filter((item) => item.connectionType.id === type.id).length,
      color: type.color
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <section className="metamodel-table-section">
      <StatStrip
        label="Zusammenfassung der Verbindungsregeln"
        items={[
          { key: "total", icon: <Link2 size={18} />, value: rules.length, label: "Verbindungsregeln gesamt", color: "#172033" },
          { key: "required", icon: <CheckCircle2 size={18} />, value: required, label: "Pflichtregeln", color: "#16a34a" },
          { key: "optional", icon: <GitBranch size={18} />, value: rules.length - required, label: "Freiwillig", color: "#64748b" },
          { key: "error", icon: <XCircle size={18} />, value: errors, label: "Schweregrad: Fehler", color: SEVERITY_COLORS.error },
          { key: "warning", icon: <AlertTriangle size={18} />, value: warnings, label: "Schweregrad: Warnung", color: SEVERITY_COLORS.warning }
        ]}
      />

      <details className="mm-card mm-collapsible">
        <summary><BarChart3 size={16} /><h3>Auswertung: Layer und Beziehungstypen</h3></summary>
        <div className="mm-chart-grid mm-chart-grid--wide">
          <Heatmap
            title="Regeln zwischen Layern (Klick filtert)"
            rowHeader="Quelle"
            colHeader="Ziel"
            rows={sourceLayers.map((layer) => ({ key: layer, label: displayLayerName(layer), color: layerColor(layer) }))}
            cols={targetLayers.map((layer) => ({ key: layer, label: displayLayerName(layer), color: layerColor(layer) }))}
            value={(row, col) => rules.filter((item) => layerOf(item.sourceType) === row && layerOf(item.targetType) === col).length}
            activeCell={pairFilter}
            onSelect={(row, col) => setPairFilter((current) => (current?.row === row && current.col === col ? null : { row, col }))}
          />
          <BarList
            title="Regeln pro Beziehungstyp"
            data={connectionBars}
            activeKey={connectionTypeFilter === "all" ? undefined : connectionTypeFilter}
            onSelect={(id) => onConnectionTypeFilterChange(connectionTypeFilter === id ? "all" : id)}
          />
        </div>
      </details>

      <Card
        title="Verbindungsregeln"
        icon={<GitBranch size={16} />}
        count={visibleRules.length}
        actions={(
          <>
            {pairFilter && (
              <span className="mm-active-filter">
                {displayLayerName(pairFilter.row)} → {displayLayerName(pairFilter.col)}
                <button type="button" onClick={() => setPairFilter(null)} aria-label="Layer-Filter entfernen"><X size={13} /></button>
              </span>
            )}
            <label className="mm-inline-select">
              Sortierung
              <select value={sortKey} onChange={(e) => onSortChange(e.target.value as SortKey)}>
                <option value="source">Quelltyp</option>
                <option value="connection">Verbindungstyp</option>
              </select>
            </label>
          </>
        )}
      >
        <div className="metamodel-table-wrap mm-table">
          <table>
            <thead>
              <tr>
                <th>Quelle</th>
                <th>Beziehung</th>
                <th>Ziel</th>
                <th>Pflicht</th>
                <th>Schweregrad</th>
                <th>Sichten</th>
                <th>Begründung</th>
              </tr>
            </thead>
            <tbody>
              {visibleRules.map((item) => (
                <tr key={item.rule.id} className="mm-clickable-row" onClick={() => onSelect(item)} title="Details anzeigen">
                  <td><span className="mm-type-cell"><i style={{ background: layerColor(layerOf(item.sourceType)) }} />{displayTypeName(item.sourceType)}</span></td>
                  <td><RelationPill type={item.connectionType} /></td>
                  <td><span className="mm-type-cell"><i style={{ background: layerColor(layerOf(item.targetType)) }} />{displayTypeName(item.targetType)}</span></td>
                  <td>{item.rule.required ? "Ja" : "Nein"}</td>
                  <td><SeverityBadge severity={item.rule.severity} /></td>
                  <td><ViewpointPills ids={item.rule.viewpointIds} viewpoints={viewpoints} /></td>
                  <td className="mm-rationale" title={displayRuleRationale(item)}>{compact(displayRuleRationale(item), 140)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
