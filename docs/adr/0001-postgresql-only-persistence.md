# ADR 0001: PostgreSQL als einzige Persistenzschicht

- **Status:** Angenommen
- **Datum:** 2026-10-20
- **Issue:** #60 (REQ-28)

## Kontext

Das Backend hatte zwei Speicherwege, die zur Laufzeit gewählt wurden (`configuredStorageBackend`):

- **PostgreSQL**, sobald `DATABASE_URL` gesetzt war (über Prisma),
- **JSON-Dateien** (`backend/data/model.<companyId>.json`, `backend/src/data/sidebar.<companyId>.json`), wenn `DATABASE_URL` fehlte oder `STORAGE_BACKEND=json` gesetzt war.

Jede Funktion, die Daten speichert, musste in beiden Wegen funktionieren. Für geplante Themen wie Audit-Diffs, Versionierung und Rollen/RBAC (#88) hätte das doppelte Umsetzung und doppelte Tests bedeutet.

Der JSON-Weg war außerdem praktisch nicht mehr erreichbar: Registrierung und Login laufen über `PrismaAuthRepository` und brauchen immer PostgreSQL. Ohne Datenbank kommt im Browser niemand über den Login hinaus.

## Optionen

**A – JSON-Fallback entfernen, nur PostgreSQL**
- \+ ein Code-Pfad, neue Features nur einmal bauen und testen
- \+ Transaktionen, Constraints, Backups und Company-Isolation an einer Stelle
- − lokale Entwicklung braucht eine laufende PostgreSQL
- − alte JSON-Daten müssen einmalig migriert werden

**B – JSON-Fallback behalten**
- \+ Backend startet ohne Infrastruktur
- − Doppelung bleibt, jedes Persistenz-Feature muss in beiden Wegen funktionieren
- − Verhalten lokal (JSON) und in Produktion (PostgreSQL) kann auseinanderlaufen
- − das Ziel von REQ-28 („eine einzige Persistenzschicht“) wäre nur dokumentiert, nicht erreicht

## Entscheidung

**Option A.** PostgreSQL ist die einzige Persistenzschicht für `/api/sidebar` und `/api/model`.

- Das Backend startet nur mit `DATABASE_URL`. Fehlt sie, bricht es mit einer klaren Meldung ab.
- `STORAGE_BACKEND` ist entfernt. Der Wert `database` wird für alte `.env`-Dateien toleriert, `json` führt zu einem Startfehler mit Hinweis auf die Migration.
- `backend/src/data/sidebar.json` und `default-metamodel.json` bleiben als **schreibgeschützte Seed-Quellen** für `db:seed` und `db:migrate-json`.
- `npm run db:migrate-json --workspace backend` überträgt alle alten JSON-Dateien einmalig und verlustfrei. Firmen mit vorhandenen Daten werden übersprungen, Quelldateien nicht verändert.
- Unit-Tests laufen weiterhin ohne Datenbank (In-Memory-Repositories, reine Funktionen). Die CI braucht keinen PostgreSQL-Service.

## Teilentscheidung: `/api/model` bleibt JSONB

`/api/model` speichert Elemente, Relationen und Audit-Log weiterhin als **JSONB-Spalten** in der Tabelle `ArchitectureModel` (eine Zeile pro Firma). Das ist PostgreSQL und erfüllt REQ-28. Eine Aufteilung in eigene Tabellen wird bewusst **nicht** in diesem Issue umgesetzt.

**Gründe:**
- `/api/model` ist laut README der historische Legacy-Pfad ohne aktuelle UI-Zusage. Die aktuelle Oberfläche nutzt `/api/sidebar`, und dort gibt es bereits normalisierte Tabellen (`ComponentInstance`, `ConnectionInstance`, `Diagram`, …).
- Eigene Tabellen bräuchten neues Schema, eine Datenmigration aus JSONB und eine Neuschreibung von `store.ts`. Das wäre Größe L und gehört nicht zu REQ-28 (Größe M).
- Die Nachteile von JSONB sind für einen Prototyp mit wenigen gleichzeitigen Nutzern pro Firma tragbar.

**Bekannte Nachteile von JSONB:**
- Jede Änderung schreibt die komplette Liste neu.
- Gleichzeitige Änderungen derselben Firma können sich gegenseitig überschreiben (Last-Write-Wins).
- Keine Fremdschlüssel zwischen Relationen und Elementen. Konsistenz wird im Code geprüft.
- Abfragen über einzelne Elemente (Filter, Reports) sind umständlicher als mit Tabellen.

### Folge-Issue (optional)

Wenn diese Nachteile relevant werden, kann ein eigenes Issue sie lösen. Vorschlag:

> **[REQ-xx] `/api/model` normalisieren oder in `/api/sidebar` überführen**
>
> Zuerst klären, ob `/api/model` noch gebraucht wird. Falls nein: Endpunkte und `ArchitectureModel` entfernen, nützliche Funktionen (Impact-Analyse, Portfolio) auf die Sidebar-Daten umstellen. Falls ja: Tabellen `ModelElement`, `ModelRelation`, `ModelAuditEntry` mit `companyId` und Fremdschlüsseln anlegen, Prisma-Migration mit Datenübernahme aus den JSONB-Spalten schreiben, `store.ts` auf Einzeloperationen umstellen. API-Verträge bleiben gleich.
>
> Größe: L. Auslöser: gleichzeitige Bearbeitung, Reports über Elemente oder Audit-Diffs auf Elementebene.

## Folgen

- Lokale Entwicklung: `npm run db:up` (PostgreSQL im Container), `npm run db:setup`, `npm run dev`. Die Backend-Skripte laden die `.env` im Projektwurzelverzeichnis automatisch.
- Docker, Staging und Produktion: keine Änderung im Ablauf. `STORAGE_BACKEND` kann aus den Server-`.env`-Dateien entfernt werden.
- Wer noch Daten in alten JSON-Dateien hat, führt einmal `npm run db:migrate-json --workspace backend` aus.
