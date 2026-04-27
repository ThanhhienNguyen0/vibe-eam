# Impact Analysis

## Analysemodi

Der Prototyp bietet zwei rekursive Analysemodi.

## Downstream Business Impact

Leitfrage:

Welche Elemente sind betroffen, wenn das ausgewaehlte Element ausfaellt, geaendert oder ersetzt wird?

Traversierung:

- `depends_on` und `uses` werden rueckwaerts traversiert: Wenn ein Ziel betroffen ist, ist die Quelle betroffen.
- `serves` und `realizes` werden vorwaerts traversiert: Wenn die Quelle betroffen ist, ist das Ziel betroffen.

Beispiel:

Wenn eine Datenbank betroffen ist, koennen Datenobjekte, Applications, Prozesse und Capabilities indirekt betroffen sein.

## Upstream Dependencies

Leitfrage:

Wovon haengt das ausgewaehlte Element selbst ab?

Traversierung:

- `depends_on` und `uses` werden vorwaerts traversiert: Die Quelle haengt vom Ziel ab.
- `serves` und `realizes` werden rueckwaerts traversiert: Das Ziel wird durch die Quelle unterstuetzt oder realisiert.

Beispiel:

Eine Business Capability kann ueber Prozess, Application, Datenobjekt und Technologie bis zu darunterliegenden Technology Nodes zurueckverfolgt werden.

## Ergebnisdarstellung

Die Ergebnisliste zeigt:

- Elementname
- Elementtyp
- Layer
- Relationstyp der letzten Traversierungsstufe
- Tiefe/Level
- Pfad vom Startobjekt zum Zielobjekt

Im Canvas werden unterschieden:

- ausgewaehltes Element: dunkle Markierung
- direkte Ergebnisse: orange Markierung
- indirekte Ergebnisse: gelbe Markierung

## Zyklusbehandlung

Die Analyse fuehrt eine `visited`-Menge. Bereits besuchte Elemente werden nicht erneut expandiert. Dadurch terminieren auch zyklische Graphen.

## Grenzen

- Es gibt keine Gewichtung nach Risiko, Kritikalitaet oder Kosten.
- Es gibt keine konfigurierbaren Analyseprofile.
- Es werden nur Elementpfade angezeigt, keine vollstaendige Pfadmenge, falls mehrere Wege zum selben Element existieren.
- Die Semantik ist ein pragmatisches MVP-Regelwerk und kein vollstaendiger EAM-Standard.
