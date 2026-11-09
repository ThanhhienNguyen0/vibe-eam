# AI Reflection Log

## REQ-26 – Optimistic Locking und Datenbasisrevision (05.–06.11.2026)

### KI-Beitrag und Architekturentscheidungen

KI-gestützt entstanden Migration, Persistenzvertrag, API-Vorbedingungen, Konfliktoberfläche, Mehrprozess-DB-Tests und Nachweisdokumentation. Objektversionen und globale Datenrevision wurden bewusst getrennt: Einzelobjektänderungen dürfen unabhängige Objekte nicht über veraltete Whole-State-Snapshots zurücksetzen; vollständige Importe benötigen dagegen eine atomare Vorbedingung für den gesamten Unternehmensstand. Ein „Bewusst überschreiben“ umgeht die Sperre nicht, sondern wiederholt die Mutation mit der zuletzt vom Server gemeldeten aktuellen Version.

Prozesslokale Caches oder JavaScript-Mutexe wurden als Konkurrenzschutz verworfen, weil mehrere Backendprozesse damit weiterhin verschiedene Wahrheiten besitzen. Komponenten-, Relationen- und Diagrammoperationen arbeiten direkt mit DB-Prädikaten aus Tenant, ID und Version. Der bestehende Whole-State-Writer beansprucht die Company-Revision in derselben Transaktion. Die historische JSONB-Modell-API verwendet eine PostgreSQL-Zeilensperre. Portable REQ-33-Dateien enthalten keine Laufzeitversionen; `schemaVersion`, Metamodellversion und Locking-Version bleiben unterschiedliche Begriffe.

### Tatsächliche Fehlversuche und Korrekturen

- Die neue Arbeitskopie benötigte zunächst ihre gelockten Abhängigkeiten und einen erzeugten Prisma-Client. Ein eingeschränkter Downloadversuch scheiterte an der Ausführungsumgebung; derselbe reproduzierbare Installations-/Generierungsschritt wurde im erlaubten Kontext wiederholt.
- Der erste reale PostgreSQL-Lauf deckte zwei Produktfehler auf: Read-Normalisierung schrieb Zustände zurück und konnte dadurch neuere Daten überschreiben; außerdem bildete der Legacy-GET seinen ETag vor einer möglichen Erstinitialisierung. Read-Pfade wurden schreibfrei gemacht und der ETag wird erst nach der Initialisierung gelesen. Der folgende frische Gesamtlauf bestand.
- Ein zunächst gefundener `docker`-Pfadeintrag war eine unbrauchbare Nullbyte-Datei. Die echte Docker-Desktop-CLI validierte alle drei Compose-Konfigurationen. Die Linux-Engine-Pipe startete nicht; Image-Builds wurden daher nicht ausgeführt und nicht als erfolgreich dokumentiert.
- Parallelitätstests verwenden getrennte Node-Prozesse, eigene Prisma-Clients und eine IPC-Barriere statt Schlafzeiten. Damit wird keine bloß innerhalb eines Prozesses simulierte Konkurrenz als Mehrprozessbeleg ausgegeben.

### Grenzen und erforderliche Kontrolle

Belegt sind lokale statische Prüfungen, Unit-/Frontendtests, echte PostgreSQL-Migrationen und Konkurrenzfälle, Backup/Restore sowie der manuelle Rollback in isolierten Wegwerfdatenbanken. Das Dependency-Gate meldet 10 moderate und keine hohen oder kritischen Befunde; der Secret-Scan bestand einschließlich negativem Canarytest. Nicht belegt sind Container-Image-Build, Remote-CI/CodeQL, Browser-E2E, Staging, Produktion, menschliche Freigabe oder allgemeine Wartbarkeit.

Diese Entwicklerinstanz erteilt keine unabhängige Freigabe. Der unveränderte lokale Commit muss anschließend in einem getrennten, read-only Kontrollkontext gegen Issue #58, Abschlussdokumentation, Claim-Evidence-Matrix und tatsächliche Testausgaben geprüft werden. Erst danach dürfen mit gesonderter Autorisierung Push und PR-Fortschreibung erfolgen. REQ-23 bleibt unberührt.

### Unabhängige Ablehnung von `7c1079e6` und Korrektur

Die getrennte Kontrolle fand drei P1-Bereiche: Unter PostgreSQL `READ COMMITTED` konnten Sidebar-Nutzdaten und Company-Revision aus verschiedenen Snapshots stammen; Whole-State-Writes erhöhten pauschal alle Objektversionen und der zweistufige Create-and-Place-Ablauf konnte eine unplatzierte Komponente hinterlassen; die Legacy-API las Body und ETag getrennt und setzte Importversionen auf 1 zurück. Zwei P2-Bereiche betrafen den nach „Neu laden“ weiter sichtbaren lokalen Draft sowie Testclaims ohne passende Konkurrenzfälle. Der Head wurde nicht freigegeben.

Die Korrektur verwendet `RepeatableRead`, vergleicht bestehende Objektinhalte vor Versionssteigerung, führt Create-and-Place in einer DB-Transaktion aus, liest Legacy-Body und Revision aus derselben Zeile und verwendet die nächste Aggregatrevision als Importversion. Editorinstanzen sind an ID und Revision gebunden. Ein React-Test-Renderer wurde ausschließlich als Testabhängigkeit ergänzt, um Draft-Erhalt, echtes Reload, erfolgreichen Folgesave und wiederholte Überschreibkonflikte am zustandsbehafteten Editor zu prüfen.

Der erste korrigierte DB-Lauf fand keine Produktregression, sondern zwei Test-/Policyfehler: Der neue Endpunkt war durch das deny-by-default Routeninventar erwartungsgemäß 403 und wurde explizit als `architecture:write` klassifiziert; zwölf Testregistrierungen trafen das absichtlich strikte Registerlimit, weshalb jede isolierte Testcompany eine eigene dokumentierte Test-IP verwendet. Danach bestand der frische Lauf. Ein fokussierter HTTP-Testaufruf scheiterte im eingeschränkten Kontext ausschließlich an `connect EACCES 127.0.0.1`; das vollständige erlaubte Gate bestand anschließend einschließlich aller 169 Backendtests.

### Unabhängige Ablehnung von `6cfaec668507865d0b37f835565de7400beab015` und zweite Korrektur

Die getrennte Kontrolle fand zwei P1-Bereiche: Whole-State-Writer sperrten Company→Objekt, während Einzelmutationen Objekt→Company sperrten; außerdem entfernten Komponenten- und Relationskaskaden Diagrammmitgliedschaften ohne Erhöhung der Diagrammversion. Ein P2-Befund betraf die vor dem Write gebildete, veraltete Diagrammversion in der Relation-anlegen-und-platzieren-Antwort. Ein P3-Befund betraf die fehlende vollständige SHA-Bindung und zu weite Kaskadenclaims. Auch dieser Head wurde nicht freigegeben.

Die zweite Korrektur sperrt in sämtlichen Sidebar-Schreibpfaden zuerst die Company-Zeile und erst danach Objekt- oder Diagrammzeilen. PostgreSQL-`P2034` wird in den Optimistic-Locking-Konflikt übersetzt. Vor Komponenten- und Relationslöschungen werden die durch direkte und kaskadierte Mitgliedschaften betroffenen Diagramme bestimmt und in derselben Transaktion versioniert. Die Create-and-Place-Antwort wird aus dem gespeicherten Zustand gebildet.

Die neuen DB-Regressionen warten über `pg_stat_activity` deterministisch auf reale Lockbarrieren für Whole-State gegen PATCH, DELETE und Create-and-Place; sie prüfen Konflikt statt 500 sowie die erwartete Datenrevision und Komponentenanzahl. Unveränderte Auditanzahlen werden in getrennten Kaskaden- und Importkonfliktfällen geprüft. Weitere Fälle prüfen Kaskadenversionen, stale Diagramm-409, Rollback, einen separaten Prozess für Komponenten-DELETE gegen Diagrammupdate und die unmittelbare Wiederverwendbarkeit der zurückgegebenen Diagrammversion. Der isolierte Lauf bestand nach sieben Migrationen mit 31 von 31 Tests. Der erste eingeschränkte Start scheiterte vor Testausführung an `spawnSync initdb.exe UNKNOWN`; der identische Lauf wurde im erlaubten Kontext erfolgreich wiederholt. Das vollständige lokale Gate bestand mit 169 Backend- und 40 Frontendtests. Der erste abschließende Dependency-Scan erhielt im eingeschränkten Kontext eine unvollständige Audit-Antwort und brach gemäß Fail-closed-Regel ab; die Wiederholung mit Registry-Zugriff bestand mit 10 moderaten, 0 hohen und 0 kritischen Befunden. Der commitgebundene Secret-Scan bestand für 78 Commits und 212 Dateien. Drei Compose-Konfigurationen wurden mit der echten Docker-CLI validiert; die Linux-Engine blieb unerreichbar, daher wird weiterhin kein Image-Build behauptet.

