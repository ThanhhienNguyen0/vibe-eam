import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Official release assets; hashes independently recorded from upstream checksums.
const version = "8.30.1";
const assets = {
  "linux-x64": ["linux_x64.tar.gz", "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"],
  "linux-arm64": ["linux_arm64.tar.gz", "e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080"],
  "win32-x64": ["windows_x64.zip", "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e"],
  "darwin-arm64": ["darwin_arm64.tar.gz", "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5"],
  "darwin-x64": ["darwin_x64.tar.gz", "dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709"],
};
const asset = assets[`${process.platform}-${process.arch}`];
if (!asset) throw new Error("Unsupported scanner platform; use the Linux CI job.");
const cache = path.resolve(".cache", "gitleaks", version);
await mkdir(cache, { recursive: true });
const archive = path.join(cache, `gitleaks_${version}_${asset[0]}`);
let bytes;
try { bytes = await readFile(archive); } catch { /* Download on first use. */ }
if (!bytes || createHash("sha256").update(bytes).digest("hex") !== asset[1]) {
  const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${version}/${path.basename(archive)}`);
  if (!response.ok) throw new Error(`Gitleaks download failed: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (createHash("sha256").update(bytes).digest("hex") !== asset[1]) throw new Error("Gitleaks checksum mismatch");
await writeFile(archive, bytes);
execFileSync("tar", ["-xf", archive, "-C", cache]);
const binary = path.join(cache, process.platform === "win32" ? "gitleaks.exe" : "gitleaks");
const baseArgs = ["--redact=100", "--no-banner", "--ignore-gitleaks-allow", "--gitleaks-ignore-path", path.resolve(".gitleaksignore")];

function scan(args, expected = 0) {
  const result = spawnSync(binary, [...args, ...baseArgs], { encoding: "utf8" });
  // Redacted scanner diagnostics only. No report containing raw secrets is created.
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== expected) throw new Error(`Secret scan failed (exit ${result.status ?? "unavailable"})`);
}

const temp = await mkdtemp(path.join(os.tmpdir(), "eam-secret-scan-"));
if (!path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error("Unsafe temporary scan path");
try {
  // An untracked, deliberately synthetic canary proves that detection blocks.
  const canary = path.join(temp, "canary");
  await mkdir(canary);
  const synthetic = "ghp_" + randomBytes(27).toString("base64").replace(/[^a-zA-Z0-9]/g, "Z");
  await writeFile(path.join(canary, "fixture.txt"), `github_token = "${synthetic}"\n`);
  scan(["dir", canary, "--config", path.resolve(".gitleaks.toml")], 1);
  console.log("Secret scanner canary: correctly rejected synthetic credential.");

  const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim();
  if (shallow !== "false") throw new Error("Secret history scan requires a full checkout (fetch-depth: 0).");
  scan(["git", ".", "--log-opts=--all --full-history", "--config", path.resolve(".gitleaks.toml")]);

  // Include tracked and untracked non-ignored files without scanning node_modules or private ignored env files.
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const worktree = path.join(temp, "worktree");
  await mkdir(worktree);
  for (const file of files) {
    const destination = path.resolve(worktree, file);
    if (!destination.startsWith(worktree + path.sep)) throw new Error("Invalid tracked path");
    await mkdir(path.dirname(destination), { recursive: true });
    try { await cp(file, destination, { dereference: false }); }
    catch (error) { if (error.code !== "ENOENT") throw error; } // Locally deleted tracked file.
  }
  scan(["dir", worktree, "--config", path.resolve(".gitleaks.toml")]);
  console.log(`Secret scan passed: full fetched history and ${files.length} current repository files.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
