import { Router } from "express";
import { AuthHttpError, hashLocalPassword, validateLocalUser } from "./authService.js";
import type { UserRepository } from "./authTypes.js";
import { isRole } from "./policy.js";

export function createUserRouter(repository: UserRepository): Router {
  const router = Router();
  router.get("/", async (req, res, next) => {
    try { res.json(await repository.listCompanyUsers(req.user!.companyId)); } catch (error) { next(error); }
  });
  router.post("/", async (req, res, next) => {
    try {
      const { email, password, name } = validateLocalUser(req.body ?? {});
      if (!isRole(req.body?.role)) throw new AuthHttpError(400, "A valid role is required.");
      const passwordHash = await hashLocalPassword(password);
      res.status(201).json(await repository.createLocalUser(req.user!.userId, req.user!.companyId, { email, passwordHash, name, role: req.body.role }));
    } catch (error) { next(error); }
  });
  router.patch("/:id/role", async (req, res, next) => {
    try {
      if (!isRole(req.body?.role)) throw new AuthHttpError(400, "A valid role is required.");
      res.json(await repository.changeRole(req.user!.userId, req.user!.companyId, req.params.id, req.body.role));
    } catch (error) { next(error); }
  });
  return router;
}
