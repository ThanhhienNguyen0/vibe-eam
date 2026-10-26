import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import sidebarRouter from "./Sidebar/sidebarRoutes.js";
import { createAuthRouter } from "./auth/authRoutes.js";
import { requireAuth } from "./auth/authMiddleware.js";
import { AuthService, AuthHttpError, requireJwtSecret } from "./auth/authService.js";
import { apiSecurity } from "./auth/routePolicies.js";
import { createUserRouter } from "./auth/userRoutes.js";
import { PrismaAuthRepository } from "./auth/prismaAuthRepository.js";
import type { AuthRepository, UserRepository } from "./auth/authTypes.js";
import { requireDatabaseConfiguration } from "./persistence/databaseSidebarRepository.js";
import {
  addElement,
  addRelation,
  deleteElement,
  deleteRelation,
  getAuditLog,
  getModel,
  importModel,
  updateElement
} from "./store.js";
import {
  layerForType,
  normalizeElement,
  normalizeRelation,
  validateElement,
  validateModel,
  validateRelation
} from "./validation.js";
import type { EamModel } from "./types.js";

export interface AppOptions {
  jwtSecret: string;
  authRepository?: AuthRepository;
  userRepository?: UserRepository;
}

export function createApp(options: AppOptions): express.Express {
  const app = express();
  // Every documented public path has exactly one Nginx hop, which overwrites X-Forwarded-For.
  app.set("trust proxy", 1);
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const databaseRepository = options.authRepository && options.userRepository ? undefined : new PrismaAuthRepository(new PrismaClient());
  const authRepository = options.authRepository ?? databaseRepository!;
  const authService = new AuthService(authRepository, options.jwtSecret);

  app.use(cors(corsOrigin ? { origin: corsOrigin.split(",").map((origin) => origin.trim()) } : undefined));
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS" || req.path === "/api/health"
  }));
  app.use(express.json({ limit: "2mb" }));
  // Precedes every API route, including auth and future routers.
  app.use(apiSecurity(requireAuth(options.jwtSecret, authRepository)));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth/register", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false
  }));
  app.use("/api/auth/login", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true
  }));
  app.use("/api/auth", createAuthRouter(authService));
  app.use("/api/users", createUserRouter(options.userRepository ?? databaseRepository!));
  app.use("/api/sidebar", sidebarRouter);

  app.get("/api/model", async (_req, res, next) => {
  try {
    res.json(await getModel());
  } catch (error) {
    next(error);
  }
});

  app.post("/api/model/elements", async (req, res, next) => {
  try {
    const model = await getModel();
    const element = normalizeElement({
      ...req.body,
      layer: req.body.layer ?? layerForType(req.body.type ?? "Business Capability")
    });
    const validation = validateElement(element, new Set(model.elements.map((item) => item.id)));
    if (!validation.valid) return res.status(400).json(validation);
    const state = await addElement(element);
    res.status(201).json({ element, model: { elements: state.elements, relations: state.relations } });
  } catch (error) {
    next(error);
  }
});

  app.patch("/api/model/elements/:id", async (req, res, next) => {
  try {
    const existing = (await getModel()).elements.find((element) => element.id === req.params.id);
    if (!existing) return res.status(404).json({ error: "Element not found." });

    const updatedCandidate = normalizeElement({ ...existing, ...req.body, id: req.params.id });
    const validation = validateElement(updatedCandidate);
    if (!validation.valid) return res.status(400).json(validation);

    const updated = await updateElement(req.params.id, updatedCandidate);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

  app.delete("/api/model/elements/:id", async (req, res, next) => {
  try {
    const deleted = await deleteElement(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Element not found." });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

  app.post("/api/model/relations", async (req, res, next) => {
  try {
    const model = await getModel();
    const relation = normalizeRelation(req.body);
    const validation = validateRelation(relation, model, new Set(model.relations.map((item) => item.id)));
    if (!validation.valid) return res.status(400).json(validation);
    const state = await addRelation(relation);
    res.status(201).json({ relation, model: { elements: state.elements, relations: state.relations } });
  } catch (error) {
    next(error);
  }
});

  app.delete("/api/model/relations/:id", async (req, res, next) => {
  try {
    const deleted = await deleteRelation(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Relation not found." });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

  app.post("/api/model/import", async (req, res, next) => {
  try {
    const model = req.body as EamModel;
    const validation = validateModel(model);
    if (!validation.valid) return res.status(400).json(validation);
    const state = await importModel(model);
    res.json({ elements: state.elements, relations: state.relations });
  } catch (error) {
    next(error);
  }
});

  app.get("/api/model/export", async (_req, res, next) => {
  try {
    res.json(await getModel());
  } catch (error) {
    next(error);
  }
});

  app.get("/api/audit-log", async (_req, res, next) => {
  try {
    res.json(await getAuditLog());
  } catch (error) {
    next(error);
  }
});

  // Express recognizes error middleware by its four-argument signature.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Required Express error-handler arity.
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof AuthHttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    // Do not log database input/errors: those may contain credentials or password hashes.
    console.error("Unexpected server error.");
    res.status(500).json({ error: "Unexpected server error." });
  });

  return app;
}

export function startServer(environment: NodeJS.ProcessEnv = process.env): void {
  const port = Number(environment.PORT ?? 4000);
  requireDatabaseConfiguration(environment);
  const jwtSecret = requireJwtSecret(environment);
  createApp({ jwtSecret }).listen(port, () => {
    console.log(`EAM backend listening on http://localhost:${port}`);
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) startServer();
