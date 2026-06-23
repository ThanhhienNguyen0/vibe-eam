# Deployment Helpers

Dieser Ordner enthält absichtlich nur Beispiele und keine automatisch ausführenden Deployment-Skripte. Serverpfad, Benutzer, Backup-Ziel und Freigabeprozess sind noch nicht festgelegt; ein Skript mit `git pull` und anschließendem Neustart wäre deshalb derzeit zu riskant.

Enthalten:

- `nginx/eam.prod.conf.example` für `eam.messers-cardio-club.de`
- `nginx/eam.staging.conf.example` für `eam-test.messers-cardio-club.de`
- `nginx/eam.prod.http-only.conf.example` als sichere Erstkonfiguration vor Certbot
- `nginx/eam.staging.http-only.conf.example` als sichere Erstkonfiguration vor Certbot

Die Beispiele erwarten folgende ausschließlich lokal gebundene Ports:

| Umgebung | Frontend | Backend |
| --- | ---: | ---: |
| Produktion | `127.0.0.1:8080` | `127.0.0.1:4401` |
| Staging | `127.0.0.1:8081` | `127.0.0.1:4400` |

Manueller Ablauf auf Linux:

```bash
git pull --ff-only
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build
```

Vor jedem Update sollte mindestens ein PostgreSQL-Dump außerhalb des Docker-Volumes erstellt werden. Echte `.env.prod`-/`.env.staging`-Dateien, Dumps und Zertifikatsschlüssel gehören nicht ins Repository.

Solange Issue #18 nicht umgesetzt ist, dürfen keine sensiblen Daten ungeschützt öffentlich erreichbar sein. Die vollständigen HTTPS-Beispiele enthalten kommentierte Nginx-Basic-Auth-Direktiven als Übergangsschutz; Benutzerdatei und Passwort werden ausschließlich auf dem Server erzeugt.