## REQ-24 – technische Umsetzung, unabhängige Kontrolle und PR-Fortschreibung (20.10.2026)

Geltung: Implementierungsprotokoll; die ursprüngliche lokale Umsetzung ist unabhängig bestätigt. Maßgebliche Belege sind `REQ-24_IMPLEMENTATION_EVIDENCE.md` und `REQ-24_REVIEW.md`; Draft-PR #88 und sein erster Remote-Lauf existieren. Die beiden dort zusätzlich erkannten CodeQL-Befunde sind lokal korrigiert; der erneute Remote-Lauf des Korrekturcommits, Containerausführung, Deployment und menschliche Freigabe werden separat belegt. Frühere Abschnitte bleiben historische Entwicklungsstände.

### KI-Beitrag und Entscheidungen

KI-gestützt entstanden Policy-/Routenvokabular, frischer Identitätsadapter, Prisma-Enummigration, company-lokale Nutzerverwaltung mit Sperrprüfung, rollenabhängige UI, abgesicherter Demo-Seed, API-/Frontend-/DB-Regressionen sowie die Dokumentation. Es wird kein gemessener menschlicher Zeitanteil und kein allgemeiner Qualitätsvorsprung von KI behauptet. Der Änderungsumfang bleibt auf Auth/RBAC und die für einen reproduzierbaren Seed nachweislich nötige Referenzkorrektur begrenzt.

Entscheidungsalternativen: verteilte Route-Stringchecks, reine UI-Prüfung, acht Stunden autoritative Tokenrollen, zusätzliche Tokenversionsverwaltung und pauschale Hochstufung aller Mitglieder. Gründe und Konsequenzen sind im ADR dokumentiert. Zur Konkurrenzkontrolle wird dieselbe Companyzeile vor Akteursprüfung/Adminzählung gesperrt. Der lokale Identitätsadapter reicht nur interne DB-Rollen weiter; ein späterer OIDC-Adapter darf keine Providerrollen unmittelbar übernehmen.

### Tatsächliche Fehlversuche und Korrekturen

- Der neue verwaltete Worktree lag außerhalb des ursprünglichen Sandbox-Schreibbereichs. Git-/Installationsversuche im Sandboxkontext scheiterten mit fehlendem Worktreezugriff beziehungsweise `EPERM`; die ausdrücklich beauftragten lokalen Operationen wurden im freigegebenen Ausführungskontext wiederholt. Keine destruktiven Git-Befehle und keine Übernahme der Dependabot-Arbeit.
- Zwei Patchentwürfe wurden vor Anwendung durch Format-/Kontextprüfung abgewiesen; danach wurden geordnete, getrennte Änderungen angewandt. Kein daraus abgeleiteter Codeerfolg behauptet.
- Ein Frontend-Propname (`componentId` statt vorhandenem `compId`) wurde durch Typecheck gefunden und korrigiert. Ein Komponententest erwartete einen nicht vorhandenen Tooltiptext; die Erwartung wurde an die belegte vorhandene Beschriftung angepasst, ohne Rollenprüfung zu entfernen.
- PostgreSQL 16 lag nur als Restverzeichnis vor; vorhandene PostgreSQL-14-Binaries wurden für eine separate temporäre Instanz verwendet. Docker war zunächst nicht erreichbar; Docker Desktop wurde im Hintergrund angestoßen, die endgültigen DB-Tests verwenden es nicht. Keine bestehende Datenbank wurde verändert.
- Windows-`pg_ctl` hielt erfasste Ausgabehandles offen, obwohl der Testserver erreichbar war. Der identifizierte Teststarter und nur dessen Cluster wurden gestoppt; Start/Stop verwenden keine geerbten Ausgabepipes mehr.
- Der erste DB-Lauf hatte ein abweichendes Test-Arbeitsverzeichnis; Seed-/Migrationspfade wurden durch explizites Backend-CWD korrigiert.
- Der reale Seed scheiterte reproduzierbar an einer BPMN-Viewpointreferenz: vorhandene Legacy-Beispiele wurden mit einer EAM-only-Definition vermischt. Der Seed verwendet jetzt die bereits getestete konsistente Starterfunktion und erhält bestehende Metamodelle. Beide echten Seed-Durchläufe und drei Rollenlogins werden geprüft.
- Der Migrations-Negativtest sah zunächst Exitcode 0 trotz korrekter Ablehnung/Rollback. Erfasste `psql`-Ausgabe zeigte ignorierte Optionen hinter einer positionalen Datenbank-URL unter Windows. Explizites `-d` vor `-f -`, `-X` und `ON_ERROR_STOP` machen den Fehlerpfad reproduzierbar. Die Migration wurde nicht permissiver gemacht.
- Beim Dockerabgleich wurde die neue Frontend-Quelleinbindung der reinen Policy sichtbar; die kanonische Datei wird nun ausdrücklich in den Frontend-Buildkontext kopiert. Ein lokaler normaler Build allein wäre für diesen Containerpfad kein Beleg gewesen.

### Sicherheitsabwägungen, Wartbarkeit und offene Prüfung

Beobachtbar sind ein zentraler Ort für Grants, eine vollständige inventarisierte Routenzuordnung, gemeinsame Passwortvalidierung/Hashkosten und zusätzliche echte DB-/UI-Vertragstests. Bewertung: Diese Struktur begrenzt konkrete Drift- und Auslassungsrisiken. Eine kausale Verbesserung allgemeiner Wartbarkeit ist nicht gemessen. Große Editor-/Storedateien, zwei Fachmodelle und bestehende Architektur-Persistenzkonkurrenz bleiben erhalten. Konkrete Gründe der Professorenkritik sind weiterhin nicht vollständig übermittelt und werden nicht erfunden.

Vor Produktion sind Backup, Bootstrapadmin-Zuordnung und menschliche fachliche/Sicherheitsfreigabe nötig. 401/403, direkte Requests und echte parallele Herabstufungen wurden lokal und anschließend getrennt kontrolliert; Browser-E2E, OIDC, Passwortreset und Container-/Deploymentausführung sind dadurch nicht belegt. Rate-Limiting ist jetzt lokal regressionsgeprüft, bleibt jedoch pro Backendprozess. Globale E-Mail-Eindeutigkeit bleibt über einen generischen Anlagekonflikt erkennbar; keine fremden Company-/Nutzerinformationen werden zurückgegeben. Ein vollständiger Anti-Enumeration-Registrierungsprozess wäre zusätzlicher Scope. Direkte DB-Administration kann Repositoryinvarianten umgehen. Bereits laufende fachliche Requests werden bei Rollenänderungen nicht rückwirkend abgebrochen.

Getrennter Kontrollprozess: `01a154a2-d3b0-70c3-9a30-a130659a071d` erhielt erst den vollständig selbstgeprüften lokalen Commit. Die Kontrollinstanz fand keinen P0–P2-Befund und meldete als P3, dass Statussätze und eigener Auditdatensatz noch fehlten. `REQ-24_REVIEW.md` sowie die eng begrenzten Statuskorrekturen behoben diesen Dokumentationsbefund; die reine Dokumentationsnachprüfung schloss P3 und meldete im lokal geprüften Umfang keine offenen P0–P3. Keine Selbstfreigabe, kein Push/PR/Merge/Issue-Close.

### PR-CodeQL-Korrekturschleife vom 20.10.2026

Nach Veröffentlichung von Draft-PR #88 waren die GitHub-Actions-Jobs erfolgreich, während GitHub Advanced Security zwei hohe Befunde als eigenen fehlgeschlagenen Check auswies. Die frühere lokale Prüfung hatte diese beiden statischen Sicherheitsbefunde nicht erkannt: Die kompakte E-Mail-Regulärformel konnte auf kontrollierten Eingaben übermäßig lange laufen, und vor der zentralen Autorisierung fehlte ein Requestlimit. Die Korrektur verwendet eine explizit längenbegrenzte lineare E-Mail-Prüfung sowie ein allgemeines und zwei Auth-spezifische IP-Limits vor den geschützten Routen.

