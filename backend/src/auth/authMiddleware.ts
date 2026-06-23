import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { runWithPrincipal, type AuthPrincipal } from "../tenant.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthPrincipal;
    }
  }
}

export function requireAuth(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const payload = jwt.verify(header.slice(7), jwtSecret, { issuer: "eam-tool", audience: "eam-tool" });
      if (typeof payload === "string" || !payload.sub || typeof payload.companyId !== "string" || typeof payload.role !== "string") {
        throw new Error("Invalid JWT payload.");
      }
      const principal: AuthPrincipal = { userId: payload.sub, companyId: payload.companyId, role: payload.role };
      req.user = principal;
      runWithPrincipal(principal, next);
    } catch {
      res.status(401).json({ error: "Invalid or expired authentication token." });
    }
  };
}
