# Prompt Log

## Startprompt

Der Startprompt fordert einen autonomen Senior-Fullstack-Entwicklungsagenten auf, einen lauffaehigen Web-Prototypen eines EAM-Tools als Forschungsartefakt zu bauen. Gefordert sind React, TypeScript, Vite, React Flow, Node.js, Express, REST API, JSON-Datei oder SQLite, kein echtes Auth-System, einfache lokale Starts, Seed-Daten, Canvas, Eigenschaftenpanel, Validierung, Impact-Analyse, Heatmap, Capability Map, Roadmap, Import/Export, Audit Log und Dokumentation.

## Wichtige Entscheidungen Waehrend Der Umsetzung

- JSON-Dateipersistenz wurde gegenueber SQLite gewaehlt, weil sie fuer den MVP schneller stabil und nachvollziehbar ist.
- Node-Positionen werden als `position` im Element gespeichert, obwohl dieses Feld nicht in den fachlichen Mindestattributen stand. Das ist fuer persistentes Canvas-Layout notwendig.
- Die API akzeptiert beim Import ein komplettes Modell und ersetzt das aktuelle Modell, sofern die Validierung erfolgreich ist.
- Die Capability Map verwendet eine pragmatische Zuordnungslogik: `Application Component` dient einem `Business Process`; der Prozess realisiert eine `Business Capability`.
- Phase 1: Impact-Analyse lief entlang ausgehender `uses` und `depends_on` Relationen. Phase 2 ersetzt dies durch Downstream Business Impact und Upstream Dependencies.
- Kosten-Heatmap nutzt einfache Schwellenwerte unter 100000, ab 100000 und ab 180000.
- Audit Log speichert kurze Ereignisbeschreibungen statt vollstaendiger Change-Diffs.
- `npm run typecheck`, `npm run build`, Backend-Smoke-Test auf `GET /api/model` und Frontend-Smoke-Test auf `http://localhost:5173` wurden erfolgreich ausgefuehrt.

## Zweiter Entwicklungszyklus

Der zweite Prompt fordert keine neuen UI-Flaechen, sondern bessere EAM-Fachqualitaet. Umgesetzt wurde ein kleines explizites Metamodell mit erlaubten Element-Layer-Zuordnungen und Source/Relation/Target-Regeln. Die Backend-Validierung nutzt dieses Metamodell beim Erstellen und Importieren von Relationen. Das Frontend bietet im Relationsformular nur noch erlaubte Relationstypen an, sobald Source und Target bekannt sind.

Die Impact-Analyse wurde fachlich in zwei Modi aufgeteilt:

- Downstream Business Impact
- Upstream Dependencies

Die Analyse laeuft rekursiv, verhindert Zyklen und zeigt Relationstyp, Level und Pfad. Minimale Vitest-Tests wurden fuer Metamodell, Validierung und Impact-Analyse ergaenzt.

Nachschaerfung: Die zunaechst dokumentierte optionale Shortcut-Relation `Application Component realizes Business Capability` wurde entfernt. Der zweite Zyklus folgt damit nur den explizit geforderten erlaubten Relationen.

## Dritter Entwicklungszyklus

Der dritte Prompt fordert bessere Entscheidungs- und Praesentationsfaehigkeit ohne grosse Architekturkonzepte. Umgesetzt wurde eine Risk-Cost Portfolio Ansicht mit berechnetem Impact Score.

Wichtige Entscheidungen:

- Impact Score basiert auf Downstream Business Impact.
- Betroffene Elemente werden nach Typ gewichtet:
  - Business Capability: 5
  - Business Process: 4
  - Application Component: 3
  - Data Object: 2
  - Technology Node: 1
- Mehrfach erreichbare Elemente werden nur einmal gezaehlt.
- Portfolio-Kategorien bleiben einfache MVP-Heuristiken.
- Canvas-Edges wurden mit Pfeilrichtung, Relationstyp-Labels und einfachen Relationstyp-Stilen verbessert.
- Es wurden keine neuen externen Chart-Libraries oder State-Management-Abhaengigkeiten eingefuehrt.
- Unit Tests wurden fuer Portfolio-Scoring, Impact Level, Kategorie und Deduplizierung ergaenzt.

## Vierter Entwicklungszyklus

Der vierte Prompt fordert, die vorhandene Sidebar-/Diagrammstruktur nicht zu ersetzen, sondern fachlich zu einem konfigurierbaren Metamodell fuer KMU-Kunden auszubauen.

Umgesetzt wurde der Metamodel Rule Builder:

