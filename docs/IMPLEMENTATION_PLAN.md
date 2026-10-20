# Implementation Plan

## Aktueller Schritt: REQ-24 (20.10.2026), PR-CodeQL-Korrektur

Historische Implementierungsbasis war `origin/main` auf `2f21cfed4e1e56826e2b13590aea9d5649e59050`, einschließlich REQ-30. Für Draft-PR #88 wurde der veröffentlichte Branch am 20.10.2026 ohne History-Rewrite mit aktuellem `main` `c489027fc9e7897da17d4dc08d4bb230d4aaed3e` zusammengeführt. Dadurch ist die separat gemergte Dependabot-Konfiguration nun regulär Teil des PR-Stands. Rollenmodell und Nutzerverwaltung werden weiterhin ohne Neubau der EAM-Fachmodelle ergänzt.

Implementierte Reihenfolge: (1) reines Rollen-/Policyvokabular und exaktes Routeninventar; (2) Identitätsadapter mit frischer interner DB-Rolle; (3) atomare Enum-/`member`-Migration; (4) company-lokale, gesperrte Adminoperationen; (5) verständliche Rollenanzeige und passende UI-Aktionen; (6) expliziter sicherer Demo-Seed und konsistente Starterreferenzen; (7) Matrix-/Inventar-/Frontend-/reale DB-Tests; (8) Ergebnis-/Entscheidungs-/Fehlversuchsdokumentation und lokaler Commit.

Die ursprünglichen REQ-30-Gates bleiben erhalten. `npm test` umfasst jetzt zusätzlich Frontendregressionen; ein separater blockierender CI-Schritt erstellt einen isolierten PostgreSQL-Cluster für Migration, Seed und Konkurrenztests. Entfernen oder Optionalisieren dieses Schritts wird durch die Security-Gateregression erkannt. Lokale Resultate und Grenzen: `REQ-24_IMPLEMENTATION_EVIDENCE.md`.

Der Implementierungscommit `16035678a1f0e813932e10b8f92d60a3e32230f9` wurde vom Kontrollchat `01a154a2-d3b0-70c3-9a30-a130659a071d` ohne P0–P2-Befund geprüft. Der gemeldete P3-Dokumentationsblocker wurde im reinen Dokumentationscommit `4193adb26bd570ab178aa2659586166a011663a0` korrigiert und durch denselben Kontrollchat geschlossen. Draft-PR #88 meldete anschließend zwei neue CodeQL-Befunde. Der aktuelle Korrekturschritt ersetzt die problematische E-Mail-Regulärformel durch eine lineare Prüfung, ergänzt allgemeines und Auth-spezifisches Rate-Limiting und wiederholt lokale Gesamt-, DB-, Dependency- und Secret-Prüfungen. Der erneute Remote-Check, Containerausführung, Deployment, menschliche Freigabe, Merge und Issue-Close bleiben getrennte Schritte. REQ-25/OIDC, Passwortreset und EAM-Persistenzneubau bleiben außerhalb dieses Requirements.

## Aktueller Qualitätsstand: REQ-30 (18.10.2026)

Die folgenden historischen Architektur-/Komponentenbeschreibungen dokumentieren frühere Iterationen und sind kein aktueller UI-Vertrag. Aktuell: JWT/bcrypt-Authentifizierung, Company-Isolation, Sidebar/Diagramme/Metamodel im Frontend; Prisma/PostgreSQL für Sidebar und Company-bezogene Legacy-JSONB-Aggregate, explizite JSON-Dateifallbacks; getrennte manuelle Staging-/Produktionsworkflows vorhanden. Ein Deployment auf einen externen Server wurde in REQ-30 nicht durchgeführt.

REQ-30 ergänzt ESLint, `npm run check`, einen strikten Dependency-Scan (hoch/kritisch blockierend), Gitleaks-History-/Dateiscan, Dependabot und CodeQL. Die vorhandenen Compose-, Workflow- und Imageprüfungen bleiben in PR-CI. `CONTRIBUTING.md` definiert Requirement → Implementierung → unabhängige Kontrolle → Evidenz → Merge. Hotspots, doppelte Vertragsdefinitionen und Testlücken: `MAINTAINABILITY.md`. Die konkrete Professorenbegründung bleibt offen.

Abnahme-/Ergebnisquelle ist `REQ-30_IMPLEMENTATION_EVIDENCE.md`; Paketentscheidungen stehen in `security/DEPENDENCY_RISKS.md`. Externe GitHub-Schalter, Branch Protection und ein genehmigendes Review sind getrennte Abnahmevoraussetzungen (`security/GITHUB_ADMIN_CHECKLIST.md`). REQ-30 wird durch versionierte Dateien allein nicht vollständig erfüllt.

## Historischer Plan vor Auth-/Datenbank-/REQ-30-Erweiterung (ersetzt durch datierten Stand oben)

## Technische Architektur

Der Prototyp ist eine lokale Fullstack-Webanwendung.

- Frontend: React, TypeScript, Vite, React Flow
- Backend: Node.js, Express, TypeScript
- Persistenz im ursprünglichen Plan: JSON-Datei im Backend (`backend/data/model.json`)
- API: REST unter `/api`
- Tests: minimale Vitest-Unit-Tests im Backend
- Authentifizierung im ursprünglichen Plan: nicht Bestandteil; durch spätere JWT-/Company-Implementierung überholt
- Deployment im ursprünglichen Plan: lokaler Start; durch spätere Docker-/manuelle Deploymentworkflows erweitert

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
