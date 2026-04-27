# EAM Expert Review

## Fachliche Bewertung

Der Prototyp ist ein EAM-inspirierter Graph-Prototyp, aber noch kein fachlich belastbares EAM-Tool. Er verwendet EAM-Begriffe, bietet Layer, Elementtypen, Relationen, eine einfache Impact-Analyse, Heatmap, Capability Map und Roadmap. Damit geht er ueber einen komplett generischen Graph-Editor hinaus.

Fachlich bleibt die Umsetzung aber stark vereinfacht. Es fehlt ein konsistentes Metamodell, es fehlen erlaubte Relationstypen pro Elementtyp, es fehlt Governance-Logik, und zentrale EAM-Fragen wie Business-IT-Alignment, Applikationsportfolio-Management, Technologiestandardisierung, Zielarchitektur und Transformationsplanung werden nur angerissen.

Kurzurteil:

- Als Forschungsartefakt fuer "Kann KI schnell einen EAM-aehnlichen Prototyp erzeugen?" ist der Prototyp geeignet.
- Als Minimalwerkzeug fuer fachlich ernsthafte EAM-Arbeit ist er nur eingeschraenkt brauchbar.
- Als echtes EAM-Tool ist er noch deutlich zu generisch.

## Ist Es EAM-Spezifisch Oder Nur Ein Generischer Graph-Editor?

Der Prototyp ist nicht nur ein generischer Graph-Editor, weil er EAM-nahe Fachobjekte vorgibt:

- Business Capability
- Business Process
- Application Component
- Data Object
- Technology Node
- Risk, Cost, Status, Lifecycle-Daten
- Capability Map
- Lifecycle Roadmap

Die eigentliche Fachlogik ist jedoch duenn. Ein generischer Graph-Editor mit Labels koennte einen grossen Teil der aktuellen Funktionalitaet abbilden. EAM-Spezifik entsteht derzeit vor allem durch Benennung, Seed-Daten und einige separate Views, nicht durch ein starkes fachliches Regelwerk.

Fachliches Defizit:

- Keine Zielbilder oder Transition Architectures.
- Keine Standards, Principles, Constraints oder Architecture Decisions.
- Keine Ownership-, Stewardship- oder Governance-Prozesse.
- Keine differenzierte Applikationsportfolio-Sicht.
- Keine EAM-typischen Kennzahlen wie Business Criticality, Technical Fit, Functional Fit, Strategic Fit, Lifecycle Risk oder Redundancy.

## Business, Application, Data Und Technology Layer

Die Layer sind als grobe Struktur sinnvoll unterscheidbar:

- Business: Capabilities und Prozesse
- Application: Application Components
- Data: Data Objects
- Technology: Technology Nodes

Die Trennung ist aber fachlich nur teilweise belastbar. Die App erlaubt strukturell jede Relation zwischen allen Elementen, solange Source und Target existieren. Es gibt keine fachliche Regel, dass z. B. eine Application Capability realisiert, ein Process eine Capability realisiert, eine Application Data Objects nutzt oder Technology Nodes Applications hosten.

Problematisch:

- `Business Capability` und `Business Process` liegen beide im Business Layer, aber ihre Semantik wird nicht klar getrennt.
- `Technology Node` ist sehr grob. Es fehlen Technology Services, Platforms, Devices, System Software, Cloud Services oder Environments.
- `Data Object` bleibt isoliert. Es fehlen Data Ownership, Data Classification, CRUD-Nutzung, Schnittstellen, Datenfluesse und Datenschutzanforderungen.
- Layer sind optische und filterbare Kategorien, aber kein semantisch validiertes EAM-Metamodell.

## Relationstypen

Die Relationstypen sind grundsaetzlich nachvollziehbar, aber zu grob und uneinheitlich:

- `uses`: fachlich plausibel, aber unscharf. Es kann Daten-, Applikations-, Technologie- oder Prozessnutzung bedeuten.
- `depends_on`: fuer technische und organisatorische Abhaengigkeiten plausibel, aber nicht spezialisiert.
- `realizes`: EAM-nahe, z. B. Prozess realisiert Capability oder Application realisiert Application Service. Im Prototyp ist nicht festgelegt, wer was realisieren darf.
- `serves`: EAM-/ArchiMate-nahe, aber ebenfalls nicht typgebunden.

Das Problem ist weniger die Auswahl der Begriffe als ihre fehlende Semantik. Ein echtes EAM-Werkzeug muesste mindestens erlaubte Source-/Target-Kombinationen, Richtung, Bedeutung und Auswertung je Relationstyp definieren.

Beispiele fuer fehlende Relationstypen:

- supports
- hosted_on
- stores
- reads
- writes
- exposes
- integrates_with
- owns
- governed_by
- replaces
- decommissions
- standardizes

## Impact-Analyse

Die Impact-Analyse ist technisch funktional, aber fachlich nur ein erster Ansatz. Sie traversiert ausgehend entlang `uses` und `depends_on` und hebt gefundene Elemente hervor.

Brauchbar fuer:

