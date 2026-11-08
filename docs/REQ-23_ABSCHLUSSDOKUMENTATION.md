# REQ-23 – Audit Log: lokale Abschlussdokumentation

Stand: 08.11.2026. Issue: #55. Branch: `codex/eam/req-23-audit-log`. Aktuelle Basis: `805b281d4f99f7f4bc0db8c9c66b0d1646ea5926`. Der abgelehnte Ersthead ist `8a9de7a05a84ed6cff49fdd1d843fcc5afd9ba67`; technischer Korrekturhead ist `abff4e90beb91526d759bc645cf4c9e87ece8834`. Diese Dokumentation ist der anschließende reine Evidenz-Follow-up; dessen finaler SHA steht im Handoff, weil ein Commit seinen eigenen SHA nicht enthalten kann. Es wurde weder gepusht noch ein REQ-23-Pull-Request angelegt, gemergt, Issue #55 geschlossen oder ein Deployment ausgelöst.

## Ergebnis und Vertrag

Die bisherige REQ-31-Tabelle `AuditLogEntry` ist die kanonische, unternehmensgebundene Historie. Jede erfolgreiche Modellmutation schreibt nun in derselben PostgreSQL-Transaktion mindestens einen strukturierten Beleg. Er enthält serverseitige UTC-Zeit, den aus dem authentifizierten Principal erneut innerhalb der Transaktion aufgelösten Akteur, Aktion, Objektart, Objekt-ID, Zusammenfassung und eine sortierte Liste der geänderten Felder mit Vorher-/Nachherwerten. Clientseitig gelieferte Akteurswerte werden nicht verwendet.

Erfasst werden Komponenten, Verbindungen, Diagramme, Metamodell, Typen, Regeln, Viewpoints, Validierungsregeln, Kataloge sowie die historischen `/api/model`-Mutationen. Kaskaden protokollieren auch gelöschte Verbindungen und geänderte Diagrammmitgliedschaften. CSV-/XLSX- und vollständige JSON-Importe behalten ihren zusammenfassenden Importbeleg und ergänzen objektbezogene Einträge mit gemeinsamer Batch-ID. Reine Reads, Exporte, Previews, Validierungsfehler, RBAC-Ablehnungen, stale Writes und echte No-ops erzeugen keinen Erfolgsbeleg.

Die erstmalige Anlage des historischen `ArchitectureModel` und der kanonische `system.initialize`-Beleg erfolgen atomar nach einer Company-Sperre. Die Initialisierung erhöht weder Modellrevision noch Objektversion. Legacy-Patch und Legacy-Import vergleichen den fachlichen Zustand vor jeder Version-, Revisions-, JSONB- oder kanonischen Auditmutation. Ein No-op gibt den unveränderten Stand zurück. Ein tatsächlich verändernder Import erhöht jede betroffene Objektversion strikt über deren vorherigen Wert und erhält damit den REQ-26-ABA-Schutz.

Technische `version`-, `dataRevision`-, `createdAt`- und `updatedAt`-Felder werden nicht als fachliche Änderungen ausgewiesen. Schlüssel, die auf Passwort, Token, Secret, Authorization, Credential, Private Key oder API Key deuten, werden rekursiv redigiert. Tiefe, Schlüsselzahl, Arraylänge, Stringlänge, Feldanzahl, Zusammenfassung und freie Details sind begrenzt; Trunkierung bleibt sichtbar. Das reduziert sensible und unkontrolliert große Auditdaten, ersetzt aber keine vollständige Datenklassifikation aller kundenspezifischen Freitextfelder.

## Lesen, Filtern und Oberfläche

`GET /api/sidebar/audit-log` bleibt nur lesbar und ist für Admin und Architect verfügbar. Die API akzeptiert `from`, `to`, `actor`, `entityId`, `entityType`, `action`, `limit` und einen undurchsichtigen Cursor. Zeitwerte müssen ISO 8601 mit Zeitzone sein; Textfilter und Cursor werden begrenzt beziehungsweise validiert. Die Abfrage wird immer aus dem authentifizierten Company-Kontext gebildet. Sortiert wird stabil nach `occurredAt DESC, id DESC`, unbekannte Legacy-Zeitpunkte stehen am Ende. Die Standardseite umfasst 50, das Maximum 200 Einträge.

Die Auditansicht zeigt Zeitpunkt, Akteur, Aktion, Objekt, Zusammenfassung und strukturierte Vorher-/Nachherwerte. Zeitraum, Akteur und Element lassen sich filtern; weitere Seiten werden per Cursor geladen. Komponenten und Verbindungen zeigen im Eigenschaftenpanel eine zwingend nach Objekt-ID und Objektart gefilterte Historie. Je 20 Einträge werden geladen; alle weiteren Seiten sind über den API-Cursor erreichbar. Gleiche IDs unterschiedlicher Objektarten werden nicht vermischt.

