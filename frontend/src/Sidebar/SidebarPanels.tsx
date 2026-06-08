import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { sidebarApi } from "./sidebarApi";
import type { SidebarSelection } from "./Sidebar";
import type {
  ComponentInstance,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram,
  SidebarState
} from "./sidebarTypes";

interface Props {
  selection: SidebarSelection | null;
  sidebarState: SidebarState;
  onStateChange: (next: SidebarState) => void;
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

export default function SidebarPanels({ selection, sidebarState, onStateChange, onOpenDiagram, onClose }: Props) {
  if (!selection) return null;

  const { componentTypes, connectionTypes, components, connections, diagrams } = sidebarState;

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
          onSave={async (patch) => {
            const updated = await sidebarApi.updateConnectionType(ct.id, patch);
            onStateChange({ ...sidebarState, connectionTypes: connectionTypes.map((c) => (c.id === ct.id ? updated : c)) });
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
              <div key={comp.id} className="sb-instance-row" style={{ borderLeftColor: type?.color ?? "#cbd5e1" }}>
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
              <div key={conn.id} className="sb-instance-row" style={{ borderLeftColor: type?.color ?? "#cbd5e1" }}>
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
    return (
      <DetailWrapper title={conn.name || "Verbindung"} onClose={onClose}>
        <ConnectionEditor
          key={conn.id}
          conn={conn}
          connectionTypes={connectionTypes}
          components={components}
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

// ── ComponentTypeEditor ───────────────────────────────────────────────────────

function ComponentTypeEditor({ ct, onSave }: { ct: ComponentType; onSave: (p: Partial<ComponentType>) => Promise<void> }) {
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

  return (
    <div className="sb-form">
      <label>Name<input value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label>Beschreibung<textarea value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>
      <div className="sb-two-col">
        <label>Farbe<input type="color" value={draft.color} onChange={(e) => set("color", e.target.value)} /></label>
        <label>Icon
          <select value={draft.icon} onChange={(e) => set("icon", e.target.value)}>
            {["app", "server", "db", "proc", "svc", "box"].map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </label>
      </div>
      <h3>Benutzerdefinierte Eigenschaften</h3>
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
  onSave
}: {
  ct: ConnectionType;
  componentTypes: ComponentType[];
  onSave: (p: Partial<ConnectionType>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(ct);
  const dirty = JSON.stringify(draft) !== JSON.stringify(ct);

  function set<K extends keyof ConnectionType>(key: K, val: ConnectionType[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  function toggleList(key: "allowedSourceTypeIds" | "allowedTargetTypeIds", id: string) {
    const list = draft[key];
    set(key, list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <div className="sb-form">
      <label>Name<input value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
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
      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>
    </div>
  );
}

// ── ComponentEditor ───────────────────────────────────────────────────────────

function ComponentEditor({
  comp,
  componentTypes,
  onSave
}: {
  comp: ComponentInstance;
  componentTypes: ComponentType[];
  onSave: (p: Partial<ComponentInstance>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(comp);
  const dirty = JSON.stringify(draft) !== JSON.stringify(comp);

  function set<K extends keyof ComponentInstance>(key: K, val: ComponentInstance[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  const selectedType = componentTypes.find((t) => t.id === draft.componentTypeId);

  return (
    <div className="sb-form">
      <label>Name<input value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label>Typ
        <select value={draft.componentTypeId} onChange={(e) => set("componentTypeId", e.target.value)}>
          {componentTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label>Beschreibung<textarea value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>
      {selectedType && selectedType.customPropertyKeys.length > 0 && (
        <>
          <h3>Eigenschaften</h3>
          {selectedType.customPropertyKeys.map((k) => (
            <label key={k}>{k}
              <input value={draft.properties[k] ?? ""} onChange={(e) => set("properties", { ...draft.properties, [k]: e.target.value })} />
            </label>
          ))}
        </>
      )}
      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>
    </div>
  );
}

// ── ConnectionEditor ──────────────────────────────────────────────────────────

function ConnectionEditor({
  conn,
  connectionTypes,
  components,
  onSave
}: {
  conn: ConnectionInstance;
  connectionTypes: ConnectionType[];
  components: ComponentInstance[];
  onSave: (p: Partial<ConnectionInstance>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(conn);
  const dirty = JSON.stringify(draft) !== JSON.stringify(conn);

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
        <select value={draft.sourceComponentId} onChange={(e) => set("sourceComponentId", e.target.value)}>
          {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>Ziel
        <select value={draft.targetComponentId} onChange={(e) => set("targetComponentId", e.target.value)}>
          {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>Beschreibung<textarea value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>
      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>
    </div>
  );
}

// ── DiagramMetaEditor ─────────────────────────────────────────────────────────

function DiagramMetaEditor({
  diagram,
  onSave,
  onOpen
}: {
  diagram: Diagram;
  onSave: (p: Partial<Diagram>) => Promise<void>;
  onOpen: () => void;
}) {
  const [draft, setDraft] = useState(diagram);
  const dirty = JSON.stringify(draft) !== JSON.stringify(diagram);

  return (
    <div className="sb-form">
      <label>Name<input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} /></label>
      <label>Beschreibung<textarea value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} /></label>
      <p className="muted">{diagram.componentIds.length} Komponenten · {diagram.connectionIds.length} Verbindungen</p>
      <button className="sb-save-btn" disabled={!dirty} onClick={() => onSave(draft)}>Speichern</button>
      <button className="sb-open-btn" onClick={onOpen}>Diagramm öffnen →</button>
    </div>
  );
}
