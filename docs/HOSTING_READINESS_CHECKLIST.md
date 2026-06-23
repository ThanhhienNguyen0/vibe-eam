# Hosting Readiness Checklist

Diese Checkliste trennt lokale Entwicklungsbereitschaft, Server-Staging und Server-Produktion. Ein Häkchen darf erst gesetzt werden, wenn der Punkt tatsächlich geprüft wurde. Details und Befehle stehen in `HOSTING_SETUP.md`.

## A. Lokal – Entwicklungsstand

- [ ] `npm run typecheck` erfolgreich
- [ ] `npm test` erfolgreich
- [ ] `npm run build` erfolgreich
- [ ] `docker.exe compose --env-file .env.staging.example -f docker-compose.staging.yml config` erfolgreich
- [ ] `docker.exe compose --env-file .env.prod.example -f docker-compose.prod.yml config` erfolgreich
- [ ] Staging-Compose enthält nur `postgres`, `backend`, `frontend`
- [ ] Produktions-Compose enthält nur `postgres`, `backend`, `frontend`
- [ ] Staging und Produktion haben getrennte DB-Namen, Benutzer, Ports und Volumes
- [ ] Beide DATABASE_URLs verwenden Host `postgres`
- [ ] `.env.staging` und `.env.prod` werden von Git ignoriert
- [ ] Nginx-Beispiele nennen ausschließlich die EAM-Subdomains, nicht die Hauptdomain als `server_name`
- [ ] `npm run validate:workflows` erfolgreich
- [ ] CI-Workflow läuft bei Push und Pull Request ohne Deployment

Lokales Go-Kriterium: Alle Punkte erfüllt. Das bestätigt nur Repository-Readiness, kein Live-Hosting.

## B. Server – gemeinsame Voraussetzungen

- [ ] Docker Engine und Compose Plugin verfügbar
- [ ] Git, Nginx, Certbot und Certbot-Nginx-Plugin verfügbar
- [ ] Firewall/Provider-Firewall geprüft; TCP 80/443 offen
- [ ] PostgreSQL-Port 5432 nicht öffentlich geöffnet
- [ ] Ausreichender Speicherplatz mit `df -h` bestätigt
- [ ] Bestehende Nginx-Konfiguration und Hauptdomain gesichert
- [ ] A-/AAAA-Records für beide EAM-Subdomains zeigen auf den Server
- [ ] Repository unter dem freigegebenen Serverpfad geklont
- [ ] Echte Env-Dateien mit Modus 600 angelegt
- [ ] Keine Platzhaltersecrets mehr vorhanden
- [ ] Staging-/Produktionspasswörter sind verschieden
- [ ] `POSTGRES_PASSWORD` und DATABASE_URL-Passwort stimmen je Umgebung überein
- [ ] Backup-Ziel außerhalb der Docker-Volumes festgelegt
- [ ] GitHub Environments `staging` und `production` angelegt
- [ ] Deployment-SSH-Key und verifizierter Known-Hosts-Eintrag als Secrets hinterlegt
- [ ] Server-Checkouts können `git fetch` nicht-interaktiv ausführen

Gemeinsames Stop-Kriterium: Bei einem offenen Punkt weder Certbot noch Produktion starten.

## C. Server – Staging

- [ ] Staging-`config` mit `.env.staging` erfolgreich
- [ ] Projektname ist `eam-staging`
- [ ] DB/Volume sind `eam_staging` / `eam_staging_postgres_data`
- [ ] PostgreSQL, Backend und Frontend sind healthy/running
- [ ] `curl -I http://127.0.0.1:8081` erfolgreich
- [ ] `curl http://127.0.0.1:4400/api/health` erfolgreich
- [ ] Sidebar-API liefert DB-Daten
- [ ] HTTP-only-Nginx-Konfiguration aktiviert und `nginx -t` erfolgreich
- [ ] Hauptdomain-Konfiguration unverändert
- [ ] Staging-Zertifikat mit Certbot ausgestellt
- [ ] HTTP leitet auf HTTPS um
- [ ] Staging-HTTPS-Frontend und `/api/health` erreichbar
- [ ] Zugriffsschutzoption dokumentiert: Demo-Daten, Basic Auth oder keine Live-Freigabe
- [ ] Metamodel Export/Import geprüft
- [ ] ConnectionRule-Validierung geprüft
- [ ] Diagramm/Positionen geprüft
- [ ] Cascade Delete geprüft
- [ ] Neustart/Volume-Persistenz geprüft
- [ ] Backup und Restore in Staging geprüft
- [ ] `HOSTING_ACCEPTANCE_CHECK.md` für Staging ausgefüllt
- [ ] Manueller Staging-Workflow deployt exakt den im Verify-Job geprüften SHA

Staging-Go-Kriterium: Alle fachlichen, technischen und Sicherheitsprüfungen erfüllt. Erst dann Produktion beginnen.

## D. Server – Produktion

- [ ] Formale Staging-Abnahme liegt vor
- [ ] Freigegebener Commit oder Tag dokumentiert
- [ ] Produktions-`config` mit `.env.prod` erfolgreich
- [ ] Projektname ist `eam-prod`
- [ ] DB/Volume sind `eam_prod` / `eam_prod_postgres_data`
- [ ] PostgreSQL, Backend und Frontend sind healthy/running
- [ ] `curl -I http://127.0.0.1:8080` erfolgreich
- [ ] `curl http://127.0.0.1:4401/api/health` erfolgreich
- [ ] HTTP-only-Nginx-Konfiguration aktiviert und `nginx -t` erfolgreich
- [ ] Hauptdomain-Konfiguration unverändert
- [ ] Produktionszertifikat mit Certbot ausgestellt
- [ ] HTTP leitet auf HTTPS um
- [ ] Produktions-HTTPS-Frontend und `/api/health` erreichbar
- [ ] Keine sensiblen Daten ohne Auth/Basic Auth öffentlich erreichbar
- [ ] Produktionsbackup erstellt und Restore-Verfahren dokumentiert
- [ ] Serverneustart und `restart: unless-stopped` geprüft
- [ ] Certbot-Erneuerung mit `renew --dry-run` geprüft
- [ ] Logs, Verantwortliche und manueller Rollback-Prozess dokumentiert
- [ ] `HOSTING_ACCEPTANCE_CHECK.md` vollständig ausgefüllt
- [ ] Produktionsworkflow wurde mit Backup-/Abnahmebestätigung und Required Reviewer freigegeben

Produktions-Go-Kriterium: Alle Punkte erfüllt und Sicherheitsoption ausdrücklich freigegeben. Wegen fehlendem Anwendungs-Auth ist für sensible Daten „Live-Schaltung verschieben“ die Standardentscheidung.
