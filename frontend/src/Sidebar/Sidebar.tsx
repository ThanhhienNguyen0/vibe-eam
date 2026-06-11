import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Layers,
  LayoutDashboard,
  Pencil,
  Plus,
  Search,
  Server,
  Settings2,
  Trash2,
  X
} from "lucide-react";
import { sidebarApi } from "./sidebarApi";
import { COMPONENT_DRAG_MIME } from "./sidebarTypes";
import type { SidebarState } from "./sidebarTypes";

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

type ItemKind = "componentType" | "connectionType" | "component" | "connection" | "diagram";

interface Props {
  onSelect: (sel: SidebarSelection) => void;
  selection: SidebarSelection | null;
  sidebarState: SidebarState;
  onStateChange: (next: SidebarState) => void;
  onOpenDiagram: (id: string) => void;
}

interface TreeContextMenu {
  x: number;
  y: number;
  kind: ItemKind;
  id: string;
  label: string;
}

interface FolderProps {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  addTitle?: string;
  active?: boolean;
  count?: number;
  children?: React.ReactNode;
}

function Folder({ label, icon, open, onToggle, onAdd, addTitle, active, count, children }: FolderProps) {
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
        {typeof count === "number" && count > 0 && <span className="sb-folder-count">{count}</span>}
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
  onDoubleClick?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
  openTitle?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  dragHint?: string;
  renaming?: boolean;
  onRenameSubmit?: (name: string) => void;
  onRenameCancel?: () => void;
}