- einfache technische Abhaengigkeitsketten
- schnelle Demo: "Wenn dieses Element betroffen ist, was nutzt es oder wovon haengt es ab?"
- Explorieren kleiner Seed-Modelle

Fachliche Grenzen:

- Keine Wahl der Traversalrichtung. EAM-Impact-Fragen sind oft rueckwaerts: "Welche Capabilities/Prozesse/Applications sind betroffen, wenn diese Datenbank ausfaellt?"
- `serves` und `realizes` werden ignoriert, obwohl sie fuer Business Impact zentral sein koennen.
- Keine Gewichtung nach Kritikalitaet, Risiko, Kosten, Lifecycle oder Business Value.
- Keine Unterscheidung zwischen technischer, fachlicher, regulatorischer und finanzieller Auswirkung.
- Keine Pfadanzeige. Nutzer sehen betroffene Elemente, aber nicht warum sie betroffen sind.
- Keine Szenarien wie Decommissioning, Migration, Security Incident oder Vendor Risk.

Fachliches Urteil: Fuer EAM-Zwecke als Demo brauchbar, fuer echte Entscheidungsunterstuetzung nicht ausreichend.

## Capability Map

Die Capability Map ist mehr als eine statische Anzeige, weil sie Business Capabilities aus Modelldaten liest und Applications ueber Relationen indirekt zuordnet.

Trotzdem ist sie fachlich nur teilweise sinnvoll:

- Sie zeigt keine Capability-Hierarchie.
- Sie unterscheidet keine Capability-Level.
- Sie kennt keine Business Owner, Value Streams, Domains oder strategische Ziele.
- Sie zeigt Applications nur ueber eine enge Heuristik: Application `serves` Process und Process `realizes` Capability.
- Sie zeigt keine Redundanz, Abdeckung, Pain Points, Investment, Maturity oder Strategic Importance.
- Risiko-Heatmap basiert auf Capability-Risiko, nicht auf aggregiertem Risiko der unterstuetzenden Applications oder Technologien.

Fachliches Urteil: Als MVP-Visualisierung akzeptabel, aber noch keine echte Capability-Based Planning View.

## Lifecycle Roadmap

Die Lifecycle Roadmap nutzt echte Modelldaten (`startDate`, `endOfLifeDate`, `status`) und ist damit nicht nur Mock. Sie ist aber tabellarisch und fachlich flach.

Brauchbar fuer:

- erste Uebersicht ueber geplante, aktive, deprecated und retired Elemente
- einfache Identifikation von End-of-Life-Daten
- Demo fuer datengetriebene Roadmap-Sicht

Fachliche Grenzen:

- Keine Zeitachse mit Phasen, Meilensteinen oder Releases.
- Keine Abhaengigkeiten zwischen Vorhaben.
- Keine Transformationsprogramme, Projekte oder Work Packages.
- Keine Soll-/Ist-Architektur.
- Keine Migrationspfade, Parallelbetrieb, Ablosung oder Zielplattformen.
- Keine Kapazitaeten, Budgets, Priorisierung oder Entscheidungsstatus.

Fachliches Urteil: MVP-funktional, aber fuer Roadmapping im EAM-Kontext noch zu einfach.

## Erfuellte EAM-Aspekte

- Grundstruktur ueber Business-, Application-, Data- und Technology-Layer.
- Modellierung einfacher Architekturartefakte.
- Gerichtete Relationen zwischen Architekturartefakten.
- Einfache Impact-Analyse auf Graphbasis.
- Risiko- und Kostenattribute.
- Lifecycle-Status und End-of-Life-Datum.
- Capability-orientierte Sicht.
- Roadmap-Sicht aus Modelldaten.
- Import/Export zur Modellportabilitaet.
- Audit Log als erster Governance-Hinweis.

## Oberflaechliche Oder Generische Aspekte

- Layer sind eher Labels als fachlich validierte Schichten.
- Relationstypen sind nicht durch ein Metamodell eingeschraenkt.
- Risk ist ein einfaches Feld statt einer bewertbaren Risikodimension.
- Cost ist ein einzelner Zahlenwert ohne Zeitraum, Waehrung oder Kostenart.
- Status ist ein einfacher Lifecycle-Wert ohne Governance-Workflow.
- Custom Attributes ersetzen teilweise fehlendes Fachmodell.
- Heatmap ist technisch brauchbar, aber fachlich nicht aggregiert oder methodisch begruendet.
- Audit Log ist technisch, aber noch keine Architektur-Governance.
- Capability Map ist eine gefilterte/abgeleitete Karte, aber keine echte Capability-Planung.
- Roadmap ist eine Tabelle, keine Transformationsplanung.

## Anforderungen Aus Der Ursprungsliste, Die Nur Oberflaechlich Umgesetzt Sind

