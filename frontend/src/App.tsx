import { useEffect, useState } from "react";
import { LayoutDashboard, Plus } from "lucide-react";
import Sidebar, { type SidebarSelection } from "./Sidebar/Sidebar";
import SidebarPanels from "./Sidebar/SidebarPanels";
import DiagramEditor from "./DiagramEditor";
import { sidebarApi } from "./Sidebar/sidebarApi";
import type { SidebarState } from "./Sidebar/sidebarTypes";

export default function App() {
  const [sidebarState, setSidebarState] = useState<SidebarState>({
    componentTypes: [],
    connectionTypes: [],
    components: [],
    connections: [],
    diagrams: []
  });
  const [sidebarSelection, setSidebarSelection] = useState<SidebarSelection | null>(null);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const activeDiagram = sidebarState.diagrams.find((d) => d.id === activeDiagramId) ?? null;

  useEffect(() => {
    sidebarApi.getAll().then(setSidebarState).catch((e) => setError(e instanceof Error ? e.message : "Daten konnten nicht geladen werden."));
  }, []);

  function openDiagram(id: string) {
    setActiveDiagramId(id);
  }

  async function createDiagram() {
    const d = await sidebarApi.createDiagram({ name: "Neues Diagramm", description: "" });
    setSidebarState((s) => ({ ...s, diagrams: [...s.diagrams, d] }));
    setActiveDiagramId(d.id);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>EAM Prototype</h1>
          <p>Leichtgewichtige Architektur-Modellierung</p>
        </div>
        {activeDiagram && (
          <nav className="tabs" aria-label="Geöffnetes Diagramm">
            <button className="tabs-diagram-tab active">
              {activeDiagram.name}
              <span
                className="tabs-diagram-close"
                role="button"
                title="Diagramm schließen"
                onClick={(e) => { e.stopPropagation(); setActiveDiagramId(null); }}
              >×</span>
            </button>
          </nav>
        )}
      </header>

      <div className="app-body">
        <Sidebar
          selection={sidebarSelection}
          onSelect={(next) => setSidebarSelection((prev) => {
            if (!next || !prev) return next;
            if (prev.kind !== next.kind) return next;
            if ('id' in prev && 'id' in next) return prev.id === next.id ? null : next;
            return null;
          })}
          sidebarState={sidebarState}
          onStateChange={setSidebarState}
          onOpenDiagram={openDiagram}
        />

        <main className="workspace workspace--full">
          {error && <div className="error-banner">{error}</div>}

          {activeDiagram ? (
            <DiagramEditor
              diagram={activeDiagram}
              componentTypes={sidebarState.componentTypes}
              connectionTypes={sidebarState.connectionTypes}
              components={sidebarState.components}
              connections={sidebarState.connections}
              onDiagramChange={(updated) =>
                setSidebarState((s) => ({ ...s, diagrams: s.diagrams.map((d) => (d.id === updated.id ? updated : d)) }))
              }
              onConnectionCreated={(conn) =>
                setSidebarState((s) => ({ ...s, connections: [...s.connections, conn] }))
              }
              onSelectComponent={(id) => setSidebarSelection({ kind: "component", id })}
              onSelectConnection={(id) => setSidebarSelection({ kind: "connection", id })}
              onClose={() => setActiveDiagramId(null)}
            />
          ) : (
            <HomeView
              sidebarState={sidebarState}
              onOpenDiagram={openDiagram}
              onCreateDiagram={createDiagram}
            />
          )}
        </main>

        {sidebarSelection && (
          <div className="sidebar-detail-area sidebar-detail-area--right">
            <SidebarPanels
              selection={sidebarSelection}
              sidebarState={sidebarState}
              onStateChange={setSidebarState}
              onSelect={setSidebarSelection}
              onOpenDiagram={(id) => { openDiagram(id); setSidebarSelection(null); }}
              onClose={() => setSidebarSelection(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Startansicht: Diagrammübersicht ───────────────────────────────────────── */

function HomeView({
  sidebarState,
  onOpenDiagram,
  onCreateDiagram
}: {
  sidebarState: SidebarState;
  onOpenDiagram: (id: string) => void;
  onCreateDiagram: () => void;
}) {
  const { diagrams, components, connections } = sidebarState;

  return (
    <div className="home-view">
      <div className="home-header">
        <div>
          <h2>Diagramme</h2>
          <p className="muted">
            {components.length} Komponenten · {connections.length} Verbindungen im Modell
          </p>
        </div>
        <button className="home-create-btn" onClick={onCreateDiagram}>
          <Plus size={16} /> Neues Diagramm
        </button>
      </div>

      {diagrams.length === 0 ? (
        <div className="home-empty">
          <LayoutDashboard size={36} />
          <strong>Noch keine Diagramme</strong>
          <span>
            Definiere links unter „Architekturregeln" deine Komponenten- und Verbindungs-Typen,
            lege Komponenten an und erstelle dann dein erstes Diagramm.
          </span>
          <button className="home-create-btn" onClick={onCreateDiagram}>
            <Plus size={16} /> Erstes Diagramm erstellen
          </button>
        </div>
      ) : (
        <div className="home-grid">
          {diagrams.map((d) => (
            <button key={d.id} className="home-card" onClick={() => onOpenDiagram(d.id)}>
              <LayoutDashboard size={20} />
              <strong>{d.name}</strong>
              {d.description && <p>{d.description}</p>}
              <span className="muted">
                {d.componentIds.length} Komponenten · {d.connectionIds.length} Verbindungen
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
