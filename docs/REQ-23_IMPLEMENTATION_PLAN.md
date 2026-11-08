# REQ-23 – Abnahmematrix und Bestandsaufnahme

Stand: 08.11.2026. Issue: #55. Branchbasis: `c7509b9ffc5bfcdc2d4e6f77116ea63198c1af4a` (damals gestapelt auf dem offenen REQ-26-Draft-PR #97). GitHub-`main` war bei der Bestandsaufnahme `9cc1b76656ef9fdaee8eaced5746b24c7a0710da`. Während der Umsetzung wurde PR #97 extern gemergt; der gemeldete neue `main`-Stand `805b281d4f99f7f4bc0db8c9c66b0d1646ea5926` besitzt gegenüber der verwendeten Basis denselben Tree. Ein Rebase ist nicht Bestandteil dieses lokalen Abschlusscommits.

Dieses Dokument beginnt mit dem Prüfvertrag. Ergebnisse werden erst nach ausgeführten Tests ergänzt.

## Abnahmematrix

| Kriterium | Geplante Umsetzung | Obligatorische Evidenz | Status |
|---|---|---|---|
| Zeitpunkt, angemeldeter Akteur, Aktion, Objekt und alt/neu je Feld | Erweiterung der vorhandenen relationalen `AuditLogEntry`-Basis; Akteur wird ausschließlich aus dem serverseitigen Principal aufgelöst; stabile Objektart/-ID; strukturierte, redigierte Feldänderungen | isolierte PostgreSQL-Tests für Create/Update/Delete, Beziehungen, Diagramme und Importe | lokal verifiziert |
| Fachwrite und Audit atomar | Auditzeilen werden in derselben Prisma/PostgreSQL-Transaktion wie die Mutation geschrieben | erzwungener Auditfehler rollt Mutation zurück; erfolgreiche Mutation und Audit gemeinsam sichtbar | lokal verifiziert |
| Fehler erzeugen keinen Erfolgsbeleg | Validierung/RBAC vor Mutation; stale Version und Transaktionskonflikt brechen vor Commit ab | 400/403/409 sowie Mehrprozess-Konflikt mit unverändertem Auditbestand | lokal verifiziert |
| Append-only über UI/API | keine Create/Update/Delete-Auditroute; Modell-, Metamodell- und Tabellenimporte akzeptieren keine Auditdaten; vorhandene Historie wird nicht ersetzt | Route-Policy-, Import- und Regressionstests | lokal verifiziert |
| Elementhistorie im Eigenschaftenpanel | gefilterte Historie für die ausgewählte Komponente beziehungsweise Relation | Frontend-Test und API-Integrationstest | lokal verifiziert |
| Filter Zeitraum, Akteur, Element | tenantgebundene Keyset-Seitenabfrage mit validierten ISO-Zeitgrenzen, Akteur und exakter Objekt-ID | Filter-, Grenzwert-, Sortier-, Pagination- und Tenant-Tests | lokal verifiziert |
| Lange Historien vollständig erreichbar | deterministische Sortierung `occurredAt DESC, id DESC`, begrenzte Seiten und Cursor | mehrere Seiten ohne Lücke/Duplikat | lokal verifiziert |
| Bestehende Historie erhalten | REQ-31-Tabelle bleibt kanonisch; historische `ArchitectureModel.auditLog`-Einträge werden einmalig als klar markierte Legacy-Einträge übernommen, ohne Akteur oder Diff zu erfinden; JSONB-Quelle bleibt erhalten | Migrations-, Backup/Restore-/Rollback- und Kompatibilitätstest beider GET-Pfade | lokal verifiziert |
| REQ-31-Importprotokoll erhalten und ergänzt | eine Importzusammenfassung plus objektbezogene Einträge mit gemeinsamem Batch-Bezug; keine vom Import gelieferte Historie | CSV/XLSX-/JSON-Importtests und Elementhistorie nach Import | lokal verifiziert |
| REQ-33/REQ-26 unverändert | `schemaVersion`, Metamodellversion und Laufzeitrevision bleiben getrennt; Audit ist kein JSON-Modellfeld; Versionen werden nicht als fachliche Diffs protokolliert | fokussierte Round-Trip- und Optimistic-Locking-Regression, Gesamtgate | lokal verifiziert |
| Grenzen wahrheitsgemäß | Append-only gilt für Anwendung und API; privilegierte DB-Administratoren werden nicht als WORM/kryptografisch unveränderbar behauptet | Abschlussdokumentation und unabhängige Kontrolle | lokal dokumentiert; unabhängige Kontrolle offen |

## Bestandsaufnahme der Auditpfade

1. `AuditLogEntry` (REQ-31) ist relational, unternehmensbezogen und wird beim CSV/XLSX-Commit bereits innerhalb der Whole-State-Transaktion geschrieben. Vorhanden sind Akteur-ID/-E-Mail, Aktion, Entität, Zusammenfassung, freie Details und Erstellzeit; Objekt-ID, expliziter Ereigniszeitpunkt, Feldänderungen, Filter und Cursor fehlen.
2. `ArchitectureModel.auditLog` ist der historische JSONB-Pfad hinter `/api/model` und `/api/audit-log`. Er enthält nur Zeit, grobe Aktion, Objekt-ID und Beschreibung. Historische Akteure und alt/neu-Werte sind nicht vorhanden und dürfen nicht rekonstruiert werden.
3. `/api/sidebar/audit-log` liefert bislang nur die letzten maximal 500 relationalen Einträge. Die UI ruft fest 200 Einträge ab und besitzt keine Filter oder Pagination.
4. Der aktuelle REQ-33-Modelltransfer exportiert keine Auditdaten. Der Import übergibt nur eine REQ-31-artige Zusammenfassung an denselben Whole-State-Commit.

