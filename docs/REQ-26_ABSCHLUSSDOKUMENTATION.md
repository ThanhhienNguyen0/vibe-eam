# REQ-26 – Abschlussdokumentation Optimistic Locking

**Stand:** 06.11.2026  
**Issue:** #58  
**Branch:** `codex/eam/req-26-optimistic-locking`  
**Gestapelte Basis:** REQ-33 `dd14b162ef611ccd7706e540416b1a5edf174f7e`  
**Main-Basis von REQ-33:** `8868629a8727c99bc5472e65dc261d49ebb34c0c`

## Ausgangslage und Ziel

Vor REQ-26 konnten mehrere aktive Schreibpfade einen vollständigen, zuvor gelesenen Unternehmenszustand zurückschreiben. Zusätzlich hielten Backendprozesse eigene Zustandscaches. Zwei Nutzer oder zwei Backendprozesse konnten deshalb nacheinander gültig wirkende Änderungen senden, obwohl der zweite Request auf einem veralteten Stand beruhte. Die spätere Änderung konnte die frühere unbemerkt überschreiben. Der REQ-33-Import war zwar transaktional und fachlich validiert, aber noch nicht an die beim Export beziehungsweise vor dem Import gelesene Datenbasis gebunden.

Ziel von REQ-26 ist eine serverseitig durchgesetzte Konflikterkennung. Einzelne Komponenten, Relationen und Diagramme sollen nur mit ihrer aktuellen Version verändert oder gelöscht werden. Vollständige Importe sollen nur auf der Datenrevision ausgeführt werden, auf der ihre Vorschau oder ihr Export beruht. Konflikte dürfen weder Teiländerungen noch einen Erfolgs-Auditeintrag hinterlassen. Die Oberfläche soll einen lokalen Entwurf erhalten und eine verständliche Entscheidung zwischen „Neu laden“ und „Bewusst überschreiben“ ermöglichen.

## Technische Umsetzung

Die Prisma-Persistenz enthält nun `version` für Komponenten, Relationen und Diagramme sowie `Company.dataRevision` für Whole-State-Operationen. Neue Objekte beginnen bei Version 1. Erfolgreiche Objektänderungen erhöhen ihre Version und die Company-Revision. PATCH und DELETE benötigen `If-Match`. Eine fehlende Vorbedingung ergibt HTTP 428, eine ungültige Angabe 400, ein nicht vorhandenes Objekt 404 und eine veraltete Version 409. Der 409-Body enthält einen stabilen Fehlercode sowie, soweit vorhanden, den aktuellen Serverstand und dessen Version.

Komponenten-, Relationen- und Diagrammmutationen verwenden direkte atomare Prisma-Operationen mit den Prädikaten Company, ID und Version. Damit entscheidet die Datenbank, welcher konkurrierende Request erfolgreich ist. Die Löschung einer Komponente nutzt die bestehenden Fremdschlüssel-Kaskaden für abhängige Relationen und Diagrammmitgliedschaften. Diagrammänderungen ersetzen Mitgliedschaften innerhalb derselben Transaktion. Änderungen an verschiedenen Objekten schreiben keine veraltete Whole-State-Kopie zurück.

Der bestehende Whole-State-Writer beansprucht zu Beginn seiner Transaktion die erwartete `Company.dataRevision`. Bei einer Abweichung wird vor fachlicher Mutation und Erfolgs-Audit abgebrochen. Bestehende Objekte erhalten beim erfolgreichen Replace serverseitig die nächste Version; neue Objekte beginnen bei 1. Der CSV/XLSX-Preview liefert deshalb die aktuelle Datenrevision, und der Commit muss sie als `expectedRevision` mitsenden. REQ-33-Export liefert die Revision als ETag; der Import verlangt dieselbe Revision über `If-Match`. Die portable REQ-33-Datei bleibt frei von Laufzeitversionen. Ihre `schemaVersion` und die fachliche Metamodellversion sind ausdrücklich keine Locking-Versionen.

Die historische `/api/model`-API bleibt aktiv und wurde ebenfalls geschützt. Ihr JSONB-Aggregat wird unter einer PostgreSQL-Zeilensperre gelesen und geschrieben; Prozesscache und rein prozesslokale Sperren sind nicht mehr die Wahrheitsquelle. Read-Normalisierung löst keine unbemerkten Whole-State-Writes mehr aus. Die initiale Anlage eines fehlenden Modells erfolgt vor Ermittlung des zurückgegebenen ETags.

## Konfliktablauf in der Oberfläche

