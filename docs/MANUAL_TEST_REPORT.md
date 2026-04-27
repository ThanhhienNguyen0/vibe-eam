# Manual Test Report

## Datum
27.04.2026

## Ziel
Manuelle fachliche Prüfung der Impact- und Dependency-Analyse im EAM-Prototyp.

## Ergebnis
Die zuvor definierten Testfälle wurden im Frontend geprüft. Die erwarteten Impact-/Dependency-Ketten wurden überwiegend korrekt angezeigt.

## Getestete Fälle

| Testfall | Ausgewähltes Element | Erwartung | Tatsächliches Ergebnis | Bewertung |
|---|---|---|---|---|
| A | Cloud Runtime | CRM SystemTEST → Customer Onboarding → Customer Management | erfüllt | 3 |
| B1 | CRM SystemTEST / Dependencies | Customer Data, Cloud Runtime | erfüllt | 3 |
| B2 | CRM SystemTEST / Impact | Customer Onboarding → Customer Management | erfüllt | 3 |
| C | Database Cluster / Impact | Invoice Data → ERP/Billing Service → Order to Cash | erfüllt | 3 |
| D | Invoice Data | ERP System, Billing Service, Order to Cash bzw. Database Cluster als Dependency | erfüllt | 3 |
| E | Billing Service | Order to Cash als Impact | erfüllt | 3 |
| F | Order to Cash | abhängig von gewählter Relationsemantik | Order Management und Billing gefunden | 2–3 |

## Beobachtung
Die Impact-Analyse ist funktional nutzbar. Die fachliche Interpretation hängt jedoch stark davon ab, wie Relationstypen und Pfeilrichtungen definiert werden.

## Forschungsrelevanz
Der Test zeigt, dass Codex eine technisch funktionierende Graphanalyse erzeugen kann. Gleichzeitig bleibt menschliche Fachprüfung notwendig, um die Semantik der Relationen zu validieren.
