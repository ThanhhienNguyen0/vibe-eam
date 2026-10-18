# Dependency-Risiken und Entscheidungen – REQ-30

Stand: 18.10.2026. Erfasst mit npm-Audit gegen die npm-Registry; Meldungszahlen sind betroffene Pakete einschließlich transitiver Meta-Befunde, keine Zahl unabhängig ausnutzbarer Lücken. Vollständige Rohbefunde liegen in `evidence/`. Der Vergleich ist datiert und kein dauerhafter Sicherheitsbeweis.

## Vorher und Nachher

| Kommando | Ausgang `3f5e9e40` | Endstand REQ-30 |
|---|---|---|
| `npm audit --json` | 20: 4 kritisch, 9 hoch, 6 moderat, 1 niedrig | **0**, alle Schweregrade 0; `evidence/audit-after.json` |
| `npm audit --omit=dev --json` | 15: 1 kritisch, 9 hoch, 4 moderat, 1 niedrig | **0**, alle Schweregrade 0; `evidence/audit-runtime-after.json` |
| `npm audit fix --dry-run --json` | Ausgeführt **vor** Änderungen; npm gab Änderungszeilen vor dem JSON aus | Unverändert als `evidence/audit-fix-dry-run.txt` gespeichert |

`npm audit fix --ignore-scripts` wurde nach dem Probelauf ohne `--force` angewendet. Der kompatible Zwischenstand enthielt noch 10 Meldungen (2 kritisch, 5 hoch, 3 moderat); danach wurden die folgenden Werkzeugentscheidungen einzeln getroffen. Das Erstversagen der Audit-Abfrage durch `ENOTFOUND` in der Sandbox war kein Nullbefund; die drei Ausgangsabfragen wurden mit Netzwerkzugriff wiederholt.

## Exposition und Behandlung sämtlicher Ausgangsgruppen

| Ausgangspakete (höchste gemeldete Schwere) | Exposition / Grenze | Entscheidung und Beleg |
|---|---|---|
| `proxy-addr` kritisch; `body-parser`, `qs` moderat | Express-HTTP-Pfad; potenziell durch Requestdaten erreichbar. Testwerkzeuge nutzen teilweise dieselben Pakete | Kompatible Auflösung aktualisiert Express/Bodyparser/Queryparser. Auth-/API-Tests und voller Audit sind Pflicht; `npm ls`/Lockdatei zeigen tatsächlich installierte Versionen |
| `shell-quote` kritisch | Entwicklungsstart über concurrently; nicht als eigener HTTP-Endpunkt verwendet, aber im bisherigen Backend-Image mitkopiert | Kompatibler Fix durch Audit/Neurauflösung; keine pauschale Runtime-Entwarnung wegen dev-Klassifikation |
| `vitest`, `tinypool` kritisch; `vite-node` moderat | Test-Runner/Worker und ggf. Test-UI; CI nutzt `vitest run`, kein absichtlich geöffnetes Test-UI. Kompromittierte Werkzeuge können dennoch CI-Code ausführen | Vitest 1.6.1 → 5.0.5 entfernt den alten Worker-/Vite-Node-Baum. Offizielle Migrationshinweise geprüft; Node-22-Typen ergänzt, Sammlung auf `src/**/*.test.ts` begrenzt. Kein Weglassen oder Abschwächen der fachlichen Tests |
| `vite` hoch; `esbuild` moderat/niedrig | Entwicklungs-/Buildserver, besonders Windows-Dateizugriff; Vite bisher als Frontend-dependency klassifiziert. Kein Vite-Server im Nginx-Runtime-Image, aber Build-Lieferkettenrisiko | Vite 5 → 7.3.7, React-Plugin 4 → 5.2.0; bestehende Vite-Konfiguration bleibt gültig. Vollständiger Build und Testlauf erforderlich; spätere kompatible Auflösung aktualisiert esbuild |
| `@babel/core` niedrig; `baseline-browser-mapping` moderat; `browserslist`, `nanoid`, `postcss`, `source-map-js` hoch | Frontend-Transformation, CSS, Browserdaten; npm-Runtime-Klassifikation bildet tatsächliches Hosting nicht vollständig ab | Kompatible Versionen innerhalb bestehender Ranges neu aufgelöst; Lockdatei statt pauschaler Major-Wechsel |
| `yaml` moderat | Repository-Validatoren lesen versionierte Compose-/Workflow-Dateien; CI-Tooling, nicht direkt öffentlicher Backend-Endpunkt | Kompatible Aktualisierung, Validatoren erneut ausführen |
| `prisma`, `@prisma/config`, `deepmerge-ts`, `effect` hoch | Prisma-CLI-Konfiguration/Generierung/Migration; CLI läuft auch beim Backend-Containerstart. Ein HTTP-RPC-Pfad über Effect oder rekursive fremde Prisma-Konfiguration ist im Repository nicht nachgewiesen. Das ist keine Garantie fehlender Ausnutzbarkeit | Prisma und Client gemeinsam 6.19.0 → 6.19.3; dieser Patch aktualisiert Effect auf 3.21.0. Deepmerge-Fix separat unten. Kein Prisma-7-Datenpfadumbau und keine Audit-Suppression |

