# AI Reflection Log

## Erfuellte Anforderungen

- Projektstruktur mit `/frontend`, `/backend`, `/docs`, Root `README.md` und Root `package.json`.
- Backend mit Node.js, Express, REST API und JSON-Dateipersistenz.
- Seed-Modell mit 12 Elementen und 12 Relationen.
- React/TypeScript/Vite Frontend.
- React Flow Canvas ist implementiert.
- Eigenschaftenpanel fuer Elementattribute ist implementiert.
- Relationserstellung ueber Formular und Canvas-Verbindung ist implementiert.
- Validierung fuer Relationen, Elemente und Importstruktur ist implementiert.
- Ein explizites EAM-Metamodell ist implementiert.
- Relationen werden semantisch nach Source Type, Relation Type und Target Type validiert.
- Das Metamodell erlaubt nur die sieben im zweiten Zyklus definierten Relationstyp-Kombinationen; direkte Application-to-Capability-Realization ist bewusst nicht erlaubt.
- Impact-Analyse unterstuetzt Downstream Business Impact und Upstream Dependencies.
- Risk-Cost Portfolio Ansicht mit berechnetem Impact Score, Impact Level, Portfolio-Kategorie und praesentationsfaehiger 2x2-X/Y-Bubble-Matrix ist implementiert.
- Canvas-Edges zeigen sichtbare Pfeile und Relationstyp-Labels.
- Filter nach Layer und Elementtyp sowie Risiko-/Kosten-Heatmap sind implementiert.
- Capability Map wird dynamisch aus Modelldaten und Relationen abgeleitet.
- Lifecycle Roadmap wird aus echten Modelldaten erzeugt.
- JSON Export und Import sind roundtrip-faehig fuer valide Modelle.
- Audit Log schreibt Eintraege fuer Create, Update, Delete und Import.

## Tatsaechlich Gepruefte Punkte

- `npm install` erfolgreich.
- `npm run typecheck` erfolgreich.
- `npm run build` erfolgreich.
- Frontend HTTP 200 auf `http://localhost:5173`.
- Backend `GET /api/model` liefert 12 Elemente und 12 Relationen.
- Alle geforderten REST-Endpunkte wurden angesprochen.
- Element Create, Patch und Delete funktionieren.
- Relation Create und Delete funktionieren.
- Import/Export Roundtrip war modellgleich.
- Audit Log schrieb Eintraege fuer Create, Update, Delete und Import.
- Ungueltige Selbstrelation wird abgelehnt.
- Ungueltiger Import ohne `elements`/`relations` wird mit HTTP 400 abgelehnt.
- Unit Tests pruefen erlaubte Relation, ungueltige Relation, beide Impact-Modi und Zyklusvermeidung.
- Unit Tests pruefen zusaetzlich Impact Score, Impact Level, Portfolio-Kategorie, Deduplizierung mehrfach erreichter Impact-Elemente, Normalisierung und Risiko-Bubble-Groessen.

## Teilweise Erfuellte Anforderungen

- Canvas und Eigenschaftenpanel sind implementiert, aber nicht mit einem automatisierten Browser-E2E-Test geprueft.
- Heatmap und Filter sind im Code unabhaengig verdrahtet, aber die visuelle Darstellung wurde nicht automatisiert pixel- oder DOM-basiert validiert.
- Capability Map ist dynamisch und profitiert von validierten Relationen, bleibt aber fachlich heuristisch: Applications werden ueber `serves` zu Prozessen und ueber `realizes` zu Capabilities zugeordnet.
- Risk-Cost Portfolio ist visuell und interaktiv verbessert, inklusive Management-Matrix, Detailkarte und einklappbarer Tabelle, bleibt aber eine MVP-Heuristik ohne validiertes Scoring-Modell fuer Business Criticality, Technical Fit oder Functional Fit.
- Lifecycle Roadmap ist eine Tabelle, keine vollwertige interaktive Timeline.
- Audit Log speichert Ereignisse, aber keine detaillierten Before/After-Diffs.
- JSON-Dateipersistenz ist fuer das Forschungsartefakt ausreichend, aber nicht transaktionssicher.

## Nicht Erfuellte Anforderungen

