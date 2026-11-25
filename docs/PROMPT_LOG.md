# Prompt Log

## 05.–06.11.2026 – REQ-26 / Issue #58

Auftrag: REQ-26 „Optimistic Locking“ vollständig und nachvollziehbar auf dem noch nicht nach `main` gemergten REQ-33-Head `dd14b162ef611ccd7706e540416b1a5edf174f7e` umsetzen; dessen `main`-Basis ist `8868629a8727c99bc5472e65dc261d49ebb34c0c`. Branch: `codex/eam/req-26-optimistic-locking`. Gefordert waren serverseitige Objektversionen, atomare Konflikterkennung für PATCH/DELETE, verständliche UI-Optionen „Neu laden“ und „Bewusst überschreiben“, Schutz aller aktiven Schreibpfade einschließlich Diagrammen, CSV/XLSX-, REQ-33- und Legacy-Import sowie echte Mehrprozess-PostgreSQL-Tests. REQ-23, Push, PR, Merge, Issue-Close und Deployment bleiben außerhalb des Auftrags.

Umsetzung: Komponenten, Relationen und Diagramme erhalten serverseitige Versionen; Whole-State-Operationen verwenden eine getrennte `Company.dataRevision`. Objektmutationen prüfen `If-Match` direkt in atomaren `updateMany`-/`deleteMany`-Operationen. Die UI behält lokale Entwürfe, lädt auf Wunsch den Serverstand oder wiederholt nach ausdrücklicher Überschreibwahl mit der zuletzt gemeldeten Serverversion; ein weiterer Zwischenwrite erzeugt erneut einen Konflikt. CSV/XLSX-Commit und REQ-33-Import sind an die zuvor gelesene Datenrevision gebunden. Die historische `/api/model`-API verwendet eine DB-Zeilensperre statt Prozesscache.

Tatsächliche Korrekturschleifen: Ein erster echter DB-Lauf zeigte, dass Read-Normalisierung unzulässige Whole-State-Schreibwirkungen auslöste und ein Legacy-GET einen vor der Initialisierung gelesenen ETag zurückgab; beide Ursachen wurden behoben und im vollständigen DB-Lauf erneut geprüft. Prisma-Artefakte mussten nach der sauberen Installation regulär erzeugt werden. Der im Systempfad gefundene Eintrag `docker` war kein nutzbares Programm; die echte Docker-CLI unter Docker Desktop validierte alle drei Compose-Konfigurationen. Die Linux-Engine-Pipe blieb jedoch nicht verfügbar, deshalb wird kein lokaler Image-Build behauptet. Keine Laufzeit, kein menschlicher Anteil und keine unabhängige Freigabe wurden erfunden.

Unabhängige Ablehnung und Nacharbeit: Der Kontrollchat lehnte `7c1079e6748adacee1dfed8f87220e03d0c78b92` wegen inkonsistent möglicher Sidebar-Snapshots, pauschaler Whole-State-Versionssprünge und nicht atomarem Create-and-Place, getrennter Legacy-Body-/ETag-Lesevorgänge samt ABA, unwirksamer UI-Reload-Semantik und überzeichneter Testclaims ab. Der Folgeauftrag verlangte Ursachekorrekturen, reproduzierende Mehrprozess-/DB-/React-Tests, vollständige Gates, aktuelle Scan-Zahlen und einen neuen lokalen Commit ohne Push/PR. Umgesetzt wurden `RepeatableRead`, inhaltsbasierte Versionen, ein atomarer Create-and-Place-Endpunkt, ein einzeiliger Legacy-Snapshot mit monotonen Importversionen sowie revisionsgebundene Editorinstanzen.

Zweite unabhängige Ablehnung und Nacharbeit: Der Kontrollchat lehnte auch den vollständig geprüften Head `6cfaec668507865d0b37f835565de7400beab015` ab. Festgestellt wurden die gegensätzliche Sperrreihenfolge Whole-State Company→Objekt versus Einzelmutation Objekt→Company, fehlende Diagrammversionssprünge bei kaskadiert entfernten Mitgliedschaften, eine vor dem Write erzeugte veraltete Diagrammversion in der Create-and-Place-Antwort sowie eine unzureichend SHA-gebundene Abschlussdokumentation. Der Folgeauftrag verlangte die Ursachenbehebung, deterministische PostgreSQL-Lockbarrieren, Kaskaden-/Rollback-/Mehrprozess- und Antwortversionsregressionen, vollständige lokale Gates und genau einen neuen lokalen Commit. Die zweite Korrektur vereinheitlicht die Sperrreihenfolge, behandelt `P2034` als Locking-Konflikt, versioniert betroffene Diagramme in derselben Transaktion und bildet die Antwort aus dem gespeicherten Zustand. Der isolierte PostgreSQL-Lauf bestand mit 31 von 31 Tests; Push, PR, Merge, Issue-Close und Deployment blieben ausgeschlossen.

## 04.11.2026 – REQ-33 / Issue #65

Auftrag: REQ-33 als ersten Schritt der Sequenz REQ-33 → REQ-26 → REQ-23 auf exakt `origin/main` `8868629a8727c99bc5472e65dc261d49ebb34c0c` implementieren. Gefordert waren ein vollständiger aktueller JSON-Vertrag statt eines Legacy-Teilformats, `schemaVersion`, JSON Schema, deterministischer echter PostgreSQL-Roundtrip, klare Legacy-/Future-Fehler, portable IDs, Tenant-/Rollenisolation, atomare Fehler, Ausschluss von Benutzern/Secrets/Auditverlauf, Regression bestehender Teilformate sowie wahrheitsgemäße Forschungs- und Prüfdokumentation. Kein Push, PR, Merge, Issue-Close, Deployment oder Beginn von REQ-26.

Umsetzung: neuer Vertrag unter `/api/sidebar/model/export|import`, Ajv-validiertes Draft-07-Schema, vollständige semantische Referenzprüfung, tenant-neutrale Datei-IDs mit Ziel-Tenant-Materialisierung, Admin-only Replace-Import und transaktionaler Audit-Summary. Die erste direkte-ID-Lösung wurde nach dem DB-Befund company-präfixierter Starter-IDs verworfen. Ausgeführte Fehlversuche und Sandbox-Wiederholungen stehen in `REQ-33_JSON_MODEL_TRANSFER.md` und `AI_REFLECTION_LOG.md`; keine Laufzeit- oder KI-Anteile wurden erfunden.

## 05.11.2026 – REQ-33-Nacharbeit nach unabhängiger Ablehnung

Die unabhängige Kontrolle lehnte Head `6b9201b96d373fd1d420c3b0a0db7a4d79cf8a64` ab: Ein Metamodellwechsel ließ den alten Company-Modellgraphen zurück, der Import umging vorhandene Relation-/Diagrammregeln, die Präfixentfernung konnte zwei zulässige IDs kollabieren, und die dokumentierte Secret-Scan-Zahl gehörte nicht zum geprüften Head.

