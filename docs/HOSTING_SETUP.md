# Hosting Setup

Diese Anleitung bereitet Issue #21 als manuelles Serverdeployment vor. Sie verändert weder DNS noch den bestehenden Server. Wegen des fehlenden Anwendungs-Auths dürfen keine sensiblen Daten ungeschützt öffentlich betrieben werden.

## 1. Voraussetzungen auf dem Server prüfen

Auf dem Linux-Server anmelden und Versionen, Firewall und Speicher prüfen:

```bash
docker --version
docker compose version
git --version
nginx -v
certbot --version
sudo ufw status
df -h
```

Falls UFW nicht verwendet wird, stattdessen die aktive Host-/Provider-Firewall prüfen. Erforderlich sind eingehend TCP 80 und 443. PostgreSQL-Port 5432 darf nicht öffentlich geöffnet werden. Docker Engine, Compose Plugin, Git, Nginx und Certbot inklusive Nginx-Plugin müssen installiert sein.

Abbruchkriterium: Nicht fortfahren, wenn die Hauptdomain-Konfiguration nicht gesichert ist, 80/443 bereits unbekannt belegt sind oder zu wenig Speicher für Images, PostgreSQL und Backups vorhanden ist.

## 2. DNS prüfen

Folgende Records müssen auf die Server-IP zeigen, ohne die Hauptdomain `messers-cardio-club.com` zu verändern:

- Produktion: `eam.messers-cardio-club.com`
- Staging: `eam-test.messers-cardio-club.com`

```bash
dig +short eam.messers-cardio-club.com
dig +short eam-test.messers-cardio-club.com
```

Falls `dig` fehlt:

```bash
nslookup eam.messers-cardio-club.com
nslookup eam-test.messers-cardio-club.com
```

Vor Certbot müssen beide Ergebnisse auf die beabsichtigte Server-IP zeigen. Es wird keine IP im Repository hinterlegt.

## 3. Repository vorbereiten

Beispielpfad und Repository-URL serverseitig anpassen:

```bash
sudo git clone <repo-url> /opt/eam-tool
sudo chown -R "$USER":"$USER" /opt/eam-tool
cd /opt/eam-tool
cp .env.staging.example .env.staging
cp .env.prod.example .env.prod
chmod 600 .env.staging .env.prod
```

`git status --short` darf `.env.staging` und `.env.prod` nicht anzeigen. Beide Dateien sind in `.gitignore` geschützt.

## 4. Secrets setzen

In beiden echten Env-Dateien:

1. `POSTGRES_PASSWORD` durch ein starkes, eindeutiges Passwort ersetzen.
2. Dasselbe zugrunde liegende Passwort in `DATABASE_URL` eintragen. Reservierte URL-Zeichen müssen dort percent-encoded werden.
3. Für Staging und Produktion unterschiedliche Passwörter verwenden.
4. Prüfen, dass `DATABASE_URL` als Host `postgres` enthält, niemals `localhost`.
5. Alle `replace-with-...`-Platzhalter entfernen.

Sicherheitsregeln:

- Keine Env-Datei committen oder in Tickets/Chat kopieren.
- Keine Passwörter in Shell-History, Nginx-Dateien oder Deployment-Skripte schreiben.
- Leserechte auf den Deployment-Benutzer begrenzen (`chmod 600`).
- Server-Backups der Env-Dateien verschlüsseln beziehungsweise in einem Secret-Manager ablegen.

## 5. Staging konfigurieren und starten

Immer `--env-file` verwenden; `-f` allein würde die lokale `.env` laden.

```bash
cd /opt/eam-tool
docker compose --env-file .env.staging -f docker-compose.staging.yml config
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
docker compose --env-file .env.staging -f docker-compose.staging.yml logs -f --tail=100
```

Die Logansicht mit `Ctrl+C` verlassen; Container laufen weiter. Erwartet werden Projekt `eam-staging`, DB `eam_staging`, Volume `eam_staging_postgres_data`, Frontend `127.0.0.1:8081` und Backend `127.0.0.1:4400`.

## 6. Staging lokal auf dem Server prüfen

```bash
curl -I http://127.0.0.1:8081
curl http://127.0.0.1:4400/api/health
curl http://127.0.0.1:4400/api/sidebar/
```

Erwartet:

- Frontend liefert HTTP 200.
- Healthcheck liefert `{"status":"ok"}`.
- Sidebar liefert JSON mit Metamodel, ComponentTypes und ConnectionRules.

Bei Fehlern zuerst `ps` und Backend-/Postgres-Logs prüfen. Nicht mit Produktion fortfahren.

## 7. Nginx für Staging einrichten

Die vollständige HTTPS-Datei referenziert Zertifikate, die beim ersten Start noch nicht existieren. Deshalb zuerst die HTTP-only-Datei aktivieren:

