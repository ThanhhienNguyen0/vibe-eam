# Docker Setup

## Voraussetzungen

- Docker Engine beziehungsweise Docker Desktop
- Docker Compose v2

## Start

Konfiguration einmalig anlegen und das lokale Beispielpasswort bei Bedarf ändern:

```bash
cp .env.example .env
docker compose up --build
```

Unter PowerShell:

```powershell
Copy-Item .env.example .env
docker.exe compose up --build
```

Auf diesem Windows-System muss `docker.exe compose ...` verwendet werden. Auf Linux und auf Windows-Installationen mit korrekt registrierter Docker-CLI funktioniert üblicherweise `docker compose ...`.

Danach sind standardmäßig erreichbar:

- Frontend: `http://localhost:5173`
- Backend/Healthcheck: `http://localhost:4000/api/health`
- PostgreSQL: `localhost:5432`

PostgreSQL-Daten liegen im Named Volume `postgres_data` und bleiben bei normalem Stoppen oder Neuerstellen der Container erhalten.

## Getrennte Umgebungen

| Umgebung | Compose-Datei | Echte Env-Datei | Projekt | DB-Volume |
| --- | --- | --- | --- | --- |
| Lokal | `docker-compose.yml` | `.env` | Projektordner-Standard | `postgres_data` |
| Staging | `docker-compose.staging.yml` | `.env.staging` | `eam-staging` | `eam_staging_postgres_data` |
| Produktion | `docker-compose.prod.yml` | `.env.prod` | `eam-prod` | `eam_prod_postgres_data` |

Wichtig: `-f docker-compose.staging.yml` wählt **nicht** automatisch `.env.staging`, und `-f docker-compose.prod.yml` wählt **nicht** automatisch `.env.prod`. Ohne `--env-file` lädt Docker Compose weiterhin die lokale `.env`; dadurch erscheinen fälschlich `eam`, `localhost`, Port 4000 und Port 5173 in der gerenderten Serverkonfiguration. Für Staging und Produktion ist `--env-file` deshalb verpflichtend.

Staging unter Windows:

```powershell
Copy-Item .env.staging.example .env.staging
# Platzhalterpasswort in POSTGRES_PASSWORD und DATABASE_URL identisch ersetzen.
docker.exe compose --env-file .env.staging -f docker-compose.staging.yml up -d --build
```

Produktion unter Windows:

```powershell
Copy-Item .env.prod.example .env.prod
# Ein eigenes starkes Produktionspasswort in POSTGRES_PASSWORD und DATABASE_URL eintragen.
docker.exe compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Auf Linux dieselben Befehle mit `docker compose`. Staging und Produktion nutzen unterschiedliche DB-Namen, Benutzer, Volumes und Loopback-Ports. PostgreSQL wird in beiden Serverumgebungen nicht auf dem Host veröffentlicht.

## Datenbankbefehle außerhalb von Docker

Mit einer gesetzten `DATABASE_URL`:

```bash
npm run db:generate --workspace backend
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
```

Sichere Kopie des bestehenden Sidebar-JSON in eine leere DB:

```bash
npm run db:migrate-json --workspace backend
```

Der Seed ist idempotent und überspringt eine DB, die bereits ein Metamodel enthält. `SEED_EXAMPLES=false` legt nur das Default-Metamodel an. Die JSON-Migration verweigert eine nicht leere DB, solange `FORCE_JSON_MIGRATION=true` nicht bewusst gesetzt wurde. Die JSON-Datei wird nie gelöscht.

## Umgebungsvariablen

| Variable | Zweck |
| --- | --- |
| `DATABASE_URL` | Prisma-Verbindung zu PostgreSQL |
| `STORAGE_BACKEND` | `database` im Container; `json` nur als expliziter Fallback |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | lokale PostgreSQL-Konfiguration |
| `VITE_API_BASE_URL` | beim Frontend-Build verwendeter API-Basispfad |
| `VITE_BACKEND_PROXY_TARGET` | Backend-Ziel des lokalen Vite-Dev-Proxys |
| `BACKEND_UPSTREAM` | Nginx-Upstream im Frontend-Container |
| `CORS_ORIGIN` | erlaubte Browser-Origin(s), kommasepariert |
| `SEED_EXAMPLES` | Beispiel-Diagramme beim initialen Seed ein-/ausschalten |

## Compose-Konfiguration prüfen

Windows:

```powershell
docker.exe compose --env-file .env.example -f docker-compose.yml config
docker.exe compose --env-file .env.staging.example -f docker-compose.staging.yml config
docker.exe compose --env-file .env.prod.example -f docker-compose.prod.yml config
```

Die verkürzten Befehle `docker.exe compose -f docker-compose.staging.yml config` und `docker.exe compose -f docker-compose.prod.yml config` dürfen im Projektordner nicht zur Abnahme verwendet werden, weil dort die lokale `.env` liegt.

Zusätzliche Docker-unabhängige Repository-Prüfung:

```bash
npm run validate:compose
```

Sie prüft alle drei Compose-/Env-Paare, getrennte Projekte, Volumes und Ports sowie die Dockerfiles. Sie ersetzt keinen Containerstart.

## Manuelle Prüfung

1. `docker.exe compose up --build` ohne Fehler bis zu gesunden Diensten laufen lassen.
2. Frontend öffnen und ein Diagramm laden.
3. Komponente und Verbindung anlegen, Container neu starten und Persistenz prüfen.
4. Eine Komponente löschen und prüfen, dass ihre Verbindungen verschwinden.
5. Metamodel exportieren, wieder importieren und ConnectionRules validieren.
6. `docker.exe compose down` und erneut `docker.exe compose up`; Daten müssen erhalten bleiben.
7. Staging und Produktion getrennt starten und prüfen, dass DB-Namen und Volumes nicht übereinstimmen.

Bewusst nicht enthalten: Auth, CI/CD und Live-Deployment.

## Serverhosting

Die serverpraktische Reihenfolge für Staging, DNS, Nginx, Certbot, Basic Auth und Produktion steht in `HOSTING_SETUP.md`. Vor einer Serverfreigabe `HOSTING_READINESS_CHECKLIST.md` abarbeiten und Ergebnisse in `HOSTING_ACCEPTANCE_CHECK.md` dokumentieren.

Ohne Issue #18 dürfen öffentlich nur künstliche Demo-Daten verwendet werden. Alternativ die gesamte Subdomain vorübergehend mit Nginx Basic Auth schützen oder die Live-Schaltung verschieben.
