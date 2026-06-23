import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AuthPrincipal } from "../tenant.js";
import type { AuthRepository, AuthResult, PublicUser, StoredUser } from "./authTypes.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_ROUNDS = 12;

export class AuthHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function requireJwtSecret(environment: NodeJS.ProcessEnv = process.env): string {
  const secret = environment.JWT_SECRET?.trim();
  if (!secret) throw new Error("JWT_SECRET is required. Set a strong secret before starting the backend.");
  if (secret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  return secret;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function publicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    companyId: user.companyId,
    companyName: user.companyName,
    role: user.role
  };
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtSecret: string
  ) {}

  private tokenFor(user: StoredUser): string {
    return jwt.sign(
      { companyId: user.companyId, role: user.role },
      this.jwtSecret,
      { subject: user.id, expiresIn: "8h", issuer: "eam-tool", audience: "eam-tool" }
    );
  }

  async register(input: { email?: unknown; password?: unknown; companyName?: unknown; name?: unknown }): Promise<AuthResult> {
    const email = normalizeEmail(typeof input.email === "string" ? input.email : "");
    const password = typeof input.password === "string" ? input.password : "";
    const companyName = typeof input.companyName === "string" ? input.companyName.trim() : "";
    const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : null;

    if (!EMAIL_PATTERN.test(email)) throw new AuthHttpError(400, "A valid email is required.");
    if (password.length < 8) throw new AuthHttpError(400, "Password must contain at least 8 characters.");
    if (!companyName) throw new AuthHttpError(400, "companyName is required.");
    if (await this.repository.findUserByEmail(email)) throw new AuthHttpError(409, "An account with this email already exists.");

    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
    let user: StoredUser;
    try {
      user = await this.repository.createCompanyUser({ email, passwordHash, name, companyName });
    } catch (error) {
      if (error instanceof Error && /unique|already exists/i.test(error.message)) {
        throw new AuthHttpError(409, "An account with this email already exists.");
      }
      throw error;
    }
    return { token: this.tokenFor(user), user: publicUser(user) };
  }

  async login(input: { email?: unknown; password?: unknown }): Promise<AuthResult> {
    const email = normalizeEmail(typeof input.email === "string" ? input.email : "");
    const password = typeof input.password === "string" ? input.password : "";
    if (!email || !password) throw new AuthHttpError(400, "email and password are required.");

    const user = await this.repository.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthHttpError(401, "Invalid email or password.");
    }
    return { token: this.tokenFor(user), user: publicUser(user) };
  }

  async me(principal: AuthPrincipal): Promise<PublicUser> {
    const user = await this.repository.findUserById(principal.userId);
    if (!user || user.companyId !== principal.companyId) throw new AuthHttpError(401, "Authentication is no longer valid.");
    return publicUser(user);
  }
}
