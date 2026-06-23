export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  companyId: string;
  companyName: string;
  role: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  companyId: string;
  companyName: string;
  role: string;
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