- Kein echtes Auth-System.
- Kein produktionsreifes Deployment.
- Keine kollaborative Bearbeitung.
- Keine automatisierte Integration- oder E2E-Test-Suite.
- Keine vollstaendige ArchiMate-, TOGAF- oder BPMN-Konformitaet.
- Keine semantische Validierung von Lifecycle-Datumslogik, Ownership, Capability-Hierarchie oder Governance-Workflows.
- Keine direkte Relation von Application Component zu Business Capability; Application-Coverage laeuft im MVP ueber Business Processes.
- Keine echte Application-Portfolio-Methodik; die Portfolio-Kategorien sind einfache Regeln.

## Gefundene Und Behobene Kleine Fehler

- Importvalidierung konnte bei fehlenden `elements` oder `relations` als Serverfehler enden. Behoben: strukturell ungueltige Imports liefern jetzt HTTP 400 mit Validierungsfehlern.
- Canvas-Verbindung wurde optimistisch als Edge eingefuegt, bevor die API die Relation validiert hatte. Behoben: Edge erscheint nun erst ueber das aktualisierte Modell nach erfolgreicher API-Erstellung.
- Zweiter Zyklus: Fachliches Metamodell eingefuehrt, semantische Relationvalidierung ergaenzt, Relationserstellung im UI eingeschraenkt und Impact-Analyse in zwei fachlich benannte Modi aufgeteilt.
- Nachschaerfung: Eine vorher dokumentierte optionale Shortcut-Relation `Application Component realizes Business Capability` wurde entfernt, um der strengeren Aufgabenliste zu entsprechen.
- Phase 3: Risk-Cost Portfolio, Impact Score, verbesserte Pfeildarstellung im Canvas und Demo-Hilfetexte ergaenzt.
- Portfolio-Ansicht nachgeschaerft: 2x2-Management-Matrix, horizontale Achsenlabels, Layer-Farben, Hover-Tooltip, Bubble-Auswahl, Detailkarte und einklappbare kompakte Tabelle.

## Annahmen

- `Business Capability` und `Business Process` liegen auf der Business-Schicht.
- Node-Positionen duerfen als technisches UI-Feld im Element gespeichert werden.
- Die REST API darf bei Import das gesamte Modell ersetzen.
- Kosten sind einfache numerische Werte ohne Waehrungs- oder Periodenmodell.
- Portfolio-Kategorien basieren auf einfachen Schwellwerten fuer Kosten, Risiko und Impact.
- Lifecycle-Daten werden als ISO-Datumstrings gepflegt.
- Impact bedeutet im zweiten MVP-Zyklus: Downstream Business Impact und Upstream Dependencies folgen den in `docs/IMPACT_ANALYSIS.md` dokumentierten Traversierungsregeln.

## Technische Abkuerzungen

- JSON-Datei statt SQLite.
- Keine Repository-/Service-/Controller-Schichtung jenseits einfacher Module.
- Keine Debounce-Strategie fuer haeufige UI-Updates im Eigenschaftenpanel.
- Keine Konfliktbehandlung fuer parallele Bearbeitung.
- Keine API-Paginierung.
- Keine robuste Schema-Library wie Zod oder Ajv; das Metamodell ist eine kleine TypeScript-Regelbasis.

## Menschliche Review Noetig

- Fachliche Semantik der Impact-Analyse: die neuen Regeln sind explizit, sollten aber fachlich reviewt werden.
- Fachliche Korrektheit der Capability-zu-Application-Zuordnung.
- Fachliche Belastbarkeit der Portfolio-Scoring-Formel und der Kategorien.
- Sinnhaftigkeit der Kosten-Heatmap-Schwellen.
- Ob JSON-Persistenz fuer die geplante Demonstration reicht.
- UI-Usability im echten Browser, inklusive Canvas Drag & Drop, Panel-Bearbeitung, Import-Dialog und Relationserstellung per Maus.
- Sicherheitsreview der npm vulnerabilities.

## Moegliche Halluzinationen Oder Unsichere Designentscheidungen

- Seed-Daten sind fiktiv und nicht aus einer realen Unternehmensarchitektur abgeleitet.
- EAM-Begriffe sind jetzt in einem kleinen lokalen Metamodell verankert, aber nicht in einem verbindlichen Standard wie ArchiMate.
- Die Evaluation Matrix ist eine technische Selbsteinschaetzung nach Smoke-Tests und Codepruefung, keine unabhaengige Qualitaetssicherung.

