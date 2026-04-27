# EAM Vibe Coding Prototype

Ein lokaler Web-Prototyp fuer ein Enterprise Architecture Management Tool. Das Projekt dient als Forschungsartefakt, um zu pruefen, ob und inwiefern ein EAM-Tool durch KI-gestuetztes Vibe Coding entwickelt werden kann.

## Projektziel

Der Prototyp modelliert Business-, Application-, Data- und Technology-Elemente, gerichtete Relationen, Impact-Analyse, Heatmaps, Capability Map, Lifecycle Roadmap, JSON Import/Export und Audit Log. Er ist bewusst ein MVP und kein Nachbau eines bestehenden Open-Source-EAM-Tools.

## Setup

Voraussetzungen:

- Node.js 20 oder neuer empfohlen
- npm

Installation:

```bash
npm install
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

Build und Typecheck:

```bash
npm run typecheck
npm run build
```

## Funktionsuebersicht

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

- Keine Authentifizierung.
- JSON-Datei statt produktiver Datenbank.
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
