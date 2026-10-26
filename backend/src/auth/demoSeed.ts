import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import { ROLES, type Role } from "./policy.js";
import { validatePassword, hashLocalPassword } from "./authService.js";
import { DEFAULT_COMPANY_ID, DEFAULT_COMPANY_NAME } from "../tenant.js";

export const DEMO_EMAILS: Record<Role, string> = {
  Admin: "admin@req24.example.invalid", Architect: "architect@req24.example.invalid", Viewer: "viewer@req24.example.invalid"
};

/** A local file keeps secrets out of tracked files, command arguments and seed output. */
export async function demoCredentials(environment: NodeJS.ProcessEnv): Promise<Record<Role, string> | null> {
  if (environment.SEED_DEMO_USERS !== "true") return null;
  if (!["development", "test"].includes(environment.NODE_ENV ?? "")) throw new Error("Demo users require NODE_ENV=development or test.");
  if (!environment.SEED_DEMO_PASSWORDS_FILE) throw new Error("SEED_DEMO_PASSWORDS_FILE is required.");
  let input: unknown;
  try { input = JSON.parse(await readFile(environment.SEED_DEMO_PASSWORDS_FILE, "utf8")); }
  catch { throw new Error("Demo credential file could not be read as JSON."); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid demo credential file.");
  const passwords = input as Record<string, unknown>;
  if (Object.keys(passwords).length !== ROLES.length) throw new Error("Provide exactly one password per demo role.");
  for (const role of ROLES) {
    const password = passwords[role];
    if (typeof password !== "string" || password.length < 16) throw new Error("Demo passwords must contain at least 16 characters.");
    validatePassword(password);
  }
  if (new Set(Object.values(passwords)).size !== ROLES.length) throw new Error("Demo passwords must be distinct.");
  return passwords as Record<Role, string>;
}

export async function seedDemoUsers(prisma: PrismaClient, credentials: Record<Role, string> | null): Promise<void> {
  if (!credentials) return;
  const hashes = await Promise.all(ROLES.map((role) => hashLocalPassword(credentials[role])));
  await prisma.$transaction(async (tx) => {
    await tx.company.upsert({ where: { id: DEFAULT_COMPANY_ID }, create: { id: DEFAULT_COMPANY_ID, name: DEFAULT_COMPANY_NAME }, update: {} });
    await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${DEFAULT_COMPANY_ID} FOR UPDATE`;
    const users = await tx.user.findMany({ where: { OR: [{ companyId: DEFAULT_COMPANY_ID }, { email: { in: Object.values(DEMO_EMAILS) } }] } });
    if (users.some((user) => user.companyId !== DEFAULT_COMPANY_ID || !Object.values(DEMO_EMAILS).includes(user.email))) {
      throw new Error("Demo company/email collision; seed refused.");
    }
    for (const [index, role] of ROLES.entries()) {
      await tx.user.upsert({
        where: { email: DEMO_EMAILS[role] },
        create: { email: DEMO_EMAILS[role], passwordHash: hashes[index], companyId: DEFAULT_COMPANY_ID, name: `REQ-24 Demo ${role}`, role },
        update: { passwordHash: hashes[index], role }
      });
    }
  });
}
