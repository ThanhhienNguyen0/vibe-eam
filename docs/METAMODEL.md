# EAM Metamodel

## Zweck

Das Metamodell macht den Prototyp fachlich klarer als einen generischen Graph-Editor. Es definiert, welche Elementtypen existieren, welchem Layer sie angehoeren und welche Relationen zwischen welchen Elementtypen erlaubt sind.

## Elementtypen Und Layer

| Elementtyp | Layer |
| --- | --- |
| Business Capability | Business |
| Business Process | Business |
| Application Component | Application |
| Data Object | Data |
| Technology Node | Technology |

Ein Elementtyp darf nur dem definierten Layer zugeordnet werden. Beispiel: `Application Component` muss im Layer `Application` liegen.

## Erlaubte Relationen

| Source Type | Relation | Target Type | Fachliche Bedeutung |
| --- | --- | --- | --- |
| Business Process | realizes | Business Capability | Ein Prozess operationalisiert eine Capability. |
| Application Component | serves | Business Process | Eine Anwendung unterstuetzt einen Geschaeftsprozess. |
| Application Component | uses | Data Object | Eine Anwendung nutzt ein Datenobjekt. |
| Application Component | depends_on | Technology Node | Eine Anwendung ist von einer Technologiekomponente abhaengig. |
| Application Component | depends_on | Application Component | Eine Anwendung ist von einer anderen Anwendung abhaengig. |
| Data Object | depends_on | Technology Node | Ein Datenobjekt ist von der speichernden oder bereitstellenden Technologie abhaengig. |
| Technology Node | depends_on | Technology Node | Eine Technologiekomponente ist von einer anderen Technologiekomponente abhaengig. |
| Application Component | realizes | Business Capability | MVP-Abkuerzung, wenn Prozessmodellierung ausgelassen wird. |

## Nicht Erlaubte Beispiele

- `Data Object serves Business Capability`
- `Business Capability uses Data Object`
- `Technology Node realizes Business Process`
- `Business Process depends_on Technology Node`

Diese Relationen koennen technisch als Graphkanten vorstellbar sein, sind im aktuellen EAM-Metamodell aber nicht erlaubt.

## Impact- Und Dependency-Semantik

Das Metamodell definiert auch, wie Relationen in Analysen traversiert werden.

### Downstream Business Impact

Frage: Welche Elemente sind betroffen, wenn das ausgewaehlte Element ausfaellt, geaendert oder ersetzt wird?

- Bei `A depends_on B`: Wenn `B` betroffen ist, ist `A` impacted.
- Bei `A uses B`: Wenn `B` betroffen ist, ist `A` impacted.
- Bei `A serves B`: Wenn `A` betroffen ist, ist `B` impacted.
- Bei `A realizes B`: Wenn `A` betroffen ist, ist `B` impacted.

### Upstream Dependencies

Frage: Wovon haengt das ausgewaehlte Element selbst ab?

- Bei `A depends_on B`: `A` haengt von `B` ab.
- Bei `A uses B`: `A` haengt funktional oder datenbezogen von `B` ab.
- Bei `A serves B`: `B` wird durch `A` unterstuetzt.
- Bei `A realizes B`: `B` wird durch `A` realisiert.

## MVP-Grenzen

- Kein vollstaendiges ArchiMate-Metamodell.
- Keine Capability-Hierarchie.
- Keine Unterscheidung zwischen Application Service und Application Component.
- Keine CRUD-Semantik fuer Data Objects.
- Keine expliziten Schnittstellen oder Integrationsobjekte.
- Keine Governance-Regeln fuer Owner, Review oder Approval.
- Die direkte Relation `Application Component realizes Business Capability` ist eine dokumentierte MVP-Abkuerzung.
