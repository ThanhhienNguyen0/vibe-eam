# Self-Test Report

Datum: 2026-04-27

## Ausgefuehrte Befehle

| Befehl | Ergebnis |
| --- | --- |
| `npm install` | Phase 1 erfolgreich mit 2 moderate vulnerabilities. Nach Vitest-Ergaenzung in Phase 2 erfolgreich mit 4 moderate vulnerabilities. |
| `npm test` | Phase 2 erfolgreich. 5 Vitest-Tests bestanden. |
| `npm run typecheck` | Erfolgreich. Backend und Frontend TypeScript ohne Fehler. |
| `npm run build` | Erfolgreich. Backend TypeScript build und Frontend Vite build erfolgreich. |
| `Invoke-RestMethod http://localhost:4000/api/model` | Erfolgreich. Seed-Modell erreichbar. |
| `Invoke-WebRequest http://localhost:5173` | Erfolgreich. HTTP 200. |

## REST-Endpunkte

| Endpunkt | Test | Ergebnis |
| --- | --- | --- |
| `GET /api/model` | Modell geladen | Erfolgreich, 12 Elemente und 12 Relationen. |
| `POST /api/model/elements` | Temporaeres Element erstellt | Erfolgreich, ID wurde erzeugt. |
| `PATCH /api/model/elements/:id` | Name, Risiko und Kosten geaendert | Erfolgreich, Patch wurde zurueckgegeben. |
| `DELETE /api/model/elements/:id` | Temporaeres Element geloescht | Erfolgreich, HTTP 204. |
| `POST /api/model/relations` | Temporaere gueltige Relation erstellt | Erfolgreich, ID wurde erzeugt. |
| `DELETE /api/model/relations/:id` | Temporaere Relation geloescht | Erfolgreich, HTTP 204. |
| `POST /api/model/import` | Originalmodell wieder importiert | Erfolgreich, 12 Elemente wiederhergestellt. |
| `GET /api/model/export` | Modell exportiert | Erfolgreich. |
| `GET /api/audit-log` | Audit Log gelesen | Erfolgreich. |

## Phase-1-Tests

### Import/Export Roundtrip

- Vor den API-Mutationstests wurde das Modell exportiert.
- Nach Create/Patch/Delete wurde das Originalmodell per Import wiederhergestellt.
- Danach wurde erneut exportiert.
- Ergebnis: Roundtrip war modellgleich.

### Audit Log

Vor den Mutationstests gab es 62 Audit-Eintraege. Nach Create, Update, Relation Create, Relation Delete, Element Delete und Import gab es 68 Audit-Eintraege.

Gepruefte Aktionen:

- `create`
- `update`
- `delete`
- `import`

### Strukturelle Validierung

- Selbstrelation mit gleicher Source und Target wurde abgelehnt.
- Import von `{}` wurde mit HTTP 400 abgelehnt:
  - `Imported model must contain an elements array.`
  - `Imported model must contain a relations array.`

## Phase-2-Tests

### Unit Tests

`npm test` fuehrt Vitest im Backend aus.

Getestet:

- gueltige Relation wird vom Metamodell erlaubt
- ungueltige Relation wird semantisch abgelehnt
- Downstream Business Impact wird rekursiv berechnet
- Upstream Dependencies werden rekursiv berechnet
- Zyklen im Graph werden nicht endlos traversiert

Ergebnis:

- 1 Testdatei bestanden
- 5 Tests bestanden

### Semantische Relationvalidierung

API-Smoke-Test:

- `Application Component realizes Business Capability` wurde nach der Phase-2-Nachschaerfung mit HTTP 400 abgelehnt.
- Fehlermeldung: `Relation 'realizes' from Application Component to Business Capability is not allowed by the EAM metamodel.`

Damit ist die Import- und Create-Validierung fachlich enger als in Phase 1.

### Impact- Und Dependency-Analyse

Phase 1 pruefte nur einfache Traversierung entlang `uses` und `depends_on`; damals wurde `realizes` korrekt ignoriert. Diese Aussage gilt nur fuer Phase 1.

Phase 2 ersetzt diese Logik durch zwei Modi:

- Downstream Business Impact
- Upstream Dependencies

Die neue Analyse nutzt `uses`, `depends_on`, `serves` und `realizes` gemaess `docs/IMPACT_ANALYSIS.md`. Ergebnisse enthalten Pfad, Level, Relationstyp, Elementtyp und Layer.

## Heatmap Und Filter

Codepruefung:

- Filter werden in `visibleModel` unabhaengig nach Layer und Elementtyp angewendet.
- Heatmap wird separat ueber `heatmapMode` in `toNodes`/`nodeStyle` angewendet.
- Beide State-Pfade koennen gleichzeitig wirken.

Einschraenkung:

- Keine automatisierte visuelle Browserpruefung fuer Farbdarstellung, Dropdown-Bedienung oder Canvas-Neurendering.

## Capability Map

Codepruefung:

- Business Capabilities werden aus `model.elements` gefiltert.
- Prozesse werden ueber `realizes` einer Capability zugeordnet.
- Applications werden ueber `serves` den Prozessen und damit indirekt den Capabilities zugeordnet.
- Phase 2 macht diese Zuordnung belastbarer, weil Relationen semantisch validiert werden.

Bewertung:

- Mehr als statische Anzeige, aber weiterhin fachlich heuristisch und read-only.

## Lifecycle Roadmap

Codepruefung:

- Roadmap wird aus `model.elements` erzeugt.
- Sortierung erfolgt ueber `startDate`.
- `deprecated` und `retired` werden visuell markiert.

Bewertung:

- Funktional im MVP, aber nur tabellarisch.

## Gefundene Fehler Und Grenzen

| Thema | Status |
| --- | --- |
| Import ohne `elements`/`relations` konnte als 500 enden | Behoben |
| Fehlgeschlagene Canvas-Verbindung konnte optimistisch als Edge sichtbar bleiben | Behoben |
| npm meldet moderate vulnerabilities | Nicht behoben, da `npm audit fix --force` Breaking Changes ausloesen kann |
| Keine automatisierte UI-E2E-Pruefung | Nicht behoben |
| Audit Log enthaelt keine Before/After-Diffs | MVP-Grenze |
| Metamodell ist klein und nicht ArchiMate-vollstaendig | MVP-Grenze |

## Nicht Getestete Bereiche

- Echte Browserinteraktion mit Drag & Drop im Canvas.
- Relationserstellung per Maus im Canvas.
- Manuelle Bearbeitung im Eigenschaftenpanel.
- Datei-Import ueber den Browser-Dateidialog.
- Visuelle Korrektheit von Heatmap-Farben.
- Responsives Layout auf Mobile.
- Verhalten bei parallelen Schreibzugriffen.
- Sehr grosse Modelle.
- Persistenzrobustheit bei Prozessabbruch waehrend Schreibvorgang.

## Empfehlung Fuer Den Naechsten Entwicklungszyklus

1. API-Integrationstests fuer Import, Export, Audit Log und semantische Validierung schreiben.
2. Browser-E2E-Test fuer Canvas-Sichtbarkeit, Auswahl, Eigenschaftenpanel, Filter, Heatmap und Import/Export.
3. Schema-Validierung mit Zod oder Ajv einfuehren.
4. Audit Log um Before/After-Diffs erweitern.
5. Fachliche Review der Relationsemantik und Impact-Richtung durch EAM-Fachexperten.
6. Naechsten fachlichen MVP-Schnitt waehlen: Application Portfolio Management oder Capability-Hierarchie.