- Component Types wurden um Layer, Viewpoint-Zuordnung und Pflichtmarkierung erweitert.
- Connection Types wurden um Richtungstext sowie Source-/Target-Pflichtkontexte erweitert.
- Viewpoints wurden als neue Sidebar-Struktur mit CRUD, Editor und Diagrammzuordnung eingefuehrt.
- Eine zentrale Sidebar-Metamodellvalidierung prueft erlaubte Verbindungskombinationen, Viewpoint-Einschraenkungen und Pflichtregeln.
- Der DiagramEditor filtert Komponenten und Verbindungstypen nach Viewpoint und bietet `Validate diagram`.
- Das Backend validiert Verbindungen und harte Diagramm-Viewpoint-Regeln serverseitig.
- Eine neue `Metamodel`-Ansicht visualisiert Component Types, Connection Rules und Viewpoint-Filter als Regeluebersicht und SVG-Grafik.
- Dokumentation, Evaluation und Reflexion wurden ergaenzt.

## Fuenfter Entwicklungszyklus

Der fuenfte Prompt fordert ein fachlich saubereres, klassendiagrammaehnliches Metamodell. Die zentrale Anpassung ist die Einfuehrung von `ConnectionRule` als primaere Regelstruktur.

Umgesetzt wurde:

- `Metamodel` als minimale logische Root-Struktur im Sidebar-State.
- `ConnectionRule` mit Source Component Type, Connection Type, Target Component Type, allowed, required, severity, rationale und optionalen Viewpoints.
- Migration/Normalisierung: Bestehende Legacy-Connection-Type-Listen koennen in ConnectionRules ueberfuehrt werden.
- Validierung nutzt ConnectionRules primaer und liefert strukturierte ValidationMessages.
- DiagramEditor nutzt ConnectionRules zur Auswahl erlaubter ConnectionTypes und erzeugt keine Fallback-Verbindung.
- Sidebar/Rule-Builder erhaelt einen einfachen Connection Rule Editor.
- Metamodel-Ansicht zeigt explizite ConnectionRules und Detailinformationen.
- Stakeholder bleibt ein modellierbarer ComponentType mit expliziten Stakeholder-Regeln.

## Sechster Entwicklungszyklus

Der sechste Prompt fordert vier fachliche Nachschaerfungen am bestehenden Metamodel Rule Builder, ohne neue grosse UI-Funktionen.

Umgesetzt wurde:

- `ValidationResult` ist als erzeugtes Validierungsergebnis dokumentiert und bleibt Rueckgabe der Validierungsfunktionen.
- `ViewpointRule` wurde als eigene Struktur eingefuehrt und wird fuer Viewpoint-Filterung und Viewpoint-Validierung primaer genutzt.
- `Diagram` erhaelt `metamodelId`; alte Diagramme werden gegen das aktive Metamodel normalisiert.
- `ValidationRule` wurde fuer typbezogene Mindestbeziehungen eingefuehrt.
- Validierungsmeldungen enthalten nun `scope` und `ruleType`.
- Validate Diagram gruppiert Metamodel-, Viewpoint- und Pflichtregelmeldungen.
- Die Metamodel-Ansicht zeigt ConnectionRules, ViewpointRules und ValidationRules getrennt.
- Tests wurden um ViewpointRule, ValidationRule, Metamodel-Konformitaet und strukturierte ValidationMessages erweitert.

## Siebter Entwicklungszyklus: Kritische Refinement-Pruefung

Der siebte Prompt fordert keine neue Funktionalitaet, sondern eine kritische Pruefung, ob die vier Nachschaerfungen wirklich implementiert sind.

Durchgefuehrt wurde:

- Codepruefung von Types, Validierungslogik, Store-Normalisierung, Backend-Routen, DiagramEditor und Metamodel View.
- Kleine Testluecken geschlossen fuer Application-ohne-`serves`, Application-ohne-Technikabhaengigkeit und Legacy-Source/Target-Felder als nicht-primaere Regelquelle.
- `npm run typecheck`, `npm test` und `npm run build` ausgefuehrt.
- `docs/METAMODEL_REFINEMENT_CHECK.md` als ehrlicher Pruefbericht erstellt.

## Achter Entwicklungszyklus

Der achte Prompt fordert fachliche Diagramm-Artefakte und eine praesentationsfaehigere Metamodel-Frontend-Ansicht.

Umgesetzt wurde:

