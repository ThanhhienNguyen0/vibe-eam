# Metamodel Refinement Check

## 1. Kurzfazit

Die vier fachlichen Nachschaerfungen sind im Code umgesetzt und nicht nur dokumentiert.

- `ValidationResult`: umgesetzt. Es wird von `validateDiagram(...)` erzeugt und nicht als Diagrammfeld persistiert.
- `ViewpointRule`: umgesetzt. Eigene TypeScript-Struktur, Seed-/Normalisierung und Verwendung in der Validierung vorhanden.
- Diagram-to-Metamodel Conformance: umgesetzt mit `Diagram.metamodelId`, Normalisierung alter Diagramme und Metamodel-Scope in Validierungsmeldungen.
- Staerkere `ValidationRule`s: umgesetzt als einfache typbezogene Mindestbeziehungsregeln. Die daten-oder-technologiebezogene OR-Regel ist nur als MVP-Warnregel fuer `Application --depends_on--> Technology Node` umgesetzt.

Kleine Testluecken wurden in diesem Pruefzyklus behoben. Es wurde keine neue grosse Funktionalitaet eingefuehrt.

## 2. Pruefergebnis Je Nachschaerfung

| Nachschaerfung | Implementierungsstatus | Code-Stellen | Teststatus | Restgrenzen |
| --- | --- | --- | --- | --- |
| ValidationResult als erzeugtes Pruefergebnis | Umgesetzt | `backend/src/Sidebar/metamodelRules.ts:16`, `backend/src/Sidebar/metamodelRules.ts:393`; `ValidationMessage` in `backend/src/Sidebar/sidebarTypes.ts:156` | Tests pruefen Rueckgabe von `validateDiagram` und strukturierte Messages | Es gibt zusaetzlich ein aelteres `backend/src/validation.ts` fuer ein anderes Modell; kein Konflikt, aber Namensgleichheit kann irritieren. |
| ViewpointRule | Umgesetzt | Type in `backend/src/Sidebar/sidebarTypes.ts:74`; Fallback/Lookup in `backend/src/Sidebar/metamodelRules.ts:102`; Seeds/Normalisierung in `backend/src/Sidebar/sidebarStore.ts:460`, `backend/src/Sidebar/sidebarStore.ts:854` | Tests pruefen Management View verbietet Technology Node und erlaubt Application | Viewpoint-Editor bearbeitet primar weiterhin Legacy-Viewpoint-Felder; ViewpointRule ist fachlich primaer, aber UI-Pflege bleibt MVP. |
| Diagram-to-Metamodel Conformance | Umgesetzt | `Diagram.metamodelId` in `backend/src/Sidebar/sidebarTypes.ts:130`; neue Diagramme in `backend/src/Sidebar/sidebarRoutes.ts:466`; Normalisierung in `backend/src/Sidebar/sidebarStore.ts:858`; Metamodel-Mismatch in `backend/src/Sidebar/metamodelRules.ts:403` | Tests pruefen fehlende `metamodelId` als aktives Metamodel und Mismatch-Scope | Es gibt nur ein aktives Metamodel; keine Versionierung oder Auswahl mehrerer Metamodelle. |
| Staerkere ValidationRules | Umgesetzt, mit MVP-Grenze | Type in `backend/src/Sidebar/sidebarTypes.ts:89`; Seeds in `backend/src/Sidebar/sidebarStore.ts:478`; Auswertung in `backend/src/Sidebar/metamodelRules.ts:342` | Tests pruefen Application ohne Owner, Capability ohne `realizes`, Application ohne `serves`, Application ohne Technology Dependency | OR-Regel "uses Data Object oder depends_on Technology Node" ist nicht umgesetzt; derzeit einfache Technology-Dependency-Warnregel. |

## 3. Detailpruefung

### Datenmodell

- `Metamodel` existiert als Root-Struktur im Sidebar-State.
- `ConnectionRule` existiert weiterhin und ist die primaere fachliche Struktur fuer erlaubte Verbindungen.
- `ViewpointRule` und `ValidationRule` existieren als eigene Strukturen.
- `Diagram` besitzt optional `metamodelId`.
- `ValidationMessage` besitzt `severity`, `code`, `message`, optional `scope` und `ruleType`.

### Validierungslogik

- `validateDiagram(...)` gibt ein `ValidationResult` zurueck.
- `validateConnectionInstance(...)` prueft Source/Target/ConnectionType und dann eine passende `ConnectionRule`.
- `getAllowedConnectionRules(...)` und `getAllowedConnectionTypes(...)` nutzen ConnectionRules, nicht die Legacy-Listen.
- `validateViewpointCompliance(...)` nutzt `ViewpointRule` fuer erlaubte Component Types, Connection Types und ConnectionRules.
- `validateRequiredRules(...)` nutzt `ViewpointRule` fuer Required-Listen.
- `validateValidationRules(...)` prueft typbezogene Mindestbeziehungen.
- `allowedSourceTypeIds` und `allowedTargetTypeIds` werden in der Validierung nicht direkt als primaere Regelquelle verwendet. Sie werden bei der Normalisierung fuer Legacy-Migration in explizite ConnectionRules ueberfuehrt.

