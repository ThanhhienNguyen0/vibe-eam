# REQ-26 – Optimistic Locking

Stand: 2026-11-06. Issue: #58. Branch: `codex/eam/req-26-optimistic-locking`.

## Abhängigkeit und Versionsbegriffe

REQ-26 ist auf den unabhängig technisch freigegebenen, noch nicht nach `main` gemergten
REQ-33-Commit `dd14b162ef611ccd7706e540416b1a5edf174f7e` gestapelt. Dessen `main`-Basis ist
`8868629a8727c99bc5472e65dc261d49ebb34c0c`.

- `schemaVersion` bezeichnet ausschließlich das portable REQ-33-Dateiformat.
- `Metamodel.version` bezeichnet die fachliche Version des Metamodells.
- `version` an Komponenten, Relationen und Diagrammen bezeichnet die serverseitige
  Laufzeitrevision eines Objekts.
- `dataRevision` bezeichnet den serverseitigen Stand der gesamten Unternehmensdatenbasis,
  gegen den Whole-State-Importe und Import-Vorschauen gebunden werden.

## Bestandsaufnahme vor Implementierung

- `PrismaSidebarStateRepository.write` upsertet und löscht den gesamten Unternehmenszustand.
  Vor dem Schreiben findet keine DB-atomare Versionsprüfung statt.
- `sidebarStore` cached vollständige Zustände pro Unternehmen im Backendprozess. Mehrere
  Prozesse können deshalb voneinander veraltete Kopien schreiben.
- Komponenten-, Relationen- und Diagramm-PATCH/DELETE besitzen keine Vorbedingung.
- Diagrammmitgliedschaften werden bei jedem Whole-State-Write vollständig ersetzt.
- CSV/XLSX-Commit plant die Datei beim Commit neu, bindet den Commit aber nicht an die zuvor
  angezeigte Vorschau. REQ-33-JSON-Import ersetzt den Zustand ohne Datenbasisrevision.
- Die historische `/api/model`-API speichert Elemente und Relationen als JSONB-Gesamtobjekt
  und cached es ebenfalls pro Prozess.
- Normalisierung/Initialisierung kann nach einem Read automatisch einen vollständigen Write
  auslösen.
- Import-Audit wird mit dem Sidebar-Write transaktional angelegt; abgelehnte Konflikte dürfen
  diese Transaktion nicht erreichen.

## Persistenzvertrag

1. Komponenten, Relationen und Diagramme beginnen bei `version = 1`. PATCH erhöht die Version
   serverseitig genau einmal. DELETE prüft dieselbe Version DB-atomar.
2. PATCH/DELETE benötigen `If-Match` mit einer positiven ganzzahligen Objektversion. Fehlend
   ergibt `428 Precondition Required`, syntaktisch/semantisch ungültig `400`, nicht vorhanden
   `404`, veraltet `409 Conflict` mit aktuellem Objektstand.
3. Ein bewusstes Überschreiben ist kein Force-Bypass: Die UI sendet nach ausdrücklicher Wahl
   den zuletzt vom Server gemeldeten aktuellen Stand als neue `If-Match`-Vorbedingung. Jeder
   weitere Zwischenwrite führt erneut zu `409`.
4. Objektmutationen arbeiten direkt auf der aktuellen DB-Zeile. Gleichzeitige Änderungen an
   verschiedenen Objekten werden nicht aus einer veralteten Whole-State-Kopie zurückgeschrieben.
5. Jede erfolgreiche Mutation erhöht `Company.dataRevision`. Whole-State-Operationen müssen
   die gelesene Datenbasisrevision atomar vergleichen; bei Abweichung bleibt die Transaktion
   vollständig unverändert.
6. Import-Vorschau liefert ihre `dataRevision`; Commit muss genau diese Revision angeben.
   Änderungen zwischen Vorschau und Commit erzwingen `409` und eine neue Vorschau.
7. REQ-33-`schemaVersion` und `Metamodel.version` werden niemals als Locking-Vorbedingung
   verwendet. Laufzeitrevisionen sind nicht Bestandteil der portablen REQ-33-Datei.
8. Sidebar-Snapshots verwenden `RepeatableRead`; Nutzdaten und `dataRevision` stammen aus
   demselben DB-Snapshot. Whole-State-Writes erhöhen nur tatsächlich geänderte Objektversionen.
9. Create-and-Place ist eine Transaktion. Legacy-Body und -ETag stammen aus einer DB-Zeile;
   Legacy-Importe verwenden eine monotone Aggregatrevision statt eines Versionsresets.
10. Jeder Sidebar-Schreibpfad sperrt zuerst die Company-Zeile und erst danach Objekt- oder
    Diagrammzeilen. PostgreSQL-`P2034` wird als Optimistic-Locking-Konflikt behandelt.
