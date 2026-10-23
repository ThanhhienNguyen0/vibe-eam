# REQ-24 – unabhängiger Kontrollnachweis

**Zeitliche Einordnung:** Dieser unabhängige Kontrollnachweis gilt für die ursprünglichen Commits vom 19.10.2026. Draft-PR #88 meldete am 20.10.2026 danach zwei neue CodeQL-Befunde. Korrektur, lokale Regression und die noch ausstehende erneute Remoteprüfung sind als Fortschreibung in `REQ-24_IMPLEMENTATION_EVIDENCE.md` dokumentiert; sie werden nicht rückwirkend als Bestandteil dieses früheren Kontrolllaufs ausgegeben.

Stand: **19.10.2026, 22:14 CEST**. Geprüfter Implementierungscommit: `16035678a1f0e813932e10b8f92d60a3e32230f9`; verbindliche Basis: `2f21cfed4e1e56826e2b13590aea9d5649e59050`.

**Urteil:** Die lokale Implementierung ist unabhängig bestätigt. Der Kontrolllauf fand keine P0-, P1- oder P2-Befunde. Ein P3-Dokumentationsblocker wurde durch diesen Nachweis und die eng begrenzten Statuskorrekturen bearbeitet. Push, Remote-CI, Containerausführung, Deployment, menschliche Freigabe, Merge und das Schließen von Issue #56 bleiben offen.

## Prüfinstanz und Trennung

- Unabhängiger Kontrollchat: `01a154a2-d3b0-70c3-9a30-a130659a071d`, Host `local`.
- Implementierungschat: `01a154a2-45c9-78b2-9b0d-3e1fb5d6a623`.
- Modell/Version der Kontrollinstanz: von der App gegenüber dem Implementierungschat nicht ausgewiesen; deshalb wird keine Modellbezeichnung nachträglich behauptet.
- Trennungsmethode: Die Kontrollinstanz war nicht an Retrieval, Analyse, Implementierung oder Dokumentation des geprüften Commits beteiligt. Sie erhielt erst den fertigen lokalen Commit, prüfte ihn in einer getrennten lokalen Kopie gegen die feste Basis und änderte keine Dateien, Branches oder externen Systeme.
- Zeitpunkt: Kontrolllauf und Befundübergabe am 19.10.2026; Dokumentationskorrektur begonnen um 22:14 CEST.

## Eingaben und Prüfgegenstand

Eingaben waren der vollständige Commit `16035678`, die Basis `2f21cfed`, Issue #56 und seine sechs Prüfbereiche, die Rollen-/Routen- und Angriffsmatrix, Migration und Seed, die in `REQ-24_IMPLEMENTATION_EVIDENCE.md` dokumentierte Claim-Evidence-Zuordnung sowie die dort benannten lokalen Prüfbefehle. Als Sicherheitsorientierung diente das [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Die gewünschte Schlussfolgerung oder interne Entwurfsbegründungen wurden nicht als Prüfvorgabe übernommen.

## Unabhängig beobachtete Resultate

| Prüfung | Beobachtung der Kontrollinstanz |
|---|---|
| Installation | `npm ci`: 438 Pakete installiert, 441 auditiert, 0 Vulnerabilities |
| Gesamtgate | `npm run check`: Exit 0; 85 Backendtests, 9 Frontendtests, Build, 112 Compose-, 169 Workflow- und 17 Securityprüfungen |
| Gezielte Auth-/RBAC-/Seed-Tests | 25/25 bestanden |
| PostgreSQL-14-Isolation | 7/7 bestanden; Migration, Seed, Rollen-/Tenant- und Konkurrenzverhalten eingeschlossen |
| Dependency-Audit | 0 Findings in allen Severitys |
| Secret-Scan | Canary erwartungsgemäß abgelehnt; 25 in der unabhängigen Kopie verfügbare Commits und 168 aktuelle Dateien ohne echten Fund |
| Git-/Scope-Prüfung | `git diff --check` Exit 0; exakt ein Commit auf Parent `2f21cfed`; 45 Dateien; Dependabot-Änderung `89a8a8e2` nicht enthalten; ursprünglicher REQ-Arbeitsbaum sauber |

## Findings, Entscheidungen und Korrektur

| Priorität | Befund | Entscheidung / Änderung |
|---|---|---|
| P0–P2 | Kein Befund in Code, Migration, Seed, Rollenmatrix oder lokaler Testausführung | Lokale technische Umsetzung unabhängig bestätigt |
| P3 | Statusdokumente bezeichneten die unabhängige Kontrolle nach ihrem Abschluss weiterhin als offen; ein eigener Auditdatensatz fehlte | Diese Datei ergänzt Zeit, Instanz, Trennung, Eingaben, Resultate, Befund, Entscheidung und Grenzen. Betroffene Statussätze werden auf den bestätigten lokalen Stand korrigiert |

Die Dokumentationskorrektur verändert keinen Produktcode und keine Tests. Ihr lokaler Commit `4193adb26bd570ab178aa2659586166a011663a0` wurde derselben Kontrollinstanz zur reinen Dokumentationsnachprüfung vorgelegt.

## Dokumentationsnachprüfung

