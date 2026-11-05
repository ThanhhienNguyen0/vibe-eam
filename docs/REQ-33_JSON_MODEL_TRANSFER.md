# REQ-33 – Vollständiger JSON-Modelltransfer

## Zweck und Abgrenzung

REQ-33 ergänzt einen vollständigen, versionierten Transfervertrag für den aktuellen Sidebar-/Diagramm-Pfad. Die drei älteren Teilformate bleiben unverändert:

- `/api/model/export` und `/api/model/import`: historisches Architekturmodell mit Legacy-Elementen und -Relationen.
- `/api/sidebar/metamodel/export` und `/api/sidebar/metamodel/import`: Metamodell, Regeln und Viewpoints ohne Instanzen, Diagramme und Kataloge.
- `/api/sidebar/export` und `/api/sidebar/import/*`: CSV/XLSX für Instanzen und Relationen; keine Diagrammmitgliedschaften.

Der vollständige JSON-Vertrag liegt unter:

- `GET /api/sidebar/model/export` – alle angemeldeten Rollen dürfen lesen.
- `POST /api/sidebar/model/import` – nur Admin, weil der Replace-Import auch das Metamodell ersetzt.
- JSON Schema: `backend/src/modelTransfer/vibe-eam-model.schema.json`.

## Versionen

`schemaVersion` versioniert ausschließlich das Dateiformat. Version 1 ist die einzige akzeptierte Version. Fehlende, ältere und zukünftige Versionen werden vor jeder Mutation mit getrennten Fehlercodes abgelehnt. Es gibt kein unversioniertes Vorläuferformat, das verlustfrei als vollständiges aktuelles Modell migriert werden könnte.

`model.metamodel.version` bleibt die fachliche Metamodellversion. Eine spätere Laufzeitrevision für Optimistic Locking ist nicht Bestandteil dieses Formats und wird nicht als `schemaVersion` ausgegeben.

## Inhalt von Version 1

Der Schlüssel `model` enthält:

- Metamodell, Komponenten- und Verbindungstypen;
- ConnectionRules, Viewpoints, ViewpointRules und ValidationRules;
- Komponenten und Relationen einschließlich freier Eigenschaften und externer IDs;
- Diagramme einschließlich Mitgliedschaften und Positionen;
- gespeicherte Kataloge einschließlich ihrer Reihenfolge, Typfilter, Property-Spalten und Standardspalten.

Nicht enthalten sind Company-ID, Benutzer, Rollen, Passwort-Hashes, Tokens, Secrets, Legacy-Auditverlauf und `AuditLogEntry`-Historie. Der Import löscht oder ersetzt diese Daten nicht. Er ergänzt nur einen append-only Import-Summary-Eintrag im bestehenden `AuditLogEntry`.

## Portable IDs und Tenant-Isolation

Datei-IDs sind portable fachliche Identifikatoren. Interne PostgreSQL-IDs werden beim Export grundsätzlich vom Präfix der authentifizierten Company befreit. Wenn dadurch ein präfixierter und ein zulässiger unpräfixierter Alt-Identifier auf denselben Datei-Identifier fallen würden, erhält nur der kollidierende weitere Identifier eine deterministische, außerhalb aller Kandidaten gewählte Ersatz-ID. Die Abbildung wird einheitlich auf sämtliche Ressourcen-IDs, Fremdschlüssel, Diagrammmitgliedschaften und Positionsschlüssel angewendet und ist bijektiv. Beim Import werden die eindeutigen Datei-IDs mit dem Ziel-Company-Präfix materialisiert. Externe IDs bleiben unverändert.

Damit kann dasselbe Exportdokument gleichzeitig in mehreren Companies importiert werden, ohne globale Prisma-Primärschlüssel zu teilen. Ein erneuter Export aus beiden Companies liefert wieder dieselben portablen IDs. Der Import ermöglicht keinen Zugriff auf fremde Daten und übernimmt keine Company-ID aus der Datei.

## Determinismus und Werte

