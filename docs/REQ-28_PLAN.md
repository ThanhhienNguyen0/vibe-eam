# REQ-28 – Persistenz vereinheitlichen (Issue #60)

**Entscheidung:** Option A – der JSON-Dateispeicher im Backend wird entfernt, PostgreSQL ist die einzige Persistenzschicht.
**Branch:** `req28_persistence_layer`
**ADR:** [docs/adr/0001-postgresql-only-persistence.md](adr/0001-postgresql-only-persistence.md)

## Wozu ist das gut?

Das Backend hatte zwei Speicherwege, die automatisch gewählt wurden:

- **PostgreSQL**, wenn `DATABASE_URL` gesetzt war
- **JSON-Dateien** (`backend/data/model.<companyId>.json`, `backend/src/data/sidebar.<companyId>.json`), wenn nicht – oder bei `STORAGE_BACKEND=json`

Jede Funktion, die Daten speichert, musste in beiden Wegen funktionieren. Für die kommenden Themen – Audit-Diffs, Versionierung, Rollen/RBAC (#88) – hieße das: alles doppelt bauen und doppelt testen. Jetzt gibt es nur noch einen Weg.

Der JSON-Weg war im Browser außerdem praktisch tot: Login und Registrierung laufen über `PrismaAuthRepository` und brauchen ohnehin PostgreSQL. Ohne Datenbank konnte sich niemand anmelden. Der Fallback kostete also Wartung, brachte aber keinen echten Nutzen.

## Vorher und nachher (dieser Branch)

### Verhalten

| Bereich | Vorher (`main`) | Nachher (dieser Branch) |
|---|---|---|
| Speicher für `/api/sidebar` | PostgreSQL **oder** `sidebar.<companyId>.json`, je nach Umgebung | Nur PostgreSQL |
| Speicher für `/api/model` | PostgreSQL (JSONB) **oder** `model.<companyId>.json` | Nur PostgreSQL (JSONB, siehe ADR) |
| Backend ohne `DATABASE_URL` | Startet, schreibt still in JSON-Dateien, Login scheitert trotzdem | Startet nicht, klare Fehlermeldung mit Lösungshinweis |
| `STORAGE_BACKEND` | `database` oder `json` | Entfernt. `database` wird ignoriert, `json` gibt Startfehler |
| `.env` beim lokalen Start | Musste man selbst in die Shell exportieren | Wird von allen Backend-Skripten automatisch geladen |
| `readLegacySidebarState` | Legte `sidebar.json` an, falls sie fehlte | Liest nur noch (schreibgeschützte Seed-Quelle) |
| `db:migrate-json` | Nur `sidebar.json`, nur in eine komplett leere DB | Alle alten Dateien pro Firma, überspringt Firmen mit Daten |
| `db:seed` im Docker-Start | Stürzte ab (BPMN-Demo verwies auf fehlenden Viewpoint), Backend „unhealthy“ | Läuft durch, Backend „healthy“ |
| API-Routen und -Formate | – | **Unverändert** |

### Befehle

| Befehl | Vorher | Nachher |
|---|---|---|
| `docker compose up --build` | Backend hing in Restart-Schleife (Seed-Fehler) | Läuft, Ablauf unverändert |
| `npm run dev` | Startete nur mit manuell gesetzten Variablen | Braucht laufende PostgreSQL, liest `.env` selbst |
| `npm run db:up` | – | **Neu:** startet nur PostgreSQL im Container |
| `npm run db:setup` | – | **Neu:** Migrationen + Seed in einem Schritt |
| `npm run db:migrate` / `db:seed` | Nur mit exportierter `DATABASE_URL` | Lesen `.env` selbst |
| `npm test` / `npm run check` / CI | Ohne Datenbank | **Unverändert**, ohne Datenbank |

### Dateien

| Datei | Änderung |
|---|---|
| `backend/src/store.ts` | JSON-Zweig entfernt, nur noch Prisma (`ArchitectureModel`) |
| `backend/src/Sidebar/sidebarStore.ts` | JSON-Zweige und `ensureFile` entfernt, `readLegacySidebarState` nur lesend |
| `backend/src/persistence/databaseSidebarRepository.ts` | `configuredStorageBackend`/`databasePersistenceEnabled` ersetzt durch `requireDatabaseConfiguration` |
| `backend/src/server.ts` | Prüft die DB-Konfiguration beim Start |
| `backend/src/persistence/jsonMigration.ts` | **Neu:** findet und prüft alte JSON-Dateien (ohne DB testbar) |
| `backend/prisma/migrate-json.ts` | Überträgt alle alten Dateien pro Firma |
| `backend/prisma/seed.ts` | Seed-Fix: Metamodell-JSON ergänzt die Beispieldaten, statt sie zu ersetzen |
| `backend/package.json`, `package.json` | `.env`-Laden, neue Skripte `db:up` und `db:setup` |
| `docker-compose*.yml`, `.env*.example` | `STORAGE_BACKEND` entfernt |
| `scripts/validate-compose.mjs` | Prüft jetzt, dass `STORAGE_BACKEND` **nicht** gesetzt ist |
| Tests | Konfigurationstest angepasst, neu: `jsonMigration.test.ts` |
| `README.md`, `docs/DEVELOPER_SETUP.md`, `docs/DOCKER_SETUP.md` | Startbefehle, Persistenz-Abschnitt, „Bekannte Grenzen“ |
| `docs/adr/0001-postgresql-only-persistence.md` | **Neu:** ADR |

## Akzeptanzkriterien

| Kriterium | Erfüllt durch |
|---|---|
| Entscheidung als ADR dokumentiert | `docs/adr/0001-postgresql-only-persistence.md` (Optionen A/B, Entscheidung, Folgen, JSONB-Teilentscheidung) |
| `/api/model` liest und schreibt PostgreSQL | `store.ts` hat keinen JSON-Zweig mehr |
| Migrationsskript überführt JSON-Daten verlustfrei | `db:migrate-json`: alle Dateien pro Firma, Audit-Log inklusive. Doppelte Quellen führen zum Abbruch statt zu stillem Datenverlust. Quelldateien bleiben unverändert. |
| API-Verträge kompatibel | Keine Route, kein Request- oder Response-Format geändert |
| README „Bekannte Grenzen“ aktualisiert | Ja, dazu der neue Abschnitt „Persistenz: nur PostgreSQL“ |

**Bewusst nicht Teil dieses Issues:** `/api/model` speichert weiter als JSONB-Spalte statt in eigenen Tabellen. Das ist PostgreSQL und erfüllt das Kriterium. Begründung, Nachteile und ein Vorschlag für ein Folge-Issue stehen im ADR.

## Lokal entwickeln

```bash
cp .env.example .env        # einmalig (PowerShell: Copy-Item .env.example .env)
npm run db:up               # nur PostgreSQL im Container
npm run db:setup            # Schema + Beispieldaten (erstes Mal / nach neuen Migrationen)
npm run dev                 # Backend + Frontend mit Hot Reload
```

## Wie es geprüft wurde

- `npm run check` (Lint, Typecheck, 73 Tests inklusive 4 neuer Migrationstests, Build, alle Validatoren) läuft grün.
- `db:migrate-json` gegen ein temporäres DB-Schema getestet: erster Lauf überträgt Model- und Sidebar-Dateien inklusive Audit-Log, zweiter Lauf überspringt alles.
- Backend-Start ohne `DATABASE_URL` und mit `STORAGE_BACKEND=json` getestet: klare Fehlermeldungen.
- `npm run dev:backend` mit automatisch geladener `.env`: Registrierung, `/api/model` und `/api/sidebar` funktionieren gegen PostgreSQL.
- `docker compose up --build`: Backend wird „healthy“.

## Risiken

- **Alte lokale JSON-Daten** werden nicht mehr gelesen. Wer dort Daten hat, führt einmal `db:migrate-json` aus.
- **Staging/Produktion:** Dort läuft schon PostgreSQL. `STORAGE_BACKEND=database` in den Server-`.env`-Dateien stört nicht und kann bei Gelegenheit entfernt werden.
- In Docker-Logs erscheint beim Start zweimal (bei Migration und Seed) der Hinweis `../.env not found. Continuing without it.` Das ist erwartet, dort kommen die Variablen aus Compose.
