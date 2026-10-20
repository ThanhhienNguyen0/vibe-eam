# EAM Vibe Coding Prototype

Ein lokaler Web-Prototyp fuer ein Enterprise Architecture Management Tool. Das Projekt dient als Forschungsartefakt, um zu pruefen, ob und inwiefern ein EAM-Tool durch KI-gestuetztes Vibe Coding entwickelt werden kann.

## Projektziel

Der aktuelle Browserpfad bietet Anmeldung/Registrierung, Company-bezogene Repository-Komponenten, Diagramme und ein editierbares Metamodell. Historische Backendfunktionen wie Impact-Analyse und Portfolio sind nicht als aktuelle Browseransichten zu verstehen. Der Prototyp ist ein MVP und kein Nachbau eines bestehenden Open-Source-EAM-Tools.

## Setup

Voraussetzungen:

- Node.js 22 ab 22.13 (CI/Docker) oder eine in `package.json` zugelassene neuere Linie
- npm
- Docker Compose (für PostgreSQL) oder eine eigene PostgreSQL-Instanz

PostgreSQL ist die **einzige** Persistenzschicht. Ohne Datenbank startet das Backend nicht (siehe [Persistenz](#persistenz-nur-postgresql-req-28)).

Installation (einmalig):

```powershell
npm ci
npm run db:generate --workspace backend
Copy-Item .env.example .env        # Linux/macOS: cp .env.example .env
```

## Startbefehle

### Variante 1: Alles in Docker

```powershell
docker.exe compose up --build
```

Auf Linux normalerweise `docker compose up --build`. Startet PostgreSQL, Backend und Frontend. Das Backend führt beim Start automatisch Migrationen und den Seed aus.

### Variante 2: Entwicklung mit Hot Reload

Nur die Datenbank läuft im Container, Backend und Frontend direkt auf dem Rechner:

```bash
npm run db:up       # startet nur PostgreSQL im Container (docker compose up -d postgres)
npm run db:setup    # legt das Schema an bzw. aktualisiert es und spielt Beispieldaten ein
npm run dev         # Backend + Frontend mit Hot Reload
```

`npm run db:setup` ist nur beim ersten Mal und nach neuen Migrationen nötig. Danach reichen `npm run db:up` und `npm run dev`.

Einzeln starten: `npm run dev:backend` bzw. `npm run dev:frontend`.

Standard-URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

### Was die Befehle tun

| Befehl | Wirkung |
|---|---|
| `npm run db:up` | Startet nur den PostgreSQL-Container im Hintergrund |
| `npm run db:setup` | `db:migrate` (Prisma-Migrationen anwenden) und `db:seed` (Beispieldaten, idempotent) |
| `npm run dev` | Backend (`tsx watch`) und Frontend (Vite) gleichzeitig mit Hot Reload |
| `npm test` | Unit-Tests des Backends, **ohne** Datenbank |
| `npm run check` | Kompletter Qualitätscheck wie in der CI (Lint, Typecheck, Tests, Build, Validatoren), **ohne** Datenbank |
| `npm run db:migrate-json --workspace backend` | Einmalige Übernahme alter JSON-Daten nach PostgreSQL |

Alle Backend-Befehle laden die `.env` im Projektwurzelverzeichnis automatisch. Bereits gesetzte Variablen (z. B. aus Docker Compose) haben Vorrang. In `.env.example` zeigt `DATABASE_URL` schon auf `localhost`.

Getrennte Staging-/Produktionsumgebungen und das Hosting über `eam.messers-cardio-club.com` sind in `docs/DOCKER_SETUP.md`, `docs/HOSTING_SETUP.md` und `docs/ENVIRONMENT_AND_HOSTING_PLAN.md` beschrieben.

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

## Persistenz: nur PostgreSQL (REQ-28)

Seit REQ-28 (#60) gibt es keinen JSON-Dateispeicher mehr. Entscheidung und Begründung: [ADR 0001](docs/adr/0001-postgresql-only-persistence.md).

**Was sich geändert hat:**

- **Backend:** `/api/sidebar` und `/api/model` lesen und schreiben ausschließlich PostgreSQL. Fehlt `DATABASE_URL`, bricht das Backend beim Start mit einer klaren Meldung ab, statt still auf JSON-Dateien auszuweichen.
- **`STORAGE_BACKEND` entfällt.** In alten `.env`-Dateien wird `STORAGE_BACKEND=database` ignoriert. `STORAGE_BACKEND=json` führt zu einem Startfehler.
- **Lokale Entwicklung:** `npm run dev` braucht eine laufende PostgreSQL (`npm run db:up`). Die `.env` wird automatisch geladen, `DATABASE_URL` und `JWT_SECRET` müssen nicht mehr von Hand exportiert werden.
- **Tests und CI:** keine Änderung. `npm test`, `npm run check` und die GitHub-Actions-CI laufen weiterhin ohne Datenbank.
- **Docker, Staging, Produktion:** Ablauf unverändert. `STORAGE_BACKEND` wurde aus den Compose-Dateien und `.env`-Beispielen entfernt.
- **API:** keine Änderung an Routen, Requests oder Responses.

**Alte JSON-Daten übernehmen:** Wer noch Daten in `backend/data/model.<companyId>.json` oder `backend/src/data/sidebar.<companyId>.json` hat, überträgt sie einmal mit:

```bash
npm run db:migrate-json --workspace backend
```

Companies mit vorhandenen Daten werden übersprungen. Die Quelldateien bleiben unverändert. Details: [docs/DEVELOPER_SETUP.md](docs/DEVELOPER_SETUP.md#migrating-old-json-data).

## Bekannte Grenzen

- JWT/bcrypt-Authentifizierung und Company-Isolation sind vorhanden; ein vollständiges serverseitiges Admin-/Architekt-/Viewer-RBAC ist nicht nachgewiesen.
- `/api/sidebar` (aktuelle UI) und `/api/model` (Legacy) speichern beide in PostgreSQL, aber in getrennten Datenmodellen. `/api/model` nutzt JSONB-Spalten pro Company statt eigener Tabellen. Gleichzeitige Änderungen derselben Company können sich dort überschreiben. Begründung und mögliches Folge-Issue: [ADR 0001](docs/adr/0001-postgresql-only-persistence.md).
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
