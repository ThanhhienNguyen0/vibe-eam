# REQ-23 – Audit Log: lokale Abschlussdokumentation

Stand: 08.11.2026. Issue: #55. Branch: `codex/eam/req-23-audit-log`. Technische Basis: `c7509b9ffc5bfcdc2d4e6f77116ea63198c1af4a`. Für diesen Arbeitsstand wurde weder gepusht noch ein Pull Request angelegt, gemergt, ein Issue geschlossen oder ein Deployment ausgelöst.

## Ergebnis und Vertrag

Die bisherige REQ-31-Tabelle `AuditLogEntry` ist die kanonische, unternehmensgebundene Historie. Jede erfolgreiche Modellmutation schreibt nun in derselben PostgreSQL-Transaktion mindestens einen strukturierten Beleg. Er enthält serverseitige UTC-Zeit, den aus dem authentifizierten Principal erneut innerhalb der Transaktion aufgelösten Akteur, Aktion, Objektart, Objekt-ID, Zusammenfassung und eine sortierte Liste der geänderten Felder mit Vorher-/Nachherwerten. Clientseitig gelieferte Akteurswerte werden nicht verwendet.

Erfasst werden Komponenten, Verbindungen, Diagramme, Metamodell, Typen, Regeln, Viewpoints, Validierungsregeln, Kataloge sowie die historischen `/api/model`-Mutationen. Kaskaden protokollieren auch gelöschte Verbindungen und geänderte Diagrammmitgliedschaften. CSV-/XLSX- und vollständige JSON-Importe behalten ihren zusammenfassenden Importbeleg und ergänzen objektbezogene Einträge mit gemeinsamer Batch-ID. Reine Reads, Exporte, Previews, Validierungsfehler, RBAC-Ablehnungen, stale Writes und echte No-ops erzeugen keinen Erfolgsbeleg.

Technische `version`-, `dataRevision`-, `createdAt`- und `updatedAt`-Felder werden nicht als fachliche Änderungen ausgewiesen. Schlüssel, die auf Passwort, Token, Secret, Authorization, Credential, Private Key oder API Key deuten, werden rekursiv redigiert. Tiefe, Schlüsselzahl, Arraylänge, Stringlänge, Feldanzahl, Zusammenfassung und freie Details sind begrenzt; Trunkierung bleibt sichtbar. Das reduziert sensible und unkontrolliert große Auditdaten, ersetzt aber keine vollständige Datenklassifikation aller kundenspezifischen Freitextfelder.

## Lesen, Filtern und Oberfläche

`GET /api/sidebar/audit-log` bleibt nur lesbar und ist für Admin und Architect verfügbar. Die API akzeptiert `from`, `to`, `actor`, `entityId`, `entityType`, `action`, `limit` und einen undurchsichtigen Cursor. Zeitwerte müssen ISO 8601 mit Zeitzone sein; Textfilter und Cursor werden begrenzt beziehungsweise validiert. Die Abfrage wird immer aus dem authentifizierten Company-Kontext gebildet. Sortiert wird stabil nach `occurredAt DESC, id DESC`, unbekannte Legacy-Zeitpunkte stehen am Ende. Die Standardseite umfasst 50, das Maximum 200 Einträge.

Die Auditansicht zeigt Zeitpunkt, Akteur, Aktion, Objekt, Zusammenfassung und strukturierte Vorher-/Nachherwerte. Zeitraum, Akteur und Element lassen sich filtern; weitere Seiten werden per Cursor geladen. Komponenten und Verbindungen zeigen im Eigenschaftenpanel eine eigene, exakt nach Objekt-ID gefilterte Historie. Die Oberfläche benennt die Grenze ausdrücklich: Append-only gilt für Anwendung und API, nicht als kryptografischer WORM-Schutz gegen privilegierte Datenbankadministration.

## Migration und Legacy-Erhalt

Die additive Migration erweitert `AuditLogEntry` um Actor-Typ/-Label, Objekt-ID, Feldänderungen, Batch-ID und Ereigniszeit sowie passende Company-/Zeit-, Actor- und Objektindizes. Bestehende REQ-31-Zeilen erhalten ihren bereits vertrauenswürdigen `createdAt`-Wert als Ereigniszeit; ein Benutzerakteur wird nur markiert, wenn schon eine User-ID gespeichert war.