Die getrennte Folgekontrolle des ersten Korrekturcommits fand weitere konkrete Randbedingungen: Das Vertrauen in alle privaten Proxyadressen ermöglichte bei privaten Proxyketten manipulierbare Client-IPs; der JSON-Parser lief vor dem allgemeinen Limit; und das Überspringen aller erfolgreichen Authantworten ließ erfolgreiche Registrierungen ungezählt. Daraufhin wurde die tatsächlich dokumentierte Topologie festgeschrieben: genau ein vertrauenswürdiger Nginx-Hop, Überschreiben statt Anhängen von `X-Forwarded-For` und Loopbackbindung des direkt veröffentlichten Backend-Ports. Das allgemeine Limit läuft vor dem JSON-Parser. Registrierung zählt zehn Versuche einschließlich Erfolg, während nur erfolgreiche Logins vom separaten 20er-Login-Limit ausgenommen werden. Regressionstests variieren die nicht vertrauenswürdigen linken Headerwerte bei konstanter tatsächlicher Client-IP. Der Prozessspeicher des Limiters bleibt eine dokumentierte Skalierungsgrenze.

Der Branch wurde mit dem inzwischen fortgeschrittenen `main` zusammengeführt, ohne veröffentlichte Historie umzuschreiben. Die gezielten Tests und das vollständige lokale Gate liefen nach der Korrektur erneut; konkrete Resultate stehen in `REQ-24_IMPLEMENTATION_EVIDENCE.md`. Erst der erneute GitHub-Advanced-Security-Check kann belegen, dass beide Remote-Befunde für den neuen Head geschlossen sind.

Nach `npm ci` wurde einmal ein einzelner Auth-Test direkt gestartet und scheiterte vor der Testausführung, weil die saubere Installation den generierten Prisma-Client erwartungsgemäß nicht enthält. Das ist kein Produktbefund: Das kanonische `npm run check` führt `db:generate` zuerst aus. Dieser vollständige Ablauf wurde direkt aus der sauberen Installation wiederholt und bestand vollständig.

Ein späterer gemeinsamer Zwei-Dateien-Vitest-Aufruf meldete unter Windows einen unerwartet beendeten Worker für `rbac.test.ts` (Exitcode `3221226505`), während die Auth-Datei bestand. Das vollständige Gate war zuvor grün; die beiden Dateien wurden anschließend einzeln wiederholt und bestanden mit 11/11 beziehungsweise 14/14 Tests. Nach der Proxyhärtung wurde der Authumfang auf zwölf Tests erweitert; der erste neue Registrierungstest verwendete für den erfolgreichen Request versehentlich keinen gemeinsamen Proxyheader und erwartete deshalb fälschlich denselben Limit-Bucket. Der Testaufbau wurde korrigiert und bestand anschließend 12/12. Es wurde kein Produktcode verändert, um diese Testfehler zu kaschieren.

## REQ-30 – belegte Selbstprüfung, 18.10.2026

**Geltung:** Frühere Entwicklungszyklen sind historische Aufzeichnungen. Aktuell sind JWT/bcrypt-Authentifizierung und Company-Isolation implementiert, PostgreSQL wird auch für Company-bezogene Legacy-JSONB-Aggregate verwendet, 69 Backendtests bestehen als zu prüfender Umfang. Frühere Impact-/Portfolio-/Heatmap-/Capability-/Lifecycle-UI-Aussagen sind keine Zusage der heutigen Oberfläche. Der datierte Abschlussbeleg ist `REQ-30_IMPLEMENTATION_EVIDENCE.md`.

### KI-Anteil und Wartbarkeitsentscheidungen

ESLint-Konfiguration, PR-/Security-Workflows, Dependabot, Scannerwrapper, Gate-Regressionen und Dokumentation wurden KI-gestützt erstellt. Bestehender Code wurde nur für konkrete Lintbefunde angepasst: Express-Typerweiterung, eine begründete Error-Middleware-Arity-Ausnahme, vollständige React-Hook-Abhängigkeiten und ungenutzte Definitionen. Eine an dieser Stelle unnötige Memoisierung des Drop-Handlers wurde entfernt; kein flächiges eslint-disable oder UI-Neuaufbau erfolgte.

Securitywerkzeuge wurden mit minimalen Rechten und unveränderlichen Revisionen bzw. geprüften Releasehashes eingeführt. Ein vollständiges Null-Audit wurde durch tatsächliche Updates angestrebt, nicht durch Weglassen von dev-Abhängigkeiten. Die automatische Approval-Prüfung lehnte eine erwogene befristete High-Ausnahme ab. Die finale Lösung enthält keine Audit-Allowlist und belässt die Fail-Schwelle auf hoch/kritisch.

### Fehler und Lernbefunde

Peer-Abhängigkeiten, neue Vitest-Dateisammlung, fehlender Prisma-Client nach Neuinstallation, unvollständig wiederverwendete Workspace-Installationsartefakte und eine unwirksame erste künstliche Secretkennung erzeugten konkrete Fehlversuche. Ein Prüfzwischenlauf während einer Installation war durch fehlende Paketdateien ungültig. Konsequenzen: vollständige sequenzielle Abschlussprüfung, explizite Testdateigrenze, Clientgenerierung im Gesamtcheck und verpflichtender negativer Canarytest. Der historische Secretfehlalarm ist anhand der offiziellen NestJS-Vorlage eingegrenzt; nur ein exakter historischer Fingerprint bleibt ausgenommen.

### Verbleibende Grenzen und erforderliche Kontrolle

Die unabhängige Kontrolle fand anschließend einen konkreten P2-Fehler: widersprüchliche Audit-Counts bzw. unbekannte Severitys konnten den zunächst zu schwachen Parser passieren. Struktur-, Severity- und vollständige Countprüfung wurden ergänzt; der reproduzierte Gegenfall und weitere fehlerhafte Antworten sind jetzt negativ getestet. Zusätzlich wurde als P3 eine falsche Dokumentationsaussage zur Vite-Auflösung korrigiert: Frontend Vite 7/Rollup und Vitest mit Vite 8/Rolldown bilden getrennte Werkzeugbäume. Der separate Kontrollchat entdeckte danach als P1, dass der zunächst eingetragene CodeQL-v4-SHA ein annotiertes Tagobjekt und kein ausführbarer Commit war. Der offizielle Ref wurde bis zum tatsächlichen Commit aufgelöst; ein Negativtest verhindert die Regression. Lint, 15 Security-Regressionsprüfungen, Workflowvalidierung und echter Audit wurden nach dieser letzten Korrektur gezielt wiederholt. Diese Befunde belegen den Nutzen der getrennten Kontrolle an diesem Einzelfall, ohne eine allgemeine Wirksamkeitsquote zu begründen.

Build-/Testwerkzeuge liegen bisher physisch auch im Backend-Image; zwei Datenpfade und mehrere große UI-/Store-Dateien bleiben Wartbarkeitsrisiken. Echte PostgreSQL-/Parallelitäts-/UI-E2E-Tests fehlen. Lint, Testzahl und ein Null-Audit ergeben keinen Nachweis allgemeiner Wartbarkeit oder Security-Resilienz. Die Professorenbegründung ist weiterhin unvollständig; es wurde keine kausale Erklärung erfunden.

Unabhängige Kontrolle muss finalen Diff, Anforderungsabdeckung, scoped Deepmerge-Fix, Secretfehlalarm-Triage, Prüfergebnisse und Dokumentationsgrenzen gegenprüfen. Menschliche Freigabe sowie native Secret-/Push-/Branch-Einstellungen bleiben getrennte Abnahmevoraussetzungen. Es erfolgte kein Merge, kein Schließen von #62 und kein Deployment.


## Erfuellte Anforderungen

