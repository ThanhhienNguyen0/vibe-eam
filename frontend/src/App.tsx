import { useEffect, useState } from "react";
import { GitBranch, LayoutDashboard, LogOut, Plus } from "lucide-react";
import Sidebar, { type SidebarSelection } from "./Sidebar/Sidebar";
import SidebarPanels from "./Sidebar/SidebarPanels";
import DiagramEditor from "./DiagramEditor";
import MetamodelView from "./MetamodelView";
import { sidebarApi } from "./Sidebar/sidebarApi";
import type { SidebarState } from "./Sidebar/sidebarTypes";
import { authApi, clearAuthToken, getAuthToken, setAuthToken, type AuthUser } from "./authApi";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unauthorized = () => { clearAuthToken(); setUser(null); setCheckingAuth(false); };
    window.addEventListener("eam:unauthorized", unauthorized);
    if (!getAuthToken()) {
      setCheckingAuth(false);
    } else {
      authApi.me().then(setUser).catch(unauthorized).finally(() => setCheckingAuth(false));
    }
    return () => window.removeEventListener("eam:unauthorized", unauthorized);
  }, []);

  if (checkingAuth) return <div className="auth-shell"><div className="auth-card">Anmeldung wird geprüft …</div></div>;
  if (!user) return <AuthScreen onAuthenticated={(result) => { setAuthToken(result.token); setUser(result.user); }} />;

  async function logout() {
    try { await authApi.logout(); } catch { /* Stateless logout remains local even if the request fails. */ }
    clearAuthToken();
    setUser(null);
  }

  return <EamWorkspace user={user} onLogout={logout} />;
}

function EamWorkspace({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [sidebarState, setSidebarState] = useState<SidebarState>({
    metamodel: {
      id: "",
      name: "",
      description: "",
      version: "",
      isActive: true,
      createdAt: "",
      updatedAt: ""
    },
    componentTypes: [],
    connectionTypes: [],
    connectionRules: [],
    viewpointRules: [],
    validationRules: [],
    components: [],
    connections: [],
    diagrams: [],
    viewpoints: []
  });
  const [sidebarSelection, setSidebarSelection] = useState<SidebarSelection | null>(null);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<"diagrams" | "metamodel">("diagrams");
  const [error, setError] = useState("");

  const activeDiagram = sidebarState.diagrams.find((d) => d.id === activeDiagramId) ?? null;

  useEffect(() => {
    sidebarApi.getAll().then(setSidebarState).catch((e) => setError(e instanceof Error ? e.message : "Daten konnten nicht geladen werden."));
  }, []);

  function openDiagram(id: string) {
    setActiveDiagramId(id);
    setWorkspaceView("diagrams");
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
        <nav className="tabs" aria-label="Workspace">
          <button
            className={`tabs-diagram-tab${!activeDiagram && workspaceView === "diagrams" ? " active" : ""}`}
            onClick={() => { setActiveDiagramId(null); setWorkspaceView("diagrams"); }}
          >
            <LayoutDashboard size={14} /> Diagramme
          </button>
          <button
            className={`tabs-diagram-tab${!activeDiagram && workspaceView === "metamodel" ? " active" : ""}`}
            onClick={() => { setActiveDiagramId(null); setWorkspaceView("metamodel"); }}
          >
            <GitBranch size={14} /> Metamodel
          </button>
        </nav>
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
        <div className="account-menu">
          <span><strong>{user.name ?? user.email}</strong><small>{user.companyName}</small></span>
          <button type="button" onClick={onLogout} title="Abmelden"><LogOut size={16} /> Abmelden</button>
        </div>
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
              metamodel={sidebarState.metamodel}
              componentTypes={sidebarState.componentTypes}
              connectionTypes={sidebarState.connectionTypes}
              connectionRules={sidebarState.connectionRules}
              viewpointRules={sidebarState.viewpointRules}
              validationRules={sidebarState.validationRules}
              viewpoints={sidebarState.viewpoints}
              components={sidebarState.components}
              connections={sidebarState.connections}
              onDiagramChange={(updated) =>
                setSidebarState((s) => ({ ...s, diagrams: s.diagrams.map((d) => (d.id === updated.id ? updated : d)) }))
              }
              onConnectionCreated={(conn) =>
                setSidebarState((s) => ({ ...s, connections: [...s.connections, conn] }))
              }
              onComponentCreated={(comp) =>
                setSidebarState((s) => ({ ...s, components: [...s.components, comp] }))
              }
              onSelectComponent={(id) => setSidebarSelection({ kind: "component", id })}
              onSelectConnection={(id) => setSidebarSelection({ kind: "connection", id })}
              onClose={() => setActiveDiagramId(null)}
            />
          ) : workspaceView === "metamodel" ? (
            <MetamodelView sidebarState={sidebarState} onStateChange={setSidebarState} />
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

function AuthScreen({ onAuthenticated }: { onAuthenticated: (result: { token: string; user: AuthUser }) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = mode === "login"
        ? await authApi.login({ email, password })
        : await authApi.register({ email, password, companyName, name: name || undefined });
      onAuthenticated(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand"><GitBranch size={28} /><div><h1>EAM Prototype</h1><p>Unternehmensarchitektur sicher modellieren</p></div></div>
        <div className="auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Anmelden</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Registrieren</button>
        </div>
        {mode === "register" && (
          <>
            <label>Unternehmen<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required autoComplete="organization" /></label>
            <label>Name (optional)<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
          </>
        )}
        <label>E-Mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
        <label>Passwort<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-submit" disabled={submitting}>{submitting ? "Bitte warten …" : mode === "login" ? "Anmelden" : "Unternehmen anlegen"}</button>
        {mode === "register" && <small className="auth-hint">Mit der Registrierung wird ein neues, getrenntes Unternehmen angelegt.</small>}
      </form>
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
