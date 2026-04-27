# EAM Expert Review

## Fachliche Bewertung

Der Prototyp ist nach Phase 2 klar EAM-spezifischer als ein generischer Graph-Editor. Er besitzt nun ein explizites, wenn auch kleines, EAM-Metamodell mit festen Element-Layer-Zuordnungen, erlaubten Source/Relation/Target-Kombinationen und semantischer Relationvalidierung. Die Impact-Analyse ist nicht mehr nur eine einfache `uses`/`depends_on`-Suche, sondern unterscheidet Downstream Business Impact und Upstream Dependencies.

Trotzdem bleibt der Prototyp ein MVP. Er ist fachlich besser abgesichert als in Phase 1, aber noch kein vollstaendiges EAM-Tool. Zentrale EAM-Disziplinen wie Application Portfolio Management, Capability-Based Planning, Zielarchitektur, Transformationsplanung, Governance, Standards und Bewertungsmodelle sind weiterhin nur angedeutet oder fehlen.

Kurzurteil:

- Als Forschungsartefakt fuer KI-gestuetztes Vibe Coding ist der Prototyp deutlich aussagekraeftiger als nach Phase 1.
- Als EAM-MVP ist er jetzt fachlich unterscheidbar von einem generischen Graph-Editor.
- Als echtes EAM-Tool ist er weiterhin unvollstaendig.

## EAM-Spezifik Gegenueber Generischem Graph-Editor

Der Prototyp ist jetzt mehr als ein Graph-Editor mit Labels, weil Relationen nicht mehr beliebig sind. Das Metamodell erlaubt nur sieben definierte Kombinationen:

- `Business Process realizes Business Capability`
- `Application Component serves Business Process`
- `Application Component uses Data Object`
- `Application Component depends_on Technology Node`
- `Application Component depends_on Application Component`
- `Data Object depends_on Technology Node`
- `Technology Node depends_on Technology Node`

Das ist eine messbare fachliche Verbesserung. Ein generischer Graph-Editor wuerde solche Source-/Target-Regeln nicht erzwingen.

Weiterhin generisch oder oberflaechlich bleiben:

- Risk ist nur `low | medium | high`, ohne Bewertungsmethode.
- Cost ist nur eine Zahl, ohne Zeitraum, Waehrung oder Kostenart.
- Status ist nur ein Feld, kein Governance-Workflow.
- Custom Attributes ersetzen weiterhin fehlende fachliche Modellteile.
- Views wie Capability Map und Roadmap sind einfache Ableitungen, keine vollstaendigen EAM-Arbeitsbereiche.

## Business, Application, Data Und Technology Layer

Die Layer sind nach Phase 2 fachlich besser abgesichert:

- Business Capability -> Business
- Business Process -> Business
- Application Component -> Application
- Data Object -> Data
- Technology Node -> Technology

Die Validierung prueft, dass Elementtypen dem richtigen Layer zugeordnet sind. Relationen sind typgebunden. Dadurch sind die Layer nicht mehr nur optische Kategorien.

Fachliche Grenzen bleiben:

- Business Capability und Business Process haben keine Hierarchie, Owner oder strategische Gewichtung.
- Application Component ersetzt mehrere ArchiMate-nahe Konzepte wie Application Component, Application Service und Interface.
- Data Object kennt keine CRUD-, Ownership-, Klassifikations- oder Datenschutzsemantik.
- Technology Node ist sehr grob und unterscheidet keine Plattformen, Services, Devices oder Environments.

## Relationstypen

Die Relationstypen sind jetzt fachlich nachvollziehbarer, weil Richtung und erlaubte Elementkombinationen definiert sind.

- `uses`: Eine Application Component nutzt ein Data Object.
- `depends_on`: Eine Application, ein Data Object oder ein Technology Node haengt von einem anderen technischen oder applikativen Element ab.
- `serves`: Eine Application Component unterstuetzt einen Business Process.
- `realizes`: Ein Business Process operationalisiert eine Business Capability.

Die Semantik ist noch bewusst klein. Es fehlen weiterhin wichtige Relationstypen wie `hosted_on`, `integrates_with`, `reads`, `writes`, `owns`, `replaces`, `decommissions` oder `governed_by`.

## Impact-Analyse

Die Impact-Analyse ist nach Phase 2 fachlich deutlich brauchbarer. Sie bietet zwei Modi:

- Downstream Business Impact: Welche Elemente sind betroffen, wenn das ausgewaehlte Element ausfaellt, geaendert oder ersetzt wird?
- Upstream Dependencies: Wovon haengt das ausgewaehlte Element selbst ab?

Die Analyse nutzt nun `uses`, `depends_on`, `serves` und `realizes`, laeuft rekursiv, verhindert Zyklen und zeigt Pfad, Level, Relationstyp, Elementtyp und Layer. Damit ist sie fuer einfache EAM-Fragestellungen nutzbar.

Grenzen:

- Keine Gewichtung nach Kritikalitaet, Risiko, Kosten oder Lifecycle.
- Keine Anzeige mehrerer alternativer Pfade zum selben Element.
- Keine Szenarioarten wie Decommissioning, Migration, Security Incident oder Vendor Risk.
- Keine fachliche Aggregation nach Business Value, Capability Criticality oder Technical Fit.
- Die Traversierungsregeln sind lokal definiert und sollten weiterhin durch EAM-Fachexperten validiert werden.

