# Authentifizierung und Company-Isolation

## Konzept

Issue #18 ergänzt echte Anwendungsauthentifizierung. Eine Registrierung legt immer ein neues `Company`-Objekt und den ersten zugehörigen `User` an. Ein automatischer Beitritt zu einem bestehenden Unternehmen ist im MVP bewusst nicht möglich, weil dafür Einladungstoken oder eine administrative Freigabe nötig wären.

Passwörter werden mit bcrypt und Kostenfaktor 12 gehasht. Die Datenbank speichert ausschließlich `passwordHash`; API-Antworten enthalten dieses Feld nie. Login und Registrierung liefern ein signiertes JWT mit `userId`, `companyId` und Rolle. Das JWT ist acht Stunden gültig und wird als `Authorization: Bearer <token>` gesendet.

`/api/health`, `/api/auth/register` und `/api/auth/login` sind öffentlich. `/api/auth/me`, `/api/auth/logout`, alle `/api/sidebar`-Routen sowie die historischen `/api/model`- und Audit-Routen verlangen ein gültiges JWT.

## Company-Isolation

- Jeder Nutzer gehört genau zu einer Company.
- Der Company-Kontext stammt ausschließlich aus dem verifizierten JWT, niemals aus Request-Bodies.
- Metamodelle, Diagramme, ComponentInstances, ConnectionInstances und der historische Architekturmodell-Zustand sind einer Company zugeordnet.
- Der Prisma-Repository-Layer filtert Lese-, Schreib- und Löschoperationen nach `companyId` beziehungsweise nach dem company-eigenen Metamodell.
- IDs, die bereits einer anderen Company gehören, werden vor einem Repository-Schreibvorgang abgelehnt.
- Neue Companies erhalten beim ersten Zugriff eine company-eigene Kopie des Default-Metamodells. Bei `SEED_EXAMPLES=false` werden keine Beispielinstanzen oder -diagramme kopiert.

Die Migration `20260623170000_add_auth_and_company_isolation` ordnet alle bereits vorhandenen Daten der `Default Demo Company` (`company-default-demo`) zu. Sie löscht weder DB- noch JSON-Daten. Für die Default-Company wird bewusst kein festes Demo-Passwort erzeugt.

## Environment-Variable

`JWT_SECRET` ist für den Backend-Start verpflichtend und muss mindestens 32 Zeichen lang und zufällig sein. Staging und Produktion benötigen unterschiedliche Werte. Der Wert wird in den echten, nicht committeten `.env.staging`- beziehungsweise `.env.prod`-Dateien gepflegt und von Docker Compose an das Backend übergeben.

Beispiel für eine lokale `.env`:

```dotenv
JWT_SECRET=local-only-random-secret-with-at-least-32-characters
```

Fehlt der Wert oder ist er zu kurz, bricht das Backend beim Start mit einer klaren Fehlermeldung ab. Passwörter, JWTs und Env-Inhalte dürfen nicht geloggt werden.

## Lokale Nutzung

1. `.env.example` nach `.env` kopieren und `JWT_SECRET` für die eigene Umgebung ändern.
2. Migration und Seed wie bisher über den Backend-Container oder die DB-Skripte ausführen.
3. Anwendung starten und im Login-Bildschirm ein neues Unternehmen registrieren.
4. Nach erfolgreicher Registrierung wird der JWT-Token clientseitig gespeichert und der EAM-Workspace geladen.
5. Abmelden entfernt den Token. Ein fehlender oder abgelaufener Token führt zurück zum Login.

## Staging und Produktion

Vor dem nächsten Deployment müssen die serverseitigen `.env.staging` und `.env.prod` jeweils einen eigenen starken `JWT_SECRET` enthalten. Die Pipeline erzeugt oder protokolliert diese Dateien nicht.

Nginx Basic Auth bleibt zunächst als zusätzlicher äußerer Schutz aktiv. Die JWT-basierte App-Authentifizierung ist die eigentliche fachliche Anmeldung und Company-Trennung. Basic Auth ersetzt sie nicht und kann später nach einer bewussten Sicherheitsabnahme entfernt werden.

## MVP-Grenzen

- keine E-Mail-Verifikation oder Passwort-zurücksetzen-Funktion
- keine Einladungen in bestehende Companies
- keine serverseitige JWT-Revocation; Logout ist stateless
- Rollen werden gespeichert, aber es gibt noch keine feingranulare Rollen-/Rechteverwaltung
- Token liegt im Browser-Storage; ein späteres Hardening kann auf kurzlebige Access-Tokens und HttpOnly-Refresh-Cookies umstellen
