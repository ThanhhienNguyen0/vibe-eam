# Wartbarkeit: belegter Stand und Änderungsregeln

## REQ-24-Ergänzung vom 19.10.2026

Der aktuelle Authpfad ergänzt `auth/routePolicies.ts` vor allen Routen, `auth/policy.ts` als reinen gemeinsamen Grantkern, einen aktuellen DB-Nutzerlookup pro Request und Nutzerverwaltung mit company-weitem Transaktionslock. Die Frontend-Permissiongrenzen konsumieren denselben reinen Kern; dessen explizite Docker-Kopie ist Teil des Buildvertrags. ADR und Nachweise: `ADR-REQ-24_AUTHORIZATION.md`, `REQ-24_IMPLEMENTATION_EVIDENCE.md`.

Beobachtbare Wartbarkeitseffekte sind ein zentraler Grantänderungsort, ein geprüfter vollständiger Express-Routengraph statt nicht inventarisierter Einzelchecks, ein gemeinsamer Passwort-Hasher und zusätzliche Vitest-Frontend-/echte PostgreSQL-Tests. Eine fehlende Policy wird sowohl im Inventartest als auch zur Laufzeit erkannt. Der CI-DB-Schritt wird gegen Entfernung/Optionalisierung geprüft. Bewertung: Diese Änderungen begrenzen konkrete Rollen-/Routendrift; sie beweisen keine allgemeine Wartbarkeit.

Verbleibende Kosten/Grenzen: zusätzlicher DB-Lookup je Request, explizite Inventarpflege, PostgreSQL-Binaries für DB-Integration und Quellkopplung des reinen Policykerns im Frontendbuild. Die großen UI-/Storedateien, separaten Fachmodelle und Full-State-Persistenz werden nicht pauschal umgebaut. Die frühere DB-Testlücke ist für Auth/RBAC/Migration/Seed gezielt geschlossen, nicht für sämtliche übrigen Persistenzoperationen. SSR-Komponententests ersetzen keine Browser-E2E-Prüfung. Professorengründe bleiben eine offene Evidenzlücke; kein eigener Befund wird als dessen Aussage ausgegeben.

Die nachfolgenden REQ-30-Befunde sind datierte Vorgängerstände, soweit diese Ergänzung sie aktualisiert.

Stand: 18.10.2026, REQ-30. Interner technischer Prüfstand; keine abschließende wissenschaftliche Bewertung. Der Professor hat nach dem Umsetzungsauftrag die Wartbarkeit grundsätzlich infrage gestellt. Konkrete Gründe sind noch nicht vollständig übermittelt und bleiben eine **offene Evidenzlücke**. Die folgenden Risiken stammen aus Repository-Befunden; sie werden dem Professor nicht zugeschrieben.

## Architektur und zwei Datenpfade

Der aktuelle Browserpfad ist `App.tsx` → `authApi.ts`/`Sidebar/sidebarApi.ts` → `server.ts`/`auth/*`/`Sidebar/sidebarRoutes.ts` → `Sidebar/sidebarStore.ts` → `persistence/databaseSidebarRepository.ts`. React stellt Anmeldung, Sidebar, Diagrammeditor und Metamodel-Ansicht bereit. Authentifizierung über JWT/bcrypt und Company-Kontext über `tenant.ts` liegen serverseitig vor der fachlichen API.

Mit `DATABASE_URL` persistiert der aktuelle Sidebar-/Diagrammpfad über Prisma in PostgreSQL. `stateOperations.ts` enthält pure Zustandsoperationen, `metamodelConfig.ts` Import-/Exportvalidierung und `metamodelRules.ts` fachliche Diagrammregeln. Ohne Datenbankkonfiguration existiert ein expliziter JSON-Fallback. Authentifizierung selbst benötigt im normalen Server weiterhin eine Auth-Datenbank; der Fallback macht daraus keinen vollständig DB-freien Loginbetrieb.

Der historische `/api/model`-Pfad (`store.ts`, `types.ts`, `metamodel.ts`, `validation.ts`, `portfolio.ts`) ist getrennt vom aktuellen Sidebar-Modell. Mit DB-Konfiguration schreibt `store.ts` Company-bezogene `ArchitectureModel`-JSONB-Aggregate; ohne DB-Konfiguration Company-bezogene Dateien. Die alte Aussage „Legacy immer JSON-Datei“ ist seit der Auth-Erweiterung überholt. Eine automatische fachliche Synchronisierung zwischen beiden Modellen ist nicht nachgewiesen. Historische Impact-/Portfolio-Backendlogik ist kein Beleg für entsprechende aktuelle UI-Funktionen.

## Hotspots und beobachtete Grenzen

