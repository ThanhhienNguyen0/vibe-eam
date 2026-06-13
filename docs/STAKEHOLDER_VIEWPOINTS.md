# Stakeholder Viewpoints

Stakeholder bleiben im Metamodell normale, modellierbare Component Types. Ein Stakeholder kann also als Knoten im Diagramm erscheinen, zum Beispiel mit `responsible_for` oder `interested_in`-Beziehungen.

Viewpoints sind nicht dasselbe wie Stakeholder-Knoten. Ein Viewpoint ist eine Sicht bzw. ein Rollenfilter auf das Metamodell: Er legt fest, welche Component Types, Connection Types und Connection Rules fuer eine Rolle sichtbar, erlaubt oder verpflichtend sind.

Die konkrete Regelmenge liegt in `ViewpointRule`. Der `Viewpoint` beschreibt fachlich die Rolle und den Zweck, waehrend `ViewpointRule` die erlaubten und verpflichtenden Typen, Verbindungstypen und ConnectionRules enthaelt. Dadurch bleibt die Stakeholder-Perspektive als Sicht steuerbar, ohne Stakeholder als normale Diagrammelemente zu verlieren.

In der Metamodel-UI kann ein Viewpoint als Filter ausgewaehlt werden. Dann werden Component Types, Connection Rules und der Rule Graph auf die fuer diese Rolle relevanten Regeln reduziert. Ohne Viewpoint-Filter zeigt die UI eine EAM-fokussierte Standardsicht; BPMN-Typen werden im Rule Graph erst sichtbar, wenn der Layer `BPMN` explizit gewaehlt wird.

## Management View

Zweck: Schnelle Uebersicht ueber geschaeftskritische Architekturteile.

Erlaubte Typen:

- Stakeholder
- Goal / Objective
- Business Capability
- Application

Erlaubte Verbindungen:

- interested_in
- supports
- serves

## Business Owner View

Zweck: Geschaeftsprozesse, Capabilities und unterstuetzende Anwendungen verstehen.

Erlaubte Typen:

- Business Capability
- Business Process
- Application
- Stakeholder

Erlaubte Verbindungen:

- realizes
- serves
- responsible_for

## Application Owner View

Zweck: Anwendungsabhaengigkeiten und Datenabhaengigkeiten verstehen.

Erlaubte Typen:

- Application
- Data Object
- Technology Node
- Stakeholder

Erlaubte Verbindungen:

- uses
- depends_on
- owns
- responsible_for

## IT Operations View

Zweck: Technische Betriebsabhaengigkeiten analysieren.

Erlaubte Typen:

- Application
- Technology Node
- Data Object

Erlaubte Verbindungen:

- depends_on
- uses

## Full Architecture View

Zweck: Vollstaendige Sicht fuer Architektinnen und Architekten.

Erlaubte Typen:

- alle initialen EAM Component Types

Erlaubte Verbindungen:

- alle initialen EAM Connection Types