Objektschlüssel werden kanonisch sortiert. Persistierte Collection-Reihenfolgen bleiben erhalten; Diagramm-Mitgliedschafts-IDs werden kanonisch sortiert, weil die Join-Tabellen keine fachliche Reihenfolge speichern. Katalog- und Spaltenreihenfolgen bleiben fachlich erhalten. Unicode, leere Strings und optionale Felder werden nicht zur Herstellung von Gleichheit entfernt. Metamodell-`createdAt` und `updatedAt` werden auch beim Update eines bereits vorhandenen Ziel-Metamodells übernommen. Fehlende nullable Felder werden explizit als `null` persistiert, damit alte Zielwerte nicht still fortbestehen. Technische Diagramm-/Katalog-DB-Zeitstempel sind nicht Teil des aktuellen Editorvertrags und werden nicht exportiert.

## Validierung, Replace und Atomizität

Ajv validiert die Datei gegen das versionierte JSON Schema. Danach werden eindeutige IDs, sämtliche Typ-/Regel-/Viewpoint-/Instanz-/Diagramm-/Katalogreferenzen, externe-ID-Eindeutigkeit und Diagrammendpunkte geprüft. Die Vorvalidierung bildet außerdem alle importrelevanten DB-Constraints ab: eindeutige ConnectionRule-Tripel, höchstens eine ViewpointRule je Viewpoint, company-lokale externe IDs und eindeutige Diagrammmitgliedschaften. Schema-Duplikate liefern `MODEL_SCHEMA_INVALID`, die übrigen Constraint-Verletzungen `MODEL_UNIQUENESS_INVALID`; beide entstehen vor jeder Mutation. Anschließend laufen alle Relationen und Diagramme gegen dieselben `validateConnectionInstance`-/`validateDiagram`-Regeln wie die normalen Fachpfade; fehlende oder verbietende ConnectionRules, Selbstrelationen sowie Viewpoint-, Diagramm- und Pflichtregelverletzungen führen zu `MODEL_DOMAIN_INVALID`. Die Prüfung verwendet ausschließlich den importierten Gesamtzustand. Auch jedes erzeugte Exportdokument wird vor Ausgabe erneut gegen Schema, Referenzen und Domänenregeln geprüft. Diese Schritte verhindern insbesondere, dass `removeDanglingInstanceReferences` eine kaputte Datei still bereinigt.

Der Import ist ein ausdrücklicher Replace des vollständigen Modellzustands der authentifizierten Company. Es gibt keinen Merge- oder Preview-Modus. Wechselt die Metamodell-ID, werden frühere Metamodelle derselben Company innerhalb der vorhandenen PostgreSQL-Transaktion gelöscht; deren Typen, Regeln, Diagramme und Instanzen werden FK-gerecht kaskadiert. Danach werden neuer Zustand und Import-Summary geschrieben. Benutzer, Audit-Historie und der ausgeschlossene Legacy-Modellpfad sind keine Nachfahren des Metamodells und bleiben erhalten. Ein Schema-, Referenz-, Tenant- oder DB-Fehler hinterlässt keine Teiländerung und aktualisiert den Prozesscache erst nach erfolgreichem Commit.

## Kompatibilität und Grenzen

- Keine Prisma-Migration: REQ-33 verwendet die vorhandenen relationalen Tabellen und den vorhandenen transaktionalen Writer.
- Bestehende Legacy-, Metamodell-, CSV- und XLSX-Routen bleiben erhalten.
- Der globale Express-JSON-Parser begrenzt JSON-Imports weiterhin auf 2 MiB.
- Der Replace-Import ist bewusst Admin-only und besitzt noch keine fachliche Vorschau.
- Optimistic Locking und vollständige Before/After-Audits bleiben REQ-26 beziehungsweise REQ-23.

## Lokale Evidenz vom 04.11.2026