| Befund / Beleg | Wartbarkeitsrisiko (Bewertung) | Änderungsregel |
|---|---|---|
| `frontend/src/DiagramEditor.tsx`, rund 1.300 Zeilen; Renderer, Interaktionen, API-Aufrufe und Dialoge | Viele Änderungsanlässe in einer Datei; Hook-Abhängigkeiten waren unvollständig und wurden unter REQ-30 korrigiert | Reine Renderer und Dialoge bei fachlicher Änderung schrittweise extrahieren; keine pauschale Neuentwicklung in REQ-30 |
| `frontend/src/MetamodelView.tsx`, rund 1.150 Zeilen; `SidebarPanels.tsx`, rund 1.030 | Große UI-Komponenten ohne Browser-Regressionstests | Erst Verhalten und Fehlermeldungen per UI-Test absichern, dann zusammenhängende Bereiche trennen |
| `backend/src/Sidebar/sidebarStore.ts`, rund 1.430 Zeilen; `sidebarRoutes.ts`, rund 600 | Initialdaten, Normalisierung, Cache und CRUD konzentriert; Full-State-Writes und Caches erschweren parallele Änderungen | Tenant-Kontext niemals optional machen; Operationen in pure Funktionen verschieben, Konkurrenz-/Transaktionstests vor Persistenzumbau |
| `backend/src/Sidebar/sidebarTypes.ts` und `frontend/src/Sidebar/sidebarTypes.ts`; zwei `metamodelRules.ts` | Getrennte Definitionen können semantisch driften; keine Behauptung vollständiger Textgleichheit | Änderungen an Regeln/DTOs auf beiden Seiten prüfen; gemeinsame Vertragstests vor Shared-Package-Auslagerung |
| Legacy-Modell plus Sidebar-Modell | Zwei Begriffs-/Datenwelten, historische Dokumentationsaussagen passen nicht automatisch zum Browserpfad | Jede neue Anforderung benennt den betroffenen Datenpfad; Legacy nicht still in aktuelle Views einbauen |
| `databasePersistence.test.ts` nutzt MemoryRepository und Schema-/Zustandsprüfungen | Keine echte PostgreSQL-Transaktion, DB-Cascade oder parallele Tenant-Persistenz im Test nachgewiesen | Isolierte DB-Integration vor Freigabe von Datenmigrationen hinzufügen |
| Backend-Dockerfile kopiert das komplette `node_modules` aus dem Build | Build-/CLI-/Test-Abhängigkeiten bleiben physisch im Backend-Image; `--omit=dev` unterschätzt diese Exposition | Eigenes Runtime-Install-/Migrationskonzept mit Prisma/Seed prüfen; nicht durch Umklassifizieren den Auditbefund verkleinern |
| Historische Doku nennt keine Authentifizierung, alte Testzahlen und entfernte Frontendansichten | Dokumentationsdrift erschwert Review und Reproduktion | Aktueller Stand datieren, historische Zyklen als historisch kennzeichnen; Funktionsbehauptungen am aktuellen Code prüfen |

Zeilenumfänge sind gerundete Größenindikatoren dieses Änderungsstands, kein eigenständiger Qualitätsbeweis. Ein fehlender Test beweist keinen Fehler; bestandene Tests beweisen keine umfassende Wartbarkeit oder Sicherheit.

## Prüfgrenzen und Prioritäten

1. **Vor Merge, Maintainer/Reviewer:** offene native Security-/Branch-Einstellungen und tatsächliche GitHub-Läufe prüfen; Deadline vor Merge. Befunde/Quellen: `REQ-30_IMPLEMENTATION_EVIDENCE.md`, Security-Dokumente.
2. **Nächste Persistenzänderung, Backend-Verantwortliche:** isolierte PostgreSQL-Tests für Company-Isolation, DB-Cascade, Import, gleichzeitige Writes sowie Backup/Restore. Abhängigkeit: REQ-28/REQ-24; keine Ausweitung dieser Issues in REQ-30.
3. **Nächste UI-Änderung, Frontend-Verantwortliche:** Login und Diagramm-/Metamodel-Kernablauf per Browser testen, danach UI-Hotspots schrittweise zerlegen. API-Auth-Tests ersetzen diesen Nachweis nicht.
4. **Bis 01.11.2026, Repository-Maintainer:** Dependency-Risiken und befristete technische Paketentscheidungen erneut prüfen; Runtime-Image-Abhängigkeiten reduzieren; stabile Verträge für duplizierte Typen/Regeln planen.
5. **Nach Eingang der Rückmeldung, Forschungsverantwortliche:** konkrete Professorenargumente mit Herkunft/Datum erfassen und gegen vorhandene Evidenz prüfen. Bis dahin keine kausalen Aussagen darüber, weshalb die Wartbarkeit kritisiert wurde.

Die Erstellung dieser Ausarbeitung wurde durch KI unterstützt.