Die mutierenden Frontendaufrufe senden die bekannte Objektversion als `If-Match`. Bei 409 bleibt der lokale Entwurf erhalten. „Neu laden“ verwirft ihn bewusst und übernimmt den vom Server gemeldeten Stand. „Bewusst überschreiben“ sendet denselben Entwurf erneut, jedoch mit der aktuellen Serverversion als neuer Vorbedingung. Diese Aktion ist kein Force-Bypass: Ändert ein dritter Request den Datensatz zwischen Konfliktanzeige und Wiederholung, antwortet der Server erneut mit 409 und verlangt eine neue Entscheidung. Die vorhandene schreibgeschützte Viewpoint-Vorschau bleibt weiterhin vor Mutationen geschützt.

## Prüfungen und belegte Resultate

Der vollständige lokale Qualitätslauf bestand mit Prisma-Generierung, Lint, Typecheck, Backend- und Frontendtests, Builds sowie Repository-, Compose-, Workflow-, Security- und Prisma-Konfigurationsvalidatoren. Die normale Testsuite bestand mit 169 Backendtests und 38 Frontendtests; 19 echte DB-Tests werden dort erwartungsgemäß ohne Testdatenbank übersprungen und separat ausgeführt.

Der isolierte PostgreSQL-Lauf wendete sieben Migrationen an und bestand mit 19 von 19 DB-Tests in vier Dateien. Die REQ-26-Fälle starten getrennte Node-Prozesse mit eigenen Prisma-Clients und synchronisieren sie über eine IPC-Barriere. Geprüft wurden Update/Update, Update/Delete, Änderungen verschiedener Objekte, wiederholter Konflikt beim bewussten Überschreiben, Relationen, Diagramme, DB-Kaskaden, zwei Companies, Vorschau/Commit-Konflikte, REQ-33-Import, unveränderte Auditanzahl bei Konflikt und die historische Modell-API. Der gleiche Lauf erstellte ein Datenbank-Backup, stellte es in einer neuen Datenbank wieder her, führte das manuelle REQ-26-Rollback aus und prüfte anschließend das Entfernen der neuen Spalten.

Der Dependency-Scan meldete 10 moderate, 0 hohe und 0 kritische Befunde. Nach der bestehenden Gate-Regel ist der Lauf bestanden; die moderaten Toolingbefunde bleiben reviewpflichtig. Der Secret-Scan bestand für 75 Commits und 210 aktuelle Dateien; der vorgeschaltete Canary wurde erwartungsgemäß abgelehnt. Die echte Docker-CLI validierte Development-, Staging- und Produktions-Compose-Konfiguration. Die lokale Docker-Linux-Engine war nicht erreichbar, weshalb kein Image-Build ausgeführt oder als bestanden ausgewiesen wird.

## Daten-, Kompatibilitäts- und Betriebsfolgen

Die Vorwärtsmigration ergänzt nicht nullable Versionsfelder mit sicheren Startwerten. Bestehende Komponenten, Relationen und Diagramme beginnen dadurch bei Version 1; vorhandene Companies bei Datenrevision 0. Die Anwendung erhöht diese Werte ausschließlich serverseitig. Alte Clients, die mutierende Requests ohne Vorbedingung senden, erhalten absichtlich 428 und müssen aktualisiert werden. Leseantworten enthalten die Laufzeitversionen; portable JSON-Dateien bleiben kompatibel zum REQ-33-Schema Version 1. Das Rollback entfernt die neuen Spalten, setzt aber voraus, dass die Anwendung zuvor auf einen Stand ohne REQ-26 zurückgesetzt wurde.

## Grenzen, Kontrolle und nächste Schritte

Der vorliegende Stand ist ein lokal selbstgeprüfter Entwicklerkandidat. Eine prozessunabhängige Kontrolle hat diesen finalen Commit noch nicht geprüft und wird hier nicht vorweggenommen. Ebenso fehlen Remote-CI/CodeQL, Container-Image-Build, Browser-E2E, Staging- und Produktionsprüfung sowie menschliche fachliche und sicherheitsbezogene Freigabe. Aus den lokalen Resultaten wird keine allgemeine Produktionsreife oder Wartbarkeitszertifizierung abgeleitet.

Als nächster Schritt ist der unveränderte lokale Commit in einem getrennten read-only Kontext gegen Issue #58, den Persistenzvertrag, die Testausgaben und diese Abschlussdokumentation zu prüfen. Befunde werden in einem neuen Entwicklercommit korrigiert und erneut kontrolliert. Erst nach ausdrücklicher Autorisierung dürfen Push und ein gestapelter Pull Request auf den REQ-33-Branch erfolgen. Merge, Issue-Close und Deployment bleiben eigenständige Entscheidungen. REQ-23 wurde nicht begonnen.

Die Erstellung dieser Ausarbeitung wurde durch KI unterstützt.
