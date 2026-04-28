# Prompt Log

## Startprompt

Der Startprompt fordert einen autonomen Senior-Fullstack-Entwicklungsagenten auf, einen lauffaehigen Web-Prototypen eines EAM-Tools als Forschungsartefakt zu bauen. Gefordert sind React, TypeScript, Vite, React Flow, Node.js, Express, REST API, JSON-Datei oder SQLite, kein echtes Auth-System, einfache lokale Starts, Seed-Daten, Canvas, Eigenschaftenpanel, Validierung, Impact-Analyse, Heatmap, Capability Map, Roadmap, Import/Export, Audit Log und Dokumentation.

## Wichtige Entscheidungen Waehrend Der Umsetzung

- JSON-Dateipersistenz wurde gegenueber SQLite gewaehlt, weil sie fuer den MVP schneller stabil und nachvollziehbar ist.
- Node-Positionen werden als `position` im Element gespeichert, obwohl dieses Feld nicht in den fachlichen Mindestattributen stand. Das ist fuer persistentes Canvas-Layout notwendig.
- Die API akzeptiert beim Import ein komplettes Modell und ersetzt das aktuelle Modell, sofern die Validierung erfolgreich ist.
- Die Capability Map verwendet eine pragmatische Zuordnungslogik: `Application Component` dient einem `Business Process`; der Prozess realisiert eine `Business Capability`.
- Phase 1: Impact-Analyse lief entlang ausgehender `uses` und `depends_on` Relationen. Phase 2 ersetzt dies durch Downstream Business Impact und Upstream Dependencies.
- Kosten-Heatmap nutzt einfache Schwellenwerte unter 100000, ab 100000 und ab 180000.
- Audit Log speichert kurze Ereignisbeschreibungen statt vollstaendiger Change-Diffs.
- `npm run typecheck`, `npm run build`, Backend-Smoke-Test auf `GET /api/model` und Frontend-Smoke-Test auf `http://localhost:5173` wurden erfolgreich ausgefuehrt.

## Zweiter Entwicklungszyklus

Der zweite Prompt fordert keine neuen UI-Flaechen, sondern bessere EAM-Fachqualitaet. Umgesetzt wurde ein kleines explizites Metamodell mit erlaubten Element-Layer-Zuordnungen und Source/Relation/Target-Regeln. Die Backend-Validierung nutzt dieses Metamodell beim Erstellen und Importieren von Relationen. Das Frontend bietet im Relationsformular nur noch erlaubte Relationstypen an, sobald Source und Target bekannt sind.

Die Impact-Analyse wurde fachlich in zwei Modi aufgeteilt:

- Downstream Business Impact
- Upstream Dependencies

Die Analyse laeuft rekursiv, verhindert Zyklen und zeigt Relationstyp, Level und Pfad. Minimale Vitest-Tests wurden fuer Metamodell, Validierung und Impact-Analyse ergaenzt.

Nachschaerfung: Die zunaechst dokumentierte optionale Shortcut-Relation `Application Component realizes Business Capability` wurde entfernt. Der zweite Zyklus folgt damit nur den explizit geforderten erlaubten Relationen.

## Dritter Entwicklungszyklus

Der dritte Prompt fordert bessere Entscheidungs- und Praesentationsfaehigkeit ohne grosse Architekturkonzepte. Umgesetzt wurde eine Risk-Cost Portfolio Ansicht mit berechnetem Impact Score.

Wichtige Entscheidungen:

- Impact Score basiert auf Downstream Business Impact.
- Betroffene Elemente werden nach Typ gewichtet:
  - Business Capability: 5
  - Business Process: 4
  - Application Component: 3
  - Data Object: 2
  - Technology Node: 1
- Mehrfach erreichbare Elemente werden nur einmal gezaehlt.
- Portfolio-Kategorien bleiben einfache MVP-Heuristiken.
- Canvas-Edges wurden mit Pfeilrichtung, Relationstyp-Labels und einfachen Relationstyp-Stilen verbessert.
- Es wurden keine neuen externen Chart-Libraries oder State-Management-Abhaengigkeiten eingefuehrt.
- Unit Tests wurden fuer Portfolio-Scoring, Impact Level, Kategorie und Deduplizierung ergaenzt.
