# Self-Test Report

Datum: 2026-04-27

## Ausgefuehrte Befehle

| Befehl | Ergebnis |
| --- | --- |
| `npm install` | Erfolgreich. 248 Packages auditiert. 2 moderate vulnerabilities gemeldet. |
| `npm run typecheck` | Erfolgreich nach kleinem Fix an der Importvalidierung. Backend und Frontend TypeScript ohne Fehler. |
| `npm run build` | Erfolgreich nach kleinem Fix. Backend TypeScript build und Frontend Vite build erfolgreich. |
| `Invoke-RestMethod http://localhost:4000/api/model` | Erfolgreich. 12 Elemente und 12 Relationen geliefert. |
| `Invoke-WebRequest http://localhost:5173` | Erfolgreich. HTTP 200. |

## REST-Endpunkte

| Endpunkt | Test | Ergebnis |
| --- | --- | --- |
| `GET /api/model` | Modell geladen | Erfolgreich, 12 Elemente und 12 Relationen. |
| `POST /api/model/elements` | Temporaeres Element erstellt | Erfolgreich, ID wurde erzeugt. |
| `PATCH /api/model/elements/:id` | Name, Risiko und Kosten geaendert | Erfolgreich, Patch wurde zurueckgegeben. |
| `DELETE /api/model/elements/:id` | Temporaeres Element geloescht | Erfolgreich, HTTP 204. |
| `POST /api/model/relations` | Temporaere `depends_on` Relation erstellt | Erfolgreich, ID wurde erzeugt. |
| `DELETE /api/model/relations/:id` | Temporaere Relation geloescht | Erfolgreich, HTTP 204. |
| `POST /api/model/import` | Originalmodell wieder importiert | Erfolgreich, 12 Elemente wiederhergestellt. |
| `GET /api/model/export` | Modell exportiert | Erfolgreich. |
| `GET /api/audit-log` | Audit Log gelesen | Erfolgreich. |

## Getestete Funktionen

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

### Validierung

- Selbstrelation mit gleicher Source und Target wurde abgelehnt.
- Import von `{}` wurde nach Fix mit HTTP 400 abgelehnt:
  - `Imported model must contain an elements array.`
  - `Imported model must contain a relations array.`

### Impact-Analyse

Die Traversal-Logik wurde anhand des Seed-Graphen nachgebildet und geprueft.

Ausgehend von `app-billing-service` wurden gefunden:

- `app-erp-system`
- `data-invoice-data`
- `tech-database-cluster`

Ausgehend von `app-crm-system` wurden gefunden:

- `data-customer-data`
- `tech-cloud-runtime`

`realizes` wurde korrekt ignoriert.

### Heatmap Und Filter

Codepruefung:

- Filter werden in `visibleModel` unabhaengig nach Layer und Elementtyp angewendet.
- Heatmap wird separat ueber `heatmapMode` in `toNodes`/`nodeStyle` angewendet.
- Beide State-Pfade koennen gleichzeitig wirken.

Einschraenkung:

- Keine automatisierte visuelle Browserpruefung fuer Farbdarstellung, Dropdown-Bedienung oder Canvas-Neurendering.

### Capability Map

Codepruefung:

- Business Capabilities werden aus `model.elements` gefiltert.
- Prozesse werden ueber `realizes` einer Capability zugeordnet.
- Applications werden ueber `serves` den Prozessen und damit indirekt den Capabilities zugeordnet.

Bewertung:

- Mehr als statische Anzeige, aber fachlich heuristisch und read-only.

### Lifecycle Roadmap

Codepruefung:

- Roadmap wird aus `model.elements` erzeugt.
- Sortierung erfolgt ueber `startDate`.
- `deprecated` und `retired` werden visuell markiert.

Bewertung:

- Funktional im MVP, aber nur tabellarisch.

## Gefundene Fehler

| Fehler | Schwere | Status |
| --- | --- | --- |
| Import ohne `elements`/`relations` konnte als 500 enden | Mittel | Behoben |
| Fehlgeschlagene Canvas-Verbindung konnte optimistisch als Edge sichtbar bleiben | Niedrig | Behoben |
| npm meldet 2 moderate vulnerabilities | Mittel | Nicht behoben, da `npm audit fix --force` Breaking Changes ausloesen kann |
| Keine automatisierte UI-E2E-Pruefung | Mittel | Nicht behoben |
| Audit Log enthaelt keine Before/After-Diffs | Niedrig/Mittel | MVP-Grenze |

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

1. Playwright- oder Vitest-Testsetup einfuehren.
2. API-Integrationstests fuer Validierung, Import/Export und Audit Log schreiben.
3. Browser-E2E-Test fuer Canvas-Sichtbarkeit, Auswahl, Eigenschaftenpanel, Filter, Heatmap und Import/Export.
4. Schema-Validierung mit Zod oder Ajv einfuehren.
5. Audit Log um Before/After-Diffs erweitern.
6. Fachliche Review der EAM-Semantik und der Impact-Richtung durch das Team.
7. Entscheidung treffen, ob JSON-Datei reicht oder SQLite eingefuehrt werden soll.
