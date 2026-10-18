# GitHub: externe Abnahme für REQ-30

Stand 18.10.2026. Diese Datei beschreibt Soll-Konfiguration; sie aktiviert keine Einstellung. **Native Secret-Scanning-/Push-Protection-Einstellungen und klassische Branch Protection sind unbestätigt.**

## Beobachtete Rechte und Grenzen

- `GET /repos/ThanhhienNguyen0/vibe-eam` über die GitHub-Integration: öffentlich, `permissions.admin=false`, `maintain=false`, `push=true`.
- `GET /repos/ThanhhienNguyen0/vibe-eam/rulesets`: `[]`.
- `GET /repos/ThanhhienNguyen0/vibe-eam/branches/main/protection`: HTTP 403, `Resource not accessible by integration`. Daraus folgt nicht, dass klassische Protection fehlt.
- Der Secret-Scanning-Alerts-Endpunkt wird von dieser Integration nicht unterstützt; das fehlende `security_and_analysis`-Feld im Repository-Resultat bestätigt weder Aktivierung noch Deaktivierung. Keine externe Einstellung wurde geändert.

## Admin: Branch Protection für main

Repository → Settings → Rules → Rulesets (aktives Branch-Ruleset für exakt `main`) oder Settings → Branches → Branch protection rules. Eine konsistente Schutzkonfiguration verwenden und Überschneidungen prüfen.

- [ ] Pull Request vor Merge verlangen; mindestens **1 approving review**.
- [ ] Veraltete Freigaben bei neuen reviewpflichtigen Commits verwerfen; letzte Änderung unabhängig genehmigen lassen; offene Reviewgespräche müssen erledigt sein.
- [ ] Required status checks aktivieren und Branch vor Merge aktuell verlangen. Nach dem ersten erfolgreichen Lauf exakt diese tatsächlich angezeigten Check-Kontexte aus der GitHub-Actions-App auswählen:
  - `Quality and infrastructure` (Workflow `CI`, Job-ID `verify`)
  - `Dependency security` (Workflow `CI`, Job-ID `dependencies`)
  - `Secret security` (Workflow `CI`, Job-ID `secrets`)
  - `CodeQL JavaScript TypeScript` (Workflow `CodeQL`, Job-ID `analyze`)
- [ ] Check-Namen nicht beiläufig ändern; keine gleichnamigen Jobs in anderen Workflows. CodeQL-Ergebnis-/Code-Scanning-Merge-Regel ergänzen: neue relevante hohe/kritische Alerts blockieren und Alerts ausdrücklich triagieren. Ein erfolgreicher Analysejob allein bewertet nicht jeden Alert als unbedenklich.
- [ ] Regeln auch für Administratoren erzwingen („Do not allow bypassing“ / keine normalen Bypass-Akteure); direkte Pushes auf `main` unterbinden. Notfall-Bypass nur gesondert begründen, protokollieren und nachprüfen.
- [ ] Force-Push und Branch-Löschung verbieten. Keine unbeabsichtigte Write-/Admin-Bypass-Liste.
- [ ] Mit einem separaten Test-PR nachweisen: ohne Review blockiert, bei rotem Required Check blockiert, nach neuem Commit alte Freigabe ungültig. Kein absichtlicher Direkt-/Force-Push auf den echten `main` erforderlich.

## Admin: native Secret Protection und CodeQL

Repository → Settings → Security → Code security / Secret protection (Bezeichnungen können nach GitHub-Oberfläche variieren).

- [ ] Secret scanning aktiv; Push protection aktiv. Abdeckung, verfügbare Muster und etwaige Lizenz-/Plangrenzen prüfen. Bypassrechte eng halten und Auditspur vorsehen.
- [ ] Dependabot alerts und security updates aktivieren. `.github/dependabot.yml` ergänzt wöchentliche npm-/Action-Versionsupdates, beweist aber diese Schalter nicht.
- [ ] CodeQL **Advanced setup** für `.github/workflows/codeql.yml` verwenden; gegebenenfalls konkurrierendes Default setup deaktivieren, damit SARIF nicht wegen doppeltem Setup abgelehnt wird.
- [ ] Erstes PR-Ergebnis, main-Push-Ergebnis nach Merge und späteren Schedule-Lauf beobachten. Fork-PR-/Dependabot-Tokenrechte nach GitHub-Standard beibehalten, keine pauschalen Write-Rechte vergeben.
- [ ] Push-Protection-Test nur mit vom Anbieter vorgesehenen Testwerten in separatem Testkontext; niemals echte Credentials erzeugen oder in Logs kopieren. Der lokale Gitleaks-Canarytest beweist nur den Repository-Scanner.

## Abnahmebeleg (vom Admin auszufüllen)

| Prüffeld | Beobachtung / Nachweis |
|---|---|
| Datum, handelnder Admin, geprüfte Revision | offen |
| Aktives Ruleset / klassische Branch Protection, URL oder redigierter API-Export | offen |
| Required Checks samt GitHub-App und Reviewanzahl | offen |
| Negativtest ohne Review / mit rotem Check | offen |
| `secret_scanning.status` / `secret_scanning_push_protection.status` oder redigierter Settings-Nachweis | offen |
| CodeQL-Lauf, gesichtete Alerts und Merge-Regel | offen |
| Menschliche und unabhängige Kontrollfreigabe | offen |

Erst mit belastbaren Belegen dürfen diese Punkte als erfüllt gelten. Bis dahin lautet der Gesamtstatus bei bestandenen Codeprüfungen: **code-seitig bereit, externe Governance offen**.

Referenzen: [Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [Code scanning workflow options](https://docs.github.com/en/enterprise-cloud@latest/code-security/reference/code-scanning/workflow-configuration-options), [Secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning).
