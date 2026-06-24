# CI/CD Plan

## Ziel

Die Pipeline trennt automatische Qualitätsprüfung von bewusster Auslieferung:

- CI läuft bei jedem Push und Pull Request.
- Staging wird ausschließlich manuell über `workflow_dispatch` ausgelöst.
- Produktion wird ausschließlich manuell ausgelöst und benötigt zusätzliche Bestätigungen für Produktion, Backup und Hosting-Abnahme.
- Kein Deployment startet, bevor der ausgewählte Commit Typecheck, Tests und Build bestanden hat.

Es werden keine `.env`-Dateien, Datenbankpasswörter oder Basic-Auth-Zugangsdaten an GitHub übertragen. Die echten Env-Dateien bleiben unter `/var/www/eam-test/.env.staging` und `/var/www/eam/.env.prod` auf dem Server.

## Branch- und Revisionskonzept

- `main` ist der integrierte, grundsätzlich deploybare Branch.
- Änderungen entstehen auf Feature-Branches und werden über Pull Requests mit erfolgreicher CI integriert.
- Der manuelle Staging-Workflow akzeptiert Branch, Tag oder Commit; Standard ist `main`.
- Der Produktionsworkflow verlangt bewusst einen freigegebenen Tag oder Commit; `main` ist technisch möglich, aber nicht der empfohlene Freigabeweg.
- Der Verify-Job löst die Auswahl zu einem unveränderlichen Commit-SHA auf. Der Server checkt exakt diesen getesteten SHA detached aus. Dadurch kann ein späterer Push auf `main` nicht ungetestet mitdeployt werden.

Empfohlen: Branch Protection für `main` aktivieren und den CI-Job als erforderlichen Statuscheck konfigurieren.

## CI-Schritte

`.github/workflows/ci.yml` läuft auf `ubuntu-latest` mit Node.js 22:

1. Repository auschecken.
2. Abhängigkeiten reproduzierbar mit `npm ci` installieren.
3. Prisma Client generieren.
4. `npm run typecheck`.
5. `npm test`.
6. `npm run build`.
7. Lokale, Staging- und Produktions-Compose-Datei mit den jeweiligen Beispiel-Env-Dateien rendern.
8. `npm run validate:compose` und `npm run validate:workflows` ausführen.
9. Backend- und Frontend-Images über Docker Compose bauen.

Auf dem Linux-Runner gilt `docker compose`. `docker.exe compose` ist ausschließlich der bestätigte lokale Windows-Sonderfall.

## Docker-/Compose-Prüfungen

Die drei `config --quiet`-Prüfungen verhindern ungültige Interpolation und YAML-/Compose-Fehler. Der repository-eigene Validator prüft zusätzlich getrennte Projekte, DB-Namen, URL-Credentials, Volumes, Ports und Dockerfiles. Der Image-Build ist im CI enthalten, weil beide Images deterministisch aus dem Root-Kontext gebaut werden und der Stack bereits mit diesen Dockerfiles betrieben wurde. Bei der abschließenden lokalen Wiederholungsprüfung war die Docker-Desktop-Linux-Engine nicht gestartet (`dockerDesktopLinuxEngine`-Pipe fehlte); `docker compose config` blieb erfolgreich. Deshalb ist der erste grüne GitHub-Image-Build ein ausdrückliches Rollout-Kriterium und kein in dieser Sitzung erneut bestätigter Nachweis.

Ein Containerstart mit Datenbank ist nicht Teil jedes CI-Laufs. Echte DB-Cascade-/Import-Integration bleibt eine spätere, isolierte Teststufe.

## Staging-Deployment

`.github/workflows/deploy-staging.yml` besitzt nur `workflow_dispatch`.

1. Gewählte Revision auschecken und zu einem Commit-SHA auflösen.
2. Typecheck, Tests, Build und Staging-Compose-Prüfung ausführen.
3. Erst nach erfolgreichem Verify-Job SSH konfigurieren.
4. Auf dem Server `/var/www/eam-test` und die vorhandene `.env.staging` prüfen.
5. Deployment bei getrackten Serveränderungen oder Platzhaltersecret abbrechen.
6. Git-Refs aktualisieren und exakt den verifizierten SHA detached auschecken.
7. Staging-Compose validieren und mit `up -d --build` aktualisieren.
8. Containerstatus anzeigen und den internen Healthcheck auf `127.0.0.1:4400` in einer portablen Shell-Schleife bis zu zwölfmal im Abstand von fünf Sekunden ausführen.

Der interne Backend-Healthcheck ist maßgeblich, weil er unabhängig von DNS, TLS, Nginx und externen Netzwerkwegen den gerade aktualisierten Container prüft. Ein externer Check kann ergänzend betrieben werden.

