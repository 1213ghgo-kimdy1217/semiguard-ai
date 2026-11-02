import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerSocialOAuthRoutes } from "./socialOAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerTrainingStorageCheck } from "../trainingStorageCheck";
import { recoveryQaGate } from "../recoveryQa";

export function accountServicesConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.JWT_SECRET && process.env.VITE_APP_ID);
}

/** Shared API application for the existing Node server and Vercel Functions. */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Stop every API entry before body parsing, authentication, or DB side effects.
  app.use("/api", (_req, res, next) => {
    if (process.env.SEMIGUARD_DB_MAINTENANCE !== "1") {
      next();
      return;
    }
    res.set("Cache-Control", "no-store");
    res.set("Retry-After", "60");
    res.status(503).json({
      error: { code: "DB_MAINTENANCE", message: "Account and saved-record services are temporarily unavailable. Please try again shortly." },
    });
  });
  app.use(recoveryQaGate);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // A deployment without its session secret must not accept authentication.
  app.use("/api", (req, res, next) => {
    if (!accountServicesConfigured() && req.path !== "/health" && req.path !== "/trpc/auth.me") {
      res.status(503).json({ error: { message: "Account services are not configured on this deployment." } });
      return;
    }
    next();
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerSocialOAuthRoutes(app);
  registerTrainingStorageCheck(app);
  app.get("/api/health", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.status(200).json({ status: "ok", capabilities: { accounts: accountServicesConfigured() } });
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
