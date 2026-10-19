# ADR REQ-24: zentrale Aktionspolicies und frischer interner Benutzerkontext

Datum: 19.10.2026. Status: lokal implementiert; unabhängige Abnahme offen. Geltung: Authentifizierung/Autorisierung beider vorhandenen API-Datenpfade, keine Änderung der EAM-Fachmodelle.

## Problem und Entscheidung

Der bisherige freie Rollenstring `member` und acht Stunden autoritative JWT-Rollenclaims konnten weder Aktionsrechte noch zeitnahe Rechteänderungen ausdrücken. Das Projekt benötigt exakt Admin, Architect und Viewer sowie Company-Isolation.

Die Entscheidung trennt drei Ebenen: Der lokale JWT-Adapter prüft Identität und lädt einen internen Nutzer; `tenant.ts` hält den daraus erzeugten Company-/Benutzerkontext; der reine, typisierte `policy.ts` entscheidet über `read`, `architecture:write`, `metamodel:write`, `users:manage`. Ein explizites vollständiges Routeninventar mit vorgeschalteter Middleware verbindet Methoden/Pfade mit diesen Policies. Ein Vergleich mit dem tatsächlichen Express-Routergraphen erkennt neue, fehlende und doppelte Einträge. Neue Routen bleiben auch ohne Testausführung zur Laufzeit gesperrt, bis eine Policy existiert.

Alle serverseitigen Berechtigungsvergleiche verwenden die zentrale Policy; Schema-/Eingabewerte sind typisierte Rollen. Das Frontend konsumiert dieselbe reine Vokabular-/Policydatei über `access.tsx`. Der Frontend-Dockerbuild kopiert diese Datei ausdrücklich, um keinen lokal zufällig vorhandenen Backendquellbaum vorauszusetzen. Sie importiert keine Server-, Datenbank- oder Secretmodule.

## Alternativen

| Alternative | Grund für die andere Entscheidung |
|---|---|
| Einzelne `role === ...`-Checks über alle Routen verstreuen | Neue Pfade können unbemerkt ohne Prüfung entstehen; Matrix müsste mehrfach geändert werden |
| Berechtigungen nur in der Oberfläche ausblenden | Direkte HTTP-Requests umgehen die Oberfläche |
| Rollen im JWT bis Ablauf vertrauen | Herabstufungen wirken bis zu acht Stunden verspätet |
| Tokenversion oder zentrale Revocationliste | Zusätzliche Zustands-/Invalidierungslogik ohne Nutzen gegenüber dem vorhandenen DB-Nutzerlookup im MVP |
| OIDC direkt ergänzen | Gehört zu REQ-25; Provideridentität soll später am internen Nutzerboundary ergänzbar sein |
| Alle bisherigen Mitglieder zu Admin machen | Mehr Administrationsbefugnis als zur Vermeidung von Lockout nötig |

## Datenintegrität und Konkurrenz

Ein PostgreSQL-Enum erzwingt exakt die Rollen. Die atomare Migration ordnet pro bisheriger `member`-Company einen deterministischen Bootstrapadmin zu und erhält für weitere Mitglieder Architektur-Schreibzugriff. Unbekannte Altrollen blockieren die Migration zur fachlichen Klärung.

Nutzeranlage und Rollenwechsel sperren die Companyzeile vor Akteur-/Ziel-/Adminzählung und schreiben innerhalb derselben Transaktion. Gegenüber reinem `count` vor einer unabhängigen Aktualisierung schützt diese Reihenfolge vor konkurrierenden Herabstufungen. Auch die Berechtigung des Akteurs wird erst nach Sperrerwerb nochmals aus der DB geprüft. Keine Sperrstrategie für das gesamte Architekturmodell wird behauptet.

## Nachweis und Konsequenzen

Lokale DB-Tests prüfen echte PostgreSQL-Sperren, Migration und Seed; HTTP-Matrixtests und Routeninventar laufen im normalen Gate; Frontendtests prüfen erzeugte Rollenansichten und die 401/403-Fehlerbehandlung. Konkrete Resultate stehen in `REQ-24_IMPLEMENTATION_EVIDENCE.md`. Der CI-DB-Schritt wird gegen Entfernung/Optionalisierung regressionsgeprüft.

Belegbare Strukturwirkung: Eine Änderung der Berechtigungsmatrix hat einen zentralen Ort; eine neue API-Route benötigt eine explizite Zuordnung; ein Rollenwechsel braucht keine JWT-Neuausgabe. Bewertung: Das reduziert konkrete Drift-/Auslassungsmöglichkeiten, beweist aber weder allgemeine Wartbarkeit noch Produktionssicherheit. Kosten sind ein DB-Lookup je geschütztem Request, die explizite Pflege des Inventars, die Quelleinbindung der reinen Policy im Frontend und eine PostgreSQL-Binärabhängigkeit der DB-Tests.

Grenzen: in-flight Requests, lokale Tokenaufbewahrung, fehlende Browser-E2E-Nachweise, globale E-Mail-Konflikterkennung und administrative Direktzugriffe auf die Datenbank. Konkrete Kritikgründe des Professors liegen weiterhin nicht vollständig vor.

Quelle: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), Zugriff 19.10.2026. Die Anforderung bestimmt die Rollenmatrix; OWASP liefert Sicherheitsprinzipien, keine Freigabe dieses Codes.
