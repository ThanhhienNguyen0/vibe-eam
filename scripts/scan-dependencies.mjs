import { spawnSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function assess(audit) {
  const summary = audit?.metadata?.vulnerabilities;
  if (!audit || audit.error || audit.auditReportVersion !== 2 || !audit.vulnerabilities ||
      typeof audit.vulnerabilities !== "object" || Array.isArray(audit.vulnerabilities) || !summary) {
    throw new Error("Incomplete audit response; refusing to pass the security gate.");
  }
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const vulnerability of Object.values(audit.vulnerabilities)) {
    if (!vulnerability || !Object.hasOwn(counts, vulnerability.severity)) {
      throw new Error("Unknown or missing advisory severity; gate closed.");
    }
    counts[vulnerability.severity] += 1;
  }
  counts.total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  for (const [severity, count] of Object.entries(counts)) {
    if (!Number.isInteger(summary[severity]) || summary[severity] < 0 || summary[severity] !== count) {
      throw new Error("Missing or inconsistent audit counts; gate closed.");
    }
  }
  const failures = [];
  for (const [name, vulnerability] of Object.entries(audit.vulnerabilities)) {
    if (!["high", "critical"].includes(vulnerability.severity)) continue;
    failures.push(`${name}: ${vulnerability.severity.toUpperCase()} (blocks merge; no exceptions)`);
  }
  return { failures };
}

async function main() {
  // Calling npm's JS entry point avoids shell interpolation and Windows .cmd quoting.
  if (!process.env.npm_execpath) throw new Error("Run through npm run scan:dependencies.");
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error || ![0, 1].includes(result.status)) throw new Error("npm audit execution failed; gate closed.");
  const audit = JSON.parse(result.stdout);
  await mkdir(".cache/security", { recursive: true });
  await writeFile(".cache/security/audit.json", JSON.stringify(audit, null, 2) + "\n");
  const assessment = assess(audit);
  console.log("Full dependency audit (including dev):", audit.metadata.vulnerabilities);
  for (const message of assessment.failures) console.error(message);
  console.log("Low/moderate findings remain visible in .cache/security/audit.json; see docs/security/DEPENDENCY_RISKS.md.");
  if (assessment.failures.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