## Inventar der Modell-Schreibpfade

| Pfad | Persistenzform | Auditrisiko / Vertrag |
|---|---|---|
| Komponenten: Create, Patch, Delete, Create-and-Place | Whole-State beziehungsweise direkte REQ-26-Transaktion | Create/Update/Delete-Diff; Kaskaden zu Relationen und Diagrammmitgliedschaften mit erfassen |
| Relationen: Create, Patch, Delete, Add-to-Diagram | Whole-State beziehungsweise direkte REQ-26-Transaktion | Endpunkte, Typ, Eigenschaften und betroffene Diagrammmitgliedschaften erfassen |
| Diagramme | Whole-State beziehungsweise direkte REQ-26-Transaktion | Name, Viewpoint, Mitgliedschaften und Positionen; technische `version` ausblenden |
| Metamodell, Typen, Regeln, Viewpoints | Whole-State | Objektbezogene Create/Update/Delete-Belege; `metamodel.version` ist fachlich, nicht `schemaVersion` oder Laufzeitrevision |
| Kataloge | Whole-State | Konfiguration und Löschung objektbezogen erfassen |
| CSV/XLSX-Commit | Whole-State mit vorhandenem Importbeleg | Summary erhalten; betroffene Komponenten/Relationen zusätzlich auffindbar machen |
| vollständiger REQ-33-JSON-Import | Whole-State mit vorhandenem Importbeleg | Historie außerhalb des Dateiformats; bestehende Auditzeilen dürfen nicht gelöscht werden |
| Metamodellimport | Whole-State | atomarer Diff, keine importierte Historie |
| historische `/api/model`-Mutation/-Import | gesperrtes `ArchitectureModel`-JSONB | neuen relationalen Beleg in derselben DB-Transaktion schreiben; alten GET-Pfad kompatibel halten |
| Initialisierung/Kompatibilitäts-Backfill | automatische Whole-State-Transaktion | als Systemvorgang kennzeichnen, nicht einem Benutzer als bewusste Fachänderung zuschreiben |
| Konflikt-Überschreiben | normaler REQ-26-Retry gegen aktuelle Version | nur der tatsächlich erfolgreiche Versuch erzeugt einen Beleg; erneuter Konflikt bleibt beleglos |

Nicht dem Architekturmodell-Audit zugerechnet werden Login/Logout und reine Lese-/Export-/Preview-/Validierungsaufrufe. Benutzerverwaltung bleibt im bestehenden REQ-24-Rollenmodell; eine Erweiterung um Governance-Audit wird nur vorgenommen, wenn sie ohne Vermischung des Modellvertrags sauber in derselben Transaktion belegbar ist.

## Actor-/Action-/Object-Vertrag

- `actorType`: `user`, `system` oder `legacy`. Benutzerakteure werden über die authentifizierte interne User-ID innerhalb der Mutationstransaktion aufgelöst; ein Clientfeld wird ignoriert.
- `actorLabel`, `userId`, `userEmail`: Snapshot für spätere Verständlichkeit. Legacy-Einträge bleiben ohne erfundenen Akteur.
- `action`: `create`, `update`, `delete`, `import.commit`, `model-json.import` oder `system.initialize`; Importzusammenfassungen sind Events, die fachlichen Objekte erhalten eigene Einträge.
- `entityType` und `entityId`: stabile, tenantneutrale Objektklassifikation und ID. Gelöschte Objekte bleiben darüber filterbar.
- `changes`: sortierte Liste `{ field, before, after }`. `undefined` wird als fehlend und in der JSON-Darstellung als `null` behandelt; technische Laufzeitversionen und Revisionen werden nicht als Fachänderung geführt.
- Redaction: schlüsselbasierte Sperre für Passwort-, Token-, Secret-, Authorization-, Credential- und Private-Key-Felder. Einzelwerte, Feldzahl und Gesamtdetails werden begrenzt; Trunkierung wird sichtbar markiert.
- No-op: erzeugt keinen Fachbeleg. Ein unveränderter Patch soll weder Objektversion noch Datenrevision erhöhen.
- Zeit: neue Ereignisse erhalten serverseitige UTC-Zeit. Legacy-Zeiten werden nur übernommen, wenn sie vorhanden und valide sind; andernfalls bleibt der Ereigniszeitpunkt unbekannt und der Originalwert nur als Legacy-Metadatum erhalten.

## Sortierung, Filter und Pagination

- Filter: `from` inklusiv, `to` inklusiv, `actor` (User-ID/E-Mail/Label), `entityId`, optional `entityType` und `action`.
- Ungültige Zeitbereiche oder Cursor werden mit 400 abgelehnt.
- Standardseite 50, maximal 200. Keyset-Cursor enthält nur Ereigniszeit und ID; keine Offset-Pagination.
- Die API liefert `{ items, nextCursor }`. Tenant-Scope wird serverseitig aus dem Principal gesetzt und ist kein Queryparameter.

## Migrations- und Sicherheitsentscheidung

Die vorhandene Tabelle wird erweitert, nicht ersetzt. Legacy-JSONB bleibt unverändert und wird nachvollziehbar in die relationale Lesesicht übernommen. Es wird keine Update-/Delete-Funktion für Auditzeilen bereitgestellt. Das schützt gegen normale UI-/API-Schreibpfade, nicht gegen privilegrierte direkte Datenbankeingriffe. Auditdetails enthalten keine JWTs, Passwort-Hashes oder vollständigen ungeprüften Request-Payloads.
