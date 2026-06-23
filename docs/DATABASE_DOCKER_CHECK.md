# Database and Docker Check

Prüfdatum: 22.06.2026

## 1. Kurzfazit

| Bereich | Gesamtstatus | Einordnung |
| --- | --- | --- |
| Issue #17 – Datenbank | Weitgehend umgesetzt | Schema, Migration, Prisma-Repository, DB-Auswahl und JSON-Migration sind vorhanden. Im laufenden Stack sind eine abgeschlossene Prisma-Migration, Seed-Daten, Sidebar-DB-Lesen, Diagramm-Aggregat und Metamodel-Export nachgewiesen. Ein destruktiver Live-Cascade-/Importtest bleibt offen. |
| Issue #19 – Docker | Lokal umgesetzt | Dockerfiles, Compose, Env-Konfiguration, Healthchecks und Volume sind vorhanden. Der mit `docker.exe compose` gestartete lokale Stack zeigt PostgreSQL, Backend und Frontend als laufend; Frontend und Backend antworten mit HTTP 200. |
| Bestehende Fachlogik | Umgesetzt | Metamodel-Import/-Export und ConnectionRule-basierte Validierung bleiben durch bestehende und ergänzte Tests abgedeckt. Auth wurde bewusst nicht ergänzt. |

Die Issues sind damit als lokales Infrastruktur-MVP weitgehend umgesetzt. Für die vollständige DB-Abnahme fehlen noch gezielte, isolierte PostgreSQL-Integrationstests für Write, FK-Fehler, Cascade Delete und Import; der lokale Containerstart ist inzwischen bestätigt.

## 2. Ausgeführte Befehle

| Befehl | Ergebnis |
| --- | --- |
| `npm install --save-dev yaml@2.8.1` | Erfolgreich; ergänzt den Docker-unabhängigen YAML-Validator. npm meldete 12 Advisories (1 low, 5 moderate, 4 high, 2 critical); keine riskanten automatischen Updates durchgeführt. |
| `npm run db:generate --workspace backend` | Erfolgreich; Prisma Client 6.19.0 generiert. Prisma warnt vor der in Prisma 7 entfallenden `package.json#prisma`-Seed-Konfiguration. |
| `prisma validate --schema backend/prisma/schema.prisma` mit syntaktischer Platzhalter-`DATABASE_URL` | Erfolgreich; Schema ist valide. Keine DB-Verbindung erforderlich. |
| `prisma migrate diff --from-empty --to-schema-datamodel ... --script` | Erfolgreich; normalisierte Ausgabe stimmt exakt mit `backend/prisma/migrations/20260622150000_init/migration.sql` überein (`MIGRATION_MATCH=True`). |
| `npm run validate:compose` | Erfolgreich; YAML, Env-Auflösung, drei Services, Healthchecks, Volume, Dockerfile-Instruktionen, Prisma-Build/Migration/Seed und Nginx-Upstream statisch geprüft. Dies ist kein Containerstart. |
| `npm run typecheck` | Erfolgreich. |
| `npm test` | Erfolgreich; 44 Tests. |
| `npm run build` | Erfolgreich; Backend und Vite-Frontend gebaut. Der Vite-Build benötigt in dieser OneDrive-Umgebung Ausführung außerhalb der Dateisandbox. |
| Prisma-Migration im laufenden Container | Read-only geprüft; `_prisma_migrations` enthält eine abgeschlossene Migration. Der Backend-Container führt `prisma migrate deploy` beim Start aus. |
| Seed/DB-Daten im laufenden Container | Read-only über API geprüft: 8 ComponentTypes, 15 ConnectionRules und 3 Diagramme vorhanden. Der Seed läuft idempotent beim Backend-Start. |
| `docker.exe compose --env-file .env.example -f docker-compose.yml config --quiet` | Erfolgreich. Auf diesem Windows-System ist die explizite Endung `.exe` erforderlich. |
| `docker.exe compose ps --services --status running` | Erfolgreich; `backend`, `frontend` und `postgres` laufen. |
| HTTP-/DB-Readiness | Backend `/api/health` HTTP 200, Frontend HTTP 200, PostgreSQL `pg_isready` meldet „accepting connections“. |
| `docker.exe compose up --build` | Wurde bereits benutzerseitig ausgeführt; in dieser Prüfung nicht erneut gestartet, um den laufenden lokalen Stack nicht unnötig neu zu bauen. |

## 3. Prüfung Issue #17 – Datenbank

