# REQ-23 – Abnahmematrix und Bestandsaufnahme

Stand: 08.11.2026. Issue: #55. Aktuelle Branchbasis: `805b281d4f99f7f4bc0db8c9c66b0d1646ea5926` (`main` nach Merge von PR #97). Der Ersthead `8a9de7a05a84ed6cff49fdd1d843fcc5afd9ba67` wurde unabhängig abgelehnt; technischer Korrekturhead ist `abff4e90beb91526d759bc645cf4c9e87ece8834`.

## Abnahmematrix

| Kriterium | Umsetzung | Evidenz | Status |
|---|---|---|---|
| Zeitpunkt, Akteur, Aktion, Objekt und alt/neu je Feld | kanonische `AuditLogEntry`; Akteur ausschließlich aus serverseitigem Principal; stabile Objektart/-ID; redigierte Felddiffs | isolierte PostgreSQL-Tests für Create/Update/Delete, Beziehungen, Diagramme und Importe | lokal verifiziert |
| Fachwrite und Audit atomar | Beleg in derselben Prisma/PostgreSQL-Transaktion wie die Mutation | erzwungener Auditfehler rollt Fachmutation zurück | lokal verifiziert |
| Fehler erzeugen keinen Erfolgsbeleg | Validierung/RBAC und Versionprüfung vor Commit | 400/403/409 und Mehrprozesskonflikte mit unverändertem Auditbestand | lokal verifiziert |
| Append-only über UI/API und Runtime-DB | keine Audit-Schreibroute; PostgreSQL-Trigger blockiert UPDATE/DELETE; Importe akzeptieren keine Auditdaten | echte Negativtests über dieselbe Prisma-Verbindung und nach Restore | Korrektur lokal verifiziert; Re-Review offen |
| Legacy-Initialisierung und No-op | `ArchitectureModel` plus `system.initialize` atomar; fachlicher Vergleich vor Version, Revision und beiden Auditpfaden | erster GET genau ein Beleg/Revision 0; Patch und Import vollständig still | Korrektur lokal verifiziert; Re-Review offen |
| Elementhistorie im Eigenschaftenpanel | zwingend nach Objekt-ID und Objektart gefiltert; Cursorseiten erreichbar | Frontend- und PostgreSQL-Test mit 21 Einträgen und gleicher ID verschiedener Typen | Korrektur lokal verifiziert; Re-Review offen |
| Zeitraum-, Akteur- und Elementfilter | tenantgebundene Keyset-Abfrage mit ISO-Zeitgrenzen und begrenzten Filtern | Filter-, Grenzwert-, Sortier-, Pagination- und Tenanttests | lokal verifiziert |
| Bestehende Historie erhalten | REQ-31-Tabelle kanonisch; JSONB-Legacyeinträge ohne erfundene Daten übernommen; Quelle bleibt erhalten | Migration, Backup/Restore/Rollback und beide GET-Pfade | lokal verifiziert |
| REQ-31-Importprotokoll erhalten | Importsummary plus objektbezogene Einträge mit Batchbezug; keine importierte Historie | CSV/XLSX-/JSON-Importtests | lokal verifiziert |
| REQ-33/REQ-26 unverändert | Schema-, Metamodell- und Laufzeitversion bleiben getrennt; echte Importe erhöhen Objektversion strikt | Roundtrip-, No-op- und Optimistic-Locking-Regression | lokal verifiziert |
| Grenzen wahrheitsgemäß | DB-Trigger ist kein kryptografischer WORM-Schutz gegen Owner/Superuser | Abschlussdokumentation und unabhängige Kontrolle | lokal dokumentiert; Re-Review offen |

## Bestandsaufnahme und Schreibpfade

REQ-31 stellte bereits eine relationale, unternehmensbezogene Importhistorie bereit. Der historische `/api/model`-Pfad führte daneben `ArchitectureModel.auditLog` als JSONB ohne verlässlichen Altakteur oder Felddiff. Die ursprüngliche Audit-API war limitbasiert; die UI besaß keine vollständige Elementhistorie.