- Projektstruktur mit `/frontend`, `/backend`, `/docs`, Root `README.md` und Root `package.json`.
- Backend mit Node.js, Express, REST API und JSON-Dateipersistenz.
- Seed-Modell mit 12 Elementen und 12 Relationen.
- React/TypeScript/Vite Frontend.
- React Flow Canvas ist implementiert.
- Eigenschaftenpanel fuer Elementattribute ist implementiert.
- Relationserstellung ueber Formular und Canvas-Verbindung ist implementiert.
- Validierung fuer Relationen, Elemente und Importstruktur ist implementiert.
- Ein explizites EAM-Metamodell ist implementiert.
- Relationen werden semantisch nach Source Type, Relation Type und Target Type validiert.
- Das Metamodell erlaubt nur die sieben im zweiten Zyklus definierten Relationstyp-Kombinationen; direkte Application-to-Capability-Realization ist bewusst nicht erlaubt.
- Impact-Analyse unterstuetzt Downstream Business Impact und Upstream Dependencies.
- Risk-Cost Portfolio Ansicht mit berechnetem Impact Score, Impact Level, Portfolio-Kategorie und praesentationsfaehiger 2x2-X/Y-Bubble-Matrix ist implementiert.
- Canvas-Edges zeigen sichtbare Pfeile und Relationstyp-Labels.
- Filter nach Layer und Elementtyp sowie Risiko-/Kosten-Heatmap sind implementiert.
- Capability Map wird dynamisch aus Modelldaten und Relationen abgeleitet.
- Lifecycle Roadmap wird aus echten Modelldaten erzeugt.
- Historischer Teilnachweis: Der damalige Legacy-JSON-Export und -Import waren für valide Legacy-Modelle roundtrip-fähig; dies belegte weder den aktuellen Sidebar-Zustand noch Schema-Versionierung.
- Audit Log schreibt Eintraege fuer Create, Update, Delete und Import.

## Tatsaechlich Gepruefte Punkte

- `npm install` erfolgreich.
- `npm run typecheck` erfolgreich.
- `npm run build` erfolgreich.
- Frontend HTTP 200 auf `http://localhost:5173`.
- Backend `GET /api/model` liefert 12 Elemente und 12 Relationen.
- Alle geforderten REST-Endpunkte wurden angesprochen.
- Element Create, Patch und Delete funktionieren.
- Relation Create und Delete funktionieren.
- Historischer Teilnachweis: Der damalige Legacy-Import/Export-Roundtrip war modellgleich; Diagramme, aktuelles Metamodell, Kataloge, Tenant-Portabilität und echte PostgreSQL-Writes waren nicht Gegenstand dieses Nachweises.

## REQ-33: vollständiger JSON-Modelltransfer am 04.11.2026

- Die zunächst naheliegende Wiederverwendung von `/api/model` wurde verworfen, weil dieser Pfad das historische Teilmodell statt des aktuellen Editors abbildet.
- Der erste DB-Test zeigte, dass Starter-IDs intern Company-IDs enthalten. Der Vertrag wurde daraufhin auf tenant-neutrale Datei-IDs und deterministische Ziel-Tenant-Materialisierung geändert; die schwächere Annahme „interne IDs direkt exportieren“ wurde nicht beibehalten.
- Kaputte Referenzen werden vor dem bestehenden Writer geprüft. Das ist erforderlich, weil dessen allgemeine Normalisierung verwaiste Instanzreferenzen für normale Laufzeitpfade bereinigt und damit als Datei-Validator zu permissiv wäre.
- Ein PostgreSQL-Trigger erzwang einen Fehler innerhalb der Transaktion. Der unveränderte Export und die unveränderte Auditanzahl danach belegen Rollback statt nur Vorabvalidierung.
- Fehlversuche wurden nicht als Produktdefekte umgedeutet: Sandbox-`ENOTFOUND`, ein PostgreSQL-16-Verzeichnis ohne `initdb.exe`, eine Fixture mit doppeltem Typ-ID-Eintrag, die Verwendung einer portablen ID an einer internen CRUD-Route und fehlender CSV-`sheet`-Parameter wurden jeweils konkret korrigiert.
- Der erste Gesamtcheck löste wegen fehlender Root-Installation ein altes, außerhalb des Worktrees liegendes ESLint 8 auf. `npm ci` stellte den gelockten Repository-Stand her; danach war der einzige echte Lintbefund ein ungenutzter Testimport und wurde entfernt.
- Parallele DB-Testdateien verursachten Last-Timeouts; nach serieller Ausführung überschritt eine bestehende REQ-31-Prüfung einmal das Vitest-Standardlimit von fünf Sekunden. Der gemeinsame DB-Runner verwendet deshalb ein transparentes 30-Sekunden-Einzeltestlimit; fachliche Assertions und die 30-Sekunden-Produkttransaktion blieben unverändert.
- Der lokale Container-Image-Build blieb ein Umgebungsblocker: Docker Desktop war installiert, aber die Linux-Engine-Pipe fehlte und der Systemdienst konnte nicht geöffnet werden. Der Build wird deshalb nicht als bestanden dargestellt.
- Keine Aussage über Remote-CI, CodeQL, Deployment, menschliche Freigabe oder Produktionsreife wird aus lokalen Tests abgeleitet.

### REQ-33-Nacharbeit nach abgelehnter Kontrolle am 05.11.2026

- Die unabhängige Kontrolle gab `6b9201b9…` wegen zwei P1-, eines P2- und eines P3-Befunds nicht frei. Der damalige lokale Grünstand war daher kein Abnahmenachweis.
- Die Entwicklerreproduktion bestätigte alle technischen Befunde: Präfixentfernung kollabierte zwei zulässige Alt-IDs, der Parser akzeptierte eine Relation ohne passende ConnectionRule, und der reale Writer behielt beim Metamodellwechsel den alten Graphen. Die PostgreSQL-Reproduktion zeigte bereits nach dem ersten Wechsel zwei Company-Metamodelle.
- Die Replace-Korrektur löscht ausschließlich frühere Metamodelle derselben Company in derselben Transaktion. FK-Cascades entfernen deren Typen, Regeln, Diagramme und Instanzen; User, Audit und Legacy-Modellpfad bleiben außerhalb. Ein Triggerfehler nach der Löschung bestätigt, dass der gesamte alte Graph samt Audit erhalten bleibt.
- Import und Export verwenden nun die bestehenden Relation-/Diagrammvalidatoren auf dem übergebenen Gesamtzustand. Drei DB-Gegenbeispiele belegen unveränderten Export und unverändertes Audit bei ConnectionRule-, Self-Connection- und Viewpoint-Verstößen.
- Die portable Abbildung gruppiert alle durch Präfixentfernung entstehenden Kandidaten. Der erste Kandidat bleibt lesbar; weitere Kollisionen erhalten deterministische freie IDs. Ein gemischter Altbestand prüft Bijektivität, Referenzen und den Fixpunkt nach Ziel-Tenant-Import.
- Ein erster Testaufruf enthielt `--cache=false` doppelt und scheiterte nur am CLI-Argument; der korrigierte Lauf reproduzierte die zwei Produktfehler. Der erste DB-Aufruf war in der eingeschränkten Prozessumgebung mit `spawnSync ... initdb.exe UNKNOWN` blockiert und wurde identisch mit erlaubter lokaler Prozessausführung wiederholt.
- Der erste korrigierte DB-Lauf fand eine fachlich ungültige Positiv-Fixture, der zweite einen wirkungslosen Viewpoint-Gegenfall bei zwei Komponenten desselben Typs. Beide Tests wurden präzisiert, ohne Assertions oder Produktregeln abzuschwächen; der folgende frische Lauf bestand mit sechs Migrationen und 12/12 DB-Tests.
- Der Secret-Scan-Wert 72 gehörte nicht zum unabhängig geprüften Head; dort wurden tatsächlich 73 Commits geprüft. Erst nach Erstellung des Nacharbeitscommits wurde der neue Wert beobachtet: Canary korrekt abgelehnt, 74 Commits und 203 aktuelle Dateien ohne echten Fund. Der rein dokumentarisch amendierte finale Head wurde danach mit demselben Ergebnis erneut gescannt.
- Nach der Testpräzisierung bestanden 25/25 fokussierte Tests, 12/12 echte DB-Tests und der vollständige Gate-Lauf mit 168 bestandenen/12 übersprungenen Backend- sowie 36/36 Frontendtests. Dependency-Scan und drei reale Compose-Parserläufe bestanden; der erneute Image-Build scheiterte unverändert vor dem Build an der fehlenden Docker-Linux-Engine-Pipe.

### Zweite REQ-33-Nacharbeit nach abgelehnter Kontrolle am 05.11.2026

