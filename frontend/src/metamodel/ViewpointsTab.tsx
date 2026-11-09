import type { CSSProperties } from "react";
import { Boxes, Eye, Grid3x3, GitBranch, ShieldCheck, Table2 } from "lucide-react";
import type { ComponentType, ConnectionRule, ConnectionType, ValidationRule, Viewpoint, ViewpointRule } from "../Sidebar/sidebarTypes";
import {
  displayLayerName,
  displayTypeName,
  displayViewpointName,
  displayViewpointPurpose,
  layerColor,
  layerOf,
  layerRank,
  layerShort,
  sortLayers,
  validationRuleLabel
} from "./metamodelLabels";
import { Card, Chip, EmptyHint } from "./ui";

type Coverage = "full" | "partial" | "none";

export function ViewpointsTab({ viewpoints, viewpointRules, componentTypes, connectionRules, validationRules, connectionTypes, onSelectType }: {
  viewpoints: Viewpoint[];
  viewpointRules: ViewpointRule[];
  componentTypes: ComponentType[];
  connectionRules: ConnectionRule[];
  validationRules: ValidationRule[];
  connectionTypes: ConnectionType[];
  onSelectType: (type: ComponentType) => void;
}) {
  const typeName = (id: string) => displayTypeName(componentTypes.find((type) => type.id === id), id);
  const matrixTypes = [...componentTypes].sort((a, b) => layerRank(layerOf(a)) - layerRank(layerOf(b)) || displayTypeName(a).localeCompare(displayTypeName(b)));
  const layers = sortLayers(componentTypes.map(layerOf));
  const viewpointName = (rule: ViewpointRule) => displayViewpointName(viewpoints.find((item) => item.id === rule.viewpointId), rule.viewpointId);

  function coverage(rule: ViewpointRule, layer: string): { state: Coverage; allowed: number; total: number } {
    const typesInLayer = componentTypes.filter((type) => layerOf(type) === layer);
    const allowed = typesInLayer.filter((type) => rule.allowedComponentTypeIds.includes(type.id)).length;
    const state: Coverage = allowed === 0 ? "none" : allowed === typesInLayer.length ? "full" : "partial";
    return { state, allowed, total: typesInLayer.length };
  }

  return (
    <section className="metamodel-viewpoints-tab">
      <div className="metamodel-info-strip">Eine Sicht ist ein Rollenfilter. Ein Stakeholder bleibt ein modellierbares Element im Diagramm.</div>
      {viewpointRules.length === 0 && <EmptyHint text="Keine Sichtregeln vorhanden." />}

      {viewpointRules.length > 0 && (
        <div className="mm-grid-main-side">
          <Card title="Stakeholder-Sichten" icon={<Eye size={16} />} count={viewpointRules.length}>
            <div className="metamodel-viewpoint-list mm-viewpoint-grid">
              {viewpointRules.map((rule) => {
                const viewpoint = viewpoints.find((item) => item.id === rule.viewpointId);
                const relevantValidationRules = validationRules.filter((item) => item.scope === "metamodel" || item.viewpointId === rule.viewpointId);
                const allowedRuleCount = rule.allowedConnectionRuleIds.length || connectionRules.filter((item) => item.viewpointIds?.includes(rule.viewpointId)).length;
                const allowedLayers = sortLayers(rule.allowedComponentTypeIds
                  .map((id) => componentTypes.find((type) => type.id === id))
                  .filter((type): type is ComponentType => Boolean(type))
                  .map(layerOf));
                return (
                  <article key={rule.id} className="metamodel-viewpoint-card mm-viewpoint-card">
                    <header>
                      <span className="mm-viewpoint-icon"><Eye size={16} /></span>
                      <span>
                        <strong>{viewpointName(rule)}</strong>
                        <span>{viewpoint?.stakeholderRole ?? "Unbekannte Rolle"}</span>
                      </span>
                    </header>
                    <p>{displayViewpointPurpose(viewpoint, rule.description || "Kein Zweck hinterlegt.")}</p>
                    {allowedLayers.length > 0 && (
                      <div className="mm-layer-strip" aria-label="Enthaltene Layer">
                        {allowedLayers.map((layer) => (
                          <span key={layer} style={{ "--mm-layer": layerColor(layer) } as CSSProperties} title={displayLayerName(layer)} />
                        ))}
                      </div>
                    )}
                    <div className="mm-viewpoint-meta">
                      <span><Boxes size={13} /> {rule.allowedComponentTypeIds.length} Typen</span>
                      <span><GitBranch size={13} /> {allowedRuleCount} Regeln</span>
                      <span><ShieldCheck size={13} /> {rule.requiredComponentTypeIds.length > 0 ? `${rule.requiredComponentTypeIds.length} Pflicht-Typen` : "Keine Pflicht-Typen"}</span>
                    </div>
                    <details className="mm-inline-details">
                      <summary>Details anzeigen</summary>
                      <dl>
                        <dt>Erlaubte Komponententypen</dt>
                        <dd>{rule.allowedComponentTypeIds.map(typeName).join(", ") || "Keine"}</dd>
                        <dt>Erlaubte Verbindungsregeln</dt>
                        <dd>{allowedRuleCount}</dd>
                        <dt>Pflicht-Komponententypen</dt>
                        <dd>{rule.requiredComponentTypeIds.map(typeName).join(", ") || "Keine"}</dd>
                        <dt>Pflicht-Verbindungsregeln</dt>
                        <dd>{rule.requiredConnectionRuleIds.length || "Keine"}</dd>
                        <dt>Prüfregeln</dt>
                        <dd>{relevantValidationRules.map((item) => validationRuleLabel(item, componentTypes, connectionTypes)).join("; ") || "Keine"}</dd>
                      </dl>
                    </details>
                  </article>
                );
              })}
            </div>
          </Card>

          {layers.length > 0 && (
            <Card title="Sichten × Komponententypen" icon={<Grid3x3 size={16} />} className="mm-side-card">
              <div className="mm-scroll-x">
                <table className="mm-layer-matrix">
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Sicht</span></th>
                      {layers.map((layer) => (
                        <th key={layer} scope="col" title={displayLayerName(layer)}>
                          <span className="mm-layer-letter" style={{ "--mm-layer": layerColor(layer) } as CSSProperties}>{layerShort(layer)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewpointRules.map((rule) => (
                      <tr key={rule.id}>
                        <th scope="row" title={viewpointName(rule)}>{viewpointName(rule)}</th>
                        {layers.map((layer) => {
                          const cell = coverage(rule, layer);
                          const label = `${viewpointName(rule)} · ${displayLayerName(layer)}: ${cell.allowed} von ${cell.total} Typen`;
                          return (
                            <td key={layer}>
                              <span className={`mm-cov mm-cov--${cell.state}`} style={{ "--mm-layer": layerColor(layer) } as CSSProperties} title={label} aria-label={label} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mm-cov-legend">
                <span><i className="mm-cov mm-cov--full" /> erlaubt</span>
                <span><i className="mm-cov mm-cov--partial" /> teilweise</span>
                <span><i className="mm-cov mm-cov--none" /> nicht enthalten</span>
              </div>
            </Card>
          )}
        </div>
      )}

      {viewpointRules.length > 0 && matrixTypes.length > 0 && (
        <details className="mm-card mm-collapsible">
          <summary><Table2 size={16} /><h3>Detailmatrix: Sichten × einzelne Komponententypen</h3></summary>
          <div className="mm-chip-row">
            <Chip tone="ok">● Pflicht</Chip>
            <Chip>○ erlaubt</Chip>
            <Chip>· nicht enthalten</Chip>
          </div>
          <div className="mm-scroll-x">
            <table className="mm-matrix">
              <thead>
                <tr>
                  <th scope="col">Komponententyp</th>
                  {viewpointRules.map((rule) => <th key={rule.id} scope="col">{viewpointName(rule)}</th>)}
                </tr>
              </thead>
              <tbody>
                {matrixTypes.map((type) => (
                  <tr key={type.id} style={{ "--mm-layer": layerColor(layerOf(type)) } as CSSProperties}>
                    <th scope="row">
                      <button type="button" onClick={() => onSelectType(type)}>
                        <i className="mm-layer-dot" />{displayTypeName(type)}
                        <small>{displayLayerName(layerOf(type))}</small>
                      </button>
                    </th>
                    {viewpointRules.map((rule) => {
                      const requiredHere = rule.requiredComponentTypeIds.includes(type.id);
                      const allowed = rule.allowedComponentTypeIds.includes(type.id);
                      const state = requiredHere ? "required" : allowed ? "allowed" : "none";
                      const label = requiredHere ? "Pflicht" : allowed ? "erlaubt" : "nicht enthalten";
                      return (
                        <td key={rule.id} className={`mm-matrix-cell ${state}`} title={label} aria-label={label}>
                          {requiredHere ? "●" : allowed ? "○" : "·"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
