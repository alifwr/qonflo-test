import express from "express";
import type Database from "better-sqlite3";
import { errorHandler } from "./middleware/errors.js";
import { taskRoutes } from "./routes/tasks.js";
import { TaskService } from "./services/tasks.js";

export function createApp(db: Database.Database): express.Express {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api", taskRoutes(new TaskService(db)));
  app.use(errorHandler);
  return app;
}