- Canvas: technisch vorhanden, aber fachlich kein EAM-Modellierungsstandard.
- Validierung: strukturell, nicht fachlich-semantisch.
- Impact-Analyse: Graph-Traversal, aber keine EAM-spezifische Impact-Methodik.
- Heatmap: einfache Farbgebung, keine aggregierte Portfolioanalyse.
- Capability Map: keine Hierarchie, keine strategische Bewertung, keine echte Capability-Abdeckung.
- Lifecycle Roadmap: einfache Elementliste, keine Transformationsroadmap.
- Audit Log: Ereignisprotokoll, keine Governance oder Freigabeprozesse.
- Import/Export: JSON roundtrip, aber kein Standardformat und keine Schema-Versionierung.

## Fehlende EAM-Kernfunktionen

Fuer ein echtes EAM-Tool waeren mindestens folgende Funktionen wichtig:

- Fachliches Metamodell mit erlaubten Element- und Relationstypen.
- Capability-Hierarchie mit Leveln, Domains und Business Ownern.
- Application Portfolio Management mit Business Criticality, Technical Fit, Functional Fit, Lifecycle, Owner, Vendor und Kostenstruktur.
- Technology Portfolio mit Standards, Lifecycle, Obsoleszenz und Compliance.
- Datenarchitektur mit Data Ownership, Klassifikation, CRUD-Matrix, Schnittstellen und Datenfluesse.
- Schnittstellen-/Integrationsmodellierung zwischen Applications.
- Zielarchitektur, Ist-Architektur und Gap-Analyse.
- Transformationsroadmap mit Initiativen, Projekten, Work Packages, Meilensteinen und Abhaengigkeiten.
- Bewertungsmodelle fuer Risiko, Kosten, Wert, Fit und Maturity.
- Governance-Workflow fuer Review, Approval, Change History und Verantwortlichkeiten.
- Such-, Reporting- und Dashboard-Funktionen.
- Rollen/Rechte, zumindest fuer Viewer, Editor und Architect.
- Versionierung, Baselines und Vergleich von Architekturstaenden.
- Import/Export mit Schema-Versionierung oder Anbindung an bekannte Formate.
- Qualitaetsregeln und Modellkonsistenzpruefungen.

## Risiken Durch KI-Generierte Annahmen

- EAM-Begriffe wirken plausibel, sind aber nicht methodisch sauber verankert.
- `uses`, `depends_on`, `realizes` und `serves` koennen je nach Framework anders interpretiert werden.
- Die Richtung von Relationen kann fachlich falsch verstanden werden, besonders fuer Impact-Analysen.
- Capability Map kann eine Scheingenauigkeit erzeugen, weil Application-Zuordnung nur aus wenigen Relationstypen abgeleitet wird.
- Risiko-Heatmap suggeriert Bewertungsreife, obwohl Risiko nur manuell als `low`, `medium`, `high` gepflegt wird.
- Kostenanalyse kann irrefuehrend sein, weil Zeitraum, Waehrung, CapEx/OpEx und Aggregation fehlen.
- Lifecycle Roadmap kann als Transformationsplanung missverstanden werden, obwohl sie nur Elementdaten tabellarisch darstellt.
- Custom Attributes koennen fehlendes Fachmodell verdecken und spaeter zu inkonsistenten Daten fuehren.
- Seed-Daten koennen eine fachliche Vollstaendigkeit vortaeuschen, die im Metamodell nicht abgesichert ist.

## Empfehlung Fuer Den Naechsten MVP-Schnitt

Der naechste MVP sollte nicht primar mehr UI-Flaeche bauen, sondern EAM-Fachlichkeit schaerfen.

Empfohlener Schnitt:

1. Metamodell definieren
   - erlaubte Elementtypen je Layer
   - erlaubte Relationstypen je Source-/Target-Typ
   - klare Relationrichtung und Beschreibung
   - Schema-Version fuer Import/Export

2. Capability-Based Planning verbessern
   - Capability-Hierarchie einfuehren
   - Business Owner, strategic importance, maturity und pain points
   - Application Coverage je Capability
   - aggregierte Risiko-/Lifecycle-Sicht aus unterstuetzenden Applications

3. Application Portfolio fachlich ausbauen
   - Business Criticality
   - Technical Fit
   - Functional Fit
   - Lifecycle Phase
   - Owner, Vendor, Annual Cost
   - Empfehlung: tolerate, invest, migrate, eliminate

4. Impact-Analyse EAM-tauglicher machen
   - Traversalrichtung waehlbar machen
   - Pfade anzeigen
   - Relationstypen konfigurierbar machen
   - Impact nach Business, Application, Data und Technology gruppieren
   - Business Impact fuer technische Ausfaelle rueckwaerts berechnen

5. Roadmap zu Transformationssicht erweitern
   - Initiativen oder Work Packages als eigene Objekte
   - Ist-/Soll-Bezug
   - Migrations- und Ablosungsrelationen
   - Meilensteine und Abhaengigkeiten

6. Governance minimal einfuehren
   - Owner-Felder
   - Review Status
   - simple Approval-Markierung
   - Audit Log mit Before/After-Diffs

Prioritaet fuer den Forschungszweck:

Der wertvollste naechste Schritt ist ein kleines, explizites EAM-Metamodell mit semantischer Validierung. Dadurch wird aus einem EAM-inspirierten Graphen ein fachlich unterscheidbarer EAM-Prototyp.
