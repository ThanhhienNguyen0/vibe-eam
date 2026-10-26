import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { assess } from "./scan-dependencies.mjs";
import { securityWorkflowChecks } from "./workflow-security.mjs";

const vulnerability = { severity: "high", range: "<2", nodes: ["node_modules/example"], via: [{ url: "https://example.invalid/advisory", severity: "high", range: "<2" }] };
const audit = { auditReportVersion: 2, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } }, vulnerabilities: { example: vulnerability } };
test("high findings always block", () => assert.equal(assess(audit).failures.length, 1));
test("critical findings always block", () => {
  const critical = structuredClone(audit);
  critical.vulnerabilities.example.severity = "critical";
  critical.metadata.vulnerabilities.high = 0;
  critical.metadata.vulnerabilities.critical = 1;
  assert.equal(assess(critical).failures.length, 1);
});
test("low and moderate findings remain below the explicit blocking threshold", () => {
  for (const severity of ["low", "moderate"]) {
    const changed = structuredClone(audit);
    changed.vulnerabilities.example.severity = severity;
    changed.metadata.vulnerabilities.high = 0;
    changed.metadata.vulnerabilities[severity] = 1;
    assert.deepEqual(assess(changed).failures, []);
  }
});
test("network/error/incomplete audit responses cannot pass", () => {
  for (const broken of [{}, { error: { code: "ENOTFOUND" } }, { auditReportVersion: 2, vulnerabilities: {} }]) assert.throws(() => assess(broken));
});
test("inconsistent metadata, missing counts, unknown severity and array reports fail closed", () => {
  const inconsistent = structuredClone(audit);
  inconsistent.vulnerabilities = {};
  const unknown = structuredClone(audit);
  unknown.vulnerabilities.example.severity = "unexpected";
  const missing = structuredClone(audit);
  delete missing.metadata.vulnerabilities.total;
  const array = structuredClone(audit);
  array.vulnerabilities = [];
  const malformed = structuredClone(audit);
  malformed.metadata.vulnerabilities.high = "1";
  for (const broken of [inconsistent, unknown, missing, array, malformed, null]) assert.throws(() => assess(broken));
});

const ci = parse(await readFile(".github/workflows/ci.yml", "utf8"));
const codeql = parse(await readFile(".github/workflows/codeql.yml", "utf8"));
const staging = parse(await readFile(".github/workflows/deploy-staging.yml", "utf8"));
const production = parse(await readFile(".github/workflows/deploy-prod.yml", "utf8"));
const dependabot = parse(await readFile(".github/dependabot.yml", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
function failures(c = ci, q = codeql, d = dependabot, p = pkg, deployments = [["Deploy staging", staging], ["Deploy production", production]]) {
  return securityWorkflowChecks(c, q, d, p, deployments).filter((result) => !result.condition);
}
test("current quality and security workflow definitions pass", () => assert.deepEqual(failures(), []));
test("removing or making the REQ-24 database gate optional is detected", () => {
  for (const mutation of [
    (step) => { step.run = "echo omitted"; },
    (step) => { step.if = "false"; },
    (step) => { step["continue-on-error"] = true; }
  ]) {
    const changed = structuredClone(ci);
    mutation(changed.jobs.verify.steps.find((step) => step.name === "Test RBAC against an isolated PostgreSQL cluster"));
    assert.ok(failures(changed).length > 0);
  }
});
for (const [jobId, command] of [["verify", "npm run lint"], ["verify", "npm run typecheck"], ["verify", "npm test"], ["verify", "npm run build"], ["dependencies", "npm run scan:dependencies"], ["secrets", "npm run scan:secrets"]]) {
  test(`removing ${command} is detected`, () => {
    const changed = structuredClone(ci);
    changed.jobs[jobId].steps = changed.jobs[jobId].steps.filter((step) => step.run !== command);
    assert.ok(failures(changed).length > 0);
  });
}
test("conditional/nonblocking gates and partial history are detected", () => {
  for (const mutation of [
    (c) => { c.jobs.verify.if = "false"; },
    (c) => { c.jobs.dependencies["continue-on-error"] = true; },
    (c) => { c.jobs.secrets.steps[0].with["fetch-depth"] = 1; },
    (c) => { c.on.pull_request = { paths: ["backend/**"] }; },
    (c) => { c.jobs.verify.steps[0].uses = "actions/checkout@v6"; },
  ]) {
    const changed = structuredClone(ci);
    mutation(changed);
    assert.ok(failures(changed).length > 0);
  }
});
test("missing CodeQL and local quality gates are detected", () => {
  assert.ok(failures(ci, { ...codeql, jobs: {} }).length > 0);
  assert.ok(failures(ci, codeql, dependabot, { scripts: {} }).length > 0);
});
test("an annotated-tag object SHA cannot replace the verified CodeQL commit", () => {
  const changed = structuredClone(codeql);
  for (const step of changed.jobs.analyze.steps) {
    if (step.uses?.startsWith("github/codeql-action/")) step.uses = step.uses.replace("6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee", "f051dc808ef3645eb0d08647ec751634ec2304ac");
  }
  assert.ok(failures(ci, changed).length > 0);
});
test("mutable actions in deployment workflows are detected", () => {
  const changed = structuredClone(staging);
  changed.jobs.verify.steps[0].uses = "actions/checkout@v6";
  assert.ok(failures(ci, codeql, dependabot, pkg, [["Deploy staging", changed], ["Deploy production", production]]).length > 0);
});
