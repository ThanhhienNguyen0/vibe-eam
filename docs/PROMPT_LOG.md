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

## Vierter Entwicklungszyklus

Der vierte Prompt fordert, die vorhandene Sidebar-/Diagrammstruktur nicht zu ersetzen, sondern fachlich zu einem konfigurierbaren Metamodell fuer KMU-Kunden auszubauen.

Umgesetzt wurde der Metamodel Rule Builder:

- Component Types wurden um Layer, Viewpoint-Zuordnung und Pflichtmarkierung erweitert.
- Connection Types wurden um Richtungstext sowie Source-/Target-Pflichtkontexte erweitert.
- Viewpoints wurden als neue Sidebar-Struktur mit CRUD, Editor und Diagrammzuordnung eingefuehrt.
- Eine zentrale Sidebar-Metamodellvalidierung prueft erlaubte Verbindungskombinationen, Viewpoint-Einschraenkungen und Pflichtregeln.
- Der DiagramEditor filtert Komponenten und Verbindungstypen nach Viewpoint und bietet `Validate diagram`.
- Das Backend validiert Verbindungen und harte Diagramm-Viewpoint-Regeln serverseitig.
- Eine neue `Metamodel`-Ansicht visualisiert Component Types, Connection Rules und Viewpoint-Filter als Regeluebersicht und SVG-Grafik.
- Dokumentation, Evaluation und Reflexion wurden ergaenzt.

## Fuenfter Entwicklungszyklus

Der fuenfte Prompt fordert ein fachlich saubereres, klassendiagrammaehnliches Metamodell. Die zentrale Anpassung ist die Einfuehrung von `ConnectionRule` als primaere Regelstruktur.

Umgesetzt wurde:

- `Metamodel` als minimale logische Root-Struktur im Sidebar-State.
- `ConnectionRule` mit Source Component Type, Connection Type, Target Component Type, allowed, required, severity, rationale und optionalen Viewpoints.
- Migration/Normalisierung: Bestehende Legacy-Connection-Type-Listen koennen in ConnectionRules ueberfuehrt werden.
- Validierung nutzt ConnectionRules primaer und liefert strukturierte ValidationMessages.
- DiagramEditor nutzt ConnectionRules zur Auswahl erlaubter ConnectionTypes und erzeugt keine Fallback-Verbindung.
- Sidebar/Rule-Builder erhaelt einen einfachen Connection Rule Editor.
- Metamodel-Ansicht zeigt explizite ConnectionRules und Detailinformationen.
- Stakeholder bleibt ein modellierbarer ComponentType mit expliziten Stakeholder-Regeln.

## Sechster Entwicklungszyklus

Der sechste Prompt fordert vier fachliche Nachschaerfungen am bestehenden Metamodel Rule Builder, ohne neue grosse UI-Funktionen.

Umgesetzt wurde:

- `ValidationResult` ist als erzeugtes Validierungsergebnis dokumentiert und bleibt Rueckgabe der Validierungsfunktionen.
- `ViewpointRule` wurde als eigene Struktur eingefuehrt und wird fuer Viewpoint-Filterung und Viewpoint-Validierung primaer genutzt.
- `Diagram` erhaelt `metamodelId`; alte Diagramme werden gegen das aktive Metamodel normalisiert.
- `ValidationRule` wurde fuer typbezogene Mindestbeziehungen eingefuehrt.
- Validierungsmeldungen enthalten nun `scope` und `ruleType`.
- Validate Diagram gruppiert Metamodel-, Viewpoint- und Pflichtregelmeldungen.
- Die Metamodel-Ansicht zeigt ConnectionRules, ViewpointRules und ValidationRules getrennt.
- Tests wurden um ViewpointRule, ValidationRule, Metamodel-Konformitaet und strukturierte ValidationMessages erweitert.

## Siebter Entwicklungszyklus: Kritische Refinement-Pruefung

Der siebte Prompt fordert keine neue Funktionalitaet, sondern eine kritische Pruefung, ob die vier Nachschaerfungen wirklich implementiert sind.

Durchgefuehrt wurde:

- Codepruefung von Types, Validierungslogik, Store-Normalisierung, Backend-Routen, DiagramEditor und Metamodel View.
- Kleine Testluecken geschlossen fuer Application-ohne-`serves`, Application-ohne-Technikabhaengigkeit und Legacy-Source/Target-Felder als nicht-primaere Regelquelle.
- `npm run typecheck`, `npm test` und `npm run build` ausgefuehrt.
- `docs/METAMODEL_REFINEMENT_CHECK.md` als ehrlicher Pruefbericht erstellt.

## Achter Entwicklungszyklus

Der achte Prompt fordert fachliche Diagramm-Artefakte und eine praesentationsfaehigere Metamodel-Frontend-Ansicht.

Umgesetzt wurde:

- Neuer Ordner `docs/diagrams` mit Mermaid-Quellen fuer Klassendiagramm, Model-vs-Metamodel, ConnectionRule-Beispiele, ViewpointRule-Diagramm und Validierungsablauf.
- Markdown-Erklaerungen und Diagrammindex mit Render-Hinweisen.
- Keine SVG/PNG-Exports, weil kein Mermaid-Renderer im Projekt vorhanden ist und keine neue schwere Dependency eingefuehrt wurde.
- Metamodel-Ansicht mit Header/KPIs, Filterleiste, Suche, Toggles und Tabs.
- Component Types nach Layer/Category gruppiert.
- Connection Rules als filterbare und sortierbare Source-Relation-Target-Tabelle.
- Viewpoints und ValidationRules als eigene Tabs.
- Rule Graph mit EAM-Kernansicht, BPMN-Ausblendung, Kantenlabels, Pfeilen, Limit-Warnung und Detailpanel.

## Neunter Entwicklungszyklus

Der neunte Prompt fordert, das Metamodell als eine einzelne JSON-Datei importierbar/exportierbar zu machen und den Rule Graph weiter lesbarer zu gestalten.

Umgesetzt wurde:

- Metamodel JSON als fachliche Austauschstruktur mit `metamodel`, `componentTypes`, `connectionTypes`, `connectionRules`, `viewpoints`, `viewpointRules` und `validationRules`.
- Default-EAM-Metamodell unter `backend/src/data/default-metamodel.json`.
- Backend-Endpunkte fuer Export, Default-Download und Import.
- Importvalidierung fuer Pflichtfelder, eindeutige IDs und Referenzen.
- Atomischer Import ohne stille Teilimporte; bestehende Diagramme bleiben erhalten und erhalten die importierte `metamodelId`.
- Frontend-Aktionen fuer Export, Import und Download des Default-EAM-Metamodells.
- Rule Graph mit `Simplified`, `Detailed` und `Viewpoint`-Modus, gruppierten Kantenlabels und verbessertem Detailpanel.
- Dokumentation des JSON-Formats, der MVP-Grenzen und der verbliebenen Code-Fallbacks.
