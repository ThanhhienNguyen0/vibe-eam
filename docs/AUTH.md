# Authentifizierung, Rollen und Company-Isolation

## Aktueller Vertrag – REQ-24, 20.10.2026

Diese Fassung ersetzt die früheren Aussagen über frei gespeicherte Rollen und allein aus dem JWT abgeleitete Company-/Rollenrechte. Die lokale Implementierung ist unabhängig bestätigt; Prüfstand: [REQ-24_IMPLEMENTATION_EVIDENCE.md](REQ-24_IMPLEMENTATION_EVIDENCE.md), Kontrollnachweis: [REQ-24_REVIEW.md](REQ-24_REVIEW.md). Draft-PR [#88](https://github.com/ThanhhienNguyen0/vibe-eam/pull/88) ist veröffentlicht. Die PR-Fortschreibung vom 20.10.2026 dokumentiert die beiden CodeQL-Befunde und ihre Korrektur; Containerausführung, Deployment und menschliche Freigabe bleiben getrennte Grenzen.

### Rollenmatrix

| Aktion innerhalb der eigenen Company | Admin | Architect (UI: Architekt) | Viewer |
|---|---|---|---|
| Architektur, Metamodell, Diagramme und Audit lesen/exportieren/validieren | ja | ja | ja |
| Architekturinstanzen, Beziehungen und Diagramme schreiben; Legacy-Modell importieren | ja | ja | nein |
| Komponenten-/Verbindungstypen, Regeln, Viewpoints und Metamodellimport ändern | ja | nein | nein |
| Nutzer auflisten/anlegen und Rollen zuweisen | ja | nein | nein |

Die Issue-Kurzform „Admin (Nutzer, Metamodell), Architekt (lesen/schreiben), Viewer (lesen)“ wird damit ausdrücklich konkretisiert: Admin besitzt zusätzlich alle Architekturrechte; Architects verwalten keine Nutzer und keine strukturellen Metamodelle. Interne Rollenwerte sind exakt `Admin`, `Architect`, `Viewer` (PostgreSQL-Enum, TypeScript-Union). Neue DB-Nutzer haben defensiv `Viewer` als Schema-Default; öffentliche Unternehmensregistrierung setzt ausdrücklich `Admin`.

### Authentifizierung und frischer interner Kontext

Lokale Registrierung und Nutzeranlage verwenden den gemeinsamen Passwort-Hasher mit bcrypt-Kostenfaktor 12. Passwörter brauchen mindestens acht Zeichen und höchstens 72 UTF-8-Bytes, damit bcrypt nichts still abschneidet. Antworten enthalten ausschließlich öffentliche Nutzerfelder. Unbekannte Serverfehler werden ohne Datenbankeingaben oder Passwort-Hashes protokolliert.

E-Mail-Eingaben werden vor Repositoryzugriff mit einer längenbegrenzten linearen Prüfung verarbeitet; eine reguläre Formel mit datenabhängigem Backtracking wird nicht verwendet. Alle API-Routen besitzen pro Client-IP ein allgemeines Limit von 600 Requests je 15 Minuten. Fehlgeschlagene Registrierung/Login-Versuche unter `/api/auth` werden zusätzlich auf 20 je 15 Minuten begrenzt; erfolgreiche Authentifizierungen belasten dieses engere Limit nicht. Gesundheitsprüfungen und CORS-Preflight sind vom allgemeinen Limit ausgenommen. Loopback- und private Proxyadressen werden als vertrauenswürdige Nginx-Hops behandelt, damit die vom vorhandenen Proxy gesetzte Client-IP maßgeblich bleibt. Der Speicher ist pro Backendprozess; ein verteilter Store wäre bei mehreren Backendinstanzen erforderlich.

Neue JWTs enthalten den internen Nutzer als `sub`, `iat`, `exp`, Issuer und Audience `eam-tool`; Laufzeit acht Stunden, verifiziert ausschließlich mit HS256. Rollen-/Company-Claims sind keine Autorität. Jeder geschützte Request lädt den Nutzer erneut aus der Datenbank und bildet erst danach den internen `AuthPrincipal` und AsyncLocalStorage-Company-Kontext. Alte Company-Claims müssen, falls vorhanden, zur aktuellen internen Zuordnung passen; alte Rollenclaims werden ignoriert. Daher funktionieren auch alte `member`-Tokens nach der Migration entsprechend der aktuellen DB-Rolle. Gelöschte/unbekannte Subjekte verlieren den Zugang. Ein neuer Request mit einem bereits ausgestellten Token berücksichtigt eine Rollenänderung sofort. Bereits laufende fachliche Requests werden nicht rückwirkend abgebrochen.

`authMiddleware.ts` ist der lokale Identitätsadapter; `tenant.ts` enthält den internen Benutzer-/Company-Kontext; `policy.ts` entscheidet ausschließlich über interne Rollen und Aktionen. REQ-25 kann einen OIDC-Adapter hinzufügen, der verifizierte Provideridentitäten auf bestehende interne Nutzer abbildet. Weder Providerrollen noch Request-Bodies dürfen Company-/Rollenrechte setzen. Ein OIDC-Flow ist hier nicht implementiert. Architekturentscheidung: [ADR-REQ-24_AUTHORIZATION.md](ADR-REQ-24_AUTHORIZATION.md).

### Routen, Fehlercodes und Verwaltung

`routePolicies.ts` inventarisiert jede Route mit HTTP-Methode, vollständigem Pfad und genau einer Policy. `apiSecurity` liegt vor sämtlichen Routen. Es gibt keine allgemeine Freigabe für GET oder bekannte Pfadpräfixe. Unklassifizierte Routen und unbekannte Rollen/Permissions werden abgelehnt. `rbac.test.ts` vergleicht das Inventar mit den tatsächlich registrierten Express-Routen einschließlich der Router; auch neue PUT-/POST-/PATCH-/DELETE-Routen lassen den Test scheitern, bis sie klassifiziert sind.

| Route / Gruppe | Policy |
|---|---|
| `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login` | öffentlich |
| `GET /api/auth/me`, `POST /api/auth/logout` | angemeldet, `read` |
| alle vorhandenen GET unter `/api/sidebar`, `/api/model`, `/api/audit-log` | `read` |
| POST/PATCH/DELETE für `/api/sidebar/components`, `/connections`, `/diagrams`, zusätzlich `POST /diagrams/:id/connections` | `architecture:write` |
| alle vorhandenen POST/PATCH/DELETE unter `/api/model` einschließlich `/import` | `architecture:write` |
| POST/PATCH/DELETE für Sidebar-`component-types`, `connection-types`, `connection-rules`, `viewpoints`, zusätzlich `POST /metamodel/import` | `metamodel:write` |
| `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id/role` | `users:manage` |

Vollständiges ausführbares Inventar: `backend/src/auth/routePolicies.ts` (52 Routen; 34 POST/PATCH/DELETE, davon zwei öffentliche Authaktionen und Logout als angemeldete Sitzungsaktion; 31 fachliche Schreibaktionen).

- **401:** fehlende, ungültige, abgelaufene Authentifizierung oder nicht mehr vorhandener interner Nutzer. Falsche Login-Zugangsdaten ergeben ebenfalls 401.
- **403:** gültige Identität ohne gültige interne Rolle, fehlende Aktionsberechtigung oder fehlende Policy. Keine pauschale Abmeldung bei 403.
- **400:** fehlerhafte Eingaben, beispielsweise unbekannte Zielrolle oder ungültige Passwortlänge.
- **404:** Zielnutzer nicht in der eigenen Company gefunden; unbekannte und fremde IDs haben identische Antworten.
- **409:** letzter Admin darf nicht herabgestuft werden oder Nutzer kann wegen global eindeutiger E-Mail nicht angelegt werden. Konfliktantworten nennen weder fremde Company noch Nutzerinformationen.
- **429:** allgemeines API-Limit oder engeres Limit für fehlgeschlagene Authentifizierungsversuche überschritten.
- **500:** unerwarteter Repository-/Policyfehler; keine Fortsetzung zur geschützten Aktion, keine Umdeutung in 401.

`POST /api/users` akzeptiert `email`, `password`, optional `name` sowie eine gültige `role`. `PATCH /api/users/:id/role` akzeptiert `role`. Die Company wird immer aus dem serverseitigen Kontext abgeleitet; mitgesendete Company-/Identitätsfelder haben keine Wirkung. Eine Löschfunktion ist nicht enthalten. Jede Rollen-/Nutzeranlage sperrt in einer Transaktion die eigene Company-Zeile (`FOR UPDATE`), prüft danach den aktuellen Admin erneut und prüft vor Herabstufung die Zahl verbleibender Admins. Dadurch werden parallele Herabstufungen serialisiert und bereits demotete Akteure unter der Sperre erneut abgelehnt. Diese Invarianten gelten für den Anwendungsweg; direkte Datenbankadministration muss dieselben Betriebsregeln beachten.

Die Oberfläche zeigt die Rolle, bietet Viewern keine Änderungsaktionen, bietet Architects keine Metamodell-/Nutzerverwaltung und zeigt Admins die minimale Nutzerverwaltung. Lesezugriffe auf Typen und Regeln bleiben möglich. Nach Fensterfokus, 403 einer fachlichen Aktion oder Rollenänderung aktualisiert die Oberfläche den Nutzerkontext; die API ist unabhängig davon sofort maßgeblich. 403 von `/auth/me` löst keine rekursive Aktualisierung aus. Bei 401 wird der lokale Token entfernt, bei 403 bleibt er erhalten.

### Migration des Bestands

`20261019160000_req24_roles` läuft atomar in `BEGIN/COMMIT`. Vorab wird auf ausschließlich bekannte Altwerte (`member`, `Admin`, `Architect`, `Viewer`) geprüft; Unbekanntes bricht ohne Teilmigration ab und verlangt fachliche Prüfung. Pro Company ohne bestehenden Admin wird der älteste `member` nach `createdAt`, dann lexikographisch `id`, zu Admin. Alle übrigen `member` werden Architect; bestehende gültige Rollen und sämtliche IDs, Company-Zuordnungen und Passwort-Hashes bleiben erhalten. So behält der bisher uneingeschränkt schreibende Bestand Architekturzugriff und jede bisherige reine `member`-Company einen administrativen Einstieg. Die neue administrative Zusatzbefugnis des deterministischen Erstnutzers ist eine explizite Bootstrapentscheidung; vor Produktion muss der Maintainer diese Zuordnung fachlich prüfen. Nicht jeder bisherige Nutzer erhält automatisch Administrationsrechte. Companies mit bereits expliziten Rollen werden nicht pauschal hochgestuft.

Vor Produktionsmigration: Backup, Bestandsrollen prüfen, gewählten Bootstrapadmin pro Company prüfen; keine manuellen Rollenupdates parallel ausführen. Bei unbekannten Werten werden diese außerhalb der Migration fachlich zugeordnet; danach wird die fehlgeschlagene Prisma-Migration nach den üblichen Migrationsregeln als zurückgerollt aufgelöst und wiederholt. Es gibt keinen automatischen Down-/Datenrollback.

### Sicherer Demo-Seed und lokaler Rollentest

Standardmäßig erzeugt der Seed **keine Nutzer**. `SEED_DEMO_USERS=true` ist nur zusammen mit `NODE_ENV=development` oder `test` erlaubt; Produktion, Staging und fehlendes NODE_ENV brechen beim Opt-in vor der ersten Datenbankänderung ab. `SEED_DEMO_PASSWORDS_FILE` muss auf eine private, nicht eingecheckte UTF-8-JSON-Datei zeigen. Das Objekt enthält exakt die Schlüssel `Admin`, `Architect`, `Viewer` mit drei unterschiedlichen, zufällig erzeugten Passwörtern (mindestens 16 Zeichen, höchstens 72 UTF-8-Bytes). Keine Passwörter in Shellargumente, Dokumentation oder Logs schreiben. Datei beispielsweise unter dem ignorierten `.cache` ablegen und nach Gebrauch entfernen; Dateizugriff lokal beschränken.

Bei explizitem Opt-in entstehen in `company-default-demo` (`Default Demo Company`) genau drei Testnutzer:

| Rolle | Nur lokal verwendete Demo-E-Mail |
|---|---|
| Admin | `admin@req24.example.invalid` |
| Architect | `architect@req24.example.invalid` |
| Viewer | `viewer@req24.example.invalid` |

Der Seed ist wiederholbar, aktualisiert nur diese bekannten Demoidentitäten und lehnt Kollisionen mit fremden Companies oder anderen Nutzern der Demo-Company ab. Ein Wiederholungslauf setzt Demo-Rollen und -Passwörter ausdrücklich auf die Testvorgaben zurück. Auf einer frischen Datenbank werden dieselben konsistenten vier EAM-/BPMN-Starterdiagramme wie beim ersten Anwendungszugriff erzeugt; bestehende Metamodelle werden weiter übersprungen. Der bisherige Mix aus Legacy-Beispielen und EAM-only-Definition führte nachweislich zu verwaisten Referenzen und wurde beseitigt. Der explizite Legacy-Import bleibt das separate Migrationswerkzeug.

Für einen lokalen Durchlauf auf einer eigenen Dev-Datenbank die Variablen setzen und `npm run db:migrate --workspace backend`, danach `npm run db:seed --workspace backend` ausführen. Anschließend mit den drei lokalen Passwörtern anmelden: Viewer nur lesen; Architect Instanz/Diagramm schreiben; Admin zusätzlich Typ/Regel ändern und Nutzerverwaltung prüfen. Die API-Direktaufrufe der verbotenen Aktionen müssen 403 ergeben. Keine Produktionsdatenbank für diesen Rollentest verwenden.

Reproduzierbare isolierte Prüfung ohne bestehende Datenbanken:

```powershell
$env:PG_BIN='C:\Program Files\PostgreSQL\14\bin' # lokal installierte PostgreSQL-bin-Verzeichnisversion
npm run test:rbac:db
```

Auf Linux: `PG_BIN="$(pg_config --bindir)" npm run test:rbac:db`. Benötigt lokal `initdb`, `pg_ctl`, `psql`. Das Skript erstellt einen eigenen temporären Cluster, bindet ausschließlich Loopback auf einem zufälligen Port, setzt eine eigene `req24_test_...`-Datenbank und ersetzt geerbte Datenbank-URLs nur im Kindprozess. Es führt alle Prisma-Migrationen und sieben DB-Tests einschließlich realem Seed aus und stoppt/entfernt den Cluster anschließend. Lokales `trust` gilt ausschließlich für diesen wegwerfbaren Loopback-Testcluster ohne Echtdaten. Die reguläre Suite überspringt die sieben DB-Tests ohne `TEST_DATABASE_URL`; die zusätzliche CI-Stufe führt sie ausdrücklich aus. Keine Remote-CI-Ausführung in REQ-24 behauptet.

### Fortbestehende Grenzen

Kein OIDC, Passwortreset, E-Mail-Verifikation, Nutzerlöschen oder umfassender Browser-E2E-Test. Logout bleibt lokal/stateless; ein kopierter gültiger Token ist bis Ablauf verwendbar, aber jede Aktion nutzt den aktuellen Nutzer und seine aktuelle Rolle. Tokens bleiben im Browser-Storage. Das Rate-Limiting ist pro Backendprozess und ersetzt bei horizontaler Skalierung keinen gemeinsamen Store. Die globale E-Mail-Eindeutigkeit erzwingt einen generischen Anlagekonflikt; daraus kann die Belegung einer E-Mail hervorgehen, jedoch keine fremde Company oder deren Nutzerliste. Die bisherige öffentliche Registrierung besitzt ebenfalls eine E-Mail-Konfliktantwort; vollständiger Schutz vor E-Mail-Verfügbarkeitsabfragen erfordert einen eigenen Registrierungs-/Einladungsprozess. Die fachliche Datenpersistenz und ihre Parallelitätsgrenzen außerhalb der Nutzerverwaltung werden hier nicht grundsätzlich umgebaut.

Orientierungsquelle (am 19.10.2026 gelesen): [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), insbesondere Least Privilege, Deny by Default, Prüfung jedes Requests und Autorisierungstests. Implementiert wird die explizit beauftragte Rollenmatrix zusammen mit Company-Kontext; keine Behauptung vollständiger OWASP-Konformität.

## Historische Grundlage vor REQ-24 (ersetzt, nicht aktueller Vertrag)

## Konzept

Issue #18 ergänzt echte Anwendungsauthentifizierung. Eine Registrierung legt immer ein neues `Company`-Objekt und den ersten zugehörigen `User` an. Ein automatischer Beitritt zu einem bestehenden Unternehmen ist im MVP bewusst nicht möglich, weil dafür Einladungstoken oder eine administrative Freigabe nötig wären.

Passwörter werden mit bcrypt und Kostenfaktor 12 gehasht. Die Datenbank speichert ausschließlich `passwordHash`; API-Antworten enthalten dieses Feld nie. Login und Registrierung liefern ein signiertes JWT mit `userId`, `companyId` und Rolle. Das JWT ist acht Stunden gültig und wird als `Authorization: Bearer <token>` gesendet.

`/api/health`, `/api/auth/register` und `/api/auth/login` sind öffentlich. `/api/auth/me`, `/api/auth/logout`, alle `/api/sidebar`-Routen sowie die historischen `/api/model`- und Audit-Routen verlangen ein gültiges JWT.

## Company-Isolation

- Jeder Nutzer gehört genau zu einer Company.
- Der Company-Kontext stammt ausschließlich aus dem verifizierten JWT, niemals aus Request-Bodies.
- Metamodelle, Diagramme, ComponentInstances, ConnectionInstances und der historische Architekturmodell-Zustand sind einer Company zugeordnet.
- Der Prisma-Repository-Layer filtert Lese-, Schreib- und Löschoperationen nach `companyId` beziehungsweise nach dem company-eigenen Metamodell.
- IDs, die bereits einer anderen Company gehören, werden vor einem Repository-Schreibvorgang abgelehnt.
- Neue Companies erhalten beim ersten Zugriff unabhängig von bestehenden Demo-Daten eine company-eigene Kopie des Default-Metamodells und vier editierbare Starterdiagramme: EAM-Gesamtarchitektur, Business & Capability, Application/Data/Technology sowie eine ausdrücklich vereinfachte BPMN-Demo.

Die Migration `20260623170000_add_auth_and_company_isolation` ordnet alle bereits vorhandenen Daten der `Default Demo Company` (`company-default-demo`) zu. Sie löscht weder DB- noch JSON-Daten. Für die Default-Company wird bewusst kein festes Demo-Passwort erzeugt.

## Environment-Variable

`JWT_SECRET` ist für den Backend-Start verpflichtend und muss mindestens 32 Zeichen lang und zufällig sein. Staging und Produktion benötigen unterschiedliche Werte. Der Wert wird in den echten, nicht committeten `.env.staging`- beziehungsweise `.env.prod`-Dateien gepflegt und von Docker Compose an das Backend übergeben.

Beispiel für eine lokale `.env`:

```dotenv
JWT_SECRET=local-only-random-secret-with-at-least-32-characters
```

Fehlt der Wert oder ist er zu kurz, bricht das Backend beim Start mit einer klaren Fehlermeldung ab. Passwörter, JWTs und Env-Inhalte dürfen nicht geloggt werden.

## Lokale Nutzung

1. `.env.example` nach `.env` kopieren und `JWT_SECRET` für die eigene Umgebung ändern.
2. Migration und Seed wie bisher über den Backend-Container oder die DB-Skripte ausführen.
3. Anwendung starten und im Login-Bildschirm ein neues Unternehmen registrieren.
4. Nach erfolgreicher Registrierung wird der JWT-Token clientseitig gespeichert und der EAM-Workspace geladen.
5. Abmelden entfernt den Token. Ein fehlender oder abgelaufener Token führt zurück zum Login.

## Staging und Produktion

Vor dem nächsten Deployment müssen die serverseitigen `.env.staging` und `.env.prod` jeweils einen eigenen starken `JWT_SECRET` enthalten. Die Pipeline erzeugt oder protokolliert diese Dateien nicht.

Die JWT-basierte App-Authentifizierung ist die fachliche Anmeldung und Company-Trennung. Nach der gemeldeten Deployment-Abnahme wurde die temporäre Nginx-Basic-Auth-Schicht entfernt. Die auskommentierten Beispiel-Direktiven unter `deploy/nginx` bleiben als optionale zusätzliche Schutzschicht verfügbar und enthalten keine Zugangsdaten.

## MVP-Grenzen

- keine E-Mail-Verifikation oder Passwort-zurücksetzen-Funktion
- keine Einladungen in bestehende Companies
- keine serverseitige JWT-Revocation; Logout ist stateless
- Rollen werden gespeichert, aber es gibt noch keine feingranulare Rollen-/Rechteverwaltung
- Token liegt im Browser-Storage; ein späteres Hardening kann auf kurzlebige Access-Tokens und HttpOnly-Refresh-Cookies umstellen