- Die zweite unabhängige Kontrolle bestätigte die bisherigen vier Korrekturen, lehnte `72364525…` jedoch wegen verlorenem Metamodell-`createdAt` und einer ungeprüften ViewpointRule-Composite-Unique-Regel ab.
- Die Reproduktion zeigte, dass das Problem nicht auf `createdAt` begrenzt war: Prisma ignoriert `undefined` in Updates, wodurch alte nullable Werte in sieben Entitätsklassen erhalten blieben. Der Writer setzt deshalb alle nullable Vertragsfelder explizit auf `null` und übernimmt beide exportierten Metamodellzeitstempel.
- Der Schema-/Prisma-Abgleich fand vier Composite-Constraintklassen im importierten Umfang. ConnectionRule-Tripel und nichtleere externe IDs waren bereits semantisch geschützt, Mitgliedschaften bereits durch `uniqueItems`; ergänzt wurden ViewpointRule-Zuordnungen, ein einheitlicher `MODEL_UNIQUENESS_INVALID`-Fehler und Regressionen für alle Klassen.
- Der erste neue Uniqueness-Test erwartete für Diagrammmitgliedschaften den semantischen Code, obwohl Ajv sie früher mit `MODEL_SCHEMA_INVALID` abweist. Ein weiterer Entwurf verwendete leere externe IDs, die ebenfalls bereits am Schema scheitern. Die Tests wurden auf die tatsächlichen Vertragsgrenzen und doppelte nichtleere externe IDs präzisiert; Produktregeln wurden nicht abgeschwächt.
- Die erste PostgreSQL-Reproduktion bestätigte HTTP 500 für die doppelte ViewpointRule und einen nicht byteidentischen Cross-Tenant-Re-Export mit altem `createdAt` und alten nullable Feldern. Nach der Korrektur bestand der vollständig aufgezeichnete frische Lauf mit sechs Migrationen und 13/13 Tests.
- Die frühere Secret-Zahl 74 gehört ausschließlich zum später abgelehnten Head `72364525…`. Der commitgebundene Scan des neuen Kandidaten bestätigte Canary-Erkennung, 75 Commits und 203 aktuelle Dateien ohne echten Fund; der rein dokumentarisch amendierte finale Head wurde danach mit demselben Ergebnis erneut gescannt.
- Der Abschluss bestand mit 26/26 Zieltests, 13/13 realen DB-Tests, 169 bestandenen/13 übersprungenen Backend- und 36/36 Frontendtests. Dependency-Audit und drei reale Compose-Parserläufe bestanden; der Containerbuild blieb unverändert vor dem Build an der fehlenden Docker-Linux-Engine-Pipe blockiert.
- Audit Log schrieb Eintraege fuer Create, Update, Delete und Import.
- Ungueltige Selbstrelation wird abgelehnt.
- Ungueltiger Import ohne `elements`/`relations` wird mit HTTP 400 abgelehnt.
- Unit Tests pruefen erlaubte Relation, ungueltige Relation, beide Impact-Modi und Zyklusvermeidung.
- Unit Tests pruefen zusaetzlich Impact Score, Impact Level, Portfolio-Kategorie, Deduplizierung mehrfach erreichter Impact-Elemente, Normalisierung und Risiko-Bubble-Groessen.

## Teilweise Erfuellte Anforderungen

- Canvas und Eigenschaftenpanel sind implementiert, aber nicht mit einem automatisierten Browser-E2E-Test geprueft.
- Heatmap und Filter sind im Code unabhaengig verdrahtet, aber die visuelle Darstellung wurde nicht automatisiert pixel- oder DOM-basiert validiert.
- Capability Map ist dynamisch und profitiert von validierten Relationen, bleibt aber fachlich heuristisch: Applications werden ueber `serves` zu Prozessen und ueber `realizes` zu Capabilities zugeordnet.
- Risk-Cost Portfolio ist visuell und interaktiv verbessert, inklusive Management-Matrix, Detailkarte und einklappbarer Tabelle, bleibt aber eine MVP-Heuristik ohne validiertes Scoring-Modell fuer Business Criticality, Technical Fit oder Functional Fit.
- Lifecycle Roadmap ist eine Tabelle, keine vollwertige interaktive Timeline.
- Audit Log speichert Ereignisse, aber keine detaillierten Before/After-Diffs.
- JSON-Dateipersistenz ist fuer das Forschungsartefakt ausreichend, aber nicht transaktionssicher.

## Nicht Erfuellte Anforderungen

- Kein echtes Auth-System.
- Kein produktionsreifes Deployment.
- Keine kollaborative Bearbeitung.
- Keine automatisierte Integration- oder E2E-Test-Suite.
- Keine vollstaendige ArchiMate-, TOGAF- oder BPMN-Konformitaet.
- Keine semantische Validierung von Lifecycle-Datumslogik, Ownership, Capability-Hierarchie oder Governance-Workflows.
- Keine direkte Relation von Application Component zu Business Capability; Application-Coverage laeuft im MVP ueber Business Processes.
- Keine echte Application-Portfolio-Methodik; die Portfolio-Kategorien sind einfache Regeln.

## Gefundene Und Behobene Kleine Fehler

- Importvalidierung konnte bei fehlenden `elements` oder `relations` als Serverfehler enden. Behoben: strukturell ungueltige Imports liefern jetzt HTTP 400 mit Validierungsfehlern.
- Canvas-Verbindung wurde optimistisch als Edge eingefuegt, bevor die API die Relation validiert hatte. Behoben: Edge erscheint nun erst ueber das aktualisierte Modell nach erfolgreicher API-Erstellung.
- Zweiter Zyklus: Fachliches Metamodell eingefuehrt, semantische Relationvalidierung ergaenzt, Relationserstellung im UI eingeschraenkt und Impact-Analyse in zwei fachlich benannte Modi aufgeteilt.
- Nachschaerfung: Eine vorher dokumentierte optionale Shortcut-Relation `Application Component realizes Business Capability` wurde entfernt, um der strengeren Aufgabenliste zu entsprechen.
- Phase 3: Risk-Cost Portfolio, Impact Score, verbesserte Pfeildarstellung im Canvas und Demo-Hilfetexte ergaenzt.
- Portfolio-Ansicht nachgeschaerft: 2x2-Management-Matrix, horizontale Achsenlabels, Layer-Farben, Hover-Tooltip, Bubble-Auswahl, Detailkarte und einklappbare kompakte Tabelle.

## Annahmen

- `Business Capability` und `Business Process` liegen auf der Business-Schicht.
- Node-Positionen duerfen als technisches UI-Feld im Element gespeichert werden.
- Die REST API darf bei Import das gesamte Modell ersetzen.
- Kosten sind einfache numerische Werte ohne Waehrungs- oder Periodenmodell.
- Portfolio-Kategorien basieren auf einfachen Schwellwerten fuer Kosten, Risiko und Impact.
- Lifecycle-Daten werden als ISO-Datumstrings gepflegt.
- Impact bedeutet im zweiten MVP-Zyklus: Downstream Business Impact und Upstream Dependencies folgen den in `docs/IMPACT_ANALYSIS.md` dokumentierten Traversierungsregeln.

## Technische Abkuerzungen

- JSON-Datei statt SQLite.
- Keine Repository-/Service-/Controller-Schichtung jenseits einfacher Module.
- Keine Debounce-Strategie fuer haeufige UI-Updates im Eigenschaftenpanel.
- Keine Konfliktbehandlung fuer parallele Bearbeitung.
- Keine API-Paginierung.
- Keine robuste Schema-Library wie Zod oder Ajv; das Metamodell ist eine kleine TypeScript-Regelbasis.

## Menschliche Review Noetig

- Fachliche Semantik der Impact-Analyse: die neuen Regeln sind explizit, sollten aber fachlich reviewt werden.
- Fachliche Korrektheit der Capability-zu-Application-Zuordnung.
- Fachliche Belastbarkeit der Portfolio-Scoring-Formel und der Kategorien.
- Sinnhaftigkeit der Kosten-Heatmap-Schwellen.
- Ob JSON-Persistenz fuer die geplante Demonstration reicht.
- UI-Usability im echten Browser, inklusive Canvas Drag & Drop, Panel-Bearbeitung, Import-Dialog und Relationserstellung per Maus.
- Sicherheitsreview der npm vulnerabilities.

## Moegliche Halluzinationen Oder Unsichere Designentscheidungen

