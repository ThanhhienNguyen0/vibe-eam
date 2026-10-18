export function securityWorkflowChecks(ci, codeql, dependabot, pkg) {
  const codeqlActionSha = "6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee";
  const checks = [];
  const check = (condition, message) => checks.push({ condition: Boolean(condition), message });
  const jobs = ci.jobs ?? {};
  check(ci.on && Object.hasOwn(ci.on, "pull_request") && ci.on.pull_request === null, "CI must run for every PR without path or branch filters");
  check(ci.permissions?.contents === "read" && Object.keys(ci.permissions).length === 1, "CI requires read-only contents permission");
  const expected = {
    verify: ["Quality and infrastructure", ["npm ci", "npm run db:generate --workspace backend", "npm run lint", "npm run typecheck", "npm test", "npm run build", "npm run validate:compose", "npm run validate:workflows", "npm run test:security", "npm run validate:prisma-config"]],
    dependencies: ["Dependency security", ["npm ci --ignore-scripts", "npm run scan:dependencies"]],
    secrets: ["Secret security", ["npm run scan:secrets"]],
  };
  for (const [id, [name, commands]] of Object.entries(expected)) {
    const job = jobs[id];
    check(job?.name === name, `Stable required check missing: ${name}`);
    check(job && !job.if && !job["continue-on-error"], `${name} must run and block on failure`);
    for (const command of commands) {
      check(job?.steps?.some((step) => !step.if && !step["continue-on-error"] && step.run?.split("\n").map((line) => line.trim()).includes(command)), `${name}: mandatory command missing or conditional: ${command}`);
    }
  }
  const secretCheckout = jobs.secrets?.steps?.find((step) => step.uses?.startsWith("actions/checkout@"));
  check(secretCheckout?.with?.["fetch-depth"] === 0, "Secret scan requires full history");
  check(secretCheckout?.with?.["persist-credentials"] === false, "Secret scan checkout must not persist credentials");
  for (const [file, workflow] of [["CI", ci], ["CodeQL", codeql]]) {
    for (const job of Object.values(workflow.jobs ?? {})) {
      for (const step of job.steps ?? []) {
        if (step.uses) check(/^[\w/-]+@[a-f0-9]{40}$/.test(step.uses), `${file}: action must be pinned to immutable SHA: ${step.uses}`);
      }
    }
  }
  check(Object.hasOwn(codeql.on ?? {}, "pull_request") && codeql.on.pull_request === null, "CodeQL must run for every PR");
  check(codeql.on?.push?.branches?.includes("main"), "CodeQL must run on main pushes");
  check(codeql.on?.schedule?.some((item) => typeof item.cron === "string"), "CodeQL schedule missing");
  check(codeql.permissions?.contents === "read" && Object.keys(codeql.permissions).length === 1, "CodeQL global permissions must be minimal");
  const analyze = codeql.jobs?.analyze;
  check(analyze?.name === "CodeQL JavaScript TypeScript" && !analyze.if && !analyze["continue-on-error"], "Stable blocking CodeQL check missing");
  check(analyze?.permissions?.contents === "read" && analyze.permissions["security-events"] === "write" && Object.keys(analyze.permissions).length === 2, "CodeQL job permissions must be contents read and security-events write only");
  check(analyze?.steps?.some((step) => step.uses === `github/codeql-action/init@${codeqlActionSha}` && step.with?.languages === "javascript-typescript" && step.with?.["build-mode"] === "none" && !step.if && !step["continue-on-error"]), "CodeQL JS/TS initialization missing or not pinned to the verified v4 commit");
  check(analyze?.steps?.some((step) => step.uses === `github/codeql-action/analyze@${codeqlActionSha}` && !step.if && !step["continue-on-error"]), "Blocking CodeQL analysis missing or not pinned to the verified v4 commit");
  const npm = dependabot.updates?.find((entry) => entry["package-ecosystem"] === "npm");
  check(dependabot.version === 2 && npm?.directory === "/", "Dependabot must use root npm workspace lockfile");
  check(npm?.schedule?.interval === "weekly" && npm["open-pull-requests-limit"] <= 3, "Dependabot npm cadence or PR limit missing");
  for (const command of ["lint", "typecheck", "test", "build", "validate:compose", "validate:workflows", "test:security", "validate:prisma-config"]) {
    check(pkg.scripts?.check?.split(" && ").some((part) => part === `npm run ${command}` || (command === "test" && part === "npm test")), `Local check must include ${command}`);
  }
  check(pkg.scripts?.lint?.includes("backend/src frontend/src scripts/*.mjs") && pkg.scripts.lint.includes("--max-warnings 0"), "Lint must cover both sources and repository scripts with zero warnings");
  return checks;
}
