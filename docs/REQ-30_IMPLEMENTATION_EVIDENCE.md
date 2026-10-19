# REQ-30 – Claim-Evidence-Matrix

Stand: **18.10.2026**. Issue: [#62](https://github.com/ThanhhienNguyen0/vibe-eam/issues/62). Basis: `3f5e9e40aa547f780efb44fd4ee821df8274df13`. Branch: `codex/eam/req-30-ci-security`. Interner Implementierungs-/Abnahmebeleg; kein Nachweis wissenschaftlicher Generalisierbarkeit oder Produktionsreife.

**Gesamtstatus: code-seitig bereit, externe Governance offen.** Eine vollständige Erfüllung von REQ-30 wird nicht behauptet. Versionierte Artefakte, beobachtete Ausführungen und aktivierte GitHub-Einstellungen sind unterschiedliche Nachweise. Keine Änderung an `main`, kein Merge und kein Schließen von #62 sind Teil dieser Übergabe.

## Untersuchungsrahmen und Aussagegrenze

Forschungsfrage des Projekts: „Ob und inwiefern ein EAM-Tool mittels KI gevibecodet werden kann.“ Dieser Schritt liefert eine nachvollziehbare technische Implementierung von Qualitäts-/Security-Gates und dokumentiert Grenzen der Wartbarkeit. Primärer Gegenstand sind Repository-Artefakte und deren Prüfverhalten an dieser Revision; führendes Feld ist Software Engineering, mit Wirtschaftsinformatik als soziotechnischem Bezugsrahmen. Beobachtbare Dateien, Toolresultate und Konfigurationen werden als prüfbare Artefakte behandelt; Schlussfolgerungen bleiben empirisch begrenzt und revidierbar. Zielwerte sind Nachvollziehbarkeit, Sicherheit und Wartbarkeit; ihre Auswahl ist eine normative Projektentscheidung.

Methode: kriteriengeleiteter Code-/Dokumentabgleich, offizielle technische Primärquellen, reproduzierbare lokale Prüfungen und getrennte unabhängige Kontrolle. Rolle der KI: Implementierung, Quellenprüfung, Dokumentation und technische Selbstprüfung; kein Ersatz für menschliche Freigabe. Qualitätskriterien sind Reproduzierbarkeit, Claim-Evidence-Zuordnung, sichtbare Fehlversuche und explizite Grenzen. Keine Nutzerdatenstudie, kein kausaler Vergleich „KI gegen Mensch“, keine Messung allgemeiner Wartbarkeit. Echte Credentials werden weder erhoben noch gespeichert. Die konkreten Professorenargumente zur Wartbarkeit fehlen weiterhin; eigene Hotspotbefunde dürfen diese Evidenzlücke nicht ersetzen.

## Kriterienweise Selbsteinstufung

Alle Beobachtungsdaten dieser Tabelle stammen vom 18.10.2026. „Erfüllt (Repository)“ bezieht sich auf Artefakte und lokale Ausführung, nicht automatisch auf externe Durchsetzung.

| Kriterium / Claim | Status | Konkreter Beleg | Prüfkommando / beobachtetes Resultat | Grenzen |
|---|---|---|---|---|
| 1. Lint für TS/React/Node und Scripts | erfüllt (Repository) | `eslint.config.mjs`, Root-Skript `lint`; gezielte Änderungen in Authmiddleware, Server, DiagramEditor und MetamodelView | `npm run lint`, null Fehler/Warnungen im Abschlussprotokoll | Eine begründete lokale Express-Arity-Ausnahme, keine globale Abschaltung; kein Anspruch auf vollständige statische Fehlererkennung |
| 2. Reproduzierbarer lokaler Gate und PR-CI | erfüllt (Repository); Remote-Nachweis separat | `package.json#scripts.check`, `.github/workflows/ci.yml`, `scripts/workflow-security.mjs`, `scripts/validate-workflows.mjs`, `scripts/security.test.mjs` | `npm run check`; Workflow-Validator plus Mutationen erkennen entfernte/bedingte/nichtblockierende Gates | Image-Build und Linux-Ausführung sind zusätzlich auf GitHub zu beobachten |
| 3. Dependency-Sicherheit | erfüllt (Repository) | `docs/security/evidence/audit-*.json`, `audit-fix-dry-run.txt`, `scan-dependencies.mjs`, Dependabot-Konfiguration und `DEPENDENCY_RISKS.md` | Vollaudit vorher 20 / Runtime 15; End-Audit jeweils 0. Hoch/kritisch blockiert ohne Ausnahmen; Fehlerantworten blockieren | Momentaufnahme der Registry; kein OS-/Container-Sicherheitsaudit. Scoped Deepmerge-Major-Fix benötigt fortlaufende Wartung |
| 4a. Statische Analyse | teilweise, Ausführung/Alert-Abnahme separat | `.github/workflows/codeql.yml`: `javascript-typescript`, `build-mode: none`, PR/main/Schedule; minimale Rechte, SHA-Pins | `npm run validate:workflows` prüft Setup; Remote-CodeQL-Lauf separat dokumentieren | Kein lokaler CodeQL-CLI-Lauf; Analyseerfolg allein beweist keine Alertfreiheit |
| 4b. Repository-Secret-Scan | erfüllt (Repository); native Aktivierung offen | `scan-secrets.mjs`, `.gitleaks.toml`, ein überprüfter historischer Fingerprint in `.gitleaksignore`, `SECRET_SCANNING.md` | `npm run scan:secrets`: künstlicher Canary wird abgelehnt; komplette lokale History und aktuelle Dateien bestehen | Kein Nachweis nativer Push Protection; nur gefetchte Refs, musterbasierte Suche |
| 5. Branch Protection und Review | **offen** | `security/GITHUB_ADMIN_CHECKLIST.md`; Repository-Rechte und API-Abfragen | Repo: admin=false; Rulesets `[]`; Protection-API 403. Mindestens ein approving Review sowie vier stabile grüne Checkkontexte sind als Soll dokumentiert | Keine Änderung/Verifikation administrativer Einstellungen möglich; menschliche Mergefreigabe ausstehend |
| 6. Coding-/KI-Guidelines und Wartbarkeit | erfüllt (Repository), externe Freigabe separat | `CONTRIBUTING.md`, `MAINTAINABILITY.md`, `REQ-30_REVIEW.md` | Belegte Datenpfade, Hotspots, Duplikationen, Testlücken, Änderungsregeln, priorisierte Maßnahmen und Evidenzlücke dokumentiert; getrenntes KI-Review fand P2/P3 und prüfte die Korrekturen im dokumentierten Umfang | Keine Professorenaussagen erfunden, keine umfassende Wartbarkeitszertifizierung |
| 7. Forschungs-/Nachweisdokumentation | erfüllt als interner Prüfstand; externe Freigabe separat | Diese Matrix, `REQ-30_REVIEW.md`, `PROMPT_LOG.md`, `AI_REFLECTION_LOG.md`, `EVALUATION_MATRIX.md`, `IMPLEMENTATION_PLAN.md` und Security-Belege | Nachweise datiert; Altangaben zu Auth/Persistenz/Testzahl/aktueller UI gezielt korrigiert; Fehlversuche, unabhängige Befunde und KI-Anteil dokumentiert | Historische Zyklen bleiben als Historie erhalten; externe GitHub-Nachweise erforderlich |
| 8. Abschlussprüfung / Übergabe | siehe Abschlussprotokoll | Finaler Diff gegen Basis, Dateiliste, Commit und PR in der Übergabe | `npm ci`, alle Einzelprüfungen im Gesamtcheck, Security-Scans, drei reale Compose-Checks, `git diff --check`, Status/Diff | Sandbox-Portfehler werden nicht als Fachfehler gewertet; tatsächliche Wiederholung und Restgrenzen dokumentieren |

Die fünf originalen Issue-Kriterien werden damit abgebildet: PR-Qualität → 1/2; Dependency-/Secret-Scanning → 3/4b; statische Analyse → 4a; Branch Protection → 5; Coding Guidelines → 6. Der Originalpunkt „Dependency-Scan und Secret-Scanning aktiv“ bleibt wegen der unbestätigten nativen Einstellungen insgesamt teilweise.

## Tatsächlich beobachtete Prüfungen

Sequenzieller Abschlusslauf am 18.10.2026 unter Windows, Node 24.15.0/npm 11.12.1; `npm ci` erfolgreich, danach `npm run check` Exit 0. Der Testteil lief wegen der zuvor beobachteten EACCES-Testportbeschränkung außerhalb der Codex-Sandbox. CI/Docker verwenden Node 22; deren Linux-Ergebnis ist getrennt zu beobachten.

| Prüfung | Tatsächlich beobachtet |
|---|---|
| `npm ci` | 438 Pakete installiert, Audit 0; Exit 0 |
| `npm run lint` | Exit 0, keine Fehler/Warnungen |
| `npm run typecheck` | Backend und Frontend Exit 0 |
| `npm test` | 7 Testdateien, **69/69 Tests bestanden**; keine kompilierten Doppeltests |
| `npm run build` | Backend-TS und Frontend Vite 7.3.7 erfolgreich; 1.751 Module transformiert |
| `npm run validate:compose` | **111** statische Prüfungen bestanden; kein Containerstart behauptet |
| `npm run validate:workflows` | **156** Prüfungen bestanden (Ausgang 104) |
| `npm run test:security` | Zunächst 13/13; nach unabhängig gefundenen und korrigierten P2-/P1-Befunden **15/15** einschließlich inkonsistenter Auditantworten und eines nicht ausführbaren CodeQL-Tagobjekt-SHA bestanden |
| `npm run validate:prisma-config` | Echter Prisma-Loader mit Deepmerge 8: Schema-, Migrations- und Seed-Einstellungen korrekt |
| `npm run check` | Alle obigen Schritte einschließlich Clientgenerierung sequenziell bestanden; Exit 0 |
| `npm run scan:dependencies` | Vollaudit einschließlich dev **0**; strikte High-/Critical-Schwelle, Exit 0 |
| `npm audit --omit=dev --json` | **0**, alle Schweregrade 0 |
| `npm run scan:secrets` | Canary absichtlich erkannt (Exit 1 erwartet), History und aktueller Snapshot danach ohne ungeklärten Fund (Exit 0) |
| Prisma-Schema-Validierung | `prisma validate` mit künstlicher lokaler DATABASE_URL ohne Zugangsdaten: Schema gültig; keine Verbindung/Migration ausgeführt |
| Drei reale Compose-Konfigurationen | Lokal/Staging/Produktion jeweils `docker compose --env-file .env*.example -f docker-compose*.yml config --quiet` Exit 0; Docker 28.1.1, Compose 2.35.1 |
| Lokaler Image-Build | Ausgeführt, **durch nicht gestartete Docker-Linux-Engine blockiert** (`dockerDesktopLinuxEngine`-Pipe fehlt); kein bestandener lokaler Image-Build behauptet. Bleibt PR-CI-Gate |
| Diff/Status | `git diff --check` ohne Whitespacefehler; finaler Basisdiff und Dateiliste werden mit Commit/PR übergeben |

Die versionsgebundenen Audit-Rohberichte stehen unter `security/evidence/`; die Endberichte enthalten keine Suppression. Das lokale Null-Audit beweist weder Container-OS-Sicherheit noch native GitHub-Schutzregeln. Die Prisma-CLI meldet weiterhin die bestehende Deprecation von `package.json#prisma`; ein Prisma-7-Konfigurationsumbau ist außerhalb dieses Requirements.

## Fehlversuche und Grenzen

1. Branchanlage innerhalb der Sandbox war durch schreibgeschützte Git-Metadaten blockiert; anschließend autorisiert auf dem Feature-Branch angelegt. `main` blieb unverändert.
2. npm-Audit zunächst `ENOTFOUND` in der Netzwerksandbox; mit Netzwerkzugriff wiederholt. Kein Nullbefund aus dem Fehler abgeleitet.
3. Erster Vitest-5-Installationsversuch: Node-Typen-Peerkonflikt; regulär auf Node-22-Typen angepasst. Kein Force-/Legacy-Peer-Flag.
4. Erster Vitest-Lauf sammelte kompilierte `dist`-Tests zusätzlich (138 statt 69), darunter fehlende JSON-Assets in `dist`; durch explizites `src/**/*.test.ts` behoben. EACCES auf lokalen Auth-Testports getrennt dokumentiert; Testlauf außerhalb der Sandbox erforderlich.
5. Ein Testzwischenlauf ohne generierten Prisma-Client scheiterte; `check` generiert den Client nun selbst. Schema-Validierung ohne `DATABASE_URL` lieferte erwartbar P1012; kein DB-Fehler behauptet.
6. Befristete Audit-Ausnahmen für hohe Prisma-Befunde wurden von der automatischen Approval-Prüfung mangels expliziter Risikoabnahme abgelehnt. Sie wurden nicht umgesetzt. Finale Lösung: tatsächliche Patch-/Werkzeug-/scoped Dependency-Updates und striktes Gate ohne Suppressions.
7. npm übernahm den neuen Override aus bestehenden Installationsartefakten zunächst nicht; eine erste Neuerzeugung mit verbliebenen Workspace-Ordnern ließ Chai-Typen aus. Vollständige Neuauflösung aller Installationsbäume und Lockdatei behob dies. Ein parallel zur Neuinstallation gestarteter Prüfzwischenlauf sah zeitweise fehlende ESLint-/Typdateien und ist ungültig; ausschließlich der nachfolgende sequenzielle Abschlusslauf zählt.
8. Erste künstliche Scannerkennung war zu offensichtlich und wurde von Defaultregeln nicht erkannt; durch eine zur Laufzeit zufällig erzeugte künstliche GitHub-Tokenstruktur ersetzt. Das verlangte negative Canaryresultat verhindert einen unbemerkt unwirksamen Scan.
9. Historischer NestJS-Starterbadge als Secretfehlalarm verifiziert; kombinierte Zeilen-Allowlist griff im Historylauf nicht. Ausschließlich ein unveränderlicher Commit-/Pfad-/Regel-/Zeilenfingerprint wird ausgenommen. Kein echter Schlüssel gespeichert oder ausgegeben.
10. Die unabhängige Kontrolle reproduzierte eine Fail-Closed-Lücke bei inkonsistenten Audit-Metadaten/fehlenden Severitys. Der finale Parser prüft nun vollständige numerische Counts, Gesamtzahl, Objektform und erlaubte Severitys. Gezielte Wiederholungsprüfung: Lint, 14 Securitytests, 156 Workflowprüfungen und echter Null-Audit bestanden. Details und verbleibende Findings im Reviewprotokoll.
11. Die unabhängige Kontrolle fand zusätzlich eine falsche Dokumentationsaussage zur Vite-Auflösung. Die Lockdatei enthält zwei getrennte Werkzeugbäume: Frontend Vite 7.3.7 mit Rollup sowie Vitest 5.0.5 mit Vite 8.3.4 und Rolldown. Die Risikodokumentation wurde korrigiert; kein ausführbarer Code wurde hierfür geändert. Der Reviewlauf endete anschließend wegen des Kontingentlimits der getrennten Instanz, weshalb diese rein dokumentarische Korrektur lokal gegen die Lockdatei geprüft wurde.
12. Der separate Kontrollchat stellte fest, dass der zunächst gepinnte CodeQL-v4-Wert ein annotiertes Git-Tagobjekt statt eines Commits war. Der offizielle v4-Ref wurde über die GitHub-Git-API bis zum tatsächlichen Commit `6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee` aufgelöst. Workflow, Validator und Negativtest wurden korrigiert; der echte CodeQL-Lauf bleibt PR-Nachweis.

## Externe offene Abnahme

Native Secret scanning und Push protection, tatsächlich wirksame main-Protection mit Review/Required Checks, CodeQL-Alerttriage und menschlich verantwortetes Review. Adminschritte und Belegfelder: `security/GITHUB_ADMIN_CHECKLIST.md`. Dokumentation dieser Punkte ist ausdrücklich kein Aktivierungsnachweis. Das prozessunabhängige KI-Review ist mit seinen Grenzen in `REQ-30_REVIEW.md` protokolliert.

Die Erstellung dieser Ausarbeitung wurde durch KI unterstützt.