| Kriterium | Status | Nachweis | Restgrenze |
| --- | --- | --- | --- |
| 1. JSON-Persistenz wurde für den aktuellen Hauptpfad durch DB ersetzt | Umgesetzt | Docker setzt `STORAGE_BACKEND=database` und `DATABASE_URL`; laufender Sidebar-Endpunkt liefert PostgreSQL-Seed-Daten. | Historisches `/api/model` bleibt JSON. |
| 2. ComponentTypes werden gespeichert | Umgesetzt | Prisma-Modell und Repository; laufender DB-Stack liefert 8 ComponentTypes. | Granularer Create/Update-Integrationstest fehlt. |
| 3. ComponentInstances werden gespeichert | Umgesetzt, statisch getestet | Modell `ComponentInstance`, JSONB-Properties, Diagramm-FK und Repository-Mapping. | `diagramId` ist für den zweistufigen Editor-Ablauf nullable. |
| 4. ConnectionTypes werden gespeichert | Umgesetzt | Modell/Repository und laufender DB-basierter Sidebar-State. | Granularer Write-Integrationstest fehlt. |
| 5. ConnectionInstances werden gespeichert | Umgesetzt | Modell/Repository und laufender DB-basierter Sidebar-State. | Granularer Write-Integrationstest fehlt. |
| 6. Source-/Target-Beziehungen sind konsistent | Umgesetzt | Echte FKs auf `ComponentInstance`; Prisma-Schema und SQL-Migration validiert; Anwendung prüft existierende Endpunkte. | Die DB-Constraints wurden nicht gegen einen laufenden Server provoziert. |
| 7. Flexible Attribute bleiben möglich | Umgesetzt | `properties`, `position`, `customPropertyKeys` und flexible ID-Mengen sind PostgreSQL `JSONB`; Roundtrip im Repository-Contract-Test. | UI bearbeitet Properties weiterhin überwiegend als String-Werte. |
| 8. Löschen einer ComponentInstance löscht Connections | Umgesetzt, zweifach abgesichert | Source-/Target-FKs haben `ON DELETE CASCADE`; State-Fallback räumt Connections ebenfalls auf; Test vorhanden. | Reale PostgreSQL-Kaskade nicht live ausgeführt. |
| 9. Diagramm inklusive Komponenten und Positionen laden | Umgesetzt | Prisma liest Diagramme mit `include`; `GET /api/sidebar/diagrams/:id` liefert `{ diagram, components, connections }`, Positionen liegen in `diagram.positions`; Test vorhanden. | Endpoint liest aktuell über den kompatiblen Gesamt-State, nicht über ein dediziertes Single-Diagram-Repository. |
| 10. Auth bewusst nicht implementiert | Erfüllt | Kein Auth-Code oder Auth-Container ergänzt; Dokumentation grenzt Auth aus. | Vor externem Betrieb zwingend neu zu bewerten. |

### Codeprüfung Prisma

- `backend/prisma/schema.prisma` enthält Metamodel, ComponentType, ConnectionType, ConnectionRule, Viewpoint, ViewpointRule, ValidationRule, Diagram, ComponentInstance und ConnectionInstance.
- Source und Target sind relationale Fremdschlüssel; die generierte SQL-Migration enthält beide `ON DELETE CASCADE`-Constraints.
- Flexible Felder werden als `Json @db.JsonB` modelliert.
- Eine initiale Migration und `migration_lock.toml` existieren.
- ConnectionRule bleibt in `metamodelRules.ts` die primäre Regelquelle; Legacy-Source-/Target-Listen erzeugen keinen Fallback.

### Storage Backend

- `DATABASE_URL` aktiviert standardmäßig PostgreSQL, außer `STORAGE_BACKEND=json` wurde explizit gewählt.
- `STORAGE_BACKEND=database` ohne `DATABASE_URL` bricht nach dieser Prüfung früh mit einer verständlichen Fehlermeldung ab, statt still JSON zu verwenden.
- JSON wird bei DB-Betrieb gelesen, wenn eine leere DB initial übernommen wird, aber nicht überschrieben oder gelöscht.
- `db:migrate-json` verweigert eine nicht leere DB ohne bewusstes `FORCE_JSON_MIGRATION=true`.
- Der Docker-Start seedet eine leere DB vor dem Serverstart. Die vollständige Übernahme des bisherigen `sidebar.json` bleibt ein separater, bewusster Migrationsschritt.

### API und Metamodel

