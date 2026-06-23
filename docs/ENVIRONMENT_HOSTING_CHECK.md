# Environment and Hosting Check

Prüfdatum: 22.06.2026

## 1. Kurzfazit

Issue #20 ist als Docker-Konfiguration umgesetzt: Lokal, Staging und Produktion sind klar getrennt. Alle drei Compose-Dateien werden von `docker.exe compose config` akzeptiert. Der bestehende lokale Stack läuft weiterhin mit PostgreSQL, Backend und Frontend. Staging und Produktion wurden nicht mit Beispielpasswörtern gestartet.

Eine Nachprüfung des gemeldeten Fehlers zeigte: Die Compose-YAML-Struktur war korrekt; die lokalen Werte entstanden durch Aufruf ohne `--env-file`. Docker Compose liest dann automatisch die lokale `.env`, auch wenn mit `-f` eine Staging- oder Produktionsdatei gewählt wurde. Die Dokumentation und Compose-Kommentare kennzeichnen `--env-file` nun als verpflichtend, und der Validator prüft zusätzlich URL-Credentials sowie die exklusive Volume-Zuordnung.

Issue #21 ist vorbereitet, aber nicht live umgesetzt: Subdomains, HTTP-only-Erstkonfiguration, Host-Nginx, HTTPS/Certbot, Basic-Auth-Übergangsschutz, manuelle Betriebsschritte sowie Readiness-/Abnahmechecklisten sind dokumentiert. DNS, Zertifikate und Server wurden nicht verändert. Wegen fehlendem Auth darf keine öffentliche Live-Schaltung mit sensiblen Daten erfolgen.

## 2. Compose-Dateien

| Datei | Umgebung | Compose-Projekt | Ergebnis |
| --- | --- | --- | --- |
| `docker-compose.yml` | Lokal | Standardname des Projektordners | `config --quiet` erfolgreich; laufender Stack bestätigt |
| `docker-compose.staging.yml` | Staging/Test | `eam-staging` | `config --quiet` erfolgreich |
| `docker-compose.prod.yml` | Produktion | `eam-prod` | `config --quiet` erfolgreich |

Alle verwenden dieselben produktionsnahen Backend-/Frontend-Dockerfiles. Es gibt keine Hot-Reload- oder Source-Code-Mounts in Staging/Produktion.

## 3. Env-Beispieldateien

| Datei | Echte Zieldatei | Inhalt |
| --- | --- | --- |
| `.env.example` | `.env` | lokale DB, Ports, CORS, Vite-/Nginx-Ziele |
| `.env.staging.example` | `.env.staging` | eigene Staging-DB, Staging-Subdomain und Ports |
| `.env.prod.example` | `.env.prod` | eigene Produktions-DB, Produktionssubdomain und Ports |

Alle drei enthalten nur erkennbare Beispiel-/Platzhalterpasswörter. `.env`, `.env.staging`, `.env.prod` sowie ihre `.local`-Varianten sind in `.gitignore` geschützt. In den echten Dateien müssen `POSTGRES_PASSWORD` und Passwortanteil von `DATABASE_URL` jeweils übereinstimmen.

## 4. Getrennte Datenbanken und Volumes

| Umgebung | Datenbank | Benutzer | Volume |
| --- | --- | --- | --- |
| Lokal | `eam` | `eam` | `postgres_data` |
| Staging | `eam_staging` | `eam_staging` | `eam_staging_postgres_data` |
| Produktion | `eam_prod` | `eam_prod` | `eam_prod_postgres_data` |

Staging und Produktion haben außerdem eigene Compose-Netzwerke durch ihre unterschiedlichen Projektnamen. PostgreSQL besitzt dort kein Host-Port-Mapping. Damit kann Staging die Produktions-DB nicht über gemeinsam verwendete Compose-Ressourcen beeinflussen.

## 5. Geplante Ports

| Umgebung | Frontend | Backend | PostgreSQL |
| --- | --- | --- | --- |
| Lokal | `0.0.0.0:5173` | `0.0.0.0:4000` | `0.0.0.0:5432` |
| Staging | `127.0.0.1:8081` | `127.0.0.1:4400` | nur internes Compose-Netz |
| Produktion | `127.0.0.1:8080` | `127.0.0.1:4401` | nur internes Compose-Netz |

Die Serverports sind ausschließlich über Host-Nginx erreichbar. Staging und Produktion können aufgrund verschiedener Projekte, Ports und Volumes parallel laufen.

## 6. Subdomains und HTTPS

- Produktion: `eam.messers-cardio-club.com`
- Staging: `eam-test.messers-cardio-club.com`
- Hauptdomain `messers-cardio-club.com`: bleibt unverändert

Nginx-Beispiele liegen unter `deploy/nginx`. Port 80 ist für ACME und HTTPS-Redirect vorgesehen. Port 443 nutzt die Standardpfade von Let's Encrypt. `/api/` geht an den jeweiligen Backend-Loopback-Port, `/` an das Frontend. WebSockets sind aktuell nicht erforderlich.

Vor Certbot werden die `*.http-only.conf.example`-Dateien verwendet, weil die vollständigen HTTPS-Dateien noch nicht existierende Zertifikatspfade referenzieren. Die HTTPS-Beispiele enthalten kommentierte Basic-Auth-Hooks. Tatsächliche Ergebnisse werden in `HOSTING_ACCEPTANCE_CHECK.md` eingetragen; `HOSTING_READINESS_CHECKLIST.md` definiert die Go-/Stop-Kriterien.

## 7. Ausgeführte Befehle

