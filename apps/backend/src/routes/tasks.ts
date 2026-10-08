import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { createTaskController } from "../controllers/tasks.js";
import type { TaskService } from "../services/tasks.js";

function wrap(fn: (req: Request, res: Response) => void) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      fn(req, res);
    } catch (err) {
      next(err);
    }
  };
}

export function taskRoutes(service: TaskService): Router {
  const router = Router();
  const c = createTaskController(service);
  router.get("/tasks", wrap(c.list));
  router.post("/tasks", wrap(c.create));
  router.put("/tasks/:id/status", wrap(c.updateStatus));
  router.delete("/tasks/:id", wrap(c.remove));
  router.get("/tasks/:id/audit-logs", wrap(c.auditLogs));
  return router;
}
