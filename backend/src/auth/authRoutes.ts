import { Router, type NextFunction, type Request, type Response } from "express";
import { AuthHttpError, AuthService } from "./authService.js";
import { requireAuth } from "./authMiddleware.js";

function sendAuthError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof AuthHttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  next(error);
}

export function createAuthRouter(service: AuthService, jwtSecret: string): Router {
  const router = Router();
  const authenticated = requireAuth(jwtSecret);

  router.post("/register", async (req, res, next) => {
    try {
      res.status(201).json(await service.register(req.body ?? {}));
    } catch (error) {
      sendAuthError(error, res, next);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      res.json(await service.login(req.body ?? {}));
    } catch (error) {
      sendAuthError(error, res, next);
    }
  });

  router.get("/me", authenticated, async (req: Request, res, next) => {
    try {
      res.json(await service.me(req.user!));
    } catch (error) {
      sendAuthError(error, res, next);
    }
  });

  router.post("/logout", authenticated, (_req, res) => {
    res.status(204).send();
  });

  return router;
}