11. Komponenten- und Relationslöschungen erhöhen die Version jedes durch Kaskaden veränderten
    Diagramms in derselben Transaktion genau einmal. Stale Diagramm-PATCHes bleiben 409-fähig.
12. Create-and-Place-Antworten werden aus dem gespeicherten Zustand gebildet; ihre
    Diagrammversion ist unmittelbar für das nächste `If-Match` verwendbar.

## Abnahmematrix

| Kriterium / Risiko | Geplante Evidenz | Status |
|---|---|---|
| Komponenten und Relationen besitzen Versionen | Prisma-Migration, API- und DB-Tests | lokal erfüllt |
| Stale PATCH/DELETE liefert 409 | API-Tests plus unabhängige PostgreSQL-Clients | lokal erfüllt |
| Fehlende/ungültige Vorbedingung ist kein Bypass; 404/409 getrennt | API-Vertragstests | lokal erfüllt |
| UI bewahrt Entwurf und bietet Neu laden/Überschreiben | echte React-Editorintegration plus Helpertests | lokal erfüllt; kein Browser-E2E |
| Zweiter Zwischenwrite nach Überschreibwahl konflikthaft | API-/DB-Konkurrenztest | lokal erfüllt |
| Update/Update und Update/Delete atomar | echte PostgreSQL-Konkurrenztests mit Barriere | lokal erfüllt |
| Relationen und Kaskadenlöschung geschützt | echte PostgreSQL-Tests | lokal erfüllt |
| Verschiedene Elemente setzen einander nicht zurück | zwei unabhängige DB-Clients/Repositorys | lokal erfüllt |
| Diagramm-Save/Mitgliedschaften geschützt | echte PostgreSQL- und API-Tests | lokal erfüllt |
| CSV/XLSX- und REQ-33-Import an Datenbasis gebunden | Vorschau-/Commit- und JSON-Importtests | lokal erfüllt |
| Multi-Prozess-Wirkung | getrennte Node-Prozesse und Prisma-Clients ohne Prozesslock | lokal erfüllt |
| Tenant-Isolation | echte PostgreSQL-Tests mit zwei Companies | lokal erfüllt |
| 409 ohne Teiländerung und ohne Erfolgs-Audit | DB-Assertions vor/nach Konflikt | lokal erfüllt |
| Historische aktive Model-API geschützt | API-/DB-Tests | lokal erfüllt |
| Snapshot/Normalisierung überschreibt nichts Neues | deterministische Zwischen-PATCH- und Read-only-DB-Regression | lokal erfüllt |
| RBAC und Viewpoint-Read-only bleiben erhalten | bestehende und gezielte Regressionstests | lokal erfüllt |
| REQ-33-Round-Trip bleibt identisch | bestehende Unit- und DB-Round-Trip-Tests | lokal erfüllt |
| Migration, Backup/Restore und Rollback real geprüft | isolierte PostgreSQL-Kommandos mit Ergebnissen | lokal erfüllt |
| Einheitliche Company→Objekt-Sperrreihenfolge | drei echte Lockbarrieren gegen PATCH, DELETE und Create-and-Place | lokal erfüllt |
| Kaskaden invalidieren Diagrammversionen | Komponenten-/Relationslöschung, stale 409, Rollback und Auditassertionen | lokal erfüllt |
| Create-and-Place liefert gespeicherte Version | Antwort = unmittelbarer GET; direktes PATCH mit Antwortversion | lokal erfüllt |

Der lokale Status ist keine unabhängige Abnahme. Container-Image-Build, Remote-CI/CodeQL,
getrennte KI-Kontrolle, menschliches Review, Push/PR, Merge und Deployment sind offen.

Kontrollhistorie: `7c1079e6748adacee1dfed8f87220e03d0c78b92` wurde mit drei P1- und zwei
P2-Bereichen abgelehnt. Der unabhängig geprüfte erste Korrekturcommit
`6cfaec668507865d0b37f835565de7400beab015` wurde wegen zwei P1-, einem P2- und einem
P3-Befund ebenfalls abgelehnt. Die danach ergänzte einheitliche Sperrreihenfolge,
Kaskadenversionierung, gespeicherte Antwortversion und zugehörigen Regressionen benötigen eine
neue Kontrolle des vollständigen Folgecommits. Der isolierte DB-Lauf umfasst nun 31 von 31 Tests.

## Abgrenzung

REQ-23 wird nicht implementiert. Vorhandene Import-Auditeinträge bleiben erhalten; REQ-26
stellt nur sicher, dass Konflikte vor Mutation und Erfolgs-Audit abbrechen.
