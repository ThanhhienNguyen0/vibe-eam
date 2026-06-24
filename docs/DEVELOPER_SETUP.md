# Developer Setup Guide

This guide explains how to run and validate the EAM prototype locally and how its shared staging and production environments are operated.

## 1. Required tools

- Git
- Node.js 22 or a compatible current LTS release
- npm
- Docker Desktop on Windows, or Docker Engine plus the Docker Compose plugin on Linux
- repository access
- environment-specific values for deployments

On this Windows workstation, use `docker.exe compose ...` if `docker compose ...` opens an application-selection dialog or is not recognized. GitHub Actions and Linux servers use `docker compose ...`.

Verify the toolchain:

```bash
node --version
npm --version
git --version
docker compose version
```

## 2. Clone and install

```bash
git clone https://github.com/ThanhhienNguyen0/vibe-eam.git
cd vibe-eam
npm ci
```

Use `npm install` only when intentionally changing dependencies. Commit the resulting `package-lock.json` together with the dependency change.

## 3. Local environment

Copy the example file without committing the resulting `.env`:

Linux/macOS:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Replace the local `JWT_SECRET` with a random value of at least 32 characters. With OpenSSL:

```bash
openssl rand -hex 32
```

The relevant variables are:

```dotenv
POSTGRES_DB=<local-database>
POSTGRES_USER=<local-user>
POSTGRES_PASSWORD=<local-password>
DATABASE_URL=postgresql://<user>:<password>@postgres:5432/<database>?schema=public
JWT_SECRET=<long-random-local-secret>
STORAGE_BACKEND=database
BACKEND_PORT=4000
FRONTEND_PORT=5173
CORS_ORIGIN=http://localhost:5173
```

Inside Docker, `DATABASE_URL` must use the service host `postgres`. When running the backend directly on the host, use `localhost` and a host-accessible PostgreSQL port instead. Passwords in `DATABASE_URL` and `POSTGRES_PASSWORD` must match.

Never copy staging or production secrets into local example files.

## 4. Run locally with Docker

Linux/macOS:

```bash
docker compose up --build
```

Windows variant used by this project:

```powershell
docker.exe compose up --build
```

The backend container runs Prisma migrations and the idempotent seed before starting. Check the stack with:

```bash
docker compose ps
curl http://localhost:4000/api/health
```

Use `docker.exe compose` for the same commands on affected Windows systems. The default frontend is available at `http://localhost:5173`.

Register a company and user through the app. Unauthenticated users see only the login/register screen; the EAM workspace is loaded after successful authentication.

## 5. Run without Docker

A reachable PostgreSQL instance and a host-compatible `DATABASE_URL` are required.

```bash
npm run db:generate --workspace backend
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
npm run dev
```

The backend refuses to start when `JWT_SECRET` is missing or shorter than 32 characters.

## 6. Required validation

Before pushing changes, run from the repository root:

```bash
npm run typecheck
npm test
npm run build
npm run validate:compose
npm run validate:workflows
```

Validate Prisma with an environment that provides `DATABASE_URL`:

```bash
npm run db:generate --workspace backend
npx prisma validate --schema backend/prisma/schema.prisma
```

Validate all rendered Compose variants:

```bash
docker compose --env-file .env.example -f docker-compose.yml config --quiet
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config --quiet
docker compose --env-file .env.prod.example -f docker-compose.prod.yml config --quiet
```

On the Windows workstation, replace `docker compose` with `docker.exe compose`.

## 7. Authentication and company isolation

- Registration creates a new `Company` and its first `User`.
- Passwords are stored only as bcrypt hashes.
- Sessions use JWT bearer tokens.
- Every user belongs to exactly one company.
- Protected EAM data is read and written using the `companyId` from the verified JWT, never from client input.
- `JWT_SECRET` is different for local, staging and production environments.

See [AUTH.md](AUTH.md) for the security model and MVP limits.

## 8. Staging

- path: `/var/www/eam-test`
- URL: `https://eam-test.messers-cardio-club.com`
- internal healthcheck: `http://127.0.0.1:4400/api/health`
- Compose file: `docker-compose.staging.yml`
- server-only environment file: `.env.staging`

Manual server check:

```bash
cd /var/www/eam-test
docker compose --env-file .env.staging -f docker-compose.staging.yml config --quiet
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
curl -f http://127.0.0.1:4400/api/health
```

## 9. Production

- path: `/var/www/eam`
- URL: `https://eam.messers-cardio-club.com`
- internal healthcheck: `http://127.0.0.1:4401/api/health`
- Compose file: `docker-compose.prod.yml`
- server-only environment file: `.env.prod`

Manual server check:

```bash
cd /var/www/eam
docker compose --env-file .env.prod -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
curl -f http://127.0.0.1:4401/api/health
```

Staging and production use different database names, users, passwords, ports, Docker volumes and JWT secrets.

## 10. Manual deployments

GitHub Actions provides manual-only staging and production deployment workflows. Required GitHub secrets:

```text
SERVER_HOST
SERVER_USER
SERVER_SSH_KEY
SERVER_SSH_KNOWN_HOSTS
STAGING_DEPLOY_PATH
PROD_DEPLOY_PATH
```

Expected paths:

```text
STAGING_DEPLOY_PATH=/var/www/eam-test
PROD_DEPLOY_PATH=/var/www/eam
```

Runtime `.env` files remain server-side and are neither generated nor printed by workflows. Production deployment additionally requires explicit production, backup and hosting-acceptance confirmations.

Deploy only an intended branch, tag or exact commit SHA. The workflow resolves it to an immutable SHA, runs verification first, rejects tracked server changes and then checks out that exact revision without `git reset --hard`.

## 11. Current external access protection

Application authentication is the primary access control. According to the completed deployment acceptance, the temporary Nginx Basic Auth layer was removed after app authentication became available. The commented Basic-Auth directives in `deploy/nginx` remain an optional emergency/demo defense and contain no credentials.

## 12. Safety rules

Never commit:

- `.env`, `.env.staging` or `.env.prod`
- database passwords
- JWT secrets or JWT tokens
- private SSH keys
- database dumps containing real data

Never use this on staging or production unless destroying the database volume is explicitly intended:

```bash
docker compose down -v
```

Before production deployment, confirm successful CI, staging acceptance, a complete server-side `.env.prod`, a current backup and a passing healthcheck. Follow [ROLLBACK.md](ROLLBACK.md) if rollback is required.

## 13. Review checklist

- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Build passes
- [ ] Prisma schema validates
- [ ] All Compose configurations validate
- [ ] Workflow validator passes
- [ ] No real secrets or runtime `.env` files are tracked
- [ ] Authentication still works
- [ ] Company isolation still works
- [ ] Staging deployment and internal healthcheck pass before production
