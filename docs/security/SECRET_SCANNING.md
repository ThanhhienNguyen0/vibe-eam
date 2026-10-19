# Secret-Scan: Umfang, Triage und Grenzen

Stand: 18.10.2026. `npm run scan:secrets` lädt Gitleaks **8.30.1** ausschließlich aus dem offiziellen Release. Das Archiv wird vor jeder Extraktion gegen einen fest versionierten SHA-256 geprüft; ein verändertes Binary im Cache wird aus dem geprüften Archiv neu extrahiert. Es gibt keine Drittanbieter-Action mit Tokenzugriff. CI-Checkout und Node-Setup sind auf vollständige Commit-SHAs gepinnt; der Scannerjob hat nur `contents: read`, keine persistierten Git-Zugangsdaten und führt keine npm-Installationsskripte aus.

Der Scanner prüft zuerst eine zur Laufzeit erzeugte, künstliche GitHub-Tokenzeichenfolge und verlangt Exit 1. Der Wert ist nicht bei einem Anbieter registriert und wird weder ausgegeben noch versioniert. Danach werden alle vollständig ausgecheckten Git-Refs und die getrackten sowie nicht ignorierten aktuellen Dateien geprüft. Ein flacher Checkout wird abgelehnt; CI nutzt `fetch-depth: 0`. Ignorierte private `.env`-Dateien und `node_modules` gehören nicht zum aktuellen Datei-Snapshot. History-Scans umfassen dennoch früher versionierte Dateien. Inline-`gitleaks:allow` ist deaktiviert; nur die ausdrücklich versionierte `.gitleaksignore` wird verwendet. Alle Scannerausgaben sind zu 100 Prozent redigiert.

## Ein historischer Fehlalarm

Der erste vollständige Scan meldete `generic-api-key` in `apps/api/README.md`, Zeile 5, Commit `f373c988cb3bd241248e3845ea626f9975c60f02`. Die Zeile ist der CircleCI-Badge des offiziellen NestJS-TypeScript-Starters mit dessen öffentlich identischem Beispielparameter. Herkunft wurde am 18.10.2026 anhand der [offiziellen Starterdatei](https://github.com/nestjs/typescript-starter/blob/master/README.md) und der lokalen Git-Version geprüft. Es wurde keine nutzbare Zugangsinformation nachgewiesen.

Die begründete technische Ausnahme in `.gitleaksignore` bindet **unveränderlichen Commit, exakten Pfad, Regel und Zeile**. Damit ist auch der historische Zeileninhalt unveränderlich festgelegt. Sie erlaubt weder die ganze Datei noch die generische Regel noch denselben Wert in neuen Commits. Verantwortlich: Repository-Maintainer/Reviewrolle; erneut zu prüfen vor Merge und bei Scannerupdates. Neue echte Funde bleiben blockierend und erfordern Rotation/Widerruf sowie vertrauliche Triage; keine Historienumschreibung erfolgt automatisch. Eine zunächst versuchte kombinierte Zeilen-/Commit-Allowlist griff im beobachteten Historylauf nicht; sie wurde durch diesen engeren, verifizierbaren Fingerprint ersetzt.

## Grenzen

Musterbasierte Suche kann unbekannte Secretformate übersehen. Ein bestandener Repository-Scan ist kein Nachweis aktivierter nativer GitHub Secret Protection und verhindert keinen Push vor Beginn der PR-CI. Native Aktivierung und Push Protection bleiben separat in `GITHUB_ADMIN_CHECKLIST.md` offen. Die Archivhashes stammen aus den offiziellen Releaseprüfsummen; deren Lieferkette ist kein zusätzlicher unabhängiger Signaturnachweis.

Quellen: [Gitleaks CLI und Konfiguration](https://github.com/gitleaks/gitleaks), [Release 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).