Append-only gilt zusätzlich in PostgreSQL: Ein `BEFORE UPDATE OR DELETE`-Trigger lehnt direkte Änderungen auch über dieselbe Prisma-/Runtime-Verbindung ab. Anwendung und normale Runtime-SQL-Pfade können nur anhängen. Dies ist kein kryptografischer WORM-Speicher: Datenbankeigentümer oder Superuser können den Trigger absichtlich deaktivieren oder löschen und bleiben eine administrative Vertrauensgrenze. Ein Company-Delete würde wegen des Triggers auch den kaskadierenden Audit-Delete blockieren, solange der Schutz nicht administrativ und bewusst aufgehoben wird.

## Migration und Legacy-Erhalt

Die additive Migration erweitert `AuditLogEntry` um Actor-Typ/-Label, Objekt-ID, Feldänderungen, Batch-ID und Ereigniszeit sowie passende Company-/Zeit-, Actor- und Objektindizes. Bestehende REQ-31-Zeilen erhalten ihren bereits vertrauenswürdigen `createdAt`-Wert als Ereigniszeit; ein Benutzerakteur wird nur markiert, wenn schon eine User-ID gespeichert war. Der Rollback entfernt zuerst Trigger und Funktion, danach ausschließlich markierte Backfill-Zeilen, Indizes und Spalten.

Historische Einträge aus `ArchitectureModel.auditLog` werden einmalig als `legacy` in die relationale Lesesicht übernommen. Fehlende Akteure, Feldänderungen oder belastbare Ereigniszeitpunkte werden nicht erfunden. Der originale Zeitwert und Payload bleiben in `details`; die JSONB-Quelle bleibt unverändert und der alte GET-Pfad kompatibel. Ein Wegrollen nach produktiver Nutzung würde den DB-Schutz und neue REQ-23-Auditfelder verwerfen und ist deshalb nur mit vorherigem Backup und bewusster Betriebsentscheidung zulässig.

## Ausgeführte Evidenz

- Technischer Korrekturhead `abff4e90beb91526d759bc645cf4c9e87ece8834`: isoliertes PostgreSQL 14 mit allen acht Migrationen und 39/39 Datenbanktests in fünf Dateien. Neu belegt sind direkte UPDATE-/DELETE-Ablehnung über Prisma, einmalige atomare Legacy-Initialisierung, revisions-/versions-/auditneutrale Legacy-No-ops, 21 typgebundene Historieneinträge über zwei Cursorseiten sowie eine gleichlautende ID einer anderen Objektart.
- Backup/Restore/Rollback: Dump und Restore in eine zweite Einwegdatenbank; der wiederhergestellte Trigger blockierte ein direktes UPDATE. Der REQ-23-Rollback entfernte Trigger, Funktion, Backfill, Indizes und Spalten; danach bestand der REQ-26-Rollback.
- Gesamtgate `npm run check`: 174 Backendtests bestanden, 39 DB-gebundene Tests im normalen Lauf erwartungsgemäß übersprungen; 42 Frontendtests bestanden. Lint, beide Typechecks, Backend-/Frontend-Build, 113 Compose-, 169 Workflow-, 17 Security- und Prisma-Konfigurationsprüfungen bestanden.
- Dependency-Gate: 0 high, 0 critical, 10 moderate; die moderaten Funde bleiben im bestehenden Risikobericht sichtbar. Secret-Gate am technischen Korrekturhead: Canary korrekt abgelehnt, 81 Commits und 220 aktuelle Dateien ohne Fund geprüft.
- `git diff --check` war fehlerfrei.

Historische Fehlversuche der Erstimplementierung bleiben dokumentiert: Der erste HTTP-Routentest im eingeschränkten Ausführungskontext scheiterte mit `EACCES 127.0.0.1`; zwei Scannerdownloads mit HTTP 504. Der erste Korrektur-DB-Lauf bestand 38/39 und zeigte, dass die revisionsneutrale Initialisierung einen verändernden Legacy-Import nicht mehr strikt über die bestehende Objektversion hob. `max(dataRevision+1, bisherige Objektversion+1)` schloss diese REQ-26-Regression; der vollständige Wiederholungslauf bestand 39/39. Ein lokaler Container-Image-Build war weiterhin mangels nutzbarer Docker-Engine nicht möglich. Die drei Compose-Dateien wurden statisch vollständig validiert; echte Image-Builds bleiben ein Remote-CI-Nachweis.

## Offene Freigabegrenzen

Der unabhängige Exact-Head-Review lehnte `8a9de7a05a84ed6cff49fdd1d843fcc5afd9ba67` mit zwei P1-, einem P2- und einem P3-Befund ab. Der technische Korrekturhead `abff4e90beb91526d759bc645cf4c9e87ece8834` und der nachfolgende Dokumentationshead sind lokal geprüft, aber noch nicht erneut unabhängig freigegeben. Die Kontrollinstanz muss DB-Trigger, Legacy-Initialisierung/No-op, typgebundene Cursorhistorie und alle Evidenzclaims am finalen unveränderten Head prüfen. Offen bleiben Push, REQ-23-PR, Remote-CI/CodeQL, menschliches Review, Merge, Issue-Schließung, Staging und Produktion.
