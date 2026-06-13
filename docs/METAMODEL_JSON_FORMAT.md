# Metamodel JSON Format

## Zweck

Eine Metamodel-JSON-Datei beschreibt das Regelwerk eines KMU-Kunden. Sie enthaelt Typen, erlaubte Beziehungen, Stakeholder-Sichten und Qualitaetsregeln. Sie enthaelt keine konkreten Diagramme, keine ComponentInstances und keine ConnectionInstances.

Damit kann ein Kunde sein Metamodell reproduzierbar versionieren, pruefen, exportieren und in einer anderen Umgebung wieder importieren, ohne Code zu aendern.

## Top-Level-Struktur

```json
{
  "metamodel": {},
  "componentTypes": [],
  "connectionTypes": [],
  "connectionRules": [],
  "viewpoints": [],
  "viewpointRules": [],
  "validationRules": []
}
```

Die Default-Definition liegt unter `backend/src/data/default-metamodel.json` und kann in der Metamodel-UI als `default-eam-metamodel.json` heruntergeladen werden.

## Pflichtbereiche

`metamodel` beschreibt die Root-Definition:

- `id`
- `name`
- `description`
- `version`
- `isActive`
- `createdAt` optional
- `updatedAt` optional

`componentTypes` beschreibt erlaubte Bausteinarten:

- `id`
- `name`
- `description`
- `layer` oder `category`
- `color`
- `icon`
- `shape`
- `customPropertyKeys`
- `isAbstract` optional
- `isStakeholderRelevant` optional

`connectionTypes` beschreibt Beziehungsarten, aber nicht die erlaubten Source-/Target-Kombinationen:

- `id`
- `name`
- `description`
- `directionDescription`
- `color`
- `lineStyle`
- `semanticCategory`
- `allowedSourceTypeIds` und `allowedTargetTypeIds` bleiben nur Kompatibilitaetsfelder. Sie sind nicht die fachliche Regelquelle und erzeugen keine `ConnectionRule`s.

`legacy-rule-*`-Eintraege sind alte Migrationsartefakte und duerfen nicht in Metamodel-JSON importiert werden.

`connectionRules` ist die primaere fachliche Regelquelle:

- `id`
- `sourceComponentTypeId`
- `connectionTypeId`
- `targetComponentTypeId`
- `allowed`
- `required`
- `severity`
- `description`
- `rationale`
- `viewpointIds` optional
- `minOccurrences` optional
- `maxOccurrences` optional

`viewpoints` beschreibt Rollen-/Stakeholder-Sichten:

- `id`
- `name`
- `description`
- `stakeholderRole`
- `purpose`
- `visibleLayerIds` optional

Die alten erlaubten/required Listen am Viewpoint duerfen fuer Kompatibilitaet enthalten sein, primaer ist aber `viewpointRules`.

`viewpointRules` beschreibt die konkreten Sicht-Einschraenkungen:

- `id`
- `viewpointId`
- `allowedComponentTypeIds`
- `allowedConnectionTypeIds`
- `allowedConnectionRuleIds`
- `requiredComponentTypeIds`
- `requiredConnectionTypeIds`
- `requiredConnectionRuleIds`
- `description` optional
- `visibleComponentTypeIds` optional
- `editableComponentTypeIds` optional
- `severity` optional

`validationRules` beschreibt Qualitaets- und Pflichtbeziehungsregeln:

- `id`
- `name`
- `description`
- `scope`
- `viewpointId` optional
- `sourceComponentTypeId` optional
- `requiredConnectionTypeId` optional
- `targetComponentTypeId` optional
- `direction`
- `minOccurrences`
- `severity`
- `message`
- `active`

## Referenzregeln Beim Import

Der Import bricht vollstaendig ab, wenn eine Referenz ungueltig ist. Es gibt keine stillen Teilimporte.

Geprueft wird unter anderem:

- Jede `ConnectionRule.sourceComponentTypeId` existiert in `componentTypes`.
- Jede `ConnectionRule.targetComponentTypeId` existiert in `componentTypes`.
- Jede `ConnectionRule.connectionTypeId` existiert in `connectionTypes`.
- Jede `ViewpointRule.viewpointId` existiert in `viewpoints`.
- Jede erlaubte oder verpflichtende ComponentType-, ConnectionType- oder ConnectionRule-Referenz in `ViewpointRule` existiert.
- Jede optionale Referenz in `ValidationRule` existiert, falls gesetzt.
- IDs innerhalb eines Bereichs sind eindeutig.

## Import-Modus

Das MVP nutzt `replace active metamodel`:

- Das Regelwerk wird ersetzt.
- Bestehende ComponentInstances, ConnectionInstances und Diagramme bleiben erhalten.
- Diagramme erhalten die `metamodelId` der importierten Definition.
- Falls ein Diagramm auf einen nicht mehr vorhandenen Viewpoint verweist, wird diese Viewpoint-Zuordnung entfernt.

Dadurch werden bestehende Diagramme nicht geloescht, koennen nach dem Import aber neue Validierungsfehler zeigen.

## Metamodel JSON Vs. Diagram JSON

Metamodel JSON ist das Regelwerk:

- Welche Component Types gibt es?
- Welche ConnectionRules sind erlaubt?
- Welche ViewpointRules reduzieren eine Stakeholder-Sicht?
- Welche ValidationRules pruefen Mindestqualitaet?

Diagram JSON waere eine konkrete Modellinstanz:

- Welche Komponenten existieren konkret?
- Welche konkreten Verbindungen wurden gezeichnet?
- Welche Positionen haben Nodes im Diagramm?

Der Export-Endpunkt fuer Metamodel JSON exportiert bewusst nur das Regelwerk.

## Beispiel

```json
{
  "connectionRules": [
    {
      "id": "rule-application-serves-process",
      "sourceComponentTypeId": "ct-app",
      "connectionTypeId": "conn-serves",
      "targetComponentTypeId": "ct-proc",
      "allowed": true,
      "required": true,
      "severity": "error",
      "description": "Application serves Business Process.",
      "rationale": "Applications should be traceable to the business processes they support."
    }
  ]
}
```

Das vollstaendige Beispiel steht in `backend/src/data/default-metamodel.json`.
