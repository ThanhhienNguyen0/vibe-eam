import type { CSSProperties } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle, MinusCircle } from "lucide-react";
import type { ComponentType, ConnectionType, ValidationRule, Viewpoint } from "../Sidebar/sidebarTypes";
import ComponentTypeIcon from "../componentIcons";
import {
  displayValidationRuleMessage,
  displayValidationRuleName,
  displayViewpointName,
  SEVERITY_COLORS,
  validationRuleParts
} from "./metamodelLabels";
import { Card, EmptyHint, SeverityBadge, StatStrip } from "./ui";

export function ValidationRulesTab({ rules, componentTypes, connectionTypes, viewpoints, hidden, onShow }: {
  rules: ValidationRule[];
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  viewpoints: Viewpoint[];
  hidden: boolean;
  onShow: () => void;
}) {
  if (hidden) {
    return <EmptyHint text="Prüfregeln sind ausgeblendet. Aktiviere 'Prüfregeln anzeigen' in der Filterleiste." action={{ label: "Prüfregeln anzeigen", onClick: onShow }} />;
  }
  if (rules.length === 0) return <EmptyHint text="Keine Prüfregeln passen zu den aktuellen Filtern." />;

  const active = rules.filter((rule) => rule.active).length;
  const errors = rules.filter((rule) => rule.severity === "error").length;
  const warnings = rules.filter((rule) => rule.severity === "warning").length;

  return (
    <section className="metamodel-viewpoints-tab">
      <StatStrip
        label="Zusammenfassung der Prüfregeln"
        items={[
          { key: "total", icon: <ShieldCheck size={18} />, value: rules.length, label: "Prüfregeln gesamt", color: "#172033" },
          { key: "active", icon: <CheckCircle2 size={18} />, value: active, label: "Aktiv", color: "#16a34a" },
          { key: "inactive", icon: <MinusCircle size={18} />, value: rules.length - active, label: "Inaktiv", color: "#64748b" },
          { key: "warning", icon: <AlertTriangle size={18} />, value: warnings, label: "Warnung", color: SEVERITY_COLORS.warning },
          { key: "error", icon: <XCircle size={18} />, value: errors, label: "Fehler", color: SEVERITY_COLORS.error }
        ]}
      />
      <Card title="Prüfregeln" icon={<ShieldCheck size={16} />} count={rules.length}>
        <div className="metamodel-validation-grid">
          {rules.map((rule) => {
            const [source, relation, target] = validationRuleParts(rule, componentTypes, connectionTypes);
            const style = { "--mm-sev": SEVERITY_COLORS[rule.severity] ?? "#64748b" } as CSSProperties;
            const viewpoint = viewpoints.find((item) => item.id === rule.viewpointId);
            const subject = componentTypes.find((type) => type.id === rule.sourceComponentTypeId);
            return (
              <article key={rule.id} className={`metamodel-validation-card mm-validation-card${rule.active ? "" : " inactive"}`} style={style}>
                <header>
                  <span className="mm-validation-icon">
                    <ComponentTypeIcon icon={subject?.icon} typeName={subject?.name} shape={subject?.shape} color={subject?.color ?? "#334155"} size={16} />
                  </span>
                  <strong>{displayValidationRuleName(rule)}</strong>
                  <span className={`mm-status-pill${rule.active ? "" : " off"}`}>{rule.active ? "Aktiv" : "Inaktiv"}</span>
                </header>
                <span className="mm-validation-scope">
                  {rule.scope === "metamodel" ? "Metamodell" : `Sicht: ${displayViewpointName(viewpoint, rule.viewpointId ?? "?")}`}
                  {" / "}{rule.severity === "error" ? "Fehler" : "Warnung"}{" / "}{rule.active ? "aktiv" : "inaktiv"}
                </span>
                <div><SeverityBadge severity={rule.severity} /></div>
                <div className="mm-validation-flow">
                  <span>{source}</span>
                  <span>→ {relation} →</span>
                  <span>{target}</span>
                </div>
                <small>{displayValidationRuleMessage(rule)}</small>
                <details className="mm-inline-details">
                  <summary>Erklärung</summary>
                  <dl>
                    {rule.description && (<><dt>Beschreibung</dt><dd>{rule.description}</dd></>)}
                    <dt>Prüfung</dt>
                    <dd>Mindestens {rule.minOccurrences} Beziehung(en) „{relation}“ von {source} zu {target}.</dd>
                    <dt>Richtung</dt>
                    <dd>{rule.direction === "incoming" ? "eingehend" : "ausgehend"}</dd>
                    <dt>Geltungsbereich</dt>
                    <dd>{rule.scope === "metamodel" ? "Gesamtes Metamodell" : `Sicht: ${displayViewpointName(viewpoint, rule.viewpointId ?? "?")}`}</dd>
                    <dt>Meldung</dt>
                    <dd>{rule.message}</dd>
                  </dl>
                </details>
              </article>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