function Row({
  label, icon, color, active, onClick, onDoubleClick, onDelete, onOpen, openTitle,
  onContextMenu, draggable, onDragStart, dragHint, renaming, onRenameSubmit, onRenameCancel
}: RowProps) {
  if (renaming) {
    return (
      <div className={`sb-row sb-row--renaming${active ? " sb-active" : ""}`}>
        {color && <span className="sb-color-dot" style={{ background: color }} />}
        {!color && icon && <span className="sb-row-icon">{icon}</span>}
        <input
          className="sb-rename-input"
          autoFocus
          defaultValue={label}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameSubmit?.((e.target as HTMLInputElement).value);
            if (e.key === "Escape") onRenameCancel?.();
          }}
          onBlur={(e) => onRenameSubmit?.(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div
      className={`sb-row${active ? " sb-active" : ""}${draggable ? " sb-row--draggable" : ""}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      draggable={draggable}
      onDragStart={onDragStart}
      title={dragHint}
    >
      {color && <span className="sb-color-dot" style={{ background: color }} />}
      {!color && icon && <span className="sb-row-icon">{icon}</span>}
      <span className="sb-row-label">{label}</span>
      {onOpen && (
        <button
          className="sb-open-icon-btn"
          title={openTitle ?? "Öffnen"}
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          <ExternalLink size={12} />
        </button>
      )}
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

function EmptyHint({ text, actionLabel, onAction }: { text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="sb-empty">
      <span>{text}</span>
      {onAction && (
        <button className="sb-empty-action" onClick={onAction}>
          <Plus size={11} /> {actionLabel ?? "Anlegen"}
        </button>
      )}
    </div>
  );
}

export default function Sidebar({ onSelect, selection, sidebarState, onStateChange, onOpenDiagram }: Props) {
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

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const [contextMenu, setContextMenu] = useState<TreeContextMenu | null>(null);
  const [renaming, setRenaming] = useState<{ kind: ItemKind; id: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Kontextmenü bei Klick außerhalb schließen
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [contextMenu]);

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

  // Bei aktiver Suche alle Ordner aufklappen, damit Treffer sichtbar sind
  const isOpen = (key: keyof typeof open) => open[key] || searching;

  const matches = (name: string) => !searching || name.toLowerCase().includes(q);

  const connectionLabel = (connId: string) => {
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return "?";
    const src = components.find((c) => c.id === conn.sourceComponentId);
    const tgt = components.find((c) => c.id === conn.targetComponentId);
    return conn.name || `${src?.name ?? "?"} → ${tgt?.name ?? "?"}`;
  };

  const visibleComponentTypes = componentTypes.filter((ct) => matches(ct.name));
  const visibleConnectionTypes = connectionTypes.filter((ct) => matches(ct.name));
  const visibleComponents = components.filter((c) => matches(c.name));
  const visibleConnections = connections.filter((c) => matches(connectionLabel(c.id)));
  const visibleDiagrams = diagrams.filter((d) => matches(d.name));

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
    setRenaming({ kind: "componentType", id: ct.id });
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
    setRenaming({ kind: "connectionType", id: ct.id });
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
    setRenaming({ kind: "component", id: comp.id });
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
    setRenaming({ kind: "diagram", id: d.id });
  }

  // ── Delete helpers (mit Bestätigung – Fehlervermeidung) ──────────────────

  async function deleteComponentType(id: string) {
    const name = componentTypes.find((c) => c.id === id)?.name ?? "Typ";
    if (!window.confirm(`Komponenten-Typ „${name}“ wirklich löschen?`)) return;
    await sidebarApi.deleteComponentType(id);
    onStateChange({ ...sidebarState, componentTypes: componentTypes.filter((c) => c.id !== id) });
  }

  async function deleteConnectionType(id: string) {
    const name = connectionTypes.find((c) => c.id === id)?.name ?? "Typ";
    if (!window.confirm(`Verbindungs-Typ „${name}“ wirklich löschen?`)) return;
    await sidebarApi.deleteConnectionType(id);
    onStateChange({ ...sidebarState, connectionTypes: connectionTypes.filter((c) => c.id !== id) });
  }

  async function deleteComponent(id: string) {
    const name = components.find((c) => c.id === id)?.name ?? "Komponente";
    if (!window.confirm(`Komponente „${name}“ löschen? Zugehörige Verbindungen werden mit entfernt.`)) return;
    await sidebarApi.deleteComponent(id);
    onStateChange({
      ...sidebarState,
      components: components.filter((c) => c.id !== id),
      connections: connections.filter((c) => c.sourceComponentId !== id && c.targetComponentId !== id)
    });
  }

  async function deleteConnection(id: string) {
    if (!window.confirm(`Verbindung „${connectionLabel(id)}“ wirklich löschen?`)) return;
    await sidebarApi.deleteConnection(id);
    onStateChange({ ...sidebarState, connections: connections.filter((c) => c.id !== id) });
  }

  async function deleteDiagram(id: string) {
    const name = diagrams.find((d) => d.id === id)?.name ?? "Diagramm";
    if (!window.confirm(`Diagramm „${name}“ wirklich löschen?`)) return;
    await sidebarApi.deleteDiagram(id);
    onStateChange({ ...sidebarState, diagrams: diagrams.filter((d) => d.id !== id) });
  }

  // ── Rename (inline) ───────────────────────────────────────────────────────

  async function renameItem(kind: ItemKind, id: string, rawName: string) {
    setRenaming(null);
    const name = rawName.trim();
    if (!name) return;
    if (kind === "componentType") {
      const u = await sidebarApi.updateComponentType(id, { name });
      onStateChange({ ...sidebarState, componentTypes: componentTypes.map((c) => (c.id === id ? u : c)) });
    } else if (kind === "connectionType") {
      const u = await sidebarApi.updateConnectionType(id, { name });
      onStateChange({ ...sidebarState, connectionTypes: connectionTypes.map((c) => (c.id === id ? u : c)) });
    } else if (kind === "component") {
      const u = await sidebarApi.updateComponent(id, { name });
      onStateChange({ ...sidebarState, components: components.map((c) => (c.id === id ? u : c)) });
    } else if (kind === "connection") {
      const u = await sidebarApi.updateConnection(id, { name });
      onStateChange({ ...sidebarState, connections: connections.map((c) => (c.id === id ? u : c)) });
    } else {
      const u = await sidebarApi.updateDiagram(id, { name });
      onStateChange({ ...sidebarState, diagrams: diagrams.map((d) => (d.id === id ? u : d)) });
    }
  }

  const isRenaming = (kind: ItemKind, id: string) => renaming?.kind === kind && renaming?.id === id;

  function openContextMenu(e: React.MouseEvent, kind: ItemKind, id: string, label: string) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, kind, id, label });
  }

  function contextDelete(menu: TreeContextMenu) {
    setContextMenu(null);
    if (menu.kind === "componentType") deleteComponentType(menu.id);
    else if (menu.kind === "connectionType") deleteConnectionType(menu.id);
    else if (menu.kind === "component") deleteComponent(menu.id);
    else if (menu.kind === "connection") deleteConnection(menu.id);
    else deleteDiagram(menu.id);
  }

  return (
    <nav className="sidebar" aria-label="Architektur-Navigation">
      {/* ── Suche (Filter über den gesamten Baum) ────────────────────────── */}
      <div className="sb-search">
        <Search size={13} className="sb-search-icon" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen…"
          aria-label="Architektur durchsuchen"
        />
        {searching && (
          <button className="sb-search-clear" title="Suche leeren" onClick={() => setQuery("")}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Section 1: Architekturregeln ─────────────────────────────────── */}
      <div className="sb-section-header">
        <Settings2 size={14} />
        <span>Architekturregeln</span>
      </div>

      <Folder
        label="Komponenten-Typen"
        icon={<LayoutDashboard size={14} />}
        open={isOpen("componentTypes")}
        onToggle={() => toggle("componentTypes")}
        onAdd={addComponentType}
        addTitle="Neuer Komponenten-Typ"
        active={isActive({ kind: "componentTypes" })}
        count={componentTypes.length}
      >
        {visibleComponentTypes.map((ct) => (
          <Row
            key={ct.id}
            label={ct.name}
            color={ct.color}
            active={isActive({ kind: "componentType", id: ct.id })}
            onClick={() => onSelect({ kind: "componentType", id: ct.id })}
            onDelete={() => deleteComponentType(ct.id)}
            onContextMenu={(e) => openContextMenu(e, "componentType", ct.id, ct.name)}
            renaming={isRenaming("componentType", ct.id)}
            onRenameSubmit={(name) => renameItem("componentType", ct.id, name)}
            onRenameCancel={() => setRenaming(null)}
          />
        ))}
        {componentTypes.length === 0 && (
          <EmptyHint text="Noch keine Typen definiert." actionLabel="Typ anlegen" onAction={addComponentType} />
        )}
        {componentTypes.length > 0 && visibleComponentTypes.length === 0 && (
          <EmptyHint text="Keine Treffer." />
        )}
      </Folder>

      <Folder
        label="Verbindungs-Typen"
        icon={<GitBranch size={14} />}
        open={isOpen("connectionTypes")}
        onToggle={() => toggle("connectionTypes")}
        onAdd={addConnectionType}
        addTitle="Neuer Verbindungs-Typ"
        active={isActive({ kind: "connectionTypes" })}
        count={connectionTypes.length}
      >
        {visibleConnectionTypes.map((ct) => (
          <Row
            key={ct.id}
            label={ct.name}
            color={ct.color}
            active={isActive({ kind: "connectionType", id: ct.id })}
            onClick={() => onSelect({ kind: "connectionType", id: ct.id })}
            onDelete={() => deleteConnectionType(ct.id)}
            onContextMenu={(e) => openContextMenu(e, "connectionType", ct.id, ct.name)}
            renaming={isRenaming("connectionType", ct.id)}
            onRenameSubmit={(name) => renameItem("connectionType", ct.id, name)}
            onRenameCancel={() => setRenaming(null)}
          />
        ))}
        {connectionTypes.length === 0 && (
          <EmptyHint text="Noch keine Typen definiert." actionLabel="Typ anlegen" onAction={addConnectionType} />
        )}
        {connectionTypes.length > 0 && visibleConnectionTypes.length === 0 && (
          <EmptyHint text="Keine Treffer." />
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
        open={isOpen("components")}
        onToggle={() => toggle("components")}
        onAdd={addComponent}
        addTitle={componentTypes.length === 0 ? "Zuerst einen Komponenten-Typ anlegen" : "Neue Komponente"}
        active={isActive({ kind: "components" })}
        count={components.length}
      >
        {(() => {
          const usedTypeIds = [...new Set(visibleComponents.map((c) => c.componentTypeId))];
          const groups = componentTypes
            .filter((ct) => usedTypeIds.includes(ct.id))
            .map((ct) => ({ type: ct, items: visibleComponents.filter((c) => c.componentTypeId === ct.id) }));
          const ungrouped = visibleComponents.filter((c) => !componentTypes.find((t) => t.id === c.componentTypeId));

          const renderComponentRow = (comp: (typeof components)[number]) => (
            <Row
              key={comp.id}
              label={comp.name}
              active={isActive({ kind: "component", id: comp.id })}
              onClick={() => onSelect({ kind: "component", id: comp.id })}
              onDelete={() => deleteComponent(comp.id)}
              onContextMenu={(e) => openContextMenu(e, "component", comp.id, comp.name)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(COMPONENT_DRAG_MIME, comp.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              dragHint="In ein offenes Diagramm ziehen, um sie hinzuzufügen"
              renaming={isRenaming("component", comp.id)}
              onRenameSubmit={(name) => renameItem("component", comp.id, name)}
              onRenameCancel={() => setRenaming(null)}
            />
          );

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
                      {isTypeGroupOpen(type.id) || searching ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </span>
                    <span className="sb-color-dot" style={{ background: type.color }} />
                    <span className="sb-type-group-label">{type.name}</span>
                    <span className="sb-type-group-count">{items.length}</span>
                  </div>
                  {(isTypeGroupOpen(type.id) || searching) && (
                    <div className="sb-type-group-children">
                      {items.map(renderComponentRow)}
                    </div>
                  )}
                </div>
              ))}
              {ungrouped.map(renderComponentRow)}
              {components.length === 0 && (
                <EmptyHint
                  text={componentTypes.length === 0 ? "Lege zuerst einen Komponenten-Typ an." : "Noch keine Komponenten."}
                  actionLabel={componentTypes.length === 0 ? undefined : "Komponente anlegen"}
                  onAction={componentTypes.length === 0 ? undefined : addComponent}
                />
              )}
              {components.length > 0 && visibleComponents.length === 0 && <EmptyHint text="Keine Treffer." />}
            </>
          );
        })()}
      </Folder>

      <Folder
        label="Verbindungen"
        icon={<GitBranch size={14} />}
        open={isOpen("connections")}
        onToggle={() => toggle("connections")}
        onAdd={addConnection}
        addTitle={components.length < 2 || connectionTypes.length === 0 ? "Benötigt 2 Komponenten und einen Verbindungs-Typ" : "Neue Verbindung"}
        active={isActive({ kind: "connections" })}
        count={connections.length}
      >
        {visibleConnections.map((conn) => {
          const type = connectionTypes.find((t) => t.id === conn.connectionTypeId);
          const label = connectionLabel(conn.id);
          return (
            <Row
              key={conn.id}
              label={label}
              color={type?.color}
              active={isActive({ kind: "connection", id: conn.id })}
              onClick={() => onSelect({ kind: "connection", id: conn.id })}
              onDelete={() => deleteConnection(conn.id)}
              onContextMenu={(e) => openContextMenu(e, "connection", conn.id, label)}
              renaming={isRenaming("connection", conn.id)}
              onRenameSubmit={(name) => renameItem("connection", conn.id, name)}
              onRenameCancel={() => setRenaming(null)}
            />
          );
        })}
        {connections.length === 0 && (
          <EmptyHint text="Noch keine Verbindungen. Tipp: Im Diagramm zwischen zwei Knoten ziehen." />
        )}
        {connections.length > 0 && visibleConnections.length === 0 && <EmptyHint text="Keine Treffer." />}
      </Folder>

      <Folder
        label="Diagramme"
        icon={<LayoutDashboard size={14} />}
        open={isOpen("diagrams")}
        onToggle={() => toggle("diagrams")}
        onAdd={addDiagram}
        addTitle="Neues Diagramm"
        active={isActive({ kind: "diagrams" })}
        count={diagrams.length}
      >
        {visibleDiagrams.map((d) => (
          <Row
            key={d.id}
            label={d.name}
            active={isActive({ kind: "diagram", id: d.id })}
            onClick={() => onSelect({ kind: "diagram", id: d.id })}
            onDoubleClick={() => onOpenDiagram(d.id)}
            onDelete={() => deleteDiagram(d.id)}
            onOpen={() => onOpenDiagram(d.id)}
            openTitle="Diagramm öffnen (oder Doppelklick)"
            onContextMenu={(e) => openContextMenu(e, "diagram", d.id, d.name)}
            renaming={isRenaming("diagram", d.id)}
            onRenameSubmit={(name) => renameItem("diagram", d.id, name)}
            onRenameCancel={() => setRenaming(null)}
          />
        ))}
        {diagrams.length === 0 && (
          <EmptyHint text="Noch keine Diagramme." actionLabel="Diagramm anlegen" onAction={addDiagram} />
        )}
        {diagrams.length > 0 && visibleDiagrams.length === 0 && <EmptyHint text="Keine Treffer." />}
      </Folder>

      {/* ── Kontextmenü (konsistent zum Diagramm-Editor) ──────────────────── */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="diagram-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="diagram-context-label">{contextMenu.label}</div>
          {contextMenu.kind === "diagram" && (
            <button
              className="diagram-context-item"
              onClick={() => { onOpenDiagram(contextMenu.id); setContextMenu(null); }}
            >
              <ExternalLink size={14} /> Öffnen
            </button>
          )}
          <button
            className="diagram-context-item"
            onClick={() => { setRenaming({ kind: contextMenu.kind, id: contextMenu.id }); setContextMenu(null); }}
          >
            <Pencil size={14} /> Umbenennen
          </button>
          <div className="diagram-context-separator" />
          <button className="diagram-context-item danger" onClick={() => contextDelete(contextMenu)}>
            <Trash2 size={14} /> Löschen
          </button>
        </div>
      )}
    </nav>
  );
}