Diese Evidenz gehört zum später unabhängig verworfenen Entwickler-Head `6b9201b96d373fd1d420c3b0a0db7a4d79cf8a64`. Die unabhängige Kontrolle fand zurückbleibende Daten bei wechselnder Metamodell-ID, fehlende Domänenvalidierung, eine kollidierende Präfixentfernung und eine veraltete Secret-Scan-Zahl. Der Head wurde nicht freigegeben.

- Format-/Schema-/RBAC-Tests: `npm run test --workspace backend -- --run src/modelTransfer/modelTransfer.test.ts src/auth/rbac.test.ts` – 2 Dateien, 22 Tests bestanden.
- Isolierter PostgreSQL-Cluster: `$env:PG_BIN='C:\Program Files\PostgreSQL\14\bin'; npm run test:rbac:db` – sechs Migrationen angewendet; 3 Dateien, 11 Tests bestanden.
- Die drei DB-Testdateien laufen bewusst seriell und mit einem 30-Sekunden-Einzeltestlimit: parallele temporäre Datenbanklast verursachte zunächst Timeouts; eine bestehende REQ-31-Prüfung überschritt unter Last einmal das Vitest-Standardlimit von fünf Sekunden. Assertions und Produktzeitlimits wurden nicht gelockert.
- Der DB-Test prüft byte-identischen Export → Import → Export, geteilte Elemente in zwei Diagrammen, Positionen, Regeln/Viewpoints, Unicode, leere Werte, Kataloge/externe IDs, zwei parallele Companies, 401/403, fehlende/alte/zukünftige Versionen, kaputte Referenzen, Audit-Ausschluss/-Erhalt und einen per PostgreSQL-Trigger erzwungenen Transaktionsrollback.
- Legacy-Modell-JSON, Metamodell-JSON, CSV und XLSX werden im selben DB-Lauf als Regression ausgeführt.
- Der erste `npm install`-Versuch und die erste Prisma-Generierung scheiterten in der Sandbox mit `ENOTFOUND`; die identischen Schritte wurden gemäß Sandbox-Regel mit freigegebenem Netzwerkzugriff erfolgreich wiederholt. Ein erster DB-Versuch mit dem unvollständigen PostgreSQL-16-Bin-Verzeichnis scheiterte an fehlendem `initdb.exe`; PostgreSQL 14 stellte die vollständigen Werkzeuge bereit.

Finale lokale Gates am 05.11.2026 auf Ajv 8.18.0:

- `npm run check` bestand: Lint und beide Typechecks; 165 bestandene/11 übersprungene Backendtests (DB-Tests laufen im separaten Pflichtgate), 36 Frontendtests; beide Produktionsbuilds; 113 Compose-, 169 Workflow- und 17 Securityprüfungen; Prisma-Konfigurationsprüfung.
- `npm run scan:dependencies` bestand mit 0 hohen/kritischen und 10 weiterhin sichtbaren moderaten Tooling-Befunden. Das direkte Ajv-Finding der zunächst installierten Version 8.17.1 wurde kompatibel mit 8.18.0 behoben; kein `--force`.
- Der unabhängige Secret-Scan auf `6b9201b9…` bestand mit Canary-Erkennung, 73 Commits und 203 aktuellen Dateien ohne echten Fund. Diese Zahl ist historische Evidenz für den verworfenen Head, nicht für den Nacharbeits-Head.
- Alle drei realen `docker compose ... config --quiet`-Aufrufe mit `.env.example`, `.env.staging.example` und `.env.prod.example` bestanden.
- Der exakte CI-Image-Build `docker compose ... build backend frontend` wurde versucht, aber nicht ausgeführt: Die lokale Docker-Desktop-Linux-Engine-Pipe fehlte. Hintergrundstart von Docker Desktop und Start des Systemdiensts stellten die Engine nicht bereit; der Dienstzugriff war in dieser Umgebung nicht erlaubt. Anwendungsbuilds bestanden, aber Container-Image-Build, Remote-CI, CodeQL, Deployment und unabhängige Freigabe bleiben ausdrücklich unbelegt.