Der Folgeauftrag verlangt reproduzierte Fehler, einen transaktionalen vollständigen Replace bei wechselnder Metamodell-ID, Wiederverwendung externer IDs, bestehende Domänenvalidatoren auf dem importierten Gesamtzustand, eine bijektive deterministische ID-Abbildung, Export-Selbstvalidierung, neue Unit-/API-/PostgreSQL-Gegenbeispiele sowie vollständige lokale Gates und einen neuen Commit. Push, PR, Merge, Issue-Close und Freigabebehauptung bleiben untersagt; der neue Head geht erneut an dieselbe unabhängige Kontrolle.

## 05.11.2026 – Zweite REQ-33-Nacharbeit nach unabhängiger Ablehnung

Die erneute unabhängige Kontrolle bestätigte die vier vorherigen Findings als behoben, lehnte Head `7236452514c00f842a33a95e46783072aceff2ac` jedoch wegen zweier neuer Befunde ab: `metamodel.createdAt` wurde beim Upsert eines vorhandenen Ziel-Metamodells nicht übernommen, und mehrere ViewpointRules für denselben Viewpoint erreichten erst die DB-Composite-Unique-Constraint mit HTTP 500.

Der Folgeauftrag verlangt die eigene Reproduktion, einen systematischen Abgleich aller exportierten Upsert-Felder und importrelevanten Composite-Unique-Constraints, Cross-Tenant-Zeitstempel-/Nullable-Regressionsfälle, verständliche 400-Fehler vor Mutation, vollständige lokale Gates, frisches PostgreSQL und einen erst nach dem neuen Commit dokumentierten Secret-Scan. Push, PR, Merge und Freigabebehauptung bleiben untersagt.


## REQ-24 – Authentifizierung und Rollenmodell (19.10.2026)

