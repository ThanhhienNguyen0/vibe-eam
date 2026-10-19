# Evaluation Matrix

## REQ-24 – aktueller lokaler Prüfstand, 19.10.2026

Die damaligen Auth-/Testbewertungen unten sind historisch. Die aktuelle kriteriumsweise Selbsteinstufung, tatsächlich ausgeführte Kommandos und Einschränkungen stehen in [REQ-24_IMPLEMENTATION_EVIDENCE.md](REQ-24_IMPLEMENTATION_EVIDENCE.md). Diese technische Selbstprüfung ersetzt keine unabhängige Freigabe.

| Bereich | Implementierter Prüfgegenstand | Abnahmegrenze |
|---|---|---|
| Lokale Identität und Rollen | bcrypt 12, Admin-Erstregistrierung, exakte DB-/TS-Rollen, frische serverseitige Rolle | Keine E-Mail-Verifikation, Passwortreset oder OIDC |
| Aktionen beider API-Datenpfade | zentrale Matrix, 52 inventarisierte Routen, Default-Ablehnung, 401/403 | Keine allgemeine Sicherheitszertifizierung; bestehende Fachpersistenz bleibt |
| Nutzerverwaltung und Tenantgrenzen | Liste/Anlage/Rollenwechsel, eigener Companykontext, identische 404 für fremde/unbekannte IDs | Globale E-Mail-Konflikte bleiben erkennbar; kein Löschen |
| Transaktionen und Migration | Company-Lock/erneute Akteurprüfung, konkurrierende Demotionen, deterministische atomare `member`-Migration | Bootstrapadmin vor Produktion fachlich bestätigen; keine direkten DB-Administrationsinvarianten |
| Demo-Seed | explizites Dev/Test-Opt-in, private Passwortdatei, exakt drei Rollen, realer Wiederholungstest | Keine Produktionsaccounts, kein automatischer Produktivseed |
| Frontend | Rollenanzeige, passende Aktionen, Admin-Nutzerverwaltung, SSR-Rendering-/Statusregressionen | Keine vollständige Browserbedienungs-/E2E-Prüfung |
| Wartbarkeit und KI-Prozess | ADR, Prompt-/Fehler-/Evidenzspur, gemeinsamer Policykern, Inventar-/DB-Gates | Keine gemessene allgemeine Wartbarkeit; Professorengründe bleiben offen |

## Geltung und REQ-30-Stand vom 18.10.2026

Bewertungen historischer Funktionen gelten für den damals geprüften Legacy-Pfad. Impact, Portfolio, Heatmap, Capability Map und Lifecycle sind keine nachgewiesenen aktuellen Browseransichten. Der aktuelle Browserpfad umfasst Authentifizierung, Sidebar, Diagrammeditor und Metamodel. Funktionale historische Bewertungen werden hier nicht ohne neue fachliche Abnahme aufgewertet.

| REQ-30-Teil | Bewertung / Abnahmegrenze |
|---|---|
| Lint, lokaler Gesamtcheck und PR-Qualität | Versionierte Gates vorhanden; tatsächlich beobachtete Resultate und Grenzen in `REQ-30_IMPLEMENTATION_EVIDENCE.md` |
| Dependencies | Vollständige Audit-Ausgangs-/Endbefunde und begründete Versionsentscheidungen in `security/DEPENDENCY_RISKS.md`; Fail-Schwelle hoch, keine Audit-Suppressions |
| Secret-Scanning | Repository-Scan mit vollständiger Historie, aktuellem Dateisnapshot und Canarytest; native GitHub Secret Protection/Push Protection unbestätigt |
| CodeQL | JS/TS-Advanced-Workflow mit PR/main/Schedule; Remote-Ausführung und Alerttriage separat nachweisen |
| Branch Protection / Review | Offen: klassische Protection nicht lesbar (403), keine Rulesets geliefert; Admin-Nachweis und unabhängige Freigabe erforderlich |
| Wartbarkeit und KI-Prozess | Belegte Hotspots/Änderungsregeln dokumentiert; keine umfassende Wartbarkeits- oder Produktionsreifeaussage |

## Historische Funktionsbewertung mit gezielt aktualisierten Infrastrukturangaben

Bewertung:

- 0 = nicht umgesetzt
- 1 = nur Konzept oder Mock
- 2 = teilweise funktional
- 3 = funktional im MVP
- 4 = robust, getestet, erweiterbar

