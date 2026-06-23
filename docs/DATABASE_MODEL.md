# Database Model

Die maßgebliche Definition ist `backend/prisma/schema.prisma`; die initiale SQL-Migration liegt unter `backend/prisma/migrations`.

## Beziehungen

| Entität | Wichtige Beziehungen | Flexible Felder |
| --- | --- | --- |
| Metamodel | besitzt Typen, Regeln, Viewpoints und Diagramme | - |
| ComponentType | gehört zu Metamodel; wird von Regeln und Instanzen referenziert | `customPropertyKeys`, `allowedInViewpointIds` |
| ConnectionType | gehört zu Metamodel; wird von ConnectionRule und ConnectionInstance referenziert | Legacy-/Kompatibilitäts-ID-Mengen |
| ConnectionRule | Source-ComponentType + ConnectionType + Target-ComponentType | `viewpointIds` |
| Viewpoint | gehört zu Metamodel; optional an Diagram | sichtbare/erlaubte/erforderliche ID-Mengen |
| ViewpointRule | gehört zu Metamodel und Viewpoint | erlaubte, erforderliche, sichtbare und editierbare ID-Mengen |
| ValidationRule | optionale Referenzen auf Viewpoint und Typen | - |
| Diagram | gehört zu Metamodel, optional zu Viewpoint; enthält Instanzen | Position wird je ComponentInstance als JSONB gespeichert |
| ComponentInstance | gehört während der Modellierung optional, final regulär zu Diagram und ComponentType | `properties`, `position` |
| ConnectionInstance | gehört optional zu Diagram; referenziert ConnectionType, Source und Target | `properties` |

## Integrität

- ConnectionRule ist durch die Kombination aus Metamodel, Source-Typ, ConnectionType und Target-Typ eindeutig.
- Source und Target einer ConnectionInstance müssen existierende ComponentInstances sein.
- Source- und Target-Fremdschlüssel verwenden `ON DELETE CASCADE`. Eine gelöschte Komponente hinterlässt daher keine verwaisten Verbindungen.
- Diagram-Abfragen verwenden `include` für ComponentInstances und ConnectionInstances. Die API-Antwort enthält Diagramm, Komponenten, Verbindungen und Positionsdaten.
- Metamodel-abhängige Datensätze werden beim Löschen des Metamodels kaskadiert; optionale Viewpoint-/ValidationRule-Referenzen werden sinnvoll auf `NULL` gesetzt.

## JSONB

JSONB wird nur dort eingesetzt, wo die Werte kundenspezifisch oder mengenartig sind. Fachlich zentrale Beziehungen wie Diagram, ComponentType, ConnectionType und Connection-Endpunkte bleiben relationale Fremdschlüssel. So bleiben `properties` und `customPropertyKeys` offen, ohne referenzielle Integrität für den Graphen aufzugeben.

## API-Kompatibilität

Das Repository mappt DB-Zeilen zurück in die bestehenden `SidebarState`-Interfaces. Insbesondere werden `componentIds`, `connectionIds` und `positions` weiter geliefert. Dadurch benötigen DiagramEditor, Metamodel Rule Builder sowie Metamodel JSON Import/Export keinen Struktur-Rewrite.

Zusätzlicher Aggregate-Endpunkt:

```text
GET /api/sidebar/diagrams/:id
```

Antwort: `{ diagram, components, connections }`.