Auftrag aus Umsetzungs-Chat `01a154a2-45c9-78b2-9b0d-3e1fb5d6a623`, delegiert durch Kontrollchat `01a14fce-41f9-7302-8f9b-873a6e0a2c51`: „Setze REQ-24 ‚Authentifizierung und Rollenmodell (Admin, Architekt, Viewer)‘ ... vollständig, wartbar und nachvollziehbar um.“ Issue [#56](https://github.com/ThanhhienNguyen0/vibe-eam/issues/56) wurde am 19.10.2026 gelesen. Der Issuetext nennt fünf Akzeptanzkriterien und OIDC-Erweiterbarkeit als Hinweis; der Auftrag behandelt diesen Hinweis ausdrücklich als sechsten Prüfpunkt.

Verbindliche Basis: `origin/main` exakt `2f21cfed4e1e56826e2b13590aea9d5649e59050`. Sauberer Ausgangsarbeitsbaum bestätigt. Der getrennte Dependabot-Checkout `89a8a8e2` bleibt unberührt; REQ-24 entsteht im verwalteten separaten Arbeitsbaum auf `codex/eam/req-24-rbac`. Lokaler veralteter `main` wird nicht als Basis verwendet. Kein Push, PR, Merge oder Issue-Close. Bestehende REQ-30-Gates bleiben verpflichtend.

Fachliche Konkretisierung des Auftrags (verbindlich): „Admin: alle Lese- und Schreibrechte innerhalb der eigenen Company; zusätzlich Nutzer-/Rollenzuordnung und Metamodelländerungen.“ „Architekt: alle Lesezugriffe sowie Schreibzugriffe auf Architekturinstanzen, Beziehungen und Diagramme; keine Nutzer-/Rollenverwaltung und keine strukturellen Metamodelländerungen.“ „Viewer: ausschließlich Lesezugriffe.“ Frontendausblendung ist nur Bedienbarkeit; API ist Autorität. Matrix und Ausnahmen für Nutzerverwaltung stehen in `AUTH.md`.

Weitere Promptvorgaben: zentraler typisierter Deny-by-default-Layer; frische serverseitige Rollen statt acht Stunden Vertrauen in Claims; Enum und sichere `member`-Migration; Erstregistrierung als Admin; Nutzerliste/Anlage/Rollenwechsel company-lokal; globale E-Mail-Eindeutigkeit; keine Passwörter in Antworten/Logs; kein Cross-Company-Zugriff; Sperre für den letzten Admin auch unter Konkurrenz; vollständiges Routeninventar beider Datenpfade; sichere, explizite Dev/Test-Seeds je Rolle; kein OIDC jetzt. Test- und Dokumentationspflichten werden in der kriteriumsweisen Evidenzmatrix aufgelöst.

Forschungsrahmen aus dem Auftrag: „Das Projekt untersucht, ob und inwiefern ein EAM-Tool mittels KI ‚gevibecodet‘ werden kann.“ Prompt, Entscheidungen, Alternativen, Fehlversuche, KI-Beitrag, Tests und Grenzen sind ebenso zu dokumentieren wie Code. Die konkreten Gründe der Professorenkritik bleiben unbekannt; keine Zuschreibung aus eigenen Codebefunden.

Folgeanweisungen vom 19.10.2026:

1. Unabhängiger Kontrollchat: `01a154a2-d3b0-70c3-9a30-a130659a071d` (Host `local`). Fertiger lokaler Commit und reproduzierbare Ergebnisse werden erst nach vollständiger Selbstprüfung gemeldet. Kontrolle implementiert nicht; Befunde gehen in eine Korrekturschleife. Selbstprüfung ist keine Freigabe.
2. Nutzerkorrektur zur Modellwahl: „Verwende ab diesem Turn für die weitere REQ-24-Umsetzung gpt-5.6-sol mit Reasoning High.“ Diese Anweisung wird als Prozessvorgabe dokumentiert; eine nachträgliche Behauptung über nicht verfügbare Laufzeittelemetrie wird daraus nicht abgeleitet. Keine Scopeänderung und keine Verwerfung vorhandener Arbeit.
3. Kontrollbefund zum Commit `16035678a1f0e813932e10b8f92d60a3e32230f9`: keine P0–P2-Befunde in Code, Migration, Seed, Rollenmatrix oder lokalen Tests. P3: Statusdokumente bezeichneten die unabhängige Abnahme weiter als offen und es fehlte der Auditdatensatz mit Zeit, Instanz/Modell, Trennung, Eingaben, Resultaten, Entscheidungen und Grenzen. Korrekturauftrag: `REQ-24_REVIEW.md` ergänzen, Status eng auf „lokal unabhängig bestätigt“ ändern, Secret-History-Grenze 43 lokal verfügbare Commits gegenüber 25 in der Kontrollkopie exakt dokumentieren und einen neuen reinen Dokumentationscommit zur Nachprüfung senden. Kein Push/PR/Merge/Issue-Close.
4. Dokumentationsnachprüfung des Commits `4193adb26bd570ab178aa2659586166a011663a0`: Parent und ausschließlich acht angekündigte Dokumentationsdateien bestätigt, Diffprüfung sauber, Auditdatensatz vollständig und Statusgrenzen konsistent. P3 geschlossen; im lokal geprüften Umfang keine offenen P0–P3. Empfehlung der Kontrollinstanz: Push und anschließender Draft-PR erst nach Titus' separater Freigabe; kein Merge oder Issue-Close, Remote-Nachweise danach separat.
5. Folgeauftrag vom 20.10.2026: „Der PR hat bei den Tests Fehler, die korrigiert werden müssen. Mache alles fertig in den PR.“ PR #88 und sämtliche Check-Runs wurden erneut gelesen. Die normalen CI-/CodeQL-Workflow-Jobs waren erfolgreich; der separate Advanced-Security-Check meldete zwei hohe CodeQL-Befunde. Beauftragt wurden die Korrektur beider Befunde, vollständige lokale Regression, Abgleich mit aktuellem `main` und anschließende Veröffentlichung im bestehenden PR. Der erste lokale Korrekturcommit wurde vor dem Push einer getrennten Folgekontrolle vorgelegt; deren Proxy-, Parser-, Registrierungs- und Dokumentationsbefunde wurden in einer weiteren Korrekturschleife bearbeitet. Kein Merge, Deployment oder Issue-Close ist davon umfasst.

Operative Entscheidungen: DB-Company-Lock statt ungesperrter Adminzählung; Subjekt-only-JWT statt Rollenautorität; deterministischer Bootstrapadmin statt pauschaler Hochstufung; Wiederverwendung des konsistenten Company-Starters nach realem Seedfehler; SSR-Komponententests als proportionale Erweiterung der vorhandenen Vitestarchitektur. Fehlversuche und Grenzen: `AI_REFLECTION_LOG.md`, endgültige Resultate: `REQ-24_IMPLEMENTATION_EVIDENCE.md`.

Die KI erstellte Implementierung, Tests und Dokumentation. Eine getrennte Kontrollinstanz bestätigte die ursprüngliche lokale technische Umsetzung ohne P0–P2-Befund und löste die dokumentierte P3-Korrekturschleife aus. Draft-PR #88 und der erste Remote-Lauf folgten nach Titus' Freigabe; die neue CodeQL-Korrektur wird als eigene Fortschreibung geprüft. Bootstrapadmin-Prüfung vor Produktion, erneuter Remote-Check, Containerausführung, Deployment und menschliche Freigaben bleiben getrennte Schritte. Es wurde kein Forschungsrelease oder Wartbarkeitsnachweis außerhalb dieser technischen Evidenz erzeugt.

## REQ-30 – CI, Qualität und Security (18.10.2026)

Auftrag: Issue #62 ab sauberem `main` `3f5e9e40` vollständig und nachvollziehbar umsetzen; Branch `codex/eam/req-30-ci-security`, kein Direktcommit auf main, kein Merge und kein Issueschließen. Gefordert sind ESLint, reproduzierbarer Gesamtcheck, PR-Qualitäts-/Infrastruktur-Gates, Dependency-Probelauf und begründete Korrekturen, Dependabot, CodeQL, Secret-Scan, externe Admin-Abnahme, Beitrags-/KI-Regeln und belegte Wartbarkeitsdokumentation.

Forschungsrahmen: „Ob und inwiefern ein EAM-Tool mittels KI gevibecodet werden kann.“ Der Professor hat Wartbarkeit grundsätzlich infrage gestellt; konkrete Gründe fehlen teilweise. Keine Gründe hinzuerfinden, sondern Repository-Befunde und offene Evidenzlücke trennen.

KI-Arbeit: offizielle Tooldokumentation geprüft; Konfigurationen, Scanner-/Validatorlogik, gezielte Lintkorrekturen, Paket-/Lockdateiupdates und Dokumentation erstellt. Ausdrücklich keine unangemeldete Implementierung weiterer Requirements. Begründete Majorentscheidungen und sämtliche Fehlversuche: `security/DEPENDENCY_RISKS.md`, `REQ-30_IMPLEMENTATION_EVIDENCE.md`.

Kontrollprozess: Requirement → Implementierung → unabhängige Kontrolle → Evidenz → Merge. Eine getrennte Kontrollinstanz ist beauftragt. Selbstprüfung ersetzt ihre Abnahme nicht. Externe Adminschalter bleiben offen; maßgeblich sind konkrete GitHub-Einstellungs-/Laufnachweise, nicht die Existenz von YAML-Dateien. Übergabe enthält Basisdiff, Branch/Commit/PR, Dateiliste, Prüfresultate und offene Governance.


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

## Issue #18: Authentifizierung und Company-Zugriff

Der Prompt fordert Registrierung, Login und eine harte Company-Isolation für alle EAM-Datenpfade.

Umgesetzt wurde:

- `Company` und `User` mit bcrypt-gehashten Passwörtern sowie verpflichtendem, umgebungsspezifischem `JWT_SECRET`.
- JWT-Endpunkte für Registrierung, Login, aktuellen Nutzer und stateless Logout.
- Schutz aller Sidebar-, Diagramm-, Metamodel-, Legacy-Modell- und Audit-Routen durch Bearer-Authentifizierung.
- Company-Filter im Prisma-Repository sowie company-eigene JSONB-Persistenz für den historischen Architekturmodell-Pfad.
- Migrationssichere Zuordnung vorhandener Daten zur Default Demo Company ohne Löschen bestehender JSON-Daten.
- React-Login/-Registrierung, automatische Authorization-Header, 401-Rückführung und Logout.
- Basic Auth bleibt in Staging/Produktion vorerst als zusätzliche äußere Schutzschicht aktiv.

## REQ-24-Nachkorrektur am 23.10.2026

Nach einem manuellen Rollenreview wurde gemeldet, dass die Viewer-Leseansicht für Komponenten Rohdaten ausgibt. Der Folgeauftrag verlangte, diesen Fehler zu beheben, die Änderung zu begründen und den unabhängigen Kontrollchat für die anschließende PR-Prüfung zu informieren.

Umgesetzt wurde eine fachliche, nicht editierbare Komponentenansicht mit aufgelöstem Typ, Beschreibung, formatierten Eigenschaften und den vorhandenen Verknüpfungen. Ergänzt wurde ein Regressionstest gegen die Ausgabe interner ID-Feldnamen und Schreibaktionen. Da PR #90 bereits für denselben Branch offen ist, ist nach unabhängiger Freigabe dessen Aktualisierung vorgesehen; es wird kein zweiter PR angelegt.

## REQ-24-Nachkorrektur: Rollen und Diagrammansichten am 25.10.2026

Ausgangspunkt war ein iPad-Screenshot mit `viewer@test.de`: Im vollständigen Standarddiagramm erschien nach der Auswahl einer Ansicht eine Fehlermeldung für einen anderen Viewpoint. Zusätzlich war unklar, wo Benutzerrollen vergeben werden und wie Rollen und Diagrammansichten zusammenhängen. Der Auftrag verlangte eine vollständige Korrektur und einen getrennten Kontrollchat.

Umgesetzt wurde:

- Rollen werden im Kopfbereich erklärt; nur Admins erhalten die Nutzerverwaltung und können dort Rollen setzen. Die Nutzerverwaltung enthält eine Rollenübersicht für Admin, Architect und Viewer.
- Diagrammansichten sind ausdrücklich lokale, nicht gespeicherte Inhaltsfilter und keine Benutzerrollen. Der Selector bleibt auch für Viewer bedienbar.
- Projektionen filtern Komponenten und Beziehungen fail-closed nach Viewpoint- und Metamodellregeln. Eine lokale Vorschau ist für Admin und Architect schreibgeschützt.
- Beim Wechsel in eine lokale Vorschau werden begonnene Add-, Drag-, Kontextmenü- und Verbindungsinteraktionen verworfen. Alle persistenten Diagrammmutationen verwenden zusätzlich eine zentrale Schreibschranke.
- Der kanonische Fresh-Company-Starter wird durch alle fünf EAM-Viewpoints projiziert und validiert.
- Der getrennte Kontrollchat `01a1699f-2854-7233-8203-0d9326bbddfe` prüfte jede Korrekturstufe read-only. Das finale Urteil für `74aa718e` lautet: keine offenen P0–P3.

Nicht Teil dieses lokalen Abschlusses sind Push, Aktualisierung von PR #90, neues Staging-Deployment, Liveprüfung oder Produktion.

## REQ-23: Audit Log am 08.11.2026

Der Auftrag verlangte die vollständige Umsetzung von Issue #55 auf der unabhängig akzeptierten REQ-26-Basis, beginnend mit Abnahmematrix und Schreibpfadinventar. Gefordert waren atomare, append-only Anwendungsbelege mit serverseitigem Akteur, Objekt und Felddiff, Elementhistorie, Filter und Cursor, Erhalt beider Legacy-Pfade, echte PostgreSQL-/Mehrprozesstests sowie Backup-, Restore- und Rollbackprobe. Push, PR, Merge, Issue-Schließung und Deployment waren ausdrücklich ausgeschlossen.

Umgesetzt wurden ein gemeinsamer Actor-/Action-/Object-Vertrag, strukturierte Redaction und Größenlimits, die Transaktionsintegration aller Modellschreibpfade, additive Migration mit beweistreuem Legacy-Backfill, tenantgebundene Lese-API und die Audit-/Elementhistorienoberfläche. Der Entwicklungsstand wurde mit isolierter PostgreSQL-14-Instanz, Gesamtgate, Dependency- und Secret-Gate geprüft. Dokumentierte Fehlversuche waren eine lokale Loopback-Sperre, zwei HTTP-504 beim Scannerdownload und eine nicht nutzbare Docker-Platzhalterdatei; daraus wurden keine Produktfehler oder Container-Nachweise abgeleitet.

### Unabhängige Nachkorrektur

Der Exact-Head-Review lehnte `8a9de7a05a84ed6cff49fdd1d843fcc5afd9ba67` mit zwei P1-, einem P2- und einem P3-Befund ab: fehlender DB-seitiger Append-only-Schutz; unbelegte Legacy-Initialisierung und mutierende No-ops; abgeschnittene, nur nach ID gefilterte Elementhistorie; veraltete Basis-/Evidenzangaben. Der Folgeauftrag verlangte DB-Trigger samt Restore/Rollback-Gegenprobe, atomare `system.initialize`-Initialisierung, vollständig stille Legacy-No-ops, typgebundene Cursorhistorien über 20 Einträge und eine commitgebundene Dokuüberarbeitung. Technischer Korrekturhead ist `abff4e90beb91526d759bc645cf4c9e87ece8834`; Push und PR bleiben ausgeschlossen.

Der erste Korrektur-DB-Lauf bestand 38/39: Nach revisionsneutraler Initialisierung war die Importversion gleich statt größer als die vorherige Objektversion. Die Formel wurde auf das Maximum aus nächster Datenrevision und vorheriger Objektversion plus eins korrigiert. Der Wiederholungslauf bestand 39/39 einschließlich Trigger-, No-op-, Pagination-, Backup-/Restore- und Rollbackgegenproben.

### Verbliebener P2 und UI-Nachkorrektur am 09.11.2026

Die unabhängige Kontrolle des Kandidaten `238ca51bc48f55936664aa270807ea48d173cc8b` stellte eine Race-Condition fest: Eine noch laufende zweite Historienseite von Auswahl A konnte nach dem Wechsel zu B auflösen, A-Einträge an B anhängen und B-Cursor sowie B-Ladezustand überschreiben. Der Folgeauftrag beschränkte sich auf einen robusten Schutz für Erst- und Folgeanfragen, einen deterministischen React-Gegenfall, die vier Nachweisdokumente und vollständige lokale Gates; Push, PR, Merge, Issue-Schließung und Deployment blieben ausgeschlossen.

Der technische UI-Korrekturhead `b57d2f42176651fa82c4454fb6ed79693f317dd9` bindet alle asynchronen Zustandsänderungen an eine pro Auswahl fortgeschriebene Anfragegeneration. Der Gegenfall A Seite 1 → A Seite 2 offen → Wechsel B → B Seite 1 → B Seite 2 offen → verspätete A Seite 2 schützt B-Inhalte, B-Cursor und B-Ladezustand. Der gezielte Test bestand 3/3; das vollständige Gate bestand mit 174 Backendtests, 39 erwartungsgemäß übersprungenen DB-Tests und 43 Frontendtests.

### Exact-Head-Freigabe und Draft-PR am 09.11.2026

Die getrennte Kontrollinstanz prüfte den unveränderten Produkthead `b0d7e4b07b4d627cd96f4a09857761c9ed33ee5a` gegen Basis `805b281d4f99f7f4bc0db8c9c66b0d1646ea5926` und erteilte im geprüften Umfang die technische Freigabe ohne offene P0–P3. Sieben von sieben erweiterten Race-Gegenproben für verspätete Erfolge, Fehler, `finally`, Auswahlwechsel und Unmount bestanden. Der Branch wurde anschließend veröffentlicht und Draft-PR #98 gegen `main` angelegt. GitHub bestätigte den exakten Head und die exakte Basis; `Quality and infrastructure`, `Dependency security`, `Secret security`, `CodeQL JavaScript TypeScript` und die CodeQL-PR-Auswertung waren erfolgreich. Menschliches Review, Merge, Issue-Schließung, Staging und Produktion bleiben offen. Der folgende reine Dokumentationscommit wird nicht gepusht.

## REQ-03 und REQ-02 am 01.11.2026

Auftrag: Issue #35 (REQ-03, Mehrere Views auf ein gemeinsames Repository) lesen, prüfen, was der Sidebar-/Diagramm-Pfad bereits abdeckt, und zusammen mit Issue #34 (REQ-02, Duplikaterkennung) umsetzen. REQ-28 (Persistenz auf PostgreSQL) war bereits erledigt.

Bestandsaufnahme vor der Umsetzung: Diagramme referenzierten Elemente bereits per ID (Join-Tabellen aus REQ-28); „Aus Diagramm entfernen“ und eine Diagrammliste im Eigenschaftenpanel existierten. Es fehlten die Lösch-Warnung mit betroffenen Diagrammen, eine klar benannte Repository-Löschung im Diagramm und jede Form der Duplikaterkennung. Beim Löschen aus der Sidebar blieben außerdem die gelöschten IDs im Frontend-State der Diagramme stehen, bis neu geladen wurde.

Umgesetzt wurde:

- Backend `componentDuplicates.ts`: Namensnormalisierung, Duplikatsuche je Komponententyp, `warnings` im Response von POST/PATCH `/api/sidebar/components` und Audit-Log-Eintrag bei Duplikat (`recordAuditEvent` im bestehenden Audit Log).
- Frontend `repositoryReferences.ts`: identische Normalisierung, „Verwendet in“-Abfragen, State-Bereinigung beim Löschen und Bestätigungstexte. `DuplicateHint.tsx` wird im Canvas-Anlegedialog und im Eigenschaftenpanel verwendet.
- Diagramm-Kontextmenü: neue Aktion „Aus Repository löschen…“ neben „Aus Diagramm entfernen“. In der Sidebar heißt die Löschaktion für Komponenten und Verbindungen nun ebenfalls „Aus Repository löschen“.
- Panelüberschrift „Verwendet in“; eindeutige Standardnamen („Neue Komponente 2“) für die Schnellanlage.
- Tests: 6 Backendtests (Regeln und API inklusive Audit) und 9 Frontendtests (Regeln, Parität mit dem Backend, Rendering, Lösch-Warnung). Eine bestehende Rollen-Assertion wurde an den neuen Button-Titel angepasst, ohne die geprüfte Aussage zu ändern.

### Nachkorrekturen nach manuellem Test (01.–02.11.2026)

- Duplikatprüfung zusätzlich für Komponenten- und Verbindungstypen (Warnung, Audit, Hinweis im Typ-Editor, eindeutige Standardnamen).
- Alle Lösch-Abfragen als eigenes Popup (`ConfirmDialog.tsx`) statt `window.confirm`; Fokus standardmäßig auf „Abbrechen“.
- Ursache „Änderungen nicht sichtbar“: Getestet wurde der Docker-Stack, der erst nach `docker compose up -d --build` den neuen Code enthält; zusätzlich waren einzelne Dateien durch einen Editor-Speichervorgang auf einen älteren Stand zurückgefallen und wurden wiederhergestellt.
- Fehler aus dem Test behoben: kurzes Aufblitzen des Hinweises beim normalen Anlegen (neues Element fand sich selbst), veralteter Panel-Entwurf nach Umbenennung in der Sidebar, fehlender Hinweis direkt beim Umbenennen in der Sidebar-Zeile, fehlender Hinweis bei gleichem Namen mit anderem Typ für frisch angelegte Elemente.
- Manueller Test durch die Nutzerin/den Nutzer am 02.11.2026: REQ-02-Tests 1–8 und REQ-03-Tests bestanden.

### Re-Integration auf aktuellem main am 09.11.2026

PR #92 wurde gemergt, bevor der REQ-03/REQ-02-Code gepusht war; er enthielt nur einen Merge von `main` (Lockfiles). Issues #35 und #34 wurden dadurch automatisch geschlossen, obwohl der Code fehlte. Der lokale Commit wurde auf einen neuen Branch vom aktuellen `main` übertragen und mit REQ-23, REQ-26, REQ-31 und BUG-02 zusammengeführt:

- Duplikat-Audit nutzt jetzt das REQ-23-Business-Event `duplicate.accepted` in derselben Transaktion statt des Legacy-Audit-Logs; `store.ts` bleibt unverändert gegenüber `main`.
- Duplikatprüfung auch im neuen Anlegepfad `POST /diagrams/:id/components`.
- Alle Lösch- und Speicheraktionen behalten das Optimistic Locking aus REQ-26 (`If-Match`, Konfliktdialog); „Aus Repository löschen…“ und „Vorhandenes Element verwenden“ senden die Objektversion.
- Popup auch für die neue Katalog-Löschung aus REQ-31; Umbenennungsfeld zeigt die Typ-Icons aus BUG-02.

## BUG-03: doppelte Smart-Add-Mitgliedschaften am 11.11.2026

Ausgangsstand war `main` auf `5dd4195fea20ea0e49801e13473bc46ddc851670`, dokumentiert in GitHub-Issue #104. Beim Hinzufügen von „ERP System“ zeigte der Smart-Add-Dialog mehrere auswählbare Beziehungen zu denselben Komponenten. „Mit Auswahl hinzufügen“ übernahm die Ziel-Komponenten pro ausgewählter Beziehung ungefiltert in `componentIds`. Die PostgreSQL-Join-Tabelle erlaubt dagegen jede Diagramm-Komponenten-Zuordnung nur einmal; der daraus entstehende Persistenzfehler erreichte den generischen HTTP-500-Handler. Abgewählte Zeilen konnten bei einem erneuten Versuch wieder erscheinen, weil der fehlgeschlagene Request keine Diagrammänderung gespeichert hatte und die Vorschläge aus dem unveränderten Repository neu berechnet wurden.

Umgesetzt wurden:

- eine zentrale, getestete Zusammenführung, die Komponenten- und Verbindungsmitgliedschaften vor dem PATCH stabil dedupliziert und nur tatsächlich neue Nachbarn positioniert;
- eine Erklärung im Dialog, dass jede Zeile eine Beziehung darstellt, sowie eine Nummerierung mehrerer Beziehungen zur gleichen Komponente;
- identische Frontend-/Backend-Validierungsfehler für doppelte Komponenten- und Verbindungs-IDs, sodass ungültige direkte API-Payloads vor der Persistenz als fachlicher HTTP-400-Fehler abgelehnt werden;
- Regressionstests für mehrere Beziehungen zum selben Nachbarn, „Nur Komponente“, bestehende Mitgliedschaften und die API-Grenzvalidierung.

Nachweise: gezielt 5/5 Frontend- und 22/22 Backend-Regeltests; vollständiges `npm run check` mit 184 bestandenen und 39 übersprungenen Backendtests, 104 bestandenen Frontendtests, Lint, Typechecks, Builds, 113 Compose-, 169 Workflow- und 17 Securityprüfungen; drei reale Compose-`config --quiet`-Läufe; Dependency-Scan ohne hohe/kritische Befunde bei 10 weiter dokumentierten moderaten Befunden; vollständiger Secret-Scan ohne Fund. Ein erster Check scheiterte am gesperrten Prisma-Download, der nächste an einem einmaligen Vitest-Workerabbruch in `rbac.test.ts`; der isolierte Rollentest bestand anschließend 14/14 und der vollständige Wiederholungslauf bestand. Nicht belegt sind Browser-E2E, Image-Build, PostgreSQL-Integration, unabhängiges Review, Remote-CI, Merge oder Deployment.

## Paket „Speichern & Validierung“ (#109, #113, #108, #111) am 25.11.2026

Auftrag: Die vier Issues aus Paket 1 der Feedback-Triage umsetzen, in der dort festgelegten Reihenfolge: #109, dann #113 und #108 zusammen, zuletzt #111. Ausgangsstand war `main` auf `9a669217c6d43ac78dcd5ff818b5b6edab30465a`, Branch `feedback_speicherung_und_validierung`.

Befunde vor der Umsetzung:

- #109: Das Interaktions-Overlay meldete auch einen reinen Klick als beendete Verschiebung. `onNodeTransformEnd` speicherte dann Position und gemessene Größe, was eine neue Diagrammversion und einen Audit-Eintrag erzeugte. Bei Knoten ohne gespeicherte Größe kam die Standardgröße als neuer Diff hinzu.
- #113: Sidebar und Diagrammübersicht legten sofort „Neue Komponente“ oder „Neues Diagramm“ an und boten erst danach das Umbenennen an.
- #108: `PATCH /components/:id` prüfte den Namen nicht. Leere Namen kamen über das Detail-Panel oder direkte API-Aufrufe durch.
- #111: `PATCH /components/:id` prüfte bei einem Typwechsel weder den neuen Typ noch die bestehenden Verbindungen.

Umgesetzt wurde:

- #109: `changedNodeLayout` in `diagramLayout.ts` vergleicht Start und Ende einer Geste (nach dem Einrasten) und gibt bei keiner Änderung `null` zurück. Breite und Höhe werden nur geschrieben, wenn sie schon gespeichert waren oder sich geändert haben. Das Overlay übergibt dafür den Startzustand.
- #113/#108: Eine gemeinsame Namensregel `nameRules.ts` im Backend und gespiegelt im Frontend lehnt leere Namen und reine Leerzeichen ab und speichert getrimmt. Platzhalter (auch nummeriert) brauchen eine ausdrückliche zweite Bestätigung (siehe Nachkorrektur unten). Die Regel greift bei allen Anlege- und Änderungsrouten für Komponenten und Diagramme. Ein unveränderter Alt-Platzhalter blockiert andere Änderungen nicht. Der neue `CreateElementDialog` fragt Name und bei Komponenten den Typ ab, bevor etwas gespeichert wird. Detail-Panel, Umbenennen in der Sidebar und der Anlegedialog im Diagramm zeigen den Fehler am Feld und sperren das Speichern.
- #111: `connectionsInvalidAfterTypeChange` (Backend und gespiegelt im Frontend) prüft alle Verbindungen der Komponente mit dem neuen Typ. Der Server lehnt unzulässige Typwechsel mit HTTP 400 ab und nennt die Verbindungen. Das Detail-Panel zeigt sie schon bei der Typauswahl und sperrt „Speichern“.
- Der Pflicht-Owner aus #108 wurde nach der Triage bewusst weggelassen, er gehört zum Owner-Konzept aus #36.
- Tests: 14 Routentests (`saveValidation.test.ts`), 4 Regeltests (`nameRules.test.ts`) und 3 Typwechseltests (`metamodelRules.test.ts`) im Backend, 6 Layouttests (`diagramLayout.test.ts`) und 8 UI- und Paritätstests (`saveValidation.test.tsx`) im Frontend.

Nachweise vom 25.11.2026: vollständiges `npm run check` mit Exit 0: Lint ohne Warnungen, Typechecks, 205 bestandene und 39 übersprungene Backendtests (Datenbanktests ohne lokales PostgreSQL), 118 bestandene Frontendtests, Builds, 113 Compose-, 169 Workflow- und 17 Securityprüfungen, Prisma-Konfiguration. `npm run scan:dependencies` ohne hohe oder kritische Befunde (9 moderate, wie dokumentiert). `npm run scan:secrets` ohne Fund. Der erste Lauf in Git Bash scheiterte, weil GNU-`tar` den Pfad `D:\…` als Remote-Host las; der Wiederholungslauf in PowerShell mit Windows-`tar` bestand. Alle drei Compose-Konfigurationen bestehen `config --quiet` mit ihren `.env*.example`-Dateien. Nicht belegt: Browser-E2E, manueller Test im Testsystem, Image-Build, PostgreSQL-Integration, unabhängige Kontrolle, Remote-CI, Review und Merge.

### Nachkorrektur nach Rückmeldung (26.11.2026)

Auftrag: Platzhalternamen wie „Neue Komponente“ nicht hart ablehnen, sondern nur warnen. Gespeichert werden soll erst, wenn man den Platzhalter zweimal bestätigt.

- Backend: `checkElementName` nimmt `{ previousName, acknowledgePlaceholder }`. Ohne `acknowledgePlaceholder: true` antwortet der Server weiter mit `NAME_PLACEHOLDER`, mit dem Flag wird gespeichert. Das Flag wird in allen fünf Routen ausgewertet und nie gespeichert. Leere Namen bleiben immer gesperrt.
- Frontend: `placeholderWarning` zeigt die Warnung, `useSecondConfirmation` steuert den Ablauf. Beim ersten Klick auf „Anlegen“ oder „Speichern“ wird nichts gespeichert, sondern gefragt; erst „Ja, mit Platzhalter …“ speichert. Beim Umbenennen in der Seitenleiste entspricht das zwei Mal Enter. Eine Namensänderung setzt die Bestätigung zurück. Gilt im Anlegedialog der Seitenleiste und der Übersicht, im Anlegedialog der Diagrammfläche, im Detail-Panel für Komponenten und Diagramme und beim Umbenennen in der Seitenleiste.
- Tests angepasst und ergänzt: Paritätstest gegen die Serverregel mit und ohne Bestätigung, Zwei-Klick-Ablauf im Dialog und im Detail-Panel, Zurücksetzen bei Namensänderung, Routentests für bestätigte Platzhalter und nicht-boolesche Flags.
- Nachweis vom 26.11.2026: `npm run check` mit Exit 0, 207 bestandene und 39 übersprungene Backendtests, 121 bestandene Frontendtests, Lint, Typechecks, Builds und alle Validatoren. Ein erster Lauf scheiterte am Typecheck einer Testhilfe (falscher Parametertyp), der nach der Korrektur bestand. Manueller Test im Browser steht noch aus.

### CodeQL-Befund im PR (26.11.2026)

CodeQL meldete `js/polynomial-redos` (High) für `/\(?\d+\)?$/` in `nameRules.ts`: Der nicht verankerte Ausdruck probiert jede Startposition und ist bei langen Ziffernfolgen quadratisch. Gemessen: 357 ms für 20 000 Ziffern; ein Name bis zur JSON-Grenze von 2 MB hätte das Backend lange blockiert. Ersetzt in Backend und Frontend durch einen einzigen Rückwärtsdurchlauf (`withoutTrailingNumber`, 0,1 ms für 200 000 Ziffern). Gleichwertigkeit mit dem alten Ausdruck: 19 Randfälle und 200 000 Zufallsstrings ohne Abweichung. Regressionstests für Randfälle und Laufzeit ergänzt. Nachweis: alle Schritte von `npm run check` außer `db:generate` mit Exit 0 (209 bestandene und 39 übersprungene Backendtests, 121 Frontendtests). `db:generate` scheiterte lokal mit EPERM, weil der laufende Dev-Server die Prisma-Engine-DLL gesperrt hielt; das Prisma-Schema ist unverändert.

## #122: Kontextmenü innerhalb des Viewports am 25.11.2026

Auftrag: Issue #122 umsetzen. Das Rechtsklick-Menü ragte unten aus dem Bild, „Aus Repository löschen…“ war dadurch nicht anklickbar. Ausgangsstand war `main` auf `9a669217c6d43ac78dcd5ff818b5b6edab30465a`. Die Nutzerin/der Nutzer fragte, ob #122 und #117 zusammen umgesetzt werden können. Wegen „kleine, fachlich zusammenhängende Änderungen“ (CONTRIBUTING) entstanden sie zuerst auf zwei getrennten Branches von `main`. Auf Wunsch der Nutzerin/des Nutzers wurden beide Commits danach auf den gemeinsamen Branch `feedback_speicherstatus_und_kontextmenue` übertragen, der auf `feedback_speicherung_und_validierung` (PR #146) aufsetzt.

Befund vor der Umsetzung: Das Kontextmenü im Diagramm-Editor wurde mit `position: fixed` genau an der Cursorposition geöffnet und nie verschoben. Das Kontextmenü der Seitenleiste hielt sich bereits per `useLayoutEffect` im Fenster, klappte aber nicht um und war bei sehr kleinen Fenstern über `overflow: hidden` abgeschnitten.

Umgesetzt wurde:

- Neue reine Funktion `fitMenuInViewport` (`contextMenuPosition.ts`): Reicht der Platz unten oder rechts nicht, öffnet das Menü über bzw. links vom Cursor; danach wird es mit 8 px Abstand in das Fenster geschoben. Die Funktion ist idempotent, ein zweiter Durchlauf verschiebt nichts.
- Diagramm-Editor: Ein `useLayoutEffect` misst das Menü vor dem Zeichnen und setzt die passende Position. Die Seitenleiste nutzt dieselbe Funktion statt ihrer eigenen Rechnung.
- CSS `.diagram-context-menu`: `max-height`/`max-width` auf Fenstergröße minus Rand und `overflow-y: auto`, damit in sehr kleinen Fenstern gescrollt statt abgeschnitten wird.
- Tests: 8 Tests in `contextMenuPosition.test.ts` (alle vier Ränder, Ecke, Umklappen, Menü größer als Fenster, Idempotenz).

Nachweise vom 25.11.2026: Lint, Typechecks, 184 bestandene und 39 übersprungene Backendtests, 112 bestandene Frontendtests, Builds, 113 Compose-, 169 Workflow- und 17 Securityprüfungen sowie Prisma-Konfiguration, jeweils Exit 0. `db:generate` scheiterte lokal mit EPERM, weil der laufende Dev-Server die Prisma-Engine-DLL gesperrt hielt; das Prisma-Schema ist unverändert, die übrigen Schritte von `npm run check` wurden einzeln ausgeführt. Nicht belegt: Browser-E2E, manueller Test, unabhängige Kontrolle, Remote-CI, Review und Merge.

## #117: Speicherstatus und fehlgeschlagene Speicherung sichtbar machen am 25.11.2026

Auftrag: Issue #117 umsetzen. Nutzer konnten nicht erkennen, ob Änderungen gespeichert sind oder ein Speichern fehlgeschlagen ist. Ausgangsstand war `main` auf `9a669217c6d43ac78dcd5ff818b5b6edab30465a`; zum Branch siehe #122.

Befund vor der Umsetzung: Es gab keine zentrale Speicheranzeige. Einzelne Formulare zeigten „Speichere…“ am eigenen Button; Fehler erschienen nur dort, wo der Aufrufer sie abfing. Das Verschieben von Knoten speicherte ohne jede Rückmeldung, ein Fehler dabei blieb unsichtbar. Alle Schreibzugriffe auf das Repository laufen über `sidebarApi` und damit über eine Stelle.

Umgesetzt wurde:

- `saveTracker.ts`: zählt jeden schreibenden Request von `sidebarApi` (alles außer GET). Zustände „Alles gespeichert“, „Speichern läuft …“, „Speichern fehlgeschlagen“. Gespeichert gilt erst nach einer 2xx-Antwort; die Routen antworten erst nach dem Datenbankschreiben.
- Vorübergehende Fehler (keine Antwort, 408, 429, 5xx) werden festgehalten: Der Aufrufer wartet weiter, „Erneut versuchen“ sendet den identischen Request in der ursprünglichen Reihenfolge erneut. Bei Erfolg läuft der Aufrufer normal weiter, sein Zustand bleibt konsistent. „Verwerfen“ gibt dem Aufrufer den ursprünglichen Fehler und lädt den gespeicherten Stand neu.
- Endgültige Antworten (4xx: Validierung, Konflikt, Berechtigung) gehen sofort an den Aufrufer wie bisher. Die Anzeige bleibt auf „fehlgeschlagen“ mit dem Servergrund, bis der nächste Schreibvorgang startet oder die Meldung geschlossen wird.
- `SaveStatus.tsx`: Statusanzeige im Kopfbereich (`role="status"`) und ein Fehlerbanner (`role="alert"`) mit Grund und Aktionen. Das Banner liegt über allen Dialogen, weil ein Dialog auf den festgehaltenen Request warten kann.
- Beim Schließen oder Neuladen des Tabs fragt der Browser nach, solange etwas läuft oder nicht gespeichert ist.
- Beim Abmelden und bei abgelaufener Anmeldung (401) wird der Tracker zurückgesetzt. Festgehaltene Requests werden verworfen und nie mit einer anderen Anmeldung erneut gesendet.
- Tests: 26 Tests in `saveTracker.test.ts` (Zustände, Wiederholung, Reihenfolge, Verwerfen, Ablehnung, Abmelden, Fehlerklassifikation, Integration mit `sidebarApi` über gemocktes `fetch`) und 8 Tests in `SaveStatus.test.tsx` (Anzeige und Banner-Aktionen).

Nachweise vom 25.11.2026: Lint, Typechecks, 184 bestandene und 39 übersprungene Backendtests, 138 bestandene Frontendtests, Builds, 113 Compose-, 169 Workflow- und 17 Securityprüfungen sowie Prisma-Konfiguration, jeweils Exit 0. `db:generate` wurde wie bei #122 wegen der vom laufenden Dev-Server gesperrten Prisma-Engine-DLL ausgelassen; das Prisma-Schema ist unverändert. Ein erster Testlauf scheiterte, weil `saveStatus.ts` und `SaveStatus.tsx` auf Windows kollidierten (umbenannt in `saveTracker.ts`), ein zweiter an einer Testhilfe, die Icon-Knoten serialisieren wollte. Nicht belegt: Browser-E2E, manueller Test, unabhängige Kontrolle, Remote-CI, Review und Merge.

### Zusammenführung von #122 und #117 auf dem Stand von PR #146 (25.11.2026)

Beide Commits wurden per Cherry-Pick auf `feedback_speicherstatus_und_kontextmenue` übertragen (Basis `feedback_speicherung_und_validierung` auf `c4e9fb19b9e251d636b4a790c09b4936bf6e9d72`). Der Code ließ sich ohne Konflikte übernehmen; nur die Einträge am Ende dieses Logs und des Reflexionslogs kollidierten und wurden aneinandergehängt. Geprüft wurde außerdem, dass kein Ablauf aus #146 absichtlich eine 4xx-Antwort auslöst: Platzhalter- und Duplikatbestätigungen entscheidet der Client vor dem Senden, das Fehlerbanner erscheint dabei also nicht fälschlich.

Nachweise auf dem zusammengeführten Stand: Lint, Typechecks, 209 bestandene und 39 übersprungene Backendtests, 163 bestandene Frontendtests (121 aus #146 plus 8 für #122 und 34 für #117), Builds, 113 Compose-, 169 Workflow- und 17 Securityprüfungen sowie Prisma-Konfiguration, jeweils Exit 0; `db:generate` wieder wegen der gesperrten Prisma-Engine-DLL ausgelassen. Vor dem Übertragen auf den Ausgangsständen: `npm run scan:dependencies` ohne hohe oder kritische Befunde (9 moderate, wie dokumentiert), `npm run scan:secrets` ohne Fund über die gesamte Historie. Solange PR #146 nicht gemergt ist, enthält ein PR dieses Branches gegen `main` auch dessen Commits.

### #117: Nachkorrektur nach Rückmeldung (25.11.2026)

Auftrag: „Alles gespeichert“ nicht dauerhaft irgendwo im Kopfbereich anzeigen, sondern direkt am Button oder als kleine Meldung im Detail-Panel, beim Speichern, bei Änderungen und beim Anlegen. Die Meldung soll von selbst wieder verschwinden.

- Die dauerhafte Statusanzeige im Kopfbereich wurde entfernt.
- Neuer `SaveButton` für alle Speichern-Buttons im Detail-Panel (Komponente, Verbindung, Diagramm, Komponenten- und Verbindungstyp, Connection Rule, Viewpoint, Katalog): „Speichern …“ mit Drehsymbol, solange der Server nicht geantwortet hat, danach 2,5 Sekunden „✓ Gespeichert“ in Grün. Ändert man in dieser Zeit wieder etwas, zeigt der Button sofort wieder „Speichern“.
- `savedFeedback.ts` hält diese Rückmeldung außerhalb des Panels, weil Komponenten-, Verbindungs- und Diagramm-Panels nach dem Speichern mit der neuen Version neu aufgebaut werden. Gemeldet wird nur nach bestätigtem Speichern; endet ein Konflikt mit „Neu laden“, erscheint nichts.
- Nach dem Anlegen über die Seitenleiste (Komponente, Verbindung, Diagramm, Typen, Connection Rule, Viewpoint, Katalog) und nach dem Umbenennen erscheint unten im Detail-Panel kurz eine Meldung wie „Komponente „CRM“ angelegt und gespeichert.“. Auf der Diagrammfläche gab es solche Meldungen schon.
- Die Anlegedialoge zeigen während des Speicherns „Wird angelegt …“.
- Unverändert bleibt das Fehlerbanner stehen, bis man reagiert. Seine Überschrift beginnt jetzt mit „Speichern fehlgeschlagen:“.
- Tests: 7 neue Tests in `SaveButton.test.tsx` (Button-Zustände, Ablauf, Meldung, Ablauf im echten Detail-Panel mit Neuaufbau, kein „Gespeichert“ nach „Neu laden“); die 4 Tests der entfernten Kopfanzeige entfallen. In `optimisticEditor.test.tsx` findet die Testhilfe den Speichern-Button jetzt über die CSS-Klasse statt über den Text, weil er nach dem Speichern kurz „Gespeichert“ zeigt; die geprüften Aussagen sind unverändert.

Nachweise vom 25.11.2026: Lint, Typechecks, 209 bestandene und 39 übersprungene Backendtests, 166 bestandene Frontendtests, Builds, 113 Compose-, 169 Workflow- und 17 Securityprüfungen sowie Prisma-Konfiguration, jeweils Exit 0; `db:generate` wegen der gesperrten Prisma-Engine-DLL ausgelassen. Der erste Testlauf scheiterte an den zwei Tests in `optimisticEditor.test.tsx`, die den Button am Text „Speichern“ suchten. Nicht belegt: Browser-E2E und manueller Test.

### #117: Bestätigung von Sidebar-Aktionen in der Sidebar (25.11.2026)

Auftrag: Beim Umbenennen in der Seitenleiste erschien die Meldung rechts im Detail-Panel, beim Anlegen ebenfalls dort. Was in der Seitenleiste geändert wird, soll auch dort bestätigt werden, wo man es sieht.

- Anlegen und Umbenennen in der Seitenleiste lassen die betroffene Zeile im Baum 2,5 Sekunden grün mit Häkchen aufleuchten; die Zeile wird bei Bedarf in den sichtbaren Bereich gescrollt. Zusätzlich erscheint unten in der Seitenleiste kurz die Meldung, z. B. „Komponente „Billing“ angelegt und gespeichert.“, auch wenn die Zeile in einer zugeklappten Gruppe liegt.
- Im Detail-Panel erscheint dafür nichts mehr; dort bestätigt nur noch der Speichern-Button Änderungen, die im Panel gemacht wurden.
- Das Anlegen eines Katalogs aus der Katalogübersicht meldet nichts zusätzlich: Der neue Katalog öffnet sich direkt im Hauptbereich.
- Tests: `SaveButton.test.tsx` prüft jetzt Umbenennen und Anlegen in der echten Seitenleiste (Zeile markiert, Meldung unten, beides verschwindet nach 2,5 Sekunden) und dass der Panel-Button Sidebar-Aktionen nicht bestätigt; die Tests der entfernten Panel-Meldung entfallen.

Nachweise vom 25.11.2026: Lint, Typechecks, 209 bestandene und 39 übersprungene Backendtests, 167 bestandene Frontendtests, Builds, 113 Compose-, 169 Workflow- und 17 Securityprüfungen sowie Prisma-Konfiguration, jeweils Exit 0; `db:generate` wegen der gesperrten Prisma-Engine-DLL ausgelassen. Nicht belegt: Browser-E2E und manueller Test.

### #117: Meldung nach endgültigem Löschen (25.11.2026)

Auftrag: Nach dem Löschen ebenfalls kurz melden, dass endgültig gelöscht wurde.

- Seitenleiste (Papierkorb und Kontextmenü, alle acht Elementarten): Nach der Bestätigung durch den Server erscheint unten in der Seitenleiste kurz z. B. „Komponente „CRM“ endgültig aus dem Repository gelöscht.“. Beim Diagramm steht dazu, dass seine Elemente im Repository bleiben. Bricht man den Bestätigungsdialog ab oder endet ein Konflikt mit „Neu laden“, erscheint nichts.
- Diagrammfläche („Aus Repository löschen…“): Die vorhandene Meldung nennt jetzt den Namen und „endgültig“. „Aus Diagramm entfernen“ bleibt bewusst bei „bleibt im Modell erhalten“, weil dort nichts gelöscht wird.
- Tests: zwei neue Tests in `SaveButton.test.tsx` (Meldung nach dem Löschen; keine Meldung nach Abbruch oder vor der Serverantwort).

Nachweise vom 25.11.2026: Lint, Typechecks, 209 bestandene und 39 übersprungene Backendtests, 169 bestandene Frontendtests, Builds, 113 Compose-, 169 Workflow- und 17 Securityprüfungen sowie Prisma-Konfiguration, jeweils Exit 0; `db:generate` wegen der gesperrten Prisma-Engine-DLL ausgelassen. Ein erster Testentwurf für einen abgelehnten Löschversuch erzeugte eine unbehandelte Promise-Ablehnung, weil der Papierkorb-Button Fehler nicht abfängt (vorbestehend; in der App zeigt das Fehlerbanner den Grund). Er wurde durch einen Test ersetzt, der belegt, dass vor der Serverantwort nichts gemeldet wird. Nicht belegt: Browser-E2E und manueller Test.
