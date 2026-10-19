# Beitragen zum EAM-Forschungsprototyp

## Ziel und verbindlicher Ablauf

Untersucht wird, ob und inwiefern ein EAM-Tool mittels KI gevibecodet werden kann. Funktionsumfang, Wartbarkeit und nachvollziehbare Entscheidungen sind Ergebnisse dieses Experiments. Es gibt keinen Anspruch auf Produktionsreife.

**Prompt/Requirement → Implementierung → unabhängige Kontrolle → Evidenz → Merge.** Ein plausibler KI-Output genügt nie als Abnahme. Implementierung und unabhängige Kontrolle müssen getrennte Kontexte verwenden. Die Kontrollinstanz erhält Requirement, finalen Diff, Prüfprotokoll und Quellen; sie prüft auch Gegenargumente und fehlende Evidenz. Menschliche Verantwortung bleibt beim freigebenden Maintainer.

## Setup

Node.js 22 ab 22.13 (CI/Docker: Node 22) oder eine in `package.json` zugelassene neuere Linie, npm ab 10, Git; für Infrastrukturchecks Docker Compose. PostgreSQL wird für den normalen authentifizierten Datenpfad benötigt.

```sh
npm ci
npm run db:generate --workspace backend
npm run check
```

Für den lokalen Betrieb `.env.example` in eine ignorierte `.env` kopieren, eigene starke lokale Zugangswerte setzen und `docs/DEVELOPER_SETUP.md`, `docs/AUTH.md` sowie `docs/DOCKER_SETUP.md` beachten. `.env` wird durch npm nicht automatisch in jeden Prozess geladen. Der Backend-Prozess benötigt insbesondere `JWT_SECRET` und die passende `DATABASE_URL`; alternativ den dokumentierten Compose-Stack verwenden. Echte Zugangswerte niemals in ein Issue, einen Prompt oder ein Prüfprotokoll kopieren.

## Branch und Pull Request

1. Sauberen Basisstand und Issue-Akzeptanzkriterien festhalten. Feature-Branch anlegen; Standardpräfix `codex/eam/`.
2. Kleine, fachlich zusammenhängende Änderungen; keine fremden Änderungen überschreiben. Keine Force-Pushes, keine direkten Änderungen an `main` als normaler Ablauf.
3. Lokal `npm run check`, `npm run scan:dependencies` und `npm run scan:secrets` ausführen. Der Secret-Scan benötigt vollständige Git-Historie und beim ersten Lauf Netzwerkzugriff. Windows: gegebenenfalls `npm.cmd` verwenden.
4. Zusätzlich alle drei realen Compose-Konfigurationen mit den jeweiligen `.env*.example` und `config --quiet` prüfen. CI baut beide Images. Ein statischer Validator ersetzt weder den Image-Build noch einen Datenbank-Integrationstest.
5. PR gegen `main`: Requirement, beobachtetes Vorher/Nachher, vollständige Prüfresultate einschließlich Fehlern, Daten-/Sicherheitsfolgen und offene Punkte nennen. Bei REQ-30 `Relates to #62`; Issue erst nach unabhängiger Freigabe schließen.
6. Mindestens ein genehmigendes unabhängiges Review, alle erforderlichen grünen Checks und erledigte Reviewgespräche vor Merge. Neue Commits erfordern erneute Prüfung. Konkrete GitHub-Schutzkonfiguration: `docs/security/GITHUB_ADMIN_CHECKLIST.md`.

## Coding- und Sicherheitsregeln

- TypeScript strict beibehalten; Eingaben an API-Grenzen validieren. Authentifizierung und Company-Isolation müssen serverseitig erhalten bleiben.
- UI, API-Vertrag, Domänenvalidierung und Persistenz voneinander unterscheiden. Architekturgrenzen und Restmaßnahmen stehen in `docs/MAINTAINABILITY.md`.
- ESLint deckt beide `src`-Bäume und `scripts/*.mjs` ab, Warnungen blockieren. Keine globalen Regelabschaltungen zum Grünfärben. Jede notwendige lokale Ausnahme muss eng und begründet sein.
- Keine vollständigen States, Passwörter, JWTs oder gerenderten Env-Dateien protokollieren. Bei einem echten Secret-Fund sofort widerrufen/rotieren und den Maintainer vertraulich informieren; das Entfernen der Datei allein genügt nicht.
- Dependency-Änderungen mit Lockdatei. Erst `npm audit fix --dry-run`, dann kompatible Korrekturen. Kein `npm audit fix --force`, keine ungeprüften Major-Upgrades. Neue/hohe/kritische Auditbefunde blockieren nach `scripts/scan-dependencies.mjs`; alle Findings einschließlich dev bleiben sichtbar. Keine Sicherheitsausnahme ohne explizite dokumentierte Risikoabnahme.
- Actions auf Commit-SHA pinnen, Rechte minimieren, keine PR-Ausführung über `pull_request_target` mit fremdem Code und privilegierten Secrets. Tool-Downloads versionieren und vor Ausführung mit festem Hash prüfen.
- Tests sollen Fehlerverhalten, Tenant-Grenzen und fachliche Regeln prüfen, nicht bloß Implementierungsdetails spiegeln. Echte Datenmigrationen benötigen isolierte DB-, Backup-/Restore- und Rollbackprüfung.

## KI-Dokumentation und Definition of Done

- Requirement/Prompt, KI-Anteil, Grenzen, Fehlversuche und Entscheidungen in `docs/PROMPT_LOG.md` und `docs/AI_REFLECTION_LOG.md` dokumentiert.
- Akzeptanzkriterien jeweils mit Datei/Einstellung, Kommando, tatsächlichem Resultat, Datum und Grenze belegt; Bewertung und Implementierungsplan aktualisiert. „Dokumentiert“ bedeutet nicht „extern aktiviert“.
- Alle verpflichtenden lokalen Prüfungen bestanden; nötige Sandbox-Wiederholungen mit Grund protokolliert. `npm run check` generiert den Prisma-Client auch nach einer frischen Installation.
- PR-CI einschließlich Security und CodeQL geprüft; externe Checks/Schutzregeln belastbar nachgewiesen oder ausdrücklich als offene Abnahmevoraussetzung benannt.
- Unabhängige Kontrolle und mindestens ein menschlich verantwortetes genehmigendes Review vorhanden. Kein selbst freigegebener KI-Code.
- Wartbarkeitsfolgen und verbleibende Risiken mit verantwortlicher Rolle und Prüftermin dokumentiert. Keine erfundenen Aussagen über Interviews oder Professorenrückmeldungen.