## Capability Map

Die Capability Map ist dynamisch und profitiert von der semantischen Validierung: Applications werden ueber `serves` an Prozesse und Prozesse ueber `realizes` an Capabilities gebunden. Dadurch ist die Zuordnung weniger beliebig als in Phase 1.

Sie bleibt aber fachlich eingeschraenkt:

- Keine Capability-Hierarchie.
- Keine Capability-Level.
- Keine Business Owner, Value Streams, Domains oder strategischen Ziele.
- Keine Aggregation von Risiko, Kosten, Lifecycle oder Application Coverage.
- Keine Redundanzanalyse.

Fachliches Urteil: Als einfache Capability-orientierte Sicht brauchbar, aber noch keine echte Capability-Based Planning View.

## Lifecycle Roadmap

Die Lifecycle Roadmap wird weiterhin aus echten Modelldaten erzeugt und bleibt eine tabellarische MVP-Sicht.

Brauchbar fuer:

- Uebersicht ueber Start- und End-of-Life-Daten.
- Sicht auf `planned`, `active`, `deprecated`, `retired`.
- Fruehe Diskussion von Lifecycle-Risiken.

Grenzen:

- Keine echte Timeline mit Phasen.
- Keine Transformationsinitiativen, Work Packages oder Meilensteine.
- Keine Soll-/Ist-Architektur.
- Keine Migrationspfade oder Abloesungsrelationen.

## Erfuellte EAM-Aspekte Nach Phase 2

- Explizites kleines EAM-Metamodell.
- Semantische Relationvalidierung im Backend und beim Import.
- Frontend verhindert viele ungueltige Relationen bereits bei der Eingabe.
- Business-, Application-, Data- und Technology-Layer sind typgebunden.
- Impact-/Dependency-Analyse mit zwei fachlich benannten Modi.
- Pfadanzeige, Level und Relationstyp in Analyseergebnissen.
- Minimale Unit Tests fuer Metamodell, Validierung, Impact-Modi und Zyklusvermeidung.
- Capability Map und Roadmap bleiben als einfache EAM-Sichten erhalten.

## Oberflaechliche Oder Weiterhin Generische Aspekte

- Kein vollstaendiges EAM-Framework.
- Keine Application Portfolio Bewertung.
- Keine Capability-Hierarchie.
- Keine Datenarchitektur mit CRUD, Ownership oder Klassifikation.
- Keine Technologie-Standards, Obsoleszenzbewertung oder Compliance.
- Keine Governance Workflows.
- Kein Rollenmodell.
- Keine Versionierung, Baselines oder Architekturvergleich.

## Fehlende EAM-Kernfunktionen

Fuer ein echtes EAM-Tool waeren weiterhin wichtig:

- Capability-Hierarchie mit Ownern, Domains und strategischer Gewichtung.
- Application Portfolio Management mit Business Criticality, Technical Fit, Functional Fit, Owner, Vendor und Kostenstruktur.
- Technology Portfolio mit Standards, Lifecycle, Obsoleszenz und Compliance.
- Datenarchitektur mit Data Ownership, Klassifikation, CRUD-Matrix und Schnittstellen.
- Integrationsmodellierung zwischen Applications.
- Zielarchitektur, Ist-Architektur und Gap-Analyse.
- Transformationsroadmap mit Initiativen, Work Packages, Meilensteinen und Abhaengigkeiten.
- Bewertungsmodelle fuer Risiko, Kosten, Wert, Fit und Maturity.
- Governance-Workflow mit Review, Approval, Verantwortlichkeiten und Before/After-Audit.
- Schema-Versionierung fuer Import/Export.

## Risiken Durch KI-Generierte Annahmen

- Die Relationsemantik wirkt plausibel, ist aber lokal definiert und nicht automatisch standardkonform.
- Die Impact-Richtung kann je nach Organisation oder Framework anders interpretiert werden.
- Die kleine Regelbasis kann falsche Sicherheit erzeugen, weil nur wenige Relationen modellierbar sind.
- Capability Map kann weiterhin Scheingenauigkeit erzeugen, weil nur eine einfache Prozess-Application-Heuristik verwendet wird.
- Risiko- und Kosten-Heatmaps suggerieren Bewertungsreife, obwohl die Bewertungsmodelle fehlen.
- Seed-Daten koennen fachliche Vollstaendigkeit vortaeuschen.

## Empfehlung Fuer Den Naechsten MVP-Schnitt

Nach Phase 2 sollte nicht sofort mehr UI gebaut werden. Der naechste fachliche Schnitt sollte eines der folgenden Themen vertiefen:

1. Capability-Based Planning
   - Capability-Hierarchie
   - Owner, strategic importance, maturity, pain points
   - aggregierte Application Coverage

2. Application Portfolio Management
   - Business Criticality
   - Technical Fit
   - Functional Fit
   - Lifecycle Phase
   - Recommendation: tolerate, invest, migrate, eliminate

3. Daten- und Integrationsarchitektur
   - CRUD-Beziehungen
   - Schnittstellenobjekte
   - Data Ownership und Klassifikation

Prioritaet aus Expertensicht:

Application Portfolio Management waere der naechste sinnvolle MVP-Schnitt, weil es direkt auf dem vorhandenen Application Component Modell, Risiko, Kosten und Lifecycle aufbauen kann.
