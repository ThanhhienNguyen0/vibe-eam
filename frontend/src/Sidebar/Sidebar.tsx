import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  GitBranch,
  GitMerge,
  Layers,
  LayoutDashboard,
  Plus,
  Server,
  Settings2,
  Trash2
} from "lucide-react";
import { sidebarApi } from "./sidebarApi";
import type {
  ComponentInstance,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram,
  SidebarState
} from "./sidebarTypes";

export type SidebarSelection =
  | { kind: "componentTypes" }
  | { kind: "componentType"; id: string }
  | { kind: "connectionTypes" }
  | { kind: "connectionType"; id: string }
  | { kind: "components" }
  | { kind: "component"; id: string }
  | { kind: "connections" }
  | { kind: "connection"; id: string }
  | { kind: "diagrams" }
  | { kind: "diagram"; id: string };

interface Props {
  onSelect: (sel: SidebarSelection) => void;
  selection: SidebarSelection | null;
  sidebarState: SidebarState;
  onStateChange: (next: SidebarState) => void;
}

function iconForType(icon: string) {
  if (icon === "server") return <Server size={13} />;
  if (icon === "db") return <Database size={13} />;
  if (icon === "proc") return <GitMerge size={13} />;
  if (icon === "svc") return <Layers size={13} />;
  return <LayoutDashboard size={13} />;
}

interface FolderProps {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addTitle?: string;
  active?: boolean;
  children?: React.ReactNode;
}

