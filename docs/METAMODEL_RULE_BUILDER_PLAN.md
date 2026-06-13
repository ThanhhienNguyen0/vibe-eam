# Metamodel Rule Builder Plan

## Kurze Codeanalyse

- `ComponentType` existiert bereits in `backend/src/Sidebar/sidebarTypes.ts` und `frontend/src/Sidebar/sidebarTypes.ts` mit `id`, `name`, `color`, `icon`, `description`, `customPropertyKeys`, optional `shape` und `category`. `category` kann als fachlicher Layer weitergenutzt werden, ein explizites `layer`-Feld fehlt noch.
- `ConnectionType` existiert bereits mit `allowedSourceTypeIds` und `allowedTargetTypeIds`; die Grundidee fuer Source-/Target-Regeln ist also vorhanden. Pflichtregeln, Richtungstext und Viewpoint-Zuordnung fehlen noch.
- Die Sidebar (`frontend/src/Sidebar/Sidebar.tsx`) verwaltet Typen, Instanzen und Diagramme in Ordnern. Quick-Add, Rename, Delete und Drag-and-Drop fuer Komponententypen sind vorhanden.
- Die Detailpanels (`frontend/src/Sidebar/SidebarPanels.tsx`) bieten bereits Editoren fuer Component Types und Connection Types. Diese koennen fuer Layer, Viewpoint-Zuordnung und Pflichtregeln erweitert werden.
- Der `DiagramEditor` nutzt React Flow. Beim Verbinden zweier Komponenten filtert er bereits nach `allowedSourceTypeIds` und `allowedTargetTypeIds`, faellt aber bei fehlendem Treffer noch auf einen beliebigen Connection Type zurueck. Es gibt noch keine Viewpoint- oder Diagrammvalidierung im Editor.
- Backend-Routen liegen in `backend/src/Sidebar/sidebarRoutes.ts`; CRUD fuer Component Types, Connection Types, Komponenten, Verbindungen und Diagramme ist vorhanden. Backend-Validierung fuer Sidebar-Verbindungen und Diagramme fehlt noch.
- Persistenz liegt in `backend/src/Sidebar/sidebarStore.ts` bzw. `backend/src/data/sidebar.json`. Es gibt vorhandene Beispieltypen und BPMN-nahe Typen; neue EAM-Beispieldaten sollten additiv mit stabilen IDs eingefuegt werden.
- Tests existieren im Backend mit Vitest (`backend/src/metamodel.test.ts`, `backend/src/portfolio.test.ts`) fuer das aeltere Core-EAM-Metamodell. Fuer die Sidebar-/Rule-Builder-Validierung fehlt noch eine eigene reine Testbasis.
- Dokumentation existiert bereits in `docs/SIDEBAR_FEATURE.md`, `docs/EVALUATION_MATRIX.md`, `docs/AI_REFLECTION_LOG.md` und `docs/PROMPT_LOG.md`; die neue Funktion wird dort und in neuen Metamodel/Viewpoint-Dokumenten ergaenzt.

## Implementierungsplan

1. Sidebar-Datenmodell erweitern: `Viewpoint`, `Diagram.viewpointId`, `ComponentType.layer`, optionale Viewpoint- und Pflichtfelder sowie erweiterte `ConnectionType`-Regelfelder.
2. Zentrale reine Validierungslogik fuer Sidebar-Diagramme erstellen: erlaubte Source-/Target-Typen, Viewpoint-Einschraenkungen und Pflichtregeln mit verstaendlichen Meldungen.
3. Backend-Store migrieren: bestehende JSON-Daten beim Lesen normalisieren und stabile EAM-Beispieltypen, Verbindungen, Viewpoints und Beispielinstanzen additiv sicherstellen.
4. Backend-Routen erweitern: Viewpoint CRUD, Diagrammvalidierungs-Endpunkt, harte Ablehnung ungueltiger Verbindungen und ungueltiger Diagramm-Updates.
5. Frontend-Typen/API erweitern und dieselbe Validierungslogik fuer UX nutzen.
6. Sidebar-UI erweitern: Viewpoint-Ordner und Editoren; Component-/Connection-Type-Editoren um Layer, Richtung, Viewpoint-Zuordnung und Pflichtregeln erweitern.
7. DiagramEditor erweitern: Viewpoint anzeigen/waehlen, Palette nach Viewpoint filtern, Verbindungstypen strikt filtern, keine ungueltigen Fallback-Verbindungen, Validate-Panel.
8. Neue Ansicht `Metamodel` bauen: Regeluebersicht, Viewpoint-Filter und einfache SVG-basierte Metamodell-Grafik.
9. Dokumentation und Evaluation aktualisieren.
10. Vitest-Tests fuer erlaubte/unerlaubte Verbindung, Viewpoint-Regel, Pflichtkomponenten/-verbindungen und Diagrammvalidierungsfehler ergaenzen; danach Typecheck, Build und Tests ausfuehren.
