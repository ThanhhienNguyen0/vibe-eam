# REQ-26 – Abschlussdokumentation Optimistic Locking

- **Stand:** 06.11.2026
- **Issue:** #58
- **Branch:** `codex/eam/req-26-optimistic-locking`
- **Gestapelte Basis:** REQ-33 `dd14b162ef611ccd7706e540416b1a5edf174f7e`
- **Main-Basis von REQ-33:** `8868629a8727c99bc5472e65dc261d49ebb34c0c`

## Ausgangslage und Ziel

Vor REQ-26 konnten mehrere aktive Schreibpfade einen vollständigen, zuvor gelesenen Unternehmenszustand zurückschreiben. Zusätzlich hielten Backendprozesse eigene Zustandscaches. Zwei Nutzer oder zwei Backendprozesse konnten deshalb nacheinander gültig wirkende Änderungen senden, obwohl der zweite Request auf einem veralteten Stand beruhte. Die spätere Änderung konnte die frühere unbemerkt überschreiben. Der REQ-33-Import war zwar transaktional und fachlich validiert, aber noch nicht an die beim Export beziehungsweise vor dem Import gelesene Datenbasis gebunden.

Ziel von REQ-26 ist eine serverseitig durchgesetzte Konflikterkennung. Einzelne Komponenten, Relationen und Diagramme sollen nur mit ihrer aktuellen Version verändert oder gelöscht werden. Vollständige Importe sollen nur auf der Datenrevision ausgeführt werden, auf der ihre Vorschau oder ihr Export beruht. Konflikte dürfen weder Teiländerungen noch einen Erfolgs-Auditeintrag hinterlassen. Die Oberfläche soll einen lokalen Entwurf erhalten und eine verständliche Entscheidung zwischen „Neu laden“ und „Bewusst überschreiben“ ermöglichen.

## Technische Umsetzung

Die Prisma-Persistenz enthält nun `version` für Komponenten, Relationen und Diagramme sowie `Company.dataRevision` für Whole-State-Operationen. Neue Objekte beginnen bei Version 1. Erfolgreiche Objektänderungen erhöhen ihre Version und die Company-Revision. PATCH und DELETE benötigen `If-Match`. Eine fehlende Vorbedingung ergibt HTTP 428, eine ungültige Angabe 400, ein nicht vorhandenes Objekt 404 und eine veraltete Version 409. Der 409-Body enthält einen stabilen Fehlercode sowie, soweit vorhanden, den aktuellen Serverstand und dessen Version.

Komponenten-, Relationen- und Diagrammmutationen verwenden direkte atomare Prisma-Operationen mit den Prädikaten Company, ID und Version. Damit entscheidet die Datenbank, welcher konkurrierende Request erfolgreich ist. Die Löschung einer Komponente nutzt die bestehenden Fremdschlüssel-Kaskaden für abhängige Relationen und Diagrammmitgliedschaften. Diagrammänderungen ersetzen Mitgliedschaften innerhalb derselben Transaktion. Das Anlegen und Platzieren einer neuen Komponente erfolgt über einen gemeinsamen Transaktionsendpunkt; bei einem Diagrammkonflikt wird keine Komponente angelegt.

Der Sidebar-Reader liest Nutzdaten und `Company.dataRevision` in einer PostgreSQL-`RepeatableRead`-Transaktion. Ein PATCH zwischen zwei Lesestatements kann deshalb nicht mehr alte Nutzdaten mit bereits neuer Revision verbinden. Der Whole-State-Writer beansprucht zu Beginn seiner Transaktion die erwartete Revision. Bei einer Abweichung wird vor fachlicher Mutation und Erfolgs-Audit abgebrochen. Bestehende Objekte erhöhen ihre Objektversion nur, wenn sich ihr eigener gespeicherter Inhalt oder ihre Mitgliedschaft tatsächlich ändert; unveränderte Objekte behalten ihre Version. Neue Objekte beginnen bei 1. Der CSV/XLSX-Preview liefert die aktuelle Datenrevision, und der Commit muss sie als `expectedRevision` mitsenden. REQ-33-Export liefert die Revision als ETag; der Import verlangt dieselbe Revision über `If-Match`. Die portable REQ-33-Datei bleibt frei von Laufzeitversionen.

Die historische `/api/model`-API bleibt aktiv und wurde ebenfalls geschützt. Mutationen sperren ihre JSONB-Zeile in PostgreSQL. Body und ETag eines Reads stammen nun aus derselben gelesenen `ArchitectureModel`-Zeile. Ein Import vergibt die nächste Aggregatrevision als Objektversion und setzt vorhandene IDs nicht wieder auf Version 1 zurück; alte `If-Match`-Werte können dadurch nicht nach einem Import erneut gültig werden. Prozesscache und rein prozesslokale Sperren sind nicht mehr die Wahrheitsquelle. Read-Normalisierung löst keine unbemerkten Whole-State-Writes mehr aus.

## Konfliktablauf in der Oberfläche