- Die vorhandenen `/api/sidebar`-Routen und Antworttypen bleiben bestehen; das Frontend änderte nur den konfigurierbaren API-Basispfad.
- Metamodel-Export nutzt weiterhin `extractMetamodelDefinition`.
- Metamodel-Import validiert Referenzen, schreibt transaktional über denselben Store und lehnt Imports ab, die bestehende Instanzen verwaisen ließen.
- Bestehende Tests belegen, dass ConnectionRules nach Export/Import validierbar bleiben. Ein HTTP-Test gegen PostgreSQL steht noch aus.

## 4. DB-Funktionstest

| Testfall | Ergebnis dieser Prüfung | Erwarteter manueller Nachweis |
| --- | --- | --- |
| Start mit leerer DB | Nicht ausführbar | Leere PostgreSQL-DB starten und Metamodel-Count vor Migration prüfen. |
| Migration | Schema/Migrationsdatei konsistent; Deploy nicht ausführbar | `npm run db:migrate --workspace backend`; anschließend Tabellen und `_prisma_migrations` prüfen. |
| Seed | Code vorhanden; nicht gegen DB ausgeführt | `npm run db:seed --workspace backend`; Counts für Types, Rules und Diagramme prüfen; zweiten Lauf auf „skipped“ prüfen. |
| Sidebar-Daten lesen | Erfolgreich gegen laufenden Stack: 8 ComponentTypes, 15 ConnectionRules, 3 Diagramme. | `GET /api/sidebar/` liefert DB-Daten. |
| Diagramm laden | Erfolgreich gegen laufenden Stack; Aggregate-Endpunkt liefert Komponenten und Connections. | Zusätzlicher Test mit mehreren Connections bleibt sinnvoll. |
| ComponentInstance löschen | State-Test und SQL-Cascade vorhanden | Komponente mit zwei Connections löschen; anschließend DB/API auf beide Connections prüfen. |
| ConnectionInstances prüfen | Constraints statisch validiert | Direkten Insert mit ungültigem Source-/Target-ID ablehnen lassen. |
| Metamodel Export | Unit-Test erfolgreich | Export vor/nach DB-Neustart vergleichen. |
| Metamodel Import | Validierungs-/Roundtrip-Test erfolgreich | Gültigen Import durchführen; ungültige Referenz und Orphan-Fall müssen HTTP 400 liefern. |

## 5. Prüfung Issue #19 – Docker

| Kriterium | Status | Nachweis | Restgrenze |
| --- | --- | --- | --- |
| 1. Backend containerisiert | Umgesetzt | Multi-Stage-Image läuft; Migration/Seed/Express-Healthcheck erfolgreich. | Produktionshosting separat offen. |
| 2. Frontend containerisiert | Umgesetzt | Nginx-Frontend-Container läuft und antwortet lokal mit HTTP 200. | HTTPS wird erst am Server-Proxy terminiert. |
| 3. Datenbank containerisiert | Umgesetzt, statisch validiert | Service `postgres` mit `postgres:16-alpine`. | Container nicht gestartet. |
| 4. Start mit `docker compose up --build` | Lokal verifiziert | Benutzerseitig mit `docker.exe compose up --build` gestartet; drei Services laufen, Frontend/Backend/PostgreSQL sind erreichbar. Zusätzlich bestehen nun 108 statische Checks. | Staging und Produktion wurden bewusst noch nicht gestartet. |
| 5. `.env.example` existiert | Erfüllt | Enthält PostgreSQL, Ports, CORS, Vite-API, Dev-Proxy, Nginx-Upstream, Seed und lokale `DATABASE_URL`. | Beispielpasswort muss lokal/produktiv ersetzt werden. |
| 6. Keine Secrets hardcoded | Erfüllt für Repository-Stand | Compose injiziert DB-Werte aus Env; `.env.example` nutzt deutliches lokales Platzhalterpasswort; `.env` ist ignoriert. | Secret-Management für Deployment ist nicht Teil des MVP. |
| 7. Start dokumentiert | Erfüllt | README und `docs/DOCKER_SETUP.md` enthalten PowerShell-/Shell-Start und statische Alternative. | Docker-Installation/CLI-Reparatur bleibt benutzerspezifisch. |
| 8. PostgreSQL-Daten persistent | Konfiguriert, nicht live verifiziert | Named Volume `postgres_data` ist deklariert und nach `/var/lib/postgresql/data` gemountet. | Neustart-/Persistenztest steht aus. |

