import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const root = process.cwd();
const errors = [];
const checks = [];

function check(condition, message) {
  if (condition) checks.push(message);
  else errors.push(message);
}

function parseEnv(source) {
  return Object.fromEntries(source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }));
}

function interpolate(source, environment) {
  return source.replace(/\$\{([A-Z0-9_]+)(?::([-?])([^}]*))?\}/g, (_match, name, operator, fallback) => {
    const value = environment[name];
    if (value) return value;
    if (operator === "-") return fallback;
    if (operator === "?") throw new Error(`Required environment variable '${name}' is missing.`);
    return "";
  });
}

function validateDockerfile(source, label) {
  const logicalLines = source
    .replace(/\\\r?\n/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const instructions = new Set(["ARG", "CMD", "COPY", "ENTRYPOINT", "ENV", "EXPOSE", "FROM", "HEALTHCHECK", "LABEL", "RUN", "USER", "VOLUME", "WORKDIR"]);
  const stages = new Set();

  check(logicalLines[0]?.startsWith("FROM "), `${label}: starts with FROM`);
  for (const line of logicalLines) {
    const instruction = line.split(/\s+/, 1)[0];
    check(instructions.has(instruction), `${label}: valid instruction '${instruction}'`);
    const stage = line.match(/^FROM\s+\S+\s+AS\s+(\S+)/i)?.[1];
    if (stage) stages.add(stage);
    const sourceStage = line.match(/^COPY\s+--from=(\S+)/i)?.[1];
    if (sourceStage) check(stages.has(sourceStage), `${label}: COPY references existing stage '${sourceStage}'`);
  }
}

const [composeRaw, envRaw, backendDockerfile, frontendDockerfile, nginxTemplate] = await Promise.all([
  readFile(path.join(root, "docker-compose.yml"), "utf8"),
  readFile(path.join(root, ".env.example"), "utf8"),
  readFile(path.join(root, "backend", "Dockerfile"), "utf8"),
  readFile(path.join(root, "frontend", "Dockerfile"), "utf8"),
  readFile(path.join(root, "frontend", "nginx.conf.template"), "utf8")
]);

const environment = parseEnv(envRaw);
const resolvedRaw = interpolate(composeRaw, environment);
const compose = parse(resolvedRaw);
const services = compose?.services ?? {};

async function loadComposeVariant(composeFile, envFile) {
  const [variantRaw, variantEnvRaw] = await Promise.all([
    readFile(path.join(root, composeFile), "utf8"),
    readFile(path.join(root, envFile), "utf8")
  ]);
  const variantEnvironment = parseEnv(variantEnvRaw);
  const resolved = interpolate(variantRaw, variantEnvironment);
  return { raw: variantRaw, environment: variantEnvironment, compose: parse(resolved), resolved };
}

const staging = await loadComposeVariant("docker-compose.staging.yml", ".env.staging.example");
const production = await loadComposeVariant("docker-compose.prod.yml", ".env.prod.example");

check(!resolvedRaw.includes("${"), "all Compose variables resolve with .env.example");
check(Object.keys(services).sort().join(",") === "backend,frontend,postgres", "Compose defines postgres, backend and frontend");
check(services.postgres?.image === "postgres:16-alpine", "postgres uses the expected image");
check(Boolean(services.postgres?.healthcheck?.test), "postgres has a healthcheck");
check(Boolean(services.backend?.healthcheck?.test), "backend has a healthcheck");
check(services.backend?.depends_on?.postgres?.condition === "service_healthy", "backend waits for healthy postgres");
check(services.frontend?.depends_on?.backend?.condition === "service_healthy", "frontend waits for healthy backend");
check(Array.isArray(services.postgres?.volumes) && services.postgres.volumes.some((item) => String(item).startsWith("postgres_data:")), "postgres mounts postgres_data");
check(Object.prototype.hasOwnProperty.call(compose?.volumes ?? {}, "postgres_data"), "postgres_data named volume is declared");
check(String(services.backend?.environment?.DATABASE_URL ?? "").startsWith("postgresql://"), "backend receives a PostgreSQL DATABASE_URL");
check(services.backend?.environment?.STORAGE_BACKEND === "database", "backend explicitly selects database storage");
check(services.frontend?.environment?.BACKEND_UPSTREAM === "http://backend:4000", "frontend receives its backend upstream from environment configuration");
check(composeRaw.includes("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}"), "database password is injected, not literal in Compose");
check(environment.POSTGRES_PASSWORD === "change-me-for-local-development", ".env.example uses an obvious non-production placeholder password");

for (const [label, variant, expectedName, expectedVolume, expectedFrontendPort, expectedBackendPort] of [
  ["staging", staging, "eam-staging", "eam_staging_postgres_data", "8081", "4400"],
  ["production", production, "eam-prod", "eam_prod_postgres_data", "8080", "4401"]
]) {
  const variantServices = variant.compose?.services ?? {};
  check(!variant.resolved.includes("${"), `${label}: all variables resolve with its example env`);
  check(variant.compose?.name === expectedName, `${label}: distinct Compose project name '${expectedName}'`);
  check(Object.keys(variantServices).sort().join(",") === "backend,frontend,postgres", `${label}: defines postgres, backend and frontend`);
  check(Object.prototype.hasOwnProperty.call(variant.compose?.volumes ?? {}, expectedVolume), `${label}: declares '${expectedVolume}'`);
  check(variantServices.postgres?.volumes?.some((item) => String(item).startsWith(`${expectedVolume}:`)), `${label}: mounts its own database volume`);
  check(!variantServices.backend?.volumes, `${label}: backend does not mount the database volume`);
  check(!variantServices.frontend?.volumes, `${label}: frontend does not mount the database volume`);
  check(!variantServices.postgres?.ports, `${label}: does not expose PostgreSQL on a public host port`);
  check(variantServices.backend?.ports?.some((item) => String(item).includes(`127.0.0.1:${expectedBackendPort}:4000`)), `${label}: backend port is loopback-only and environment-specific`);
  check(variantServices.frontend?.ports?.some((item) => String(item).includes(`127.0.0.1:${expectedFrontendPort}:80`)), `${label}: frontend port is loopback-only and environment-specific`);
  check(variantServices.backend?.environment?.STORAGE_BACKEND === "database", `${label}: backend forces database storage`);
  check(String(variantServices.backend?.environment?.DATABASE_URL ?? "").startsWith("postgresql://"), `${label}: backend receives DATABASE_URL`);
  check(["postgres", "backend", "frontend"].every((service) => variantServices[service]?.restart === "unless-stopped"), `${label}: all services use restart unless-stopped`);

  const databaseUrl = new URL(variant.environment.DATABASE_URL);
  check(databaseUrl.hostname === "postgres", `${label}: DATABASE_URL uses Docker host 'postgres', not localhost`);
  check(decodeURIComponent(databaseUrl.username) === variant.environment.POSTGRES_USER, `${label}: DATABASE_URL user matches POSTGRES_USER`);
  check(decodeURIComponent(databaseUrl.password) === variant.environment.POSTGRES_PASSWORD, `${label}: DATABASE_URL password matches POSTGRES_PASSWORD`);
  check(databaseUrl.pathname.replace(/^\//, "") === variant.environment.POSTGRES_DB, `${label}: DATABASE_URL database matches POSTGRES_DB`);
}

check(staging.environment.POSTGRES_DB !== production.environment.POSTGRES_DB, "staging and production use different database names");
check(staging.environment.POSTGRES_USER !== production.environment.POSTGRES_USER, "staging and production use different database users");
check(!staging.environment.POSTGRES_PASSWORD.includes("production"), "staging example password is not the production placeholder");
check(staging.environment.CORS_ORIGIN === "https://eam-test.messers-cardio-club.com", "staging CORS uses the staging subdomain");
check(production.environment.CORS_ORIGIN === "https://eam.messers-cardio-club.com", "production CORS uses the production subdomain");

for (const serviceName of ["backend", "frontend"]) {
  const dockerfile = services[serviceName]?.build?.dockerfile;
  check(typeof dockerfile === "string", `${serviceName} declares a Dockerfile`);
  if (typeof dockerfile === "string") {
    await access(path.join(root, dockerfile));
    checks.push(`${serviceName} Dockerfile exists`);
  }
}

validateDockerfile(backendDockerfile, "backend/Dockerfile");
validateDockerfile(frontendDockerfile, "frontend/Dockerfile");
check(backendDockerfile.includes("db:generate"), "backend image generates Prisma Client");
check(backendDockerfile.includes("db:migrate"), "backend startup deploys migrations");
check(backendDockerfile.includes("db:seed"), "backend startup runs the idempotent seed");
check(frontendDockerfile.includes("vite") || frontendDockerfile.includes("build --workspace frontend"), "frontend image builds the Vite application");
check(nginxTemplate.includes("${BACKEND_UPSTREAM}"), "nginx backend upstream is environment-configured");

if (errors.length > 0) {
  console.error(`Static Compose validation failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Static Compose validation passed (${checks.length} checks).`);
  console.log("This validates configuration only; it does not build images or start containers.");
}
