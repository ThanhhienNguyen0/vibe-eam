import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { randomUUID } from "node:crypto";

// Own cluster only: never consume DATABASE_URL or touch a pre-existing database.
const bin = process.env.PG_BIN;
if (!bin) throw new Error("Set PG_BIN to the installed PostgreSQL bin directory (initdb, pg_ctl, psql).");
const executable = (name) => path.join(bin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
const cache = path.resolve(".cache");
await mkdir(cache, { recursive: true });
const directory = await mkdtemp(path.join(cache, "req24-pg-"));
if (!directory.startsWith(cache + path.sep)) throw new Error("Unsafe test-cluster path.");
const data = path.join(directory, "data");
const socket = net.createServer();
await new Promise((resolve, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", resolve); });
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const database = `req24_test_${randomUUID().replaceAll("-", "")}`;
const serverOptions = `-h 127.0.0.1 -p ${port}${process.platform === "win32" ? "" : ` -k "${directory}"`}`;
let started = false;
try {
  execFileSync(executable("initdb"), ["-D", data, "-U", "req24", "-A", "trust", "--no-locale", "-E", "UTF8"], { stdio: "pipe", windowsHide: true });
  // Windows postgres inherits pipe handles; detached server startup must not own captured pipes.
  execFileSync(executable("pg_ctl"), ["-D", data, "-l", path.join(directory, "server.log"), "-o", serverOptions, "-w", "start"], { stdio: "ignore", windowsHide: true, timeout: 90000 });
  started = true;
  execFileSync(executable("psql"), ["-h", "127.0.0.1", "-p", String(port), "-U", "req24", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE ${database}`], { stdio: "pipe", windowsHide: true });
  const url = `postgresql://req24@127.0.0.1:${port}/${database}`;
  const environment = { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url, STORAGE_BACKEND: "database", NODE_ENV: "test", PG_TEST_PSQL: executable("psql") };
  const node = process.execPath;
  execFileSync(node, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "backend/prisma/schema.prisma"], { env: environment, stdio: "inherit", windowsHide: true });
  execFileSync(node, [path.resolve("node_modules/vitest/vitest.mjs"), "run", "--config", "vitest.config.ts", "src/auth/rbac.database.test.ts", "--cache=false"], { cwd: path.resolve("backend"), env: environment, stdio: "inherit", windowsHide: true });
} finally {
  if (started) execFileSync(executable("pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], { stdio: "ignore", windowsHide: true, timeout: 90000 });
  if (directory.startsWith(cache + path.sep)) await rm(directory, { recursive: true, force: true });
}
