import type { ReactNode } from "react";
import { Boxes, ChevronRight, Database, Eye, GitBranch, Link2, ShieldCheck, Sparkles, Users } from "lucide-react";
import type { ComponentType, ConnectionType, Viewpoint } from "../Sidebar/sidebarTypes";
import { BarList, DonutChart } from "./charts";
import type { ChartDatum } from "./charts";
import {
  displayConnectionName,
  displayLayerName,
  displayViewpointName,
  displayViewpointPurpose,
  layerColor,
  layerOf,
  sortLayers
} from "./metamodelLabels";
import type { EdgeRule, MetamodelTab } from "./metamodelLabels";
import { Card } from "./ui";

export function OverviewTab({
  viewpoints,
  selectedViewpoint,
  componentTypes,
  connectionTypes,
  allRules,
  validationRuleCount,
  onNavigate,
  onLayerSelect,
  onConnectionTypeSelect,
  onViewpointSelect
}: {
  viewpoints: Viewpoint[];
  selectedViewpoint?: Viewpoint;
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  allRules: EdgeRule[];
  validationRuleCount: number;
  onNavigate: (tab: MetamodelTab) => void;
  onLayerSelect: (layer: string) => void;
  onConnectionTypeSelect: (connectionTypeId: string) => void;
  onViewpointSelect: (viewpointId: string) => void;
}) {
  const typesPerLayer: ChartDatum[] = sortLayers(componentTypes.map(layerOf)).map((layer) => ({
    key: layer,
    label: displayLayerName(layer),
    value: componentTypes.filter((type) => layerOf(type) === layer).length,
    color: layerColor(layer)
  }));
  const rulesPerConnection: ChartDatum[] = connectionTypes
    .map((type) => ({
      key: type.id,
      label: displayConnectionName(type),
      value: allRules.filter((item) => item.connectionType.id === type.id).length,
      color: type.color
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const steps: Array<{ tab: MetamodelTab; icon: ReactNode; title: string; text: string; count: number }> = [
    { tab: "components", icon: <Boxes size={22} />, title: "Komponenten definieren", text: "Komponententypen bestimmen, was modelliert werden darf.", count: componentTypes.length },
    { tab: "rules", icon: <GitBranch size={22} />, title: "Verbindungen regeln", text: "Verbindungsregeln legen fest, welcher Typ mit welchem verbunden werden darf.", count: allRules.length },
    { tab: "viewpoints", icon: <Eye size={22} />, title: "Sichten bereitstellen", text: "Sichten zeigen jeder Stakeholder-Rolle nur das Relevante.", count: viewpoints.length },
    { tab: "validation", icon: <ShieldCheck size={22} />, title: "Qualität prüfen", text: "Prüfregeln melden fehlende Pflichtbeziehungen.", count: validationRuleCount }
  ];

  const shownViewpoints = selectedViewpoint ? [selectedViewpoint] : viewpoints;

  return (
    <section className="metamodel-overview">
      <div className="mm-grid-2">
        <Card title="So funktioniert das Metamodell" icon={<Sparkles size={16} />}>
          <p className="mm-card-lead">Ein Metamodell begrenzt den Diagrammbau: Es definiert erlaubte Komponententypen, erlaubte Verbindungsregeln und rollenbezogene Sichten.</p>
          <ol className="mm-steps">
            {steps.map((step, index) => (
              <li key={step.tab}>
                <button type="button" onClick={() => onNavigate(step.tab)} title={step.text}>
                  <span className="mm-step-number">{index + 1}</span>
                  <span className="mm-step-icon">{step.icon}</span>
                  <strong>{step.title}</strong>
                  <span className="mm-step-text">{step.text}</span>
                  <b>{step.count}</b>
                </button>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Komponententypen nach Layer">
          <DonutChart data={typesPerLayer} title="Komponententypen pro Layer" centerLabel="Typen" onSelect={onLayerSelect} hideCaption />
        </Card>
      </div>

      <div className="mm-grid-2">
        <article className="mm-card mm-example">
          <span className="mm-example-icon"><Link2 size={20} /></span>
          <span>
            <span className="metamodel-eyebrow">Beispiel-Regel</span>
            <strong>Anwendung → bedient → Geschäftsprozess</strong>
            <p>Verbindungsregel: Diese Beziehung auf Typebene ist erlaubt.</p>
          </span>
        </article>
        <article className="mm-card mm-example">
          <span className="mm-example-icon"><Database size={20} /></span>
          <span>
            <span className="metamodel-eyebrow">Konkrete Diagramminstanz</span>
            <strong>ERP System → bedient → Order to Cash</strong>
            <p>Konkrete Verbindung: Diese Beziehung im Diagramm ist gültig, weil eine passende Regel existiert.</p>
          </span>
        </article>
      </div>

      <Card title={selectedViewpoint ? "Gewählte Sicht" : "Stakeholder-Sichten"} icon={<Users size={16} />} count={shownViewpoints.length}>
        <div className="mm-viewpoint-chips">
          {shownViewpoints.map((viewpoint) => (
            <button
              key={viewpoint.id}
              type="button"
              className="mm-viewpoint-chip"
              onClick={() => onViewpointSelect(viewpoint.id)}
              title={displayViewpointPurpose(viewpoint)}
            >
              <span className="mm-viewpoint-chip-icon"><Eye size={16} /></span>
              <span>
                <strong>{displayViewpointName(viewpoint)}</strong>
                <small>{viewpoint.stakeholderRole}</small>
                <span className="mm-viewpoint-chip-purpose">{displayViewpointPurpose(viewpoint)}</span>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </Card>

      {rulesPerConnection.length > 0 && (
        <Card title="Verbindungsregeln pro Beziehungstyp">
          <BarList data={rulesPerConnection} title="Verbindungsregeln pro Beziehungstyp" onSelect={onConnectionTypeSelect} hideCaption />
        </Card>
      )}
    </section>
  );
}
