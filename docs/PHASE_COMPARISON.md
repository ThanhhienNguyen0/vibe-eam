# Phase Comparison

## Phase 1: Ausgangszustand

Phase 1 lieferte einen technisch lauffaehigen EAM-inspirierten Web-Prototypen.

Umgesetzt waren:

- React/Vite/TypeScript Frontend
- Express Backend
- JSON-Persistenz
- Canvas mit React Flow
- EAM-nahe Elementtypen
- gerichtete Relationen
- Eigenschaftenpanel
- einfache strukturelle Validierung
- Impact-Analyse
- Heatmap und Filter
- Capability Map
- Lifecycle Roadmap
- Import/Export
- Audit Log
- Basisdokumentation

Die fachliche Schwaeche von Phase 1 lag darin, dass das Modell noch stark graphartig war. Relationen wurden im Wesentlichen strukturell validiert: Source und Target mussten existieren, aber Source-Typ, Relationstyp und Target-Typ waren fachlich noch nicht eng genug gebunden. Die Impact-Analyse war technisch funktional, aber semantisch zu grob.

## Phase 2: Verbesserungen

Phase 2 hat keine grossen neuen UI-Flaechen eingefuehrt, sondern die EAM-Fachsemantik verbessert.

Ergaenzt wurden:

- explizites EAM-Metamodell
- feste Elementtyp-zu-Layer-Zuordnung
- sieben erlaubte Source/Relation/Target-Kombinationen
- semantische Backend-Validierung fuer Relationserstellung
- semantische Importvalidierung
- Frontend-Einschraenkung auf erlaubte Relationstypen
- zwei Analysemodi:
  - Downstream Business Impact
  - Upstream Dependencies
- rekursive Analyse mit Zyklusvermeidung
- Ergebnisliste mit Pfad, Level, Relationstyp, Elementtyp und Layer
- minimale Vitest-Unit-Tests fuer Metamodell, Validierung, Impact-Modi und Zyklusvermeidung
- aktualisierte Dokumentation fuer Metamodell, Impact-Analyse und Validierung

## Besser Erfuellte Anforderungen

### Validierung

Phase 1 validierte vor allem strukturell. Phase 2 validiert auch fachlich:

- `Data Object serves Business Capability` wird abgelehnt.
- `Application Component realizes Business Capability` wird nach Nachschaerfung abgelehnt.
- Importierte Relationen muessen dem Metamodell entsprechen.

### EAM-Spezifik

Der Prototyp ist nach Phase 2 klarer von einem generischen Graph-Editor unterscheidbar. Das Metamodell erzwingt EAM-nahe Modellierungsregeln statt beliebiger Kanten.

### Impact-Analyse

Phase 1 war eine einfache Graphsuche. Phase 2 unterscheidet fachlich:

- Business Impact ausgehend von einem betroffenen Element.
- Dependencies ausgehend von einem Element, dessen Abhaengigkeiten analysiert werden.

Die Analyse nutzt jetzt auch `serves` und `realizes` und erklaert Ergebnisse ueber Pfade.

### Testbarkeit

Phase 1 hatte nur Smoke-Tests und manuelle Pruefung. Phase 2 ergaenzt minimale Unit Tests fuer reine Fachfunktionen.

## Welche Grenzen Bleiben?

- Kein vollstaendiges ArchiMate-, TOGAF- oder BPMN-Metamodell.
- Keine Capability-Hierarchie.
- Keine Application-Portfolio-Bewertung.
- Keine Business Criticality, Technical Fit oder Functional Fit.
- Keine Datenarchitektur mit CRUD, Ownership oder Klassifikation.
- Keine Schnittstellenmodellierung.
- Keine Zielarchitektur, Gap-Analyse oder Transformationsroadmap.
- Keine Governance Workflows.
- Keine Rollen/Rechte.
- Keine Versionierung oder Baselines.
- Keine automatisierten UI-E2E-Tests.
- Keine robuste Schema-Versionierung fuer Import/Export.
- JSON-Persistenz bleibt ein MVP-Kompromiss.

## Aussage Zu KI-Gestuetztem Vibe Coding

Der Vergleich zeigt zwei Dinge:

Erstens kann KI-gestuetztes Vibe Coding schnell einen technisch lauffaehigen Prototypen erzeugen. Phase 1 hatte bereits Canvas, API, Persistenz, Import/Export, Audit Log und mehrere Sichten.

Zweitens entsteht fachliche Qualitaet nicht automatisch durch plausible Begriffe. Erst die explizite Nachspezifikation in Phase 2 fuehrte zu messbar besserer EAM-Semantik: Metamodell, semantische Validierung, klarere Impact-Regeln und Tests.

Damit ist der Prototyp ein gutes Forschungsartefakt: Er zeigt sowohl die Staerke der KI bei schneller Umsetzung als auch die Notwendigkeit menschlicher Fachpruefung, klarer Begriffsarbeit und iterativer Nachschaerfung.
