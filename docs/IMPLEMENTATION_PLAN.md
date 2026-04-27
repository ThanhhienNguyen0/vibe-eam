# Implementation Plan

## Technische Architektur

Der Prototyp wird als lokale Fullstack-Webanwendung umgesetzt.

- Frontend: React, TypeScript, Vite, React Flow
- Backend: Node.js, Express, TypeScript
- Persistenz: JSON-Datei im Backend (`backend/data/model.json`)
- API: REST unter `/api`
- Authentifizierung: bewusst nicht Bestandteil des MVP
- Deployment: kein produktives Deployment, lokaler Start ueber npm-Skripte

Root-Skripte starten Frontend und Backend parallel. Backend und Frontend bleiben getrennt startbar.

## Geplante Komponenten

### Backend

- Express Server
- JSON Repository fuer Modell und Audit Log
- Seed-Daten fuer ein fiktives Unternehmen
- Validierung fuer Relationen und Modellimport
- REST Endpunkte fuer Elemente, Relationen, Import/Export und Audit Log

### Frontend

- Canvas-Ansicht mit React Flow
- Eigenschaftenpanel fuer selektierte Elemente
- Relationserstellung ueber Canvas-Verbindungen und Formular
- Filter nach Layer und Elementtyp
- Heatmap-Modus nach Risiko und Kosten
- Impact-Analyse fuer `uses` und `depends_on`
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

### Audit Log Entry

- `id`
- `timestamp`
- `action`
- `entityId`
- `description`

## Scope-Abgrenzung

- Keine Benutzerverwaltung und keine Rollen/Rechte
- Keine kollaborative Bearbeitung
- Keine Datenbankmigrationen
- Keine komplexe Graphanalyse jenseits einer gerichteten Impact-Suche
- Kein BPMN, ArchiMate oder TOGAF-konformes Metamodell
- Kein produktionsreifes UI-Designsystem
- Keine automatisierte E2E-Test-Suite im initialen MVP

## Bekannte Risiken

- React Flow und Vite benoetigen Paketinstallation ueber npm; Netzwerkzugriff kann lokal erforderlich sein.
- JSON-Dateipersistenz ist fuer ein Forschungsartefakt ausreichend, aber nicht transaktionssicher.
- Importierte Modelle koennen semantisch unplausibel sein, solange sie die implementierten Strukturregeln erfuellen.
- Die Impact-Analyse nutzt nur `uses` und `depends_on`; andere Relationstypen werden bewusst ignoriert.
- Layout und Capability-Zuordnung sind heuristisch, nicht methodisch vollstaendig.