## Vierter Entwicklungszyklus: Metamodel Rule Builder

### Annahmen ueber KMU-Kunden

- KMU-Kunden brauchen eher wenige, verstaendliche Modellierungsregeln als einen vollstaendigen Architekturstandard.
- Unterschiedliche Stakeholder brauchen reduzierte Sichten, damit Diagramme nicht zu technisch oder zu breit werden.
- Pflichtregeln sollten pruefbar sein, aber den iterativen Diagrammaufbau nicht bei jedem Zwischenschritt blockieren.

### Fachlich vereinfachte Regeln

- Viewpoints enthalten einfache Allow-/Require-Listen statt einer komplexen Regel-DSL.
- `allowedSourceTypeIds` und `allowedTargetTypeIds` modellieren Typkombinationen grob und ohne Kardinalitaeten.
- Pflichtverbindungen werden als mindestens einmal vorkommender Verbindungstyp geprueft, nicht als vollstaendige Pattern-Regel.
- Das Metamodell ist EAM-inspiriert, aber keine vollstaendige ArchiMate-Implementierung.

### Weiterhin noetige menschliche Review

- Ob die initialen Viewpoints fuer die Ziel-KMU fachlich passen.
- Ob `Application serves Business Capability` direkt erlaubt bleiben soll oder nur ueber Business Process laufen darf.
- Ob Pflichtregeln je Viewpoint zu streng oder zu locker sind.
- Ob die Metamodel-Visualisierung bei groesseren Kundenmetamodellen ausreichend lesbar bleibt.

## Fuenfter Entwicklungszyklus: Explizite ConnectionRules

### Warum Das Vorherige Modell Fachlich Grob War

- `allowedSourceTypeIds` und `allowedTargetTypeIds` am ConnectionType vermischten Beziehungstyp und Beziehungserlaubnis.
- Eine einzelne erlaubte Verbindung hatte keine eigene Begruendung, Severity, Pflichtmarkierung oder Viewpoint-Einschraenkung.
- Die Visualisierung zeigte abgeleitete Kombinationslisten statt expliziter fachlicher Regeln.

### Warum ConnectionRule Eingefuehrt Wurde

ConnectionRule modelliert die eigentliche fachliche Aussage: Source Component Type + Connection Type + Target Component Type. Dadurch kann eine Regel begruendet, als required/optional markiert, einem Viewpoint zugeordnet und in Validierungsergebnissen referenziert werden.

### Bewusste Stakeholder-Entscheidung

Stakeholder wurden bewusst als normale Diagrammelemente erhalten. Ein Stakeholder-Knoten kann direkt Beziehungen wie `responsible_for Application` oder `interested_in Business Capability` tragen. Viewpoints bleiben dagegen Rollenfilter und ersetzen Stakeholder nicht.

### Weiterhin Bestehende Annahmen

- Das Metamodell bleibt ein MVP und kein vollstaendiger ArchiMate-Standard.
- ConnectionRules bilden keine komplexe Regel-DSL mit Pfadbedingungen oder Vererbung ab.
- Legacy-Felder bleiben fuer Migration und Kompatibilitaet erhalten.
- Menschliche Fachreview ist noetig, um direkte Regeln wie `Application serves Business Capability` je Kunde zu bestaetigen.

## Sechster Entwicklungszyklus: Trennung Der Regelarten

### Fachliche Nachschaerfung

- `ValidationResult` wird nun bewusst als erzeugtes Ergebnis eines Validierungslaufs verstanden, nicht als persistiertes Diagramm-Bestandteilobjekt.
- `ViewpointRule` trennt die konkrete Regelmenge von der Viewpoint-Beschreibung. Der Viewpoint bleibt Rolle/Zweck, die ViewpointRule enthaelt Allow-/Require-Listen.
- Diagramme werden ueber `metamodelId` gegen das aktive Metamodel eingeordnet; fehlende Bestandswerte werden beim Laden normalisiert.
- `ValidationRule` ergaenzt typbezogene Mindestbeziehungen, zum Beispiel Application braucht verantwortliche Stakeholder-Beziehung.

### Weiterhin Bestehende MVP-Grenzen