| Befehl | Ergebnis |
| --- | --- |
| `docker.exe compose --env-file .env.example -f docker-compose.yml config --quiet` | Erfolgreich |
| `docker.exe compose --env-file .env.staging.example -f docker-compose.staging.yml config --quiet` | Erfolgreich |
| `docker.exe compose --env-file .env.prod.example -f docker-compose.prod.yml config --quiet` | Erfolgreich |
| `npm run validate:compose` | Erfolgreich, 108 zusätzliche statische Checks |
| `docker.exe compose ps --services --status running` | `backend`, `frontend`, `postgres` laufen lokal |
| Backend `GET /api/health` | HTTP 200, `{"status":"ok"}` |
| Frontend `GET /` | HTTP 200 |
| `docker.exe compose exec -T postgres pg_isready` | PostgreSQL akzeptiert Verbindungen |
| `GET /api/sidebar/` | 8 ComponentTypes, 15 ConnectionRules, 3 Diagramme aus laufendem DB-Stack |
| `GET /api/sidebar/diagrams/:id` | Aggregate-Endpunkt erfolgreich |
| `GET /api/sidebar/metamodel/export` | Metamodel `mm-sme-eam`, 15 ConnectionRules |
| Statische Prüfung aller vier Nginx-Beispiele | Erfolgreich: Subdomains, Frontend-/API-Upstreams, Redirect, TLS-Pfade und Proxy-Header korrekt; Hauptdomain nicht als `server_name` übernommen |

`docker.exe compose up --build` wurde für lokal bereits benutzerseitig ausgeführt. Staging-/Produktions-`up` wurden bewusst nicht mit Beispielpasswörtern gestartet und würden neue persistente Volumes anlegen; für diese Prüfung reicht die sichere `config`-Validierung.

Gerenderter Sollzustand mit expliziten Beispiel-Env-Dateien:

| Prüfung | Staging | Produktion |
| --- | --- | --- |
| Services | `postgres`, `backend`, `frontend` | `postgres`, `backend`, `frontend` |
| Projekt | `eam-staging` | `eam-prod` |
| DB/User | `eam_staging` / `eam_staging` | `eam_prod` / `eam_prod` |
| DATABASE_URL-Host | `postgres` | `postgres` |
| DB-Volume | nur PostgreSQL: `eam_staging_postgres_data` | nur PostgreSQL: `eam_prod_postgres_data` |
| Backend-Port | `127.0.0.1:4400:4000` | `127.0.0.1:4401:4000` |
| Frontend-Port | `127.0.0.1:8081:80` | `127.0.0.1:8080:80` |
| PostgreSQL-Host-Port | keiner | keiner |

## 8. Typecheck, Tests und Build

| Prüfung | Ergebnis |
| --- | --- |
| `npm run typecheck` | Erfolgreich |
| `npm test` | Erfolgreich: 44/44 Tests |
| `npm run build` | Erfolgreich: Backend und Vite-Frontend |
| `git diff --check` | Erfolgreich; keine Whitespace-Fehler |

ConnectionRule bleibt primäre Regelquelle. Metamodel JSON Export funktioniert im laufenden DB-Stack; Import-/Roundtrip-Validierung bleibt automatisiert getestet. Es wurden keine Auth-, CI/CD- oder Rewrite-Änderungen vorgenommen.

Hosting-Readiness ist jetzt über `HOSTING_READINESS_CHECKLIST.md` prüfbar. Die tatsächliche Serverabnahme bleibt bewusst unausgefüllt in `HOSTING_ACCEPTANCE_CHECK.md`, bis DNS, Nginx, Certbot, Backup/Restore und die gewählte Sicherheitsoption real geprüft wurden.

## 9. Offene Punkte vor echtem Serverdeployment

1. DNS-A-/AAAA-Records auf die tatsächliche Server-IP setzen.
2. Bestehende Nginx-Konfiguration und Hauptdomain vor Änderungen sichern.
3. Echte `.env.staging` und `.env.prod` mit unterschiedlichen starken Passwörtern serverseitig anlegen.
4. Staging starten und fachlich abnehmen, insbesondere Import/Export, ConnectionRules und Cascade Delete.
5. Certbot zuerst mit einer HTTP-fähigen Nginx-Konfiguration ausführen; danach HTTPS-Beispiele aktivieren und `nginx -t` prüfen.
6. Produktionsbackup und Restore testen, bevor echte Daten importiert werden.
7. Serverneustart, `restart: unless-stopped`, Zertifikatserneuerung und Volume-Persistenz prüfen.
8. Entscheidung treffen, ob die fehlende Auth vor öffentlicher Erreichbarkeit durch Netzwerkzugriffsschutz kompensiert wird oder die Live-Schaltung warten muss.
9. Monitoring, Log-Rotation und Speicherwarnungen organisatorisch festlegen.
10. `HOSTING_READINESS_CHECKLIST.md` vollständig abarbeiten und `HOSTING_ACCEPTANCE_CHECK.md` mit Datum, Prüfer und Ergebnis ausfüllen.

## 10. MVP-Grenzen

- Kein CI/CD; Deployment erfolgt manuell.
- Kein Auth-System.
- Kein automatisches Backup oder automatischer Restore-Test.
- Kein Zero-Downtime-Deployment.
- Kein automatisches Rollback von Prisma-Migrationen.
- Kein Monitoring-/Alerting-Stack.
- Kein Live-Deployment, keine DNS-Änderung und keine Zertifikatsanforderung in diesem Schritt.
- Keine automatische Deployment-Shell-Datei, da Serverpfad, Backup-Ziel und Freigabeprozess noch nicht feststehen.
