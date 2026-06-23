# Manual Rollback

Rollback ist bewusst manuell. Ein Deployment darf nur starten, wenn für Produktion ein aktuelles PostgreSQL-Backup außerhalb des Docker-Volumes existiert.

## Vor jedem Deployment

1. Freizugebenden Commit oder Tag dokumentieren.
2. Aktuellen Containerstatus und Healthcheck dokumentieren.
3. PostgreSQL-Dump erstellen und Dateigröße/Plausibilität prüfen.
4. Restore-Verfahren zuerst in Staging testen.

Beispiel Produktionsbackup:

```bash
cd /var/www/eam
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > /secure/backup/path/eam_prod_YYYYMMDD_HHMM.sql
chmod 600 /secure/backup/path/eam_prod_YYYYMMDD_HHMM.sql
```

## Code-Rollback

Zuerst in Staging:

```bash
cd /var/www/eam-test
git fetch --all --prune --tags
git checkout --detach <vorheriger-commit-oder-tag>
docker compose --env-file .env.staging -f docker-compose.staging.yml config
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build
curl --fail http://127.0.0.1:4400/api/health
```

Nach erfolgreicher Staging-Prüfung analog in Produktion:

```bash
cd /var/www/eam
git fetch --all --prune --tags
git checkout --detach <vorheriger-commit-oder-tag>
docker compose --env-file .env.prod -f docker-compose.prod.yml config
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
curl --fail http://127.0.0.1:4401/api/health
```

Ein Code-Rollback verändert die benannten PostgreSQL-Volumes nicht.

## Datenbank-Rollback

Prisma-Migrationen sind vorwärtsgerichtet. Wenn ein älterer Code mit dem bereits migrierten Schema nicht kompatibel ist, reicht das Auschecken des vorherigen Commits nicht.

Dann ist ein Restore aus einem vor dem Deployment erzeugten `pg_dump` nötig. Den genauen Restore zuerst mit der getrennten Staging-DB testen. Vor einem Restore den aktuellen fehlgeschlagenen Zustand zusätzlich sichern.

Beispiel für einen vorab freigegebenen Staging-Restore:

```bash
cat /secure/backup/path/eam_prod_YYYYMMDD_HHMM.sql | \
  docker compose --env-file .env.staging -f docker-compose.staging.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Ein Produktions-Restore ist eine gesondert freizugebende, destruktive Betriebsmaßnahme und wird nicht durch GitHub Actions automatisiert.

## Verbotene beziehungsweise riskante Befehle

- Niemals `docker compose down -v` in Staging oder Produktion: `-v` löscht die benannten Datenbank-Volumes.
- Kein undokumentiertes `git reset --hard` auf dem Server.
- Keine Prisma-Migrationsdatei nachträglich verändern, wenn sie bereits deployed wurde.
- Keine leere oder ungetestete Dump-Datei zurückspielen.

## Abschlussprüfung

- Containerstatus und internen Healthcheck prüfen.
- Metamodel Export/Import, ConnectionRules und Diagramme stichprobenartig prüfen.
- Rollback-Commit, Dump, Datum, Prüfer und Ergebnis in `HOSTING_ACCEPTANCE_CHECK.md` dokumentieren.