function Folder({ label, icon, open, onToggle, onAdd, addTitle, active, children }: FolderProps) {
  return (
    <div className="sb-folder">
      <div
        className={`sb-folder-header${active ? " sb-active" : ""}`}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <span className="sb-chevron">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span className="sb-folder-icon">{icon}</span>
        <span className="sb-folder-label">{label}</span>
        {onAdd && (
          <button
            className="sb-add-btn"
            title={addTitle ?? "Hinzufügen"}
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
      {open && <div className="sb-folder-children">{children}</div>}
    </div>
  );
}

interface RowProps {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}

function Row({ label, icon, color, active, onClick, onDelete }: RowProps) {
  return (
    <div className={`sb-row${active ? " sb-active" : ""}`} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onClick()}>
      {color && <span className="sb-color-dot" style={{ background: color }} />}
      {!color && icon && <span className="sb-row-icon">{icon}</span>}
      <span className="sb-row-label">{label}</span>
      {onDelete && (
        <button
          className="sb-delete-btn"
          title="Löschen"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

export default function Sidebar({ onSelect, selection, sidebarState, onStateChange }: Props) {
  const { componentTypes, connectionTypes, components, connections, diagrams } = sidebarState;

  const [open, setOpen] = useState({
    rules: true,
    componentTypes: true,
    connectionTypes: false,
    mgmt: true,
    components: true,
    connections: false,
    diagrams: true
  });

  const [openTypeGroups, setOpenTypeGroups] = useState<Record<string, boolean>>({});
  const isTypeGroupOpen = (typeId: string) => openTypeGroups[typeId] ?? true;
  function toggleTypeGroup(typeId: string) {
    setOpenTypeGroups((p) => ({ ...p, [typeId]: !isTypeGroupOpen(typeId) }));
  }

  const toggle = useCallback((key: keyof typeof open) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const isActive = useCallback(
    (sel: SidebarSelection) => JSON.stringify(selection) === JSON.stringify(sel),
    [selection]
  );

  // ── Quick-add helpers ─────────────────────────────────────────────────────

  async function addComponentType() {
    const ct = await sidebarApi.createComponentType({
      name: "Neuer Typ",
      color: "#475569",
      icon: "box",
      description: "",
      customPropertyKeys: []
    });
    onStateChange({ ...sidebarState, componentTypes: [...componentTypes, ct] });
    onSelect({ kind: "componentType", id: ct.id });
  }

  async function addConnectionType() {
    const ct = await sidebarApi.createConnectionType({
      name: "Neuer Verbindungstyp",
      color: "#475569",
      lineStyle: "solid",
      allowedSourceTypeIds: [],
      allowedTargetTypeIds: [],
      description: ""
    });
    onStateChange({ ...sidebarState, connectionTypes: [...connectionTypes, ct] });
    onSelect({ kind: "connectionType", id: ct.id });
  }

  async function addComponent() {
    if (componentTypes.length === 0) return;
    const comp = await sidebarApi.createComponent({
      name: "Neue Komponente",
      componentTypeId: componentTypes[0].id,
      properties: {},
      description: ""
    });
    onStateChange({ ...sidebarState, components: [...components, comp] });
    onSelect({ kind: "component", id: comp.id });
  }

  async function addConnection() {
    if (components.length < 2 || connectionTypes.length === 0) return;
    const conn = await sidebarApi.createConnection({
      name: "",
      connectionTypeId: connectionTypes[0].id,
      sourceComponentId: components[0].id,
      targetComponentId: components[1].id,
      description: ""
    });
    onStateChange({ ...sidebarState, connections: [...connections, conn] });
    onSelect({ kind: "connection", id: conn.id });
  }

  async function addDiagram() {
    const d = await sidebarApi.createDiagram({ name: "Neues Diagramm", description: "" });
    onStateChange({ ...sidebarState, diagrams: [...diagrams, d] });
    onSelect({ kind: "diagram", id: d.id });
  }

  // ── Delete helpers ────────────────────────────────────────────────────────

  async function deleteComponentType(id: string) {
    await sidebarApi.deleteComponentType(id);
    onStateChange({ ...sidebarState, componentTypes: componentTypes.filter((c) => c.id !== id) });
  }

  async function deleteConnectionType(id: string) {
    await sidebarApi.deleteConnectionType(id);
    onStateChange({ ...sidebarState, connectionTypes: connectionTypes.filter((c) => c.id !== id) });
  }

  async function deleteComponent(id: string) {
    await sidebarApi.deleteComponent(id);
    onStateChange({
      ...sidebarState,
      components: components.filter((c) => c.id !== id),
      connections: connections.filter((c) => c.sourceComponentId !== id && c.targetComponentId !== id)
    });
  }

  async function deleteConnection(id: string) {
    await sidebarApi.deleteConnection(id);
    onStateChange({ ...sidebarState, connections: connections.filter((c) => c.id !== id) });
  }

  async function deleteDiagram(id: string) {
    await sidebarApi.deleteDiagram(id);
    onStateChange({ ...sidebarState, diagrams: diagrams.filter((d) => d.id !== id) });
  }

  return (
    <nav className="sidebar" aria-label="Architektur-Navigation">
      {/* ── Section 1: Architekturregeln ─────────────────────────────────── */}
      <div className="sb-section-header">
        <Settings2 size={14} />
        <span>Architekturregeln</span>
      </div>

      <Folder
        label="Komponenten-Typen"
        icon={<LayoutDashboard size={14} />}
        open={open.componentTypes}
        onToggle={() => toggle("componentTypes")}
        onAdd={addComponentType}
        addTitle="+ Neuer Komponenten-Typ"
        active={isActive({ kind: "componentTypes" })}
      >
        {componentTypes.map((ct) => (
          <Row
            key={ct.id}
            label={ct.name}
            color={ct.color}
            active={isActive({ kind: "componentType", id: ct.id })}
            onClick={() => onSelect({ kind: "componentType", id: ct.id })}
            onDelete={() => deleteComponentType(ct.id)}
          />
        ))}
        {componentTypes.length === 0 && (
          <p className="sb-empty">Keine Typen definiert.</p>
        )}
      </Folder>

      <Folder
        label="Verbindungs-Typen"
        icon={<GitBranch size={14} />}
        open={open.connectionTypes}
        onToggle={() => toggle("connectionTypes")}
        onAdd={addConnectionType}
        addTitle="+ Neuer Verbindungs-Typ"
        active={isActive({ kind: "connectionTypes" })}
      >
        {connectionTypes.map((ct) => (
          <Row
            key={ct.id}
            label={ct.name}
            color={ct.color}
            active={isActive({ kind: "connectionType", id: ct.id })}
            onClick={() => onSelect({ kind: "connectionType", id: ct.id })}
            onDelete={() => deleteConnectionType(ct.id)}
          />
        ))}
        {connectionTypes.length === 0 && (
          <p className="sb-empty">Keine Typen definiert.</p>
        )}
      </Folder>

      {/* ── Section 2: Architekturverwaltung ─────────────────────────────── */}
      <div className="sb-section-header sb-section-header--mgmt">
        <Layers size={14} />
        <span>Architekturverwaltung</span>
      </div>

      <Folder
        label="Komponenten"
        icon={<Server size={14} />}
        open={open.components}
        onToggle={() => toggle("components")}
        onAdd={addComponent}
        addTitle="+ Neue Komponente"
        active={isActive({ kind: "components" })}
      >
        {(() => {
          const usedTypeIds = [...new Set(components.map((c) => c.componentTypeId))];
          const groups = componentTypes
            .filter((ct) => usedTypeIds.includes(ct.id))
            .map((ct) => ({ type: ct, items: components.filter((c) => c.componentTypeId === ct.id) }));
          const ungrouped = components.filter((c) => !componentTypes.find((t) => t.id === c.componentTypeId));

          return (
            <>
              {groups.map(({ type, items }) => (
                <div key={type.id} className="sb-type-group">
                  <div
                    className="sb-type-group-header"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleTypeGroup(type.id)}
                    onKeyDown={(e) => e.key === "Enter" && toggleTypeGroup(type.id)}
                  >
                    <span className="sb-chevron">
                      {isTypeGroupOpen(type.id) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </span>
                    <span className="sb-color-dot" style={{ background: type.color }} />
                    <span className="sb-type-group-label">{type.name}</span>
                    <span className="sb-type-group-count">{items.length}</span>
                  </div>
                  {isTypeGroupOpen(type.id) && (
                    <div className="sb-type-group-children">
                      {items.map((comp) => (
                        <Row
                          key={comp.id}
                          label={comp.name}
                          active={isActive({ kind: "component", id: comp.id })}
                          onClick={() => onSelect({ kind: "component", id: comp.id })}
                          onDelete={() => deleteComponent(comp.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {ungrouped.map((comp) => (
                <Row
                  key={comp.id}
                  label={comp.name}
                  active={isActive({ kind: "component", id: comp.id })}
                  onClick={() => onSelect({ kind: "component", id: comp.id })}
                  onDelete={() => deleteComponent(comp.id)}
                />
              ))}
              {components.length === 0 && <p className="sb-empty">Keine Komponenten.</p>}
            </>
          );
        })()}
      </Folder>

      <Folder
        label="Verbindungen"
        icon={<GitBranch size={14} />}
        open={open.connections}
        onToggle={() => toggle("connections")}
        onAdd={addConnection}
        addTitle="+ Neue Verbindung"
        active={isActive({ kind: "connections" })}
      >
        {connections.map((conn) => {
          const src = components.find((c) => c.id === conn.sourceComponentId);
          const tgt = components.find((c) => c.id === conn.targetComponentId);
          const type = connectionTypes.find((t) => t.id === conn.connectionTypeId);
          const label = conn.name || `${src?.name ?? "?"} → ${tgt?.name ?? "?"}`;
          return (
            <Row
              key={conn.id}
              label={label}
              color={type?.color}
              active={isActive({ kind: "connection", id: conn.id })}
              onClick={() => onSelect({ kind: "connection", id: conn.id })}
              onDelete={() => deleteConnection(conn.id)}
            />
          );
        })}
        {connections.length === 0 && (
          <p className="sb-empty">Keine Verbindungen.</p>
        )}
      </Folder>

      <Folder
        label="Diagramme"
        icon={<LayoutDashboard size={14} />}
        open={open.diagrams}
        onToggle={() => toggle("diagrams")}
        onAdd={addDiagram}
        addTitle="+ Neues Diagramm"
        active={isActive({ kind: "diagrams" })}
      >
        {diagrams.map((d) => (
          <Row
            key={d.id}
            label={d.name}
            active={isActive({ kind: "diagram", id: d.id })}
            onClick={() => onSelect({ kind: "diagram", id: d.id })}
            onDelete={() => deleteDiagram(d.id)}
          />
        ))}
        {diagrams.length === 0 && (
          <p className="sb-empty">Keine Diagramme.</p>
        )}
      </Folder>
    </nav>
  );
}
