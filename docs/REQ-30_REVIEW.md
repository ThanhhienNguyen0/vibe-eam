# REQ-30 – unabhängiges KI-Review

Stand: 18.10.2026, 20:06 Uhr Europe/Berlin. Gegenstand: finaler Arbeitsdiff von `codex/eam/req-30-ci-security` gegen `3f5e9e40aa547f780efb44fd4ee821df8274df13`. Die Prüfung erfolgte in zwei getrennten Codex-Kontexten, die weder Recherche noch Implementierung oder Entwurf ausgeführt hatten: einer sauberen Review-Subinstanz und dem ausdrücklich als unabhängige Kontrollinstanz eingerichteten Kontrollchat. Eine konkrete Modellversionskennung wurde von der Laufzeit nicht offengelegt.

## Eingaben und Prüfgrenze

Übergeben wurden der vollständige Arbeitsdiff, die Forschungspositionierung, die Claim-Evidence-Matrix, die relevanten REQ-30-Dokumente, die Repository-Validatoren und verifizierbare Quellenlinks. Die gewünschte Schlussfolgerung und interne Entwurfsbegründungen wurden nicht vorgegeben. Die Prüfinstanz durfte gezielte lokale, nicht schreibende Tests ausführen.

Die Prüfung umfasste Code, Workflows, Security-Gates, Dokumentation und Nachweiskonsistenz. GitHub-Adminzustand, native Secret-Scanning-Einstellungen, tatsächliche CodeQL-Ergebnisse und ein Image-Build mit laufender Docker-Linux-Engine konnten dadurch nicht bestätigt werden. Beim unabhängigen Abruf der veröffentlichten Gitleaks-Prüfsummen war die isolierte Netzauflösung blockiert; die lokale Hashprüfung im Scanner und die zuvor gegen die veröffentlichte Checksum-Datei erfassten Werte wurden deshalb als Implementierungsbeleg, nicht als unabhängig wiederholter Netzwerkbeleg, bewertet.

## Befunde und Entscheidungen

| Schwere | Befund | Entscheidung und Änderung | Wiederholungsprüfung |
|---|---|---|---|
| P1 | Der zunächst eingetragene CodeQL-v4-Wert `f051dc808ef3645eb0d08647ec751634ec2304ac` ist das Objekt eines annotierten Git-Tags, kein ausführbarer Commit. Der Workflow hätte die Action unter diesem SHA nicht zuverlässig laden können. | Behoben. Der offizielle `v4`-Ref wurde über GitHubs Git-Refs- und Git-Tags-API bis zum Commit `6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee` aufgelöst. Beide CodeQL-Schritte verwenden diesen Commit; Validator und Negativtest verwerfen den alten Tagobjekt-SHA. | Vollständiger `npm run check` Exit 0; 15/15 Securitytests und 156/156 Workflowprüfungen. Der Kontrollchat wiederholte den Fix unabhängig und meldete keinen Restbefund. Der tatsächliche CodeQL-Lauf bleibt bis zum PR externer Nachweis. |
| P2 | `scan-dependencies.mjs` konnte eine formal erfolgreiche, aber unvollständige oder widersprüchliche npm-Audit-Antwort passieren lassen, etwa `high: 1` bei leerem `vulnerabilities`-Objekt. Das widersprach dem behaupteten Fail-Closed-Verhalten. | Behoben. Der Parser verlangt nun Audit-v2-Objektform, vollständige nichtnegative numerische Severity-Zähler, erlaubte Severitywerte, Übereinstimmung zwischen Metadaten und tatsächlichen Findings sowie eine korrekte Gesamtsumme. Negative Fixtures decken inkonsistente Zähler, unbekannte Severitys, fehlendes `total`, Arrays, Strings und `null` ab. | `npm run lint` Exit 0; `npm run test:security` 14/14; `npm run validate:workflows` 156/156; echter Vollaudit 0 und Exit 0. |
| P3 | `DEPENDENCY_RISKS.md` behauptete fälschlich, Vitest 5 verwende die Vite-7-Peerinstanz. Die Lockdatei enthält tatsächlich Vite 7.3.7 für das Frontend und Vite 8.3.4 im Vitest-Baum. | Behoben. Die Dokumentation beschreibt die zwei getrennten Werkzeugbäume und ordnet Rollup dem Vite-7-Frontend sowie Rolldown dem Vite-8-Testwerkzeugbaum zu. Keine Paketänderung war erforderlich. | Lockdatei und installierter Abhängigkeitsbaum erneut abgeglichen; Frontend-Produktionsbuild und 69 Backendtests waren im sequenziellen Abschlusslauf bereits erfolgreich. |

Nach dem P1-Fix meldete der unabhängige Kontrollchat keine offenen P0–P3-Codebefunde. Die Review-Kontexte reproduzierten 15 Securitytests, 156 Workflowprüfungen und den vollständigen lokalen Gate. Sie bestätigten außerdem die Audit-Ausgangslage von 20 Befunden insgesamt beziehungsweise 15 ohne Development-Abhängigkeiten sowie jeweils 0 im Endstand. Der Secret-Scan erkannte den künstlichen Canary und prüfte anschließend 39 Commits sowie 153 aktuelle Dateien ohne ungeklärten Fund.

## Freigabegrenze

Das unabhängige Review bestätigt die Korrektur der gefundenen Repository-Probleme, ersetzt aber weder die menschliche Mergefreigabe noch die externe GitHub-Governance. Die erste Review-Subinstanz endete nach ihren P2-/P3-Befunden am Kontingentlimit; der getrennte Kontrollchat führte anschließend den vollständigen Gate, die Sicherheitsprüfungen und die P1-Wiederholungsprüfung aus. Der Status bleibt **code-seitig bereit, externe Governance offen**.

Die Erstellung dieser Ausarbeitung wurde durch KI unterstützt.
