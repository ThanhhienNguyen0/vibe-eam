import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { demoCredentials } from "./demoSeed.js";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!directory.startsWith(path.join(os.tmpdir(), "req24-seed-"))) throw new Error("Unsafe test path");
    await rm(directory, { recursive: true, force: true });
  }
});
async function file(value: unknown) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "req24-seed-")); directories.push(directory);
  const name = path.join(directory, "credentials.json");
  await writeFile(name, JSON.stringify(value)); return name;
}
describe("explicit safe demo seed opt-in", () => {
  it("is disabled by default and refuses production/unknown environments before reading credentials", async () => {
    expect(await demoCredentials({})).toBeNull();
    expect(await demoCredentials({ SEED_DEMO_USERS: "false", NODE_ENV: "production" })).toBeNull();
    for (const NODE_ENV of [undefined, "production", "staging"]) {
      await expect(demoCredentials({ SEED_DEMO_USERS: "true", NODE_ENV })).rejects.toThrow(/NODE_ENV/);
    }
    await expect(demoCredentials({ SEED_DEMO_USERS: "true", NODE_ENV: "test" })).rejects.toThrow(/PASSWORDS_FILE/);
  });
  it("requires exactly three distinct sufficiently strong passwords without disclosing them", async () => {
    const valid = { Admin: "test-only-admin-password-123", Architect: "test-only-architect-password-123", Viewer: "test-only-viewer-password-123" };
    for (const invalid of [{}, { ...valid, Viewer: "short" }, { ...valid, Viewer: valid.Admin }, { ...valid, member: "test-only-invalid-123" }, { ...valid, Viewer: "ä".repeat(40) }]) {
      await expect(demoCredentials({ SEED_DEMO_USERS: "true", NODE_ENV: "test", SEED_DEMO_PASSWORDS_FILE: await file(invalid) })).rejects.toThrow();
    }
    expect(await demoCredentials({ SEED_DEMO_USERS: "true", NODE_ENV: "development", SEED_DEMO_PASSWORDS_FILE: await file(valid) })).toEqual(valid);
  });
});