Status:

- Tatsaechlich funktional = durch Build, API-Test, Datenpruefung oder Codepfad plausibel verifiziert
- Teilweise funktional = laeuft, aber mit fachlichen oder technischen Grenzen
- UI/MVP/Mock = sichtbare oder einfache MVP-Funktion ohne robuste Fachlogik
- Nicht umgesetzt = fehlt

| Anforderung | Bewertung | Status | Kritische Begruendung |
| --- | ---: | --- | --- |
| Projektstruktur | 3 | Tatsaechlich funktional | Geforderte Ordner und Root-Dateien existieren. |
| Installation / Dependencies | 3 | Technisch geprüft, datierter Security-Nachweis erforderlich | `npm ci`; frühere Aussage zu 4 moderaten Meldungen ist überholt. Vorher/Nachher unter `security/DEPENDENCY_RISKS.md`. |
| TypeScript/Build | 3 | Tatsaechlich funktional | `npm run typecheck` und `npm run build` erfolgreich. Minimale Backend-Unit-Tests existieren. |
| Backend Start | 3 | Tatsaechlich funktional | Backend antwortet auf `GET /api/model` mit Seed-Modell. |
| Frontend Start | 3 | Tatsaechlich funktional | Vite-Frontend antwortet mit HTTP 200. Keine automatisierte UI-E2E-Pruefung. |
| EAM-Elemente | 3 | Tatsaechlich funktional | Alle Typen und Attribute vorhanden; Element Create/Patch/Delete API-getestet. |
| Metamodell | 3 | Tatsaechlich funktional | Element-Layer-Zuordnung und die sieben erlaubten Source/Relation/Target-Kombinationen sind zentral definiert und getestet. |
| Relationen | 3 | Tatsaechlich funktional | Relation Create/Delete API-getestet; Relationstypen werden jetzt semantisch gegen das EAM-Metamodell validiert. |
| Canvas | 2 | Teilweise funktional | React Flow ist implementiert; Sichtbarkeit/Interaktion wurde nicht per Browser-E2E automatisiert geprueft. |
| Eigenschaftenpanel | 2 | Teilweise funktional | Codepfad fuer Bearbeitung vorhanden; API-Patch getestet, aber keine automatisierte UI-Bedienpruefung. |
| Validierung | 3 | Tatsaechlich funktional | Selbstrelation, fehlende Importarrays und fachlich ungueltige Relationen werden abgelehnt. Keine vollstaendige ArchiMate-Semantik. |
| Impact-Analyse | 3 | Tatsaechlich funktional | Zwei Modi: Downstream Business Impact und Upstream Dependencies, rekursiv, mit Pfad, Level und Zyklusvermeidung. |
| Impact Score | 3 | Tatsaechlich funktional | Downstream Impact wird je Element berechnet, nach Elementtyp gewichtet und dedupliziert getestet. |
| Heatmap und Filter | 2 | Teilweise funktional | Code zeigt unabhaengige Filter- und Heatmap-State-Pfade; nicht per visueller E2E-Pruefung validiert. |
| Risk-Cost Portfolio | 3 | Tatsaechlich funktional | Praesentationsfaehige 2x2-X/Y-Bubble-Matrix mit Cost-Achse, Impact-Achse, Risiko-Groesse, Layer-Farbe, Tooltip, Detailkarte, Filtern und einklappbarer kompakter Tabelle. |
| Capability Map | 2 | Teilweise funktional | Dynamisch aus semantisch validierten Relationen berechnet, aber weiterhin ohne Hierarchie und Portfolio-Kennzahlen. |
| Lifecycle Roadmap | 3 | Tatsaechlich funktional | Wird aus echten Modelldaten sortiert und gerendert; einfache Tabelle statt echter Timeline. |
| Import/Export | 3 | Tatsaechlich funktional | Export/Import Roundtrip war modellgleich. Import validiert Struktur und semantische Relationen, aber keine Schema-Versionierung. |
| Audit Log | 3 | Tatsaechlich funktional | Create, Update, Delete und Import erzeugten Eintraege. Keine Before/After-Diffs. |
| REST API | 3 | Tatsaechlich funktional | Alle geforderten Endpunkte wurden mindestens einmal technisch angesprochen. |
| Seed-Daten | 3 | Tatsaechlich funktional | 12 Elemente und 12 Relationen vorhanden. |
| Dokumentation | 3 | Tatsaechlich funktional | Metamodell, Impact-Analyse, Validierung und Reflexion dokumentiert. |
| Auth/Deployment | 3 | Teilweise funktional | JWT/bcrypt und Company-Isolation implementiert; Docker und manuelle Deploymentworkflows vorhanden. Kein vollständiges RBAC; externe Governance/Produktionsfreigabe nicht nachgewiesen. |
| Automatisierte Tests | 3 | Teilweise funktional | 69 Backendtests; zusätzliche REQ-30-Gateregressionen separat. Keine echte PostgreSQL-Integration und keine UI-E2E-Tests. |
| Forschungsbezug | 3 | Tatsaechlich funktional | Prompt, Annahmen, Grenzen und Bewertung dokumentiert. |
| Metamodel Rule Builder | 3 | Tatsaechlich funktional | Component Types, Connection Types, Source-/Target-Regeln und Viewpoints sind in Sidebar-Datenmodell, Backend-Routen und UI editierbar. |
| Stakeholder Viewpoints | 3 | Tatsaechlich funktional | Management, Business Owner, Application Owner, IT Operations und Full Architecture View werden mit erlaubten und verpflichtenden Typen bereitgestellt. |
| Diagram Validation | 3 | Tatsaechlich funktional | Reine Validierungslogik prueft Verbindungskombinationen, Viewpoint-Regeln und Pflichtregeln; Backend lehnt harte Regelverstoesse ab. |
| Metamodel Visualization | 3 | Tatsaechlich funktional | Neue Metamodel-Ansicht zeigt Regeluebersicht und SVG-Grafik mit Viewpoint-Filter. |
| Explicit ConnectionRule model | 3 | Tatsaechlich funktional | ConnectionRule ist als eigene Struktur implementiert und primaere Quelle fuer Verbindungsvalidierung. |
| Class-diagram-like metamodel documentation | 3 | Tatsaechlich funktional | `docs/METAMODEL_CLASS_MODEL.md` dokumentiert Klassen, Beziehungen und Mermaid-Klassendiagramm. |
| Stakeholder as model element | 3 | Tatsaechlich funktional | Stakeholder bleibt ComponentType; Regeln fuer `responsible_for` und `interested_in` sind explizit modelliert. |
| Viewpoint-aware validation | 3 | Tatsaechlich funktional | Validierung prueft erlaubte Component Types, Connection Types und ConnectionRules je Viewpoint. |
| ViewpointRule | 3 | Tatsaechlich funktional | ViewpointRule trennt Sichtbeschreibung von erlaubten und verpflichtenden Regelmengen; alte Viewpoint-Felder bleiben Legacy. |
| ValidationRule | 3 | Tatsaechlich funktional | Typbezogene Mindestbeziehungen werden als strukturierte Regeln geprueft und als Warnungen/Fehler ausgegeben. |
| Diagram-to-Metamodel conformance | 3 | Tatsaechlich funktional | Diagramme erhalten `metamodelId`; fehlende Bestandswerte werden gegen das aktive Metamodel normalisiert. |
| Structured ValidationResult | 3 | Tatsaechlich funktional | ValidationResult wird pro Lauf erzeugt und Meldungen enthalten Severity, Scope und RuleType. |
| Fachliche Diagramme | 3 | Tatsaechlich funktional | Mermaid-Quellen und erklaerende Markdown-Dateien liegen unter `docs/diagrams`; SVG/PNG-Export ist wegen fehlendem Mermaid-Renderer bewusst nur als Render-Hinweis dokumentiert. |
| Metamodel UI usability | 3 | Tatsaechlich funktional | Metamodel-Ansicht ist in Header, Filter und Tabs gegliedert; Typen, Regeln, Viewpoints und ValidationRules sind getrennt sichtbar. |
| Rule Graph readability | 3 | Teilweise funktional | Rule Graph nutzt Simplified/Detailed/Viewpoint-Modi, gruppierte Kantenlabels, BPMN-Ausblendung, berechenbares Layout und Regel-Limit; keine automatische Layout-Engine. |
| Diagram export/readme | 3 | Tatsaechlich funktional | `docs/diagrams/README.md` dokumentiert Quellen, Zwecke und Rendering-Optionen. |
| Metamodel JSON export/import | 3 | Tatsaechlich funktional | Backend exportiert und importiert das Regelwerk als eine JSON-Struktur; Import validiert Pflichtfelder, IDs und Referenzen. |
| Reproduzierbarkeit | 3 | Tatsaechlich funktional | Default-EAM-Metamodell liegt als JSON-Datei vor und kann ueber die UI heruntergeladen werden. |
| Kundenspezifische Anpassbarkeit | 3 | Teilweise funktional | Kunden koennen Metamodel JSON importieren; MVP nutzt Replace statt Merge und hat noch keinen vollstaendigen visuellen JSON-Preview. |
| Metamodel JSON format documentation | 3 | Tatsaechlich funktional | `docs/METAMODEL_JSON_FORMAT.md` beschreibt Struktur, Pflichtfelder, Referenzregeln und Importmodus. |
| PostgreSQL/Prisma data model | 3 | Tatsaechlich funktional | Prisma-Schema und Migration bilden alle Hauptentitaeten, Fremdschluessel und JSONB-Felder ab; im laufenden PostgreSQL-Container ist eine abgeschlossene Migration nachgewiesen. |
| Database persistence | 3 | Tatsaechlich funktional | Der laufende Sidebar-Pfad verwendet Prisma/PostgreSQL; Sidebar-Daten, Diagramm-Aggregat und Metamodel-Export wurden read-only per HTTP geprüft. Destruktive Integrationstests fehlen. |
| Cascade delete | 3 | Teilweise funktional | Source- und Target-Fremdschluessel deklarieren `ON DELETE CASCADE`; State-Verhalten ist getestet, die echte PostgreSQL-Kaskade noch nicht live provoziert. |
| Diagram aggregate loading | 3 | Tatsaechlich funktional | `GET /api/sidebar/diagrams/:id` wurde gegen den laufenden DB-Stack erfolgreich aufgerufen und liefert Komponenten und Verbindungen. |
| Database seed/migration | 3 | Tatsaechlich funktional | Laufender Stack enthält abgeschlossene Prisma-Migration und erwartete Seed-Daten; JSON-Kopie bleibt zusätzlich geschützt verfügbar. |
| Docker Compose | 3 | Konfiguration geprüft | Drei Compose-Dateien, 111 statische Checks; erneuter Containerstart/DB-Integration unter REQ-30 nicht behauptet. Image-Build bleibt CI-Gate. |
| Environment separation | 3 | Tatsaechlich funktional | Staging und Produktion haben eigene Compose-Projekte, DB-Namen, Benutzer, Loopback-Ports und explizit getrennte Named Volumes. Containerstarts wurden bewusst nicht parallel erzwungen. |
| Production hosting preparation | 2 | Teilweise funktional | Serverpraktische Anleitung, Readiness- und Abnahmecheckliste decken Voraussetzungen, Staging-Gate, Produktion, Betrieb, Backup und Rollback ab; kein externer Server wurde verändert. |
| HTTPS preparation | 2 | Teilweise funktional | HTTP-only-Erstkonfigurationen und vollständige Nginx-Beispiele für Certbot, Redirect, TLS-Proxying und Basic-Auth-Hooks liegen vor; DNS/Zertifikate sind nicht live eingerichtet. |
| Continuous integration / REQ-30 | 3 | Codeprüfungen und externe Governance getrennt | CI enthält Lint, Typecheck, 69 Backendtests, Build, drei Compose-Konfigurationen, Repository-Validatoren, Gate-Regressionen und Image-Builds; zusätzlich Dependency-/Secret-Jobs und separater CodeQL-Workflow. Remote-Ergebnis und externe Required Checks siehe `REQ-30_IMPLEMENTATION_EVIDENCE.md`. |
| Manual staging deployment | 2 | Teilweise funktional | workflow_dispatch prüft den Ref und deployt anschließend den unveränderlichen geprüften SHA per SSH mit serverseitiger Env-Datei und internem Healthcheck. GitHub Secrets/Environment müssen extern eingerichtet und ein erster Lauf abgenommen werden. |
| Manual production deployment | 2 | Teilweise funktional | Kein Push-Trigger; Bestätigung, Backup, Hosting-Abnahme, Verify-Job, SSH-Host-Key-Prüfung und interner Healthcheck sind vorgesehen. Kein Produktionslauf wurde aus diesem Schritt ausgelöst. |
