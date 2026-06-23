import { PrismaClient } from "@prisma/client";
import type { AuthRepository, StoredUser } from "./authTypes.js";

const includeCompany = { company: { select: { name: true } } } as const;

function stored(user: {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  companyId: string;
  role: string;
  company: { name: string };
}): StoredUser {
  return { ...user, companyName: user.company.name };
}

export class PrismaAuthRepository implements AuthRepository {
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
          role: "member"
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
}
