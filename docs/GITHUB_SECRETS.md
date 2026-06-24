# GitHub Actions Secrets

Die Deployment-Workflows verwenden ausschließlich SSH- und Pfadwerte. `.env.staging` und `.env.prod` bleiben auf dem Server und werden weder als GitHub Secret gespeichert noch durch Workflows erzeugt.

## GitHub Environments

Empfohlen:

- Environment `staging`
- Environment `production` mit Required Reviewers und Schutz vor Self-Approval

Secrets können repositoryweit oder vorzugsweise environment-spezifisch hinterlegt werden. Gleichnamige Server-Secrets dürfen für beide Environments verwendet werden, wenn derselbe Server und Deployment-Benutzer genutzt werden.

## Erforderliche Secrets

| Secret | Zweck | Beispiel/Regel |
| --- | --- | --- |
| `SERVER_HOST` | SSH-Ziel | Server-DNS-Name oder IP; nicht im Workflow hardcoden |
| `SERVER_USER` | dedizierter Deployment-Benutzer | Kein persönlicher Allzweck-Account |
| `SERVER_SSH_KEY` | privater SSH-Deployment-Key | Gesamter OpenSSH-Private-Key, niemals ausgeben |
| `SERVER_SSH_KNOWN_HOSTS` | vorab verifizierter Host-Key | Ausgabe eines administrativ verifizierten Known-Hosts-Eintrags |
| `STAGING_DEPLOY_PATH` | Staging-Checkout | `/var/www/eam-test` |
| `PROD_DEPLOY_PATH` | Produktions-Checkout | `/var/www/eam` |

Die Workflows validieren die beiden Deploy-Pfade zusätzlich gegen diese bestätigten Pfade.

## Optionale Werte

| Secret | Vorgesehener Wert | Aktueller Einsatz |
| --- | --- | --- |
| `STAGING_HEALTH_URL` | `https://eam-test.messers-cardio-club.com/api/health` | Dokumentiert; der Workflow bevorzugt den internen Containercheck |
| `PROD_HEALTH_URL` | `https://eam.messers-cardio-club.com/api/health` | Dokumentiert; der Workflow bevorzugt den internen Containercheck |

Die Workflows verwenden den zuverlässigen internen Healthcheck über `127.0.0.1:4400` beziehungsweise `127.0.0.1:4401`. Er ist unabhängig von DNS, TLS und Reverse Proxy. Externe End-to-End-Checks können ergänzend eingerichtet werden, ohne App-Tokens oder andere Zugangsdaten in Workflow-Logs auszugeben.

## Deployment-Key einrichten

Auf einer vertrauenswürdigen Admin-Maschine einen ausschließlich für Deployment gedachten ED25519-Key erzeugen. Ein nicht interaktiv verwendbarer Workflow-Key kann keine Passphrase abfragen; deshalb muss das zugehörige Serverkonto besonders knapp berechtigt und der private Key streng als GitHub Secret geschützt sein.

```bash
ssh-keygen -t ed25519 -C "github-actions-eam-deploy" -f ./eam_deploy_key
```

Nur den öffentlichen Key `eam_deploy_key.pub` in `~/.ssh/authorized_keys` des Deployment-Benutzers auf dem Server eintragen. Den privaten Key vollständig als `SERVER_SSH_KEY` hinterlegen und anschließend lokal sicher verwahren oder löschen.

Der Deployment-Benutzer benötigt:

- Lese-/Schreibrechte in `/var/www/eam-test` und `/var/www/eam`
- Zugriff auf Git-Remote
- Berechtigung für Docker Compose

Achtung: Mitgliedschaft in der Docker-Gruppe ist praktisch Root-äquivalent. Keine interaktive Alltagsnutzung dieses Accounts.

## Host-Key verifizieren

Den Server-Host-Key außerhalb des Workflows erfassen und dessen Fingerprint über einen administrativ vertrauenswürdigen Kanal vergleichen. Erst den geprüften vollständigen Known-Hosts-Eintrag als `SERVER_SSH_KNOWN_HOSTS` speichern.

Der Workflow verwendet `StrictHostKeyChecking=yes` und führt bewusst kein ungeprüftes `ssh-keyscan` aus.

## Was nicht in GitHub Secrets gehört

- `.env.staging` oder `.env.prod` als kompletter Dateiinhalt
- PostgreSQL-Passwörter, solange die Env-Dateien serverseitig verwaltet werden
- Nginx-Basic-Auth-Passwörter oder `.htpasswd`-Dateien
- Datenbank-Dumps
- TLS-Private-Keys

## Log- und Rotationsregeln

- Secrets niemals mit `echo`, `cat`, `printenv`, `docker compose config` ohne geeignete Vorsicht oder Debug-Tracing ausgeben.
- GitHub-Secret-Masking ist eine Zusatzsicherung, kein Freibrief zum Loggen.
- SSH-Key bei Verdacht sofort serverseitig aus `authorized_keys` entfernen und in GitHub rotieren.
- Server-/Deployment-Zugriffe regelmäßig überprüfen.
