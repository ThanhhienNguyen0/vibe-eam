import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../server.js";
import { requireJwtSecret } from "./authService.js";
import type { AuthRepository, StoredUser } from "./authTypes.js";

const SECRET = "test-jwt-secret-with-at-least-thirty-two-characters";

class MemoryAuthRepository implements AuthRepository {
  users: StoredUser[] = [];

  async createCompanyUser(input: {
    email: string;
    passwordHash: string;
    name: string | null;
    companyName: string;
  }): Promise<StoredUser> {
    const user: StoredUser = {
      id: `user-${this.users.length + 1}`,
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      companyId: `company-${this.users.length + 1}`,
      companyName: input.companyName,
      role: "member"
    };
    this.users.push(user);
    return structuredClone(user);
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return structuredClone(this.users.find((user) => user.email === email) ?? null);
  }

  async findUserById(userId: string): Promise<StoredUser | null> {
    return structuredClone(this.users.find((user) => user.id === userId) ?? null);
  }
}

async function register(app: ReturnType<typeof createApp>, email = "USER@Example.com") {
  return request(app).post("/api/auth/register").send({
    email,
    password: "correct horse battery staple",
    companyName: "Example GmbH",
    name: "Example User"
  });
}

describe("application authentication", () => {
  it("refuses to start without a sufficiently strong JWT_SECRET", () => {
    expect(() => requireJwtSecret({})).toThrow(/JWT_SECRET is required/);
    expect(() => requireJwtSecret({ JWT_SECRET: "too-short" })).toThrow(/at least 32/);
  });

  it("registers a company user with a normalized email and never stores or returns the plain password", async () => {
    const repository = new MemoryAuthRepository();
    const response = await register(createApp({ jwtSecret: SECRET, authRepository: repository }));

    expect(response.status).toBe(201);
    expect(repository.users[0].email).toBe("user@example.com");
    expect(repository.users[0].passwordHash).not.toContain("correct horse battery staple");
    expect(repository.users[0].passwordHash).toMatch(/^\$2[aby]\$/);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain("correct horse battery staple");
  });

  it("logs in with the correct password", async () => {
    const repository = new MemoryAuthRepository();
    const app = createApp({ jwtSecret: SECRET, authRepository: repository });
    await register(app);
    const response = await request(app).post("/api/auth/login").send({ email: "user@example.com", password: "correct horse battery staple" });
    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.companyId).toBe("company-1");
  });

  it("rejects a wrong password", async () => {
    const repository = new MemoryAuthRepository();
    const app = createApp({ jwtSecret: SECRET, authRepository: repository });
    await register(app);
    const response = await request(app).post("/api/auth/login").send({ email: "user@example.com", password: "wrong-password" });
    expect(response.status).toBe(401);
  });

  it("rejects /api/auth/me without a bearer token", async () => {
    const response = await request(createApp({ jwtSecret: SECRET, authRepository: new MemoryAuthRepository() })).get("/api/auth/me");
    expect(response.status).toBe(401);
  });

  it("protects the EAM sidebar without invoking its persistence layer", async () => {
    const response = await request(createApp({ jwtSecret: SECRET, authRepository: new MemoryAuthRepository() })).get("/api/sidebar/");
    expect(response.status).toBe(401);
  });

  it("returns the authenticated user without passwordHash", async () => {
    const repository = new MemoryAuthRepository();
    const app = createApp({ jwtSecret: SECRET, authRepository: repository });
    const registration = await register(app);
    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${registration.body.token}`);
    expect(response.status).toBe(200);
    expect(response.body.email).toBe("user@example.com");
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  it("issues distinct company principals for separately registered companies", async () => {
    const repository = new MemoryAuthRepository();
    const app = createApp({ jwtSecret: SECRET, authRepository: repository });
    const first = await register(app, "a@example.com");
    const second = await register(app, "b@example.com");
    expect(first.body.user.companyId).not.toBe(second.body.user.companyId);
  });

  it("requires passwords with at least eight characters", async () => {
    const response = await request(createApp({ jwtSecret: SECRET, authRepository: new MemoryAuthRepository() }))
      .post("/api/auth/register")
      .send({ email: "short@example.com", password: "short", companyName: "Example" });
    expect(response.status).toBe(400);
  });
});
