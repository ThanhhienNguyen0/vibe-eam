# Database and Docker Plan

## Aktueller Persistenzstand

Vor Issue #17 bestanden zwei dateibasierte Stores:

- `backend/src/store.ts` speichert das historische `/api/model`-Modell in `backend/data/model.json`.
- `backend/src/Sidebar/sidebarStore.ts` speichert den vom aktuellen React-Frontend verwendeten Zustand in `backend/src/data/sidebar.json`. Darin liegen Metamodel, ComponentTypes, ConnectionTypes, ConnectionRules, Viewpoints, ViewpointRules, ValidationRules, ComponentInstances, ConnectionInstances und Diagrams gemeinsam.

Die Sidebar-Routen unter `/api/sidebar` sind der aktuelle Hauptpfad. Metamodel-Import und -Export arbeiten auf derselben fachlichen Struktur, exportieren aber bewusst keine Instanzen oder Diagramme. Das Frontend verwendet relative `/api/sidebar`-Aufrufe. Der Legacy-Endpunkt `/api/model` wird in diesem Infrastruktur-MVP nicht umgeschrieben.

## Technologieentscheidung

Gewählt werden PostgreSQL 16 und Prisma 6.

- Diagramme, Komponenten, Verbindungen und Regelreferenzen benötigen relationale Integrität und transaktionale Änderungen.
- PostgreSQL bietet Fremdschlüssel, Kaskaden und zugleich JSONB für `properties`, `customPropertyKeys`, Positionsdaten und flexible ID-Mengen.
- PostgreSQL passt zu Docker, einem späteren Serverbetrieb und einer späteren Mehrbenutzerfähigkeit.
- Prisma passt zum TypeScript-/Node-Backend, erzeugt einen typisierten Client und versionierbare SQL-Migrationen.

Ein dokumentenorientierter Store wäre für flexible Attribute bequem, würde aber die wichtigen Source-/Target-, Typ- und Diagrammbeziehungen schwächer absichern. Ein rein manueller SQL-Query-Builder würde in diesem kleinen Team mehr Mapping- und Migrationscode erzeugen, ohne für das MVP einen entsprechenden Vorteil zu bringen.

## Geplantes und umgesetztes Datenmodell

Das Prisma-Modell umfasst Metamodel, ComponentType, ConnectionType, ConnectionRule, Viewpoint, ViewpointRule, ValidationRule, Diagram, ComponentInstance und ConnectionInstance. ConnectionRule bleibt die primäre fachliche Quelle. Stakeholder bleibt ein normaler, modellierbarer ComponentType.

Flexible Werte werden als PostgreSQL JSONB gespeichert. Source und Target einer ConnectionInstance sind echte Fremdschlüssel. Beide verwenden `ON DELETE CASCADE`, sodass das Löschen einer ComponentInstance alle ein- und ausgehenden ConnectionInstances auf Datenbankebene entfernt. Diagramme werden mit Prisma `include` einschließlich Komponenten und Verbindungen gelesen; die kompatible API stellt zusätzlich `GET /api/sidebar/diagrams/:id` bereit.

Details stehen in [DATABASE_MODEL.md](./DATABASE_MODEL.md).

## Repository-/Store-Abstraktion

`PrismaSidebarStateRepository` kapselt das DB-Mapping. Der bestehende Store und damit die bestehenden Routen behalten ihre fachlichen TypeScript-Strukturen. Bei gesetzter `DATABASE_URL` und `STORAGE_BACKEND != json` wird aus PostgreSQL gelesen und ausschließlich nach PostgreSQL geschrieben.

Ist die DB beim ersten Start leer, wird der bestehende `sidebar.json`-Stand einmalig kopiert. Die Quelldatei wird nicht verändert oder gelöscht. Ohne `DATABASE_URL` bleibt für bestehende lokale Tests und Offline-Entwicklung ein dokumentierter JSON-Fallback aktiv; im Docker-Setup ist die DB immer der primäre Store.

## Migrationsstrategie

1. JSON-Dateien als unveränderte Sicherungs- und Referenzquelle behalten.
2. SQL-Schema mit `prisma migrate deploy` anlegen.
3. Leere DB idempotent aus `default-metamodel.json` seeden; optional Beispiel-Diagramme aus dem bestehenden Sidebar-JSON übernehmen.
4. Bestehende Daten mit `npm run db:migrate-json --workspace backend` kopieren. Eine nicht leere DB wird ohne `FORCE_JSON_MIGRATION=true` nicht überschrieben.
5. Nach fachlicher Stichprobe und Exportvergleich PostgreSQL als normalen Betriebsweg verwenden.

Metamodel-Import validiert weiterhin vor dem Schreiben und wird innerhalb des DB-State-Writes transaktional persistiert. Ein Import, der bestehende Instanzen durch fehlende Typen verwaisen lassen würde, wird mit `IMPORT_WOULD_ORPHAN_INSTANCES` abgelehnt. Metamodel-Export verwendet unverändert `extractMetamodelDefinition`.

## Docker-Strategie

`docker-compose.yml` startet drei Dienste:

- `postgres`: PostgreSQL 16 mit persistentem Named Volume und Healthcheck.
- `backend`: Multi-Stage-Build, Prisma-Migration, idempotenter Seed und Express-Start.
- `frontend`: Vite-Build und Nginx; `/api` wird an den per `BACKEND_UPSTREAM` konfigurierten Backend-Dienst weitergeleitet.

Konfiguration kommt aus `.env`; `.env.example` enthält nur lokale Beispielwerte. Es werden keine Produktions-Secrets eingecheckt.

## Risiken und MVP-Grenzen

- Der historische `/api/model`-Store bleibt JSON-basiert. Das aktuelle React-Frontend nutzt den DB-migrierten Sidebar-Pfad.
- ComponentInstances und ConnectionInstances können im DB-MVP höchstens einem Diagramm gehören. `diagramId` ist während des Editor-Ablaufs nullable, weil das Frontend eine Instanz zunächst erstellt und erst danach dem Diagramm zuordnet.
- Der State-kompatible Repository-Write synchronisiert aktuell den vollständigen aktiven Metamodel-Zustand. Für große Datenmengen sollten später granulare Repositories und optimistische Sperren ergänzt werden.
- Es gibt bewusst kein Auth, kein CI/CD, kein Live-Deployment und keine Mehrbenutzer-Konfliktlösung.
- JSON-Fallback ist nur Kompatibilitätsweg; produktionsnahe Läufe müssen `DATABASE_URL` setzen.
