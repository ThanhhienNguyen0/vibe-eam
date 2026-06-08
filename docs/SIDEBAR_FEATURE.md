# Linke Sidebar – Architektur-Navigation

## Übersicht

Dieses Feature fügt dem EAM-Prototypen eine linke Navigationsleiste hinzu, die in zwei
Bereiche aufgeteilt ist:

- **Bereich 1 – Architekturregeln**: Definition von Komponenten-Typen und Verbindungs-Typen
- **Bereich 2 – Architekturverwaltung**: Verwaltung konkreter Komponenten, Verbindungen und
  Diagramme auf Basis der definierten Typen

---

## Neue Dateien

### Backend

| Datei | Beschreibung |
|---|---|
| `backend/src/sidebarTypes.ts` | TypeScript-Interfaces für alle Sidebar-Entitäten |
| `backend/src/sidebarStore.ts` | JSON-basierte Persistenzschicht (`data/sidebar.json`) |
| `backend/src/sidebarRoutes.ts` | Express-Router mit vollständigem CRUD für alle Entitäten |

### Frontend

| Datei | Beschreibung |
|---|---|
| `frontend/src/sidebarTypes.ts` | Identische TypeScript-Interfaces für das Frontend |
| `frontend/src/sidebarApi.ts` | Typsichere API-Client-Funktionen |
| `frontend/src/Sidebar.tsx` | Navigationsleiste mit Ordnerstruktur (Folder/Row-Komponenten) |
| `frontend/src/SidebarPanels.tsx` | Detailpanels für alle Entitätstypen (Edit-Formulare) |
| `frontend/src/DiagramEditor.tsx` | ReactFlow-Canvas zum Erstellen und Bearbeiten von Diagrammen |

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `backend/src/server.ts` | Sidebar-Router unter `/api/sidebar` registriert |
| `frontend/src/App.tsx` | Imports, Sidebar-State, Layout auf `app-body` umgestellt |
| `frontend/src/styles.css` | Alle CSS-Klassen für Sidebar, Detail-Area und Diagram-Editor |

---

## Datenmodell

### ComponentType
```ts
{ id, name, color, icon, description, customPropertyKeys: string[] }
```
Definiert einen wiederverwendbaren Komponenten-Typ mit benutzerdefinierter
Eigenschaftenliste.

### ConnectionType
```ts
{ id, name, color, lineStyle: "solid"|"dashed"|"dotted",
  allowedSourceTypeIds, allowedTargetTypeIds, description }
```
Definiert einen Verbindungstyp mit optionalen Typ-Einschränkungen für Quelle und Ziel.
Leere Listen bedeuten „alle Typen erlaubt".

### ComponentInstance
```ts
{ id, name, componentTypeId, properties: Record<string,string>, description }
```
Eine konkrete Instanz, die auf einen Komponenten-Typ verweist und dessen
`customPropertyKeys` als Schlüssel-Wert-Paare befüllt.

### ConnectionInstance
```ts
{ id, name, connectionTypeId, sourceComponentId, targetComponentId, description }
```

### Diagram
```ts
{ id, name, description,
  componentIds: string[], connectionIds: string[],
  positions: Record<componentId, {x,y}> }
```
Ein Diagramm enthält eine Auswahl von Komponenten und Verbindungen. Positionen werden
je Diagramm gespeichert, sodass dieselbe Komponente in verschiedenen Diagrammen
unterschiedlich platziert sein kann.

---

## REST-API

Alle Endpunkte unter `/api/sidebar`:

```
GET    /api/sidebar/                   vollständiger Sidebar-State
GET    /api/sidebar/component-types
POST   /api/sidebar/component-types
PATCH  /api/sidebar/component-types/:id
DELETE /api/sidebar/component-types/:id

GET    /api/sidebar/connection-types
POST   /api/sidebar/connection-types
PATCH  /api/sidebar/connection-types/:id
DELETE /api/sidebar/connection-types/:id

GET    /api/sidebar/components
POST   /api/sidebar/components
PATCH  /api/sidebar/components/:id
DELETE /api/sidebar/components/:id

GET    /api/sidebar/connections
POST   /api/sidebar/connections
PATCH  /api/sidebar/connections/:id
DELETE /api/sidebar/connections/:id

GET    /api/sidebar/diagrams
POST   /api/sidebar/diagrams
PATCH  /api/sidebar/diagrams/:id
DELETE /api/sidebar/diagrams/:id
```

---

## UX-Ablauf

### Typen definieren (Bereich 1)

1. „+" in **Komponenten-Typen** → neuer Typ erscheint in der Liste
2. Typ anklicken → Detailformular öffnet sich rechts (Name, Farbe, Icon,
   benutzerdefinierte Eigenschaftsschlüssel)
3. Gleich mit **Verbindungs-Typen** (zusätzlich: Linienstil, erlaubte Quell-/Zieltypen)

### Instanzen verwalten (Bereich 2)

1. **Komponente** anlegen → Typ auswählen → Eigenschaften befüllen
2. **Verbindung** anlegen → Typ, Quelle, Ziel auswählen
3. **Diagramm** anlegen → Öffnen-Button klickt den Diagram-Editor auf

### Diagramm-Editor

- Toolbar: Komponente per Picker zum Canvas hinzufügen
- Verbinden: Handle an einem Node nach außen ziehen → auf einen anderen Node loslassen
- Erlaubte Verbindungstypen werden automatisch aus den `allowedSourceTypeIds`/
  `allowedTargetTypeIds` der Connection-Typen ermittelt
- Positionen werden beim Loslassen (Drag-Stop) direkt gespeichert
- „×" schließt den Diagram-Editor und zeigt wieder den normalen EAM-Canvas

---

## Persistenz

Alle Sidebar-Daten werden in `backend/data/sidebar.json` gespeichert.
Beim ersten Start legt der Server diese Datei mit fünf Standard-Komponenten-Typen
(Application, Server, Database, Business Process, Service) und drei
Standard-Verbindungstypen an.

---

## Grenzen (bewusster MVP-Umfang)

- Keine Mehrfachauswahl beim Verbindungs-Picker im Diagramm-Editor
- Verbindungen im Diagramm werden automatisch dem ersten erlaubten Typ zugewiesen;
  kein Typ-Auswahl-Dialog beim Canvas-Connect
- Kein Drag-and-Drop von Komponenten aus der Sidebar auf den Canvas
- Keine Validierung von Duplikaten bei Verbindungsinstanzen
