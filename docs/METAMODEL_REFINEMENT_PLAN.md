# Metamodel Refinement Plan

## Status vor dieser Aenderung

Der Metamodel Rule Builder besitzt bereits `ComponentType`, `ConnectionType`, `ConnectionRule`, `Viewpoint`, `Diagram`, `ComponentInstance`, `ConnectionInstance` und strukturierte Validierungsergebnisse. `ConnectionRule` ist die primaere fachliche Quelle fuer erlaubte Verbindungen; `allowedSourceTypeIds` und `allowedTargetTypeIds` in `ConnectionType` existieren nur noch als Legacy-/Kompatibilitaetsfelder.

Die aktuelle Validierung erzeugt ein Ergebnis zur Laufzeit. In der Dokumentation wurde `ValidationResult` aber noch zu stark wie ein dauerhaftes Bestandteilobjekt eines Diagramms beschrieben. Viewpoint-Einschraenkungen liegen direkt auf `Viewpoint` (`allowedComponentTypeIds`, `requiredConnectionTypeIds` usw.). Diagramme haben bisher nur optional `viewpointId`, aber keinen expliziten Bezug zum aktiven Metamodel.

## Erkannte fachliche Schwaechen

- `ValidationResult` muss als Ergebnis eines Validierungslaufs verstanden werden, nicht als gespeichertes Diagramm-Kind.
- `Viewpoint` vermischt Sichtbeschreibung und konkrete Regelmengen. Fachlich sauberer ist: `Viewpoint` beschreibt Rolle/Zweck, `ViewpointRule` beschreibt erlaubte und verpflichtende Elemente.
- Diagramme sollten klar gegen ein Metamodel validiert werden. Fehlt `metamodelId`, wird fuer Bestandsdaten das aktive Metamodel angenommen.
- Pflichtregeln pruefen bislang hauptsaechlich, ob Typen oder Verbindungstypen irgendwo im Diagramm vorkommen. KMU-EAM braucht zusaetzlich typbezogene Mindestbeziehungen, z. B. Application braucht Verantwortlichkeit.

## Geplante Aenderungen

1. `ValidationResult` bleibt als Type erhalten, wird aber nur als Rueckgabe von `validateDiagram`/Validierungslogik verwendet. `ValidationMessage` erhaelt optional `scope` und `ruleType`.
2. Neue Struktur `ViewpointRule`:
   - `viewpointId`
   - erlaubte Component Types, Connection Types und Connection Rules
   - verpflichtende Component Types, Connection Types und Connection Rules
   - optionale Sichtbarkeits-/Editierfelder
3. Neue Struktur `ValidationRule`:
   - prueft Mindestbeziehungen pro Komponententyp
   - kann `error` oder `warning` erzeugen
   - ergaenzt ConnectionRule und ViewpointRule, ersetzt sie aber nicht
4. `Diagram` erhaelt optional `metamodelId`. Neue Diagramme bekommen die ID des aktiven Metamodels; alte Diagramme werden beim Normalisieren ergaenzt.
5. Validierung nutzt in dieser Reihenfolge:
   - Metamodel-Konformitaet und ConnectionRule
   - ViewpointRule, falls ein Viewpoint gesetzt ist
   - ValidationRule fuer Mindestqualitaet und typbezogene Pflichtbeziehungen

## Migrationsstrategie ohne Rewrite

- Bestehende `Viewpoint`-Felder bleiben aus Kompatibilitaetsgruenden erhalten.
- Beim Laden alter Daten werden `ViewpointRule`-Eintraege aus vorhandenen Viewpoint-Feldern erzeugt, falls noch keine vorhanden sind.
- Bestehende Diagramme erhalten `metamodelId` des aktiven Metamodels.
- Bestehende ConnectionRules bleiben unveraendert primaere Quelle fuer erlaubte Verbindungen.
- Seed-Daten werden erweitert, nicht ersetzt.

## Risiken

- Wenn alte Viewpoint-Felder und neue ViewpointRules auseinanderlaufen, kann es fachlich widerspruechliche Konfiguration geben. Im MVP gilt `ViewpointRule` primaer.
- Typbezogene ValidationRules koennen bei unfertigen Diagrammen viele Warnungen erzeugen. Darum werden Qualitaetsregeln initial ueberwiegend als `warning` modelliert.
- OR-Regeln, z. B. "Application nutzt Data Object oder haengt an Technology Node", werden im MVP nicht vollstaendig als zusammengesetzte Regel modelliert.

## MVP-Grenzen

- Kein vollstaendiger Regel-Designer fuer ValidationRules.
- Keine Versionierung mehrerer aktiver Metamodelle.
- Keine harte Persistenz von ValidationResult; Ergebnisse werden berechnet.
- Keine komplexen booleschen Pflichtregeln. Die erste Ausbaustufe prueft einfache Mindestbeziehungen.
