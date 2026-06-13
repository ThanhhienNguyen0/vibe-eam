# Metamodel Rule Builder

## Zweck

Der Metamodel Rule Builder macht die vorhandene Sidebar- und Diagrammstruktur fachlich konfigurierbar. Ein KMU-Kunde kann festlegen, welche Component Types, Connection Types und Stakeholder-Sichten beim Diagrammbau erlaubt sind.

## Zielgruppe

Die Funktion richtet sich an KMU-Kunden, die EAM-Modellierung vereinfachen wollen. Mitarbeitende sollen nicht frei beliebige Diagramme bauen, sondern innerhalb eines vereinbarten Metamodells arbeiten.

## Modell vs. Metamodell

- Modell: konkrete Komponenten und Verbindungen, zum Beispiel `ERP System serves Order to Cash`.
- Metamodell: Regeln, welche Arten von Komponenten und Verbindungen erlaubt sind, zum Beispiel `Application may serve Business Process`.

## Component Types

Component Types beschreiben erlaubte Bausteine im Modell. Sie enthalten `id`, `name`, `description`, `category`/`layer`, `color`, `icon`, `shape`, `customPropertyKeys` und optionale Viewpoint-Regeln.

Initiale EAM-Typen sind unter anderem:

- Stakeholder
- Goal / Objective
- Business Capability
- Business Process
- Application
- Data Object
- Technology Node
- Organizational Unit

## Connection Types Und Connection Rules

Connection Types beschreiben nur die Art einer Beziehung, zum Beispiel `serves`, `uses` oder `responsible_for`. Die fachliche Wahrheit, welche Source-/Target-Kombination erlaubt ist, liegt in `ConnectionRule`.

Initiale EAM-Verbindungen sind unter anderem `realizes`, `serves`, `uses`, `depends_on`, `owns`, `responsible_for`, `interested_in`, `supports` und `reports_to`.

Eine ConnectionRule sagt explizit:

`Source Component Type -- Connection Type --> Target Component Type`

Beispiele:

- `Business Process --realizes--> Business Capability`
- `Application --serves--> Business Process`
- `Stakeholder --responsible_for--> Application`
- `Stakeholder --interested_in--> Business Capability`
- `Goal / Objective --supports--> Business Capability`

Die alten Felder `allowedSourceTypeIds` und `allowedTargetTypeIds` bleiben nur als Kompatibilitaetsfelder an `ConnectionType` erhalten. Sie erzeugen keine fachlichen `ConnectionRule`s mehr. Bereits gespeicherte `legacy-rule-*`-Eintraege werden beim Laden verworfen; importierte Metamodel-JSON-Dateien mit solchen Regeln werden abgelehnt.

## Viewpoints Und ViewpointRules

Viewpoints sind Stakeholder-Sichten. Der Viewpoint selbst beschreibt Name, Rolle und Zweck. Die konkrete Einschraenkung liegt fachlich in `ViewpointRule`.

Eine ViewpointRule legt fest:

- erlaubte Component Types
- erlaubte Connection Types
- erlaubte Connection Rules
- verpflichtende Component Types
- verpflichtende Connection Types oder Connection Rules

Die alten Listenfelder direkt am `Viewpoint` bleiben als Legacy-/Kompatibilitaetsfelder erhalten. Beim Laden alter Daten koennen daraus ViewpointRules normalisiert werden.

Ein Diagramm kann einem Viewpoint zugeordnet werden. Der DiagramEditor filtert dann die Palette und verhindert ungueltige Verbindungen. Das Backend validiert dieselben Regeln beim Speichern.

## Pflichtregeln Und ValidationRules

Pflichtregeln aus `ViewpointRule` werden in der Diagrammvalidierung geprueft:

- `requiredComponentTypeIds`: jeder Typ muss mindestens einmal vorkommen.
- `requiredConnectionTypeIds`: jeder Verbindungstyp muss mindestens einmal vorkommen.
- `requiredConnectionRuleIds`: eine konkrete Source-Relation-Target-Regel muss mindestens einmal vorkommen.