- Neuer Ordner `docs/diagrams` mit Mermaid-Quellen fuer Klassendiagramm, Model-vs-Metamodel, ConnectionRule-Beispiele, ViewpointRule-Diagramm und Validierungsablauf.
- Markdown-Erklaerungen und Diagrammindex mit Render-Hinweisen.
- Keine SVG/PNG-Exports, weil kein Mermaid-Renderer im Projekt vorhanden ist und keine neue schwere Dependency eingefuehrt wurde.
- Metamodel-Ansicht mit Header/KPIs, Filterleiste, Suche, Toggles und Tabs.
- Component Types nach Layer/Category gruppiert.
- Connection Rules als filterbare und sortierbare Source-Relation-Target-Tabelle.
- Viewpoints und ValidationRules als eigene Tabs.
- Rule Graph mit EAM-Kernansicht, BPMN-Ausblendung, Kantenlabels, Pfeilen, Limit-Warnung und Detailpanel.

## Neunter Entwicklungszyklus

Der neunte Prompt fordert, das Metamodell als eine einzelne JSON-Datei importierbar/exportierbar zu machen und den Rule Graph weiter lesbarer zu gestalten.

Umgesetzt wurde:

- Metamodel JSON als fachliche Austauschstruktur mit `metamodel`, `componentTypes`, `connectionTypes`, `connectionRules`, `viewpoints`, `viewpointRules` und `validationRules`.
- Default-EAM-Metamodell unter `backend/src/data/default-metamodel.json`.
- Backend-Endpunkte fuer Export, Default-Download und Import.
- Importvalidierung fuer Pflichtfelder, eindeutige IDs und Referenzen.
- Atomischer Import ohne stille Teilimporte; bestehende Diagramme bleiben erhalten und erhalten die importierte `metamodelId`.
- Frontend-Aktionen fuer Export, Import und Download des Default-EAM-Metamodells.
- Rule Graph mit `Simplified`, `Detailed` und `Viewpoint`-Modus, gruppierten Kantenlabels und verbessertem Detailpanel.
- Dokumentation des JSON-Formats, der MVP-Grenzen und der verbliebenen Code-Fallbacks.

## Zehnter Entwicklungszyklus

Der zehnte Prompt fasst Issue #17 (Datenbank) und Issue #19 (Docker) zu einem ersten Infrastruktur-Schritt zusammen.

Umgesetzt wurde:

- Analyse der beiden bestehenden JSON-Stores, Sidebar-API, Frontend-Aufrufe, Scripts, Tests und Metamodel-Import/-Export-Funktion.
- Entscheidung für PostgreSQL, Prisma und JSONB.
- Prisma-Modell und initiale SQL-Migration für Metamodel, Typen, Regeln, Viewpoints, Diagramme und Instanzen.
- Store-Abstraktion mit DB-primärem Sidebar-Pfad, sicherer Erstkopie und dokumentiertem Legacy-Fallback.
- Cascade Delete für ConnectionInstances und Aggregate-Laden eines Diagramms.
- Idempotenter Default-Seed sowie geschützte JSON-Migration ohne Löschen der Quelle.
- Dockerfiles, Nginx-Konfiguration, Docker Compose, persistentes PostgreSQL-Volume und `.env.example`.
- Repository-/Datenmodelltests und Infrastruktur-Dokumentation.
- Bewusst nicht umgesetzt: Auth, CI/CD, Live-Deployment und Rewrite des historischen `/api/model`-Stores.

## Elfter Entwicklungszyklus

Der elfte Prompt fordert für Issue #20 getrennte lokale, Staging- und Produktionsumgebungen und bereitet Issue #21 als manuelles Serverhosting vor.

Umgesetzt wurde:

- Lokale Compose-Datei unverändert als Entwicklungsweg beibehalten.
- Eigene Compose-Projekte `eam-staging` und `eam-prod` mit getrennten DB-Namen, Benutzern, Volumes und Ports.
- `.env.staging.example` und `.env.prod.example` ohne echte Secrets sowie Gitignore-Schutz für reale Env-Dateien.
- Host-Nginx-Beispiele für `eam.messers-cardio-club.com` und `eam-test.messers-cardio-club.com` mit HTTPS-Redirect und Let's-Encrypt-Pfaden.
- Manuelle Hosting-Anleitung für DNS, Docker, Nginx, Certbot, Logs, Backup und Rollback.
- Windows-Hinweis für `docker.exe compose`; Linux verwendet normalerweise `docker compose`.
- Alle drei Compose-Konfigurationen mit Docker Compose validiert; lokaler Stack mit drei laufenden Diensten und HTTP-/DB-Readiness bestätigt.
- Bewusst nicht umgesetzt: Live-Schaltung, Auth, CI/CD, automatische Backups und Zero-Downtime-Deployment.

## Korrekturprüfung der Server-Compose-Dateien

