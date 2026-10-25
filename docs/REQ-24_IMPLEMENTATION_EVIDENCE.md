# REQ-24 – Claim-Evidence-Matrix und lokale Übergabe

Stand: **19.10.2026** (Europe/Berlin). Issue: [#56](https://github.com/ThanhhienNguyen0/vibe-eam/issues/56), am selben Tag über die GitHub-Integration gelesen. Basis exakt `2f21cfed4e1e56826e2b13590aea9d5649e59050` (`origin/main`, Merge REQ-30). Branch: `codex/eam/req-24-rbac`. Separater Arbeitsbaum: `C:\Users\messe\.codex\worktrees\req-24-rbac\New project`.

**Historischer Status vom 19.10.2026:** lokal unabhängig bestätigt; Push, Remote-CI, Containerausführung, Deployment und menschliche Freigabe waren offen. Der damalige Basisdiff enthielt den getrennten Dependabot-Commit nicht. Geprüfter Implementierungscommit: `16035678a1f0e813932e10b8f92d60a3e32230f9`. Auditdatensatz der getrennten Kontrolle: [REQ-24_REVIEW.md](REQ-24_REVIEW.md).

## PR-Fortschreibung vom 20.10.2026

Draft-PR [#88](https://github.com/ThanhhienNguyen0/vibe-eam/pull/88) wurde auf dem veröffentlichten Branch `codex/eam/req-24-rbac` erstellt. Die GitHub-Actions-Läufe `CI` und `CodeQL` waren für den ursprünglichen PR-Head `9457afd78429508a4e05c82fbb8b569b149583ba` technisch erfolgreich. Der separate GitHub-Advanced-Security-Check blockierte dennoch mit zwei neuen hohen CodeQL-Befunden: potenziell polynomiale Laufzeit der E-Mail-Regulärformel und fehlendes Rate-Limiting vor den autorisierten API-Routen.

Die Korrektur ersetzt die E-Mail-Regulärformel durch eine längenbegrenzte lineare Prüfung und setzt `express-rate-limit` vor API-Sicherheitsmiddleware und JSON-Parser. Alle API-Routen sind auf 600 Requests je Client-IP und 15 Minuten begrenzt; Registrierung zusätzlich auf zehn Versuche einschließlich erfolgreicher Anlagen, fehlgeschlagene Logins auf 20. Der dokumentierte öffentliche Pfad hat genau einen Nginx-Hop: Nginx überschreibt `X-Forwarded-For`, Express vertraut genau einem Hop und der lokal veröffentlichte Backend-Port bindet an Loopback. Tests variieren untrusted linke Headerwerte bei gleichbleibender tatsächlicher Client-IP und belegen 429 nach 20 abgelehnten Logins sowie nach einer erfolgreichen und neun abgelehnten Registrierungen. Weitere Negativfälle prüfen mehrfaches `@` und überlange Eingaben.

Eine getrennte Folgekontrolle des ersten Korrekturcommits `f8704e48cbf0e387424417896028fbc8be242940` fand drei sicherheitsrelevante Randbedingungen: private Netzbereiche waren als Proxyhops zu breit vertraut, das allgemeine Limit lag noch hinter dem JSON-Parser, und erfolgreiche Registrierungen wurden vom gemeinsamen Auth-Limit abgezogen. Zusätzlich war die Veröffentlichung im Promptprotokoll zu früh als abgeschlossen bezeichnet. Die oben beschriebene Ein-Hop-Topologie, frühe Begrenzung, getrennten Register-/Login-Limits und Statuskorrektur beheben diese P1-/P2-/P3-Befunde. Die abschließende unabhängige Nachprüfung des finalen Korrekturstands wird in `REQ-24_REVIEW.md` protokolliert.

Der Branch wurde ohne History-Rewrite mit dem aktuellen `origin/main` `c489027fc9e7897da17d4dc08d4bb230d4aaed3e` zusammengeführt; damit ist auch die bereits separat gemergte Dependabot-Konfiguration `89a8a8e2` Bestandteil des aktuellen PR-Stands. Lokal beobachtet: sauberes `npm ci` mit 440 installierten und 443 auditierten Paketen, 0 Schwachstellen; `npm run check` nach der finalen Proxy-/Limiterkorrektur vollständig erfolgreich mit 88 Backend- und 9 Frontendtests, beiden Builds, 112 Compose-, 169 Workflow- und 17 Securityprüfungen; isolierte PostgreSQL-14-Suite 7/7; Dependency-Audit 0; Secret-Scan mit erkanntem Canary und ohne echten Fund in 46 zu diesem Prüfzeitpunkt verfügbaren Commits sowie 169 aktuellen Dateien; `git diff --check` sauber. Der erneute Remote-CodeQL-/CI-Lauf für den Korrekturcommit ist vor seinem Push noch kein belegtes Ergebnis. Kein Merge, Deployment oder Schließen von Issue #56.

## Frage, Vorgehen und Aussagebereich

Projektfrage ist, ob und inwiefern ein EAM-Tool mittels KI „gevibecodet“ werden kann. Gegenstand dieses Schritts ist die technische Umsetzung der expliziten Rollenmatrix in einem vorhandenen soziotechnischen EAM-Prototypen, primär aus Software-Engineering-Sicht. Untersucht werden Dateien, API-Verhalten, Datenbanktransaktionen und Testresultate dieser Revision; keine allgemeine Wartbarkeit, Nutzerakzeptanz oder kausale Überlegenheit von KI. Beobachtungen werden getrennt von Bewertungen und offenen Grenzen geführt. Reproduzierbarkeit, Least Privilege, Tenantgrenzen und nachvollziehbare Entscheidungen sind gesetzte Qualitätsziele. Keine Nutzerdatenstudie oder Übernahme produktiver Zugangsdaten.

Methode: enger Ist-/Sollvergleich mit Issue und Umsetzungsauftrag, überprüfte technische Primärquelle OWASP, automatisierte positive/negative Matrixtests, Vergleich aller tatsächlichen Express-Routen, isolierte PostgreSQL-Integration und komponentenbezogene SSR-Tests. Die KI führte Implementierung, Testentwurf, Ausführung und Dokumentation durch. Der getrennte Kontrollchat `01a154a2-d3b0-70c3-9a30-a130659a071d` prüfte anschließend den fertigen lokalen Commit in einer unabhängigen Kopie. Resultate, Trennung, Befunde und Grenzen stehen in `REQ-24_REVIEW.md`. Konkrete Gründe der Professorenkritik bleiben eine Evidenzlücke.

## Kriteriumsweiser lokaler Prüfstand

Die ursprünglichen REQ-24-Beobachtungen stammen vom **19.10.2026**; die ausdrücklich als PR-Fortschreibung bezeichneten CodeQL-, Proxy- und Limiterbeobachtungen vom **20.10.2026**. „Erfüllt (lokal)“ bezeichnet den lokal geprüften Implementierungsstand. Die ursprüngliche Kontrollinstanz bestätigte den Basisstand ohne P0–P2-Befund; die getrennte Folgekontrolle bestätigte den finalen Korrekturcommit ohne neue P0–P2-Code- oder Konfigurationsbefunde. Externe und menschliche Freigaben sind davon nicht umfasst.

| Akzeptanzkriterium | Status | Konkrete Datei/Zeile oder Verhalten | Prüfkommando und tatsächlich beobachtetes Resultat | Grenzen |
|---|---|---|---|---|
| 1. Lokaler Login mit sicherem Passwort-Hashing | erfüllt (lokal) | `backend/src/auth/authService.ts`: gemeinsame Validierung, lineare E-Mail-Prüfung und bcrypt 12; `server.ts`: allgemeines Limit vor JSON-Parser sowie getrennte Register-/Login-Limits; `prismaAuthRepository.ts`: erste Registrierung als Admin; öffentliche Antwortprojektion ohne Hash | `npm run check`: Authsuite und übrige Tests grün; Regressionen ergeben nach 20 fehlgeschlagenen Logins sowie nach einer erfolgreichen und neun abgelehnten Registrierungen 429; variierende linke `X-Forwarded-For`-Werte umgehen die Ein-Hop-Zählung nicht; `npm run test:rbac:db`: echte Registrierung/Login, bcrypt-Runden 12, Hashvergleich und falsches Passwort geprüft, DB-Suite 7/7 | Kein Passwortreset oder E-Mail-Verifikation; Rate-Limit-Speicher ist pro Backendprozess; bestehende Tokenaufbewahrung bleibt |
| 2. Admin / Architect / Viewer | erfüllt (lokal) | `backend/src/auth/policy.ts:2`, `:7`, `schema.prisma:23`, `:35`; Admin alle Companyaktionen, Architect Architektur, Viewer lesen; `frontend/src/access.tsx:6`, `App.tsx:133`, `UserManagement.tsx:6` | `npm run check`: Rollenmatrix, Enumabgleich, Rollenansichten und 401/403-Regressionsfälle grün; DB-Matrix lässt erlaubte Instanz-/Typanlagen tatsächlich zu und lehnt verbotene ab | Kurzform des Issues im Auftrag präzisiert, vollständige Matrix in `AUTH.md`; Nutzerliste ausschließlich Admin |
| 3. Alle schreibenden API-Endpunkte serverseitig geprüft | erfüllt (lokal) | `backend/src/server.ts:50` vor sämtlichen Routen; `routePolicies.ts:12`, `:40`; 52 exakte Registrierungen, 34 POST/PATCH/DELETE, darunter 31 fachliche Schreibaktionen | `npm run check`: Inventar gleicht jeden tatsächlichen Routerpfad mit Policy ab; jeder geschützte Pfad ohne Token 401; jede Viewer-Fachschreibaktion 403; jede Metamodell-/Nutzeraktion als Architect 403; neue unklassifizierte PUT-Route erzeugt Inventardifferenz und hat keine Freigabe | Authregister/-login sind ausdrücklich öffentlich; Logout ist Sitzungsaktion für alle gültigen Rollen. Routen müssen weiterhin ausdrücklich klassifiziert werden |
| 4. 401 / 403 | erfüllt (lokal) | `authMiddleware.ts:14` und `routePolicies.ts:40`; unbekannter/fehlender/veralteter interner Rollenwert geschlossen; `frontend/src/authApi.ts:37` unterscheidet Status | `npm run check`: fehlende/abgelaufene/manipulierte Authentifizierung 401, gültige Identität ohne Recht 403; Repositoryfehler 500 ohne geschützte Ausführung; Frontend behält Token bei 403 und löscht bei 401, kein Refreshloop bei `/auth/me`-403 | Bereits laufende fachliche Requests werden nicht rückwirkend widerrufen; nachfolgende Requests lesen die neue Rolle |
| 5. Genau ein Testnutzer je Rolle | erfüllt (lokal) | `demoSeed.ts:7`, `:12`, `:31`; `backend/prisma/seed.ts:13`; expliziter Schalter, nur development/test, private Passwortdatei, Transaktion und Kollisionsprüfung | `npm run test:rbac:db`: echter Seed zweimal ausgeführt; genau drei Rollen, bcrypt 12, alle Rollenlogins erfolgreich; production-Opt-in scheitert ohne zusätzliche Nutzer. Unitfälle prüfen deaktiviert/fehlende Datei/unbekannte Umgebung/ungültige Passwörter | Kein produktives Testkonto. Wiederholung setzt ausdrücklich die drei Demo-Passwörter/-Rollen. Keine Geheimnisse in Git oder Logs |
| 6. OIDC später ergänzbar, jetzt nicht implementiert | erfüllt (Architektur; lokal) | `authMiddleware.ts:14` trennt Identitätsadapter vom frischen internen Kontext; `tenant.ts:7`; `policy.ts:17`; ADR dokumentiert Mappingboundary | Code-/Diffprüfung: neue lokale JWTs enthalten keine autoritativen Rollen/Companies; aktuelle DB-Rolle wird unabhängig von Tokenclaims verwendet; ausgegebener Token bleibt nach Herabstufung derselbe und wird sofort mit neuen Rechten geprüft | Keine OIDC-Interoperabilität oder Provideranbindung getestet; Implementierung bleibt REQ-25 |

## Zusätzliche Sicherheits-/Integritätsbelege aus dem Auftrag

| Claim | Implementierung / Prüfung am 19.10.2026 | Beobachtetes Ergebnis und Grenze |
|---|---|---|
| Cross-Company-Nutzerverwaltung verhindert | `prismaAuthRepository.ts:55`, `:60`, `:81`; DB-Test mit zwei Companies und manipuliertem Body | Liste enthält nur eigene Nutzer; fremde und unbekannte Ziel-ID ergeben identische 404; Company aus Body ignoriert; fremder Admin unverändert. Kein globaler Such-/Listenendpunkt |
| Letzter Admin bleibt erhalten | Company-`FOR UPDATE`, Akteurlookup danach, Ziellookup mit Company, Zählung und Update in derselben Transaktion | Zwei zeitgleiche Selbstherabstufungen: genau eine 200, eine 409 und danach exakt ein Admin. Erneuter Versuch scheitert. Bereits herabgestufter Akteur kann auch direkt über Repository keine Nutzer anlegen |
| Tokenrolle wird nicht acht Stunden eingefroren | Jeder Request lädt Nutzer; alte Claims erteilen keine Rechte | Bestehender Admin-/Architect-Token nach Rollenwechsel verliert Schreib-/Verwaltungsrechte. Gefälschter Adminclaim eines Viewers gewährt nichts. Unbekannte DB-Rollen einschließlich `member`, fehlende Rollen und `__proto__` ergeben 403 |
| Migration verhindert `member`-Lockout deterministisch | `20261019160000_req24_roles/migration.sql:3`; echte Altschemata mit ältestem Nutzer, Gleichstand, späterem Nutzer und bereits bestehendem Admin | Ältester/tie-break-ID wird Admin, übrige Mitglieder Architect, vorhandener Admin bleibt; Passwort-Hashes bleiben exakt erhalten. Enum lehnt `member` ab. Unbekannte Altrolle löst expliziten Fehler und Rollback aus |
| Seed bleibt reproduzierbar | Gleicher konsistenter Company-Starter wie im laufenden System; bestehendes Metamodell weiterhin übersprungen | Zwei echte Seeds mit Beispielen erfolgreich, drei Rollen loggen ein; zuvor verifizierter BPMN-Referenzfehler beseitigt. Kein Umbau anderer Datenpfade |
| Künftige Routen/CI-Regressionen werden sichtbar | Tatsächlicher Express-Graph plus Dateiinventar; separate blockierende DB-Stufe im CI-YAML; Mutationen gegen Entfernen/Optionalisieren | Lokaler Inventartest und 17/17 Securitytests grün. CI-Linux-Ausführung selbst ist noch offen |

## Vollständige Abschlussprüfungen

Umgebung: Windows, PowerShell, Node `v24.15.0`, npm-Workspace; echte temporäre PostgreSQL-Instanz `14.9`, Loopback und zufälliger Port. Nur selbst erzeugte Datenbanken `req24_test_...`; keine bestehenden Nutzdaten verändert. Alle folgenden Endprüfungen am 19.10.2026, Exitcode 0 soweit nicht ausdrücklich als Grenze angegeben.

| Exaktes Kommando | Tatsächlich beobachtetes Endresultat |
|---|---|
| `npm ci` | 438 Pakete installiert, 441 auditiert, 0 Vulnerabilities; saubere Abschlussinstallation mit aktualisiertem Lockfile |
| `npm run check` | Prisma Generate, Lint ohne Warnungen, Backend-/Frontend-Typecheck erfolgreich; **85 Backendtests bestanden**, sieben DB-Tests in dieser regulären Suite bewusst übersprungen; **9 Frontendtests bestanden**; Backend- und Vite-Produktionsbuild erfolgreich (1.754 Module); **112 Composechecks**, **169 Workflowchecks**, **17 Securitytests**; Prisma-Konfigurationskompatibilität erfolgreich |
| `npm run scan:dependencies` | Vollständiger Audit inklusive dev: info 0, low 0, moderate 0, high 0, critical 0, total 0 |
| `npm run scan:secrets` | Canary meldete den synthetischen Testfund erwartungsgemäß. Selbstprüfung: 43 lokal verfügbare Commits und aktueller Arbeitssnapshot ohne Secretfund. Unabhängige Kopie: 25 dort verfügbare Commits und 168 aktuelle Dateien ohne echten Fund. Die vollständige Remote-Historie ist erst nach Push und Remote-CI belegt |
| `$env:PG_BIN='C:\Program Files\PostgreSQL\14\bin'; npm run test:rbac:db` | Alle vier Prisma-Migrationen auf leerer separater DB angewandt; **7/7 echte DB-Tests** bestanden: Registrierung/Hash/Login, Rollenmatrix, Tokenfreshness, Companygrenzen, Konkurrenz/letzter Admin, echter wiederholter Seed und deterministische Bestandsmigration mit Negativfall |
| `npm run test --workspace backend -- src/auth/auth.test.ts src/auth/rbac.test.ts src/auth/demoSeed.test.ts` | Zusätzlich zur Vollsuite ausgeführt: **3/3 Testdateien, 25/25 Tests bestanden** |
| `git diff --check` | Keine Whitespacefehler; vor Commit erneut geprüft |
| `git diff 2f21cfed4e1e56826e2b13590aea9d5649e59050 --stat` und `--name-only` | Ausschließlich unten gelistete REQ-24-Dateien; keine Dependabotänderung, keine Änderung an veraltetem main, Basis-SHA vor Arbeit exakt bestätigt |
| `git status --short`, `git log --oneline 2f21cfed..HEAD` | Vor Commit nur eigener Requirementdiff; nach lokalem Commit wird sauberer Endstatus und exakter SHA separat an die Kontrolle übergeben |

Der reguläre Gate enthält 94 ausgeführte Anwendungstests; hinzu kommen sieben ausgeführte DB-Integrationstests, zusammen 101. Die 17 Security-Gateregressionen sind separat. Die vorhandenen REQ-30-Gates wurden erweitert und nicht abgeschwächt. Warnung bleibt: Prisma kündigt die spätere Ablösung der `package.json#prisma`-Konfiguration in Prisma 7 an; keine ungeplante Majormigration.

## Rollen-/Routenmatrix

Ausführbare vollständige Liste: `backend/src/auth/routePolicies.ts`. Gruppenmatrix und Body-/Fehlervertragsdetails: `AUTH.md`. Alle vorhandenen GETs außerhalb der Nutzerverwaltung erlauben allen drei gültigen Rollen Lesezugriff. Architektur-Schreibaktionen erlauben Admin und Architect, strukturelle Metamodell- und Nutzeraktionen nur Admin. Jede fachliche Route ist company-lokal. Unauthentifizierte geschützte Routen ergeben 401, gültige Identität ohne Recht 403. Es gibt keine still erlaubte neue Route.

## Vollständige Dateiliste gegenüber der verbindlichen Basis

```text
.env.example
.github/workflows/ci.yml
backend/prisma/migrations/20261019160000_req24_roles/migration.sql
backend/prisma/schema.prisma
backend/prisma/seed.ts
backend/src/auth/auth.test.ts
backend/src/auth/authMiddleware.ts
backend/src/auth/authRoutes.ts
backend/src/auth/authService.ts
backend/src/auth/authTypes.ts
backend/src/auth/demoSeed.test.ts
backend/src/auth/demoSeed.ts
backend/src/auth/policy.ts
backend/src/auth/prismaAuthRepository.ts
backend/src/auth/rbac.database.test.ts
backend/src/auth/rbac.test.ts
backend/src/auth/routePolicies.ts
backend/src/auth/userRoutes.ts
backend/src/server.ts
backend/src/tenant.ts
docs/ADR-REQ-24_AUTHORIZATION.md
docs/AI_REFLECTION_LOG.md
docs/AUTH.md
docs/EVALUATION_MATRIX.md
docs/IMPLEMENTATION_PLAN.md
docs/MAINTAINABILITY.md
docs/PROMPT_LOG.md
docs/REQ-24_IMPLEMENTATION_EVIDENCE.md
frontend/Dockerfile
frontend/package.json
frontend/src/App.tsx
frontend/src/DiagramEditor.tsx
frontend/src/Sidebar/Sidebar.tsx
frontend/src/Sidebar/SidebarPanels.tsx
frontend/src/Sidebar/sidebarApi.ts
frontend/src/UserManagement.tsx
frontend/src/access.test.tsx
frontend/src/access.tsx
frontend/src/authApi.ts
frontend/vitest.config.ts
package-lock.json
package.json
scripts/security.test.mjs
scripts/test-rbac-db.mjs
scripts/workflow-security.mjs
```

## Bekannte Grenzen, offene Abnahme und reproduzierbare Entscheidungsspur

- Unabhängige Kontrolle, Titus-Freigabe, Remote-CI und Container-/Deploymentnachweise für diesen Commit sind offen. Kein Merge-/Issueabschluss aus Selbstprüfung ableiten. Linux-DB-Stufe und Docker-Policykopie sind versioniert, aber nicht extern als ausgeführt belegt.
- Global eindeutige E-Mails erzwingen einen generischen Anlagekonflikt. Fremde/unbekannte Nutzer-IDs und Companylisten sind geschützt; die Belegung einer E-Mail kann über Anlagekonflikte erkennbar bleiben. Ein vollständiger Schutz vor E-Mail-Verfügbarkeitsabfragen würde einen gesonderten verifizierenden Registrierungs-/Einladungsprozess benötigen. Diese Grenze ist eine offene Datenschutz-/Scopebewertung für die Kontrolle, kein als gelöst ausgegebener Vollschutz.
- Erstadmin-Auswahl nach Zeit/ID ist technisch deterministisch und gegen Lockout getestet; die fachliche Identität des zuständigen Admins muss vor einer echten Bestandsmigration geprüft werden. Unbekannte Altrollen müssen explizit remediiert werden. Kein automatischer Down-/Datenrollback.
- Die Company-Lock-Invariante gilt für die neuen Anwendungsoperationen; direkte DB-Administration kann sie umgehen. Sonstige Full-State-Writes, Caches und Parallelitätsrisiken des vorhandenen Fachmodells bleiben außerhalb dieser Änderung.
- UI-Rendering und Statusverhalten sind automatisiert getestet; keine komplette Browser-E2E-/Accessibility-/Usability-Abnahme. Tokens bleiben im Browser-Storage, Logout stateless, in-flight Aktionen nicht rückwirkend widerrufen. Kein OIDC, Passwortreset oder Nutzerlöschen; Rate-Limits sind ohne gemeinsamen Store nicht clusterweit.
- Konkrete Professorengründe und allgemeine Wartbarkeit sind nicht erhoben. Die belegte Strukturwirkung ist enger: zentraler Grantkern, geprüftes Routeninventar, gemeinsame Hashpolicy und reale Auth-Transaktionstests. Entscheidungsalternativen: ADR. Auftrag/Folgeanweisungen: `PROMPT_LOG.md`. Fehlversuche/Korrekturen/KI-Anteil: `AI_REFLECTION_LOG.md`.

Primärquelle: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), am 19.10.2026 gelesen. Unterstützt Least Privilege, Deny by Default, Requestprüfung und Tests; ist keine Abnahme dieses Codes.

## Nachkorrektur der Komponenten-Leseansicht am 23.10.2026

Ein manueller Viewer-Test in Staging zeigte interne Komponentenfelder wie `id` und `componentTypeId` sowie das ungegliederte `properties`-Objekt. Ursache war der generische Read-only-Fallback in `SidebarPanels.tsx`, der Entitäten mit `Object.entries` und Objektwerte per `JSON.stringify` ausgab. Die betroffenen Daten waren für Viewer bereits regulär lesbar und company-gefiltert; belegt ist daher ein Darstellungsfehler, kein zusätzlicher Autorisierungs- oder Tenant-Durchbruch.

Die Komponentenansicht löst den Typnamen nun über die vorhandenen Komponententypen auf, zeigt Beschreibung und Eigenschaften mit fachlichen Bezeichnungen und behält verknüpfte Verbindungen und Diagramme bei. Interne IDs werden in dieser Ansicht nicht mehr ausgegeben. Ein SSR-Regressionstest prüft die fachlichen Werte sowie die Abwesenheit von `componentTypeId`, eines `id`-Feldes und der Schreibaktion.

Lokaler Nachweis dieses noch nicht unabhängig freigegebenen Nachkorrekturstands: gezielter Frontendtest **10/10**; vollständiges `npm run check` mit Lint und Typecheck erfolgreich, **88 Backendtests bestanden und 7 übersprungen**, **10 Frontendtests bestanden**, beide Builds erfolgreich, 112 Compose-, 169 Workflow- und 17 Securityprüfungen bestanden. `git diff --check` war sauber. Remote-CI, Aktualisierung von PR #90 und erneute Staging-Bereitstellung sind zu diesem Zeitpunkt offen.

## Nachkorrektur der Rollen- und Viewpoint-Bedienung am 25.10.2026

Der Screenshotbefund entstand durch die Kopplung des Diagrammselectors an den gespeicherten Viewpoint. Eine engere Auswahl löste einen PATCH aus, validierte das vollständige Diagramm gegen den engeren Viewpoint und konnte fehlschlagen. Danach stand die Auswahl wieder auf dem gespeicherten Wert, während die Fehlermeldung des fehlgeschlagenen Viewpoints sichtbar blieb.

Der finale Produkt-/Testcode der Viewpoint-Korrektur `74aa718ee61bcaaed4a4cefe18341b99aa2ef5c0` trennt diese Konzepte:

- RBAC-Rollen bestimmen Benutzeraktionen und API-Rechte. Nur Admins verwalten Nutzer und Rollen; Architects bearbeiten Architektur und Diagramme; Viewer lesen.
- Viewpoints sind lokale Diagrammprojektionen für Zielgruppen. Der Selector speichert nichts und bleibt für Viewer verfügbar.
- Projektionen enthalten nur Komponenten und Beziehungen, die durch Viewpoint und Metamodellregeln erlaubt sind. Unbekannte, verbotene und regellose Beziehungen werden entfernt.
- Abweichende lokale Projektionen sind schreibgeschützt. Begonnene Interaktionen werden verworfen; jeder direkte Diagramm-Schreibaufruf läuft zusätzlich durch `runIfDiagramWritable`.
- Der produktiv verwendete Verbindungszustand und Knotenklickpfad sind gegen den Ablauf Start -> lokale Vorschau -> Zielklick sowie gegen einen stale Handler-Aufruf abgesichert.

Der kanonische Fresh-Company-Starter wurde in der unabhängigen Kontrolle ohne Fehler oder Warnungen durch alle fünf EAM-Viewpoints projiziert: Management 4/2, Business Owner 4/3, Application Owner 4/3, IT Operations 3/2 und Full Architecture 7/7 Komponenten/Beziehungen.

Nach einer sauberen Neuinstallation blockierte das Dependency-Gate wegen einer neuen High-Einstufung des transitiven `body-parser` 1.20.8. Commit `1cb2335c55c8873f9880bf60754e3e4e5893fcdf` ändert ausschließlich Version, Registry-URL und Integritätswert dieses Lockfile-Paketknotens auf 1.20.9; dessen Abhängigkeitsliste bleibt unverändert. `npm.cmd ci` installierte 440 und auditierte 443 Pakete ohne Schwachstelle; `npm.cmd run scan:dependencies` meldete null Findings in allen Schweregraden.

Finale Selbstprüfung auf `1cb2335c`: `npm.cmd run check` erfolgreich mit **88 bestandenen Backendtests und 7 übersprungenen**, **21 bestandenen Frontendtests**, Lint, beiden Typechecks und beiden Produktionsbuilds, **112 Composeprüfungen**, **169 Workflowprüfungen**, **17 Securityprüfungen** und Prisma-Konfigurationsprüfung. Ein einmaliger früherer Vitest-Workerabbruch war nicht reproduzierbar; der betroffene RBAC-Test bestand separat 14/14 und der vollständige Wiederholungslauf vollständig.

Der unabhängige Kontrollchat `01a1699f-2854-7233-8203-0d9326bbddfe` prüfte die Viewpoint-Korrektur und den nachgelagerten Lockfile-Patch jeweils read-only und meldete in beiden Prüfungen keine offenen P0–P3. Push, Remote-CI, Aktualisierung von PR #90, Staging-Deployment, Liveprüfung und Produktion sind für diesen neuen Head nicht belegt.

Die Erstellung dieser Ausarbeitung wurde durch KI unterstützt.
