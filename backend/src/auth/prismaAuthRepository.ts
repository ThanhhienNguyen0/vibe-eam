import { PrismaClient, type Prisma } from "@prisma/client";
import type { AuthRepository, StoredUser, UserRepository, LocalUserInput, PublicUser } from "./authTypes.js";
import { AuthHttpError, publicUser } from "./authService.js";
import { permits, type Role } from "./policy.js";

const includeCompany = { company: { select: { name: true } } } as const;

function stored(user: {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  companyId: string;
  role: Role;
  company: { name: string };
}): StoredUser {
  return { ...user, companyName: user.company.name };
}

export class PrismaAuthRepository implements AuthRepository, UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createCompanyUser(input: {
    email: string;
    passwordHash: string;
    name: string | null;
    companyName: string;
  }): Promise<StoredUser> {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: { name: input.companyName } });
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          name: input.name,
          companyId: company.id,
          role: "Admin"
        },
        include: includeCompany
      });
      return stored(user);
    });
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: includeCompany });
    return user ? stored(user) : null;
  }

  async findUserById(userId: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: includeCompany });
    return user ? stored(user) : null;
  }

  async listCompanyUsers(companyId: string): Promise<PublicUser[]> {
    return (await this.prisma.user.findMany({ where: { companyId }, include: includeCompany, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }))
      .map((user) => publicUser(stored(user)));
  }

  private async lockAdmin(tx: Prisma.TransactionClient, actorId: string, companyId: string): Promise<void> {
    // Every user mutation locks this row, including competing administrator demotions.
    await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE`;
    const actor = await tx.user.findFirst({ where: { id: actorId, companyId } });
    if (!actor || !permits(actor.role, "users:manage")) throw new AuthHttpError(403, "Administrator permission required.");
  }

  async createLocalUser(actorId: string, companyId: string, input: LocalUserInput): Promise<PublicUser> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockAdmin(tx, actorId, companyId);
        return publicUser(stored(await tx.user.create({ data: { ...input, companyId }, include: includeCompany })));
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new AuthHttpError(409, "User could not be created with these details.");
      }
      throw error;
    }
  }

  async changeRole(actorId: string, companyId: string, userId: string, role: Role): Promise<PublicUser> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAdmin(tx, actorId, companyId);
      const target = await tx.user.findFirst({ where: { id: userId, companyId } });
      if (!target) throw new AuthHttpError(404, "User not found.");
      if (permits(target.role, "users:manage") && !permits(role, "users:manage") &&
          await tx.user.count({ where: { companyId, role: "Admin" } }) <= 1) {
        throw new AuthHttpError(409, "The last administrator cannot be demoted.");
      }
      return publicUser(stored(await tx.user.update({ where: { id: target.id }, data: { role }, include: includeCompany })));
    });
  }
}