### UI-Sanity-Check

- DiagramEditor nutzt `getAllowedConnectionTypes(...)` beim Erstellen von Verbindungen: `frontend/src/DiagramEditor.tsx:776`.
- Es gibt keinen Fallback auf einen beliebigen ConnectionType. Wenn keine Regel passt, erscheint: `No connection rule allows this source/target combination.` (`frontend/src/DiagramEditor.tsx:786`).
- Validate Diagram gruppiert Meldungen nach Metamodel, Viewpoint, Diagram und Required Rules: `frontend/src/DiagramEditor.tsx:1028`.
- Metamodel View zeigt ConnectionRules, ViewpointRules und ValidationRules: `frontend/src/MetamodelView.tsx:92`, `frontend/src/MetamodelView.tsx:169`, `frontend/src/MetamodelView.tsx:184`.

## 4. Ausgefuehrte Befehle

| Befehl | Ergebnis |
| --- | --- |
| `npm.cmd run typecheck` | Erfolgreich. Backend und Frontend `tsc --noEmit` ohne Fehler. |
| `npm.cmd test` | Erfolgreich. 3 Testdateien, 28 Tests bestanden. |
| `npm.cmd run build` | In Sandbox wegen OneDrive/Vite/esbuild-Zugriff fehlgeschlagen; ausserhalb der Sandbox erfolgreich wiederholt. |
| `npm install` | Nicht ausgefuehrt, weil in diesem Pruefzyklus keine Dependency- oder Lockfile-Aenderung vorgenommen wurde. |

## 5. Gefundene Probleme

| Problem | Schwere | Behoben | Empfehlung |
| --- | --- | --- | --- |
| Testabdeckung fehlte fuer Application-ohne-`serves`, Application-ohne-Technikabhaengigkeit und Legacy-Source/Target-nicht-primaer. | Niedrig | Ja | Beibehalten; diese Tests schuetzen die fachliche Trennung. |
| Build scheitert in der Sandbox an OneDrive-/Vite-/esbuild-Zugriff auf uebergeordnete Pfade. | Niedrig fuer Code, mittel fuer Tooling-Komfort | Nein, kein Codeproblem | Bei wiederholter Arbeit entweder ausserhalb der Sandbox bauen oder Workspace ausserhalb OneDrive pruefen. |
| ValidationRule fuer Daten-oder-Technik-Abhaengigkeit ist keine echte OR-Regel. | Mittel fachlich | Nein, bewusst MVP | Naechster kleiner Schritt: einfache `anyOf`-Struktur fuer ValidationRule-Gruppen einfuehren. |
| ViewpointRule ist primaer in Validierung und Visualisierung, aber nicht vollstaendig als eigener Editor ausgepraegt. | Niedrig bis mittel | Nein, bewusst MVP | Kleiner naechster Schritt: Viewpoint Editor direkt gegen ViewpointRule schreiben lassen. |
| Legacy-Listen koennen bei Normalisierung in ConnectionRules ueberfuehrt werden. Das ist Migration, kann aber bei alten Daten zusaetzliche explizite Regeln erzeugen. | Mittel bei Altlasten | Teilweise | Bei produktiver Nutzung Migrationsbericht/Review fuer abgeleitete Legacy-Regeln anzeigen. |

## 6. Offene Punkte

- Menschlich pruefen: Sind die vier initialen ValidationRules fuer KMU fachlich passend und richtig streng als `warning` statt `error`?
- Menschlich pruefen: Soll `Application --serves--> Business Capability` langfristig erlaubt bleiben oder nur ueber Business Process laufen?
- Menschlich pruefen: Passen die ViewpointRules fuer Management, Business Owner, Application Owner und IT Operations zu echten Stakeholdern?
- Sinnvoller naechster kleiner Schritt: `ValidationRule` um einfache `anyOf`-Gruppen erweitern, damit "Application nutzt Data Object oder haengt an Technology Node" korrekt modelliert werden kann.
- Sinnvoller naechster kleiner Schritt: ViewpointRule direkt im Viewpoint Editor pflegbar machen, damit Legacy-Felder nicht mehr im Vordergrund stehen.

## 7. Gesamtbewertung

Die Pruefung ist bestanden. Die vier Nachschaerfungen sind implementiert, getestet und dokumentiert. Die wesentlichen Restgrenzen sind bewusst MVP: keine zusammengesetzten OR-Regeln, keine Metamodel-Versionierung und kein vollstaendiger Editor fuer ValidationRules/ViewpointRules.