- Zusammengesetzte OR-Regeln sind noch nicht implementiert. Die daten- oder technologiebezogene Application-Pflicht ist im MVP eine einfache Technology-Dependency-Warnregel.
- Es gibt noch keinen vollstaendigen UI-Editor fuer ValidationRules.
- Viewpoint-Legacy-Felder bleiben vorhanden, koennen aber fachlich von ViewpointRules abweichen. Primaer ist nun ViewpointRule.
- Menschliche Review bleibt noetig, um die Severity der neuen Pflichtbeziehungsregeln je KMU festzulegen.

## Siebter Entwicklungszyklus: Kritische Pruefung

### Pruefergebnis

- Die vier Nachschaerfungen sind im Code implementiert und nicht nur dokumentiert.
- Kleine Testluecken wurden gefunden und geschlossen.
- `ValidationResult`, `ViewpointRule`, `Diagram.metamodelId` und `ValidationRule` sind als Strukturen und in der Validierungslogik vorhanden.

### Kritische Restpunkte

- Die OR-Regel fuer daten- oder technologiebezogene Application-Abhaengigkeit bleibt eine MVP-Vereinfachung.
- Legacy-Felder `allowedSourceTypeIds` und `allowedTargetTypeIds` koennen fuer Migration in explizite ConnectionRules umgewandelt werden. Das ist technisch nachvollziehbar, sollte bei echten Kundendaten aber reviewt werden.
- Die UI zeigt ViewpointRules und ValidationRules, bietet aber noch keinen vollstaendigen dedizierten Editor fuer diese neuen Regelarten.

## Achter Entwicklungszyklus: Praesentationsfaehige Metamodel-Sicht

### Kritische Ausgangslage

- Die vorherige Metamodel-Ansicht war funktional, aber fuer PO, Teamleitung und KMU-Kunden zu unstrukturiert.
- EAM- und BPMN-Typen wurden gemeinsam dargestellt, wodurch der Rule Graph schnell ueberladen und schwer erklaerbar wurde.
- Die Visualisierung zeigte zu viele Regeln gleichzeitig und hatte starke Ueberlappungen.

### Umgesetzte Verbesserung

- Fachliche Mermaid-Diagramme wurden als Primaerquellen unter `docs/diagrams` angelegt.
- Die Metamodel-UI wurde in Summary, Filter und Tabs gegliedert.
- Der Rule Graph zeigt standardmaessig eine reduzierte EAM-Kernansicht und blendet BPMN aus, bis BPMN explizit gefiltert wird.
- ConnectionRules, ViewpointRules und ValidationRules sind getrennt sichtbar.

### Weiterhin MVP

- Es gibt keine automatische Graph-Layout-Engine; das Layout ist bewusst einfach berechnet.
- Mermaid-Exporte als SVG/PNG wurden nicht erzeugt, weil kein Renderer im Projekt vorhanden ist und keine neue Doku-Dependency eingefuehrt wurde.
- Die UI ist besser praesentierbar, aber noch kein vollstaendiger Governance-Editor.

## Neunter Entwicklungszyklus: Metamodel JSON Und Lesbarerer Rule Graph

### Warum JSON-Konfiguration Wichtig Ist

- Ein KMU-Metamodell sollte nicht nur als verstreuter Seed-Code existieren, sondern als versionierbares Kundenartefakt.
- Eine einzelne JSON-Datei macht Regeln reproduzierbar, reviewbar und kundenspezifisch anpassbar.
- Export/Import trennt fachliches Regelwerk von konkreten Diagramminstanzen.

### Umgesetzte Hardcoding-Reduktion

- Eine Default-EAM-Definition wurde als `backend/src/data/default-metamodel.json` angelegt.
- Backend-Endpunkte exportieren/importieren nur das Metamodell: ComponentTypes, ConnectionTypes, ConnectionRules, Viewpoints, ViewpointRules und ValidationRules.
- Importvalidierung prueft Pflichtfelder, eindeutige IDs und Referenzen, bevor der Store geschrieben wird.

### Weiterhin MVP

