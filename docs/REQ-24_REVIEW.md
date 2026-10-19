# REQ-24 – unabhängiger Kontrollnachweis

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

Die Dokumentationskorrektur verändert keinen Produktcode und keine Tests. Ihr neuer lokaler Commit wird derselben Kontrollinstanz zur reinen Dokumentationsnachprüfung vorgelegt; das Ergebnis dieser Nachprüfung wird in der Kontrollspur festgehalten.

## Aussagegrenzen

Die Selbstprüfung sah 43 lokal verfügbare Commits, die getrennte Kontrollkopie 25; beide Secret-Scans waren fundfrei. Daraus folgt kein Nachweis der vollständigen Remote-Historie. Dieser ist erst nach Push und erfolgreichem Remote-CI-Lauf belegbar. Ebenso offen bleiben Browser-E2E, tatsächliche Containerausführung, produktive Migration und Seed-Ausführung, Bootstrapadmin-Prüfung, GitHub-Branch-/Security-Einstellungen, Deployment und menschliche Freigabe. Das Urteil bezieht sich ausschließlich auf den lokal geprüften Commit und belegt keine allgemeine Wartbarkeit oder Produktionsreife.

Die Erstellung dieser Ausarbeitung wurde durch KI unterstützt.
