# Evaluation Matrix

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
| npm install | 3 | Tatsaechlich funktional | `npm install` erfolgreich, aber nach Phase 2 bleiben 4 moderate npm vulnerabilities. |
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
| Auth/Deployment | 0 | Nicht umgesetzt | Bewusst ausserhalb des MVP. |
| Automatisierte Tests | 3 | Teilweise funktional | 44 Vitest-Tests fuer Metamodell, Validierung, Import/Export, Persistenzvertrag, Cascade-State-Verhalten, Impact und Portfolio. Keine echte PostgreSQL-Integration und keine UI-E2E-Tests. |
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
| Docker Compose | 3 | Tatsaechlich funktional | Lokaler Stack läuft mit PostgreSQL, Backend und Frontend; alle drei Compose-Dateien bestehen `docker.exe compose config` und 108 zusätzliche statische Checks. |
| Environment separation | 3 | Tatsaechlich funktional | Staging und Produktion haben eigene Compose-Projekte, DB-Namen, Benutzer, Loopback-Ports und explizit getrennte Named Volumes. Containerstarts wurden bewusst nicht parallel erzwungen. |
| Production hosting preparation | 2 | Teilweise funktional | Serverpraktische Anleitung, Readiness- und Abnahmecheckliste decken Voraussetzungen, Staging-Gate, Produktion, Betrieb, Backup und Rollback ab; kein externer Server wurde verändert. |
| HTTPS preparation | 2 | Teilweise funktional | HTTP-only-Erstkonfigurationen und vollständige Nginx-Beispiele für Certbot, Redirect, TLS-Proxying und Basic-Auth-Hooks liegen vor; DNS/Zertifikate sind nicht live eingerichtet. |