## Nacharbeit nach unabhängiger Kontrolle am 05.11.2026

- Die neuen Regressionstests reproduzierten auf dem verworfenen Code zwei Unitfehler: zwei gemischte präfixierte/unpräfixierte IDs wurden zu einer Datei-ID, und eine Relation ohne ConnectionRule wurde akzeptiert. Im frischen PostgreSQL-Cluster wurde eine Domänenverletzung mit HTTP 200 übernommen; nach dem ersten Metamodellwechsel existierten zwei statt eines Company-Metamodells.
- Der Replace löscht jetzt frühere Metamodellgraphen derselben Company innerhalb derselben Transaktion. Der DB-Test wechselt Metamodell-IDs, leert den Zustand, prüft null alte Modellzeilen, verwendet dieselbe externe ID anschließend erfolgreich wieder und erzwingt danach einen späten DB-Fehler. Export, alter Metamodellgraph und Audit bleiben beim Fehler unverändert.
- Fehlende/verbietende ConnectionRules, Selbstrelationen und Viewpoint-Regelverletzungen werden als HTTP 400 abgelehnt; Export und Auditanzahl bleiben unverändert. Ein gültiger Gesamtzustand bleibt importierbar.
- Die Kollisionsregression enthält gleichzeitig `company-a:component`/`component` und `company-a:type`/`type`, prüft unterschiedliche Datei-IDs, alle Referenzremaps, Selbstvalidierung des Exports und byteidentischen Re-Export aus einer zweiten Company.
- Der erste korrigierte DB-Lauf wies die alte Positiv-Fixture zu Recht zurück: die ausgewählte Starterregel war im neuen Viewpoint nicht freigegeben und das zweite Diagramm verletzte globale Pflichtregeln. Nach fachlich korrekter Fixture-Zuordnung deckte ein zweiter Lauf einen wirkungslosen Viewpoint-Negativfall auf, weil beide Komponenten denselben Typ hatten. Der Test verwendet jetzt einen tatsächlich anderen vorhandenen Typ.
- Zieltests nach der Korrektur: `npm run test --workspace backend -- --run src/modelTransfer/modelTransfer.test.ts src/auth/rbac.test.ts` – 2 Dateien, 25/25 Tests bestanden. Der erste Lauf innerhalb der eingeschränkten Prozessumgebung traf bei den RBAC-Testports `EACCES`; der identische freigegebene lokale Lauf bestand.
- Frischer isolierter PostgreSQL-Abschlusslauf: sechs Migrationen, 3 Dateien, 12/12 Tests bestanden. Der Runner blieb seriell; keine Assertions oder Produktzeitlimits wurden entfernt oder gelockert.
- `npm run check` bestand: Lint und beide Typechecks; 168 bestandene/12 übersprungene Backendtests (alle 12 DB-Tests separat real ausgeführt), 36/36 Frontendtests; beide Produktionsbuilds; 113 Compose-, 169 Workflow- und 17 Securityprüfungen; Prisma-Konfigurationsprüfung.
- `npm run scan:dependencies` bestand mit 10 moderaten, 0 hohen und 0 kritischen Befunden. Alle drei realen Compose-Konfigurationen wurden erneut erfolgreich geparst.
- Der exakte Containerbuild wurde erneut versucht und blieb vor dem Build an der fehlenden Docker-Desktop-Linux-Engine-Pipe blockiert. Das ist eine lokale Evidenzgrenze, kein bestandener Image-Build und kein nachgewiesener Produktfehler.
- Der commitgebundene Secret-Abschluss-Scan des Nacharbeits-Heads `72364525…` bestand: Canary korrekt abgelehnt, 74 Commits und 203 aktuelle Repository-Dateien ohne echten Fund. Die zweite unabhängige Kontrolle lehnte diesen Head später aus anderen technischen Gründen ab; der Scan bleibt historische Evidenz nur für diesen Head.

## Zweite Nacharbeit nach unabhängiger Kontrolle am 05.11.2026