## 6. Docker-Funktionstest

| Testfall | Ergebnis dieser Prüfung |
| --- | --- |
| Compose-Konfiguration | Offizielles `docker.exe compose config --quiet` und repository-eigene statische Prüfung erfolgreich. |
| `docker compose up --build` | Benutzerseitig als `docker.exe compose up --build` ausgeführt; laufende Services in dieser Prüfung bestätigt. |
| Frontend erreichbar | Lokal HTTP 200 auf Port 5173. |
| Backend erreichbar | Lokal HTTP 200 auf `/api/health`; Sidebar, Diagramm-Aggregat und Metamodel-Export read-only geprüft. |
| PostgreSQL erreichbar | Container meldet über `pg_isready` „accepting connections“. |
| Persistenz nach Neustart | Nicht verifiziert; Volume nur statisch geprüft. |

Zusätzliche statische Prüfung:

```powershell
npm run validate:compose
```

Windows-Hinweis: Auf diesem Rechner muss `docker.exe compose ...` statt `docker compose ...` verwendet werden. Auf Linux ist normalerweise `docker compose ...` korrekt.

## 7. Gefundene Probleme und Reparaturen

| Problem | Schwere | Behoben | Empfehlung |
| --- | --- | --- | --- |
| `STORAGE_BACKEND=database` fiel ohne `DATABASE_URL` still auf JSON zurück | Mittel | Ja | Fail-fast-Verhalten beibehalten und durch Test schützen. |
| Nginx-Backend-Upstream war als fester Compose-Wert gesetzt und fehlte in `.env.example` | Niedrig | Ja | `BACKEND_UPSTREAM` weiterhin über Env setzen. |
| Windows-Aufruf ohne `.exe` funktionierte nicht zuverlässig | Niedrig | Ja, dokumentiert | Auf diesem Rechner konsequent `docker.exe compose ...` verwenden. |
| Kein isolierter destruktiver PostgreSQL-Integrationstest | Mittel | Nein | Eigene Test-DB beziehungsweise Staging für Write/FK/Cascade/Import verwenden; laufende lokale Daten nicht für destruktive Tests nutzen. |
| Kein echter Prisma-Integrationstest im automatischen Testlauf | Mittel | Nein, würde Infrastruktur erweitern | Als nächsten kleinen Schritt optionalen Test gegen `TEST_DATABASE_URL` ergänzen. |
| Prisma warnt vor `package.json#prisma`, das in Prisma 7 entfällt | Niedrig | Nein | Vor Prisma-7-Upgrade auf `prisma.config.ts` migrieren; jetzt kein riskantes Upgrade. |
| npm meldet 12 Dependency-Advisories, darunter 2 critical | Hoch | Nein, außerhalb dieser fokussierten Prüfung | Separates `npm audit`-Triage durchführen; keine unkontrollierte `--force`-Aktualisierung. |
| Repository synchronisiert den vollständigen aktiven State | Niedrig/MVP | Nein | Später granulare Repositories/optimistische Sperren; kein Rewrite in dieser Prüfung. |

## 8. Offene Punkte

Menschlich beziehungsweise in geeigneter Infrastruktur zu prüfen:

1. PostgreSQL-Migration und idempotenten Seed gegen eine leere DB ausführen.
2. CRUD, FK-Verletzung und echte DB-Cascade testen.
3. `docker compose up --build` auf einer funktionierenden CLI ausführen und alle Healthchecks abwarten.
4. Frontend, Backend und PostgreSQL-Erreichbarkeit sowie Volume-Persistenz nach Neustart prüfen.
5. Metamodel-Export/-Import per HTTP gegen die DB vergleichen.

MVP-Grenzen:

- `/api/model` bleibt JSON-basiert.
- Eine Instanz gehört im DB-MVP höchstens zu einem Diagramm; `diagramId` bleibt während der Editor-Zwischenphase nullable.
- Kein Auth, CI/CD, Serverdeployment oder Mehrbenutzer-Konfliktmanagement.
- Der Aggregate-Endpunkt nutzt die kompatible Gesamt-State-Abstraktion.

Nächster kleiner Schritt: Ein optionaler, automatisch überspringbarer Prisma-Integrationstest gegen `TEST_DATABASE_URL`, der Migration, Seed, Diagram-Aggregat und Cascade in einer isolierten Test-DB nachweist. Danach erst sollte #17 als vollständig funktional abgenommen werden; #19 benötigt zusätzlich einen echten Compose-Start.
