import { useState } from "react";
import { ArrowRight, GitBranch, LayoutDashboard, Plus, Trash2, X } from "lucide-react";
import { sidebarApi } from "./sidebarApi";
import type { SidebarSelection } from "./Sidebar";
import { COMPONENT_SHAPES } from "./sidebarTypes";
import type {
  ComponentInstance,
  ComponentShape,
  ConnectionRule,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram,
  SidebarState,
  Viewpoint
} from "./sidebarTypes";

interface Props {
  selection: SidebarSelection | null;
  sidebarState: SidebarState;
  onStateChange: (next: SidebarState) => void;
  onSelect: (sel: SidebarSelection) => void;
  onOpenDiagram: (id: string) => void;
  onClose: () => void;
}

function DetailWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="sb-detail-wrapper">
      <div className="sb-detail-topbar">
        <span className="sb-detail-title">{title}</span>
        <button className="sb-close-btn" onClick={onClose} title="Panel schließen"><X size={15} /></button>
      </div>
      <div className="sb-detail-body">{children}</div>
    </div>
  );
}

export default function SidebarPanels({ selection, sidebarState, onStateChange, onSelect, onOpenDiagram, onClose }: Props) {
  if (!selection) return null;

  const { componentTypes, connectionTypes, connectionRules, viewpoints, components, connections, diagrams } = sidebarState;

  if (selection.kind === "componentTypes") {
    return (
      <DetailWrapper title="Komponenten-Typen" onClose={onClose}>
        <p className="muted">Definiere wiederverwendbare Typen mit Name, Farbe und benutzerdefinierten Eigenschaften.</p>
        <div className="sb-type-grid">
          {componentTypes.map((ct) => (
            <div key={ct.id} className="sb-type-card" style={{ borderLeftColor: ct.color }}>
              <strong>{ct.name}</strong>
              <span className="muted">{ct.description || "Keine Beschreibung"}</span>
              <span className="sb-badge" style={{ background: ct.color }}>{ct.customPropertyKeys.length} Eigenschaften</span>
            </div>
          ))}
          {componentTypes.length === 0 && <p className="muted">Noch keine Typen definiert.</p>}
        </div>
      </DetailWrapper>
    );
  }

  if (selection.kind === "componentType") {
    const ct = componentTypes.find((c) => c.id === selection.id);
    if (!ct) return null;
    return (
      <DetailWrapper title={ct.name} onClose={onClose}>
        <ComponentTypeEditor
          key={ct.id}
          ct={ct}
          viewpoints={viewpoints}
          existingCategories={[...new Set(componentTypes.map((t) => t.category?.trim() || "Standard"))]}
          onSave={async (patch) => {
            const updated = await sidebarApi.updateComponentType(ct.id, patch);
            onStateChange({ ...sidebarState, componentTypes: componentTypes.map((c) => (c.id === ct.id ? updated : c)) });
          }}
        />
      </DetailWrapper>
    );
  }

  if (selection.kind === "connectionTypes") {
    return (
      <DetailWrapper title="Verbindungs-Typen" onClose={onClose}>
        <p className="muted">Definiere Verbindungstypen mit Linienstil, Farbe und erlaubten Quell-/Zieltypen.</p>
        <div className="sb-type-grid">
          {connectionTypes.map((ct) => (
            <div key={ct.id} className="sb-type-card" style={{ borderLeftColor: ct.color }}>
              <strong>{ct.name}</strong>
              <span className="muted">{ct.description || "Keine Beschreibung"}</span>
              <span className="sb-badge" style={{ background: ct.color }}>{ct.lineStyle}</span>
            </div>
          ))}
          {connectionTypes.length === 0 && <p className="muted">Noch keine Typen definiert.</p>}
        </div>
      </DetailWrapper>
    );
  }

  if (selection.kind === "connectionType") {
    const ct = connectionTypes.find((c) => c.id === selection.id);
    if (!ct) return null;
    return (
      <DetailWrapper title={ct.name} onClose={onClose}>
        <ConnectionTypeEditor
          key={ct.id}
          ct={ct}
          componentTypes={componentTypes}
          viewpoints={viewpoints}
          existingCategories={[...new Set(connectionTypes.map((t) => t.category?.trim() || "Standard"))]}
          onSave={async (patch) => {
            const updated = await sidebarApi.updateConnectionType(ct.id, patch);
            onStateChange({ ...sidebarState, connectionTypes: connectionTypes.map((c) => (c.id === ct.id ? updated : c)) });
          }}
        />
      </DetailWrapper>
    );
  }

  if (selection.kind === "connectionRules") {
    return (
      <DetailWrapper title="Connection Rules" onClose={onClose}>
        <p className="muted">Connection Rules sind die fachliche Quelle fuer erlaubte Source-Type / Relation / Target-Type Kombinationen.</p>
        <div className="sb-instance-list">
          {connectionRules.map((rule) => {
            const source = componentTypes.find((type) => type.id === rule.sourceComponentTypeId);
            const connectionType = connectionTypes.find((type) => type.id === rule.connectionTypeId);
            const target = componentTypes.find((type) => type.id === rule.targetComponentTypeId);
            return (
              <div key={rule.id} className="sb-instance-row sb-diagram-row" onClick={() => onSelect({ kind: "connectionRule", id: rule.id })}>
                <strong>{source?.name ?? "?"} --{connectionType?.name ?? "?"}--&gt; {target?.name ?? "?"}</strong>
                <span className="muted">{rule.required ? "required" : "optional"} / {rule.severity}</span>
              </div>
            );
          })}
          {connectionRules.length === 0 && <p className="muted">Noch keine Connection Rules definiert.</p>}
        </div>
      </DetailWrapper>
    );
  }

  if (selection.kind === "connectionRule") {
    const rule = connectionRules.find((item) => item.id === selection.id);
    if (!rule) return null;
    return (
      <DetailWrapper title="Connection Rule" onClose={onClose}>
        <ConnectionRuleEditor
          key={rule.id}
          rule={rule}
          componentTypes={componentTypes}
          connectionTypes={connectionTypes}
          viewpoints={viewpoints}
          onSave={async (patch) => {
            const updated = await sidebarApi.updateConnectionRule(rule.id, patch);
            onStateChange({ ...sidebarState, connectionRules: connectionRules.map((item) => (item.id === rule.id ? updated : item)) });
          }}
        />
      </DetailWrapper>
    );
  }

  if (selection.kind === "viewpoints") {
    return (
      <DetailWrapper title="Viewpoints" onClose={onClose}>
        <p className="muted">Stakeholder-Sichten definieren erlaubte und verpflichtende Typen fuer Diagramme.</p>
        <div className="sb-type-grid">
          {viewpoints.map((vp) => (
            <div key={vp.id} className="sb-type-card" onClick={() => onSelect({ kind: "viewpoint", id: vp.id })}>
              <strong>{vp.name}</strong>
              <span className="muted">{vp.stakeholderRole || "Keine Rolle"}</span>
              <span className="sb-badge">{vp.allowedComponentTypeIds.length} Typen</span>
            </div>
          ))}
          {viewpoints.length === 0 && <p className="muted">Noch keine Viewpoints definiert.</p>}
        </div>
      </DetailWrapper>
    );
  }

  if (selection.kind === "viewpoint") {
    const vp = viewpoints.find((v) => v.id === selection.id);
    if (!vp) return null;
    return (
      <DetailWrapper title={vp.name} onClose={onClose}>
        <ViewpointEditor
          key={vp.id}
          viewpoint={vp}
          componentTypes={componentTypes}
          connectionTypes={connectionTypes}
          onSave={async (patch) => {
            const updated = await sidebarApi.updateViewpoint(vp.id, patch);
            onStateChange({ ...sidebarState, viewpoints: viewpoints.map((v) => (v.id === vp.id ? updated : v)) });
          }}
        />
      </DetailWrapper>
    );
  }

  if (selection.kind === "components") {
    return (
      <DetailWrapper title="Komponenten" onClose={onClose}>
        <p className="muted">Konkrete Instanzen auf Basis der definierten Typen.</p>
        <div className="sb-instance-list">
          {components.map((comp) => {
            const type = componentTypes.find((t) => t.id === comp.componentTypeId);
            return (
              <div
                key={comp.id}
                className="sb-instance-row sb-diagram-row"
                style={{ borderLeftColor: type?.color ?? "#cbd5e1" }}
                onClick={() => onSelect({ kind: "component", id: comp.id })}
              >
                <strong>{comp.name}</strong>
                <span className="muted">{type?.name ?? "Unbekannter Typ"}</span>
              </div>
            );
          })}
          {components.length === 0 && <p className="muted">Keine Komponenten vorhanden.</p>}
        </div>
      </DetailWrapper>
    );
  }

  if (selection.kind === "component") {
    const comp = components.find((c) => c.id === selection.id);
    if (!comp) return null;
    return (
      <DetailWrapper title={comp.name} onClose={onClose}>
        <ComponentEditor
          key={comp.id}
          comp={comp}
          componentTypes={componentTypes}
          connections={connections}
          connectionTypes={connectionTypes}
          components={components}
          diagrams={diagrams}
          onSelect={onSelect}
          onOpenDiagram={onOpenDiagram}
          onSave={async (patch) => {
            const updated = await sidebarApi.updateComponent(comp.id, patch);
            onStateChange({ ...sidebarState, components: components.map((c) => (c.id === comp.id ? updated : c)) });
          }}
        />
      </DetailWrapper>
    );
  }

  if (selection.kind === "connections") {
    return (
      <DetailWrapper title="Verbindungen" onClose={onClose}>
        <p className="muted">Konkrete Verbindungen zwischen Komponenten.</p>
        <div className="sb-instance-list">
          {connections.map((conn) => {
            const src = components.find((c) => c.id === conn.sourceComponentId);
            const tgt = components.find((c) => c.id === conn.targetComponentId);
            const type = connectionTypes.find((t) => t.id === conn.connectionTypeId);
            return (
              <div
                key={conn.id}
                className="sb-instance-row sb-diagram-row"
                style={{ borderLeftColor: type?.color ?? "#cbd5e1" }}
                onClick={() => onSelect({ kind: "connection", id: conn.id })}
              >
                <strong>{conn.name || `${src?.name ?? "?"} → ${tgt?.name ?? "?"}`}</strong>
                <span className="muted">{type?.name ?? "Unbekannter Typ"}</span>
              </div>
            );
          })}
          {connections.length === 0 && <p className="muted">Keine Verbindungen vorhanden.</p>}
        </div>
      </DetailWrapper>
    );
  }

  if (selection.kind === "connection") {
    const conn = connections.find((c) => c.id === selection.id);
    if (!conn) return null;
    const src = components.find((c) => c.id === conn.sourceComponentId);
    const tgt = components.find((c) => c.id === conn.targetComponentId);
    return (
      <DetailWrapper title={conn.name || `${src?.name ?? "?"} → ${tgt?.name ?? "?"}`} onClose={onClose}>
        <ConnectionEditor
          key={conn.id}
          conn={conn}
          connectionTypes={connectionTypes}
          components={components}
          diagrams={diagrams}
          onSelect={onSelect}
          onOpenDiagram={onOpenDiagram}
          onSave={async (patch) => {
            const updated = await sidebarApi.updateConnection(conn.id, patch);
            onStateChange({ ...sidebarState, connections: connections.map((c) => (c.id === conn.id ? updated : c)) });
          }}
        />
      </DetailWrapper>
    );
  }

  if (selection.kind === "diagrams") {
    return (
      <DetailWrapper title="Diagramme" onClose={onClose}>
        <p className="muted">Klicke auf ein Diagramm, um es zu öffnen.</p>
        <div className="sb-instance-list">
          {diagrams.map((d) => (
            <div key={d.id} className="sb-instance-row sb-diagram-row" onClick={() => onOpenDiagram(d.id)}>
              <strong>{d.name}</strong>
              <span className="muted">{d.componentIds.length} Komponenten · {d.connectionIds.length} Verbindungen</span>
            </div>
          ))}
          {diagrams.length === 0 && <p className="muted">Keine Diagramme vorhanden.</p>}
        </div>
      </DetailWrapper>
    );
  }

  if (selection.kind === "diagram") {
    const d = diagrams.find((x) => x.id === selection.id);
    if (!d) return null;
    return (
      <DetailWrapper title={d.name} onClose={onClose}>
        <DiagramMetaEditor
          key={d.id}
          diagram={d}
          viewpoints={viewpoints}
          onSave={async (patch) => {
            const updated = await sidebarApi.updateDiagram(d.id, patch);
            onStateChange({ ...sidebarState, diagrams: diagrams.map((x) => (x.id === d.id ? updated : x)) });
          }}
          onOpen={() => onOpenDiagram(d.id)}
        />
      </DetailWrapper>
    );
  }

  return null;
}

