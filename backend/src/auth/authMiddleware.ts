import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { runWithPrincipal, type AuthPrincipal } from "../tenant.js";
import type { AuthRepository } from "./authTypes.js";
import { isRole } from "./policy.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthPrincipal;
  }
}

/** Identity adapters resolve internal users; provider claims never grant permissions. */
export function requireAuth(jwtSecret: string, repository: Pick<AuthRepository, "findUserById">) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    let userId: string;
    let legacyCompany: unknown;
    try {
      const payload = jwt.verify(header.slice(7), jwtSecret, { issuer: "eam-tool", audience: "eam-tool", algorithms: ["HS256"] });
      if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.sub || typeof payload.exp !== "number") {
        throw new Error("Invalid JWT payload.");
      }
      userId = payload.sub;
      legacyCompany = payload.companyId;
    } catch {
      res.status(401).json({ error: "Invalid or expired authentication token." });
      return;
    }
    try {
      const user = await repository.findUserById(userId);
      if (!user || (legacyCompany !== undefined && legacyCompany !== user.companyId)) {
        res.status(401).json({ error: "Authentication is no longer valid." });
        return;
      }
      if (!isRole(user.role) || !user.companyId) {
        res.status(403).json({ error: "No valid authorization context." });
        return;
      }
      const principal: AuthPrincipal = { userId: user.id, companyId: user.companyId, role: user.role };
      req.user = principal;
      runWithPrincipal(principal, next);
    } catch (error) {
      next(error);
    }
  };
}