Historische Einträge aus `ArchitectureModel.auditLog` werden einmalig als `legacy` in die relationale Lesesicht übernommen. Fehlende Akteure, Feldänderungen oder belastbare Ereigniszeitpunkte werden nicht erfunden. Der originale Zeitwert und Payload bleiben in `details`; die JSONB-Quelle bleibt unverändert und der alte GET-Pfad kompatibel. Der Rollback entfernt ausschließlich die markierten Backfill-Zeilen, Indizes und neuen Spalten. Ein Wegrollen nach produktiver Nutzung würde neue REQ-23-Auditfelder verwerfen und ist deshalb nur mit vorherigem Backup und bewusster Betriebsentscheidung zulässig.

## Ausgeführte Evidenz

- Isoliertes PostgreSQL 14: alle acht Migrationen auf einer neuen Einwegdatenbank; 36/36 Datenbanktests in fünf Dateien bestanden. Enthalten sind atomarer Auditfehler-Rollback, kein Erfolgsbeleg bei Fehlern/stale Writes, Tenantgrenzen, Filter/Pagination, JSON-Importerhalt, Legacy-Kompatibilität, unabhängige Prisma-Clients und Mehrprozessrennen.
- Backup/Restore/Rollback: Dump und Restore in eine zweite Einwegdatenbank; Legacy-Beleg kontrolliert; REQ-23- und anschließend REQ-26-Rollback ausgeführt und Schemaabbau geprüft.
- Gesamtgate `npm run check` bestand; nach zwei ergänzten Regressionstests bestätigte der finale vollständige Testlauf 174 Backendtests bei 36 im normalen Lauf erwartungsgemäß übersprungenen DB-Tests sowie 42 Frontendtests. Lint, beide Typechecks, Backend-/Frontend-Build, 113 Compose-, 169 Workflow-, 17 Security- und Prisma-Konfigurationsprüfungen bestanden.
- Fokustests: 46 Backend-Unit-/Routentests und 2 Audit-UI-Tests bestanden.
- Dependency-Gate: 0 high, 0 critical, 10 moderate; die moderaten Funde bleiben im bestehenden Risikobericht sichtbar. Secret-Gate: Canary korrekt abgelehnt, 79 Commits und 219 aktuelle Dateien ohne Fund geprüft.
- `git diff --check` war fehlerfrei; lediglich die bestehende Windows-Zeilenendewarnung für `AuditLogView.tsx` wurde ausgegeben.

Der erste HTTP-Routentest im eingeschränkten Ausführungskontext scheiterte ausschließlich mit `EACCES 127.0.0.1`; derselbe Lauf bestand anschließend mit erlaubter Loopback-Nutzung 44/44. Zwei Secret-Scan-Versuche scheiterten am externen Download mit HTTP 504. Ein bereits lokal vorhandenes Releasearchiv derselben Gitleaks-Version wurde genutzt; das Skript prüfte dessen fest hinterlegten SHA-256-Hash vor dem erfolgreichen Scan. Ein lokaler Container-Image-Build war nicht möglich, weil nur ein leerer Windows-`docker`-Platzhalter und keine nutzbare Docker-Engine vorhanden waren. Die drei Compose-Dateien wurden statisch vollständig validiert; echte Image-Builds bleiben ein Remote-CI-Nachweis.

## Offene Freigabegrenzen

Dieser Stand ist lokal implementiert und getestet, aber nicht unabhängig freigegeben. Der getrennte Kontrollkontext muss den vollständigen Commit einschließlich Migration, Transaktionsgrenzen, Redaction, Cursorlogik, Legacy-Erhalt und UI prüfen. Ebenso offen bleiben Push, PR, Remote-CI/CodeQL, menschliches Review, Merge, Issue-Schließung, Staging und Produktion. Während der Arbeit wurde gemeldet, dass PR #97 extern in `main` gemergt wurde und dessen Tree der verwendeten Basis entspricht; Rebase und Prüfung eines daraus entstehenden neuen REQ-23-Heads erfolgen getrennt, damit die hier dokumentierte lokale Evidenz nicht stillschweigend auf einen anderen Commit übertragen wird.