Eine manuelle Prüfung ohne `--env-file` zeigte lokale Werte in Staging/Produktion und ließ die gerenderte Service-/Volume-Zuordnung missverständlich wirken.

Geprüft und korrigiert wurde:

- Beide Compose-Dateien enthalten korrekt `postgres`, `backend` und `frontend`; das DB-Volume war bereits ausschließlich PostgreSQL zugeordnet.
- Ursache der lokalen Werte war Docker Composes automatisches Laden der lokalen `.env` beim verkürzten `-f`-Aufruf.
- `--env-file .env.staging` beziehungsweise `--env-file .env.prod` ist nun als verpflichtend dokumentiert und als Kommentar in den Compose-Dateien sichtbar.
- Die vollständigen Docker-Ausgaben bestätigen getrennte Projekte, DB-Namen, Benutzer, Ports, Netzwerke und Volumes.
- Der statische Validator prüft nun zusätzlich, dass DATABASE_URL-Host, User, Passwort und DB mit der jeweiligen Env-Datei übereinstimmen und dass Backend/Frontend kein DB-Volume mounten.

## Hosting-Readiness für Issue #21

Der nächste Prompt konkretisiert die manuelle, reproduzierbare Vorbereitung des bestehenden Servers, ohne externe Änderungen auszuführen.

Umgesetzt wurde:

- Serveranleitung mit prüfbaren Voraussetzungen, DNS-Fallback über `nslookup`, Secret-Regeln und verpflichtendem Staging-Gate.
- Lokale Server-Curl-Checks, Nginx-Aktivierung, Certbot, Renewal, Produktion und Betrieb in eindeutiger Reihenfolge.
- HTTP-only-Nginx-Beispiele für den ersten Certbot-Lauf sowie vollständige HTTPS-Beispiele mit korrekten Subdomains, Ports und Proxy-Headern.
- Drei explizite Sicherheitsoptionen bis Issue #18: Demo-Daten, Nginx Basic Auth oder Verschiebung der Live-Schaltung.
- Ausfüllbare Readiness- und Acceptance-Dokumente mit Verantwortlichen, Datum, Ergebnis, Risiken und Freigabeentscheidung.
- Keine DNS-, Firewall-, Nginx-, Certbot- oder Serverbefehle wurden lokal ausgeführt.

## Dreizehnter Entwicklungszyklus: Issue #22 CI/CD

Der Prompt fordert automatische CI bei Push/PR sowie ausschließlich manuelle Deployments für Staging und Produktion.

Umgesetzt wurde:

- CI mit Node 22, `npm ci`, Prisma Generate, Typecheck, Tests, Build, drei Compose-Checks, Repository-Validatoren und Docker-Image-Builds.
- Staging-Workflow nur über `workflow_dispatch`, serverseitige `.env.staging`, exakter geprüfter Commit-SHA und interner Healthcheck auf Port 4400.
- Produktionsworkflow nur über `workflow_dispatch` mit expliziter Produktions-, Backup- und Hosting-Abnahmebestätigung sowie internem Healthcheck auf Port 4401.
- SSH mit temporärem Private Key, StrictHostKeyChecking und vorab verifiziertem Known-Hosts-Secret.
- Kein `git reset --hard`; Serveränderungen blockieren Deployment.
- Dokumentation für Pipeline, GitHub Secrets und manuellen Code-/DB-Rollback.
- Bestätigte Live-Domains konsistent auf `.com` korrigiert.
- Kein Auth-System, kein automatisches Backup und kein automatisches Push-Deployment ergänzt.

## Robustere manuelle Deployments

Der Folgeprompt meldet einen nur in GitHub Actions fehlschlagenden Staging-Healthcheck, während derselbe Remote-Ablauf auf dem Server erfolgreich ist.

Umgesetzt wurde:

- Die nicht auf jeder Server-Curl-Version verfügbare Option `--retry-all-errors` wurde aus Staging und Produktion entfernt.
- Beide internen Healthchecks verwenden nun eine portable Schleife mit zwölf Versuchen und fünf Sekunden Pause.
- Sichere Diagnoseausgaben zeigen Arbeitsverzeichnis, Git-Revision/-Status, Docker-/Compose-Version und Containerstatus, aber weder Env-Inhalte noch gerenderte Compose-Werte.
- Bei Fehlern von `docker compose up` oder beim Healthcheck werden automatisch Status sowie die letzten 100 Backend- und PostgreSQL-Logzeilen ausgegeben.
- Alle manuellen Trigger, Produktionsbestätigungen, serverseitigen Env-Prüfungen, Worktree-Schutzregeln und das Deployment des exakt geprüften Commit-SHA bleiben erhalten.
