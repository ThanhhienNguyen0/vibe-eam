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
| npm install | 3 | Tatsaechlich funktional | `npm install` erfolgreich, aber 2 moderate npm vulnerabilities bleiben. |
| TypeScript/Build | 3 | Tatsaechlich funktional | `npm run typecheck` und `npm run build` erfolgreich. Keine Test-Suite. |
| Backend Start | 3 | Tatsaechlich funktional | Backend antwortet auf `GET /api/model` mit Seed-Modell. |
| Frontend Start | 3 | Tatsaechlich funktional | Vite-Frontend antwortet mit HTTP 200. Keine automatisierte UI-E2E-Pruefung. |
| EAM-Elemente | 3 | Tatsaechlich funktional | Alle Typen und Attribute vorhanden; Element Create/Patch/Delete API-getestet. |
| Relationen | 3 | Tatsaechlich funktional | Relation Create/Delete API-getestet; erlaubte Typen validiert. |
| Canvas | 2 | Teilweise funktional | React Flow ist implementiert; Sichtbarkeit/Interaktion wurde nicht per Browser-E2E automatisiert geprueft. |
| Eigenschaftenpanel | 2 | Teilweise funktional | Codepfad fuer Bearbeitung vorhanden; API-Patch getestet, aber keine automatisierte UI-Bedienpruefung. |
| Validierung | 3 | Tatsaechlich funktional | Selbstrelation wird abgelehnt; Import ohne Arrays liefert 400. Fachsemantik wird nicht validiert. |
| Impact-Analyse | 3 | Tatsaechlich funktional | Traversal entlang ausgehender `uses` und `depends_on` anhand Seed-Graph geprueft. Andere Richtungen/Typen bewusst ignoriert. |
| Heatmap und Filter | 2 | Teilweise funktional | Code zeigt unabhaengige Filter- und Heatmap-State-Pfade; nicht per visueller E2E-Pruefung validiert. |
| Capability Map | 2 | Teilweise funktional | Dynamisch aus Relationen berechnet, aber nur heuristisch und read-only. |
| Lifecycle Roadmap | 3 | Tatsaechlich funktional | Wird aus echten Modelldaten sortiert und gerendert; einfache Tabelle statt echter Timeline. |
| Import/Export | 3 | Tatsaechlich funktional | Export/Import Roundtrip war modellgleich. Nur JSON-Strukturvalidierung, keine Semantikvalidierung. |
| Audit Log | 3 | Tatsaechlich funktional | Create, Update, Delete und Import erzeugten Eintraege. Keine Before/After-Diffs. |
| REST API | 3 | Tatsaechlich funktional | Alle geforderten Endpunkte wurden mindestens einmal technisch angesprochen. |
| Seed-Daten | 3 | Tatsaechlich funktional | 12 Elemente und 12 Relationen vorhanden. |
| Dokumentation | 3 | Tatsaechlich funktional | Geforderte Dokumente plus Self-Test-Report vorhanden. |
| Auth/Deployment | 0 | Nicht umgesetzt | Bewusst ausserhalb des MVP. |
| Automatisierte Tests | 1 | UI/MVP/Mock | Keine Unit-, Integration- oder E2E-Test-Suite. Nur manuelle/API-Smoke-Tests. |
| Forschungsbezug | 3 | Tatsaechlich funktional | Prompt, Annahmen, Grenzen und Bewertung dokumentiert. |
