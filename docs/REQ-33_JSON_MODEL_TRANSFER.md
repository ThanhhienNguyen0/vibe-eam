# REQ-33 – Vollständiger JSON-Modelltransfer

## Zweck und Abgrenzung

REQ-33 ergänzt einen vollständigen, versionierten Transfervertrag für den aktuellen Sidebar-/Diagramm-Pfad. Die drei älteren Teilformate bleiben unverändert:

- `/api/model/export` und `/api/model/import`: historisches Architekturmodell mit Legacy-Elementen und -Relationen.
- `/api/sidebar/metamodel/export` und `/api/sidebar/metamodel/import`: Metamodell, Regeln und Viewpoints ohne Instanzen, Diagramme und Kataloge.
- `/api/sidebar/export` und `/api/sidebar/import/*`: CSV/XLSX für Instanzen und Relationen; keine Diagrammmitgliedschaften.

Der vollständige JSON-Vertrag liegt unter:

- `GET /api/sidebar/model/export` – alle angemeldeten Rollen dürfen lesen.
- `POST /api/sidebar/model/import` – nur Admin, weil der Replace-Import auch das Metamodell ersetzt.
- JSON Schema: `backend/src/modelTransfer/vibe-eam-model.schema.json`.

## Versionen

`schemaVersion` versioniert ausschließlich das Dateiformat. Version 1 ist die einzige akzeptierte Version. Fehlende, ältere und zukünftige Versionen werden vor jeder Mutation mit getrennten Fehlercodes abgelehnt. Es gibt kein unversioniertes Vorläuferformat, das verlustfrei als vollständiges aktuelles Modell migriert werden könnte.

`model.metamodel.version` bleibt die fachliche Metamodellversion. Eine spätere Laufzeitrevision für Optimistic Locking ist nicht Bestandteil dieses Formats und wird nicht als `schemaVersion` ausgegeben.

## Inhalt von Version 1

Der Schlüssel `model` enthält:

- Metamodell, Komponenten- und Verbindungstypen;
- ConnectionRules, Viewpoints, ViewpointRules und ValidationRules;
- Komponenten und Relationen einschließlich freier Eigenschaften und externer IDs;
- Diagramme einschließlich Mitgliedschaften und Positionen;
- gespeicherte Kataloge einschließlich ihrer Reihenfolge, Typfilter, Property-Spalten und Standardspalten.

Nicht enthalten sind Company-ID, Benutzer, Rollen, Passwort-Hashes, Tokens, Secrets, Legacy-Auditverlauf und `AuditLogEntry`-Historie. Der Import löscht oder ersetzt diese Daten nicht. Er ergänzt nur einen append-only Import-Summary-Eintrag im bestehenden `AuditLogEntry`.

## Portable IDs und Tenant-Isolation

Datei-IDs sind portable fachliche Identifikatoren. Interne PostgreSQL-IDs werden beim Export vom Präfix der authentifizierten Company befreit. Beim Import werden alle Ressourcen-IDs, Fremdschlüssel, Diagrammmitgliedschaften und Positionsschlüssel deterministisch mit dem Ziel-Company-Präfix materialisiert. Externe IDs bleiben unverändert.

Damit kann dasselbe Exportdokument gleichzeitig in mehreren Companies importiert werden, ohne globale Prisma-Primärschlüssel zu teilen. Ein erneuter Export aus beiden Companies liefert wieder dieselben portablen IDs. Der Import ermöglicht keinen Zugriff auf fremde Daten und übernimmt keine Company-ID aus der Datei.

## Determinismus und Werte

Objektschlüssel werden kanonisch sortiert. Persistierte Collection-Reihenfolgen bleiben erhalten; Diagramm-Mitgliedschafts-IDs werden kanonisch sortiert, weil die Join-Tabellen keine fachliche Reihenfolge speichern. Katalog- und Spaltenreihenfolgen bleiben fachlich erhalten. Unicode, leere Strings und optionale Felder werden nicht zur Herstellung von Gleichheit entfernt. Metamodell-`createdAt` und `updatedAt` werden erhalten; technische Diagramm-/Katalog-DB-Zeitstempel sind nicht Teil des aktuellen Editorvertrags und werden nicht exportiert.

## Validierung, Replace und Atomizität

Ajv validiert die Datei gegen das versionierte JSON Schema. Danach werden eindeutige IDs, sämtliche Typ-/Regel-/Viewpoint-/Instanz-/Diagramm-/Katalogreferenzen, externe-ID-Eindeutigkeit und Diagrammendpunkte geprüft. Dieser Schritt findet vor dem Whole-State-Write statt und verhindert insbesondere, dass `removeDanglingInstanceReferences` eine kaputte Datei still bereinigt.

