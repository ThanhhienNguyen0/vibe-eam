import type { CSSProperties } from "react";
import { Layers, Table2 } from "lucide-react";
import type { ComponentType } from "../Sidebar/sidebarTypes";
import ComponentTypeIcon from "../componentIcons";
import { DonutChart } from "./charts";
import {
  compact,
  displayConnectionName,
  displayLayerName,
  displayTypeDescription,
  displayTypeName,
  displayViewpointName,
  layerColor,
  layerOf,
  sortLayers
} from "./metamodelLabels";
import type { EdgeRule, TypeInsight } from "./metamodelLabels";
import { Card, Chip, EmptyHint, LayerChip, LayerIcon } from "./ui";

function shortRule(item: EdgeRule, type: ComponentType): string {
  if (item.sourceType.id === type.id) return `→ ${displayConnectionName(item.connectionType)} → ${displayTypeName(item.targetType)}`;
  return `← ${displayConnectionName(item.connectionType)} ← ${displayTypeName(item.sourceType)}`;
}

export function ComponentTypesTab({ groups, allComponentTypes, insights, layerFilter, onLayerFilterChange, onSelect, onResetFilters }: {
  groups: [string, ComponentType[]][];
  allComponentTypes: ComponentType[];
  insights: Map<string, TypeInsight>;
  layerFilter: string;
  onLayerFilterChange: (layer: string) => void;
  onSelect: (type: ComponentType) => void;
  onResetFilters: () => void;
}) {
  const layers = sortLayers(allComponentTypes.map(layerOf));
  const countFor = (layer: string) => allComponentTypes.filter((type) => layerOf(type) === layer).length;
  const visibleCount = groups.reduce((sum, [, types]) => sum + types.length, 0);
  const toggleLayer = (layer: string) => onLayerFilterChange(layerFilter === layer ? "all" : layer);

  return (
    <div className="metamodel-component-groups">
      <div className="mm-grid-main-side">
        <div className="mm-stack">
          <Card title="Komponententypen nach Layer" icon={<Layers size={16} />} count={visibleCount}>
            {groups.length === 0 && (
              <EmptyHint text="Keine Komponententypen passen zu den aktuellen Filtern." action={{ label: "Filter zurücksetzen", onClick: onResetFilters }} />
            )}
            <div className="mm-layer-rows">
              {groups.map(([layer, types]) => {
                const ruleIds = new Set(types.flatMap((type) => (insights.get(type.id)?.rules ?? []).map((item) => item.rule.id)));
                const viewpointIds = new Set(types.flatMap((type) => (insights.get(type.id)?.viewpoints ?? []).map((viewpoint) => viewpoint.id)));
                return (
                  <details
                    key={layer}
                    className="mm-layer-row metamodel-layer-group"
                    open={groups.length === 1 || layerFilter === layer}
                    style={{ "--mm-layer": layerColor(layer) } as CSSProperties}
                  >
                    <summary>
                      <span className="mm-layer-row-icon"><LayerIcon layer={layer} size={17} /></span>
                      <h3>{displayLayerName(layer)} <span>({types.length})</span></h3>
                      <span className="mm-layer-row-pill">{ruleIds.size} Regeln</span>
                      <span className="mm-layer-row-pill">{viewpointIds.size} Sichten</span>
                    </summary>
                    <div className="metamodel-component-grid">
                      {types.map((type) => {
                        const insight = insights.get(type.id);
                        const rules = insight?.rules ?? [];
                        const viewpoints = insight?.viewpoints ?? [];
                        return (
                          <button
                            type="button"
                            key={type.id}
                            className="metamodel-component-card mm-type-card"
                            style={{ borderLeftColor: type.color }}
                            onClick={() => onSelect(type)}
                            title="Details anzeigen"
                          >
                            <div className="mm-type-card-head">
                              <span className="mm-type-icon" style={{ background: `${type.color}1a`, color: type.color }}>
                                <ComponentTypeIcon icon={type.icon} typeName={type.name} shape={type.shape} color={type.color} size={16} />
                              </span>
                              <span>
                                <strong>{displayTypeName(type)}</strong>
                                <span>{displayLayerName(layerOf(type))}</span>
                              </span>
                            </div>
                            <p>{compact(displayTypeDescription(type), 105)}</p>
                            {rules.length > 0 && (
                              <ul className="mm-type-rules">
                                {rules.slice(0, 2).map((item) => <li key={item.rule.id}>{shortRule(item, type)}</li>)}
                                {rules.length > 2 && <li className="muted">+{rules.length - 2} weitere Regeln</li>}
                              </ul>
                            )}
                            {viewpoints.length > 0 && (
                              <div className="mm-chip-row">
                                {viewpoints.slice(0, 2).map((viewpoint) => <Chip key={viewpoint.id}>{displayViewpointName(viewpoint)}</Chip>)}
                                {viewpoints.length > 2 && <Chip tone="info">+{viewpoints.length - 2}</Chip>}
                              </div>
                            )}
                            <footer>
                              <span>{rules.length} Regeln</span>
                              <span>{viewpoints.length} Sichten</span>
                            </footer>
                          </button>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>

          {groups.length > 0 && (
            <details className="mm-card mm-collapsible">
              <summary><Table2 size={16} /> <h3>Vollständige Tabelle <span className="mm-card-count">({visibleCount})</span></h3></summary>
              <div className="metamodel-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Layer</th>
                      <th>Beschreibung</th>
                      <th>Regeln</th>
                      <th>Sichten</th>
                      <th>Pflicht in Sichten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.flatMap(([, types]) => types).map((type) => {
                      const insight = insights.get(type.id);
                      return (
                        <tr key={type.id} className="mm-clickable-row" onClick={() => onSelect(type)}>
                          <td><strong style={{ color: type.color }}>{displayTypeName(type)}</strong></td>
                          <td><LayerChip layer={layerOf(type)} /></td>
                          <td>{displayTypeDescription(type)}</td>
                          <td>{insight?.rules.length ?? 0}</td>
                          <td>{insight?.viewpoints.map((viewpoint) => displayViewpointName(viewpoint)).join(", ") || "Keine"}</td>
                          <td>{insight?.requiredIn.map((viewpoint) => displayViewpointName(viewpoint)).join(", ") || "Keine"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>

        <Card title="Verteilung der Komponententypen" className="mm-side-card">
          <DonutChart
            title="Verteilung nach Layer"
            hideCaption
            centerLabel="Typen"
            data={layers.map((layer) => ({ key: layer, label: displayLayerName(layer), value: countFor(layer), color: layerColor(layer) }))}
            onSelect={toggleLayer}
            activeKey={layerFilter === "all" ? undefined : layerFilter}
          />
          <p className="mm-hint">Klick auf ein Segment oder einen Eintrag filtert nach Layer.</p>
          {layerFilter !== "all" && (
            <button type="button" className="mm-chip" onClick={() => onLayerFilterChange("all")}>Alle Layer anzeigen</button>
          )}
        </Card>
      </div>
    </div>
  );
}
