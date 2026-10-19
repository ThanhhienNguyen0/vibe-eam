import assert from "node:assert/strict";
import { loadConfigFromFile } from "@prisma/config";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Compatibility contract for the scoped deepmerge-ts 8 security update.
const packageInfo = JSON.parse(await readFile("node_modules/deepmerge-ts/package.json", "utf8"));
assert.equal(packageInfo.version, "8.0.0");
await mkdir(".cache", { recursive: true });
const directory = await mkdtemp(path.resolve(".cache/prisma-config-"));
if (!directory.startsWith(path.resolve(".cache") + path.sep)) throw new Error("Unsafe temporary config path");
try {
  const schema = path.resolve("backend/prisma/schema.prisma");
  const migrations = path.resolve("backend/prisma/migrations");
  const file = path.join(directory, "prisma.config.ts");
  await writeFile(file, `import { defineConfig } from "prisma/config";
export default defineConfig({ schema: ${JSON.stringify(schema)}, migrations: { path: ${JSON.stringify(migrations)}, seed: "tsx prisma/seed.ts" } });\n`);
  const result = await loadConfigFromFile({ configFile: file, configRoot: directory });
  assert.equal(result.error, undefined, "Prisma config loader must accept nested plain-object settings");
  assert.equal(result.config.schema, schema);
  assert.equal(result.config.migrations.path, migrations);
  assert.equal(result.config.migrations.seed, "tsx prisma/seed.ts");
  console.log("Prisma config compatibility passed: patched merger loads schema, migrations and seed settings.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