Der Remote-Ablauf protokolliert vor dem Deployment ausschließlich sichere Diagnosewerte: Arbeitsverzeichnis, kurzen Git-Status und Commit, Docker-/Compose-Version sowie `docker compose ps`. Env-Inhalte und die gerenderte Compose-Konfiguration werden nicht ausgegeben. Schlägt `docker compose up` oder der Healthcheck fehl, folgen automatisch der Compose-Status und jeweils die letzten 100 Logzeilen von Backend und PostgreSQL. Die Retry-Schleife verwendet nur `curl --fail --silent --show-error`, `seq` und `sleep`; die versionsabhängige Curl-Option `--retry-all-errors` wird nicht verwendet.

## Produktions-Deployment

`.github/workflows/deploy-prod.yml` besitzt weder Push- noch Schedule-Trigger. Zusätzlich zum manuellen Start verlangt es:

- Texteingabe eines freigegebenen Refs.
- Auswahl `DEPLOY_PRODUCTION` statt Standard `ABORT`.
- Bestätigung eines aktuellen Backups außerhalb des Docker-Volumes.
- Bestätigung, dass `HOSTING_ACCEPTANCE_CHECK.md` geprüft wurde.
- erfolgreichen Verify-Job.
- optionalen GitHub-Environment-Schutz für `production` mit Required Reviewers.

Der SSH-Ablauf entspricht Staging, verwendet aber `/var/www/eam`, `.env.prod`, `docker-compose.prod.yml` und `127.0.0.1:4401/api/health`. Auch hier laufen portable Healthcheck-Retries und dieselben secretfreien Fehlerdiagnosen.

## Benötigte GitHub Secrets und Environments

Gemeinsam:

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_SSH_KEY`
- `SERVER_SSH_KNOWN_HOSTS`

Staging:

- `STAGING_DEPLOY_PATH` = `/var/www/eam-test`

Produktion:

- `PROD_DEPLOY_PATH` = `/var/www/eam`

Optional dokumentiert, aktuell zugunsten des deterministischen internen Healthchecks nicht automatisch verwendet:

- `STAGING_HEALTH_URL` = `https://eam-test.messers-cardio-club.com/api/health`
- `PROD_HEALTH_URL` = `https://eam.messers-cardio-club.com/api/health`

GitHub Environments `staging` und `production` sollten angelegt werden. Für `production` sind Required Reviewers und Schutz vor Self-Approval empfohlen.

## Sicherheitsgrenzen

- SSH verwendet StrictHostKeyChecking mit vorab geprüftem Known-Hosts-Eintrag; kein ungeprüftes `ssh-keyscan` während des Workflows.
- Der private Key wird nur temporär mit Modus 600 geschrieben und am Ende entfernt.
- Der Deployment-Benutzer muss dediziert und so knapp wie möglich berechtigt sein. Docker-Gruppenzugriff ist praktisch Root-äquivalent.
- Workflows geben keine Env-Dateien oder Secrets aus und erzeugen sie nicht.
- Deployments brechen bei getrackten Änderungen im Server-Worktree ab; es gibt kein `git reset --hard`.
- Die Anwendungsauthentifizierung schützt EAM-Routen; die frühere Nginx-Basic-Auth-Schicht ist laut Deployment-Abnahme entfernt und bleibt nur eine optionale zusätzliche Schutzmaßnahme.
- Externe Healthchecks sind im MVP nicht automatisiert.

## Rollback-Strategie

Rollback bleibt manuell und ist in `ROLLBACK.md` beschrieben:

1. Vor Produktion aktuelles `pg_dump` außerhalb des Volumes bestätigen.
2. Vorherigen freigegebenen Commit/Tag zunächst in Staging auschecken und bauen.
3. Danach denselben Commit manuell in Produktion deployen.
4. Bei inkompatibler Prisma-Migration reicht Code-Rollback nicht; DB aus geprüftem Dump wiederherstellen.
5. Niemals `docker compose down -v` verwenden.

## MVP-Grenzen

- kein automatisches Deployment bei Push
- kein Container-Registry-/Image-Promotion-Modell; Images werden auf dem Zielserver gebaut
- keine automatische DB-Sicherung oder Wiederherstellung
- kein Zero-Downtime-Deployment
- kein automatischer externer End-to-End-Healthcheck
- kein automatisches Datenbank-Rollback
- keine E-Mail-Verifikation, Passwortwiederherstellung oder serverseitige JWT-Revocation
- GitHub-hosted Runner und manuelle GitHub-Environment-Freigaben bleiben externe Betriebsabhängigkeiten