```bash
sudo cp deploy/nginx/eam.staging.http-only.conf.example /etc/nginx/sites-available/eam.staging.conf
sudo ln -sfn /etc/nginx/sites-available/eam.staging.conf /etc/nginx/sites-enabled/eam.staging.conf
sudo nginx -t
sudo systemctl reload nginx
```

Kontrollieren:

- `server_name eam-test.messers-cardio-club.com`
- `/` → `127.0.0.1:8081`
- `/api/` → `127.0.0.1:4400`
- keine Server-Block-Änderung für `messers-cardio-club.com`

Vor Certbot muss `http://eam-test.messers-cardio-club.com` erreichbar sein.

## 8. HTTPS für Staging

```bash
sudo certbot --nginx -d eam-test.messers-cardio-club.com
sudo certbot renew --dry-run
```

Nach erfolgreicher Ausstellung die Certbot-Konfiguration sichern, mit `deploy/nginx/eam.staging.conf.example` abgleichen und die dortigen Proxy-Ziele/Header übernehmen. Die Standardpfade müssen auf `/etc/letsencrypt/live/eam-test.messers-cardio-club.com/` zeigen.

Danach:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I https://eam-test.messers-cardio-club.com
curl https://eam-test.messers-cardio-club.com/api/health
```

## 9. Sicherheitsentscheidung wegen fehlendem Auth

Issue #18 ist noch nicht umgesetzt. Die Anwendung darf deshalb nicht mit sensiblen Daten frei öffentlich betrieben werden. Vor Staging-/Produktionsfreigabe genau eine Option dokumentiert auswählen:

### Option 1: Live-Demo ohne sensible Daten

Nur künstliche Demo-/Seed-Daten verwenden. Trotzdem HTTPS, Updates und Backups betreiben. Dies ist keine Zugriffskontrolle.

### Option 2: Nginx Basic Auth vor die gesamte Subdomain

```bash
sudo apt update
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd-eam demo
sudo chown root:www-data /etc/nginx/.htpasswd-eam
sudo chmod 640 /etc/nginx/.htpasswd-eam
```

Im jeweiligen HTTPS-`server`-Block aktivieren:

```nginx
auth_basic "EAM Demo";
auth_basic_user_file /etc/nginx/.htpasswd-eam;
```

Danach immer:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Das Passwort wird interaktiv erzeugt und niemals committed. Basic Auth ist nur eine Übergangssicherung und ersetzt keine rollenbasierte Anwendungsauthentifizierung. Die ACME-Challenge auf Port 80 bleibt ungeschützt, damit Zertifikatserneuerungen funktionieren.

### Option 3: Live-Schaltung verschieben

DNS/Nginx vorbereiten, aber die öffentliche Freigabe erst nach Implementierung und Prüfung von Issue #18 durchführen. Dies ist für echte oder sensible EAM-Daten die bevorzugte Option.

## 10. Staging-Abnahme

Vor Produktion mindestens prüfen:

- HTTPS und gewählte Zugriffsschutzoption
- Metamodel Export und Import
- ConnectionRule-basierte Validierung
- Diagramm einschließlich Positionen
- ComponentInstance-Löschung und ConnectionInstance-Cascade
- Neustart und Volume-Persistenz
- Backup und testweiser Restore

Ergebnisse in `docs/HOSTING_ACCEPTANCE_CHECK.md` eintragen. Produktion bleibt blockiert, solange Pflichtpunkte offen sind.

## 11. Produktion erst nach Staging-Abnahme

```bash
cd /opt/eam-tool
docker compose --env-file .env.prod -f docker-compose.prod.yml config
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f --tail=100
```

Serverlokal prüfen:

```bash
curl -I http://127.0.0.1:8080
curl http://127.0.0.1:4401/api/health
curl http://127.0.0.1:4401/api/sidebar/
```

Erwartet werden Projekt `eam-prod`, DB `eam_prod`, Volume `eam_prod_postgres_data`, Frontend `127.0.0.1:8080` und Backend `127.0.0.1:4401`.

## 12. Nginx und HTTPS für Produktion

Zuerst HTTP-only aktivieren:

```bash
sudo cp deploy/nginx/eam.prod.http-only.conf.example /etc/nginx/sites-available/eam.prod.conf
sudo ln -sfn /etc/nginx/sites-available/eam.prod.conf /etc/nginx/sites-enabled/eam.prod.conf
sudo nginx -t
sudo systemctl reload nginx
```

Kontrollieren:

- `server_name eam.messers-cardio-club.com`
- `/` → `127.0.0.1:8080`
- `/api/` → `127.0.0.1:4401`
- Hauptdomain bleibt unberührt

HTTPS ausstellen und prüfen:

```bash
sudo certbot --nginx -d eam.messers-cardio-club.com
sudo certbot renew --dry-run
sudo nginx -t
sudo systemctl reload nginx
curl -I https://eam.messers-cardio-club.com
curl https://eam.messers-cardio-club.com/api/health
```

Anschließend vollständiges Beispiel, Certbot-Ergebnis und ausgewählte Basic-Auth-Option zusammenführen. Zertifikatspfade müssen auf `/etc/letsencrypt/live/eam.messers-cardio-club.com/` zeigen.

## 13. Betrieb

Im Folgenden `<env>` und `<compose>` durch Produktion oder Staging ersetzen.

Logs:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f --tail=100
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend
```

