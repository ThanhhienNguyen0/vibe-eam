# Prompt Log

## Startprompt

Der Startprompt fordert einen autonomen Senior-Fullstack-Entwicklungsagenten auf, einen lauffaehigen Web-Prototypen eines EAM-Tools als Forschungsartefakt zu bauen. Gefordert sind React, TypeScript, Vite, React Flow, Node.js, Express, REST API, JSON-Datei oder SQLite, kein echtes Auth-System, einfache lokale Starts, Seed-Daten, Canvas, Eigenschaftenpanel, Validierung, Impact-Analyse, Heatmap, Capability Map, Roadmap, Import/Export, Audit Log und Dokumentation.

## Wichtige Entscheidungen Waehrend Der Umsetzung

- JSON-Dateipersistenz wurde gegenueber SQLite gewaehlt, weil sie fuer den MVP schneller stabil und nachvollziehbar ist.
- Node-Positionen werden als `position` im Element gespeichert, obwohl dieses Feld nicht in den fachlichen Mindestattributen stand. Das ist fuer persistentes Canvas-Layout notwendig.
- Die API akzeptiert beim Import ein komplettes Modell und ersetzt das aktuelle Modell, sofern die Validierung erfolgreich ist.
- Die Capability Map verwendet eine pragmatische Zuordnungslogik: `Application Component` dient einem `Business Process`; der Prozess realisiert eine `Business Capability`.
- Impact-Analyse laeuft entlang ausgehender `uses` und `depends_on` Relationen.
- Kosten-Heatmap nutzt einfache Schwellenwerte unter 100000, ab 100000 und ab 180000.
- Audit Log speichert kurze Ereignisbeschreibungen statt vollstaendiger Change-Diffs.
- `npm run typecheck`, `npm run build`, Backend-Smoke-Test auf `GET /api/model` und Frontend-Smoke-Test auf `http://localhost:5173` wurden erfolgreich ausgefuehrt.
