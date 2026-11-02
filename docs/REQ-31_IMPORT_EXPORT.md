# REQ-31: Excel/CSV-Import und -Export mit Vorschau

## Überblick

- **Kataloge** (Tab "Kataloge"): je Elementtyp eine Tabelle, dazu "Alle Elemente" und "Verbindungen". Suche, Sortierung, Klick auf eine Zeile öffnet das Element im Detailpanel. Alle Rollen dürfen lesen und exportieren.
- **Export**: aktuelle Katalogauswahl (Typ + Suchtext bzw. Verbindungstyp) als XLSX oder CSV. XLSX enthält die Blätter "Elemente" und "Relationen". CSV ist immer ein Blatt (Trennzeichen `;`, UTF-8 mit BOM). Diagrammzuordnungen werden nicht exportiert.
- **Import** (nur Admin/Architect): Datei wählen, Vorschau (Dry-Run) mit Status je Zeile (Neu, Geändert, Unverändert, Fehler) und Grund, danach Übernehmen. Ohne Vorschau wird nichts geschrieben.
- **Protokoll** (Admin/Architect, Permission `audit:read`): jeder Import erzeugt einen Eintrag `import.commit` mit Nutzer, Zusammenfassung und SHA-256 der Datei.

## Zuordnungsregeln

1. `ID` vorhanden und bekannt: bestehenden Eintrag ändern. Unbekannte ID ist ein Fehler.
2. Sonst `Externe ID` bekannt (pro Unternehmen eindeutig): bestehenden Eintrag ändern.
3. Sonst neu anlegen.

- Leere Zelle "Externe ID" löscht eine vorhandene externe ID nicht.
- Leere Eigenschaftszelle leert die Eigenschaft. Fehlende Spalten lassen Daten unberührt.
- Relationen referenzieren Quelle/Ziel über ID, externe ID oder eindeutigen Namen.
- Eine doppelte Relation (gleicher Typ, Quelle, Ziel) ohne ID ist ein Fehler.
- Validierung nutzt dieselben Metamodell-Regeln wie die UI (`validateConnectionInstance`).
- Commit ist alles-oder-nichts, außer `skipInvalid=true` (fehlerhafte Zeilen werden übersprungen).
- CSV/Excel: Zellen, die mit `= + - @` beginnen, werden beim Export mit `'` geschützt (Formel-Injection) und beim Import wieder entfernt.
- Grenzen: 10 MB, 5000 Zeilen, 200 Spalten, 5000 Zeichen je Zelle.

## Endpunkte (alle unter `/api/sidebar`)

| Methode | Pfad | Permission |
| --- | --- | --- |
| GET | `/export?format=xlsx\|csv&sheet=&typeIds=&connectionTypeIds=&q=` | read |
| GET | `/import/template?format=&sheet=` | read |
| POST | `/import/preview?fileName=` (Body: Rohbytes, `application/octet-stream`) | architecture:write |
| POST | `/import/commit?fileName=&skipInvalid=` | architecture:write |
| GET | `/audit-log?limit=` | audit:read |

## Datenmodell

- `ComponentInstance.externalId` und `ConnectionInstance.externalId`, nullable, `@@unique([companyId, externalId])`.
- Neue Tabelle `AuditLogEntry`. Der Eintrag wird in derselben Transaktion wie der Import geschrieben. Migration: `20261102120000_req31_external_ids_and_audit_log` (rein additiv).

## Hinweise für Betrieb und Entwicklung

- **Docker-COPY-Vertrag**: Das Frontend importiert `backend/src/catalog/catalogModel.ts` relativ (wie `auth/policy.ts`). Das Frontend-Dockerfile kopiert nur explizit genannte Backend-Dateien. Solche Dateien müssen import-frei sein und im Dockerfile stehen.
- **Gleichzeitige Schreibzugriffe**: Der Import schreibt wie alle Aktionen den gesamten Unternehmenszustand. Es gibt keine Sperre (REQ-26). Parallele Änderungen während eines Imports können sich überschreiben.
- **Tests**: `backend/src/importExport/*.test.ts`, `catalog/catalogModel.test.ts`, `frontend/src/catalog.test.tsx`, DB-Test `transfer.database.test.ts` (über `npm run test:rbac:db`).