Zusaetzlich gibt es `ValidationRule` fuer typbezogene Mindestbeziehungen. Beispiele:

- Jede `Application` sollte eine eingehende `responsible_for`-Beziehung von einem `Stakeholder` haben.
- Jede `Business Capability` sollte durch mindestens einen `Business Process` realisiert werden.
- Jede `Application` sollte mindestens einen `Business Process` bedienen.
- Im MVP wird eine technische Abhaengigkeit als einfache Warnregel `Application --depends_on--> Technology Node` modelliert; zusammengesetzte OR-Regeln sind noch nicht umgesetzt.

Pflichtregeln blockieren nicht jeden Zwischenschritt beim Modellieren. Sie werden bewusst ueber `Validate diagram` geprueft, damit Diagramme iterativ entstehen koennen.

## Diagrammvalidierung

Die zentrale Validierung prueft:

- Diagrammbezug zum aktiven `Metamodel` (`metamodelId`, falls vorhanden).
- Source-/Target-Kombinationen ueber explizite ConnectionRules.
- ViewpointRule-erlaubte Component Types.
- ViewpointRule-erlaubte Connection Types.
- ViewpointRule-erlaubte ConnectionRules.
- Vollstaendige sichtbare Endpunkte je Verbindung.
- Pflichtkomponenten, Pflichtverbindungen und ValidationRules.

`ValidationResult` wird fuer jeden Lauf erzeugt. Es ist kein dauerhaft gespeicherter Bestandteil eines Diagramms. Meldungen enthalten `severity`, `scope` und optional `ruleType`, damit UI und Backend zwischen Metamodel-Fehlern, Viewpoint-Fehlern und Pflichtregelwarnungen unterscheiden koennen.

Fehlermeldungen sind fachlich lesbar, zum Beispiel:

- `Data Object may not be connected to Business Capability with serves.`
- `Technology Node is not allowed in the selected Management View.`
- `Required component type 'Business Capability' is missing.`
- `Required connection type 'serves' is missing.`

## Stakeholder Als Modellierbarer Component Type

Stakeholder sind bewusst normale Component Types. Dadurch koennen Stakeholder-Beziehungen direkt im Diagramm sichtbar werden, statt nur implizit ueber einen Viewpoint zu existieren. Beispiele:

- `Stakeholder responsible_for Application`
- `Stakeholder interested_in Business Capability`

Viewpoints sind dagegen Rollenfilter und Sichten auf das Metamodell. Ein Stakeholder-Knoten im Diagramm ist ein Modellelement; ein Viewpoint beschreibt, welche Modellinhalte fuer eine Rolle sichtbar oder verpflichtend sind.

## Visualisierung

Die neue Ansicht `Metamodel` zeigt:

- Header mit KPI-Karten fuer Component Types, Connection Rules, Viewpoint Rules und Validation Rules.
- Filter fuer Viewpoint, Layer, Connection Type und Suche.
- Tabs fuer Overview, Component Types, Connection Rules, Viewpoints, Validation Rules und Rule Graph.
- Component Types gruppiert nach Layer oder Category.
- ConnectionRules als lesbare Tabelle `Source -> Relation -> Target`.
- Viewpoints als Stakeholder-Sichten mit Zweck, erlaubten Typen und Pflichtregeln.
- ValidationRules als eigene Qualitaetsregeln.
- Rule Graph mit reduzierter EAM-Kernansicht, Pfeilen, gruppierten Kantenlabels und Detailpanel.
- Import-/Export-Aktionen fuer Metamodel JSON.

Die Standardansicht fokussiert bewusst auf EAM-Typen. BPMN-Typen bleiben im System vorhanden, werden im Rule Graph aber standardmaessig ausgeblendet, damit PO, Teamleitung und KMU-Kunden nicht durch technische oder prozessnotationelle Altlasten ueberladen werden. Wer BPMN inspizieren will, kann den Layer `BPMN` explizit auswaehlen.