- Die erneute Kontrolle bestätigte die vier vorherigen Findings als behoben, gab Head `7236452514c00f842a33a95e46783072aceff2ac` aber wegen zweier neuer Befunde nicht frei: `metamodel.createdAt` blieb beim Upsert eines bereits vorhandenen Ziel-Metamodells erhalten, und eine zweite ViewpointRule mit neuer ID für denselben Viewpoint erreichte die DB als HTTP-500-Constraintfehler.
- Die Entwicklerreproduktion bestätigte beide Fälle. Der reale Cross-Tenant-Import behielt zusätzlich alte nullable Zielwerte in ComponentType, ConnectionType, Viewpoint, ConnectionRule, ViewpointRule, ValidationRule und Diagram. Der doppelte ViewpointRule-Import antwortete mit HTTP 500; Modell und Audit blieben nur aufgrund des Transaktionsrollbacks unverändert.
- Der Writer übernimmt jetzt `createdAt` und `updatedAt` auch im Metamodell-Update. Sämtliche nullable Felder des exportierten Vertrags werden bei Abwesenheit explizit auf `null` gesetzt; alle übrigen exportierten Felder waren bereits vollständig im Upsert-Datensatz enthalten. Nicht exportierte technische Diagramm-/Katalogzeitstempel bleiben bewusst außerhalb des Vertrags.
- Die systematische Constraint-Prüfung deckt alle importrelevanten Composite-Constraints ab: ConnectionRule-Tripel, ViewpointRule-Zuordnung, Component-/Connection-`externalId` und beide Diagrammmitgliedschaften. Die Mitgliedschaften waren bereits durch JSON-Schema-`uniqueItems` geschützt; die übrigen Fälle besitzen explizite semantische Vorvalidierung.
- Neue Unitfälle prüfen sämtliche Constraintklassen. Der API-/DB-Gegenfall für eine zweite ViewpointRule erwartet HTTP 400 mit `MODEL_UNIQUENESS_INVALID` sowie unveränderten Export und unveränderte Auditanzahl.
- Der neue Cross-Tenant-DB-Test verwendet dieselbe portable Metamodell-ID, absichtlich verschiedene `createdAt`/`updatedAt` und gegensätzliche nullable Werte. Nach Import stimmen beide Zeitstempel, alle optionalen Felder und der vollständige Re-Export bytegenau mit der Quelle überein.
- Frischer isolierter PostgreSQL-Lauf: sechs Migrationen, 3 Dateien, 13/13 Tests bestanden. Der erste abrufbare Prozesslauf verlor nach Sitzungsende seine Abschlussausgabe; der identische Wiederholungslauf wurde vollständig bis Exitcode 0 aufgezeichnet.
- Zieltests: 2 Dateien, 26/26 bestanden. `npm run check` bestand mit Lint, beiden Typechecks, 169 bestandenen/13 übersprungenen Backendtests, 36/36 Frontendtests, beiden Produktionsbuilds, 113 Compose-, 169 Workflow- und 17 Securityprüfungen sowie Prisma-Konfigurationsprüfung. Alle 13 übersprungenen DB-Tests wurden separat real ausgeführt.
- Der Dependency-Audit blieb bei 10 moderaten, 0 hohen und 0 kritischen Befunden. Alle drei realen Compose-Konfigurationen wurden erfolgreich geparst.
- Der exakte Containerbuild wurde erneut versucht und blieb vor dem Build an der fehlenden Docker-Desktop-Linux-Engine-Pipe blockiert. Der Image-Build bleibt unbelegt; dies ist kein nachgewiesener Produktfehler.
- Der commitgebundene Secret-Scan des neuen Heads bestand: Canary korrekt abgelehnt, 75 Commits und 203 aktuelle Repository-Dateien ohne echten Fund. Die Zahl wurde erst nach Erstellung des Kandidatencommits beobachtet; der rein dokumentarisch amendierte finale Head wurde danach mit demselben Ergebnis erneut gescannt.