- Seed-Daten sind fiktiv und nicht aus einer realen Unternehmensarchitektur abgeleitet.
- EAM-Begriffe sind jetzt in einem kleinen lokalen Metamodell verankert, aber nicht in einem verbindlichen Standard wie ArchiMate.
- Die Evaluation Matrix ist eine technische Selbsteinschaetzung nach Smoke-Tests und Codepruefung, keine unabhaengige Qualitaetssicherung.

## Vierter Entwicklungszyklus: Metamodel Rule Builder

### Annahmen ueber KMU-Kunden

- KMU-Kunden brauchen eher wenige, verstaendliche Modellierungsregeln als einen vollstaendigen Architekturstandard.
- Unterschiedliche Stakeholder brauchen reduzierte Sichten, damit Diagramme nicht zu technisch oder zu breit werden.
- Pflichtregeln sollten pruefbar sein, aber den iterativen Diagrammaufbau nicht bei jedem Zwischenschritt blockieren.

### Fachlich vereinfachte Regeln

- Viewpoints enthalten einfache Allow-/Require-Listen statt einer komplexen Regel-DSL.
- `allowedSourceTypeIds` und `allowedTargetTypeIds` modellieren Typkombinationen grob und ohne Kardinalitaeten.
- Pflichtverbindungen werden als mindestens einmal vorkommender Verbindungstyp geprueft, nicht als vollstaendige Pattern-Regel.
- Das Metamodell ist EAM-inspiriert, aber keine vollstaendige ArchiMate-Implementierung.

### Weiterhin noetige menschliche Review

- Ob die initialen Viewpoints fuer die Ziel-KMU fachlich passen.
- Ob `Application serves Business Capability` direkt erlaubt bleiben soll oder nur ueber Business Process laufen darf.
- Ob Pflichtregeln je Viewpoint zu streng oder zu locker sind.
- Ob die Metamodel-Visualisierung bei groesseren Kundenmetamodellen ausreichend lesbar bleibt.

## Fuenfter Entwicklungszyklus: Explizite ConnectionRules

### Warum Das Vorherige Modell Fachlich Grob War

- `allowedSourceTypeIds` und `allowedTargetTypeIds` am ConnectionType vermischten Beziehungstyp und Beziehungserlaubnis.
- Eine einzelne erlaubte Verbindung hatte keine eigene Begruendung, Severity, Pflichtmarkierung oder Viewpoint-Einschraenkung.
- Die Visualisierung zeigte abgeleitete Kombinationslisten statt expliziter fachlicher Regeln.

### Warum ConnectionRule Eingefuehrt Wurde

ConnectionRule modelliert die eigentliche fachliche Aussage: Source Component Type + Connection Type + Target Component Type. Dadurch kann eine Regel begruendet, als required/optional markiert, einem Viewpoint zugeordnet und in Validierungsergebnissen referenziert werden.

### Bewusste Stakeholder-Entscheidung

Stakeholder wurden bewusst als normale Diagrammelemente erhalten. Ein Stakeholder-Knoten kann direkt Beziehungen wie `responsible_for Application` oder `interested_in Business Capability` tragen. Viewpoints bleiben dagegen Rollenfilter und ersetzen Stakeholder nicht.

### Weiterhin Bestehende Annahmen

- Das Metamodell bleibt ein MVP und kein vollstaendiger ArchiMate-Standard.
- ConnectionRules bilden keine komplexe Regel-DSL mit Pfadbedingungen oder Vererbung ab.
- Legacy-Felder bleiben fuer Migration und Kompatibilitaet erhalten.
- Menschliche Fachreview ist noetig, um direkte Regeln wie `Application serves Business Capability` je Kunde zu bestaetigen.

## Sechster Entwicklungszyklus: Trennung Der Regelarten

### Fachliche Nachschaerfung

- `ValidationResult` wird nun bewusst als erzeugtes Ergebnis eines Validierungslaufs verstanden, nicht als persistiertes Diagramm-Bestandteilobjekt.
- `ViewpointRule` trennt die konkrete Regelmenge von der Viewpoint-Beschreibung. Der Viewpoint bleibt Rolle/Zweck, die ViewpointRule enthaelt Allow-/Require-Listen.
- Diagramme werden ueber `metamodelId` gegen das aktive Metamodel eingeordnet; fehlende Bestandswerte werden beim Laden normalisiert.
- `ValidationRule` ergaenzt typbezogene Mindestbeziehungen, zum Beispiel Application braucht verantwortliche Stakeholder-Beziehung.

### Weiterhin Bestehende MVP-Grenzen

- Zusammengesetzte OR-Regeln sind noch nicht implementiert. Die daten- oder technologiebezogene Application-Pflicht ist im MVP eine einfache Technology-Dependency-Warnregel.
- Es gibt noch keinen vollstaendigen UI-Editor fuer ValidationRules.
- Viewpoint-Legacy-Felder bleiben vorhanden, koennen aber fachlich von ViewpointRules abweichen. Primaer ist nun ViewpointRule.
- Menschliche Review bleibt noetig, um die Severity der neuen Pflichtbeziehungsregeln je KMU festzulegen.

## Siebter Entwicklungszyklus: Kritische Pruefung

### Pruefergebnis

- Die vier Nachschaerfungen sind im Code implementiert und nicht nur dokumentiert.
- Kleine Testluecken wurden gefunden und geschlossen.
- `ValidationResult`, `ViewpointRule`, `Diagram.metamodelId` und `ValidationRule` sind als Strukturen und in der Validierungslogik vorhanden.

### Kritische Restpunkte

- Die OR-Regel fuer daten- oder technologiebezogene Application-Abhaengigkeit bleibt eine MVP-Vereinfachung.
- Legacy-Felder `allowedSourceTypeIds` und `allowedTargetTypeIds` koennen fuer Migration in explizite ConnectionRules umgewandelt werden. Das ist technisch nachvollziehbar, sollte bei echten Kundendaten aber reviewt werden.
- Die UI zeigt ViewpointRules und ValidationRules, bietet aber noch keinen vollstaendigen dedizierten Editor fuer diese neuen Regelarten.

## Achter Entwicklungszyklus: Praesentationsfaehige Metamodel-Sicht

### Kritische Ausgangslage

- Die vorherige Metamodel-Ansicht war funktional, aber fuer PO, Teamleitung und KMU-Kunden zu unstrukturiert.
- EAM- und BPMN-Typen wurden gemeinsam dargestellt, wodurch der Rule Graph schnell ueberladen und schwer erklaerbar wurde.
- Die Visualisierung zeigte zu viele Regeln gleichzeitig und hatte starke Ueberlappungen.

### Umgesetzte Verbesserung

- Fachliche Mermaid-Diagramme wurden als Primaerquellen unter `docs/diagrams` angelegt.
- Die Metamodel-UI wurde in Summary, Filter und Tabs gegliedert.
- Der Rule Graph zeigt standardmaessig eine reduzierte EAM-Kernansicht und blendet BPMN aus, bis BPMN explizit gefiltert wird.
- ConnectionRules, ViewpointRules und ValidationRules sind getrennt sichtbar.

### Weiterhin MVP

- Es gibt keine automatische Graph-Layout-Engine; das Layout ist bewusst einfach berechnet.
- Mermaid-Exporte als SVG/PNG wurden nicht erzeugt, weil kein Renderer im Projekt vorhanden ist und keine neue Doku-Dependency eingefuehrt wurde.
- Die UI ist besser praesentierbar, aber noch kein vollstaendiger Governance-Editor.

## Neunter Entwicklungszyklus: Metamodel JSON Und Lesbarerer Rule Graph

### Warum JSON-Konfiguration Wichtig Ist

- Ein KMU-Metamodell sollte nicht nur als verstreuter Seed-Code existieren, sondern als versionierbares Kundenartefakt.
- Eine einzelne JSON-Datei macht Regeln reproduzierbar, reviewbar und kundenspezifisch anpassbar.
- Export/Import trennt fachliches Regelwerk von konkreten Diagramminstanzen.

### Umgesetzte Hardcoding-Reduktion

- Eine Default-EAM-Definition wurde als `backend/src/data/default-metamodel.json` angelegt.
- Backend-Endpunkte exportieren/importieren nur das Metamodell: ComponentTypes, ConnectionTypes, ConnectionRules, Viewpoints, ViewpointRules und ValidationRules.
- Importvalidierung prueft Pflichtfelder, eindeutige IDs und Referenzen, bevor der Store geschrieben wird.