Die mutierenden Frontendaufrufe senden die bekannte Objektversion als `If-Match`. Bei 409 bleibt der lokale Entwurf bis zur Entscheidung erhalten. „Neu laden“ übernimmt den Serverstand und bindet den Editor über ID plus Revision an eine neue Komponenteninstanz; der alte Draft wird tatsächlich verworfen. Nach erfolgreichem Speichern wird der Editor ebenso an die zurückgegebene Revision gebunden. „Bewusst überschreiben“ sendet denselben Entwurf erneut, jedoch mit der aktuellen Serverversion als neuer Vorbedingung. Ein weiterer Zwischenwrite erzeugt erneut 409. Die schreibgeschützte Viewpoint-Vorschau bleibt vor Mutationen geschützt.

## Prüfungen und belegte Resultate

Der vollständige lokale Qualitätslauf bestand mit Prisma-Generierung, Lint, Typecheck, Backend- und Frontendtests, Builds sowie Repository-, Compose-, Workflow-, Security- und Prisma-Konfigurationsvalidatoren. Die normale Testsuite bestand mit 169 Backendtests und 40 Frontendtests; 25 echte DB-Tests werden dort erwartungsgemäß ohne Testdatenbank übersprungen und separat ausgeführt.

Der isolierte PostgreSQL-Lauf wendete sieben Migrationen an und bestand mit 25 von 25 DB-Tests in vier Dateien. Die REQ-26-Fälle starten für Update/Update, Update/Delete und konkurrierende Diagrammmitgliedschaften getrennte Node-Prozesse mit eigenen Prisma-Clients und IPC-Barriere. Weitere echte DB-Fälle prüfen einen zwischen Snapshot und Folgelesen eingeschobenen PATCH, stabile Versionen unveränderter Objekte, schreibfreie Wiederholungsreads, verschiedene Objekte, atomisches Create-and-Place, Relationen, Kaskaden, zwei Companies, Vorschau/Commit, REQ-33-Import, unverändertes Audit bei Konflikt und Legacy-ABA. Der gleiche Lauf erstellte ein Backup, stellte es in einer neuen Datenbank wieder her, führte das manuelle Rollback aus und prüfte das Entfernen der neuen Spalten.

Der Dependency-Scan meldete 10 moderate, 0 hohe und 0 kritische Befunde. Nach der bestehenden Gate-Regel ist der Lauf bestanden; die moderaten Toolingbefunde bleiben reviewpflichtig. Der commitgebundene Secret-Scan bestand für 77 Commits und 212 aktuelle Dateien; der vorgeschaltete Canary wurde erwartungsgemäß abgelehnt. Die echte Docker-CLI validierte Development-, Staging- und Produktions-Compose-Konfiguration. Die lokale Docker-Linux-Engine war nicht erreichbar, weshalb kein Image-Build ausgeführt oder als bestanden ausgewiesen wird.

## Daten-, Kompatibilitäts- und Betriebsfolgen

Die Vorwärtsmigration ergänzt nicht nullable Versionsfelder mit sicheren Startwerten. Bestehende Komponenten, Relationen und Diagramme beginnen dadurch bei Version 1; vorhandene Companies bei Datenrevision 0. Die Anwendung erhöht diese Werte ausschließlich serverseitig. Alte Clients, die mutierende Requests ohne Vorbedingung senden, erhalten absichtlich 428 und müssen aktualisiert werden. Leseantworten enthalten die Laufzeitversionen; portable JSON-Dateien bleiben kompatibel zum REQ-33-Schema Version 1. Das Rollback entfernt die neuen Spalten, setzt aber voraus, dass die Anwendung zuvor auf einen Stand ohne REQ-26 zurückgesetzt wurde.

## Grenzen, Kontrolle und nächste Schritte

Die unabhängige Kontrolle lehnte den ersten Entwicklercommit `7c1079e6748adacee1dfed8f87220e03d0c78b92` ab. Ihre drei P1-Bereiche waren ein nicht snapshot-konsistenter Sidebar-Read, pauschale Whole-State-Versionssprünge mit nicht atomarem Create-and-Place sowie getrennte Legacy-Body-/ETag-Reads einschließlich Versions-ABA. Zwei P2-Bereiche betrafen den nicht wirklich verworfenen UI-Draft und überzeichnete Testclaims. Der vorliegende Stand korrigiert diese Befunde und enthält reproduzierende Tests, ist aber bis zur erneuten unabhängigen Kontrolle weiterhin nur ein lokal selbstgeprüfter Entwicklerkandidat.

Offen bleiben Remote-CI/CodeQL, Container-Image-Build, Browser-E2E, Staging- und Produktionsprüfung sowie menschliche fachliche und sicherheitsbezogene Freigabe. Aus den lokalen Resultaten wird keine allgemeine Produktionsreife oder Wartbarkeitszertifizierung abgeleitet.

Als nächster Schritt ist der unveränderte lokale Commit in einem getrennten read-only Kontext gegen Issue #58, den Persistenzvertrag, die Testausgaben und diese Abschlussdokumentation zu prüfen. Befunde werden in einem neuen Entwicklercommit korrigiert und erneut kontrolliert. Erst nach ausdrücklicher Autorisierung dürfen Push und ein gestapelter Pull Request auf den REQ-33-Branch erfolgen. Merge, Issue-Close und Deployment bleiben eigenständige Entscheidungen. REQ-23 wurde nicht begonnen.

Die Erstellung dieser Ausarbeitung wurde durch KI unterstützt.
