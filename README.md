# EAM Vibe Coding Prototype

Ein lokaler Web-Prototyp fuer ein Enterprise Architecture Management Tool. Das Projekt dient als Forschungsartefakt, um zu pruefen, ob und inwiefern ein EAM-Tool durch KI-gestuetztes Vibe Coding entwickelt werden kann.

## Projektziel

Der aktuelle Browserpfad bietet Anmeldung/Registrierung, Company-bezogene Repository-Komponenten, Diagramme und ein editierbares Metamodell. Historische Backendfunktionen wie Impact-Analyse und Portfolio sind nicht als aktuelle Browseransichten zu verstehen. Der Prototyp ist ein MVP und kein Nachbau eines bestehenden Open-Source-EAM-Tools.

## Setup

Voraussetzungen:

- Node.js 22 ab 22.13 (CI/Docker) oder eine in `package.json` zugelassene neuere Linie
- npm
- PostgreSQL (lokal) oder Docker Compose

Installation:

```bash
npm ci
npm run db:generate --workspace backend
```

## Startbefehle

Frontend und Backend gemeinsam starten:

```bash
npm run dev
```

Backend separat:

```bash
npm run dev:backend
```

Frontend separat:

```bash
npm run dev:frontend
```

Standard-URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

Docker-Start mit PostgreSQL:

```powershell
Copy-Item .env.example .env
docker.exe compose up --build
```

Auf Linux normalerweise `docker compose up --build`. Getrennte Staging-/Produktionsumgebungen und das Hosting über `eam.messers-cardio-club.com` sind in `docs/DOCKER_SETUP.md`, `docs/HOSTING_SETUP.md` und `docs/ENVIRONMENT_AND_HOSTING_PLAN.md` beschrieben.

Verpflichtender lokaler Qualitätscheck und ergänzende Security-Scans:

```bash
npm run check
npm run scan:dependencies
npm run scan:secrets
```

Beitrags-/Reviewablauf: [CONTRIBUTING.md](CONTRIBUTING.md). REQ-30-Prüfnachweis: [docs/REQ-30_IMPLEMENTATION_EVIDENCE.md](docs/REQ-30_IMPLEMENTATION_EVIDENCE.md). Native GitHub-Schutzregeln bleiben bis zum Admin-Nachweis offen.

## Aktuelle Funktionsuebersicht

- Registrierung, Login, Logout und Company-Isolation
- Sidebar, gemeinsame Repository-Komponenten und mehrere Diagramme
- React-Flow-Editor mit Komponenten-/Verbindungseigenschaften
- Editierbare Komponententypen, Verbindungsregeln, Viewpoints und Diagrammvalidierung
- Metamodel-Ansicht einschließlich Regelgraph und Metamodel-JSON-Import/-Export

## Historische Funktionsuebersicht (Legacy-Backend, keine aktuelle UI-Zusage)

- EAM-Elemente: Business Capability, Business Process, Application Component, Data Object, Technology Node
- Relationen: `uses`, `depends_on`, `realizes`, `serves`
- Canvas mit React Flow, Drag & Drop und Node-Auswahl
- Eigenschaftenpanel fuer Elementbearbeitung
- Relationserstellung per Canvas-Verbindung oder Formular
- Validierung mit UI-Fehlermeldungen
- Impact-Analyse ueber `uses` und `depends_on`
- Filter nach Layer und Elementtyp
- Risiko- und Kosten-Heatmap
- Capability Map
- Lifecycle Roadmap
- JSON Import und Export
- Audit Log fuer Create, Update, Delete und Import

## REST API

- `GET /api/model`
- `POST /api/model/elements`
- `PATCH /api/model/elements/:id`
- `DELETE /api/model/elements/:id`
- `POST /api/model/relations`
- `DELETE /api/model/relations/:id`
- `POST /api/model/import`
- `GET /api/model/export`
- `GET /api/audit-log`

## Bekannte Grenzen

- JWT/bcrypt-Authentifizierung und Company-Isolation sind vorhanden; ein vollständiges serverseitiges Admin-/Architekt-/Viewer-RBAC ist nicht nachgewiesen.
- Der aktuelle Sidebar-/Diagramm-Pfad nutzt mit `DATABASE_URL` PostgreSQL. Auch `/api/model` nutzt dann Company-bezogene JSONB-Daten in PostgreSQL; JSON-Dateien bleiben ein expliziter Fallback. Beide Datenmodelle sind getrennt.
- Keine kollaborative Bearbeitung.
- Keine vollstaendige ArchiMate-, TOGAF- oder BPMN-Konformitaet.
- Impact-Analyse ist bewusst einfach und betrachtet nur ausgehende `uses` und `depends_on`.
- Capability Map ist heuristisch.
- Audit Log enthaelt keine vollstaendigen Before/After-Diffs.

## Forschungsbezug

Das Projekt dokumentiert Annahmen, technische Abkuerzungen und Bewertungsstaende in `/docs`. Besonders relevant sind:

- `docs/IMPLEMENTATION_PLAN.md`
- `docs/AI_REFLECTION_LOG.md`
- `docs/EVALUATION_MATRIX.md`
- `docs/PROMPT_LOG.md`
- `docs/VALIDATION_RULES.md`
