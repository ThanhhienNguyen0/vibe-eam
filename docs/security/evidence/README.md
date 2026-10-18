# Herkunft der Audit-Belege

Alle Erhebungen: 18.10.2026, npm 11.12.1, npm-Registry. Anfangsbasis: `3f5e9e40aa547f780efb44fd4ee821df8274df13`, sauberes `main`. Die Endbefunde beziehen sich auf den REQ-30-Branch und die zugehörige versionierte Lockdatei. Das Datum ist das Erhebungsdatum, nicht das Veröffentlichungsdatum jedes Advisories.

| Datei | Tatsächlich ausgeführtes Kommando / Bedeutung |
|---|---|
| `audit-before.json` | `npm audit --json`, 20 betroffene Pakete |
| `audit-runtime-before.json` | `npm audit --omit=dev --json`, 15 betroffene Pakete; keine vollständige Abbildung des Backend-Images |
| `audit-fix-dry-run.txt` | `npm audit fix --dry-run --json` vor Änderungen; Exit 1 wegen vorhandener Befunde. npm schrieb Änderungszeilen vor dem JSON, deshalb bewusst `.txt` |
| `audit-after-tools.json` | Zwischenaufnahme nach erstem Vite-Upgrade und fehlgeschlagenem Vitest-Peerinstall; 10 Befunde, ausdrücklich **kein Endstand** |
| `audit-after.json` | Vollständiges JSON des finalen `npm run scan:dependencies` / intern `npm audit --json`, 0 Befunde |
| `audit-runtime-after.json` | `npm audit --omit=dev --json` nach finaler Dependency-Auflösung, 0 Befunde |

Die erste, wegen Sandbox-Netzwerkzugriff fehlgeschlagene Abfrage wurde nicht als Auditbeleg verwendet; sämtliche Ausgangsabfragen wurden mit Registryzugriff wiederholt. UTF-8-BOMs der vier Vergleichsberichte wurden zur plattformunabhängigen Lesbarkeit entfernt, JSON-Inhalte unverändert übernommen. Der Zwischenbericht bleibt als historische Rohaufnahme erhalten.

Es wurden keine Zugangsdaten oder Installationslogs mit privaten Registry-Tokens gespeichert. Sicherheitsentscheidungen, Exposition, verbleibende architektonische Risiken und Prüftermin stehen in `../DEPENDENCY_RISKS.md`. Aktuelle CI-Ergebnisse sind neu zu erheben; die gespeicherten Dateien sind datierte Evidenz und keine statische Allowlist.
