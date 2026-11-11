import ResizablePanel from "./ResizablePanel";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, GitBranch, Info, LayoutDashboard, LogOut, Plus, ScrollText, Table2, X } from "lucide-react";
import {
  absoluteLink,
  buildDeepLinkPath,
  filterIdFromView,
  parseDeepLink,
  resolveDeepLink,
  viewParam,
  type DeepLink,
  type FocusTarget
} from "./deepLink";
import Sidebar, { type SidebarSelection } from "./Sidebar/Sidebar";
import SidebarPanels from "./Sidebar/SidebarPanels";
import DiagramEditor from "./DiagramEditor";
import MetamodelView from "./MetamodelView";
import { sidebarApi } from "./Sidebar/sidebarApi";
import type { SidebarState } from "./Sidebar/sidebarTypes";
import { authApi, clearAuthToken, getAuthToken, setAuthToken, type AuthUser } from "./authApi";
import { AccessContext, ROLE_DESCRIPTIONS, ROLE_LABELS, useAccess } from "./access";
import UserManagement from "./UserManagement";
import CatalogView from "./CatalogView";
import AuditLogView from "./AuditLogView";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unauthorized = () => { clearAuthToken(); setUser(null); setCheckingAuth(false); };
    window.addEventListener("eam:unauthorized", unauthorized);
    if (!getAuthToken()) {
      setCheckingAuth(false);
    } else {
      authApi.me().then(setUser).catch((e) => setAuthError(e.message)).finally(() => setCheckingAuth(false));
    }
    return () => window.removeEventListener("eam:unauthorized", unauthorized);
  }, []);

  function refreshUser() {
    void authApi.me().then((current) => { setUser(current); setAuthError(""); }).catch((e) => setAuthError(e.message));
  }

  useEffect(() => {
    const refresh = () => { if (getAuthToken()) refreshUser(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("eam:forbidden", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("eam:forbidden", refresh); };
  }, []);

  if (checkingAuth) return <div className="auth-shell"><div className="auth-card">Anmeldung wird geprüft …</div></div>;
  if (!user && getAuthToken() && authError) return <div className="auth-shell"><div className="auth-card" role="alert">{authError}<button onClick={refreshUser}>Erneut prüfen</button><button onClick={() => { clearAuthToken(); setAuthError(""); }}>Abmelden</button></div></div>;
  if (!user) return <AuthScreen onAuthenticated={(result) => { setAuthToken(result.token); setUser(result.user); }} />;

  async function logout() {
    try { await authApi.logout(); } catch { /* Stateless logout remains local even if the request fails. */ }
    clearAuthToken();
    setUser(null);
  }

  return <AccessContext.Provider value={user.role}><EamWorkspace key={user.role} user={user} onLogout={logout} onRoleChanged={refreshUser} /></AccessContext.Provider>;
}

export function EamWorkspace({ user, onLogout, onRoleChanged }: { user: AuthUser; onLogout: () => void; onRoleChanged: () => void }) {
  const { canWrite, canManageMetamodel, canManageUsers, canReadAudit } = useAccess();
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
    viewpoints: [],
    catalogs: []
  });
  const [sidebarSelection, setSidebarSelection] = useState<SidebarSelection | null>(null);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [activeCatalogId, setActiveCatalogId] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<"diagrams" | "catalogs" | "metamodel" | "users" | "audit">("diagrams");
  const [error, setError] = useState("");

  const activeDiagram = sidebarState.diagrams.find((d) => d.id === activeDiagramId) ?? null;
  const activeCatalog = sidebarState.catalogs.find((c) => c.id === activeCatalogId) ?? null;

  /* ── REQ-12: Deep Links ──────────────────────────────────────────────────── */
  const [loaded, setLoaded] = useState(false);
  /** Erst nach dem Auswerten des Start-Links wird die Adresszeile synchronisiert (sonst würde sie überschrieben). */
  const [linkReady, setLinkReady] = useState(false);
  /** Aktueller Ansichtsfilter im offenen Diagramm („“ = Alle Inhalte), gemeldet vom Editor. */
  const [currentFilterId, setCurrentFilterId] = useState("");
  const [focusRequest, setFocusRequest] = useState<{ target: FocusTarget; nonce: number } | null>(null);
  const [viewRequest, setViewRequest] = useState<{ filterId: string; nonce: number } | null>(null);
  const [linkMessage, setLinkMessage] = useState<{ kind: "error" | "notice"; text: string } | null>(null);
  const stateRef = useRef(sidebarState);
  stateRef.current = sidebarState;

  useEffect(() => {
    sidebarApi.getAll()
      .then((state) => { setSidebarState(state); setLoaded(true); })
      .catch((e) => setError(e instanceof Error ? e.message : "Daten konnten nicht geladen werden."));
  }, []);

  /** Öffnet, was ein Link beschreibt – oder erklärt verständlich, warum das nicht geht. */
  const applyLink = useCallback((link: DeepLink) => {
    const state = stateRef.current;
    const result = resolveDeepLink(link, state);
    const nonce = Date.now();
    setActiveCatalogId(null);
    setWorkspaceView("diagrams");
    if (result.error) {
      setActiveDiagramId(null);
      setSidebarSelection(null);
      setFocusRequest(null);
      setViewRequest(null);
      setLinkMessage({ kind: "error", text: `${result.error} Du siehst jetzt die Diagrammübersicht.` });
      // Den kaputten Link nicht in der Adresszeile stehen lassen.
      window.history.replaceState(null, "", "/");
      return;
    }
    setLinkMessage(result.notice ? { kind: "notice", text: result.notice } : null);
    const selection = result.focus ? { kind: result.focus.kind, id: result.focus.id } as SidebarSelection : null;
    if (result.diagramId) {
      const diagram = state.diagrams.find((d) => d.id === result.diagramId);
      const filterId = filterIdFromView(result.viewId, diagram?.viewpointId);
      setActiveDiagramId(result.diagramId);
      setCurrentFilterId(filterId);
      setViewRequest({ filterId, nonce });
      setFocusRequest(result.focus ? { target: result.focus, nonce } : null);
    } else {
      setActiveDiagramId(null);
      setFocusRequest(null);
      setViewRequest(null);
    }
    setSidebarSelection(selection);
  }, []);

  // Start-Link auswerten, sobald die Daten da sind (auch nach dem Login: die Adresse bleibt erhalten).
  useEffect(() => {
    if (!loaded || linkReady) return;
    applyLink(parseDeepLink(window.location.pathname, window.location.search));
    setLinkReady(true);
  }, [applyLink, linkReady, loaded]);

  // Zurück/Vorwärts im Browser führt wieder an die vorherige Stelle.
  useEffect(() => {
    const onPop = () => applyLink(parseDeepLink(window.location.pathname, window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [applyLink]);

  const isInDiagram = (diagramId: string | null, selection: SidebarSelection | null): selection is { kind: "component" | "connection"; id: string } => {
    const diagram = sidebarState.diagrams.find((d) => d.id === diagramId);
    if (!diagram || !selection) return false;
    if (selection.kind === "component") return diagram.componentIds.includes(selection.id);
    if (selection.kind === "connection") return diagram.connectionIds.includes(selection.id);
    return false;
  };

  /** Was gerade zu sehen ist, als Link – Grundlage für Adresszeile und „Link kopieren“. */
  function currentLink(): DeepLink {
    if (activeDiagram) {
      return {
        kind: "diagram",
        diagramId: activeDiagram.id,
        viewId: viewParam(currentFilterId, activeDiagram.viewpointId),
        ...(isInDiagram(activeDiagram.id, sidebarSelection) ? { selectId: sidebarSelection.id } : {})
      };
    }
    if (!activeCatalog && workspaceView === "diagrams" && (sidebarSelection?.kind === "component" || sidebarSelection?.kind === "connection")) {
      return { kind: sidebarSelection.kind, id: sidebarSelection.id };
    }
    return { kind: "home" };
  }

  // Adresszeile mitführen: neuer Verlaufseintrag nur beim Wechsel des Diagramms, sonst ersetzen.
  const desiredPath = linkReady ? buildDeepLinkPath(currentLink()) : null;
  useEffect(() => {
    if (!desiredPath) return;
    const { pathname, search } = window.location;
    if (desiredPath === pathname + search) return;
    const diagramOf = (link: DeepLink) => (link.kind === "diagram" ? link.diagramId : null);
    const [nextPath, nextQuery = ""] = desiredPath.split("?");
    const switchesDiagram = diagramOf(parseDeepLink(pathname, search)) !== diagramOf(parseDeepLink(nextPath, nextQuery ? `?${nextQuery}` : ""));
    if (switchesDiagram) window.history.pushState(null, "", desiredPath);
    else window.history.replaceState(null, "", desiredPath);
  }, [desiredPath]);

  /** Link für das Eigenschaftenpanel: Element im offenen Diagramm, sonst direkt auf das Element. */
  function linkForSelection(selection: SidebarSelection): string | null {
    const origin = window.location.origin;
    if (selection.kind === "diagram") return absoluteLink({ kind: "diagram", diagramId: selection.id }, origin);
    if (selection.kind !== "component" && selection.kind !== "connection") return null;
    if (activeDiagram && isInDiagram(activeDiagram.id, selection)) {
      return absoluteLink({ kind: "diagram", diagramId: activeDiagram.id, viewId: viewParam(currentFilterId, activeDiagram.viewpointId), selectId: selection.id }, origin);
    }
    return absoluteLink({ kind: selection.kind, id: selection.id }, origin);
  }

  function openCatalog(id: string) {
    setActiveDiagramId(null);
    setActiveCatalogId(id);
    setWorkspaceView("diagrams");
  }

  async function createCatalog() {
    const created = await sidebarApi.createCatalog({ name: "Neuer Katalog", kind: "elements", columns: ["type", "description"] });
    setSidebarState((s) => ({ ...s, catalogs: [...s.catalogs, created] }));
    setSidebarSelection({ kind: "catalog", id: created.id });
    openCatalog(created.id);
  }

  function openDiagram(id: string, known?: { viewpointId?: string }) {
    const diagram = known ?? sidebarState.diagrams.find((d) => d.id === id);
    setActiveCatalogId(null);
    setActiveDiagramId(id);
    setWorkspaceView("diagrams");
    // Normales Öffnen: keine Link-Aufträge eines früheren Links wiederverwenden.
    setFocusRequest(null);
    setViewRequest(null);
    setCurrentFilterId(diagram?.viewpointId ?? "");
    setLinkMessage(null);
  }

  async function createDiagram() {
    const d = await sidebarApi.createDiagram({ name: "Neues Diagramm", description: "" });
    setSidebarState((s) => ({ ...s, diagrams: [...s.diagrams, d] }));
    openDiagram(d.id, d);
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
            className={`tabs-diagram-tab${!activeDiagram && !activeCatalog && workspaceView === "diagrams" ? " active" : ""}`}
            onClick={() => { setActiveDiagramId(null); setActiveCatalogId(null); setWorkspaceView("diagrams"); }}
          >
            <LayoutDashboard size={14} /> Diagramme
          </button>
          <button
            className={`tabs-diagram-tab${!activeDiagram && !activeCatalog && workspaceView === "catalogs" ? " active" : ""}`}
            onClick={() => { setActiveDiagramId(null); setActiveCatalogId(null); setWorkspaceView("catalogs"); }}
          >
            <Table2 size={14} /> Kataloge
          </button>
          {canManageMetamodel && <button
            className={`tabs-diagram-tab${!activeDiagram && workspaceView === "metamodel" ? " active" : ""}`}
            onClick={() => { setActiveDiagramId(null); setActiveCatalogId(null); setWorkspaceView("metamodel"); }}
          >
            <GitBranch size={14} /> Metamodel
          </button>}
          {canManageUsers && <button className={`tabs-diagram-tab${workspaceView === "users" ? " active" : ""}`} onClick={() => { setActiveDiagramId(null); setActiveCatalogId(null); setWorkspaceView("users"); }}>Nutzerverwaltung</button>}
          {canReadAudit && <button className={`tabs-diagram-tab${!activeDiagram && workspaceView === "audit" ? " active" : ""}`} onClick={() => { setActiveDiagramId(null); setActiveCatalogId(null); setWorkspaceView("audit"); }}><ScrollText size={14} /> Protokoll</button>}
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
        {activeCatalog && !activeDiagram && workspaceView === "diagrams" && (
          <nav className="tabs" aria-label="Geöffneter Katalog">
            <button className="tabs-diagram-tab active">
              {activeCatalog.name}
              <span
                className="tabs-diagram-close"
                role="button"
                title="Katalog schließen"
                onClick={(e) => { e.stopPropagation(); setActiveCatalogId(null); setWorkspaceView("catalogs"); }}
              >×</span>
            </button>
          </nav>
        )}
        <div className="account-menu">
          <span className="account-identity"><strong>{user.name ?? user.email}</strong><small>{user.companyName}</small></span>
          <details className="account-role-info">
            <summary>{ROLE_LABELS[user.role]}</summary>
            <div>
              <strong>Deine Rolle: {ROLE_LABELS[user.role]}</strong>
              <p>{ROLE_DESCRIPTIONS[user.role]}</p>
              <p>{user.role === "Admin" ? "Rollen vergibst du unter Nutzerverwaltung." : "Rollen werden von einem Admin unter Nutzerverwaltung vergeben."}</p>
            </div>
          </details>
          <button type="button" onClick={onLogout} title="Abmelden"><LogOut size={16} /> Abmelden</button>
        </div>
      </header>

      <div className="app-body">
        <ResizablePanel side="left" storageKey="eam.panel.sidebar" defaultWidth={240} minWidth={180} maxWidth={520} label="Navigationsbaum">
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
          activeDiagramId={activeDiagramId}
          onOpenCatalog={openCatalog}
          activeCatalogId={activeCatalog?.id ?? null}
        />
        </ResizablePanel>

        <main className="workspace workspace--full">
          {error && <div className="error-banner">{error}</div>}
          {linkMessage && (
            <div className={`link-banner${linkMessage.kind === "error" ? " link-banner--error" : ""}`} role={linkMessage.kind === "error" ? "alert" : "status"}>
              {linkMessage.kind === "error" ? <AlertTriangle size={16} /> : <Info size={16} />}
              <span>{linkMessage.text}</span>
              <button type="button" className="sb-close-btn" onClick={() => setLinkMessage(null)} aria-label="Hinweis schließen" title="Hinweis schließen"><X size={14} /></button>
            </div>
          )}

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
              focusRequest={focusRequest}
              viewRequest={viewRequest}
              onViewChange={setCurrentFilterId}
            />
          ) : activeCatalog && workspaceView === "diagrams" ? (
            <CatalogView
              key={activeCatalog.id}
              catalog={activeCatalog}
              sidebarState={sidebarState}
              onStateChange={setSidebarState}
              selection={sidebarSelection}
              onSelect={setSidebarSelection}
              onClose={() => { setActiveCatalogId(null); setWorkspaceView("catalogs"); }}
            />
          ) : workspaceView === "catalogs" ? (
            <CatalogOverview
              sidebarState={sidebarState}
              onOpenCatalog={openCatalog}
              onCreateCatalog={createCatalog}
              canWrite={canWrite}
            />
          ) : workspaceView === "audit" && canReadAudit ? (
            <AuditLogView />
          ) : workspaceView === "users" && canManageUsers ? (
            <UserManagement onRoleChanged={onRoleChanged} />
          ) : workspaceView === "metamodel" && canManageMetamodel ? (
            <MetamodelView sidebarState={sidebarState} onStateChange={setSidebarState} />
          ) : (
            <HomeView
              sidebarState={sidebarState}
              onOpenDiagram={openDiagram}
              onCreateDiagram={createDiagram}
              canWrite={canWrite}
            />
          )}
        </main>

        {sidebarSelection && (
          <ResizablePanel side="right" storageKey="eam.panel.details" defaultWidth={380} minWidth={300} maxWidth={760} label="Eigenschaften">
          <div className="sidebar-detail-area sidebar-detail-area--right">
            <SidebarPanels
              selection={sidebarSelection}
              sidebarState={sidebarState}
              onStateChange={setSidebarState}
              onSelect={setSidebarSelection}
              onOpenDiagram={(id) => { openDiagram(id); setSidebarSelection(null); }}
              onOpenCatalog={openCatalog}
              onClose={() => setSidebarSelection(null)}
              linkFor={linkForSelection}
            />
          </div>
          </ResizablePanel>
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

export function CatalogOverview({
  sidebarState,
  onOpenCatalog,
  onCreateCatalog,
  canWrite
}: {
  sidebarState: SidebarState;
  onOpenCatalog: (id: string) => void;
  onCreateCatalog: () => void;
  canWrite: boolean;
}) {
  const { catalogs } = sidebarState;
  return (
    <div className="home-view">
      <div className="home-header">
        <div>
          <h2>Kataloge</h2>
          <p className="muted">Gespeicherte Auswahlen aus Typen, Eigenschaften und Spalten. Jeder Katalog lässt sich als Excel oder CSV exportieren.</p>
        </div>
        {canWrite && <button className="home-create-btn" onClick={onCreateCatalog}>
          <Plus size={16} /> Neuer Katalog
        </button>}
      </div>
      {catalogs.length === 0 ? (
        <div className="home-empty">
          <Table2 size={36} />
          <strong>Noch keine Kataloge</strong>
          {canWrite && <button className="home-create-btn" onClick={onCreateCatalog}><Plus size={16} /> Ersten Katalog erstellen</button>}
        </div>
      ) : (
        <div className="home-grid">
          {catalogs.map((catalog) => (
            <button key={catalog.id} className="home-card" onClick={() => onOpenCatalog(catalog.id)}>
              <Table2 size={20} />
              <strong>{catalog.name}</strong>
              {catalog.description && <p>{catalog.description}</p>}
              <span className="muted">{catalog.kind === "elements" ? "Elemente" : "Verbindungen"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HomeView({
  sidebarState,
  onOpenDiagram,
  onCreateDiagram,
  canWrite
}: {
  sidebarState: SidebarState;
  onOpenDiagram: (id: string) => void;
  onCreateDiagram: () => void;
  canWrite: boolean;
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
        {canWrite && <button className="home-create-btn" onClick={onCreateDiagram}>
          <Plus size={16} /> Neues Diagramm
        </button>}
      </div>

      {diagrams.length === 0 ? (
        <div className="home-empty">
          <LayoutDashboard size={36} />
          <strong>Noch keine Diagramme</strong>
          <span>
            Definiere links unter „Architekturregeln" deine Komponenten- und Verbindungs-Typen,
            lege Komponenten an und erstelle dann dein erstes Diagramm.
          </span>
          {canWrite && <button className="home-create-btn" onClick={onCreateDiagram}>
            <Plus size={16} /> Erstes Diagramm erstellen
          </button>}
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