// ── Individuelle Key/Value-Eigenschaften (wiederverwendbar) ───────────────────

function CustomPropertiesSection({
  properties,
  reservedKeys,
  onChange
}: {
  properties: Record<string, string>;
  /** Schlüssel, die bereits über den Typ definiert sind und hier nicht doppelt auftauchen sollen. */
  reservedKeys: string[];
  onChange: (next: Record<string, string>) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const customEntries = Object.entries(properties).filter(([k]) => !reservedKeys.includes(k));

  function addProperty() {
    const key = newKey.trim();
    if (!key || key in properties || reservedKeys.includes(key)) return;
    onChange({ ...properties, [key]: newValue });
    setNewKey("");
    setNewValue("");
  }

  function removeProperty(key: string) {
    const next = { ...properties };
    delete next[key];
    onChange(next);
  }

  return (
    <>
      <h3>Individuelle Eigenschaften</h3>
      {customEntries.length === 0 && (
        <p className="muted sb-custom-hint">Noch keine eigenen Eigenschaften. Füge unten Schlüssel und Wert hinzu.</p>
      )}
      {customEntries.map(([key, value]) => (
        <div key={key} className="sb-attr-row">
          <span>{key}</span>
          <input value={value} onChange={(e) => onChange({ ...properties, [key]: e.target.value })} />
          <button className="sb-icon-btn" title="Eigenschaft entfernen" onClick={() => removeProperty(key)}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="sb-attr-row">
        <input
          placeholder="Schlüssel"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addProperty()}
        />
        <input
          placeholder="Wert"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addProperty()}
        />
        <button className="sb-add-prop-btn" title="Eigenschaft hinzufügen" onClick={addProperty} disabled={!newKey.trim()}>
          <Plus size={14} />
        </button>
      </div>
    </>
  );
}

// ── Verknüpfungs-Infos (Verbindungen / Diagramme) ─────────────────────────────

function LinkedConnections({
  compId,
  connections,
  connectionTypes,
  components,
  onSelect
}: {
  compId: string;
  connections: ConnectionInstance[];
  connectionTypes: ConnectionType[];
  components: ComponentInstance[];
  onSelect: (sel: SidebarSelection) => void;
}) {
  const related = connections.filter((c) => c.sourceComponentId === compId || c.targetComponentId === compId);

  return (
    <>
      <h3>Verbindungen <span className="sb-count-badge">{related.length}</span></h3>
      {related.length === 0 && <p className="muted sb-custom-hint">Keine Verbindungen zu anderen Komponenten.</p>}
      <div className="sb-link-list">
        {related.map((conn) => {
          const type = connectionTypes.find((t) => t.id === conn.connectionTypeId);
          const isOutgoing = conn.sourceComponentId === compId;
          const otherId = isOutgoing ? conn.targetComponentId : conn.sourceComponentId;
          const other = components.find((c) => c.id === otherId);
          return (
            <button key={conn.id} className="sb-link-row" onClick={() => onSelect({ kind: "connection", id: conn.id })}>
              <GitBranch size={13} style={{ color: type?.color ?? "#94a3b8" }} />
              <span className="sb-link-label">
                {isOutgoing ? "→" : "←"} <strong>{other?.name ?? "?"}</strong>
                <span className="muted"> · {type?.name ?? "?"}</span>
              </span>
              <ArrowRight size={12} className="sb-link-arrow" />
            </button>
          );
        })}
      </div>
    </>
  );
}

function LinkedDiagrams({
  diagrams,
  isIncluded,
  onOpenDiagram
}: {
  diagrams: Diagram[];
  isIncluded: (d: Diagram) => boolean;
  onOpenDiagram: (id: string) => void;
}) {
  const included = diagrams.filter(isIncluded);

  return (
    <>
      <h3>In Diagrammen <span className="sb-count-badge">{included.length}</span></h3>
      {included.length === 0 && <p className="muted sb-custom-hint">In keinem Diagramm enthalten.</p>}
      <div className="sb-link-list">
        {included.map((d) => (
          <button key={d.id} className="sb-link-row" onClick={() => onOpenDiagram(d.id)} title="Diagramm öffnen">
            <LayoutDashboard size={13} />
            <span className="sb-link-label"><strong>{d.name}</strong></span>
            <ArrowRight size={12} className="sb-link-arrow" />
          </button>
        ))}
      </div>
    </>
  );
}

// ── ComponentTypeEditor ───────────────────────────────────────────────────────

function ComponentTypeEditor({
  ct,
  viewpoints,
  existingCategories,
  onSave
}: {
  ct: ComponentType;
  viewpoints: Viewpoint[];
  existingCategories: string[];
  onSave: (p: Partial<ComponentType>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(ct);
  const [newKey, setNewKey] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(ct);

  function set<K extends keyof ComponentType>(key: K, val: ComponentType[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  function addKey() {
    if (!newKey.trim() || draft.customPropertyKeys.includes(newKey.trim())) return;
    set("customPropertyKeys", [...draft.customPropertyKeys, newKey.trim()]);
    setNewKey("");
  }

  function removeKey(k: string) {
    set("customPropertyKeys", draft.customPropertyKeys.filter((x) => x !== k));
  }

  function toggleViewpoint(id: string) {
    const list = draft.allowedInViewpointIds ?? [];
    set("allowedInViewpointIds", list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <div className="sb-form">
      <label>Name<input value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label>Layer
        <input value={draft.layer ?? ""} placeholder="Business, Application, Data, Technology" onChange={(e) => set("layer", e.target.value)} />
      </label>
      <label>Kategorie <span className="muted">(Unterordner in der Sidebar)</span>
        <input
          value={draft.category ?? ""}
          placeholder="Standard"
          list="sb-type-categories"
          onChange={(e) => set("category", e.target.value)}
        />
        <datalist id="sb-type-categories">
          {existingCategories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </label>
      <label>Beschreibung<textarea value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>
      <div className="sb-two-col">
        <label>Farbe<input type="color" value={draft.color} onChange={(e) => set("color", e.target.value)} /></label>
        <label>Form im Diagramm
          <select value={draft.shape ?? "box"} onChange={(e) => set("shape", e.target.value as ComponentShape)}>
            {COMPONENT_SHAPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="sb-shape-preview-row">
        <span className={`shape-glyph shape-glyph--lg shape-glyph--${draft.shape ?? "box"}`} style={{ borderColor: draft.color }} />
        <span className="muted">So wird der Typ im Diagramm dargestellt.</span>
      </div>
      <h3>Eigenschafts-Schlüssel für diesen Typ</h3>
      <h3>Viewpoint-Zuordnung <span className="muted">(leer = alle)</span></h3>
      <label className="sb-check-row">
        <input type="checkbox" checked={Boolean(draft.isRequiredInViewpoint)} onChange={(e) => set("isRequiredInViewpoint", e.target.checked)} />
        Typ ist in passenden Viewpoints als Pflichtregel markierbar
      </label>
      <div className="sb-check-list">
        {viewpoints.map((vp) => (
          <label key={vp.id} className="sb-check-row">
            <input type="checkbox" checked={(draft.allowedInViewpointIds ?? []).includes(vp.id)} onChange={() => toggleViewpoint(vp.id)} />
            {vp.name}
          </label>
        ))}
      </div>
      <p className="muted sb-custom-hint">Diese Felder bekommt jede Komponente dieses Typs automatisch.</p>
      {draft.customPropertyKeys.map((k) => (
        <div key={k} className="sb-attr-row">
          <span>{k}</span>
          <button className="sb-icon-btn" onClick={() => removeKey(k)}><Trash2 size={13} /></button>
        </div>
      ))}
      <div className="sb-attr-row">
        <input placeholder="Neuer Schlüssel" value={newKey} onChange={(e) => setNewKey(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addKey()} />
        <button onClick={addKey}>Hinzufügen</button>
      </div>
      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>
    </div>
  );
}

// ── ConnectionTypeEditor ──────────────────────────────────────────────────────

function ConnectionTypeEditor({
  ct,
  componentTypes,
  viewpoints,
  existingCategories,
  onSave
}: {
  ct: ConnectionType;
  componentTypes: ComponentType[];
  viewpoints: Viewpoint[];
  existingCategories: string[];
  onSave: (p: Partial<ConnectionType>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(ct);
  const dirty = JSON.stringify(draft) !== JSON.stringify(ct);

  function set<K extends keyof ConnectionType>(key: K, val: ConnectionType[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  function toggleList(key: "allowedSourceTypeIds" | "allowedTargetTypeIds" | "requiredForSourceTypes" | "requiredForTargetTypes", id: string) {
    const list = draft[key];
    const safeList = list ?? [];
    set(key, safeList.includes(id) ? safeList.filter((x) => x !== id) : [...safeList, id]);
  }

  return (
    <div className="sb-form">
      <label>Name<input value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
      <p className="muted sb-custom-hint">Allowed source/target combinations are managed via Connection Rules. The fields below are legacy compatibility fields.</p>
      <label>Kategorie <span className="muted">(Unterordner in der Sidebar)</span>
        <input
          value={draft.category ?? ""}
          placeholder="Standard"
          list="sb-conn-type-categories"
          onChange={(e) => set("category", e.target.value)}
        />
        <datalist id="sb-conn-type-categories">
          {existingCategories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </label>
      <label>Beschreibung<textarea value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>
      <div className="sb-two-col">
        <label>Farbe<input type="color" value={draft.color} onChange={(e) => set("color", e.target.value)} /></label>
        <label>Linienstil
          <select value={draft.lineStyle} onChange={(e) => set("lineStyle", e.target.value as ConnectionType["lineStyle"])}>
            <option value="solid">Durchgezogen</option>
            <option value="dashed">Gestrichelt</option>
            <option value="dotted">Gepunktet</option>
          </select>
        </label>
      </div>
      <label>Richtung / Bedeutung
        <input value={draft.directionDescription ?? ""} onChange={(e) => set("directionDescription", e.target.value)} placeholder="z. B. Application to business process" />
      </label>
      <h3>Erlaubte Quell-Typen <span className="muted">(leer = alle)</span></h3>
      <div className="sb-check-list">
        {componentTypes.map((t) => (
          <label key={t.id} className="sb-check-row">
            <input type="checkbox" checked={draft.allowedSourceTypeIds.includes(t.id)} onChange={() => toggleList("allowedSourceTypeIds", t.id)} />
            <span className="sb-color-dot" style={{ background: t.color }} />
            {t.name}
          </label>
        ))}
      </div>
      <h3>Erlaubte Ziel-Typen <span className="muted">(leer = alle)</span></h3>
      <div className="sb-check-list">
        {componentTypes.map((t) => (
          <label key={t.id} className="sb-check-row">
            <input type="checkbox" checked={draft.allowedTargetTypeIds.includes(t.id)} onChange={() => toggleList("allowedTargetTypeIds", t.id)} />
            <span className="sb-color-dot" style={{ background: t.color }} />
            {t.name}
          </label>
        ))}
      </div>
      <h3>Pflichtregeln fuer Quellen</h3>
      <p className="muted sb-custom-hint">Wenn ein Diagramm einen dieser Quelltypen enthaelt, kann diese Verbindung als Pflichtregel geprueft werden.</p>
      <div className="sb-check-list">
        {componentTypes.map((t) => (
          <label key={t.id} className="sb-check-row">
            <input type="checkbox" checked={(draft.requiredForSourceTypes ?? []).includes(t.id)} onChange={() => toggleList("requiredForSourceTypes", t.id)} />
            <span className="sb-color-dot" style={{ background: t.color }} />
            {t.name}
          </label>
        ))}
      </div>
      <h3>Pflichtregeln fuer Ziele</h3>
      <div className="sb-check-list">
        {componentTypes.map((t) => (
          <label key={t.id} className="sb-check-row">
            <input type="checkbox" checked={(draft.requiredForTargetTypes ?? []).includes(t.id)} onChange={() => toggleList("requiredForTargetTypes", t.id)} />
            <span className="sb-color-dot" style={{ background: t.color }} />
            {t.name}
          </label>
        ))}
      </div>
      {viewpoints.length > 0 && (
        <p className="muted sb-custom-hint">Viewpoint-Zuordnung wird im Viewpoint-Editor gepflegt.</p>
      )}
      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>
    </div>
  );
}

// ── ComponentEditor ───────────────────────────────────────────────────────────

function ConnectionRuleEditor({
  rule,
  componentTypes,
  connectionTypes,
  viewpoints,
  onSave
}: {
  rule: ConnectionRule;
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  viewpoints: Viewpoint[];
  onSave: (p: Partial<ConnectionRule>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(rule);
  const dirty = JSON.stringify(draft) !== JSON.stringify(rule);

  function set<K extends keyof ConnectionRule>(key: K, val: ConnectionRule[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  function toggleViewpoint(id: string) {
    const list = draft.viewpointIds ?? [];
    set("viewpointIds", list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  return (
    <div className="sb-form">
      <label>Source Component Type
        <select value={draft.sourceComponentTypeId} onChange={(e) => set("sourceComponentTypeId", e.target.value)}>
          {componentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
      </label>
      <label>Connection Type
        <select value={draft.connectionTypeId} onChange={(e) => set("connectionTypeId", e.target.value)}>
          {connectionTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
      </label>
      <label>Target Component Type
        <select value={draft.targetComponentTypeId} onChange={(e) => set("targetComponentTypeId", e.target.value)}>
          {componentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
      </label>
      <div className="sb-two-col">
        <label className="sb-check-row">
          <input type="checkbox" checked={draft.allowed} onChange={(e) => set("allowed", e.target.checked)} />
          allowed
        </label>
        <label className="sb-check-row">
          <input type="checkbox" checked={draft.required} onChange={(e) => set("required", e.target.checked)} />
          required
        </label>
      </div>
      <label>Severity
        <select value={draft.severity} onChange={(e) => set("severity", e.target.value as ConnectionRule["severity"])}>
          <option value="error">error</option>
          <option value="warning">warning</option>
        </select>
      </label>
      <div className="sb-two-col">
        <label>Min occurrences<input type="number" min={0} value={draft.minOccurrences ?? ""} onChange={(e) => set("minOccurrences", e.target.value === "" ? undefined : Number(e.target.value))} /></label>
        <label>Max occurrences<input type="number" min={0} value={draft.maxOccurrences ?? ""} onChange={(e) => set("maxOccurrences", e.target.value === "" ? undefined : Number(e.target.value))} /></label>
      </div>
      <label>Description<textarea value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>
      <label>Rationale<textarea value={draft.rationale} onChange={(e) => set("rationale", e.target.value)} /></label>
      <h3>Viewpoints <span className="muted">(leer = alle)</span></h3>
      <div className="sb-check-list">
        {viewpoints.map((viewpoint) => (
          <label key={viewpoint.id} className="sb-check-row">
            <input type="checkbox" checked={(draft.viewpointIds ?? []).includes(viewpoint.id)} onChange={() => toggleViewpoint(viewpoint.id)} />
            {viewpoint.name}
          </label>
        ))}
      </div>
      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>
    </div>
  );
}

function ViewpointEditor({
  viewpoint,
  componentTypes,
  connectionTypes,
  onSave
}: {
  viewpoint: Viewpoint;
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  onSave: (p: Partial<Viewpoint>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(viewpoint);
  const dirty = JSON.stringify(draft) !== JSON.stringify(viewpoint);

  function set<K extends keyof Viewpoint>(key: K, val: Viewpoint[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  function toggleList(
    key: "allowedComponentTypeIds" | "allowedConnectionTypeIds" | "requiredComponentTypeIds" | "requiredConnectionTypeIds",
    id: string
  ) {
    const list = draft[key];
    set(key, list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <div className="sb-form">
      <label>Name<input value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label>Stakeholder-Rolle<input value={draft.stakeholderRole} onChange={(e) => set("stakeholderRole", e.target.value)} /></label>
      <label>Zweck<textarea value={draft.purpose} onChange={(e) => set("purpose", e.target.value)} /></label>
      <label>Beschreibung<textarea value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>
      <label>Maximal sichtbare Layer
        <input
          type="number"
          min={1}
          value={draft.maxVisibleLayers ?? ""}
          onChange={(e) => set("maxVisibleLayers", e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </label>
      <h3>Erlaubte Component Types</h3>
      <div className="sb-check-list">
        {componentTypes.map((type) => (
          <label key={type.id} className="sb-check-row">
            <input type="checkbox" checked={draft.allowedComponentTypeIds.includes(type.id)} onChange={() => toggleList("allowedComponentTypeIds", type.id)} />
            <span className="sb-color-dot" style={{ background: type.color }} />
            {type.name}
          </label>
        ))}
      </div>
      <h3>Pflicht-Component Types</h3>
      <div className="sb-check-list">
        {componentTypes.map((type) => (
          <label key={type.id} className="sb-check-row">
            <input type="checkbox" checked={draft.requiredComponentTypeIds.includes(type.id)} onChange={() => toggleList("requiredComponentTypeIds", type.id)} />
            <span className="sb-color-dot" style={{ background: type.color }} />
            {type.name}
          </label>
        ))}
      </div>
      <h3>Erlaubte Connection Types</h3>
      <div className="sb-check-list">
        {connectionTypes.map((type) => (
          <label key={type.id} className="sb-check-row">
            <input type="checkbox" checked={draft.allowedConnectionTypeIds.includes(type.id)} onChange={() => toggleList("allowedConnectionTypeIds", type.id)} />
            <span className="sb-color-dot" style={{ background: type.color }} />
            {type.name}
          </label>
        ))}
      </div>
      <h3>Pflicht-Connection Types</h3>
      <div className="sb-check-list">
        {connectionTypes.map((type) => (
          <label key={type.id} className="sb-check-row">
            <input type="checkbox" checked={draft.requiredConnectionTypeIds.includes(type.id)} onChange={() => toggleList("requiredConnectionTypeIds", type.id)} />
            <span className="sb-color-dot" style={{ background: type.color }} />
            {type.name}
          </label>
        ))}
      </div>
      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>
    </div>
  );
}

function ComponentEditor({
  comp,
  componentTypes,
  connections,
  connectionTypes,
  components,
  diagrams,
  onSelect,
  onOpenDiagram,
  onSave
}: {
  comp: ComponentInstance;
  componentTypes: ComponentType[];
  connections: ConnectionInstance[];
  connectionTypes: ConnectionType[];
  components: ComponentInstance[];
  diagrams: Diagram[];
  onSelect: (sel: SidebarSelection) => void;
  onOpenDiagram: (id: string) => void;
  onSave: (p: Partial<ComponentInstance>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(comp);
  const dirty = JSON.stringify(draft) !== JSON.stringify(comp);

  function set<K extends keyof ComponentInstance>(key: K, val: ComponentInstance[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  const selectedType = componentTypes.find((t) => t.id === draft.componentTypeId);
  const typeKeys = selectedType?.customPropertyKeys ?? [];

  return (
    <div className="sb-form">
      <label>Name<input value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label>Typ
        <select value={draft.componentTypeId} onChange={(e) => set("componentTypeId", e.target.value)}>
          {componentTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label>Beschreibung<textarea value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>

      {typeKeys.length > 0 && (
        <>
          <h3>Typ-Eigenschaften <span className="muted">({selectedType?.name})</span></h3>
          {typeKeys.map((k) => (
            <label key={k}>{k}
              <input value={draft.properties[k] ?? ""} onChange={(e) => set("properties", { ...draft.properties, [k]: e.target.value })} />
            </label>
          ))}
        </>
      )}

      <CustomPropertiesSection
        properties={draft.properties}
        reservedKeys={typeKeys}
        onChange={(next) => set("properties", next)}
      />

      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>

      <LinkedConnections
        compId={comp.id}
        connections={connections}
        connectionTypes={connectionTypes}
        components={components}
        onSelect={onSelect}
      />

      <LinkedDiagrams
        diagrams={diagrams}
        isIncluded={(d) => d.componentIds.includes(comp.id)}
        onOpenDiagram={onOpenDiagram}
      />
    </div>
  );
}

// ── ConnectionEditor ──────────────────────────────────────────────────────────

function ConnectionEditor({
  conn,
  connectionTypes,
  components,
  diagrams,
  onSelect,
  onOpenDiagram,
  onSave
}: {
  conn: ConnectionInstance;
  connectionTypes: ConnectionType[];
  components: ComponentInstance[];
  diagrams: Diagram[];
  onSelect: (sel: SidebarSelection) => void;
  onOpenDiagram: (id: string) => void;
  onSave: (p: Partial<ConnectionInstance>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ConnectionInstance>({ ...conn, properties: conn.properties ?? {} });
  const dirty = JSON.stringify(draft) !== JSON.stringify({ ...conn, properties: conn.properties ?? {} });

  function set<K extends keyof ConnectionInstance>(key: K, val: ConnectionInstance[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div className="sb-form">
      <label>Name (optional)<input value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label>Verbindungs-Typ
        <select value={draft.connectionTypeId} onChange={(e) => set("connectionTypeId", e.target.value)}>
          {connectionTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label>Quelle
        <div className="sb-endpoint-row">
          <select value={draft.sourceComponentId} onChange={(e) => set("sourceComponentId", e.target.value)}>
            {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            className="sb-jump-btn"
            title="Zur Quell-Komponente springen"
            onClick={() => onSelect({ kind: "component", id: draft.sourceComponentId })}
          >
            <ArrowRight size={13} />
          </button>
        </div>
      </label>
      <label>Ziel
        <div className="sb-endpoint-row">
          <select value={draft.targetComponentId} onChange={(e) => set("targetComponentId", e.target.value)}>
            {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            className="sb-jump-btn"
            title="Zur Ziel-Komponente springen"
            onClick={() => onSelect({ kind: "component", id: draft.targetComponentId })}
          >
            <ArrowRight size={13} />
          </button>
        </div>
      </label>
      <label>Beschreibung<textarea value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>

      <CustomPropertiesSection
        properties={draft.properties ?? {}}
        reservedKeys={[]}
        onChange={(next) => set("properties", next)}
      />

      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>

      <LinkedDiagrams
        diagrams={diagrams}
        isIncluded={(d) => d.connectionIds.includes(conn.id)}
        onOpenDiagram={onOpenDiagram}
      />
    </div>
  );
}

// ── DiagramMetaEditor ─────────────────────────────────────────────────────────

function DiagramMetaEditor({
  diagram,
  viewpoints,
  onSave,
  onOpen
}: {
  diagram: Diagram;
  viewpoints: Viewpoint[];
  onSave: (p: Partial<Diagram>) => Promise<void>;
  onOpen: () => void;
}) {
  const [draft, setDraft] = useState(diagram);
  const dirty = JSON.stringify(draft) !== JSON.stringify(diagram);

  return (
    <div className="sb-form">
      <label>Name<input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} /></label>
      <label>Viewpoint
        <select value={draft.viewpointId ?? ""} onChange={(e) => setDraft((p) => ({ ...p, viewpointId: e.target.value || undefined }))}>
          <option value="">Kein Viewpoint</option>
          {viewpoints.map((vp) => <option key={vp.id} value={vp.id}>{vp.name}</option>)}
        </select>
      </label>
      <label>Beschreibung<textarea value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} /></label>
      <p className="muted">{diagram.componentIds.length} Komponenten · {diagram.connectionIds.length} Verbindungen</p>
      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>
      <button className="sb-open-btn" onClick={onOpen}>Diagramm öffnen →</button>
    </div>
  );
}
