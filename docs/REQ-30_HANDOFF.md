# REQ-30 – Übergabe zur unabhängigen Kontrolle

Basis: 3f5e9e40aa547f780efb44fd4ee821df8274df13. Branch: codex/eam/req-30-ci-security. Commit und PR-URL werden im Chat übergeben, damit das Dokument keinen selbstreferenziellen Commitwert enthält.

Status: **code-seitig bereit, externe Governance offen**. Hauptbeleg: [Claim-Evidence-Matrix](REQ-30_IMPLEMENTATION_EVIDENCE.md). Audit vorher 20 / Runtime 15; nachher jeweils 0. Keine Audit-Suppressions. Offene externe Abnahme: [Admin-Checkliste](security/GITHUB_ADMIN_CHECKLIST.md). Kein Merge, kein Issueschließen.

## Vollständige Dateiliste gegenüber der Basis

- .github/dependabot.yml
- .github/workflows/ci.yml
- .github/workflows/codeql.yml
- .gitignore
- .gitleaks.toml
- .gitleaksignore
- CONTRIBUTING.md
- README.md
- backend/package.json
- backend/src/auth/authMiddleware.ts
- backend/src/server.ts
- backend/vitest.config.ts
- docs/AI_REFLECTION_LOG.md
- docs/CICD_PLAN.md
- docs/EVALUATION_MATRIX.md
- docs/IMPLEMENTATION_PLAN.md
- docs/MAINTAINABILITY.md
- docs/PROMPT_LOG.md
- docs/REQ-30_HANDOFF.md
- docs/REQ-30_IMPLEMENTATION_EVIDENCE.md
- docs/REQ-30_REVIEW.md
- docs/security/DEPENDENCY_RISKS.md
- docs/security/GITHUB_ADMIN_CHECKLIST.md
- docs/security/SECRET_SCANNING.md
- docs/security/evidence/README.md
- docs/security/evidence/audit-after-tools.json
- docs/security/evidence/audit-after.json
- docs/security/evidence/audit-before.json
- docs/security/evidence/audit-fix-dry-run.txt
- docs/security/evidence/audit-runtime-after.json
- docs/security/evidence/audit-runtime-before.json
- eslint.config.mjs
- frontend/package.json
- frontend/src/DiagramEditor.tsx
- frontend/src/MetamodelView.tsx
- package-lock.json
- package.json
- scripts/scan-dependencies.mjs
- scripts/scan-secrets.mjs
- scripts/security.test.mjs
- scripts/validate-prisma-config.mjs
- scripts/validate-workflows.mjs
- scripts/workflow-security.mjs
