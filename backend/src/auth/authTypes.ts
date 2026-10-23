import type { Role } from "./policy.js";

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  companyId: string;
  companyName: string;
  role: Role;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  companyId: string;
  companyName: string;
  role: Role;
}

export interface AuthRepository {
  createCompanyUser(input: {
    email: string;
    passwordHash: string;
    name: string | null;
    companyName: string;
  }): Promise<StoredUser>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(userId: string): Promise<StoredUser | null>;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export interface LocalUserInput {
  email: string;
  passwordHash: string;
  name: string | null;
  role: Role;
}

/** Implementations lock the company, then recheck the actor and last-admin invariant. */
export interface UserRepository {
  listCompanyUsers(companyId: string): Promise<PublicUser[]>;
  createLocalUser(actorId: string, companyId: string, input: LocalUserInput): Promise<PublicUser>;
  changeRole(actorId: string, companyId: string, userId: string, role: Role): Promise<PublicUser>;
}