- Bestehende Code-Seeds bleiben als technische Rueckfall- und Migrationslogik erhalten, insbesondere fuer Legacy- und BPMN-Daten.
- Der Import nutzt `replace active metamodel`; ein sicherer Merge-Modus ist noch nicht umgesetzt.
- Die UI importiert direkt und zeigt das ImportResult, aber noch keine vollstaendige Preview mit manueller Freigabe.
- Der Rule Graph ist durch Simplified/Detailed/Viewpoint-Modi lesbarer, nutzt aber weiterhin ein einfaches berechnetes SVG-Layout statt einer spezialisierten Graph-Layout-Engine.

## Zehnter Entwicklungszyklus: PostgreSQL und Docker

### Entscheidung und Nutzen

- PostgreSQL plus Prisma balanciert relationale Integrität und flexible JSONB-Attribute besser als der bisherige gemeinsame JSON-State.
- Die Store-Abstraktion hält die bestehenden fachlichen Strukturen stabil; dadurch mussten DiagramEditor, ConnectionRule-Validierung und Metamodel-Import/-Export nicht neu geschrieben werden.
- Datenbankseitige Cascades sind robuster als ausschließlich anwendungsseitiges Aufräumen von ConnectionInstances.

### Kritische Grenzen

- Der Legacy-Pfad `/api/model` bleibt als klar benannte Restgrenze JSON-basiert.
- Der kompatible Full-State-Write ist für das MVP verständlich und transaktional, aber nicht die endgültige Lösung für große Datenbestände oder parallele Benutzer.
- Nullable `diagramId` ist eine bewusste Anpassung an den bestehenden zweistufigen Editor-Ablauf. Ein späterer API-Schnitt sollte Diagrammzuordnung bereits beim Erstellen verlangen.
- Docker automatisiert lokalen Betrieb, ist aber weder Deployment- noch Security-Konzept. Beispiel-Credentials müssen außerhalb lokaler Entwicklung ersetzt werden.

## Elfter Entwicklungszyklus: Umgebungen und Hosting-Vorbereitung

### Trennungsentscheidung

- Staging und Produktion werden als eigenständige Compose-Projekte betrieben, nicht als schwer nachvollziehbare Kombination vieler Overrides.
- Eigene DB-Namen, Benutzer, Named Volumes und Loopback-Ports reduzieren das Risiko, Testdaten mit Produktion zu vermischen.
- Die lokale `docker-compose.yml` bleibt bestehen; Windows verwendet auf diesem Rechner `docker.exe compose`, Linux üblicherweise `docker compose`.

### Hosting-Entscheidung

- Die bestehende Hauptdomain bleibt unangetastet. Produktion nutzt `eam.messers-cardio-club.de`, Staging `eam-test.messers-cardio-club.de`.
- TLS endet am bereits servernah gedachten Host-Nginx. Containerports bleiben auf `127.0.0.1`; PostgreSQL wird nicht veröffentlicht.
- Certbot/Let's Encrypt ist vorbereitet, aber DNS, Zertifikate und Serverkonfiguration wurden nicht extern verändert.

### Kritische Grenzen

- Ohne Auth ist eine öffentliche Live-Schaltung mit sensiblen EAM-Daten nicht verantwortbar; Issue #21 ist deshalb nur vorbereitet.
- Persistente Volumes ersetzen kein Backup. `pg_dump` und Restore müssen vor Live-Betrieb getestet werden.
- Deployment und Rollback bleiben ohne CI/CD manuell und können kurze Unterbrechungen verursachen.
- Automatische Deploy-Skripte wurden bewusst nicht erstellt, weil Serverpfad, Backup-Ziel und Freigabeprozess noch fehlen.

### Hosting-Readiness-Nachschärfung

- Der Erststart vor Certbot ist nun explizit von der finalen HTTPS-Konfiguration getrennt; dadurch werden Nginx-Fehler wegen noch fehlender Zertifikatspfade vermieden.
- Eine Readiness-Checkliste definiert Stop-/Go-Kriterien für lokal, Server-Staging und Server-Produktion. Ein separates Protokoll verhindert, dass „dokumentiert“ mit „tatsächlich abgenommen“ verwechselt wird.
- Fehlendes Auth wird nicht kleingeredet: Demo-Daten, serverweites Basic Auth oder Verschiebung sind die einzigen dokumentierten Übergangsoptionen.
- Backup, Restore und Rollback sind manuell beschrieben. Ein persistentes Volume allein bleibt ausdrücklich kein Backup.
