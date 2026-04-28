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
| Automatisierte Tests | 2 | Teilweise funktional | Minimale Vitest-Unit-Tests fuer Metamodell, Validierung, Impact-Modi, Zyklusvermeidung, Portfolio-Scoring, Normalisierung und Bubble-Groessen. Keine UI-E2E-Tests. |
| Forschungsbezug | 3 | Tatsaechlich funktional | Prompt, Annahmen, Grenzen und Bewertung dokumentiert. |