### Weiterhin MVP

- Bestehende Code-Seeds bleiben als technische Rueckfall- und Migrationslogik erhalten, insbesondere fuer Legacy- und BPMN-Daten.
- Der Import nutzt `replace active metamodel`; ein sicherer Merge-Modus ist noch nicht umgesetzt.
- Die UI importiert direkt und zeigt das ImportResult, aber noch keine vollstaendige Preview mit manueller Freigabe.
- Der Rule Graph ist durch Simplified/Detailed/Viewpoint-Modi lesbarer, nutzt aber weiterhin ein einfaches berechnetes SVG-Layout statt einer spezialisierten Graph-Layout-Engine.

## Zehnter Entwicklungszyklus: PostgreSQL und Docker

### Entscheidung und Nutzen

- PostgreSQL plus Prisma balanciert relationale Integrität und flexible JSONB-Attribute besser als der bisherige gemeinsame JSON-State.
- Die Store-Abstraktion hält die bestehenden fachlichen Strukturen stabil; dadurch mussten DiagramEditor, ConnectionRule-Validierung und Metamodel-Import/-Export nicht neu geschrieben werden.
- Datenbankseitige Cascades sind robuster als ausschließlich anwendungsseitiges Aufräumen von ConnectionInstances.

### Kritische Grenzen

- Der Legacy-Pfad `/api/model` bleibt als klar benannte Restgrenze JSON-basiert.
- Der kompatible Full-State-Write ist für das MVP verständlich und transaktional, aber nicht die endgültige Lösung für große Datenbestände oder parallele Benutzer.
- Nullable `diagramId` ist eine bewusste Anpassung an den bestehenden zweistufigen Editor-Ablauf. Ein späterer API-Schnitt sollte Diagrammzuordnung bereits beim Erstellen verlangen.
- Docker automatisiert lokalen Betrieb, ist aber weder Deployment- noch Security-Konzept. Beispiel-Credentials müssen außerhalb lokaler Entwicklung ersetzt werden.

## Elfter Entwicklungszyklus: Umgebungen und Hosting-Vorbereitung

### Trennungsentscheidung

- Staging und Produktion werden als eigenständige Compose-Projekte betrieben, nicht als schwer nachvollziehbare Kombination vieler Overrides.
- Eigene DB-Namen, Benutzer, Named Volumes und Loopback-Ports reduzieren das Risiko, Testdaten mit Produktion zu vermischen.
- Die lokale `docker-compose.yml` bleibt bestehen; Windows verwendet auf diesem Rechner `docker.exe compose`, Linux üblicherweise `docker compose`.

### Hosting-Entscheidung

- Die bestehende Hauptdomain bleibt unangetastet. Produktion nutzt `eam.messers-cardio-club.com`, Staging `eam-test.messers-cardio-club.com`.
- TLS endet am bereits servernah gedachten Host-Nginx. Containerports bleiben auf `127.0.0.1`; PostgreSQL wird nicht veröffentlicht.
- Certbot/Let's Encrypt ist vorbereitet, aber DNS, Zertifikate und Serverkonfiguration wurden nicht extern verändert.

### Kritische Grenzen

- Ohne Auth ist eine öffentliche Live-Schaltung mit sensiblen EAM-Daten nicht verantwortbar; Issue #21 ist deshalb nur vorbereitet.
- Persistente Volumes ersetzen kein Backup. `pg_dump` und Restore müssen vor Live-Betrieb getestet werden.
- Deployment und Rollback bleiben ohne CI/CD manuell und können kurze Unterbrechungen verursachen.
- Automatische Deploy-Skripte wurden bewusst nicht erstellt, weil Serverpfad, Backup-Ziel und Freigabeprozess noch fehlen.

### Hosting-Readiness-Nachschärfung

- Der Erststart vor Certbot ist nun explizit von der finalen HTTPS-Konfiguration getrennt; dadurch werden Nginx-Fehler wegen noch fehlender Zertifikatspfade vermieden.
- Eine Readiness-Checkliste definiert Stop-/Go-Kriterien für lokal, Server-Staging und Server-Produktion. Ein separates Protokoll verhindert, dass „dokumentiert“ mit „tatsächlich abgenommen“ verwechselt wird.
- Fehlendes Auth wird nicht kleingeredet: Demo-Daten, serverweites Basic Auth oder Verschiebung sind die einzigen dokumentierten Übergangsoptionen.
- Backup, Restore und Rollback sind manuell beschrieben. Ein persistentes Volume allein bleibt ausdrücklich kein Backup.

## Zwölfter Entwicklungszyklus: Manuelle CI/CD-Pipeline

### Automatisierung mit bewussten Grenzen

- CI automatisiert reproduzierbare Qualitätsprüfungen bei Push und Pull Request, deployt aber nichts.
- Staging und Produktion bleiben manuelle Workflows. Produktion benötigt zusätzlich explizite Bestätigung, Backup- und Abnahmebestätigung.
- Der Workflow deployt exakt den im Verify-Job geprüften Commit-SHA. Ein beweglicher Branch kann dadurch nicht zwischen Test und Deployment unbemerkt weiterlaufen.

### Sicherheitsentscheidungen

- SSH-Host-Keys werden vorab verifiziert als Secret hinterlegt; ein ungeprüftes `ssh-keyscan` im Workflow wurde vermieden.
- Server-Env-Dateien und Basic-Auth-Zugänge bleiben vollständig außerhalb GitHubs.
- Server-Worktrees mit getrackten Änderungen blockieren das Deployment; ein destruktives `git reset --hard` wird nicht genutzt.
- Externe Healthchecks hinter Basic Auth werden nicht automatisiert. Der interne Loopback-Healthcheck ist die belastbare Deploymentprüfung.

### Restgrenzen

- Images werden auf dem Zielserver neu gebaut statt über eine signierte Registry promotet.
- Backup und Restore bleiben manuell; die Pipeline bestätigt nur, dass vor Produktion ein Backup existiert.
- GitHub Environments, Secrets, Required Reviewers und der erste reale Workflowlauf sind externe Konfigurationsschritte.
- Kein Zero-Downtime-Deployment und kein automatisches Prisma-Rollback.

## REQ-24-Nachkorrektur: fachliche Viewer-Leseansicht

### Beobachtung

- Ein manueller Staging-Test zeigte bei Viewer-Komponenten die internen Felder `id` und `componentTypeId` sowie Eigenschaften als rohes JSON.
- Die automatisierten Rollentests erkannten den Fehler nicht, weil sie nur Schreibaktionen und den Komponentennamen prüften.

### Ursache und Entscheidung

- Der generische Read-only-Fallback serialisierte jede Entität mit `Object.entries` und Objektwerte mit `JSON.stringify`.
- Für Komponenten wurde deshalb eine eigene fachliche Leseansicht ergänzt: aufgelöster Typname, Beschreibung, einzeln beschriftete Eigenschaften sowie die bestehenden Verknüpfungen.
- Die Korrektur ändert keine Backendberechtigung und keine Tenantabfrage. Die bereits autorisierten, company-gefilterten Lesedaten werden anders dargestellt.

### Verifikation und Grenze

- Ein eigener Viewer-Regressionstest fordert die fachlichen Inhalte und schließt interne ID-Feldnamen sowie die Schreibaktion aus.
- Der gezielte Test bestand mit 10/10; `npm run check` bestand vollständig.
- Die übrigen Entitätstypen verwenden weiterhin den vorhandenen generischen Read-only-Fallback. Gegenstand dieser Nachkorrektur ist der konkret gemeldete Komponentenfehler.

## REQ-24: Rollen- und Viewpoint-Verwechslung im Diagrammeditor

### Beobachtung und Ursache

- Die ursprüngliche Auswahl änderte den gespeicherten `diagram.viewpointId`. Ein enger Viewpoint validierte dadurch das vollständige Diagramm, lehnte darin fachlich fremde Beziehungen ab und setzte die Auswahl nach dem fehlgeschlagenen Speichern zurück. Die sichtbare Auswahl und die stehengebliebene Fehlermeldung konnten deshalb verschiedene Ansichten nennen.
- Rollen und Viewpoints waren in der Oberfläche nicht ausreichend getrennt erklärt. Rollen steuern Aktionen und API-Rechte; Viewpoints steuern sichtbare Diagramminhalte und fachliche Validierung.

