import type { ComponentInstance as Component, ComponentType, ConnectionType, ValidationRule, Viewpoint } from "../Sidebar/sidebarTypes";
import ComponentTypeIcon from "../componentIcons";
import {
  displayConnectionName,
  displayLayerName,
  displayRuleRationale,
  displaySeverity,
  displayTypeDescription,
  displayTypeName,
  displayValidationRuleMessage,
  displayValidationRuleName,
  displayViewpointName,
  edgeLabel,
  layerColor,
  layerOf,
  validationRuleLabel,
  viewpointNames,
  yesNo
} from "./metamodelLabels";
import type { DetailTarget, EdgeRule, TypeInsight } from "./metamodelLabels";
import { Chip, DetailDrawer, DrawerSection, FlowLabel, LayerChip, SeverityBadge } from "./ui";

export interface DetailContext {
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  viewpoints: Viewpoint[];
  validationRules: ValidationRule[];
  components: Component[];
  typeInsights: Map<string, TypeInsight>;
}

export function MetamodelDetailDrawer({ target, context, onSelect, onClose }: {
  target: DetailTarget;
  context: DetailContext;
  onSelect: (target: DetailTarget) => void;
  onClose: () => void;
}) {
  if (!target) return <DetailDrawer open={false} title="" onClose={onClose}>{null}</DetailDrawer>;
  if (target.kind === "type") {
    const type = target.type;
    return (
      <DetailDrawer
        open
        title={displayTypeName(type)}
        subtitle={<LayerChip layer={layerOf(type)} />}
        onClose={onClose}
      >
        <TypeDetail type={type} context={context} onSelect={onSelect} />
      </DetailDrawer>
    );
  }
  if (target.kind === "rule") {
    return (
      <DetailDrawer open title="Verbindungsregel" subtitle={<SeverityBadge severity={target.item.rule.severity} />} onClose={onClose}>
        <RuleDetail item={target.item} viewpoints={context.viewpoints} onSelect={onSelect} />
      </DetailDrawer>
    );
  }
  const edge = target.item;
  return (
    <DetailDrawer
      open
      title={`${displayTypeName(edge.sourceType)} → ${displayTypeName(edge.targetType)}`}
      subtitle={<span>{edgeLabel(edge)}</span>}
      onClose={onClose}
    >
      <p className="mm-drawer-lead">{edge.rules.map(displayRuleRationale).slice(0, 2).join(" ") || "Keine Begründung hinterlegt."}</p>
      <dl className="mm-facts">
        <dt>Pflicht</dt>
        <dd>{edge.rules.some((item) => item.rule.required) ? "Mindestens eine Beziehung ist verpflichtend" : "Freiwillig"}</dd>
        <dt>Schweregrad</dt>
        <dd>{[...new Set(edge.rules.map((item) => displaySeverity(item.rule.severity)))].join(", ")}</dd>
        <dt>Sichten</dt>
        <dd>{viewpointNames([...new Set(edge.rules.flatMap((item) => item.rule.viewpointIds ?? []))], context.viewpoints)}</dd>
      </dl>
      <DrawerSection title="Regeln" count={edge.rules.length}>
        <RuleList rules={edge.rules} onSelect={onSelect} />
      </DrawerSection>
      <DrawerSection title="Beteiligte Typen">
        <div className="mm-chip-row">
          <button type="button" className="mm-chip mm-chip--info" onClick={() => onSelect({ kind: "type", type: edge.sourceType })}>{displayTypeName(edge.sourceType)}</button>
          <button type="button" className="mm-chip mm-chip--info" onClick={() => onSelect({ kind: "type", type: edge.targetType })}>{displayTypeName(edge.targetType)}</button>
        </div>
      </DrawerSection>
    </DetailDrawer>
  );
}