Der Rule Graph bietet drei Darstellungsmodi:

- `Simplified`: zeigt Core-EAM-Regeln, gruppiert mehrere ConnectionTypes zwischen denselben ComponentTypes und blendet BPMN aus. Dieser Modus ist fuer Praesentation und PO-Kommunikation gedacht.
- `Detailed`: zeigt gefilterte ConnectionRules einzeln und begrenzt die Anzeige auf 50 Regeln, damit Labels nicht vollstaendig ueberladen.
- `Viewpoint`: zeigt nur Regeln des gewaehlten Viewpoints. Ohne Viewpoint-Auswahl wird bewusst ein Hinweis angezeigt.

KMU-Kunden koennen Regeln in der UI fachlich nachvollziehen:

- "Welche Bausteine darf ich modellieren?" ueber den Tab `Component Types`.
- "Welche Beziehungen sind erlaubt?" ueber den Tab `Connection Rules`.
- "Welche Sicht braucht welche Rolle?" ueber den Tab `Viewpoints`.
- "Welche Mindestqualitaet muss ein Diagramm erreichen?" ueber den Tab `Validation Rules`.
- "Wie haengen die Regeln visuell zusammen?" ueber den Tab `Rule Graph`.

## Fachliche Diagramm-Artefakte

Zusaetzlich zur UI liegen Mermaid-Quellen unter [docs/diagrams](./diagrams/README.md). Sie sind fuer Team-/PO-Kommunikation gedacht und erklaeren Klassensicht, Modell vs. Metamodell, ConnectionRule-Beispiele, ViewpointRules und den Validierungsablauf.

## Metamodel JSON Import/Export

Das fachliche Regelwerk kann als eine JSON-Datei exportiert und wieder importiert werden. Diese Datei enthaelt:

- `metamodel`
- `componentTypes`
- `connectionTypes`
- `connectionRules`
- `viewpoints`
- `viewpointRules`
- `validationRules`

Sie enthaelt keine konkreten Diagramme, ComponentInstances oder ConnectionInstances. Damit bleibt das Metamodell ein versionierbares Konfigurationsartefakt und nicht nur Seed-Code.

Backend-Endpunkte:

- `GET /api/sidebar/metamodel/export`
- `GET /api/sidebar/metamodel/default`
- `POST /api/sidebar/metamodel/import`

Der Import validiert Pflichtfelder, eindeutige IDs und Referenzen. Wenn die Datei ungueltig ist, wird der Import vollstaendig abgebrochen. Das MVP nutzt `replace active metamodel`: Das Regelwerk wird ersetzt, bestehende Diagramme bleiben erhalten und werden danach gegen das importierte Metamodell validiert.

Die Default-Definition liegt unter `backend/src/data/default-metamodel.json`. Einige bestehende Seed-/Normalisierungsfunktionen bleiben im Code als technische Rueckfalllogik erhalten. Fachliche Verbindungsregeln kommen aber aus expliziten `ConnectionRule`s; Legacy-Ableitungen werden nicht mehr als Regeln akzeptiert.

Das Format ist in [docs/METAMODEL_JSON_FORMAT.md](./METAMODEL_JSON_FORMAT.md) dokumentiert.

## Grenzen des MVP

- Keine vollstaendige ArchiMate-Konformitaet.
- Keine rollenbasierte Berechtigung.
- Keine Datenbankmigration; JSON-Persistenz wird additiv normalisiert.
- Keine vollstaendige Regel-DSL.
- Keine kollaborative Governance-Freigabe.
- Keine automatisierten UI-E2E-Tests.
- Kein Merge-Import; der Import ersetzt im MVP das aktive Regelwerk.
- Keine vollstaendige Entfernung aller Code-Fallback-Seeds, weil sie weiterhin fuer Bestanddatennormalisierung genutzt werden.