### Entscheidungen

- Der Selector erzeugt nur eine lokale Projektion. Das Quelldiagramm bleibt unverändert.
- Beziehungen werden nur gezeigt, wenn eine erlaubte ConnectionRule existiert und sie im gewählten Viewpoint zulässig ist. Unbekannte, verbotene oder regellose Beziehungen werden ausgeblendet.
- Lokale Projektionen sind schreibgeschützt. Zustandsbereinigung und zentrale Mutationsschranke sichern auch bereits begonnene Interaktionen ab.
- Eine kleine Zustandsmaschine und der produktiv verwendete Knotenklick-Handler bilden den Verbindungsmodus explizit ab und sind ohne zusätzliche Browser-Testabhängigkeiten testbar.

### Kontrollschleife und Lernpunkte

- Die erste Kontrolle fand einen Smart-Add-Pfad, der den lokalen Filter umgehen konnte, sowie einen Test gegen den falschen Starter. Beides wurde korrigiert.
- Eine weitere Kontrolle fand eine stale Verbindungsinteraktion. Handler-Guards und Zustandsbereinigung schlossen den Funktionsfehler; erst der anschließende Verhaltenstest schloss auch die Prüflücke.
- Ein zwischenzeitlicher jsdom-/Testing-Library-Test war funktional aussagekräftig, hätte aber Testpakete über das bestehende Backend-Dockerfile in das Laufzeit-Image übernommen und passte nicht zur gesamten deklarierten Node-Untergrenze. Die direkten Deklarationen und der dadurch zusätzlich aufgelöste Lockfile-Paketbaum wurden wieder entfernt; die schon vorher vorhandenen optionalen Vitest-Peer-Referenzen auf jsdom bleiben unverändert.
- Ein vollständiger Prüflauf hatte einmalig einen unerwarteten Vitest-Workerabbruch. Der betroffene RBAC-Test bestand danach 14/14; der vollständige Wiederholungslauf bestand ohne Fehler. Daraus wurde kein Produktfehler abgeleitet.
- Eine anschließende saubere Neuinstallation machte eine neue High-Einstufung für das transitive `body-parser` 1.20.8 sichtbar. Ein reguläres, nicht erzwungenes Lockfile-Update hob ausschließlich dieses Paket auf 1.20.9; danach meldeten Installation und Dependency-Gate null Schwachstellen.
- Der erste Remote-CI-Lauf des veröffentlichten Viewpoint-Stands bestand alle fachlichen und statischen Gates, scheiterte aber beim Frontend-Containerbuild: Der allgemeine TypeScript-Build erfasste den kanonischen Startertest, während das Frontend-Dockerfile dessen Backend-Testquelle bewusst nicht kopiert. Ein eigener `tsconfig.build.json` schließt nur Testdateien vom Produktionsbuild aus; der unveränderte normale Typecheck prüft weiterhin alle Tests und deren Backend-Importe.

### Abschluss

- Finaler Produkt-/Testcode der Viewpoint-Korrektur: `74aa718ee61bcaaed4a4cefe18341b99aa2ef5c0`; unabhängig geprüfter Security-Patch-Head vor der Abschlussdokumentation: `1cb2335c55c8873f9880bf60754e3e4e5893fcdf`.
- Vollständiger lokaler Check: 88 Backendtests bestanden, 7 übersprungen; 21 Frontendtests bestanden; Lint, Typechecks und beide Builds erfolgreich; 112 Compose-, 169 Workflow- und 17 Securityprüfungen sowie Prisma-Konfigurationsprüfung bestanden.
- Unabhängige read-only Kontrolle von Viewpoint-Korrektur und anschließendem Security-Patch: keine offenen P0–P3. `npm ci` auditierte 443 Pakete ohne Schwachstelle; das Dependency-Gate meldete null Findings. Remote-, Staging- und Produktionsnachweise bleiben getrennt offen.
- Die Buildpfad-Korrektur `007be0c2` wurde ebenfalls unabhängig ohne P0–P3 freigegeben. Vollständiger Check und Produktbundle waren lokal erfolgreich; ein lokaler Docker-Image-Build war mangels laufender Docker-Engine nicht möglich und muss durch den erneuten Remote-CI-Lauf belegt werden.

## REQ-23: transaktionaler Audit-Trail

- Eine vorhandene Import-Audittabelle war eine geeignete kanonische Basis, deckte aber weder alle Schreibpfade noch Objekt-ID, Felddiffs, Filter oder lange Historien ab. Die Lösung erweitert diesen Pfad statt einen dritten Auditmechanismus einzuführen.
- Akteursermittlung und Auditinsert gehören in dieselbe Datenbanktransaktion wie die Fachmutation. Der erzwungene fehlende Auditakteur zeigte praktisch, dass auch eine bereits ausgeführte Objektänderung zurückgerollt wird.
- Kaskaden benötigen fachliche Einträge für gelöschte Relationen und geänderte Diagrammmitgliedschaften. Nur das primär angeforderte Objekt zu loggen hätte die tatsächliche Wirkung verschleiert.
- Legacy-Erhalt bedeutet nicht, fehlende Daten rückwirkend zu erfinden. Unbekannter Akteur, fehlender Diff und nicht belastbarer Ereigniszeitpunkt bleiben explizit unbekannt; das Originalpayload bleibt als Provenienz erhalten.
- Der erste Stand setzte Append-only nur in Anwendung und API durch. Die unabhängige Kontrolle zeigte, dass dieselbe Runtime-Verbindung Auditzeilen direkt ändern oder löschen konnte. Der Korrekturstand blockiert beides mit einem PostgreSQL-Trigger; DB-Eigentümer/Superuser bleiben bewusst als administrative Vertrauensgrenze dokumentiert.
- Automatische Initialisierung ist eine Mutation: Die erstmalige Anlage des Legacy-Modells benötigt einen atomaren Systembeleg. Eine allgemeine `changed`-Entscheidung vor Persistenz verhindert zugleich, dass fachliche No-ops Version, Revision oder einen der beiden Auditpfade verändern.
- Revisionsneutrale Initialisierung änderte eine versteckte REQ-26-Annahme. Der erste Gegenlauf zeigte eine nicht strikt erhöhte Importversion; die kombinierte Untergrenze aus Datenrevision und bisheriger Objektversion schloss die ABA-Lücke.
- Eine Elementhistorie ist nur vollständig, wenn Objektart und Objekt-ID gemeinsam binden und der Cursor in der eingebetteten Ansicht erreichbar ist. Eine feste erste Seite ist keine lange Historie.
- Eine Cursor-API allein verhindert keine UI-Vermischung: Eine verspätete Folgeantwort der vorherigen Auswahl kann nach einem Auswahlwechsel sowohl Daten als auch Steuerzustände überschreiben. Der zunächst lokal grüne Kandidat `238ca51bc48f55936664aa270807ea48d173cc8b` blieb deshalb mit einem unabhängigen P2 ohne Freigabe. Der Korrekturhead `b57d2f42176651fa82c4454fb6ed79693f317dd9` bindet Erfolg, Fehler und Abschluss von Erst- und Folgeanfragen an eine Auswahlgeneration; der deterministische React-Test hält zugleich die aktuelle B-Folgeanfrage offen und belegt, dass eine verspätete A-Antwort weder B-Inhalte noch den B-Ladezustand verändert.
- Der Secret-Scan war erst nach Wiederverwendung eines lokal vorhandenen, weiterhin hashgeprüften Scannerarchivs möglich. Zwei HTTP-504 sind Infrastrukturbelege, keine Rechtfertigung, das Gate auszulassen.
- Lokale Entwicklerprüfung und unabhängige Freigabe blieben getrennt: Erst die separate Exact-Head-Kontrolle gab `b0d7e4b07b4d627cd96f4a09857761c9ed33ee5a` nach sieben von sieben erweiterten Race-Gegenproben technisch ohne offene P0–P3 frei. Draft-PR #98 bindet denselben Head an Basis `805b281d4f99f7f4bc0db8c9c66b0d1646ea5926`; Quality-/Infrastructure-, Dependency-, Secret-, CodeQL-JavaScript/TypeScript- und CodeQL-PR-Auswertung waren erfolgreich. Das belegt weder menschliches Review noch Merge, Issue-Schließung, Staging oder Produktion.
