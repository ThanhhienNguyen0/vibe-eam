# Risk-Cost Portfolio View

## Zweck

Die Risk-Cost Portfolio Ansicht macht EAM-Elemente vergleichbar nach Risiko, Kosten und berechnetem Downstream Impact. Sie unterstuetzt Demo- und Review-Situationen, in denen schnell sichtbar werden soll, welche Elemente hohe Wirkung, hohe Kosten oder besondere Aufmerksamkeit verdienen.

## X/Y-Darstellung

Die zentrale Visualisierung ist eine interaktive 2x2-Management-Portfolio-Matrix:

- X-Achse: Kosten
  - links = niedrige Kosten
  - rechts = hohe Kosten
- Y-Achse: berechneter Downstream Impact
  - unten = niedriger Impact
  - oben = hoher Impact

Die Matrix ist fuer Praesentationen gedacht: links steht der Plot, rechts eine Management-Detailkarte fuer das ausgewaehlte Element. Die Tabelle ist einklappbar und bewusst nachrangig.

Das Diagramm zeigt Quadranten:

- oben rechts: Critical attention
- oben links: High impact / efficient
- unten rechts: Cost optimization
- unten links: Monitor

Die Darstellung nutzt HTML/CSS und React-Interaktion, keine externe Chart-Library und keine statische Grafik.

## Bubble-Darstellung

Jedes EAM-Element wird als Bubble dargestellt.

Position:

- X = `cost / maxCost`
- Y = `impactScore / maxImpact`
- Inneres Padding verhindert, dass Bubbles am Rand abgeschnitten werden.
- Wenn Maximalwerte 0 sind, wird eine neutrale Mittelposition genutzt, um Division-by-zero zu vermeiden.
- Ein kleiner Jitter reduziert exakte Ueberlagerungen.

Groesse:

- `low` risk = kleine Bubble
- `medium` risk = mittlere Bubble
- `high` risk = grosse Bubble

Farbe:

- Farbe basiert auf dem Layer.
- Business = violett/blau
- Application = rot/orange
- Data = blau/tuerkis
- Technology = anthrazit

Die Portfolio-Kategorie wird in Tooltip und Detailkarte angezeigt, aber nicht als Bubble-Farbe verwendet. Dadurch bleibt die Schichtzuordnung im EAM-Modell visuell erkennbar.

Kuerzel:

- Business Capability = `BC`
- Business Process = `BP`
- Application Component = `AP`
- Data Object = `DA`
- Technology Node = `TE`

## Interaktion

Hover ueber eine Bubble zeigt einen kompakten Tooltip mit:

- Name
- Type
- Risk
- Cost
- Impact Score
- Category

Klick auf eine Bubble waehlt das Element aus. Rechts neben der Matrix erscheint eine Detailkarte mit:

- Name
- Typ
- Layer
- Risiko
- Kosten
- Status
- Impact Score
- Impact Level
- Portfolio-Kategorie
- Begruendung
- downstream impacted elements

Wenn kein Element ausgewaehlt ist, zeigt die Detailkarte einen Hinweis: `Select a bubble to inspect details.`

Die Tabelle unterhalb der Visualisierung ist einklappbar und mit der Bubble-Auswahl synchronisiert. Ein Klick auf eine Tabellenzeile waehlt dasselbe Element aus und hebt die Zeile hervor.

## Impact-Score-Formel

Der Impact Score wird nicht manuell gepflegt. Er wird aus dem aktuellen Modell berechnet.

Vorgehen:

1. Fuer jedes Element wird der Downstream Business Impact berechnet.
2. Das ausgewaehlte Element selbst wird nicht mitgezaehlt.
3. Jedes downstream betroffene Element wird nur einmal gezaehlt, auch wenn es ueber mehrere Pfade erreichbar ist.
4. Betroffene Elemente werden nach Elementtyp gewichtet.
5. Impact Score = Summe der Gewichte aller downstream betroffenen Elemente.

## Layer-Gewichte

| Elementtyp | Gewicht |
| --- | ---: |
| Business Capability | 5 |
| Business Process | 4 |
| Application Component | 3 |
| Data Object | 2 |
| Technology Node | 1 |

## Impact Level

| Score | Level |
| ---: | --- |
| 0-3 | low |
| 4-9 | medium |
| 10+ | high |

## Portfolio-Kategorien

| Regel | Kategorie |
| --- | --- |
| Risiko `high` und Impact `high` | High Risk / High Impact |
| Kosten >= 180000 und Impact `low` oder `medium` | High Cost / Low Impact |
| Impact `high` und Kosten < 100000 | High Impact / Low Cost |
| Risiko `low`, Kosten < 100000 und Impact `low` | Low Priority |
| sonst | Standard |

## Weitere UI-Elemente

Top-KPIs:

- Elements
- Average Cost
- High Risk
- High Impact
- Highest Impact

Filter:

- Layer
- Risiko

Details table:

- kompakter als die Hauptvisualisierung
- standardmaessig eingeklappt
- standardmaessig nach Impact Score absteigend
- Zeilenauswahl ist mit der Bubble-Auswahl synchronisiert

## Warum Die Ansicht Fuer EAM-Entscheidungen Hilfreich Ist

Die Ansicht verbindet drei typische EAM-Fragen:

- Welche Elemente sind riskant?
- Welche Elemente sind teuer?
- Welche Elemente haben bei Aenderung oder Ausfall eine hohe downstream Wirkung?

Dadurch koennen Architektinnen und Architekten schneller diskutieren, welche Elemente Kandidaten fuer Review, Modernisierung, Stabilisierung oder Kostenanalyse sind.

## Grenzen Der MVP-Bewertung

- Die Gewichtung ist eine einfache Annahme, kein validiertes Bewertungsmodell.
- Business Criticality, Technical Fit und Functional Fit fehlen.
- Kosten haben keine Waehrung, keinen Zeitraum und keine CapEx/OpEx-Trennung.
- Risiko ist nur `low`, `medium`, `high`.
- Impact basiert nur auf dem aktuellen Modellgraphen und dessen Metamodell-Relationen.
- Mehrere Pfade werden nicht als Multiplikator gewertet.
- Die Portfolio-Kategorien sind Heuristiken und ersetzen keine Architekturentscheidung.
- Ueberlappungen werden nur leicht durch deterministischen Jitter reduziert, nicht durch ein vollstaendiges Layoutverfahren.
- Die 2x2-Matrix ist eine Management-Visualisierung, keine statistisch exakte Portfolio-Methodik.
