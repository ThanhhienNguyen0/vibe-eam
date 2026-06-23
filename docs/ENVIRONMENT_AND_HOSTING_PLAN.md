# Environment and Hosting Plan

## Aktueller Docker-Stand

Der bestehende lokale Stack besteht aus PostgreSQL 16, dem Express-/Prisma-Backend und einem als statische Vite-App gebauten Nginx-Frontend. Das Backend führt beim Containerstart `prisma migrate deploy`, den idempotenten Seed und anschließend den Serverstart aus. PostgreSQL verwendet lokal das Named Volume `postgres_data`. Frontend und Backend werden über `.env` konfiguriert; `STORAGE_BACKEND=database` erzwingt PostgreSQL.

`docker-compose.yml` bleibt die lokale Konfiguration. Auf dem aktuellen Windows-System ist `docker.exe compose ...` der funktionierende Aufruf. Auf Linux-Servern ist normalerweise `docker compose ...` korrekt.

## Zielbild

| Umgebung | Compose-Projekt | Datenbank | Volume | Frontend | Backend | Zweck |
| --- | --- | --- | --- | --- | --- | --- |
| Lokal | Standardname des Projektordners | `eam` | `postgres_data` | `0.0.0.0:5173` | `0.0.0.0:4000` | Entwicklung und lokale Demo |
| Staging | `eam-staging` | `eam_staging` | `eam_staging_postgres_data` | `127.0.0.1:8081` | `127.0.0.1:4400` | Abnahme mit eigenen Testdaten |
| Produktion | `eam-prod` | `eam_prod` | `eam_prod_postgres_data` | `127.0.0.1:8080` | `127.0.0.1:4401` | Dauerbetrieb mit produktiven Daten |

Staging und Produktion sind durch Compose-Projekt, Datenbankname, Benutzer, Ports, Netzwerk und explizites Named Volume getrennt. PostgreSQL wird dort nicht auf einen Host-Port veröffentlicht. Nur der Host-Nginx erreicht die an Loopback gebundenen Frontend-/Backend-Ports.

Die Trennung gilt nur bei expliziter Auswahl der passenden Env-Datei. Docker Compose koppelt den Dateinamen hinter `-f` nicht automatisch an `.env.staging` oder `.env.prod`; ohne `--env-file` wird die lokale `.env` gelesen. Alle Serverbefehle verwenden deshalb zwingend `--env-file .env.staging` beziehungsweise `--env-file .env.prod`.

## Serverannahmen

- Linux-Server mit `sudo`-/Administrationszugriff und ausreichendem Speicherplatz.
- Docker Engine und Compose Plugin sind funktionsfähig.
- Git, Nginx und Certbot sind installiert.
- Die bestehende Hauptdomain `messers-cardio-club.com` und ihre Website bleiben unverändert.
- DNS-Verwaltung erlaubt neue A-/AAAA-Records.
- TCP 80 und 443 sind in Firewall und Provider-Firewall geöffnet.
- Port 5432 bleibt von außen geschlossen.

Es wird keine konkrete Server-IP, kein Serverpfad und kein Anbieter hardcodiert.

## Domain- und Subdomain-Konzept

- Produktion: `eam.messers-cardio-club.com`
- Staging: `eam-test.messers-cardio-club.com`

Beide Namen zeigen auf den bestehenden Server, erhalten aber eigene Nginx-Server-Blöcke und eigene Zertifikate. Die Hauptdomain wird weder umgeleitet noch überschrieben. `eam-staging.messers-cardio-club.com` bleibt eine mögliche Alternative, wird aber im Repository nicht parallel verwendet, um Konfigurationsdrift zu vermeiden.

## HTTPS-Konzept

Der Host-Nginx terminiert TLS. Port 80 dient ACME/Certbot und leitet danach auf HTTPS um. Certbot bezieht je Subdomain ein Let's-Encrypt-Zertifikat. Nginx leitet `/` an das jeweilige Frontend und `/api/` direkt an den jeweiligen Backend-Loopback-Port weiter. WebSockets sind aktuell nicht erforderlich und werden deshalb nicht unnötig konfiguriert.

Die Beispiele unter `deploy/nginx` verwenden die üblichen Let's-Encrypt-Pfade. Der HTTPS-Block darf erst aktiviert werden, nachdem Certbot die Zertifikate erstellt hat.

Für diesen Erstlauf existieren separate HTTP-only-Beispiele. Nach erfolgreichem Certbot-Lauf werden die vollständigen HTTPS-Beispiele aktiviert beziehungsweise mit der von Certbot erzeugten Konfiguration abgeglichen. Readiness und tatsächliche Abnahme werden getrennt in `HOSTING_READINESS_CHECKLIST.md` und `HOSTING_ACCEPTANCE_CHECK.md` dokumentiert.

## Betriebs- und Migrationsstrategie

1. Staging zuerst mit `.env.staging` und leerem Staging-Volume starten.
2. Migration und Seed automatisch beim Backend-Start ausführen lassen.
3. Metamodel-Import/-Export, ConnectionRules, Diagramm-Laden und Cascade Delete in Staging prüfen.
4. Produktions-`.env.prod` ausschließlich auf dem Server erstellen und sichern.
5. Vor Updates einen PostgreSQL-Dump außerhalb des Volumes erstellen.
6. Produktion manuell aus einem freigegebenen Git-Commit bauen und starten.

## Risiken und MVP-Grenzen

- Kein Auth: Ein öffentlich erreichbares Produktivsystem wäre ohne zusätzliche Zugriffsbeschränkung für sensible Daten ungeeignet. Issue #21 wird hier nur vorbereitet, nicht live geschaltet.
- Bis Issue #18 stehen nur drei vertretbare Übergänge offen: reine Demo-Daten, Nginx Basic Auth für die gesamte Subdomain oder Verschiebung der Live-Schaltung.
- Kein CI/CD: Deployment, Tests und Rollback bleiben manuell.
- Kein automatisches Backup: Das Volume ist persistent, aber kein Backup. `pg_dump` muss organisatorisch eingeplant werden.
- Kein Zero-Downtime-Deployment: `compose up -d --build` kann kurze Unterbrechungen verursachen.
- Keine automatische Secret-Verwaltung: `.env.prod` und `.env.staging` liegen nur auf dem Server und dürfen nicht committed werden.
- Keine Mehrbenutzer-/Konfliktlogik und kein Rate Limiting.
- Die bestehende Hauptdomain und bestehende Nginx-Konfiguration müssen vor Aktivierung manuell gesichert und zusammengeführt werden.
