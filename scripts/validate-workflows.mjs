import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

const root = process.cwd();
const failures = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

async function load(file) {
  const raw = await readFile(path.join(root, ".github", "workflows", file), "utf8");
  return { raw, workflow: parse(raw) };
}

function triggers(workflow) {
  if (typeof workflow.on === "string") return [workflow.on];
  if (Array.isArray(workflow.on)) return workflow.on;
  return Object.keys(workflow.on ?? {});
}

function allRunScripts(workflow) {
  return Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .map((step) => step.run ?? "")
    .join("\n");
}

const ci = await load("ci.yml");
const staging = await load("deploy-staging.yml");
const production = await load("deploy-prod.yml");

const ciTriggers = triggers(ci.workflow);
check(ciTriggers.includes("push"), "CI must run on push");
check(ciTriggers.includes("pull_request"), "CI must run on pull_request");
const ciRuns = allRunScripts(ci.workflow);
for (const command of [
  "npm ci",
  "npm run typecheck",
  "npm test",
  "npm run build",
  "docker compose --env-file .env.example",
  "docker compose --env-file .env.staging.example",
  "docker compose --env-file .env.prod.example",
  "npm run validate:compose",
  "docker compose --env-file .env.example -f docker-compose.yml build backend frontend"
]) check(ciRuns.includes(command), `CI command missing: ${command}`);
check(!ci.raw.includes("docker.exe compose"), "GitHub CI must use Linux 'docker compose'");

for (const [label, document, envFile, composeFile, port, pathSecret] of [
  ["staging", staging, ".env.staging", "docker-compose.staging.yml", "4400", "STAGING_DEPLOY_PATH"],
  ["production", production, ".env.prod", "docker-compose.prod.yml", "4401", "PROD_DEPLOY_PATH"]
]) {
  const workflowTriggers = triggers(document.workflow);
  check(workflowTriggers.length === 1 && workflowTriggers[0] === "workflow_dispatch", `${label} deployment must be workflow_dispatch only`);
  const scripts = allRunScripts(document.workflow);
  check(scripts.includes("npm run typecheck") && scripts.includes("npm test") && scripts.includes("npm run build"), `${label} deployment must verify code before deploy`);
  check(document.workflow.jobs?.deploy?.needs === "verify", `${label} deploy job must need verify`);
  check(document.raw.includes(`secrets.${pathSecret}`), `${label} deploy path must come from the expected secret`);
  check(document.raw.includes("secrets.SERVER_SSH_KEY"), `${label} SSH key secret missing`);
  check(document.raw.includes("secrets.SERVER_SSH_KNOWN_HOSTS"), `${label} known-hosts secret missing`);
  check(scripts.includes(`test -f ${envFile}`), `${label} must require the server-side env file`);
  check(scripts.includes(`docker compose --env-file ${envFile} -f ${composeFile} config --quiet`), `${label} target Compose config check missing`);
  check(scripts.includes(`docker compose --env-file ${envFile} -f ${composeFile} up -d --build`), `${label} target Compose deployment missing`);
  check(scripts.includes(`http://127.0.0.1:${port}/api/health`), `${label} internal healthcheck missing`);
  check(document.raw.includes("needs.verify.outputs.verified_sha"), `${label} must deploy the exact verified commit SHA`);
  check(!document.raw.includes("git reset --hard"), `${label} must not hard-reset the server worktree`);
  check(!document.raw.includes("docker.exe compose"), `${label} GitHub workflow must use Linux 'docker compose'`);
  check(!/POSTGRES_PASSWORD\s*[:=]\s*\S+/.test(document.raw), `${label} workflow must not contain a database password`);
}

check(production.raw.includes("DEPLOY_PRODUCTION"), "production explicit confirmation gate missing");
check(production.raw.includes("backup_confirmed"), "production backup gate missing");
check(production.raw.includes("acceptance_confirmed"), "production hosting acceptance gate missing");
check(!production.raw.includes("push:"), "production deployment must not have a push trigger");

if (failures.length > 0) {
  console.error(`Workflow validation failed (${failures.length}/${checks}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Workflow validation passed (${checks} checks).`);
}