Die Kontrollinstanz meldete die Nachprüfung am **19.10.2026 um 22:18 CEST** abgeschlossen. Sie bestätigte den Parent `16035678`, ausschließlich die angekündigten acht Dokumentationsdateien im Diff, keine Änderung außerhalb `docs` und eine saubere Prüfung mit `git diff 16035678..4193adb --check`. Der Reviewdatensatz enthält nach ihrem Urteil Trennung, Zeitpunkt, Inputs, unabhängig reproduzierte Ergebnisse, den P3-Befund samt Korrektur und die exakte Secret-History-Grenze. Die Statusaussagen trennen lokale unabhängige Bestätigung von Push, Remote-CI, Containerausführung, Deployment und menschlicher Freigabe. Entscheidung: P3 geschlossen; im lokal geprüften Umfang vollständig erfüllt und keine offenen P0–P3. Empfehlung: Push und anschließender Draft-PR erst nach Titus' separater Freigabe; kein Merge und kein Schließen von Issue #56. Remote-CI-, Container- und GitHub-Nachweise bleiben nach einem Push separat zu prüfen.

## Unabhängige Folgekontrolle der CodeQL-Korrektur, 20.10.2026

Eine saubere Review-Subinstanz, die weder die CodeQL-Korrektur noch ihre Dokumentation erstellt hatte, prüfte den lokalen Commit `f8704e48cbf0e387424417896028fbc8be242940` read-only gegen den aktuellen PR-Stand. Eingaben waren der Commitdiff, die beiden Advanced-Security-Befunde, der dokumentierte Nginx-/Compose-Pfad und die ausführbaren Authregressionen. Die gewünschte Schlussfolgerung wurde nicht vorgegeben.

| Priorität | Befund | Entscheidung / Änderung |
|---|---|---|
| P1 | Vertrauen in alle Loopback-/privaten Proxyadressen konnte bei privaten Proxyketten manipulierbare `X-Forwarded-For`-Werte als Client-IP übernehmen | Express vertraut exakt einem Hop; alle dokumentierten Nginx-Konfigurationen überschreiben den Header; der lokal veröffentlichte Backend-Port bindet an Loopback |
| P2 | Das allgemeine Requestlimit lag hinter dem 2-MB-JSON-Parser | Allgemeiner Limiter läuft vor `express.json()` |
| P2 | `skipSuccessfulRequests` galt für den gesamten Authrouter; erfolgreiche Registrierungen zählten daher nicht zum engeren Limit | Eigener Registrierungslimiter mit zehn gezählten Versuchen; separater Loginlimiter mit 20 fehlgeschlagenen Versuchen |
| P3 | Das Promptprotokoll bezeichnete die Veröffentlichung der lokalen Korrektur vor dem Push als bereits umgesetzt | Status auf beauftragt und lokal in Korrektur geändert |

Die neuen Regressionen halten die tatsächliche rechte Client-IP konstant, verändern aber den nicht vertrauenswürdigen linken Headerwert. Damit sind weder Login- noch Registrierungslimit durch links vorangestellte Werte umgehbar; eine erfolgreiche Registrierung zählt ausdrücklich. Der erste Testentwurf ordnete den erfolgreichen Registrierungsrequest wegen fehlendem Header einem anderen Bucket zu und scheiterte erwartungsgemäß 400 statt 429. Nach Korrektur des Testaufbaus bestanden Auth 12/12, RBAC 14/14 und die statische Composeprüfung 112/112.

Die Kontrollinstanz prüfte anschließend den finalen Commit `11be5f86a7d943bc0c469f811e84ec6bf4bf89cb` read-only und bestätigte die technische Schließung aller früheren P1-/P2-/P3-Befunde ohne neue P0–P2-Code- oder Konfigurationsbefunde. Sie wiederholte Auth 12/12 und Compose 112/112 und bestätigte einen sauberen inkrementellen Diff. Als einziger P3 blieb die pauschale Aussage, alle Matrixbeobachtungen stammten vom 19.10.2026, obwohl die Fortschreibung vom 20.10.2026 enthalten ist. `REQ-24_IMPLEMENTATION_EVIDENCE.md` begrenzt diese Datierung nun auf den historischen Teil und datiert die Fortschreibung ausdrücklich. Entscheidung: P3 geschlossen; keine offenen P0–P3 im unabhängig geprüften lokalen Korrekturstand. Remote-CI/CodeQL werden erst nach dem Push separat belegt.

## Aussagegrenzen

Die Selbstprüfung sah 43 lokal verfügbare Commits, die getrennte Kontrollkopie 25; beide Secret-Scans waren fundfrei. Daraus folgt kein Nachweis der vollständigen Remote-Historie. Dieser ist erst nach Push und erfolgreichem Remote-CI-Lauf belegbar. Ebenso offen bleiben Browser-E2E, tatsächliche Containerausführung, produktive Migration und Seed-Ausführung, Bootstrapadmin-Prüfung, GitHub-Branch-/Security-Einstellungen, Deployment und menschliche Freigabe. Das Urteil bezieht sich ausschließlich auf den lokal geprüften Commit und belegt keine allgemeine Wartbarkeit oder Produktionsreife.

Die Erstellung dieser Ausarbeitung wurde durch KI unterstützt.
