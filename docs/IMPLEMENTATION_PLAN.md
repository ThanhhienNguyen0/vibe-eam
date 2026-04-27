# Implementation Plan

## Technische Architektur

Der Prototyp ist eine lokale Fullstack-Webanwendung.

- Frontend: React, TypeScript, Vite, React Flow
- Backend: Node.js, Express, TypeScript
- Persistenz: JSON-Datei im Backend (`backend/data/model.json`)
- API: REST unter `/api`
- Tests: minimale Vitest-Unit-Tests im Backend
- Authentifizierung: bewusst nicht Bestandteil des MVP
- Deployment: kein produktives Deployment, lokaler Start ueber npm-Skripte

Root-Skripte starten Frontend und Backend parallel. Backend und Frontend bleiben getrennt startbar.

## Komponenten

### Backend

- Express Server
- JSON Repository fuer Modell und Audit Log
- Seed-Daten fuer ein fiktives Unternehmen
- Zentrales EAM-Metamodell
- Semantische Validierung fuer Elemente, Relationen und Modellimport
- REST Endpunkte fuer Elemente, Relationen, Import/Export und Audit Log
- Vitest-Tests fuer Metamodell, Validierung, Impact-Modi und Zyklusvermeidung

### Frontend

- Canvas-Ansicht mit React Flow
- Eigenschaftenpanel fuer selektierte Elemente
- Relationserstellung ueber Canvas-Verbindungen und Formular
- Frontend-Metamodell fuer erlaubte Relationstypen im Formular
- Filter nach Layer und Elementtyp
- Heatmap-Modus nach Risiko und Kosten
- Impact-Analyse mit zwei Modi:
  - Downstream Business Impact
  - Upstream Dependencies
- Ergebnisliste mit Elementtyp, Layer, Relationstyp, Level und Pfad
- Capability Map
- Lifecycle Roadmap
- Import/Export
- Audit Log Ansicht

## Datenmodell

### Element

- `id`
- `name`
- `type`
- `layer`
- `description`
- `risk`: `low | medium | high`
- `cost`
- `status`: `planned | active | deprecated | retired`
- `startDate`
- `endOfLifeDate`
- `customAttributes`: Key-Value-Struktur
- `position`: Canvas-Position als technische UI-Erweiterung

### Relation

- `id`
- `source`
- `target`
- `type`: `uses | depends_on | realizes | serves`
- `description`

Relationen sind nicht frei kombinierbar. Die erlaubten Source-/Relation-/Target-Kombinationen stehen in `docs/METAMODEL.md` und werden im Backend validiert.

### Audit Log Entry

- `id`
- `timestamp`
- `action`
- `entityId`
- `description`

## Metamodell

Elementtypen sind fest Layern zugeordnet:

- `Business Capability` -> `Business`
- `Business Process` -> `Business`
- `Application Component` -> `Application`
- `Data Object` -> `Data`
- `Technology Node` -> `Technology`

Erlaubte Relationen:

- `Business Process realizes Business Capability`
- `Application Component serves Business Process`
- `Application Component uses Data Object`
- `Application Component depends_on Technology Node`
- `Application Component depends_on Application Component`
- `Data Object depends_on Technology Node`
- `Technology Node depends_on Technology Node`

## Scope-Abgrenzung

- Keine Benutzerverwaltung und keine Rollen/Rechte
- Keine kollaborative Bearbeitung
- Keine Datenbankmigrationen
- Kein BPMN-, ArchiMate- oder TOGAF-konformes Vollmetamodell
- Kein produktionsreifes UI-Designsystem
- Keine automatisierte E2E-Test-Suite
- Keine Application-Portfolio-Scoring-Methodik
- Keine Capability-Hierarchie
- Keine Transformationsroadmap mit Initiativen oder Work Packages

## Bekannte Risiken

- JSON-Dateipersistenz ist fuer ein Forschungsartefakt ausreichend, aber nicht transaktionssicher.
- Das Metamodell ist bewusst klein und kann echte Organisationssemantik nur teilweise abbilden.
- Die Impact-Analyse nutzt definierte Traversierungsregeln fuer `uses`, `depends_on`, `serves` und `realizes`; diese Regeln muessen fachlich reviewt werden.
- Layout und Capability-Zuordnung sind weiterhin heuristisch.
- Importierte Modelle koennen trotz struktureller und semantischer Validierung fachlich unvollstaendig oder methodisch schwach sein.