Erfasst werden alle Modellschreibpfade: Komponenten, Verbindungen, Diagramme, Metamodell, Typen, Regeln, Viewpoints, Validierungsregeln, Kataloge, CSV/XLSX, vollständiger REQ-33-JSON-Import, Metamodellimport und historische `/api/model`-Mutationen. Kaskaden erzeugen Belege für gelöschte Beziehungen und geänderte Diagrammmitgliedschaften. Login/Logout sowie reine Reads, Exporte, Previews und Validierungen gehören nicht zum Architekturmodell-Audit.

## Actor-/Action-/Object-Vertrag

- `actorType`: `user`, `system` oder `legacy`; Benutzer werden innerhalb der Mutationstransaktion erneut companygebunden aufgelöst.
- `actorLabel`, `userId`, `userEmail`: Snapshot. Legacyeinträge bleiben ohne erfundenen Akteur.
- `action`: `create`, `update`, `delete`, `import.commit`, `model-json.import` oder `system.initialize`.
- `entityType` und `entityId`: stabile Objektklassifikation und ID; gelöschte Objekte bleiben filterbar.
- `changes`: sortierte Liste `{ field, before, after }`; technische Laufzeitversionen und Revisionen sind keine fachlichen Diffs. Die Metamodellversion bleibt als fachliches Feld sichtbar.
- Redaction und Limits: Secret-förmige Schlüssel, Tiefe, Schlüssel-, Array-, String-, Feld- und Detailgröße sind begrenzt; Trunkierung wird markiert.
- No-op: unveränderte Legacy-Patches/-Importe mutieren weder Objektversion, Datenrevision, JSONB-Audit noch kanonisches Audit. Ein echter Import erhöht Objektversionen weiterhin strikt.
- Zeit: neue Ereignisse erhalten serverseitige UTC-Zeit; unbekannte Legacy-Zeitpunkte bleiben unbekannt.

## Sortierung, Filter und Pagination

- Filter: `from`, `to`, `actor`, `entityId`, `entityType` und `action`; im Eigenschaftenpanel sind `entityId` und `entityType` gemeinsam verpflichtend.
- Ungültige Zeitbereiche oder Cursor werden mit 400 abgelehnt.
- Standardseite 50, maximal 200; eingebettete Elementhistorie lädt je 20. Keyset-Cursor enthält Ereigniszeit und ID.
- Sortierung: `occurredAt DESC, id DESC`, unbekannte Legacy-Zeitpunkte zuletzt.
- Tenant-Scope stammt ausschließlich aus dem Principal.

## Migrations- und Sicherheitsentscheidung

Die Tabelle wird additiv erweitert und der Legacy-JSONB-Pfad beweistreu übernommen. Ein PostgreSQL-Trigger mit SQLSTATE `55000` blockiert UPDATE und DELETE auch über die Runtime-Verbindung. Der Rollback entfernt Trigger und Funktion vor Backfill, Indizes und Spalten. Datenbankeigentümer und Superuser können den Schutz administrativ deaktivieren; deshalb wird keine kryptografische WORM-Unveränderbarkeit behauptet.

## Unabhängige Korrekturschleife

| Befund am Head `8a9de7a…` | Korrektur im technischen Head `abff4e90…` | Gegenprobe |
|---|---|---|
| P1: direkte DB-Updates/-Deletes möglich | Append-only-Trigger, rollback-sicher | Prisma UPDATE/DELETE abgelehnt; Trigger nach Restore aktiv |
| P1: Initialisierung ohne kanonischen Beleg; No-op mutierte Revision/Audit | Company-Sperre, atomarer Systembeleg, `changed` vor Persistenz | erster GET genau ein Beleg; Patch und Import still |
| P2: Elementhistorie nur 20 und nur nach ID | Objektart Pflicht; Cursor-Weiterladen | 21 Einträge über zwei Seiten; gleiche ID anderer Art ausgeschlossen |
| P3: veraltete Basis-/Evidenzclaims | alle Abschluss- und Prozessdokumente commitgebunden aktualisiert | technischer SHA und offene Re-Review-Grenze explizit |