Der Import ist ein ausdrücklicher Replace des vollständigen Modellzustands der authentifizierten Company. Es gibt keinen Merge- oder Preview-Modus. Der bestehende Prisma-Whole-State-Write führt Upserts, Löschungen und den Import-Summary-Eintrag in einer PostgreSQL-Transaktion aus. Ein Schema-, Referenz-, Tenant- oder DB-Fehler hinterlässt keine Teiländerung und aktualisiert den Prozesscache erst nach erfolgreichem Commit.

## Kompatibilität und Grenzen

- Keine Prisma-Migration: REQ-33 verwendet die vorhandenen relationalen Tabellen und den vorhandenen transaktionalen Writer.
- Bestehende Legacy-, Metamodell-, CSV- und XLSX-Routen bleiben erhalten.
- Der globale Express-JSON-Parser begrenzt JSON-Imports weiterhin auf 2 MiB.
- Der Replace-Import ist bewusst Admin-only und besitzt noch keine fachliche Vorschau.
- Optimistic Locking und vollständige Before/After-Audits bleiben REQ-26 beziehungsweise REQ-23.

## Lokale Evidenz vom 04.11.2026

- Format-/Schema-/RBAC-Tests: `npm run test --workspace backend -- --run src/modelTransfer/modelTransfer.test.ts src/auth/rbac.test.ts` – 2 Dateien, 22 Tests bestanden.
- Isolierter PostgreSQL-Cluster: `$env:PG_BIN='C:\Program Files\PostgreSQL\14\bin'; npm run test:rbac:db` – sechs Migrationen angewendet; 3 Dateien, 11 Tests bestanden.
- Die drei DB-Testdateien laufen bewusst seriell und mit einem 30-Sekunden-Einzeltestlimit: parallele temporäre Datenbanklast verursachte zunächst Timeouts; eine bestehende REQ-31-Prüfung überschritt unter Last einmal das Vitest-Standardlimit von fünf Sekunden. Assertions und Produktzeitlimits wurden nicht gelockert.
- Der DB-Test prüft byte-identischen Export → Import → Export, geteilte Elemente in zwei Diagrammen, Positionen, Regeln/Viewpoints, Unicode, leere Werte, Kataloge/externe IDs, zwei parallele Companies, 401/403, fehlende/alte/zukünftige Versionen, kaputte Referenzen, Audit-Ausschluss/-Erhalt und einen per PostgreSQL-Trigger erzwungenen Transaktionsrollback.
- Legacy-Modell-JSON, Metamodell-JSON, CSV und XLSX werden im selben DB-Lauf als Regression ausgeführt.
- Der erste `npm install`-Versuch und die erste Prisma-Generierung scheiterten in der Sandbox mit `ENOTFOUND`; die identischen Schritte wurden gemäß Sandbox-Regel mit freigegebenem Netzwerkzugriff erfolgreich wiederholt. Ein erster DB-Versuch mit dem unvollständigen PostgreSQL-16-Bin-Verzeichnis scheiterte an fehlendem `initdb.exe`; PostgreSQL 14 stellte die vollständigen Werkzeuge bereit.

Finale lokale Gates am 05.11.2026 auf Ajv 8.18.0:

- `npm run check` bestand: Lint und beide Typechecks; 165 bestandene/11 übersprungene Backendtests (DB-Tests laufen im separaten Pflichtgate), 36 Frontendtests; beide Produktionsbuilds; 113 Compose-, 169 Workflow- und 17 Securityprüfungen; Prisma-Konfigurationsprüfung.
- `npm run scan:dependencies` bestand mit 0 hohen/kritischen und 10 weiterhin sichtbaren moderaten Tooling-Befunden. Das direkte Ajv-Finding der zunächst installierten Version 8.17.1 wurde kompatibel mit 8.18.0 behoben; kein `--force`.
- `npm run scan:secrets` bestand: Canary erkannt, 72 Commits und 203 aktuelle Repository-Dateien ohne echten Fund.
- Alle drei realen `docker compose ... config --quiet`-Aufrufe mit `.env.example`, `.env.staging.example` und `.env.prod.example` bestanden.
- Der exakte CI-Image-Build `docker compose ... build backend frontend` wurde versucht, aber nicht ausgeführt: Die lokale Docker-Desktop-Linux-Engine-Pipe fehlte. Hintergrundstart von Docker Desktop und Start des Systemdiensts stellten die Engine nicht bereit; der Dienstzugriff war in dieser Umgebung nicht erlaubt. Anwendungsbuilds bestanden, aber Container-Image-Build, Remote-CI, CodeQL, Deployment und unabhängige Freigabe bleiben ausdrücklich unbelegt.