## Einzelbegründung der Major-Änderungen

- **Vite 7 / React-Plugin 5 im Frontend und Vite 8 im Testwerkzeugbaum:** beseitigt die hohe Vite-5-Exposition; Plugin-Peerrange und Frontend-Build bleiben gemeinsam auf Vite 7.3.7. Vitest 5.0.5 löst unabhängig davon Vite 8.3.4 auf, dessen Peerbereich Vite 6.4, 7 und 8 akzeptiert. Dadurch bestehen bewusst zwei getrennte Werkzeugbäume: der Frontend-Build mit Vite 7/Rollup und der Vitest-Baum mit Vite 8/Rolldown. Node 22 ab 22.13 deckt die Mindestanforderungen beider Linien ab. Risiken: verändertes Build-, Test- und Serververhalten; lokal Typecheck, 69 Tests und Produktionsbuild, CI zusätzlich Linux-/Image-Build, unabhängiger Review.
- **Vitest 5:** die Audit-Fix-Kette für die kritischen Workerbefunde führt zu dieser Linie. Tests, Assertions und fachlicher Scope bleiben erhalten. Neue explizite Testdateigrenze verhindert die zuvor beobachtete doppelte Sammlung von `dist` nach Build. Node-Typen passen zur CI-Linie. Peer-Konflikt wurde regulär behoben, weder `--legacy-peer-deps` noch `--force` verwendet.
- **`deepmerge-ts` 8.0.0 ausschließlich unter `@prisma/config`:** der [Upstream-Sicherheitsfix](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) ist ab 8.0.0 verfügbar. [Releasehinweise](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) nennen verändertes Map-Merging, Metadata-Typen und `deepmergeInto`. Der geprüfte Prisma-Loader verwendet `deepmerge` für Konfigurationsobjekte; Map- oder `deepmergeInto`-Nutzung ist in diesem Aufruf nicht vorhanden. Die exports unterstützen weiterhin Import und Require. Der Root-Override verändert das tatsächlich installierte Paket, keine Auditmeldung. `npm run validate:prisma-config` prüft den echten Prisma-Loader mit verschachtelten Schema-/Migrations-/Seed-Einstellungen. Prisma Generate, Schema-Validierung, Typecheck, 69 Backendtests und Build ergänzen diesen Vertrag. Ein echter DB-Migrations-/Restore-Test wird damit nicht behauptet.

## Striktes Gate und Restverantwortung

`npm run scan:dependencies` prüft **alle** Workspaces einschließlich dev und schreibt den vollständigen Bericht nach `.cache/security/audit.json` (CI-Artefakt auch bei Fehlschlag). **Jedes hohe oder kritische Finding blockiert**, ebenso Ausführungs-, Netzwerk- oder unvollständige Auditantworten. Niedrige/moderate Befunde bleiben sichtbar und benötigen Triage; es gibt keine Allowlist. Regressionstests prüfen die Fail-Schwelle und Fehlerantworten.

Eine befristete Ausnahme für die hohen Prisma-Befunde war erwogen worden. Die automatische Approval-Prüfung lehnte diese ohne explizite menschliche Risikoabnahme ab. Dieser Ansatz wurde verworfen; der finale Code enthält keine solche Ausnahme. Stattdessen wurden die betroffenen Pakete tatsächlich aktualisiert.

Verantwortlich für erneute Prüfung: **Repository-Maintainer** als Rolle, keine erfundene individuelle Risikoabnahme. Termin: **vor Merge und spätestens 01.11.2026**, danach bei jedem Security-Alert sowie wöchentlichen Dependabot-Updates. Der scoped Override ist bei einem kompatiblen offiziellen Prisma-Fix erneut zu bewerten und möglichst zu entfernen. Die physische Übernahme aller Build-/Testpakete ins Backend-Image bleibt ein dokumentierter Architekturrestpunkt (`../MAINTAINABILITY.md`); ein Null-Audit ersetzt keinen Container-OS-Scan.

Die frische Lockauflösung war erforderlich, weil bestehende Root-/Workspace-Installationsartefakte den Override zunächst nicht übernahmen und eine erste unvollständige Neuerzeugung Chai-Typen ausließ. Installationsordner und Zwischenlockdateien wurden ausschließlich innerhalb des Workspaces gesichert. Danach wurde vollständig neu aufgelöst; die Abschlussprüfung muss `npm ci` aus der finalen Lockdatei reproduzieren. npm-10-`npm ls` kennzeichnet den scoped Override korrekt; npm 11 zeigte zwischenzeitlich `invalid`, obwohl die gepatchte Version installiert war. Diese Diagnose wird nicht als bestandener Check gewertet.

Quellen: [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files), [typescript-eslint Setup](https://typescript-eslint.io/getting-started/), [Vitest Migration](https://vitest.dev/guide/migration/), [Vite 7 Migration](https://v7.vite.dev/guide/migration), [Prisma 6.19.3](https://github.com/prisma/orm/releases/tag/6.19.3), [Dependabot-Konfiguration](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference). Auswertung der Advisory-Details: vollständige `audit-before.json` mit direkten GHSA-Links.
