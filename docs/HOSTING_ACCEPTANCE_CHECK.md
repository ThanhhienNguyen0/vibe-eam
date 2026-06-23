# Hosting Acceptance Check

Ausfüllbares Abnahmeprotokoll für Issue #21. Statuswerte: `offen`, `bestanden`, `fehlgeschlagen`, `nicht anwendbar`.

## Metadaten

| Feld | Eintrag |
| --- | --- |
| Server/Umgebung |  |
| Geprüfter Git-Commit/Tag |  |
| Geplantes Freigabedatum |  |
| Verantwortliche Person |  |

## Abnahmepunkte

| Nr. | Prüfpunkt | Status | Datum | Prüfer | Ergebnis | Notizen |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Subdomains: `eam.messers-cardio-club.de` und `eam-test.messers-cardio-club.de` korrekt geplant |  |  |  |  |  |
| 2 | DNS-Status beider Subdomains zeigt auf den beabsichtigten Server |  |  |  |  |  |
| 3 | Staging-Containerstatus: postgres/backend/frontend healthy oder running |  |  |  |  |  |
| 4 | Staging-Healthcheck `127.0.0.1:4400/api/health` erfolgreich |  |  |  |  |  |
| 5 | Staging-Frontend lokal und über Subdomain erreichbar |  |  |  |  |  |
| 6 | Staging-API einschließlich Sidebar/Diagramm erreichbar |  |  |  |  |  |
| 7 | Staging-HTTPS gültig; HTTP-Redirect und Certbot-Renewal geprüft |  |  |  |  |  |
| 8 | Produktions-Containerstatus: postgres/backend/frontend healthy oder running |  |  |  |  |  |
| 9 | Produktions-Healthcheck `127.0.0.1:4401/api/health` erfolgreich |  |  |  |  |  |
| 10 | Produktions-Frontend lokal und über Subdomain erreichbar |  |  |  |  |  |
| 11 | Produktions-API einschließlich Sidebar/Diagramm erreichbar |  |  |  |  |  |
| 12 | Produktions-HTTPS gültig; HTTP-Redirect und Certbot-Renewal geprüft |  |  |  |  |  |
| 13 | PostgreSQL-Backup erstellt und Restore mindestens in Staging erfolgreich geprüft |  |  |  |  |  |
| 14 | Auth-/Basic-Auth-Status und Freigabe für verwendete Daten dokumentiert |  |  |  |  |  |
| 15 | Offene Risiken bewertet und durch verantwortliche Person akzeptiert |  |  |  |  |  |

## Fachliche Stichprobe

| Prüfpunkt | Status | Datum | Prüfer | Ergebnis | Notizen |
| --- | --- | --- | --- | --- | --- |
| Metamodel JSON Export |  |  |  |  |  |
| Metamodel JSON Import |  |  |  |  |  |
| ConnectionRule bleibt primäre Validierungsquelle |  |  |  |  |  |
| Diagramm inklusive Komponenten und Positionen |  |  |  |  |  |
| ComponentInstance-Cascade löscht Connections |  |  |  |  |  |
| Persistenz nach Container-/Serverneustart |  |  |  |  |  |

## Sicherheitsentscheidung

Genau eine Option auswählen:

- [ ] Öffentliche Demo ausschließlich mit künstlichen, nicht sensiblen Daten
- [ ] Gesamte Subdomain durch Nginx Basic Auth geschützt
- [ ] Live-Schaltung bis nach Implementierung von Issue #18 verschoben

Begründung/Freigabe:

> 

## Offene Risiken und Maßnahmen

| Risiko | Schwere | Maßnahme | Verantwortlich | Termin | Status |
| --- | --- | --- | --- | --- | --- |
| Fehlendes Anwendungs-Auth | hoch |  |  |  |  |
| Manuelles Backup/Restore | hoch |  |  |  |  |
| Manuelles Deployment/Rollback | mittel |  |  |  |  |
| Kein Monitoring/Alerting | mittel |  |  |  |  |
| Weitere |  |  |  |  |  |

## Abnahmeentscheidung

| Feld | Eintrag |
| --- | --- |
| Entscheidung (`freigegeben` / `nicht freigegeben`) |  |
| Gültig für (`Staging` / `Produktion`) |  |
| Datum |  |
| Prüfer/Freigebender |  |
| Bedingungen/Auflagen |  |