Restart und Stop ohne Datenlöschung:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml restart
docker compose --env-file .env.prod -f docker-compose.prod.yml stop
docker compose --env-file .env.prod -f docker-compose.prod.yml start
```

`docker compose down` entfernt Container/Netzwerk, aber nicht das benannte Volume. `down -v` darf in Staging/Produktion nicht verwendet werden, weil es Daten löscht.

Manuelles Update:

```bash
cd /opt/eam-tool
git fetch --all --prune
git status --short
git checkout <freigegebener-commit-oder-tag>
docker compose --env-file .env.prod -f docker-compose.prod.yml config
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Vor dem Update ein Backup erstellen.

Backup außerhalb des Volumes:

```bash
mkdir -p /secure/backup/path
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > /secure/backup/path/eam_prod_YYYYMMDD.sql
chmod 600 /secure/backup/path/eam_prod_YYYYMMDD.sql
```

Restore nur nach Freigabe und vorzugsweise zuerst in Staging testen:

```bash
cat /secure/backup/path/eam_prod_YYYYMMDD.sql | \
  docker compose --env-file .env.staging -f docker-compose.staging.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Rollback-Hinweis:

1. Backup erstellen beziehungsweise passendes Backup identifizieren.
2. Vorherigen freigegebenen Commit/Tag auschecken.
3. Images neu bauen und Compose starten.
4. Prisma-Migrationen sind vorwärtsgerichtet. Bei inkompatiblen Schemaänderungen reicht ein Code-Rollback nicht; dann ist ein getesteter DB-Restore nötig.

## 14. Deployment über GitHub Actions

Nach Einrichtung der in `GITHUB_SECRETS.md` beschriebenen Secrets stehen zwei ausschließlich manuelle Workflows bereit:

- `Deploy staging`: Ref auswählen; der Workflow prüft Typecheck, Tests, Build und Compose, deployt danach exakt den geprüften Commit nach `/var/www/eam-test` und prüft `127.0.0.1:4400/api/health`.
- `Deploy production`: freigegebenen Ref eingeben, `DEPLOY_PRODUCTION` wählen sowie Backup und `HOSTING_ACCEPTANCE_CHECK.md` bestätigen. Danach wird exakt der geprüfte Commit nach `/var/www/eam` deployt und `127.0.0.1:4401/api/health` geprüft.

Beide serverseitigen Env-Dateien bleiben unverändert. Die Workflows erzeugen, überschreiben oder loggen sie nicht. Sie verwenden bewusst interne Healthchecks, damit Deployment-Erfolg unabhängig von DNS, TLS und Reverse Proxy geprüft wird.

Vor Aktivierung:

1. GitHub Environments `staging` und `production` anlegen.
2. Für `production` Required Reviewers konfigurieren.
3. SSH-Key und Host-Key gemäß `GITHUB_SECRETS.md` einrichten.
4. Sicherstellen, dass `git fetch` im Server-Checkout nicht-interaktiv funktioniert. Bei privaten Repositories benötigt der Server einen eigenen read-only Git-Deploy-Key; dieser ist vom GitHub-Actions-SSH-Key zu trennen.
5. Ersten Workflowlauf mit Staging durchführen und in `HOSTING_ACCEPTANCE_CHECK.md` dokumentieren.

Der automatische CI-Workflow läuft dagegen bei jedem Push und Pull Request, führt aber kein Deployment aus.

## 15. Plattformhinweis

Auf Linux gilt normalerweise `docker compose ...`. Auf dem bestätigten Windows-System muss `docker.exe compose ...` verwendet werden. Keine der DNS-, Nginx-, Firewall- oder Certbot-Anweisungen dieses Dokuments lokal auf Windows ausführen.

## 16. Bewusste MVP-Grenzen

- kein CI/CD
- kein Anwendungs-Auth
- kein automatisches Backup
- kein Monitoring-/Alerting-Stack
- kein Zero-Downtime-Deployment
- kein automatisches Datenbank-Rollback
- keine Live-Änderung an DNS, Nginx oder Certbot in diesem Schritt
- kein automatisches Deployment bei Push; Staging und Produktion bleiben workflow_dispatch
