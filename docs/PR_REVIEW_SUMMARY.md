# PR Summary: EAM Prototype Infrastructure, Persistence, Hosting, CI/CD and Auth

## Overview

This PR completes the core technical foundation for the EAM prototype. The project now supports database-backed persistence, Docker-based local and server execution, separated staging and production environments, HTTPS hosting, manual CI/CD deployments, and application-level authentication with company-based data isolation.

## Completed issues

Closes #17  
Closes #18  
Closes #19  
Closes #20  
Closes #21  
Closes #22

## Main changes

### Database and persistence

- Replaced primary JSON-file persistence with PostgreSQL and Prisma.
- Added database-backed storage for EAM entities, diagrams, instances, metamodel data and the legacy architecture model.
- Preserved flexible/custom attributes through PostgreSQL JSONB.
- Added a migration path for existing demo data without deleting the JSON sources.
- Added component-connection cascades and aggregate diagram loading.
- Prepared the persistence layer for company-isolated multi-user usage.

### Authentication and company isolation

- Added application-level registration and login.
- Added bcrypt password hashing; plaintext passwords are never stored.
- Added JWT-based authentication and `/api/auth/register`, `/login`, `/me` and `/logout`.
- Added `Company` and `User` models.
- Protected the EAM API routes with authentication middleware.
- Scoped EAM queries and writes to the authenticated user's `companyId`.
- Added frontend login/register flow, bearer-token handling and logout.

### Docker

- Added Docker execution for PostgreSQL, backend and frontend.
- Added database and backend healthchecks.
- Added Prisma migration and seed execution during backend container startup.
- Added environment-specific Compose files and retained local development support.

### Staging and production

- Staging path: `/var/www/eam-test`
- Production path: `/var/www/eam`
- Separate databases, database users, ports and Docker volumes.
- Separate server-only `.env.staging` and `.env.prod` files.
- Environment-specific `JWT_SECRET` values are passed only at runtime.

### Hosting

- Added Nginx reverse-proxy examples for frontend and `/api`.
- Added HTTPS setup using Certbot/Let's Encrypt.
- Staging URL: `https://eam-test.messers-cardio-club.com`
- Production URL: `https://eam.messers-cardio-club.com`
- The main domain remains untouched.
- The temporary Nginx Basic Auth layer was removed after application authentication became available. Commented example directives remain available as an optional additional defense.

### CI/CD

- Added automatic CI for pushes and pull requests.
- Added manual-only GitHub Actions deployments for staging and production.
- Deployments use SSH and the exact immutable revision verified by the workflow.
- Server-side `.env` files remain outside GitHub.
- Deployment guards cover missing inputs, placeholder values, dirty tracked worktrees, Compose failures and healthcheck failures.
- Safe diagnostics show step markers, versions, status and bounded service logs without printing secrets.
- Production still requires explicit deployment, backup and hosting-acceptance confirmations.

## Validation

The implementation has been validated through:

- TypeScript typecheck
- backend tests, including authentication and company repository isolation
- backend and frontend production builds
- Prisma schema validation
- local, staging and production Compose configuration checks
- workflow-policy validation
- internal healthchecks:
  - staging: `127.0.0.1:4400/api/health`
  - production: `127.0.0.1:4401/api/health`
- manually confirmed staging and production deployments
- browser-level application access after authentication

The repository validations should be rerun on the final PR revision; exact local results belong in the PR conversation or final handoff rather than being assumed from an earlier commit.

## Notes for reviewers

This is a research/prototype-grade EAM implementation. It is not a fully hardened enterprise production platform, but it provides the technical foundation needed to evaluate an EAM tool developed through AI-supported/vibe-coding workflows.

Security and operational notes:

- Real secrets and runtime `.env` files are not committed.
- `.env.staging` and `.env.prod` live only on the server.
- `JWT_SECRET` must be strong and different per environment.
- Application authentication is the primary access control; optional Nginx Basic Auth can be re-enabled as defense in depth.
- Production deployments remain manual.
- JWT logout is stateless and the MVP has no password-reset, email-verification or invitation workflow.
- PostgreSQL backups and rollback remain manual operational responsibilities.

## Reviewer focus

- Verify that auth responses never expose `passwordHash`.
- Verify that protected routes derive `companyId` only from the verified JWT.
- Review the migration assigning existing records to the Default Demo Company.
- Review Prisma filters and cross-company ID collision protection.
- Confirm server-side `.env` files contain non-placeholder, environment-specific JWT secrets.
- Confirm staging acceptance before approving a production deployment.