function TypeDetail({ type, context, onSelect }: { type: ComponentType; context: DetailContext; onSelect: (target: DetailTarget) => void }) {
  const insight = context.typeInsights.get(type.id);
  const rules = insight?.rules ?? [];
  const outgoing = rules.filter((item) => item.sourceType.id === type.id);
  const incoming = rules.filter((item) => item.targetType.id === type.id && item.sourceType.id !== type.id);
  const validation = context.validationRules.filter((rule) => rule.sourceComponentTypeId === type.id || rule.targetComponentTypeId === type.id);
  const instances = context.components.filter((component) => component.componentTypeId === type.id);
  return (
    <>
      <div className="mm-drawer-hero" style={{ borderColor: type.color }}>
        <ComponentTypeIcon icon={type.icon} typeName={type.name} shape={type.shape} color={type.color} size={22} />
        <p>{displayTypeDescription(type)}</p>
      </div>
      <dl className="mm-facts">
        <dt>Layer</dt>
        <dd>{displayLayerName(layerOf(type))}</dd>
        {type.category && type.category !== layerOf(type) && (<><dt>Kategorie</dt><dd>{type.category}</dd></>)}
        <dt>Regeln gesamt</dt>
        <dd>{rules.length} ({outgoing.length} ausgehend, {incoming.length} eingehend)</dd>
        {type.isAbstract && (<><dt>Abstrakt</dt><dd>Ja</dd></>)}
        {type.customPropertyKeys.length > 0 && (<><dt>Eigenschaften</dt><dd>{type.customPropertyKeys.join(", ")}</dd></>)}
      </dl>
      <DrawerSection title="Verwendbar in Sichten" count={insight?.viewpoints.length ?? 0}>
        <div className="mm-chip-row">
          {(insight?.viewpoints ?? []).map((viewpoint) => (
            <Chip key={viewpoint.id} tone={insight?.requiredIn.some((item) => item.id === viewpoint.id) ? "ok" : "neutral"}>
              {displayViewpointName(viewpoint)}{insight?.requiredIn.some((item) => item.id === viewpoint.id) ? " · Pflicht" : ""}
            </Chip>
          ))}
          {(insight?.viewpoints.length ?? 0) === 0 && <span className="muted">Keine</span>}
        </div>
      </DrawerSection>
      <DrawerSection title="Ausgehende Regeln" count={outgoing.length}>
        <RuleList rules={outgoing} onSelect={onSelect} />
      </DrawerSection>
      <DrawerSection title="Eingehende Regeln" count={incoming.length}>
        <RuleList rules={incoming} onSelect={onSelect} />
      </DrawerSection>
      <DrawerSection title="Prüfregeln" count={validation.length}>
        {validation.length === 0 && <span className="muted">Keine</span>}
        <ul className="mm-plain-list">
          {validation.map((rule) => (
            <li key={rule.id}>
              <strong>{displayValidationRuleName(rule)}</strong>
              <span>{validationRuleLabel(rule, context.componentTypes, context.connectionTypes)}</span>
              <small>{displayValidationRuleMessage(rule)}</small>
            </li>
          ))}
        </ul>
      </DrawerSection>
      <DrawerSection title="Beispiele im Modell" count={instances.length}>
        {instances.length === 0 && <span className="muted">Noch keine Komponenten dieses Typs modelliert.</span>}
        <div className="mm-chip-row">
          {instances.slice(0, 8).map((component) => <Chip key={component.id}>{component.name}</Chip>)}
          {instances.length > 8 && <Chip tone="info">+{instances.length - 8} weitere</Chip>}
        </div>
      </DrawerSection>
    </>
  );
}

function RuleDetail({ item, viewpoints, onSelect }: { item: EdgeRule; viewpoints: Viewpoint[]; onSelect: (target: DetailTarget) => void }) {
  const { rule } = item;
  return (
    <>
      <div className="mm-drawer-flow">
        <FlowLabel
          source={displayTypeName(item.sourceType)}
          relation={displayConnectionName(item.connectionType)}
          target={displayTypeName(item.targetType)}
          relationColor={item.connectionType.color}
          sourceColor={layerColor(layerOf(item.sourceType))}
          targetColor={layerColor(layerOf(item.targetType))}
        />
      </div>
      <DrawerSection title="Begründung">
        <p className="mm-drawer-lead">{displayRuleRationale(item)}</p>
        {rule.description && rule.description !== displayRuleRationale(item) && <p className="muted">{rule.description}</p>}
      </DrawerSection>
      <dl className="mm-facts">
        <dt>Erlaubt</dt><dd>{yesNo(rule.allowed)}</dd>
        <dt>Pflicht</dt><dd>{yesNo(rule.required)}</dd>
        <dt>Schweregrad</dt><dd>{displaySeverity(rule.severity)}</dd>
        <dt>Sichten</dt><dd>{viewpointNames(rule.viewpointIds, viewpoints)}</dd>
        <dt>Typ</dt><dd>{item.sourceType.id === item.targetType.id ? "Selbstbezug" : "Explizit"}</dd>
        {rule.minOccurrences !== undefined && (<><dt>Mindestanzahl</dt><dd>{rule.minOccurrences}</dd></>)}
        {rule.maxOccurrences !== undefined && (<><dt>Höchstanzahl</dt><dd>{rule.maxOccurrences}</dd></>)}
        <dt>Regel-ID</dt><dd><code>{rule.id}</code></dd>
      </dl>
      <DrawerSection title="Beteiligte Typen">
        <div className="mm-chip-row">
          <button type="button" className="mm-chip mm-chip--info" onClick={() => onSelect({ kind: "type", type: item.sourceType })}>{displayTypeName(item.sourceType)}</button>
          <button type="button" className="mm-chip mm-chip--info" onClick={() => onSelect({ kind: "type", type: item.targetType })}>{displayTypeName(item.targetType)}</button>
        </div>
      </DrawerSection>
    </>
  );
}

function RuleList({ rules, onSelect }: { rules: EdgeRule[]; onSelect: (target: DetailTarget) => void }) {
  if (rules.length === 0) return <span className="muted">Keine</span>;
  return (
    <ul className="mm-rule-list">
      {rules.map((item) => (
        <li key={item.rule.id}>
          <button type="button" onClick={() => onSelect({ kind: "rule", item })}>
            <FlowLabel
              source={displayTypeName(item.sourceType)}
              relation={displayConnectionName(item.connectionType)}
              target={displayTypeName(item.targetType)}
              relationColor={item.connectionType.color}
              sourceColor={layerColor(layerOf(item.sourceType))}
              targetColor={layerColor(layerOf(item.targetType))}
            />
            <span className="mm-rule-list-meta">
              {item.rule.required && <Chip tone="ok">Pflicht</Chip>}
              <SeverityBadge severity={item.rule.severity} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
